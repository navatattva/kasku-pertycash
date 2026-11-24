import type {
  ActivityLogEntry,
  ActivityLogIntegrityReport,
  AppStateSnapshot,
  AuthSecurityPolicy,
  AuthSessionPublic,
  AuthStatusInfo,
  AuthTokenBundle,
  AuthUserPublic,
  CashOpnameRecord,
  ClosedPeriodRecord,
  ColdForecastMethod,
  DailyClosingRecord,
  Department,
  DownPaymentRecord,
  ExpenseCategory,
  ForecastModuleConfig,
  FraudGuardConfig,
  MasterCategory,
  MasterEmployee,
  MasterVehicle,
  PermissionKey,
  PettyCashRequest,
  RbacRole,
  TaxModuleConfig,
  TaxSchemeId,
  WhatsAppDispatchLog,
  WhatsAppModuleConfig,
} from '../types/pettycash.ts';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// Strict in-memory token store (never persisted in localStorage/sessionStorage)
let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;
let inflightRefreshPromise: Promise<boolean> | null = null;

let authHooks: {
  onTokensRefreshed?: (bundle: AuthTokenBundle) => void;
  onSessionExpired?: (message: string) => void;
} = {};

export function setAuthTokensInMemory(
  accessToken: string | null,
  refreshToken: string | null
): void {
  inMemoryAccessToken = accessToken;
  inMemoryRefreshToken = refreshToken;
}

export function getAccessTokenInMemory(): string | null {
  return inMemoryAccessToken;
}

export function getRefreshTokenInMemory(): string | null {
  return inMemoryRefreshToken;
}

export function registerAuthRefreshHooks(hooks: {
  onTokensRefreshed?: (bundle: AuthTokenBundle) => void;
  onSessionExpired?: (message: string) => void;
}): () => void {
  authHooks = hooks;
  return () => {
    authHooks = {};
  };
}

export async function refreshAuthTokensSingleFlight(): Promise<boolean> {
  if (!inMemoryRefreshToken) {
    return false;
  }
  if (inflightRefreshPromise) {
    return inflightRefreshPromise;
  }

  inflightRefreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: inMemoryRefreshToken }),
      });
      const data = (await res.json()) as AuthTokenBundle & {
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.accessToken || !data.refreshToken) {
        setAuthTokensInMemory(null, null);
        authHooks.onSessionExpired?.(
          data.error || 'Sesi Anda telah habis. Silakan login kembali.'
        );
        return false;
      }
      setAuthTokensInMemory(data.accessToken, data.refreshToken);
      authHooks.onTokensRefreshed?.(data);
      return true;
    } catch {
      return false;
    } finally {
      inflightRefreshPromise = null;
    }
  })();

  return inflightRefreshPromise;
}

export async function authorizedFetch(
  url: string,
  init: RequestInit = {},
  options: { skipAutoRefresh?: boolean } = {}
): Promise<Response> {
  const buildHeaders = (): Headers => {
    const headers = new Headers(init.headers ?? {});
    if (inMemoryAccessToken) {
      headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
    }
    return headers;
  };

  let res = await fetch(url, { ...init, headers: buildHeaders() });

  if (res.status === 401 && !options.skipAutoRefresh) {
    let code: string | undefined;
    let errorMsg = 'Sesi tidak valid.';
    try {
      const cloned = res.clone();
      const body = (await cloned.json()) as { code?: string; error?: string };
      code = body.code;
      if (body.error) errorMsg = body.error;
    } catch {
      // ignore non-json 401
    }

    if (code === 'TOKEN_EXPIRED' && inMemoryRefreshToken) {
      const refreshed = await refreshAuthTokensSingleFlight();
      if (refreshed) {
        res = await fetch(url, { ...init, headers: buildHeaders() });
        return res;
      }
    }

    if (
      code === 'SESSION_EXPIRED' ||
      code === 'SESSION_REVOKED' ||
      code === 'USER_INACTIVE' ||
      code === 'INVALID_TOKEN' ||
      code === 'UNAUTHORIZED'
    ) {
      setAuthTokensInMemory(null, null);
      authHooks.onSessionExpired?.(errorMsg);
    }
  }

  return res;
}

export async function fetchAuthorizedBlobUrl(url: string): Promise<string> {
  const res = await authorizedFetch(url);
  if (!res.ok) {
    throw new ApiError(`Gagal memuat lampiran (HTTP ${res.status}).`, res.status);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  fallbackError = 'Permintaan gagal diproses.',
  options: { skipAuth?: boolean; skipAutoRefresh?: boolean } = {}
): Promise<T> {
  const res = options.skipAuth
    ? await fetch(url, init)
    : await authorizedFetch(url, init, {
        skipAutoRefresh: options.skipAutoRefresh,
      });
  const data = (await res.json()) as T & { error?: string; code?: string };
  if (!res.ok) {
    throw new ApiError(data.error || fallbackError, res.status, data.code);
  }
  return data;
}

function jsonPost<T>(
  url: string,
  body: unknown,
  fallbackError: string,
  options: { skipAuth?: boolean } = {}
): Promise<T> {
  return requestJson<T>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    fallbackError,
    options
  );
}

function jsonPatch<T>(
  url: string,
  body: unknown,
  fallbackError: string
): Promise<T> {
  return requestJson<T>(
    url,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    fallbackError
  );
}

function jsonDelete<T>(url: string, fallbackError: string): Promise<T> {
  return requestJson<T>(
    url,
    {
      method: 'DELETE',
    },
    fallbackError
  );
}

export interface StateResponse {
  state?: AppStateSnapshot;
}

export interface CreateRequestPayload {
  departmentId: string;
  employeeId?: string;
  requesterName: string;
  title: string;
  category: ExpenseCategory;
  vehicleId?: string;
  amount: number;
  taxType?: TaxSchemeId;
  notes: string;
  receiptRef: string;
  receiptImageUrl?: string;
  receiptImageName?: string;
}

export interface DecideRequestPayload {
  requestId: string;
  decision: 'approve' | 'reject';
  note: string;
}

export interface TopUpPayload {
  departmentId: string;
  amount: number;
  note: string;
}

export interface CreateDepartmentPayload {
  code: string;
  name: string;
  picName: string;
  monthlyBudget: number;
  lowBalanceThreshold: number;
  initialBalance: number;
}

export interface UpdateDepartmentPayload {
  departmentId: string;
  code?: string;
  name?: string;
  picName: string;
  monthlyBudget: number;
  lowBalanceThreshold: number;
  active?: boolean;
}

export interface CreateEmployeePayload {
  code: string;
  name: string;
  roleTitle: string;
  departmentId: string;
}

export interface UpdateEmployeePayload {
  employeeId: string;
  code?: string;
  name?: string;
  roleTitle?: string;
  departmentId?: string;
  active?: boolean;
}

export interface CreateCategoryPayload {
  code: string;
  name: string;
  requiresVehicle: boolean;
}

export interface UpdateCategoryPayload {
  categoryId: string;
  code?: string;
  name?: string;
  requiresVehicle?: boolean;
  active?: boolean;
}

export interface CreateVehiclePayload {
  plateNumber: string;
  unitType: string;
  departmentId: string;
}

export interface UpdateVehiclePayload {
  vehicleId: string;
  plateNumber?: string;
  unitType?: string;
  departmentId?: string;
  active?: boolean;
}

export interface UpdateForecastModulePayload {
  enabled?: boolean;
  coldStartMethod?: ColdForecastMethod;
  budgetUtilizationAssumptionPct?: number;
  horizonDays?: 14 | 30 | 60;
}

export interface UpdateFraudGuardPayload {
  enabled?: boolean;
  requireReceiptImage?: boolean;
  receiptRequiredMinAmount?: number;
  blockDuplicateReceiptRef?: boolean;
  preventSelfApproval?: boolean;
  detectDuplicateClaimWindowHours?: number;
  highValueAlertAmount?: number;
  maxSingleRequestAmount?: number;
}

export interface UpdateTaxModulePayload {
  enabled?: boolean;
  enablePpn?: boolean;
  enablePph23?: boolean;
  enablePph21?: boolean;
}

export interface UpdateWhatsAppModulePayload {
  enabled?: boolean;
  directorPhone?: string;
  autoSendOnNewRequest?: boolean;
  autoSendOnDecision?: boolean;
  lowBalanceReminder?: boolean;
}

export interface DispatchWhatsAppPayload {
  eventType: 'new_request' | 'decision' | 'low_balance' | 'manual_test';
  referenceNumber: string;
  messagePreview: string;
  recipientPhone?: string;
}

export interface CreateOpnamePayload {
  departmentId: string;
  note: string;
  denominations: { denomination: number; count: number }[];
}

export interface CreateDownPaymentPayload {
  departmentId: string;
  employeeId?: string;
  requesterName: string;
  title: string;
  category: ExpenseCategory;
  vehicleId?: string;
  requestedAmount: number;
  dueDate: string;
  notes: string;
}

export interface DecideDownPaymentPayload {
  dpId: string;
  decision: 'approve' | 'reject';
  note: string;
}

export interface SettleDownPaymentPayload {
  dpId: string;
  actualAmount: number;
  receiptRef: string;
  receiptImageUrl?: string;
  receiptImageName?: string;
  note: string;
}

export interface CreateDailyClosingPayload {
  closingDate: string;
  departmentId: string;
  note: string;
}

export interface ClosePeriodPayload {
  monthKey: string;
  note: string;
}

export interface ReopenPeriodPayload {
  monthKey: string;
}

export interface CreateRbacRolePayload {
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export interface UpdateRbacRolePayload {
  roleId: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export interface CreateUserAccountPayload {
  name: string;
  email: string;
  password: string;
  roleId: string;
}

export interface UpdateUserAccountPayload {
  userId: string;
  name?: string;
  roleId?: string;
  active?: boolean;
  newPassword?: string;
}

export interface UpdateSecurityPolicyPayload {
  accessTokenTtlMinutes?: number;
  refreshTokenTtlMinutes?: number;
  authRateLimitMaxPerMinute?: number;
  apiRateLimitMaxPerMinute?: number;
  maxFailedLoginsBeforeCooldown?: number;
  cooldownSeconds?: number;
}

export const pettycashApi = {
  auth: {
    getStatus(): Promise<AuthStatusInfo> {
      return requestJson<AuthStatusInfo>(
        '/api/auth/status',
        undefined,
        'Gagal memeriksa status autentikasi.',
        { skipAuth: true }
      );
    },
    bootstrap(payload: {
      name: string;
      email: string;
      password: string;
      passcode?: string;
    }): Promise<AuthTokenBundle> {
      return jsonPost<AuthTokenBundle>(
        '/api/auth/bootstrap',
        payload,
        'Gagal mengaktifkan akun Direktur pertama.',
        { skipAuth: true }
      );
    },
    login(payload: {
      email: string;
      password: string;
    }): Promise<AuthTokenBundle> {
      return jsonPost<AuthTokenBundle>(
        '/api/auth/login',
        payload,
        'Email atau kata sandi salah.',
        { skipAuth: true }
      );
    },
    refresh(refreshToken: string): Promise<AuthTokenBundle> {
      return jsonPost<AuthTokenBundle>(
        '/api/auth/refresh',
        { refreshToken },
        'Gagal memperbarui refresh token.',
        { skipAuth: true }
      );
    },
    logout(reason?: string): Promise<{ ok: boolean }> {
      return requestJson<{ ok: boolean }>(
        '/api/auth/logout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        },
        'Gagal logout.',
        { skipAutoRefresh: true }
      );
    },
    me(): Promise<{
      user: AuthUserPublic;
      role: RbacRole;
      permissions: PermissionKey[];
      session: AuthSessionPublic;
      securityPolicy: AuthSecurityPolicy;
    }> {
      return requestJson(
        '/api/auth/me',
        undefined,
        'Gagal memuat profil sesi aktif.'
      );
    },
    updateLastTab(tab: string): Promise<{ ok: boolean; user: AuthUserPublic }> {
      return jsonPatch<{ ok: boolean; user: AuthUserPublic }>(
        '/api/auth/last-tab',
        { tab },
        'Gagal menyimpan halaman terakhir.'
      );
    },
  },

  rbac: {
    createRole(payload: CreateRbacRolePayload) {
      return jsonPost<StateResponse & { role?: RbacRole }>(
        '/api/rbac/roles',
        payload,
        'Gagal membuat role baru.'
      );
    },
    updateRole(payload: UpdateRbacRolePayload) {
      return jsonPatch<StateResponse & { role?: RbacRole }>(
        `/api/rbac/roles/${payload.roleId}`,
        {
          name: payload.name,
          description: payload.description,
          permissions: payload.permissions,
        },
        'Gagal memperbarui role & permission.'
      );
    },
    deleteRole(roleId: string) {
      return jsonDelete<StateResponse>(
        `/api/rbac/roles/${roleId}`,
        'Gagal menghapus role.'
      );
    },
    createUser(payload: CreateUserAccountPayload) {
      return jsonPost<StateResponse & { user?: AuthUserPublic }>(
        '/api/rbac/users',
        payload,
        'Gagal menambah akun pengguna.'
      );
    },
    updateUser(payload: UpdateUserAccountPayload) {
      return jsonPatch<StateResponse & { user?: AuthUserPublic }>(
        `/api/rbac/users/${payload.userId}`,
        {
          name: payload.name,
          roleId: payload.roleId,
          active: payload.active,
          newPassword: payload.newPassword,
        },
        'Gagal memperbarui akun pengguna.'
      );
    },
    revokeSession(sessionId: string) {
      return jsonPost<StateResponse>(
        `/api/rbac/sessions/${sessionId}/revoke`,
        {},
        'Gagal mencabut sesi aktif.'
      );
    },
    updateSecurityPolicy(payload: UpdateSecurityPolicyPayload) {
      return jsonPatch<StateResponse & { securityPolicy?: AuthSecurityPolicy }>(
        '/api/rbac/security-policy',
        payload,
        'Gagal memperbarui kebijakan keamanan.'
      );
    },
  },

  fetchInitialState(): Promise<AppStateSnapshot> {
    return requestJson<AppStateSnapshot>(
      '/api/state',
      undefined,
      'Gagal memuat data server.'
    );
  },

  uploadReceiptImage(payload: {
    filename: string;
    mimeType: string;
    dataBase64: string;
  }): Promise<{ url: string; name: string }> {
    return jsonPost<{ url: string; name: string }>(
      '/api/uploads',
      payload,
      'Gagal mengunggah foto nota.'
    );
  },

  requests: {
    create(payload: CreateRequestPayload) {
      return jsonPost<StateResponse & { request?: PettyCashRequest }>(
        '/api/requests',
        payload,
        'Gagal membuat pengajuan.'
      );
    },
    decide(payload: DecideRequestPayload) {
      return jsonPost<StateResponse & { request?: PettyCashRequest }>(
        `/api/requests/${payload.requestId}/decision`,
        {
          decision: payload.decision,
          note: payload.note,
        },
        'Gagal memproses keputusan.'
      );
    },
  },

  departments: {
    topUp(payload: TopUpPayload) {
      return jsonPost<StateResponse>(
        `/api/departments/${payload.departmentId}/topup`,
        {
          amount: payload.amount,
          note: payload.note,
        },
        'Gagal mengisi saldo.'
      );
    },
    createOpname(payload: CreateOpnamePayload) {
      return jsonPost<StateResponse & { opname?: CashOpnameRecord }>(
        '/api/opname',
        payload,
        'Gagal menyimpan berita acara opname.'
      );
    },
  },

  master: {
    createDepartment(payload: CreateDepartmentPayload) {
      return jsonPost<StateResponse & { department?: Department }>(
        '/api/departments',
        payload,
        'Gagal menambah divisi.'
      );
    },
    updateDepartment(payload: UpdateDepartmentPayload) {
      return jsonPatch<StateResponse & { department?: Department }>(
        `/api/departments/${payload.departmentId}`,
        payload,
        'Gagal mengubah divisi.'
      );
    },
    createEmployee(payload: CreateEmployeePayload) {
      return jsonPost<StateResponse & { employee?: MasterEmployee }>(
        '/api/master/employees',
        payload,
        'Gagal menambah karyawan.'
      );
    },
    updateEmployee(payload: UpdateEmployeePayload) {
      return jsonPatch<StateResponse & { employee?: MasterEmployee }>(
        `/api/master/employees/${payload.employeeId}`,
        payload,
        'Gagal mengubah karyawan.'
      );
    },
    createCategory(payload: CreateCategoryPayload) {
      return jsonPost<StateResponse & { category?: MasterCategory }>(
        '/api/master/categories',
        payload,
        'Gagal menambah kategori.'
      );
    },
    updateCategory(payload: UpdateCategoryPayload) {
      return jsonPatch<StateResponse & { category?: MasterCategory }>(
        `/api/master/categories/${payload.categoryId}`,
        payload,
        'Gagal mengubah kategori.'
      );
    },
    createVehicle(payload: CreateVehiclePayload) {
      return jsonPost<StateResponse & { vehicle?: MasterVehicle }>(
        '/api/master/vehicles',
        payload,
        'Gagal menambah armada.'
      );
    },
    updateVehicle(payload: UpdateVehiclePayload) {
      return jsonPatch<StateResponse & { vehicle?: MasterVehicle }>(
        `/api/master/vehicles/${payload.vehicleId}`,
        payload,
        'Gagal mengubah armada.'
      );
    },
  },

  modules: {
    updateForecast(payload: UpdateForecastModulePayload) {
      return jsonPatch<StateResponse & { forecastModule?: ForecastModuleConfig }>(
        '/api/modules/forecast',
        payload,
        'Gagal memperbarui modul forecast.'
      );
    },
    updateFraudGuard(payload: UpdateFraudGuardPayload) {
      return jsonPatch<StateResponse & { fraudGuard?: FraudGuardConfig }>(
        '/api/modules/fraud-guard',
        payload,
        'Gagal memperbarui guard anti-fraud.'
      );
    },
    updateTax(payload: UpdateTaxModulePayload) {
      return jsonPatch<StateResponse & { taxModule?: TaxModuleConfig }>(
        '/api/modules/tax',
        payload,
        'Gagal memperbarui modul pajak.'
      );
    },
    updateWhatsApp(payload: UpdateWhatsAppModulePayload) {
      return jsonPatch<StateResponse & { whatsappModule?: WhatsAppModuleConfig }>(
        '/api/modules/whatsapp',
        payload,
        'Gagal memperbarui modul WhatsApp.'
      );
    },
    dispatchWhatsApp(payload: DispatchWhatsAppPayload) {
      return jsonPost<StateResponse & { log?: WhatsAppDispatchLog }>(
        '/api/whatsapp/dispatch',
        payload,
        'Gagal mencatat notifikasi WhatsApp.'
      );
    },
  },

  downPayments: {
    create(payload: CreateDownPaymentPayload) {
      return jsonPost<StateResponse & { downPayment?: DownPaymentRecord }>(
        '/api/down-payments',
        payload,
        'Gagal mengajukan kasbon.'
      );
    },
    decide(payload: DecideDownPaymentPayload) {
      return jsonPost<StateResponse & { downPayment?: DownPaymentRecord }>(
        `/api/down-payments/${payload.dpId}/decision`,
        {
          decision: payload.decision,
          note: payload.note,
        },
        'Gagal memproses keputusan kasbon.'
      );
    },
    settle(payload: SettleDownPaymentPayload) {
      return jsonPost<StateResponse & { downPayment?: DownPaymentRecord }>(
        `/api/down-payments/${payload.dpId}/settle`,
        {
          actualAmount: payload.actualAmount,
          receiptRef: payload.receiptRef,
          receiptImageUrl: payload.receiptImageUrl,
          receiptImageName: payload.receiptImageName,
          note: payload.note,
        },
        'Gagal menyimpan realisasi struk kasbon.'
      );
    },
  },

  closings: {
    createDaily(payload: CreateDailyClosingPayload) {
      return jsonPost<StateResponse & { closing?: DailyClosingRecord }>(
        '/api/closings/daily',
        payload,
        'Gagal menyimpan tutup kas harian.'
      );
    },
    closePeriod(payload: ClosePeriodPayload) {
      return jsonPost<StateResponse & { period?: ClosedPeriodRecord }>(
        '/api/closings/periods',
        payload,
        'Gagal mengunci periode bulanan.'
      );
    },
    reopenPeriod(payload: ReopenPeriodPayload) {
      return jsonPost<StateResponse>(
        `/api/closings/periods/${payload.monthKey}/reopen`,
        {},
        'Gagal membuka kembali periode.'
      );
    },
  },

  activityLogs: {
    fetch() {
      return requestJson<{
        activityLogs: ActivityLogEntry[];
        integrity: ActivityLogIntegrityReport;
      }>('/api/activity-logs', undefined, 'Gagal memuat log aktivitas audit.');
    },
  },
};
