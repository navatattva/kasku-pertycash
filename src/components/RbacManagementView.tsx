import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  AuthSecurityPolicy,
  AuthSessionPublic,
  AuthUserPublic,
  PermissionKey,
  RbacRole,
} from '../types/pettycash.ts';
import {
  ALL_PERMISSION_KEYS,
  hasPermission,
  PERMISSION_GROUPS,
  SYSTEM_ADMIN_LOCKED_PERMISSIONS,
} from '../utils/pettycashLogic.ts';
import type { ActionResult } from '../hooks/usePettyCashStore.ts';
import type {
  CreateRbacRolePayload,
  CreateUserAccountPayload,
  UpdateRbacRolePayload,
  UpdateSecurityPolicyPayload,
  UpdateUserAccountPayload,
} from '../api/pettycashApi.ts';
import { formatDateTime } from '../utils/formatters.ts';

interface RbacManagementViewProps {
  currentUserId: string;
  userPermissions: readonly PermissionKey[];
  roles: RbacRole[];
  users: AuthUserPublic[];
  sessions: AuthSessionPublic[];
  securityPolicy?: AuthSecurityPolicy;
  remainingAccessSeconds: number;
  remainingSessionSeconds: number;
  onRefreshTokenNow: () => Promise<{ ok: boolean; error?: string }>;
  onCreateRole: (payload: CreateRbacRolePayload) => Promise<ActionResult>;
  onUpdateRole: (payload: UpdateRbacRolePayload) => Promise<ActionResult>;
  onDeleteRole: (roleId: string, roleName: string) => Promise<ActionResult>;
  onCreateUser: (payload: CreateUserAccountPayload) => Promise<ActionResult>;
  onUpdateUser: (payload: UpdateUserAccountPayload) => Promise<ActionResult>;
  onRevokeSession: (sessionId: string) => Promise<ActionResult>;
  onUpdateSecurityPolicy: (
    payload: UpdateSecurityPolicyPayload
  ) => Promise<ActionResult>;
}

type RbacSubTab = 'roles' | 'users' | 'security';

export function RbacManagementView({
  currentUserId,
  userPermissions,
  roles,
  users,
  sessions,
  securityPolicy,
  remainingAccessSeconds,
  remainingSessionSeconds,
  onRefreshTokenNow,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onCreateUser,
  onUpdateUser,
  onRevokeSession,
  onUpdateSecurityPolicy,
}: RbacManagementViewProps) {
  const [subTab, setSubTab] = useState<RbacSubTab>('roles');
  const [errorBanner, setErrorBanner] = useState('');

  const canManageRoles = hasPermission(userPermissions, 'rbac:manage_roles');
  const canManageUsers = hasPermission(userPermissions, 'rbac:manage_users');

  // Role editor state
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    roles[0]?.id ?? 'new'
  );
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePerms, setRolePerms] = useState<PermissionKey[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  useEffect(() => {
    if (selectedRoleId === 'new') return;
    const found = roles.find((r) => r.id === selectedRoleId) ?? roles[0];
    if (found) {
      setSelectedRoleId(found.id);
      setRoleName(found.name);
      setRoleDesc(found.description);
      setRolePerms([...found.permissions]);
    }
  }, [selectedRoleId, roles]);

  const startCreateNewRole = () => {
    setErrorBanner('');
    setSelectedRoleId('new');
    setRoleName('');
    setRoleDesc('');
    setRolePerms(['dashboard:view', 'wiki:view']);
  };

  const togglePermission = (key: PermissionKey) => {
    if (!canManageRoles) return;
    if (
      selectedRole?.isSystem &&
      SYSTEM_ADMIN_LOCKED_PERMISSIONS.includes(key)
    ) {
      return;
    }
    setRolePerms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleGroupPermissions = (keys: PermissionKey[]) => {
    if (!canManageRoles) return;
    const allSelected = keys.every((k) => rolePerms.includes(k));
    if (allSelected) {
      setRolePerms((prev) =>
        prev.filter(
          (k) =>
            !keys.includes(k) ||
            (Boolean(selectedRole?.isSystem) &&
              SYSTEM_ADMIN_LOCKED_PERMISSIONS.includes(k))
        )
      );
    } else {
      setRolePerms((prev) => {
        const next = new Set(prev);
        for (const k of keys) next.add(k);
        return Array.from(next);
      });
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner('');
    setSavingRole(true);
    const res =
      selectedRoleId === 'new'
        ? await onCreateRole({
            name: roleName,
            description: roleDesc,
            permissions: rolePerms,
          })
        : await onUpdateRole({
            roleId: selectedRoleId,
            name: roleName,
            description: roleDesc,
            permissions: rolePerms,
          });
    setSavingRole(false);
    if (!res.ok) {
      setErrorBanner(res.error || 'Gagal menyimpan role.');
    }
  };

  const handleDeleteRole = async (role: RbacRole) => {
    setErrorBanner('');
    const res = await onDeleteRole(role.id, role.name);
    if (!res.ok) {
      setErrorBanner(res.error || 'Gagal menghapus role.');
    } else if (roles[0]) {
      setSelectedRoleId(roles[0].id);
    }
  };

  // New user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState(
    roles.find((r) => !r.isSystem)?.id ?? roles[0]?.id ?? 'role-staff'
  );
  const [creatingUser, setCreatingUser] = useState(false);

  // Security policy state
  const [accessTtl, setAccessTtl] = useState(
    securityPolicy?.accessTokenTtlMinutes ?? 15
  );
  const [refreshTtl, setRefreshTtl] = useState(
    securityPolicy?.refreshTokenTtlMinutes ?? 480
  );
  const [authLimit, setAuthLimit] = useState(
    securityPolicy?.authRateLimitMaxPerMinute ?? 15
  );
  const [apiLimit, setApiLimit] = useState(
    securityPolicy?.apiRateLimitMaxPerMinute ?? 180
  );
  const [maxFailLogin, setMaxFailLogin] = useState(
    securityPolicy?.maxFailedLoginsBeforeCooldown ?? 5
  );
  const [cooldownSec, setCooldownSec] = useState(
    securityPolicy?.cooldownSeconds ?? 120
  );
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => {
    if (!securityPolicy) return;
    setAccessTtl(securityPolicy.accessTokenTtlMinutes);
    setRefreshTtl(securityPolicy.refreshTokenTtlMinutes);
    setAuthLimit(securityPolicy.authRateLimitMaxPerMinute);
    setApiLimit(securityPolicy.apiRateLimitMaxPerMinute);
    setMaxFailLogin(securityPolicy.maxFailedLoginsBeforeCooldown);
    setCooldownSec(securityPolicy.cooldownSeconds);
  }, [securityPolicy]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner('');
    setCreatingUser(true);
    const res = await onCreateUser({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      roleId: newUserRoleId,
    });
    setCreatingUser(false);
    if (!res.ok) {
      setErrorBanner(res.error || 'Gagal menambah akun.');
    } else {
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner('');
    setSavingPolicy(true);
    const res = await onUpdateSecurityPolicy({
      accessTokenTtlMinutes: Number(accessTtl),
      refreshTokenTtlMinutes: Number(refreshTtl),
      authRateLimitMaxPerMinute: Number(authLimit),
      apiRateLimitMaxPerMinute: Number(apiLimit),
      maxFailedLoginsBeforeCooldown: Number(maxFailLogin),
      cooldownSeconds: Number(cooldownSec),
    });
    setSavingPolicy(false);
    if (!res.ok) {
      setErrorBanner(res.error || 'Gagal menyimpan kebijakan keamanan.');
    }
  };

  const activeSessionsCount = sessions.filter((s) => !s.revoked).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
              <Shield className="h-4 w-4" />
              <span>Manajemen Akses & Keamanan Aplikasi</span>
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Role, Permission (Menu & Aksi), Akun & Rate Limiter
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl">
              Atur hak akses tiap role secara dinamis per menu dan tombol aksi, pantau sesi refresh token aktif, serta kendalikan kebijakan batas permintaan (rate limit).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <p className="text-[11px] text-slate-500">Sisa Access / Sesi</p>
              <p className="font-mono font-semibold text-slate-800">
                {remainingAccessSeconds}d / {Math.ceil(remainingSessionSeconds / 60)}m
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshTokenNow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5 text-emerald-700" />
              <span>Rotasi Refresh Token</span>
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => {
              setErrorBanner('');
              setSubTab('roles');
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === 'roles'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Role & Matriks Permission ({roles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setErrorBanner('');
              setSubTab('users');
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === 'users'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>
              Pengguna ({users.length}) & Sesi ({activeSessionsCount})
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setErrorBanner('');
              setSubTab('security');
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              subTab === 'security'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Kebijakan Token & Rate Limiter</span>
          </button>
        </div>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
        >
          {errorBanner}
        </div>
      )}

      {subTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Daftar Role Dinamis
              </h3>
              {canManageRoles && (
                <button
                  type="button"
                  onClick={startCreateNewRole}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Role Baru</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {roles.map((role) => {
                const active = selectedRoleId === role.id;
                const assignedUsersCount = users.filter(
                  (u) => u.roleId === role.id
                ).length;
                return (
                  <div
                    key={role.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      active
                        ? 'border-emerald-600 bg-emerald-50/70'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setErrorBanner('');
                        setSelectedRoleId(role.id);
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-slate-900">
                          {role.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {role.permissions.length}/{ALL_PERMISSION_KEYS.length}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {role.description || 'Tanpa deskripsi.'}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          {role.isSystem ? 'Role Sistem Utama' : 'Role Kustom'}
                        </span>
                        <span>{assignedUsersCount} akun</span>
                      </div>
                    </button>
                    {canManageRoles && !role.isSystem && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteRole(role)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-800"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Hapus Role</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleSaveRole}
            className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  {selectedRoleId === 'new'
                    ? 'Buat Role RBAC Baru'
                    : `Konfigurasi Matriks: ${selectedRole?.name ?? ''}`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih izin akses tampilan menu sidebar dan aksi spesifik yang diizinkan pada API & UI.
                </p>
              </div>
              {canManageRoles && (
                <button
                  type="submit"
                  disabled={savingRole}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {savingRole
                      ? 'Menyimpan...'
                      : selectedRoleId === 'new'
                      ? 'Simpan Role Baru'
                      : 'Simpan Perubahan Role'}
                  </span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Role
                </label>
                <input
                  type="text"
                  required
                  disabled={!canManageRoles}
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Misal: Koordinator Cabang"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Tugas Role
                </label>
                <input
                  type="text"
                  disabled={!canManageRoles}
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Ringkasan kewenangan role ini"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="space-y-3">
              {PERMISSION_GROUPS.map((group) => {
                const groupKeys = group.items.map((i) => i.key);
                const selectedInGroup = groupKeys.filter((k) =>
                  rolePerms.includes(k)
                ).length;
                return (
                  <div
                    key={group.groupId}
                    className="rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between gap-3 border-b border-slate-200">
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {group.menuLabel}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {group.description}
                        </p>
                      </div>
                      {canManageRoles && (
                        <button
                          type="button"
                          onClick={() => toggleGroupPermissions(groupKeys)}
                          className="text-[11px] font-semibold text-emerald-700 hover:underline shrink-0"
                        >
                          {selectedInGroup === groupKeys.length
                            ? 'Lepas Semua'
                            : 'Pilih Semua'}{' '}
                          ({selectedInGroup}/{groupKeys.length})
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.items.map((item) => {
                        const checked = rolePerms.includes(item.key);
                        const locked =
                          Boolean(selectedRole?.isSystem) &&
                          SYSTEM_ADMIN_LOCKED_PERMISSIONS.includes(item.key);
                        return (
                          <label
                            key={item.key}
                            className={`flex items-start gap-3 px-4 py-2.5 text-xs ${
                              canManageRoles && !locked
                                ? 'cursor-pointer hover:bg-slate-50/70'
                                : 'opacity-80'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canManageRoles || locked}
                              onChange={() => togglePermission(item.key)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-800">
                                  {item.label}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                                    item.kind === 'menu'
                                      ? 'text-sky-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {item.kind === 'menu' ? 'Menu' : 'Aksi'}
                                </span>
                                {locked && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
                                    <Lock className="h-3 w-3" />
                                    Terkunci (Admin)
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </form>
        </div>
      )}

      {subTab === 'users' && (
        <div className="space-y-6">
          {canManageUsers && (
            <form
              onSubmit={handleCreateUser}
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-700" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Tambah Akun Pengguna Baru
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  minLength={2}
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Nama Lengkap"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="email@kaskukargo.id"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Sandi (min 8 huruf+angka)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
                <div className="flex gap-2">
                  <select
                    value={newUserRoleId}
                    onChange={(e) => setNewUserRoleId(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-900 bg-white"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                  >
                    {creatingUser ? '...' : 'Tambah'}
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Daftar Akun Pengguna ({users.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Pengguna</th>
                    <th className="px-4 py-3 font-semibold">Role Akses</th>
                    <th className="px-4 py-3 font-semibold">Halaman Terakhir</th>
                    <th className="px-4 py-3 font-semibold">Login Terakhir</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isSelf = u.id === currentUserId;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {u.name}{' '}
                            {isSelf && (
                              <span className="text-[10px] font-semibold text-emerald-700">
                                (Anda)
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {u.email}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {canManageUsers ? (
                            <select
                              aria-label={`Ubah role untuk ${u.email}`}
                              value={u.roleId}
                              onChange={async (e) => {
                                setErrorBanner('');
                                const res = await onUpdateUser({
                                  userId: u.id,
                                  roleId: e.target.value,
                                });
                                if (!res.ok) {
                                  setErrorBanner(
                                    res.error || 'Gagal mengganti role.'
                                  );
                                }
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                            >
                              {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-slate-700">
                              {u.roleName}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          /{u.lastVisitedTab}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500">
                          {u.lastLoginAt
                            ? formatDateTime(u.lastLoginAt)
                            : 'Belum pernah'}
                        </td>
                        <td className="px-4 py-3">
                          {canManageUsers ? (
                            <button
                              type="button"
                              onClick={async () => {
                                setErrorBanner('');
                                const res = await onUpdateUser({
                                  userId: u.id,
                                  active: !u.active,
                                });
                                if (!res.ok) {
                                  setErrorBanner(
                                    res.error || 'Gagal mengubah status akun.'
                                  );
                                }
                              }}
                              className={`text-xs font-semibold ${
                                u.active
                                  ? 'text-emerald-700 hover:text-emerald-900'
                                  : 'text-rose-700 hover:text-rose-900'
                              }`}
                            >
                              {u.active ? 'Aktif (Klik Nonaktifkan)' : 'Nonaktif (Klik Aktifkan)'}
                            </button>
                          ) : (
                            <span>{u.active ? 'Aktif' : 'Nonaktif'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Riwayat & Sesi Refresh Token ({sessions.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Akun & Role</th>
                    <th className="px-4 py-3 font-semibold">Mulai Sesi</th>
                    <th className="px-4 py-3 font-semibold">Kedaluwarsa</th>
                    <th className="px-4 py-3 font-semibold">Rotasi</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {s.userName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {s.userEmail} · {s.roleName}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        {formatDateTime(s.issuedAt)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        {formatDateTime(s.expiresAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        {s.refreshCount}x
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold ${
                            s.revoked ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {s.revoked ? 'Dicabut / Berakhir' : 'Aktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManageUsers && !s.revoked && (
                          <button
                            type="button"
                            onClick={() => onRevokeSession(s.id)}
                            className="text-xs font-semibold text-rose-700 hover:underline"
                          >
                            Cabut Paksa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'security' && (
        <form
          onSubmit={handleSavePolicy}
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Kebijakan Masa Berlaku Token & Rate Limiter
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Saat batas sesi berakhir, sistem otomatis mencabut akses dan me-logout pengguna ke halaman Login serta mencatatnya di Log Audit SHA-256.
              </p>
            </div>
            {canManageUsers && (
              <button
                type="submit"
                disabled={savingPolicy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  {savingPolicy ? 'Menyimpan...' : 'Simpan Kebijakan Keamanan'}
                </span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Masa Berlaku Access Token (Menit)
              </label>
              <input
                type="number"
                step="0.25"
                min={0.25}
                max={120}
                disabled={!canManageUsers}
                value={accessTtl}
                onChange={(e) => setAccessTtl(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                0,25–120 menit (diperbarui diam-diam via Refresh Token).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batas Sesi / Refresh Token (Menit)
              </label>
              <input
                type="number"
                min={1}
                max={43200}
                disabled={!canManageUsers}
                value={refreshTtl}
                onChange={(e) => setRefreshTtl(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Jika habis, sesi otomatis logout (contoh: 480 menit = 8 jam kerja).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rate Limit Endpoint Auth (/menit)
              </label>
              <input
                type="number"
                min={3}
                max={120}
                disabled={!canManageUsers}
                value={authLimit}
                onChange={(e) => setAuthLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Batas request login / refresh / bootstrap per IP per menit (HTTP 429).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rate Limit API Umum (/menit)
              </label>
              <input
                type="number"
                min={30}
                max={2000}
                disabled={!canManageUsers}
                value={apiLimit}
                onChange={(e) => setApiLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Batas panggilan API per IP per menit untuk proteksi lonjakan trafik.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batas Gagal Login Sebelum Cooldown
              </label>
              <input
                type="number"
                min={2}
                max={20}
                disabled={!canManageUsers}
                value={maxFailLogin}
                onChange={(e) => setMaxFailLogin(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Kunci sementara akun setelah salah sandi berturut-turut.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Durasi Cooldown Akun (Detik)
              </label>
              <input
                type="number"
                min={15}
                max={3600}
                disabled={!canManageUsers}
                value={cooldownSec}
                onChange={(e) => setCooldownSec(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Lama penguncian akun setelah gagal login berulang (15–3600 detik).
              </p>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
