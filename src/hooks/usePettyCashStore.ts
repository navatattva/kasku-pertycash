import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppStateSnapshot, PermissionKey, RbacRole } from '../types/pettycash.ts';
import {
  calculateDepartmentMetrics,
  hasPermission,
} from '../utils/pettycashLogic.ts';
import {
  ApiError,
  authorizedFetch,
  pettycashApi,
  type ClosePeriodPayload,
  type CreateCategoryPayload,
  type CreateDailyClosingPayload,
  type CreateDepartmentPayload,
  type CreateDownPaymentPayload,
  type CreateEmployeePayload,
  type CreateOpnamePayload,
  type CreateRbacRolePayload,
  type CreateRequestPayload,
  type CreateUserAccountPayload,
  type CreateVehiclePayload,
  type DecideDownPaymentPayload,
  type DecideRequestPayload,
  type DispatchWhatsAppPayload,
  type ReopenPeriodPayload,
  type SettleDownPaymentPayload,
  type StateResponse,
  type TopUpPayload,
  type UpdateCategoryPayload,
  type UpdateDepartmentPayload,
  type UpdateEmployeePayload,
  type UpdateForecastModulePayload,
  type UpdateFraudGuardPayload,
  type UpdateRbacRolePayload,
  type UpdateSecurityPolicyPayload,
  type UpdateTaxModulePayload,
  type UpdateUserAccountPayload,
  type UpdateVehiclePayload,
  type UpdateWhatsAppModulePayload,
} from '../api/pettycashApi.ts';
import type { NavTab } from '../components/Sidebar.tsx';

export type ActionResult = { ok: boolean; error?: string };

interface UsePettyCashStoreOptions {
  isAuthenticated: boolean;
  accessToken: string | null;
  userPermissions: readonly PermissionKey[];
  activeTab: NavTab;
  onRedirectToModules: () => void;
  onSyncRoles?: (roles: RbacRole[]) => void;
  onSessionRevoked?: (reason: string) => void;
}

export function usePettyCashStore({
  isAuthenticated,
  accessToken,
  userPermissions,
  activeTab,
  onRedirectToModules,
  onSyncRoles,
  onSessionRevoked,
}: UsePettyCashStoreOptions) {
  const [state, setState] = useState<AppStateSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sseConnected, setSseConnected] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const authActiveRef = useRef(isAuthenticated && Boolean(accessToken));
  const prevAuthRef = useRef(false);
  authActiveRef.current = isAuthenticated && Boolean(accessToken);

  const fetchInitialState = useCallback(async () => {
    if (!isAuthenticated) {
      setState(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setLoadError('');
      const data = await pettycashApi.fetchInitialState();
      if (!authActiveRef.current) return;
      setState(data);
      if (data.rbacRoles) {
        onSyncRoles?.(data.rbacRoles);
      }
    } catch (err) {
      if (!authActiveRef.current) return;
      setLoadError(
        err instanceof Error
          ? `Gagal memuat data server: ${err.message}`
          : 'Gagal memuat data server.'
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, onSyncRoles]);

  useEffect(() => {
    const nowAuthed = Boolean(isAuthenticated && accessToken);
    if (!nowAuthed) {
      prevAuthRef.current = false;
      setState(null);
      setSseConnected(false);
      setLoading(false);
      setToast(null);
      setLoadError('');
      return;
    }
    if (!prevAuthRef.current) {
      prevAuthRef.current = true;
      setToast(null);
      setLoadError('');
    }

    fetchInitialState();

    const controller = new AbortController();
    let active = true;

    async function connectAuthenticatedSse() {
      try {
        const res = await authorizedFetch('/api/stream', {
          signal: controller.signal,
          headers: { Accept: 'text/event-stream' },
        });
        if (!res.ok || !res.body) {
          if (active) setSseConnected(false);
          return;
        }
        if (active) setSseConnected(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (active) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() ?? '';

          for (const block of blocks) {
            if (!block.trim() || block.startsWith(':')) continue;
            let eventName = 'message';
            const dataLines: string[] = [];
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim());
              }
            }
            const rawData = dataLines.join('\n');
            if (!rawData) continue;
            try {
              if (eventName === 'snapshot') {
                const nextState = JSON.parse(rawData) as AppStateSnapshot;
                setState(nextState);
                setLoading(false);
                setSseConnected(true);
                if (nextState.rbacRoles) {
                  onSyncRoles?.(nextState.rbacRoles);
                }
              } else if (eventName === 'session_revoked') {
                const payload = JSON.parse(rawData) as { reason?: string };
                onSessionRevoked?.(
                  payload.reason === 'SESSION_EXPIRED'
                    ? 'Sesi Anda telah berakhir otomatis. Silakan login kembali.'
                    : 'Sesi Anda telah diakhiri oleh administrator atau login ulang.'
                );
                return;
              }
            } catch {
              // Ignore malformed event chunk
            }
          }
        }
      } catch {
        // Ignore abort errors on unmount / token refresh
      } finally {
        if (active) setSseConnected(false);
      }
    }

    connectAuthenticatedSse();

    return () => {
      active = false;
      controller.abort();
      setSseConnected(false);
    };
  }, [
    isAuthenticated,
    accessToken,
    fetchInitialState,
    onSyncRoles,
    onSessionRevoked,
  ]);

  const currentMonthKey = useMemo(() => {
    const refIso = state?.serverTime || new Date().toISOString();
    return refIso.slice(0, 7);
  }, [state?.serverTime]);

  const departmentMetrics = useMemo(() => {
    if (!state) return [];
    const dps = state.downPayments ?? [];
    return state.departments.map((dept) =>
      calculateDepartmentMetrics(dept, state.requests, currentMonthKey, dps)
    );
  }, [state, currentMonthKey]);

  const pendingCounts = useMemo(() => {
    if (!state) return { total: 0, forRole: 0 };
    const pending = state.requests.filter(
      (r) => r.status === 'pending_director'
    );
    const canDecide = hasPermission(userPermissions, 'requests:decide');
    return { total: pending.length, forRole: canDecide ? pending.length : 0 };
  }, [state, userPermissions]);

  const activeKasbonCount = useMemo(() => {
    if (!state) return 0;
    return (state.downPayments ?? []).filter(
      (dp) => dp.status === 'open' || dp.status === 'pending_director'
    ).length;
  }, [state]);

  const executeMutation = useCallback(
    async <T extends StateResponse>(
      requestFn: () => Promise<T>,
      getSuccessToast: (data: T) => string,
      afterSuccess?: (data: T) => void
    ): Promise<ActionResult> => {
      try {
        const data = await requestFn();
        if (!authActiveRef.current) {
          return { ok: true };
        }
        if (data.state) {
          setState(data.state);
          if (data.state.rbacRoles) {
            onSyncRoles?.(data.state.rbacRoles);
          }
        }
        setToast({ message: getSuccessToast(data) });
        afterSuccess?.(data);
        return { ok: true };
      } catch (err) {
        if (err instanceof ApiError) {
          return { ok: false, error: err.message };
        }
        return { ok: false, error: 'Koneksi ke server terputus.' };
      }
    },
    [onSyncRoles]
  );

  const actions = useMemo(
    () => ({
      createRequest: (payload: CreateRequestPayload) =>
        executeMutation(
          () => pettycashApi.requests.create(payload),
          (data) =>
            `Pengajuan ${data.request?.requestNumber} berhasil dikirim untuk persetujuan.`
        ),

      decideRequest: (payload: DecideRequestPayload) =>
        executeMutation(
          () => pettycashApi.requests.decide(payload),
          (data) =>
            payload.decision === 'approve'
              ? `Pengajuan ${data.request?.requestNumber} disetujui & saldo otomatis terpotong.`
              : `Pengajuan ${data.request?.requestNumber} telah ditolak.`
        ),

      topUpDepartment: (payload: TopUpPayload) =>
        executeMutation(
          () => pettycashApi.departments.topUp(payload),
          () => 'Saldo divisi berhasil ditambahkan secara real-time.'
        ),

      createDepartment: (payload: CreateDepartmentPayload) =>
        executeMutation(
          () => pettycashApi.master.createDepartment(payload),
          () => 'Divisi baru berhasil ditambahkan ke Data Master.'
        ),

      updateDepartment: (payload: UpdateDepartmentPayload) =>
        executeMutation(
          () => pettycashApi.master.updateDepartment(payload),
          () => 'Data divisi berhasil diperbarui.'
        ),

      createEmployee: (payload: CreateEmployeePayload) =>
        executeMutation(
          () => pettycashApi.master.createEmployee(payload),
          () => 'Data karyawan baru berhasil disimpan.'
        ),

      updateEmployee: (payload: UpdateEmployeePayload) =>
        executeMutation(
          () => pettycashApi.master.updateEmployee(payload),
          () => 'Data karyawan berhasil diperbarui.'
        ),

      createCategory: (payload: CreateCategoryPayload) =>
        executeMutation(
          () => pettycashApi.master.createCategory(payload),
          () => 'Kategori biaya baru berhasil ditambahkan.'
        ),

      updateCategory: (payload: UpdateCategoryPayload) =>
        executeMutation(
          () => pettycashApi.master.updateCategory(payload),
          () => 'Data kategori biaya berhasil diperbarui.'
        ),

      createVehicle: (payload: CreateVehiclePayload) =>
        executeMutation(
          () => pettycashApi.master.createVehicle(payload),
          () => 'Unit armada baru berhasil ditambahkan.'
        ),

      updateVehicle: (payload: UpdateVehiclePayload) =>
        executeMutation(
          () => pettycashApi.master.updateVehicle(payload),
          () => 'Data armada berhasil diperbarui.'
        ),

      updateForecastModule: (payload: UpdateForecastModulePayload) =>
        executeMutation(
          () => pettycashApi.modules.updateForecast(payload),
          (data) =>
            typeof payload.enabled === 'boolean'
              ? data.forecastModule?.enabled
                ? 'Modul Forecast & Cold-Start Kas diaktifkan dan tampil di sidebar.'
                : 'Modul Forecast Kas dinonaktifkan.'
              : 'Parameter default Forecast & Cold-Start berhasil disimpan.',
          (data) => {
            if (
              typeof payload.enabled === 'boolean' &&
              !data.forecastModule?.enabled &&
              activeTab === 'forecast'
            ) {
              onRedirectToModules();
            }
          }
        ),

      updateFraudGuard: (payload: UpdateFraudGuardPayload) =>
        executeMutation(
          () => pettycashApi.modules.updateFraudGuard(payload),
          (data) =>
            typeof payload.enabled === 'boolean'
              ? data.fraudGuard?.enabled
                ? 'Guard Anti-Fraud & Anti-Korupsi diaktifkan dan tampil di sidebar.'
                : 'Guard Anti-Fraud dinonaktifkan.'
              : 'Konfigurasi aturan Guard Anti-Fraud berhasil diperbarui.',
          (data) => {
            if (
              typeof payload.enabled === 'boolean' &&
              !data.fraudGuard?.enabled &&
              activeTab === 'fraud-guard'
            ) {
              onRedirectToModules();
            }
          }
        ),

      updateTaxModule: (payload: UpdateTaxModulePayload) =>
        executeMutation(
          () => pettycashApi.modules.updateTax(payload),
          (data) =>
            typeof payload.enabled === 'boolean'
              ? data.taxModule?.enabled
                ? 'Modul Pajak Indonesia diaktifkan dan tampil di sidebar.'
                : 'Modul Pajak Indonesia dinonaktifkan.'
              : 'Pengaturan skema pajak modul berhasil disimpan.',
          (data) => {
            if (
              typeof payload.enabled === 'boolean' &&
              !data.taxModule?.enabled &&
              activeTab === 'tax'
            ) {
              onRedirectToModules();
            }
          }
        ),

      updateWhatsAppModule: (payload: UpdateWhatsAppModulePayload) =>
        executeMutation(
          () => pettycashApi.modules.updateWhatsApp(payload),
          (data) =>
            typeof payload.enabled === 'boolean'
              ? data.whatsappModule?.enabled
                ? 'Modul Notifikasi WhatsApp diaktifkan dan tampil di sidebar.'
                : 'Modul Notifikasi WhatsApp dinonaktifkan.'
              : 'Pengaturan modul WhatsApp Direktur berhasil disimpan.',
          (data) => {
            if (
              typeof payload.enabled === 'boolean' &&
              !data.whatsappModule?.enabled &&
              activeTab === 'whatsapp'
            ) {
              onRedirectToModules();
            }
          }
        ),

      dispatchWhatsApp: (payload: DispatchWhatsAppPayload) =>
        executeMutation(
          () => pettycashApi.modules.dispatchWhatsApp(payload),
          () =>
            `Log notifikasi WhatsApp (${payload.referenceNumber}) berhasil dicatat.`
        ),

      createOpname: (payload: CreateOpnamePayload) =>
        executeMutation(
          () => pettycashApi.departments.createOpname(payload),
          (data) =>
            `Berita acara Cash Opname ${data.opname?.opnameNumber} berhasil dicatat.`
        ),

      createDownPayment: (payload: CreateDownPaymentPayload) =>
        executeMutation(
          () => pettycashApi.downPayments.create(payload),
          (data) =>
            `Kasbon ${data.downPayment?.dpNumber} berhasil dikirim untuk persetujuan.`
        ),

      decideDownPayment: (payload: DecideDownPaymentPayload) =>
        executeMutation(
          () => pettycashApi.downPayments.decide(payload),
          (data) =>
            payload.decision === 'approve'
              ? `Kasbon ${data.downPayment?.dpNumber} disetujui & uang muka dicairkan.`
              : `Kasbon ${data.downPayment?.dpNumber} ditolak.`
        ),

      settleDownPayment: (payload: SettleDownPaymentPayload) =>
        executeMutation(
          () => pettycashApi.downPayments.settle(payload),
          (data) =>
            `Realisasi struk kasbon ${data.downPayment?.dpNumber} selesai & saldo divisi disesuaikan otomatis.`
        ),

      createDailyClosing: (payload: CreateDailyClosingPayload) =>
        executeMutation(
          () => pettycashApi.closings.createDaily(payload),
          (data) =>
            `Berita acara Tutup Kas Harian ${data.closing?.closingNumber ?? ''} berhasil disimpan.`
        ),

      closePeriod: (payload: ClosePeriodPayload) =>
        executeMutation(
          () => pettycashApi.closings.closePeriod(payload),
          () => `Periode ${payload.monthKey} resmi dikunci (Tutup Buku).`
        ),

      reopenPeriod: (payload: ReopenPeriodPayload) =>
        executeMutation(
          () => pettycashApi.closings.reopenPeriod(payload),
          () => `Kunci periode ${payload.monthKey} berhasil dibuka kembali.`
        ),

      createRbacRole: (payload: CreateRbacRolePayload) =>
        executeMutation(
          () => pettycashApi.rbac.createRole(payload),
          (data) =>
            `Role RBAC "${data.role?.name ?? payload.name}" berhasil dibuat.`
        ),

      updateRbacRole: (payload: UpdateRbacRolePayload) =>
        executeMutation(
          () => pettycashApi.rbac.updateRole(payload),
          (data) =>
            `Matriks izin role "${data.role?.name ?? payload.name}" diperbarui.`
        ),

      deleteRbacRole: (roleId: string, roleName: string) =>
        executeMutation(
          () => pettycashApi.rbac.deleteRole(roleId),
          () => `Role RBAC "${roleName}" berhasil dihapus.`
        ),

      createUserAccount: (payload: CreateUserAccountPayload) =>
        executeMutation(
          () => pettycashApi.rbac.createUser(payload),
          (data) =>
            `Akun pengguna ${data.user?.email ?? payload.email} berhasil dibuat.`
        ),

      updateUserAccount: (payload: UpdateUserAccountPayload) =>
        executeMutation(
          () => pettycashApi.rbac.updateUser(payload),
          (data) =>
            `Data & role akun ${data.user?.name ?? ''} berhasil diperbarui.`
        ),

      revokeSession: (sessionId: string) =>
        executeMutation(
          () => pettycashApi.rbac.revokeSession(sessionId),
          () => 'Sesi login aktif berhasil dicabut paksa.'
        ),

      updateSecurityPolicy: (payload: UpdateSecurityPolicyPayload) =>
        executeMutation(
          () => pettycashApi.rbac.updateSecurityPolicy(payload),
          () => 'Kebijakan keamanan, TTL token & rate limiter disimpan.'
        ),
    }),
    [activeTab, executeMutation, onRedirectToModules]
  );

  return {
    state,
    loading,
    loadError,
    sseConnected,
    toast,
    clearToast: useCallback(() => setToast(null), []),
    fetchInitialState,
    currentMonthKey,
    departmentMetrics,
    pendingCounts,
    activeKasbonCount,
    actions,
  };
}
