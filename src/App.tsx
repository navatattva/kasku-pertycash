import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Plus, CheckCircle2, X } from 'lucide-react';
import type {
  ActivityLogIntegrityReport,
  Department,
  FraudGuardConfig,
  PettyCashRequest,
  TaxModuleConfig,
} from './types/pettycash.ts';
import { useAuthSession } from './hooks/useAuthSession.ts';
import { usePettyCashStore } from './hooks/usePettyCashStore.ts';
import {
  canAccessTab,
  getFirstPermittedTab,
  hasPermission,
} from './utils/pettycashLogic.ts';
import { AuthScreen } from './components/AuthScreen.tsx';
import { Sidebar, type NavTab } from './components/Sidebar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ApprovalsView } from './components/ApprovalsView.tsx';
import { DownPaymentsView } from './components/DownPaymentsView.tsx';
import { DepartmentsView } from './components/DepartmentsView.tsx';
import { ClosingView } from './components/ClosingView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { ActivityLogView } from './components/ActivityLogView.tsx';
import { MasterDataView } from './components/MasterDataView.tsx';
import { ModulesView } from './components/ModulesView.tsx';
import { RbacManagementView } from './components/RbacManagementView.tsx';
import { WikiView } from './components/WikiView.tsx';
import { ForecastView } from './components/ForecastView.tsx';
import { TaxModuleView } from './components/TaxModuleView.tsx';
import { FraudGuardView } from './components/FraudGuardView.tsx';
import { WhatsAppView } from './components/WhatsAppView.tsx';
import {
  DecisionModal,
  NewRequestModal,
  ReceiptPreviewModal,
  TopUpModal,
} from './components/ActionModals.tsx';

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'Dashboard Real-Time',
  approvals: 'Approval Direktur',
  'down-payments': 'Kasbon & Realisasi Struk',
  departments: 'Saldo & Anggaran Divisi',
  closing: 'Tutup Kas Harian & Kunci Periode',
  reports: 'Laporan Pengeluaran Bulanan',
  'activity-log': 'Log Aktivitas & Audit Persetujuan',
  master: 'Data Master Operasional',
  modules: 'Pusat Modul',
  rbac: 'Role, Permission & Aksi',
  wiki: 'Panduan & Wiki Fitur',
  'fraud-guard': 'Guard Anti-Fraud',
  forecast: 'Forecast & Ketahanan Kas',
  tax: 'Pajak Indonesia',
  whatsapp: 'Notifikasi WhatsApp',
};

const DEFAULT_TAX_MODULE: TaxModuleConfig = {
  enabled: false,
  enablePpn: true,
  enablePph23: true,
  enablePph21: true,
  updatedAt: '',
};

const DEFAULT_FRAUD_GUARD: FraudGuardConfig = {
  enabled: true,
  requireReceiptImage: true,
  receiptRequiredMinAmount: 0,
  blockDuplicateReceiptRef: true,
  preventSelfApproval: true,
  detectDuplicateClaimWindowHours: 48,
  highValueAlertAmount: 1_500_000,
  maxSingleRequestAmount: 3_000_000,
  updatedAt: '',
};

const DEFAULT_ACTIVITY_INTEGRITY: ActivityLogIntegrityReport = {
  valid: true,
  totalEntries: 0,
  lastSequence: 0,
  lastHash: 'GENESIS',
  verifiedAt: '',
  issues: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [newReqModalOpen, setNewReqModalOpen] = useState(false);
  const [topUpDept, setTopUpDept] = useState<Department | null>(null);
  const [previewReceiptReq, setPreviewReceiptReq] =
    useState<PettyCashRequest | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{
    request: PettyCashRequest;
    decision: 'approve' | 'reject';
  } | null>(null);

  const lastSyncedTabRef = useRef<string>('');

  const handleLoginSuccessRestoreTab = useCallback(
    (lastVisitedTab: string, permissions: Parameters<typeof getFirstPermittedTab>[0]) => {
      const target = getFirstPermittedTab(permissions, lastVisitedTab as NavTab);
      lastSyncedTabRef.current = target;
      setActiveTab(target);
      setNewReqModalOpen(false);
      setTopUpDept(null);
      setPreviewReceiptReq(null);
      setDecisionTarget(null);
    },
    []
  );

  const {
    checkingStatus,
    authStatus,
    statusError,
    reloadAuthStatus,
    sessionBundle,
    isAuthenticated,
    expiredNotice,
    remainingAccessSeconds,
    remainingSessionSeconds,
    isRefreshing,
    bootstrapAdmin,
    login,
    refreshNow,
    logout,
    syncLastVisitedTab,
    syncLiveRolesFromSnapshot,
  } = useAuthSession({
    onLoginSuccessRestoreTab: handleLoginSuccessRestoreTab,
  });

  const currentUser = sessionBundle?.user ?? null;
  const currentRole = sessionBundle?.role ?? null;
  const userPermissions = sessionBundle?.permissions ?? [];

  const handleRedirectToModules = useCallback(() => {
    setActiveTab(getFirstPermittedTab(userPermissions, 'modules'));
  }, [userPermissions]);

  const handleSessionRevoked = useCallback(
    (reason: string) => {
      logout('expired', reason, true);
    },
    [logout]
  );

  const {
    state,
    loading,
    loadError,
    sseConnected,
    toast,
    clearToast,
    fetchInitialState,
    currentMonthKey,
    departmentMetrics,
    pendingCounts,
    activeKasbonCount,
    actions,
  } = usePettyCashStore({
    isAuthenticated,
    accessToken: sessionBundle?.accessToken ?? null,
    userPermissions,
    activeTab,
    onRedirectToModules: handleRedirectToModules,
    onSyncRoles: syncLiveRolesFromSnapshot,
    onSessionRevoked: handleSessionRevoked,
  });

  // Reset transient modals on logout / session expiry
  useEffect(() => {
    if (!isAuthenticated) {
      setNewReqModalOpen(false);
      setTopUpDept(null);
      setPreviewReceiptReq(null);
      setDecisionTarget(null);
      setMobileMenuOpen(false);
    }
  }, [isAuthenticated]);

  // Keep activeTab valid against live RBAC permissions & enabled optional modules
  useEffect(() => {
    if (!isAuthenticated || !state) return;
    const validTab = getFirstPermittedTab(userPermissions, activeTab, {
      fraudGuard: state.fraudGuard.enabled,
      forecastModule: state.forecastModule.enabled,
      taxModule: state.taxModule.enabled,
      whatsappModule: state.whatsappModule.enabled,
    });
    if (validTab !== activeTab) {
      setActiveTab(validTab);
    }
  }, [isAuthenticated, state, userPermissions, activeTab]);

  // Persist user's last visited tab to server whenever it changes post-login
  useEffect(() => {
    if (!isAuthenticated || !state) return;
    if (lastSyncedTabRef.current === activeTab) return;
    lastSyncedTabRef.current = activeTab;
    syncLastVisitedTab(activeTab);
  }, [isAuthenticated, state, activeTab, syncLastVisitedTab]);

  const handleSelectTab = useCallback(
    (nextTab: NavTab) => {
      const moduleFlags = state
        ? {
            fraudGuard: state.fraudGuard.enabled,
            forecastModule: state.forecastModule.enabled,
            taxModule: state.taxModule.enabled,
            whatsappModule: state.whatsappModule.enabled,
          }
        : undefined;
      const safeTab = getFirstPermittedTab(
        userPermissions,
        nextTab,
        moduleFlags
      );
      setActiveTab(safeTab);
    },
    [state, userPermissions]
  );

  if (!isAuthenticated || !currentUser || !currentRole) {
    return (
      <AuthScreen
        authStatus={authStatus}
        checkingStatus={checkingStatus}
        statusError={statusError}
        expiredNotice={expiredNotice}
        onRetryStatus={reloadAuthStatus}
        onLogin={login}
        onBootstrap={bootstrapAdmin}
      />
    );
  }

  const canCreateRequest = hasPermission(userPermissions, 'requests:create');
  const canDecideRequest = hasPermission(userPermissions, 'requests:decide');
  const canTopUp = hasPermission(userPermissions, 'departments:topup');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        currentUser={currentUser}
        currentRole={currentRole}
        userPermissions={userPermissions}
        remainingSessionSeconds={remainingSessionSeconds}
        isRefreshingSession={isRefreshing}
        onRefreshSession={() => {
          void refreshNow();
        }}
        onLogout={() => {
          void logout('manual');
        }}
        pendingForRoleCount={pendingCounts.forRole}
        totalPendingCount={pendingCounts.total}
        activeKasbonCount={activeKasbonCount}
        taxModuleEnabled={state?.taxModule.enabled ?? false}
        forecastModuleEnabled={state?.forecastModule?.enabled ?? false}
        fraudGuardEnabled={state?.fraudGuard?.enabled ?? true}
        whatsappModuleEnabled={state?.whatsappModule?.enabled ?? false}
        sseConnected={sseConnected}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 Primary CTA on right */}
        <header className="sticky top-0 z-10 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sm:gap-8">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 whitespace-nowrap">
                KasKu Kargo
              </span>
              <span
                aria-hidden="true"
                className="hidden sm:inline text-slate-300"
              >
                /
              </span>
              <h1 className="font-display text-sm sm:text-base font-semibold text-slate-900 truncate">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          {canCreateRequest && (
            <button
              type="button"
              onClick={() => setNewReqModalOpen(true)}
              aria-label="Ajukan Petty Cash"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 sm:px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="sm:hidden">Ajukan</span>
              <span className="hidden sm:inline">Ajukan Petty Cash</span>
            </button>
          )}
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {toast && (
            <div
              role="status"
              className="no-print mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <span className="font-medium">{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={clearToast}
                aria-label="Tutup pemberitahuan"
                className="text-emerald-700 hover:text-emerald-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-6" aria-busy="true">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-xl border border-slate-200 bg-white p-5 animate-pulse"
                  />
                ))}
              </div>
              <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
            </div>
          ) : loadError || !state ? (
            <div className="rounded-xl border border-rose-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-rose-700">
                {loadError || 'Data tidak tersedia.'}
              </p>
              <button
                type="button"
                onClick={fetchInitialState}
                className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Muat Ulang Data
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' &&
                canAccessTab(userPermissions, 'dashboard') && (
                  <DashboardView
                    metrics={departmentMetrics}
                    requests={state.requests}
                    downPayments={state.downPayments ?? []}
                    departments={state.departments}
                    categories={state.categories}
                    opnames={state.opnames ?? []}
                    fraudGuard={state.fraudGuard}
                    forecastModuleEnabled={state.forecastModule.enabled}
                    userPermissions={userPermissions}
                    currentMonthKey={currentMonthKey}
                    onOpenNewRequest={() => setNewReqModalOpen(true)}
                    onOpenTopUp={(dept) => setTopUpDept(dept)}
                    onNavigateApprovals={() => handleSelectTab('approvals')}
                    onNavigateDownPayments={() =>
                      handleSelectTab('down-payments')
                    }
                    onNavigateDepartments={() => handleSelectTab('departments')}
                    onNavigateReports={() => handleSelectTab('reports')}
                    onNavigateModules={() => handleSelectTab('modules')}
                    onNavigateForecast={() => handleSelectTab('forecast')}
                    onQuickDecision={(request, decision) =>
                      setDecisionTarget({ request, decision })
                    }
                    onPreviewReceipt={(request) =>
                      setPreviewReceiptReq(request)
                    }
                  />
                )}

              {activeTab === 'approvals' &&
                canAccessTab(userPermissions, 'approvals') && (
                  <ApprovalsView
                    requests={state.requests}
                    departments={state.departments}
                    categories={state.categories}
                    fraudGuard={state.fraudGuard}
                    userPermissions={userPermissions}
                    currentRoleName={currentRole.name}
                    onDecision={(request, decision) =>
                      setDecisionTarget({ request, decision })
                    }
                    onOpenNewRequest={() => setNewReqModalOpen(true)}
                    onPreviewReceipt={(request) =>
                      setPreviewReceiptReq(request)
                    }
                  />
                )}

              {activeTab === 'down-payments' &&
                canAccessTab(userPermissions, 'down-payments') && (
                  <DownPaymentsView
                    downPayments={state.downPayments ?? []}
                    metrics={departmentMetrics}
                    employees={state.employees}
                    categories={state.categories}
                    vehicles={state.vehicles}
                    requests={state.requests}
                    closedPeriods={state.closedPeriods ?? []}
                    fraudGuard={state.fraudGuard}
                    userPermissions={userPermissions}
                    currentUser={currentUser}
                    currentRoleName={currentRole.name}
                    serverTime={state.serverTime}
                    onCreateDownPayment={actions.createDownPayment}
                    onDecideDownPayment={actions.decideDownPayment}
                    onSettleDownPayment={actions.settleDownPayment}
                  />
                )}

              {activeTab === 'departments' &&
                canAccessTab(userPermissions, 'departments') && (
                  <DepartmentsView
                    metrics={departmentMetrics}
                    requests={state.requests}
                    topUps={state.topUps}
                    opnames={state.opnames ?? []}
                    downPayments={state.downPayments ?? []}
                    userPermissions={userPermissions}
                    currentUser={currentUser}
                    currentRoleName={currentRole.name}
                    onOpenTopUp={(dept) => setTopUpDept(dept)}
                    onUpdateDepartment={actions.updateDepartment}
                    onCreateOpname={actions.createOpname}
                    onPreviewReceipt={(request) =>
                      setPreviewReceiptReq(request)
                    }
                  />
                )}

              {activeTab === 'closing' &&
                canAccessTab(userPermissions, 'closing') && (
                  <ClosingView
                    departments={state.departments}
                    requests={state.requests}
                    topUps={state.topUps}
                    opnames={state.opnames ?? []}
                    downPayments={state.downPayments ?? []}
                    dailyClosings={state.dailyClosings ?? []}
                    closedPeriods={state.closedPeriods ?? []}
                    userPermissions={userPermissions}
                    currentUser={currentUser}
                    currentRoleName={currentRole.name}
                    serverTime={state.serverTime}
                    onCreateDailyClosing={actions.createDailyClosing}
                    onClosePeriod={actions.closePeriod}
                    onReopenPeriod={actions.reopenPeriod}
                  />
                )}

              {activeTab === 'reports' &&
                canAccessTab(userPermissions, 'reports') && (
                  <ReportsView
                    departments={state.departments}
                    vehicles={state.vehicles}
                    requests={state.requests}
                    topUps={state.topUps}
                    downPayments={state.downPayments ?? []}
                    closedPeriods={state.closedPeriods ?? []}
                    defaultMonthKey={currentMonthKey}
                    taxModuleEnabled={state.taxModule.enabled}
                    userPermissions={userPermissions}
                    onPreviewReceipt={(request) =>
                      setPreviewReceiptReq(request)
                    }
                  />
                )}

              {activeTab === 'activity-log' &&
                canAccessTab(userPermissions, 'activity-log') && (
                  <ActivityLogView
                    activityLogs={state.activityLogs ?? []}
                    integrity={
                      state.activityLogIntegrity ?? DEFAULT_ACTIVITY_INTEGRITY
                    }
                    userPermissions={userPermissions}
                    roles={state.rbacRoles ?? []}
                  />
                )}

              {activeTab === 'forecast' &&
                canAccessTab(userPermissions, 'forecast') && (
                  <ForecastView
                    departments={state.departments}
                    requests={state.requests}
                    downPayments={state.downPayments ?? []}
                    forecastModule={state.forecastModule}
                    userPermissions={userPermissions}
                    referenceIso={state.serverTime}
                    currentMonthKey={currentMonthKey}
                    onOpenTopUp={(dept) => setTopUpDept(dept)}
                    onEnableForecastModule={() =>
                      actions.updateForecastModule({ enabled: true })
                    }
                    onNavigateModules={() => handleSelectTab('modules')}
                  />
                )}

              {activeTab === 'fraud-guard' &&
                canAccessTab(userPermissions, 'fraud-guard') && (
                  <FraudGuardView
                    fraudGuard={state.fraudGuard}
                    requests={state.requests}
                    departments={state.departments}
                    categories={state.categories}
                    userPermissions={userPermissions}
                    onUpdateFraudGuard={actions.updateFraudGuard}
                    onNavigateApprovals={() => handleSelectTab('approvals')}
                    onNavigateModules={() => handleSelectTab('modules')}
                  />
                )}

              {activeTab === 'tax' && canAccessTab(userPermissions, 'tax') && (
                <TaxModuleView
                  taxModule={state.taxModule}
                  departments={state.departments}
                  requests={state.requests}
                  currentMonthKey={currentMonthKey}
                  userPermissions={userPermissions}
                  onUpdateTaxModule={actions.updateTaxModule}
                  onNavigateModules={() => handleSelectTab('modules')}
                />
              )}

              {activeTab === 'whatsapp' &&
                canAccessTab(userPermissions, 'whatsapp') && (
                  <WhatsAppView
                    whatsappModule={state.whatsappModule}
                    whatsappLogs={state.whatsappLogs ?? []}
                    requests={state.requests}
                    metrics={departmentMetrics}
                    userPermissions={userPermissions}
                    onUpdateWhatsAppModule={actions.updateWhatsAppModule}
                    onDispatchWhatsApp={actions.dispatchWhatsApp}
                    onEnableModule={() =>
                      actions.updateWhatsAppModule({ enabled: true })
                    }
                    onNavigateModules={() => handleSelectTab('modules')}
                  />
                )}

              {activeTab === 'master' &&
                canAccessTab(userPermissions, 'master') && (
                  <MasterDataView
                    departments={state.departments}
                    employees={state.employees}
                    categories={state.categories}
                    vehicles={state.vehicles}
                    userPermissions={userPermissions}
                    onCreateDepartment={actions.createDepartment}
                    onUpdateDepartment={actions.updateDepartment}
                    onCreateEmployee={actions.createEmployee}
                    onUpdateEmployee={actions.updateEmployee}
                    onCreateCategory={actions.createCategory}
                    onUpdateCategory={actions.updateCategory}
                    onCreateVehicle={actions.createVehicle}
                    onUpdateVehicle={actions.updateVehicle}
                  />
                )}

              {activeTab === 'modules' &&
                canAccessTab(userPermissions, 'modules') && (
                  <ModulesView
                    taxModule={state.taxModule}
                    forecastModule={state.forecastModule}
                    fraudGuard={state.fraudGuard}
                    whatsappModule={state.whatsappModule}
                    userPermissions={userPermissions}
                    onUpdateTaxModule={actions.updateTaxModule}
                    onUpdateForecastModule={actions.updateForecastModule}
                    onUpdateFraudGuard={actions.updateFraudGuard}
                    onUpdateWhatsAppModule={actions.updateWhatsAppModule}
                    onNavigateTab={handleSelectTab}
                  />
                )}

              {activeTab === 'rbac' && canAccessTab(userPermissions, 'rbac') && (
                <RbacManagementView
                  currentUserId={currentUser.id}
                  userPermissions={userPermissions}
                  roles={state.rbacRoles ?? []}
                  users={state.authUsers ?? []}
                  sessions={state.authSessions ?? []}
                  securityPolicy={state.securityPolicy}
                  remainingAccessSeconds={remainingAccessSeconds}
                  remainingSessionSeconds={remainingSessionSeconds}
                  onRefreshTokenNow={refreshNow}
                  onCreateRole={actions.createRbacRole}
                  onUpdateRole={actions.updateRbacRole}
                  onDeleteRole={actions.deleteRbacRole}
                  onCreateUser={actions.createUserAccount}
                  onUpdateUser={actions.updateUserAccount}
                  onRevokeSession={actions.revokeSession}
                  onUpdateSecurityPolicy={actions.updateSecurityPolicy}
                />
              )}

              {activeTab === 'wiki' && (
                <WikiView
                  moduleStatus={{
                    fraudGuard: state.fraudGuard.enabled,
                    forecastModule: state.forecastModule.enabled,
                    taxModule: state.taxModule.enabled,
                    whatsappModule: state.whatsappModule.enabled,
                  }}
                  onNavigateTab={handleSelectTab}
                />
              )}
            </>
          )}
        </main>
      </div>

      {canCreateRequest && (
        <NewRequestModal
          open={newReqModalOpen}
          metrics={departmentMetrics}
          employees={state?.employees ?? []}
          categories={state?.categories ?? []}
          vehicles={state?.vehicles ?? []}
          existingRequests={state?.requests ?? []}
          taxModule={state?.taxModule ?? DEFAULT_TAX_MODULE}
          fraudGuard={state?.fraudGuard ?? DEFAULT_FRAUD_GUARD}
          onClose={() => setNewReqModalOpen(false)}
          onSubmit={actions.createRequest}
        />
      )}

      {canTopUp && (
        <TopUpModal
          key={topUpDept?.id ?? 'none'}
          department={topUpDept}
          currentUser={currentUser}
          currentRoleName={currentRole.name}
          onClose={() => setTopUpDept(null)}
          onSubmit={actions.topUpDepartment}
        />
      )}

      {canDecideRequest && (
        <DecisionModal
          key={`${decisionTarget?.request.id ?? 'none'}-${currentUser.id}-${decisionTarget?.decision ?? 'none'}`}
          target={decisionTarget}
          currentUser={currentUser}
          currentRoleName={currentRole.name}
          fraudGuard={state?.fraudGuard ?? DEFAULT_FRAUD_GUARD}
          existingRequests={state?.requests ?? []}
          categories={state?.categories ?? []}
          onClose={() => setDecisionTarget(null)}
          onConfirm={actions.decideRequest}
        />
      )}

      <ReceiptPreviewModal
        request={previewReceiptReq}
        onClose={() => setPreviewReceiptReq(null)}
      />
    </div>
  );
}
