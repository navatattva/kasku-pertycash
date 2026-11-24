import fs from 'node:fs';
import path from 'node:path';
import type {
  ActivityLogEntry,
  AppStateSnapshot,
  AuthSecurityPolicy,
  AuthSessionPublic,
  AuthUserPublic,
  CashOpnameRecord,
  ClosedPeriodRecord,
  DailyClosingRecord,
  Department,
  DownPaymentRecord,
  ForecastModuleConfig,
  FraudGuardConfig,
  MasterCategory,
  MasterEmployee,
  MasterVehicle,
  PermissionKey,
  PettyCashRequest,
  RbacRole,
  TaxModuleConfig,
  TopUpRecord,
  WhatsAppDispatchLog,
  WhatsAppModuleConfig,
} from '../src/types/pettycash.ts';
import { hasPermission, isPeriodClosed } from '../src/utils/pettycashLogic.ts';
import { verifyActivityLogsIntegrity } from './activityLogUtils.ts';
import { createSeedDatabase, CURRENT_SCHEMA_VERSION } from './seed.ts';

export interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
  roleId: string;
  passwordSalt: string;
  passwordHash: string;
  active: boolean;
  lastVisitedTab: string;
  failedLoginCount: number;
  lockedUntil?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  issuedAt: string;
  expiresAt: string;
  lastRefreshedAt?: string;
  refreshCount: number;
  revoked: boolean;
  revokedReason?: string;
}

export interface PersistedDatabase {
  schemaVersion: number;
  departments: Department[];
  employees: MasterEmployee[];
  categories: MasterCategory[];
  vehicles: MasterVehicle[];
  requests: PettyCashRequest[];
  topUps: TopUpRecord[];
  opnames: CashOpnameRecord[];
  downPayments: DownPaymentRecord[];
  dailyClosings: DailyClosingRecord[];
  closedPeriods: ClosedPeriodRecord[];
  taxModule: TaxModuleConfig;
  forecastModule: ForecastModuleConfig;
  fraudGuard: FraudGuardConfig;
  whatsappModule: WhatsAppModuleConfig;
  whatsappLogs: WhatsAppDispatchLog[];
  activityLogs: ActivityLogEntry[];
  rbacRoles: RbacRole[];
  authUsers: AuthUserRecord[];
  authSessions: AuthSessionRecord[];
  securityPolicy: AuthSecurityPolicy;
  sequenceCounter: number;
  opnameCounter: number;
  dpCounter: number;
  closingCounter: number;
}

export const DATA_DIR = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR.trim())
  : path.resolve(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_FILE = path.join(DATA_DIR, 'pettycash-db.json');

export function writeDbAtomically(db: PersistedDatabase = memoryDb): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

function ensureDbLoaded(): PersistedDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = createSeedDatabase();
    writeDbAtomically(seed);
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as PersistedDatabase;
    if (
      parsed.schemaVersion !== CURRENT_SCHEMA_VERSION ||
      !Array.isArray(parsed.departments) ||
      !Array.isArray(parsed.employees) ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.vehicles) ||
      !Array.isArray(parsed.requests) ||
      !Array.isArray(parsed.opnames) ||
      !Array.isArray(parsed.downPayments) ||
      !Array.isArray(parsed.dailyClosings) ||
      !Array.isArray(parsed.closedPeriods) ||
      !parsed.taxModule ||
      typeof parsed.taxModule.enabled !== 'boolean' ||
      !parsed.forecastModule ||
      typeof parsed.forecastModule.enabled !== 'boolean' ||
      !parsed.fraudGuard ||
      typeof parsed.fraudGuard.enabled !== 'boolean' ||
      !parsed.whatsappModule ||
      typeof parsed.whatsappModule.enabled !== 'boolean' ||
      !Array.isArray(parsed.whatsappLogs) ||
      !Array.isArray(parsed.activityLogs) ||
      !Array.isArray(parsed.rbacRoles) ||
      !Array.isArray(parsed.authUsers) ||
      !Array.isArray(parsed.authSessions) ||
      !parsed.securityPolicy
    ) {
      throw new Error('Schema version mismatch');
    }
    return parsed;
  } catch {
    const seed = createSeedDatabase();
    writeDbAtomically(seed);
    return seed;
  }
}

export const memoryDb: PersistedDatabase = ensureDbLoaded();

export function checkLockedPeriodError(dateOrMonthIso: string): string | null {
  const locked = isPeriodClosed(dateOrMonthIso, memoryDb.closedPeriods);
  if (!locked) return null;
  return `Periode ${locked.monthKey} sudah berstatus Terkunci (Tutup Buku). Buka kunci periode oleh Direktur terlebih dahulu jika diperlukan penyesuaian.`;
}

export function isValidActiveCategory(categoryName: string): boolean {
  return memoryDb.categories.some(
    (c) => c.active && c.name === categoryName
  );
}

export function toPublicAuthUser(user: AuthUserRecord): AuthUserPublic {
  const role = memoryDb.rbacRoles.find((r) => r.id === user.roleId);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    roleName: role?.name ?? user.roleId,
    active: user.active,
    lastVisitedTab: user.lastVisitedTab || 'dashboard',
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toPublicAuthSession(
  session: AuthSessionRecord
): AuthSessionPublic {
  const user = memoryDb.authUsers.find((u) => u.id === session.userId);
  const role = user
    ? memoryDb.rbacRoles.find((r) => r.id === user.roleId)
    : undefined;
  return {
    id: session.id,
    userId: session.userId,
    userName: user?.name ?? 'Pengguna Dihapus',
    userEmail: user?.email ?? '-',
    roleName: role?.name ?? user?.roleId ?? '-',
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    lastRefreshedAt: session.lastRefreshedAt,
    refreshCount: session.refreshCount,
    revoked: session.revoked,
  };
}

export function getSnapshot(
  viewerPermissions?: readonly PermissionKey[]
): AppStateSnapshot {
  const includeRbacDetails = hasPermission(viewerPermissions, 'rbac:view');
  const includeAuditLogs = hasPermission(
    viewerPermissions,
    'activity_log:view'
  );

  return {
    departments: memoryDb.departments,
    employees: memoryDb.employees,
    categories: memoryDb.categories,
    vehicles: memoryDb.vehicles,
    requests: memoryDb.requests,
    topUps: memoryDb.topUps,
    opnames: memoryDb.opnames,
    downPayments: memoryDb.downPayments,
    dailyClosings: memoryDb.dailyClosings,
    closedPeriods: memoryDb.closedPeriods,
    taxModule: memoryDb.taxModule,
    forecastModule: memoryDb.forecastModule,
    fraudGuard: memoryDb.fraudGuard,
    whatsappModule: memoryDb.whatsappModule,
    whatsappLogs: memoryDb.whatsappLogs,
    activityLogs: includeAuditLogs ? memoryDb.activityLogs : [],
    activityLogIntegrity: includeAuditLogs
      ? verifyActivityLogsIntegrity(memoryDb.activityLogs)
      : {
          valid: true,
          totalEntries: 0,
          lastSequence: 0,
          lastHash: 'GENESIS',
          verifiedAt: new Date().toISOString(),
          issues: [],
        },
    rbacRoles: memoryDb.rbacRoles,
    ...(includeRbacDetails
      ? {
          authUsers: memoryDb.authUsers.map(toPublicAuthUser),
          authSessions: memoryDb.authSessions
            .slice(0, 50)
            .map(toPublicAuthSession),
          securityPolicy: memoryDb.securityPolicy,
        }
      : {}),
    serverTime: new Date().toISOString(),
  };
}
