import crypto from 'node:crypto';
import type { NavTab } from '../../src/components/Sidebar.tsx';
import type {
  AuthSecurityPolicy,
  AuthStatusInfo,
  AuthTokenBundle,
  AuthUserPublic,
  RbacRole,
} from '../../src/types/pettycash.ts';
import {
  canAccessTab,
  isValidEmailFormat,
  normalizeEmailAddress,
  sanitizeRoleSlug,
  SYSTEM_ADMIN_LOCKED_PERMISSIONS,
  SYSTEM_ADMIN_ROLE_ID,
  VALID_NAV_TABS,
  validatePasswordStrength,
  validateRolePayload,
} from '../../src/utils/pettycashLogic.ts';
import { normalizePersonName } from '../../src/utils/formatters.ts';
import {
  generateRefreshTokenSecret,
  getEnvAdminPasscode,
  hashPasswordScrypt,
  parseSessionIdFromRefreshToken,
  sha256Hex,
  signAccessToken,
  verifyEnvAdminPasscode,
  verifyPasswordScrypt,
} from '../authCrypto.ts';
import {
  type AuthSessionRecord,
  type AuthUserRecord,
  memoryDb,
  toPublicAuthUser,
  writeDbAtomically,
} from '../db.ts';
import { appendAuditTrailLog } from './activityLogService.ts';
import { broadcastSnapshot, closeSseForSession, closeSseForUser } from '../sse.ts';

function issueSessionTokenBundle(
  user: AuthUserRecord,
  role: RbacRole,
  nowMs: number = Date.now()
): { bundle: AuthTokenBundle; session: AuthSessionRecord } {
  const sessionId = `ses-${crypto.randomUUID().slice(0, 12)}`;
  const policy = memoryDb.securityPolicy;
  const refreshTtlMs = Math.max(60_000, Math.round(policy.refreshTokenTtlMinutes * 60_000));
  const sessionExpiresAtMs = nowMs + refreshTtlMs;
  const accessTtlSeconds = Math.max(
    10,
    Math.min(
      Math.round(policy.accessTokenTtlMinutes * 60),
      Math.floor(refreshTtlMs / 1000)
    )
  );

  const { token: accessToken, expiresAtIso: accessTokenExpiresAt } =
    signAccessToken({
      userId: user.id,
      sessionId,
      ttlSeconds: accessTtlSeconds,
      nowMs,
    });

  const { rawToken: refreshToken, tokenHash } =
    generateRefreshTokenSecret(sessionId);

  const nowIso = new Date(nowMs).toISOString();
  const refreshTokenExpiresAt = new Date(sessionExpiresAtMs).toISOString();

  const session: AuthSessionRecord = {
    id: sessionId,
    userId: user.id,
    refreshTokenHash: tokenHash,
    issuedAt: nowIso,
    expiresAt: refreshTokenExpiresAt,
    refreshCount: 0,
    revoked: false,
  };

  // Prune stale sessions beyond 120 most recent entries
  memoryDb.authSessions = [session, ...memoryDb.authSessions].slice(0, 120);

  return {
    session,
    bundle: {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      sessionId,
      user: toPublicAuthUser(user),
      role,
      permissions: role.permissions,
    },
  };
}

export function getAuthStatus(): AuthStatusInfo {
  return {
    needsInitialSetup: memoryDb.authUsers.length === 0,
    hasEnvAdminPasscode: Boolean(getEnvAdminPasscode()),
  };
}

export function bootstrapFirstAdmin(params: {
  name: string;
  email: string;
  password: string;
  passcode?: string;
}): { ok: boolean; status?: number; error?: string; bundle?: AuthTokenBundle } {
  if (memoryDb.authUsers.length > 0) {
    return {
      ok: false,
      status: 409,
      error:
        'Akun admin utama sudah terdaftar. Gunakan form login dengan email & kata sandi Anda.',
    };
  }

  if (getEnvAdminPasscode() && !verifyEnvAdminPasscode(params.passcode ?? '')) {
    return {
      ok: false,
      status: 403,
      error: 'Passcode bootstrap admin (ADMIN_BOOTSTRAP_PASSCODE) tidak cocok.',
    };
  }

  const name = normalizePersonName(params.name ?? '');
  if (name.length < 2 || name.length > 80) {
    return { ok: false, status: 400, error: 'Nama lengkap wajib diisi (2–80 karakter).' };
  }

  const email = normalizeEmailAddress(params.email ?? '');
  if (!isValidEmailFormat(email)) {
    return { ok: false, status: 400, error: 'Format alamat email tidak valid.' };
  }

  const pwdCheck = validatePasswordStrength(params.password ?? '');
  if (!pwdCheck.valid) {
    return { ok: false, status: 400, error: pwdCheck.error };
  }

  const directorRole =
    memoryDb.rbacRoles.find((r) => r.id === SYSTEM_ADMIN_ROLE_ID) ??
    memoryDb.rbacRoles[0];
  if (!directorRole) {
    return { ok: false, status: 500, error: 'Role admin sistem tidak ditemukan.' };
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const { salt, hash } = hashPasswordScrypt(params.password);

  const newUser: AuthUserRecord = {
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    email,
    name,
    roleId: directorRole.id,
    passwordSalt: salt,
    passwordHash: hash,
    active: true,
    lastVisitedTab: 'dashboard',
    failedLoginCount: 0,
    lastLoginAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  memoryDb.authUsers = [newUser];
  const { bundle, session } = issueSessionTokenBundle(newUser, directorRole, nowMs);

  appendAuditTrailLog({
    actionType: 'auth_bootstrap',
    entityType: 'auth_session',
    entityId: session.id,
    referenceNumber: session.id.toUpperCase(),
    title: `Aktivasi admin pertama: ${newUser.email}`,
    departmentId: 'SECURITY',
    departmentName: 'Autentikasi & Sesi',
    requesterName: newUser.email,
    amount: 0,
    decision: 'info',
    actorName: newUser.name,
    actorRole: directorRole.name,
    note: 'Klaim kepemilikan Super Admin pertama & penerbitan refresh token.',
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);
  return { ok: true, bundle };
}

export function loginWithEmailPassword(params: {
  email: string;
  password: string;
}): { ok: boolean; status?: number; error?: string; bundle?: AuthTokenBundle } {
  const email = normalizeEmailAddress(params.email ?? '');
  const password = String(params.password ?? '');
  if (!email || !password) {
    return { ok: false, status: 400, error: 'Email dan kata sandi wajib diisi.' };
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const user = memoryDb.authUsers.find((u) => u.email === email);

  if (!user) {
    appendAuditTrailLog({
      actionType: 'auth_login_failed',
      entityType: 'auth_session',
      entityId: 'login-unknown',
      referenceNumber: 'AUTH-FAIL',
      title: `Percobaan login gagal untuk email ${email}`,
      departmentId: 'SECURITY',
      departmentName: 'Autentikasi & Sesi',
      requesterName: email,
      amount: 0,
      decision: 'warning',
      actorName: email,
      actorRole: 'Unauthenticated',
      note: 'Email tidak terdaftar pada sistem.',
      timestamp: nowIso,
    });
    writeDbAtomically(memoryDb);
    return { ok: false, status: 401, error: 'Email atau kata sandi salah.' };
  }

  if (!user.active) {
    appendAuditTrailLog({
      actionType: 'auth_login_failed',
      entityType: 'auth_session',
      entityId: user.id,
      referenceNumber: 'AUTH-INACTIVE',
      title: `Login ditolak: akun ${user.email} nonaktif`,
      departmentId: 'SECURITY',
      departmentName: 'Autentikasi & Sesi',
      requesterName: user.email,
      amount: 0,
      decision: 'warning',
      actorName: user.name,
      actorRole: 'Inactive',
      note: 'Akun berstatus nonaktif.',
      timestamp: nowIso,
    });
    writeDbAtomically(memoryDb);
    return {
      ok: false,
      status: 403,
      error: 'Akun Anda berstatus nonaktif. Hubungi Direktur/Admin RBAC.',
    };
  }

  if (user.lockedUntil) {
    const lockMs = new Date(user.lockedUntil).getTime();
    if (Number.isFinite(lockMs) && lockMs > nowMs) {
      const waitSeconds = Math.max(1, Math.ceil((lockMs - nowMs) / 1000));
      return {
        ok: false,
        status: 429,
        error: `Akun dikunci sementara karena percobaan gagal berulang. Coba lagi dalam ${waitSeconds} detik.`,
      };
    }
    user.lockedUntil = undefined;
  }

  const pwdValid = verifyPasswordScrypt(password, user.passwordSalt, user.passwordHash);
  if (!pwdValid) {
    const policy = memoryDb.securityPolicy;
    user.failedLoginCount = (user.failedLoginCount || 0) + 1;
    let cooldownMsg = 'Email atau kata sandi salah.';
    if (user.failedLoginCount >= policy.maxFailedLoginsBeforeCooldown) {
      user.lockedUntil = new Date(
        nowMs + policy.cooldownSeconds * 1000
      ).toISOString();
      user.failedLoginCount = 0;
      cooldownMsg = `Terlalu banyak percobaan sandi salah. Akun dikunci sementara selama ${policy.cooldownSeconds} detik.`;
    }
    const role = memoryDb.rbacRoles.find((r) => r.id === user.roleId);
    appendAuditTrailLog({
      actionType: 'auth_login_failed',
      entityType: 'auth_session',
      entityId: user.id,
      referenceNumber: 'AUTH-FAIL',
      title: `Login gagal (sandi salah): ${user.email}`,
      departmentId: 'SECURITY',
      departmentName: 'Autentikasi & Sesi',
      requesterName: user.email,
      amount: 0,
      decision: 'warning',
      actorName: user.name,
      actorRole: role?.name ?? user.roleId,
      note: user.lockedUntil
        ? `Cooldown akun diaktifkan selama ${policy.cooldownSeconds} detik.`
        : `Gagal percobaan ke-${user.failedLoginCount}.`,
      timestamp: nowIso,
    });
    writeDbAtomically(memoryDb);
    return {
      ok: false,
      status: user.lockedUntil ? 429 : 401,
      error: cooldownMsg,
    };
  }

  const role = memoryDb.rbacRoles.find((r) => r.id === user.roleId);
  if (!role) {
    return {
      ok: false,
      status: 403,
      error: 'Role akses akun tidak ditemukan.',
    };
  }

  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = nowIso;
  user.updatedAt = nowIso;

  const { bundle, session } = issueSessionTokenBundle(user, role, nowMs);

  appendAuditTrailLog({
    actionType: 'auth_login',
    entityType: 'auth_session',
    entityId: session.id,
    referenceNumber: session.id.toUpperCase(),
    title: `Login berhasil: ${user.name} (${role.name})`,
    departmentId: 'SECURITY',
    departmentName: 'Autentikasi & Sesi',
    requesterName: user.email,
    amount: 0,
    decision: 'info',
    actorName: user.name,
    actorRole: role.name,
    note: `Halaman terakhir tercatat: ${user.lastVisitedTab}. Masa berlaku sesi ${memoryDb.securityPolicy.refreshTokenTtlMinutes} menit.`,
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);
  broadcastSnapshot();
  return { ok: true, bundle };
}

export function refreshSessionTokens(rawRefreshToken: string): {
  ok: boolean;
  status?: number;
  code?: string;
  error?: string;
  bundle?: AuthTokenBundle;
} {
  const tokenStr = String(rawRefreshToken ?? '').trim();
  const sessionId = parseSessionIdFromRefreshToken(tokenStr);
  if (!sessionId) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_REFRESH_TOKEN',
      error: 'Format refresh token tidak valid.',
    };
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const session = memoryDb.authSessions.find((s) => s.id === sessionId);
  if (!session) {
    return {
      ok: false,
      status: 401,
      code: 'SESSION_EXPIRED',
      error: 'Sesi tidak ditemukan atau sudah berakhir.',
    };
  }

  const user = memoryDb.authUsers.find((u) => u.id === session.userId);
  const role = user
    ? memoryDb.rbacRoles.find((r) => r.id === user.roleId)
    : undefined;

  // Token reuse / revoked session check
  if (session.revoked) {
    for (const s of memoryDb.authSessions) {
      if (s.userId === session.userId && !s.revoked) {
        s.revoked = true;
        s.revokedReason = 'Deteksi penggunaan ulang refresh token (reuse protection)';
      }
    }
    appendAuditTrailLog({
      actionType: 'auth_session_expired',
      entityType: 'auth_session',
      entityId: session.id,
      referenceNumber: session.id.toUpperCase(),
      title: `Deteksi penggunaan ulang refresh token: ${user?.email ?? session.userId}`,
      departmentId: 'SECURITY',
      departmentName: 'Autentikasi & Sesi',
      requesterName: user?.email ?? '-',
      amount: 0,
      decision: 'warning',
      actorName: user?.name ?? 'Sistem',
      actorRole: role?.name ?? 'User',
      note: 'Seluruh sesi pengguna dicabut demi keamanan karena refresh token lama dipakai ulang.',
      timestamp: nowIso,
    });
    writeDbAtomically(memoryDb);
    closeSseForUser(session.userId, 'TOKEN_REUSE_DETECTED');
    return {
      ok: false,
      status: 401,
      code: 'SESSION_EXPIRED',
      error: 'Sesi dicabut karena terdeteksi penggunaan ulang refresh token. Silakan login kembali.',
    };
  }

  const providedHash = sha256Hex(tokenStr);
  if (providedHash !== session.refreshTokenHash) {
    session.revoked = true;
    session.revokedReason = 'Hash refresh token tidak cocok';
    appendAuditTrailLog({
      actionType: 'auth_session_expired',
      entityType: 'auth_session',
      entityId: session.id,
      referenceNumber: session.id.toUpperCase(),
      title: `Refresh token tidak cocok untuk ${user?.email ?? session.userId}`,
      departmentId: 'SECURITY',
      departmentName: 'Autentikasi & Sesi',
      requesterName: user?.email ?? '-',
      amount: 0,
      decision: 'warning',
      actorName: user?.name ?? 'Sistem',
      actorRole: role?.name ?? 'User',
      note: 'Token tidak sesuai dengan catatan rotasi aktif.',
      timestamp: nowIso,
    });
    writeDbAtomically(memoryDb);
    closeSseForSession(session.id, 'SESSION_REVOKED');
    return {
      ok: false,
      status: 401,
      code: 'SESSION_EXPIRED',
      error: 'Refresh token sudah tidak berlaku. Silakan login kembali.',
    };
  }

  const sessionExpiresAtMs = new Date(session.expiresAt).getTime();
  if (!Number.isFinite(sessionExpiresAtMs) || sessionExpiresAtMs <= nowMs) {
    session.revoked = true;
    session.revokedReason = 'Sesi habis (refresh TTL terlampaui)';
    appendAuditTrailLog({
      actionType: 'auth_session_expired',
      entityType: 'auth_session',
      entityId: session.id,
      referenceNumber: session.id.toUpperCase(),
      title: `Sesi habis otomatis untuk ${user?.email ?? session.userId}`,
      departmentId: 'SECURITY',
      departmentName: 'Autentikasi & Sesi',
      requesterName: user?.email ?? '-',
      amount: 0,
      decision: 'warning',
      actorName: user?.name ?? 'Sistem',
      actorRole: role?.name ?? 'User',
      note: 'Refresh token sudah melewati batas waktu sesi; pengguna di-logout otomatis.',
      timestamp: nowIso,
    });
    writeDbAtomically(memoryDb);
    closeSseForSession(session.id, 'SESSION_EXPIRED');
    return {
      ok: false,
      status: 401,
      code: 'SESSION_EXPIRED',
      error: 'Masa berlaku sesi Anda telah habis. Silakan login kembali.',
    };
  }

  if (!user || !user.active || !role) {
    session.revoked = true;
    session.revokedReason = 'Akun nonaktif atau role dihapus';
    writeDbAtomically(memoryDb);
    closeSseForSession(session.id, 'USER_INACTIVE');
    return {
      ok: false,
      status: 401,
      code: 'SESSION_EXPIRED',
      error: 'Akun atau role Anda sudah tidak aktif.',
    };
  }

  // Rotate refresh token & mint new access token bounded by remaining session window
  const policy = memoryDb.securityPolicy;
  const remainingSessionSeconds = Math.max(
    1,
    Math.floor((sessionExpiresAtMs - nowMs) / 1000)
  );
  const accessTtlSeconds = Math.max(
    5,
    Math.min(Math.round(policy.accessTokenTtlMinutes * 60), remainingSessionSeconds)
  );

  const { token: accessToken, expiresAtIso: accessTokenExpiresAt } =
    signAccessToken({
      userId: user.id,
      sessionId: session.id,
      ttlSeconds: accessTtlSeconds,
      nowMs,
    });
  const { rawToken: nextRefreshToken, tokenHash: nextRefreshHash } =
    generateRefreshTokenSecret(session.id);

  session.refreshTokenHash = nextRefreshHash;
  session.lastRefreshedAt = nowIso;
  session.refreshCount += 1;

  appendAuditTrailLog({
    actionType: 'auth_token_refreshed',
    entityType: 'auth_session',
    entityId: session.id,
    referenceNumber: session.id.toUpperCase(),
    title: `Rotasi Refresh Token #${session.refreshCount} (${user.email})`,
    departmentId: 'SECURITY',
    departmentName: 'Autentikasi & Sesi',
    requesterName: user.email,
    amount: 0,
    decision: 'info',
    actorName: user.name,
    actorRole: role.name,
    note: `Access token baru diterbitkan sampai ${accessTokenExpiresAt}.`,
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);
  broadcastSnapshot();

  return {
    ok: true,
    bundle: {
      accessToken,
      refreshToken: nextRefreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt: session.expiresAt,
      sessionId: session.id,
      user: toPublicAuthUser(user),
      role,
      permissions: role.permissions,
    },
  };
}

export function logoutSession(params: {
  user: AuthUserRecord;
  role: RbacRole;
  session: AuthSessionRecord;
  reason?: string;
}): void {
  const nowIso = new Date().toISOString();
  const isExpiryLogout = params.reason === 'expired';
  params.session.revoked = true;
  params.session.revokedReason = isExpiryLogout
    ? 'Logout otomatis (sesi habis)'
    : 'Logout manual oleh pengguna';

  appendAuditTrailLog({
    actionType: isExpiryLogout ? 'auth_session_expired' : 'auth_logout',
    entityType: 'auth_session',
    entityId: params.session.id,
    referenceNumber: params.session.id.toUpperCase(),
    title: isExpiryLogout
      ? `Auto-logout karena sesi habis: ${params.user.email}`
      : `Logout pengguna: ${params.user.name}`,
    departmentId: 'SECURITY',
    departmentName: 'Autentikasi & Sesi',
    requesterName: params.user.email,
    amount: 0,
    decision: isExpiryLogout ? 'warning' : 'info',
    actorName: params.user.name,
    actorRole: params.role.name,
    note: params.session.revokedReason,
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);
  closeSseForSession(params.session.id, isExpiryLogout ? 'SESSION_EXPIRED' : 'LOGOUT');
  broadcastSnapshot();
}

export function updateUserLastTab(params: {
  user: AuthUserRecord;
  role: RbacRole;
  tab: string;
}): { ok: boolean; error?: string; user?: AuthUserPublic } {
  const tab = String(params.tab ?? '').trim() as NavTab;
  if (!VALID_NAV_TABS.has(tab)) {
    return { ok: false, error: 'Halaman tujuan tidak dikenali.' };
  }
  if (!canAccessTab(params.role.permissions, tab)) {
    return {
      ok: false,
      error: 'Role Anda tidak memiliki akses ke halaman tersebut.',
    };
  }
  if (params.user.lastVisitedTab !== tab) {
    params.user.lastVisitedTab = tab;
    params.user.updatedAt = new Date().toISOString();
    writeDbAtomically(memoryDb);
  }
  return { ok: true, user: toPublicAuthUser(params.user) };
}

export function createRbacRole(params: {
  actorName: string;
  actorRoleName: string;
  name: string;
  description: string;
  permissions: unknown;
}): { ok: boolean; error?: string; role?: RbacRole } {
  const check = validateRolePayload({
    name: params.name,
    description: params.description,
    permissions: params.permissions,
    isSystemRole: false,
  });
  if (!check.valid || !check.normalized) {
    return { ok: false, error: check.error };
  }

  const slug = sanitizeRoleSlug(check.normalized.name) || 'custom-role';
  const duplicateName = memoryDb.rbacRoles.some(
    (r) => r.name.toLowerCase() === check.normalized!.name.toLowerCase()
  );
  if (duplicateName) {
    return { ok: false, error: 'Nama role sudah digunakan.' };
  }

  const nowIso = new Date().toISOString();
  const newRole: RbacRole = {
    id: `role-${slug}-${crypto.randomUUID().slice(0, 4)}`,
    name: check.normalized.name,
    slug,
    description: check.normalized.description,
    permissions: check.normalized.permissions,
    isSystem: false,
    updatedAt: nowIso,
  };

  memoryDb.rbacRoles = [...memoryDb.rbacRoles, newRole];
  appendAuditTrailLog({
    actionType: 'rbac_role_created',
    entityType: 'rbac_policy',
    entityId: newRole.id,
    referenceNumber: newRole.id.toUpperCase(),
    title: `Role RBAC baru dibuat: ${newRole.name}`,
    departmentId: 'RBAC',
    departmentName: 'Role, Permission & Aksi',
    requesterName: newRole.name,
    amount: newRole.permissions.length,
    decision: 'info',
    actorName: params.actorName,
    actorRole: params.actorRoleName,
    note: `${newRole.permissions.length} permission aktif diberikan.`,
    timestamp: nowIso,
  });
  writeDbAtomically(memoryDb);
  return { ok: true, role: newRole };
}

export function updateRbacRole(params: {
  actorName: string;
  actorRoleName: string;
  roleId: string;
  name: string;
  description: string;
  permissions: unknown;
}): { ok: boolean; error?: string; role?: RbacRole } {
  const existing = memoryDb.rbacRoles.find((r) => r.id === params.roleId);
  if (!existing) {
    return { ok: false, error: 'Role tidak ditemukan.' };
  }

  const check = validateRolePayload({
    name: params.name,
    description: params.description,
    permissions: params.permissions,
    isSystemRole: existing.isSystem,
  });
  if (!check.valid || !check.normalized) {
    return { ok: false, error: check.error };
  }

  const duplicateName = memoryDb.rbacRoles.some(
    (r) =>
      r.id !== existing.id &&
      r.name.toLowerCase() === check.normalized!.name.toLowerCase()
  );
  if (duplicateName) {
    return { ok: false, error: 'Nama role sudah digunakan role lain.' };
  }

  const nowIso = new Date().toISOString();
  const updated: RbacRole = {
    ...existing,
    name: check.normalized.name,
    description: check.normalized.description,
    permissions: check.normalized.permissions,
    updatedAt: nowIso,
  };

  memoryDb.rbacRoles = memoryDb.rbacRoles.map((r) =>
    r.id === existing.id ? updated : r
  );

  appendAuditTrailLog({
    actionType: 'rbac_role_updated',
    entityType: 'rbac_policy',
    entityId: updated.id,
    referenceNumber: updated.id.toUpperCase(),
    title: `Matriks permission role diperbarui: ${updated.name}`,
    departmentId: 'RBAC',
    departmentName: 'Role, Permission & Aksi',
    requesterName: updated.name,
    amount: updated.permissions.length,
    decision: 'info',
    actorName: params.actorName,
    actorRole: params.actorRoleName,
    note: `${updated.permissions.length} permission aktif.`,
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);
  return { ok: true, role: updated };
}

export function deleteRbacRole(params: {
  actorName: string;
  actorRoleName: string;
  roleId: string;
}): { ok: boolean; error?: string } {
  const existing = memoryDb.rbacRoles.find((r) => r.id === params.roleId);
  if (!existing) {
    return { ok: false, error: 'Role tidak ditemukan.' };
  }
  if (existing.isSystem) {
    return {
      ok: false,
      error: 'Role sistem utama (Direktur / Super Admin) tidak dapat dihapus.',
    };
  }
  const inUse = memoryDb.authUsers.some((u) => u.roleId === existing.id);
  if (inUse) {
    return {
      ok: false,
      error: `Role "${existing.name}" masih digunakan oleh akun pengguna aktif/terdaftar. Pindahkan pengguna ke role lain terlebih dahulu.`,
    };
  }

  const nowIso = new Date().toISOString();
  memoryDb.rbacRoles = memoryDb.rbacRoles.filter((r) => r.id !== existing.id);

  appendAuditTrailLog({
    actionType: 'rbac_role_deleted',
    entityType: 'rbac_policy',
    entityId: existing.id,
    referenceNumber: existing.id.toUpperCase(),
    title: `Role RBAC dihapus: ${existing.name}`,
    departmentId: 'RBAC',
    departmentName: 'Role, Permission & Aksi',
    requesterName: existing.name,
    amount: 0,
    decision: 'warning',
    actorName: params.actorName,
    actorRole: params.actorRoleName,
    note: `Role ${existing.name} (${existing.id}) dihapus dari daftar RBAC.`,
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);
  return { ok: true };
}

export function createUserAccount(params: {
  actorName: string;
  actorRoleName: string;
  name: string;
  email: string;
  password: string;
  roleId: string;
}): { ok: boolean; error?: string; user?: AuthUserPublic } {
  const name = normalizePersonName(params.name ?? '');
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'Nama pengguna wajib diisi (2–80 karakter).' };
  }
  const email = normalizeEmailAddress(params.email ?? '');
  if (!isValidEmailFormat(email)) {
    return { ok: false, error: 'Format email pengguna tidak valid.' };
  }
  if (memoryDb.authUsers.some((u) => u.email === email)) {
    return { ok: false, error: `Email ${email} sudah terdaftar.` };
  }

  const pwdCheck = validatePasswordStrength(params.password ?? '');
  if (!pwdCheck.valid) {
    return { ok: false, error: pwdCheck.error };
  }

  const role = memoryDb.rbacRoles.find((r) => r.id === params.roleId);
  if (!role) {
    return { ok: false, error: 'Role tujuan tidak ditemukan.' };
  }

  const nowIso = new Date().toISOString();
  const { salt, hash } = hashPasswordScrypt(params.password);
  const newUser: AuthUserRecord = {
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    email,
    name,
    roleId: role.id,
    passwordSalt: salt,
    passwordHash: hash,
    active: true,
    lastVisitedTab: 'dashboard',
    failedLoginCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  memoryDb.authUsers = [...memoryDb.authUsers, newUser];
  appendAuditTrailLog({
    actionType: 'rbac_user_created',
    entityType: 'user_account',
    entityId: newUser.id,
    referenceNumber: newUser.id.toUpperCase(),
    title: `Akun pengguna baru: ${newUser.name} (${role.name})`,
    departmentId: 'RBAC',
    departmentName: 'Role, Permission & Aksi',
    requesterName: newUser.email,
    amount: 0,
    decision: 'info',
    actorName: params.actorName,
    actorRole: params.actorRoleName,
    note: `Diberi role ${role.name} (${role.permissions.length} izin).`,
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);
  return { ok: true, user: toPublicAuthUser(newUser) };
}

export function updateUserAccount(params: {
  actorUserId: string;
  actorName: string;
  actorRoleName: string;
  targetUserId: string;
  name?: string;
  roleId?: string;
  active?: boolean;
  newPassword?: string;
}): { ok: boolean; error?: string; user?: AuthUserPublic } {
  const user = memoryDb.authUsers.find((u) => u.id === params.targetUserId);
  if (!user) {
    return { ok: false, error: 'Akun pengguna tidak ditemukan.' };
  }

  const nextRoleId = params.roleId ?? user.roleId;
  const nextRole = memoryDb.rbacRoles.find((r) => r.id === nextRoleId);
  if (!nextRole) {
    return { ok: false, error: 'Role tujuan tidak ditemukan.' };
  }

  const nextActive =
    typeof params.active === 'boolean' ? params.active : user.active;

  // Guard: never deactivate or demote the last active Super Admin user
  const wasSystemAdmin = user.roleId === SYSTEM_ADMIN_ROLE_ID && user.active;
  const willLoseSystemAdmin =
    nextRoleId !== SYSTEM_ADMIN_ROLE_ID || !nextActive;
  if (wasSystemAdmin && willLoseSystemAdmin) {
    const otherActiveAdmins = memoryDb.authUsers.filter(
      (u) =>
        u.id !== user.id &&
        u.active &&
        u.roleId === SYSTEM_ADMIN_ROLE_ID
    );
    if (otherActiveAdmins.length === 0) {
      return {
        ok: false,
        error:
          'Tidak dapat menonaktifkan atau mengubah role Direktur Super Admin terakhir agar sistem tidak terkunci.',
      };
    }
  }

  if (params.name !== undefined) {
    const cleanName = normalizePersonName(params.name);
    if (cleanName.length < 2 || cleanName.length > 80) {
      return { ok: false, error: 'Nama pengguna harus 2–80 karakter.' };
    }
    user.name = cleanName;
  }

  if (params.newPassword && params.newPassword.trim().length > 0) {
    const pwdCheck = validatePasswordStrength(params.newPassword);
    if (!pwdCheck.valid) {
      return { ok: false, error: pwdCheck.error };
    }
    const { salt, hash } = hashPasswordScrypt(params.newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
  }

  const roleChanged = user.roleId !== nextRoleId;
  const deactivated = user.active && !nextActive;
  user.roleId = nextRoleId;
  user.active = nextActive;
  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  user.updatedAt = new Date().toISOString();

  if (deactivated || params.newPassword) {
    for (const s of memoryDb.authSessions) {
      if (s.userId === user.id && !s.revoked) {
        s.revoked = true;
        s.revokedReason = deactivated
          ? 'Akun dinonaktifkan oleh admin'
          : 'Kata sandi direset oleh admin';
      }
    }
    closeSseForUser(user.id, deactivated ? 'USER_INACTIVE' : 'PASSWORD_RESET');
  }

  appendAuditTrailLog({
    actionType: 'rbac_user_updated',
    entityType: 'user_account',
    entityId: user.id,
    referenceNumber: user.id.toUpperCase(),
    title: `Pembaruan akun ${user.name} (${nextRole.name})`,
    departmentId: 'RBAC',
    departmentName: 'Role, Permission & Aksi',
    requesterName: user.email,
    amount: 0,
    decision: deactivated ? 'warning' : 'info',
    actorName: params.actorName,
    actorRole: params.actorRoleName,
    note: [
      roleChanged ? `Role -> ${nextRole.name}` : null,
      deactivated ? 'Status -> Nonaktif & sesi dicabut' : null,
      !deactivated && params.active === true ? 'Status -> Aktif' : null,
      params.newPassword ? 'Kata sandi direset' : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Profil pengguna diperbarui.',
    timestamp: user.updatedAt,
  });

  writeDbAtomically(memoryDb);
  return { ok: true, user: toPublicAuthUser(user) };
}

export function revokeSessionById(params: {
  actorName: string;
  actorRoleName: string;
  sessionId: string;
}): { ok: boolean; error?: string } {
  const session = memoryDb.authSessions.find((s) => s.id === params.sessionId);
  if (!session) {
    return { ok: false, error: 'Sesi tidak ditemukan.' };
  }
  if (session.revoked) {
    return { ok: false, error: 'Sesi sudah berstatus dicabut.' };
  }

  const nowIso = new Date().toISOString();
  const targetUser = memoryDb.authUsers.find((u) => u.id === session.userId);
  session.revoked = true;
  session.revokedReason = `Dicabut paksa oleh ${params.actorName}`;

  appendAuditTrailLog({
    actionType: 'rbac_session_revoked',
    entityType: 'auth_session',
    entityId: session.id,
    referenceNumber: session.id.toUpperCase(),
    title: `Pencabutan paksa sesi ${targetUser?.email ?? session.userId}`,
    departmentId: 'SECURITY',
    departmentName: 'Autentikasi & Sesi',
    requesterName: targetUser?.email ?? '-',
    amount: 0,
    decision: 'warning',
    actorName: params.actorName,
    actorRole: params.actorRoleName,
    note: `Refresh token & sesi aktif dihentikan oleh admin.`,
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);
  closeSseForSession(session.id, 'SESSION_REVOKED');
  return { ok: true };
}

export function updateSecurityPolicy(params: {
  actorName: string;
  actorRoleName: string;
  accessTokenTtlMinutes?: number;
  refreshTokenTtlMinutes?: number;
  authRateLimitMaxPerMinute?: number;
  apiRateLimitMaxPerMinute?: number;
  maxFailedLoginsBeforeCooldown?: number;
  cooldownSeconds?: number;
}): { ok: boolean; error?: string; securityPolicy?: AuthSecurityPolicy } {
  const current = memoryDb.securityPolicy;
  const accessTokenTtlMinutes =
    params.accessTokenTtlMinutes ?? current.accessTokenTtlMinutes;
  const refreshTokenTtlMinutes =
    params.refreshTokenTtlMinutes ?? current.refreshTokenTtlMinutes;
  const authRateLimitMaxPerMinute =
    params.authRateLimitMaxPerMinute ?? current.authRateLimitMaxPerMinute;
  const apiRateLimitMaxPerMinute =
    params.apiRateLimitMaxPerMinute ?? current.apiRateLimitMaxPerMinute;
  const maxFailedLoginsBeforeCooldown =
    params.maxFailedLoginsBeforeCooldown ?? current.maxFailedLoginsBeforeCooldown;
  const cooldownSeconds = params.cooldownSeconds ?? current.cooldownSeconds;

  if (
    !Number.isFinite(accessTokenTtlMinutes) ||
    accessTokenTtlMinutes < 0.25 ||
    accessTokenTtlMinutes > 120
  ) {
    return {
      ok: false,
      error: 'TTL Access Token harus di antara 0,25 menit (15 detik) hingga 120 menit.',
    };
  }
  if (
    !Number.isFinite(refreshTokenTtlMinutes) ||
    refreshTokenTtlMinutes < 1 ||
    refreshTokenTtlMinutes > 43200
  ) {
    return {
      ok: false,
      error: 'TTL Refresh Token / Sesi harus di antara 1 hingga 43.200 menit (30 hari).',
    };
  }
  if (refreshTokenTtlMinutes < accessTokenTtlMinutes) {
    return {
      ok: false,
      error: 'TTL Refresh Token tidak boleh lebih pendek dari TTL Access Token.',
    };
  }
  if (
    !Number.isInteger(authRateLimitMaxPerMinute) ||
    authRateLimitMaxPerMinute < 3 ||
    authRateLimitMaxPerMinute > 120
  ) {
    return {
      ok: false,
      error: 'Rate limit endpoint Auth harus bilangan bulat 3–120 req/menit.',
    };
  }
  if (
    !Number.isInteger(apiRateLimitMaxPerMinute) ||
    apiRateLimitMaxPerMinute < 30 ||
    apiRateLimitMaxPerMinute > 2000
  ) {
    return {
      ok: false,
      error: 'Rate limit endpoint API umum harus bilangan bulat 30–2000 req/menit.',
    };
  }
  if (
    !Number.isInteger(maxFailedLoginsBeforeCooldown) ||
    maxFailedLoginsBeforeCooldown < 2 ||
    maxFailedLoginsBeforeCooldown > 20
  ) {
    return {
      ok: false,
      error: 'Batas gagal login sebelum cooldown harus 2–20 kali.',
    };
  }
  if (
    !Number.isInteger(cooldownSeconds) ||
    cooldownSeconds < 15 ||
    cooldownSeconds > 3600
  ) {
    return {
      ok: false,
      error: 'Durasi cooldown akun harus 15–3600 detik.',
    };
  }

  const nowIso = new Date().toISOString();
  const updated: AuthSecurityPolicy = {
    accessTokenTtlMinutes: Math.round(accessTokenTtlMinutes * 100) / 100,
    refreshTokenTtlMinutes: Math.round(refreshTokenTtlMinutes * 100) / 100,
    authRateLimitMaxPerMinute,
    apiRateLimitMaxPerMinute,
    maxFailedLoginsBeforeCooldown,
    cooldownSeconds,
    updatedAt: nowIso,
  };

  memoryDb.securityPolicy = updated;
  appendAuditTrailLog({
    actionType: 'security_policy_updated',
    entityType: 'rbac_policy',
    entityId: 'security-policy',
    referenceNumber: 'SEC-POLICY',
    title: 'Kebijakan Keamanan, TTL Token & Rate Limiter diperbarui',
    departmentId: 'SECURITY',
    departmentName: 'Autentikasi & Sesi',
    requesterName: 'Security Policy',
    amount: 0,
    decision: 'info',
    actorName: params.actorName,
    actorRole: params.actorRoleName,
    note: `Access ${updated.accessTokenTtlMinutes}m · Refresh ${updated.refreshTokenTtlMinutes}m · AuthLimit ${updated.authRateLimitMaxPerMinute}/m · ApiLimit ${updated.apiRateLimitMaxPerMinute}/m.`,
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);
  return { ok: true, securityPolicy: updated };
}

export { SYSTEM_ADMIN_LOCKED_PERMISSIONS };
