import type { NextFunction, Request, Response } from 'express';
import type { PermissionKey, RbacRole } from '../../src/types/pettycash.ts';
import { hasPermission } from '../../src/utils/pettycashLogic.ts';
import { verifyAccessToken } from '../authCrypto.ts';
import {
  type AuthSessionRecord,
  type AuthUserRecord,
  memoryDb,
  writeDbAtomically,
} from '../db.ts';
import { appendAuditTrailLog } from '../services/activityLogService.ts';
import { closeSseForSession } from '../sse.ts';

export interface AuthenticatedContext {
  user: AuthUserRecord;
  role: RbacRole;
  permissions: PermissionKey[];
  session: AuthSessionRecord;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedContext;
    }
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Autentikasi diperlukan. Silakan login terlebih dahulu.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const nowMs = Date.now();
  const verified = verifyAccessToken(token, nowMs);
  if (!verified.valid || !verified.payload) {
    if (verified.expired && verified.payload) {
      const expiredSession = memoryDb.authSessions.find(
        (s) => s.id === verified.payload?.sid
      );
      if (
        expiredSession &&
        !expiredSession.revoked &&
        new Date(expiredSession.expiresAt).getTime() <= nowMs
      ) {
        const user = memoryDb.authUsers.find(
          (u) => u.id === expiredSession.userId
        );
        const role = user
          ? memoryDb.rbacRoles.find((r) => r.id === user.roleId)
          : undefined;
        expiredSession.revoked = true;
        expiredSession.revokedReason = 'Sesi refresh kedaluwarsa otomatis';
        appendAuditTrailLog({
          actionType: 'auth_session_expired',
          entityType: 'auth_session',
          entityId: expiredSession.id,
          referenceNumber: expiredSession.id.toUpperCase(),
          title: `Sesi berakhir otomatis untuk ${user?.email ?? expiredSession.userId}`,
          departmentId: 'SECURITY',
          departmentName: 'Autentikasi & Sesi',
          requesterName: user?.email ?? '-',
          amount: 0,
          decision: 'warning',
          actorName: user?.name ?? 'Sistem',
          actorRole: role?.name ?? 'User',
          note: 'Masa berlaku sesi & refresh token telah habis.',
          timestamp: new Date(nowMs).toISOString(),
        });
        writeDbAtomically(memoryDb);
        closeSseForSession(expiredSession.id, 'SESSION_EXPIRED');
        res.status(401).json({
          error: 'Sesi Anda telah habis. Anda telah logout otomatis.',
          code: 'SESSION_EXPIRED',
        });
        return;
      }

      res.status(401).json({
        error: 'Token akses telah kedaluwarsa. Memperbarui token...',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    res.status(401).json({
      error: 'Token autentikasi tidak valid.',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  const session = memoryDb.authSessions.find(
    (s) => s.id === verified.payload!.sid
  );
  if (!session || session.revoked) {
    res.status(401).json({
      error: 'Sesi sudah dicabut atau logout. Silakan login kembali.',
      code: 'SESSION_REVOKED',
    });
    return;
  }

  if (new Date(session.expiresAt).getTime() <= nowMs) {
    const user = memoryDb.authUsers.find((u) => u.id === session.userId);
    const role = user
      ? memoryDb.rbacRoles.find((r) => r.id === user.roleId)
      : undefined;
    session.revoked = true;
    session.revokedReason = 'Masa berlaku sesi habis';
    appendAuditTrailLog({
      actionType: 'auth_session_expired',
      entityType: 'auth_session',
      entityId: session.id,
      referenceNumber: session.id.toUpperCase(),
      title: `Sesi kedaluwarsa otomatis (${user?.email ?? session.userId})`,
      departmentId: 'SECURITY',
      departmentName: 'Autentikasi & Sesi',
      requesterName: user?.email ?? '-',
      amount: 0,
      decision: 'warning',
      actorName: user?.name ?? 'Sistem',
      actorRole: role?.name ?? 'User',
      note: 'Refresh session TTL terlampaui; sesi ditutup otomatis.',
      timestamp: new Date(nowMs).toISOString(),
    });
    writeDbAtomically(memoryDb);
    closeSseForSession(session.id, 'SESSION_EXPIRED');
    res.status(401).json({
      error: 'Sesi Anda telah habis. Silakan login kembali.',
      code: 'SESSION_EXPIRED',
    });
    return;
  }

  const user = memoryDb.authUsers.find(
    (u) => u.id === verified.payload!.sub && u.active
  );
  if (!user) {
    res.status(401).json({
      error: 'Akun pengguna tidak ditemukan atau berstatus nonaktif.',
      code: 'USER_INACTIVE',
    });
    return;
  }

  const role = memoryDb.rbacRoles.find((r) => r.id === user.roleId);
  if (!role) {
    res.status(403).json({
      error: 'Role akses pengguna tidak ditemukan pada sistem RBAC.',
      code: 'ROLE_NOT_FOUND',
    });
    return;
  }

  req.auth = {
    user,
    role,
    permissions: role.permissions,
    session,
  };
  next();
}

export function requirePermission(
  required: PermissionKey | PermissionKey[]
) {
  const requiredList = Array.isArray(required) ? required : [required];
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        error: 'Autentikasi diperlukan.',
        code: 'UNAUTHORIZED',
      });
      return;
    }
    const allowed = requiredList.some((perm) =>
      hasPermission(req.auth!.permissions, perm)
    );
    if (!allowed) {
      res.status(403).json({
        error: `Akses ditolak (RBAC): Role "${req.auth.role.name}" tidak memiliki izin untuk aksi atau menu ini.`,
        code: 'FORBIDDEN',
        requiredPermissions: requiredList,
      });
      return;
    }
    next();
  };
}
