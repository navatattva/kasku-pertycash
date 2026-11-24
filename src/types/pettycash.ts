export type UserRole = 'staff' | 'director';

export type RequestStatus = 'pending_director' | 'approved' | 'rejected';

export type ExpenseCategory = string;

export type TaxSchemeId =
  | 'none'
  | 'ppn_exclusive'
  | 'ppn_inclusive'
  | 'pph23_2'
  | 'pph21_ter_05'
  | 'pph21_non_emp_25';

export interface TaxCalculationInfo {
  taxType: TaxSchemeId;
  label: string;
  ratePct: number;
  baseInputAmount: number;
  dppAmount: number;
  ppnAmount: number;
  pphAmount: number;
  netDisbursed: number;
}

export interface TaxModuleConfig {
  enabled: boolean;
  enablePpn: boolean;
  enablePph23: boolean;
  enablePph21: boolean;
  updatedAt: string;
}

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'BBM & Tol Armada',
  'Bongkar Muat & Gudang',
  'Dokumen Kargo & Pelabuhan',
  'Perawatan Ringan Armada',
  'Operasional Kantor & Resi',
  'Kebutuhan Darurat Pengiriman',
];

export interface ApprovalDecisionInfo {
  roleLabel: string;
  status: 'pending' | 'approved' | 'rejected';
  approverName?: string;
  decidedAt?: string;
  note?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  picName: string;
  monthlyBudget: number;
  balance: number;
  lowBalanceThreshold: number;
  active?: boolean;
  updatedAt: string;
}

export interface MasterEmployee {
  id: string;
  code: string;
  name: string;
  roleTitle: string;
  departmentId: string;
  active: boolean;
  updatedAt: string;
}

export interface MasterCategory {
  id: string;
  code: string;
  name: string;
  requiresVehicle: boolean;
  active: boolean;
  updatedAt: string;
}

export interface MasterVehicle {
  id: string;
  plateNumber: string;
  unitType: string;
  departmentId: string;
  active: boolean;
  updatedAt: string;
}

export interface PettyCashRequest {
  id: string;
  requestNumber: string;
  departmentId: string;
  employeeId?: string;
  createdByUserId?: string;
  requesterName: string;
  title: string;
  category: ExpenseCategory;
  vehicleId?: string;
  vehiclePlate?: string;
  amount: number;
  tax?: TaxCalculationInfo;
  fraudFlags?: FraudFlag[];
  notes: string;
  receiptRef: string;
  receiptImageUrl?: string;
  receiptImageName?: string;
  status: RequestStatus;
  approval: ApprovalDecisionInfo;
  createdAt: string;
  updatedAt: string;
  disbursedAt?: string;
}

export interface TopUpRecord {
  id: string;
  departmentId: string;
  amount: number;
  performedBy: string;
  note: string;
  createdAt: string;
}

export const INDONESIAN_DENOMINATIONS = [
  100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100,
] as const;

export interface DenominationCount {
  denomination: number;
  count: number;
  subtotal: number;
}

export interface CashOpnameRecord {
  id: string;
  opnameNumber: string;
  departmentId: string;
  systemBalance: number;
  physicalTotal: number;
  variance: number;
  status: 'matched' | 'over' | 'short';
  denominations: DenominationCount[];
  countedBy: string;
  note: string;
  createdAt: string;
}

export interface CashLedgerEntry {
  id: string;
  date: string;
  type:
    | 'topup'
    | 'disbursement'
    | 'kasbon_out'
    | 'kasbon_refund'
    | 'kasbon_reimburse';
  referenceNumber: string;
  departmentId: string;
  departmentName: string;
  categoryOrSource: string;
  description: string;
  actor: string;
  debit: number;
  credit: number;
  runningBalance: number;
  receiptImageUrl?: string;
}

export interface CashLedgerSummary {
  openingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  closingBalance: number;
  entries: CashLedgerEntry[];
}

export type DownPaymentStatus =
  | 'pending_director'
  | 'open'
  | 'settled'
  | 'rejected';

export interface DownPaymentSettlement {
  actualAmount: number;
  differenceAmount: number;
  differenceType: 'exact' | 'refund' | 'reimburse';
  receiptRef: string;
  receiptImageUrl?: string;
  receiptImageName?: string;
  settledBy: string;
  note: string;
  settledAt: string;
}

export interface DownPaymentRecord {
  id: string;
  dpNumber: string;
  departmentId: string;
  employeeId?: string;
  createdByUserId?: string;
  requesterName: string;
  title: string;
  category: ExpenseCategory;
  vehicleId?: string;
  vehiclePlate?: string;
  requestedAmount: number;
  dueDate: string;
  notes: string;
  status: DownPaymentStatus;
  approval: ApprovalDecisionInfo;
  settlement?: DownPaymentSettlement;
  createdAt: string;
  updatedAt: string;
  disbursedAt?: string;
}

export interface DailyClosingRecord {
  id: string;
  closingNumber: string;
  closingDate: string;
  departmentId: string;
  departmentName: string;
  openingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  systemClosingBalance: number;
  physicalCountTotal: number | null;
  variance: number | null;
  openKasbonCount: number;
  openKasbonAmount: number;
  closedBy: string;
  note: string;
  createdAt: string;
}

export interface ClosedPeriodRecord {
  id: string;
  monthKey: string;
  totalTopUp: number;
  totalSpent: number;
  endingBalance: number;
  approvedCount: number;
  openKasbonAtClose: number;
  closedBy: string;
  note: string;
  closedAt: string;
}

export interface DepartmentMetrics {
  department: Department;
  pendingHold: number;
  availableBalance: number;
  monthSpent: number;
  monthRequestCount: number;
  budgetUtilizationPct: number;
  healthStatus: 'normal' | 'menipis' | 'kritis';
}

export interface MonthlyDepartmentBreakdown {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  monthlyBudget: number;
  totalSpent: number;
  prevTotalSpent: number;
  deltaAmount: number;
  deltaPct: number | null;
  totalTopUp: number;
  transactionCount: number;
  remainingBudget: number;
  utilizationPct: number;
}

export interface MonthlyCategoryBreakdown {
  category: ExpenseCategory;
  totalSpent: number;
  prevTotalSpent: number;
  deltaAmount: number;
  deltaPct: number | null;
  transactionCount: number;
  sharePct: number;
}

export interface MonthlyVehicleBreakdown {
  vehicleKey: string;
  plateNumber: string;
  unitType: string;
  departmentName: string;
  transactionCount: number;
  fuelTollSpent: number;
  maintenanceSpent: number;
  otherSpent: number;
  totalSpent: number;
  prevTotalSpent: number;
  deltaAmount: number;
  deltaPct: number | null;
}

export interface MonthlyReport {
  monthKey: string;
  previousMonthKey: string;
  totalSpent: number;
  previousTotalSpent: number;
  momDeltaAmount: number;
  momDeltaPct: number | null;
  totalBudget: number;
  totalTopUp: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  averageExpense: number;
  byDepartment: MonthlyDepartmentBreakdown[];
  byCategory: MonthlyCategoryBreakdown[];
  byVehicle: MonthlyVehicleBreakdown[];
  transactions: PettyCashRequest[];
  settledKasbons: DownPaymentRecord[];
  settledKasbonTotal: number;
  settledKasbonCount: number;
  totalPpnInput: number;
  totalPphWithheld: number;
}

export type ColdForecastMethod =
  | 'budget_baseline'
  | 'hybrid_historical'
  | 'zero_conservative';

export interface ForecastModuleConfig {
  enabled: boolean;
  coldStartMethod: ColdForecastMethod;
  budgetUtilizationAssumptionPct: number;
  horizonDays: 14 | 30 | 60;
  updatedAt: string;
}

export type FraudFlagSeverity = 'block' | 'warning';

export type FraudFlagCode =
  | 'MISSING_RECEIPT_IMAGE'
  | 'DUPLICATE_RECEIPT_REF'
  | 'OVER_SINGLE_LIMIT'
  | 'SELF_APPROVAL'
  | 'SAME_WINDOW_DUPLICATE_CLAIM'
  | 'SPLIT_TRANSACTION_SUSPECT'
  | 'VEHICLE_SAME_DAY_CLAIM'
  | 'HIGH_VALUE_ALERT'
  | 'MISSING_FLEET_UNIT';

export interface FraudFlag {
  code: FraudFlagCode;
  severity: FraudFlagSeverity;
  title: string;
  detail: string;
}

export interface FraudGuardConfig {
  enabled: boolean;
  requireReceiptImage: boolean;
  receiptRequiredMinAmount: number;
  blockDuplicateReceiptRef: boolean;
  preventSelfApproval: boolean;
  detectDuplicateClaimWindowHours: number;
  highValueAlertAmount: number;
  maxSingleRequestAmount: number;
  updatedAt: string;
}

export interface WhatsAppModuleConfig {
  enabled: boolean;
  directorPhone: string;
  autoSendOnNewRequest: boolean;
  autoSendOnDecision: boolean;
  lowBalanceReminder: boolean;
  updatedAt: string;
}

export interface WhatsAppDispatchLog {
  id: string;
  eventType: 'new_request' | 'decision' | 'low_balance' | 'manual_test';
  recipientPhone: string;
  referenceNumber: string;
  messagePreview: string;
  waLink: string;
  status: 'queued' | 'sent';
  createdAt: string;
}

export type ActivityLogActionType =
  | 'request_approved'
  | 'request_rejected'
  | 'kasbon_approved'
  | 'kasbon_rejected'
  | 'auth_bootstrap'
  | 'auth_login'
  | 'auth_login_failed'
  | 'auth_token_refreshed'
  | 'auth_logout'
  | 'auth_session_expired'
  | 'rbac_role_created'
  | 'rbac_role_updated'
  | 'rbac_role_deleted'
  | 'rbac_user_created'
  | 'rbac_user_updated'
  | 'rbac_session_revoked'
  | 'security_policy_updated';

export type ActivityLogEntityType =
  | 'petty_cash_request'
  | 'down_payment'
  | 'auth_session'
  | 'rbac_policy'
  | 'user_account';

export interface ActivityLogEntry {
  id: string;
  sequence: number;
  actionType: ActivityLogActionType;
  entityType: ActivityLogEntityType;
  entityId: string;
  referenceNumber: string;
  title: string;
  departmentId: string;
  departmentName: string;
  requesterName: string;
  amount: number;
  decision: 'approve' | 'reject' | 'info' | 'warning';
  actorName: string;
  actorRole: string;
  note: string;
  timestamp: string;
  previousHash: string;
  entryHash: string;
}

export interface ActivityLogIntegrityIssue {
  sequence: number;
  id: string;
  reason: string;
}

export interface ActivityLogIntegrityReport {
  valid: boolean;
  totalEntries: number;
  lastSequence: number;
  lastHash: string;
  verifiedAt: string;
  issues: ActivityLogIntegrityIssue[];
}

export type PermissionKey =
  | 'dashboard:view'
  | 'approvals:view'
  | 'requests:create'
  | 'requests:decide'
  | 'down_payments:view'
  | 'down_payments:create'
  | 'down_payments:decide'
  | 'down_payments:settle'
  | 'departments:view'
  | 'departments:topup'
  | 'departments:edit'
  | 'opname:create'
  | 'closing:view'
  | 'closing:daily'
  | 'closing:lock_period'
  | 'closing:reopen_period'
  | 'reports:view'
  | 'reports:export'
  | 'activity_log:view'
  | 'activity_log:export'
  | 'master:view'
  | 'master:manage'
  | 'modules:view'
  | 'modules:manage'
  | 'whatsapp:dispatch'
  | 'wiki:view'
  | 'rbac:view'
  | 'rbac:manage_roles'
  | 'rbac:manage_users';

export type RbacRoleId = string;

export interface RbacRole {
  id: RbacRoleId;
  name: string;
  slug: string;
  description: string;
  permissions: PermissionKey[];
  isSystem: boolean;
  updatedAt: string;
}

export interface AuthUserPublic {
  id: string;
  email: string;
  name: string;
  roleId: RbacRoleId;
  roleName: string;
  active: boolean;
  lastVisitedTab: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionPublic {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleName: string;
  issuedAt: string;
  expiresAt: string;
  lastRefreshedAt?: string;
  refreshCount: number;
  revoked: boolean;
}

export interface AuthSecurityPolicy {
  accessTokenTtlMinutes: number;
  refreshTokenTtlMinutes: number;
  authRateLimitMaxPerMinute: number;
  apiRateLimitMaxPerMinute: number;
  maxFailedLoginsBeforeCooldown: number;
  cooldownSeconds: number;
  updatedAt: string;
}

export interface AuthStatusInfo {
  needsInitialSetup: boolean;
  hasEnvAdminPasscode: boolean;
}

export interface AuthTokenBundle {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
  user: AuthUserPublic;
  role: RbacRole;
  permissions: PermissionKey[];
}

export interface AppStateSnapshot {
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
  activityLogIntegrity: ActivityLogIntegrityReport;
  rbacRoles: RbacRole[];
  authUsers?: AuthUserPublic[];
  authSessions?: AuthSessionPublic[];
  securityPolicy?: AuthSecurityPolicy;
  serverTime: string;
}

export interface CashHealthMetrics {
  score: number;
  status: 'sehat' | 'waspada' | 'kritis';
  statusLabel: string;
  totalAvailableBalance: number;
  totalLowThreshold: number;
  healthyDeptsCount: number;
  totalActiveDeptsCount: number;
  latestOpnameVariance: number;
  coverageRatioPct: number;
  budgetRemainingPct: number;
  coveragePoints: number;
  budgetPoints: number;
  stabilityPoints: number;
}

export type ForecastDataConfidence = 'cold' | 'partial' | 'mature';
export type ForecastBurnRateSource =
  | 'actual_mtd'
  | 'hybrid_prev_month'
  | 'hybrid_budget'
  | 'cold_budget'
  | 'zero_actual';

export interface DivisionForecast {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  monthlyBudget: number;
  availableBalance: number;
  lowBalanceThreshold: number;
  monthTxCount: number;
  prevMonthSpent: number;
  coldBaselineDailyBurn: number;
  dataConfidence: ForecastDataConfidence;
  burnRateSource: ForecastBurnRateSource;
  dailyBurnRate: number;
  runwayDays: number | null;
  projectedMonthEndSpend: number;
  projectedMonthEndBalance: number;
  recommendedTopUp: number;
  riskLevel: 'aman' | 'perhatian' | 'kritis';
}

export interface CashForecastPoint {
  dayOffset: number;
  label: string;
  projectedBalance: number;
}

export interface CashForecastSummary {
  referenceDate: string;
  horizonDays: 14 | 30 | 60;
  coldStartMethod: ColdForecastMethod;
  budgetUtilizationAssumptionPct: number;
  daysElapsedInMonth: number;
  daysRemainingInMonth: number;
  dailyBurnRate: number;
  overallRunwayDays: number | null;
  projectedMonthEndSpend: number;
  projectedMonthEndBalance: number;
  totalLowThreshold: number;
  totalRecommendedTopUp: number;
  overallConfidence: ForecastDataConfidence;
  coldDivisionsCount: number;
  partialDivisionsCount: number;
  matureDivisionsCount: number;
  curvePoints: CashForecastPoint[];
  byDivision: DivisionForecast[];
}
