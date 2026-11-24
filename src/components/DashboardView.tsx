import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Plus,
  ShieldAlert,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react';
import type {
  CashOpnameRecord,
  Department,
  DepartmentMetrics,
  DownPaymentRecord,
  FraudGuardConfig,
  MasterCategory,
  PermissionKey,
  PettyCashRequest,
} from '../types/pettycash.ts';
import { formatIDR, getStatusLabel } from '../utils/formatters.ts';
import {
  auditExistingRequestFraudSignals,
  calculateCashHealth,
  generateMonthlyReport,
  hasPermission,
} from '../utils/pettycashLogic.ts';
import { CashHealthGaugeCard } from './dashboard/CashHealthGaugeCard.tsx';
import { FraudControlSummaryCard } from './dashboard/FraudControlSummaryCard.tsx';

interface DashboardViewProps {
  metrics: DepartmentMetrics[];
  requests: PettyCashRequest[];
  downPayments?: DownPaymentRecord[];
  departments: Department[];
  categories: MasterCategory[];
  opnames: CashOpnameRecord[];
  fraudGuard: FraudGuardConfig;
  forecastModuleEnabled: boolean;
  userPermissions: readonly PermissionKey[];
  currentMonthKey: string;
  onOpenNewRequest: () => void;
  onOpenTopUp: (dept: Department) => void;
  onNavigateApprovals: () => void;
  onNavigateDownPayments?: () => void;
  onNavigateDepartments: () => void;
  onNavigateReports: () => void;
  onNavigateModules: () => void;
  onNavigateForecast: () => void;
  onQuickDecision: (
    request: PettyCashRequest,
    decision: 'approve' | 'reject'
  ) => void;
  onPreviewReceipt: (request: PettyCashRequest) => void;
}

export function DashboardView({
  metrics,
  requests,
  downPayments = [],
  departments,
  categories,
  opnames,
  fraudGuard,
  forecastModuleEnabled,
  userPermissions,
  currentMonthKey,
  onOpenNewRequest,
  onOpenTopUp,
  onNavigateApprovals,
  onNavigateDownPayments,
  onNavigateDepartments,
  onNavigateReports,
  onNavigateModules,
  onNavigateForecast,
  onQuickDecision,
  onPreviewReceipt,
}: DashboardViewProps) {
  const deptMap = new Map(departments.map((d) => [d.id, d]));

  const canCreateRequest = hasPermission(userPermissions, 'requests:create');
  const canDecideRequest = hasPermission(userPermissions, 'requests:decide');
  const canTopUp = hasPermission(userPermissions, 'departments:topup');

  const totalActualBalance = metrics.reduce(
    (sum, m) => sum + m.department.balance,
    0
  );
  const totalAvailableBalance = metrics.reduce(
    (sum, m) => sum + m.availableBalance,
    0
  );
  const totalPendingHold = metrics.reduce((sum, m) => sum + m.pendingHold, 0);
  const totalMonthSpent = metrics.reduce((sum, m) => sum + m.monthSpent, 0);
  const totalMonthBudget = metrics.reduce(
    (sum, m) => sum + m.department.monthlyBudget,
    0
  );
  const overallUtilizationPct =
    totalMonthBudget > 0
      ? Math.round((totalMonthSpent / totalMonthBudget) * 1000) / 10
      : 0;

  const pendingRequests = requests.filter(
    (r) => r.status === 'pending_director'
  );
  const criticalDeptsCount = metrics.filter(
    (m) => m.healthStatus !== 'normal'
  ).length;
  const openKasbonsCount = downPayments.filter(
    (dp) => dp.status === 'open' || dp.status === 'pending_director'
  ).length;

  const monthlySummary = generateMonthlyReport(
    currentMonthKey,
    departments,
    requests,
    [],
    undefined,
    [],
    downPayments
  );

  const cashHealth = useMemo(
    () => calculateCashHealth(metrics, opnames),
    [metrics, opnames]
  );

  const fraudAuditStats = useMemo(() => {
    const activeReqs = requests.filter((r) => r.status !== 'rejected');
    const withPhotoCount = activeReqs.filter((r) =>
      Boolean(r.receiptImageUrl)
    ).length;
    const pendingWithAlerts = pendingRequests.filter(
      (req) =>
        auditExistingRequestFraudSignals(req, fraudGuard, requests, categories)
          .length > 0
    );
    const activeRulesCount = fraudGuard.enabled
      ? [
          fraudGuard.requireReceiptImage,
          fraudGuard.blockDuplicateReceiptRef,
          fraudGuard.preventSelfApproval,
          fraudGuard.maxSingleRequestAmount > 0,
          fraudGuard.highValueAlertAmount > 0,
        ].filter(Boolean).length
      : 0;

    return {
      withPhotoCount,
      totalActiveCount: activeReqs.length,
      pendingAlertCount: pendingWithAlerts.length,
      activeRulesCount,
    };
  }, [requests, pendingRequests, fraudGuard, categories]);

  return (
    <div className="space-y-8">
      {/* KPI Summary Strip */}
      <section aria-label="Ringkasan Saldo Kas Kecil">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Total Saldo Tersedia</span>
              <Wallet className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatIDR(totalAvailableBalance)}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums">
              <span className="whitespace-nowrap">
                Buku {formatIDR(totalActualBalance)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">
                Tertahan {formatIDR(totalPendingHold)}
              </span>
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Pengeluaran Bulan Ini</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatIDR(totalMonthSpent)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
              Periode {currentMonthKey} ·{' '}
              {metrics.reduce((s, m) => s + m.monthRequestCount, 0)} pencairan
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Menunggu Persetujuan Direktur</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {pendingRequests.length} Pengajuan
            </p>
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
              {canDecideRequest
                ? `${pendingRequests.length} siap Anda setujui langsung`
                : 'Alur persetujuan langsung 1 tahap'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Serapan Plafon Kargo</span>
              <Truck className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {overallUtilizationPct}%
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              {criticalDeptsCount > 0
                ? `${criticalDeptsCount} divisi perlu isi ulang saldo`
                : 'Semua saldo divisi dalam batas aman'}
            </p>
          </div>
        </div>
      </section>

      {/* Cash Health Gauge & Anti-Fraud Control Center */}
      <section
        aria-label="Kesehatan Kas & Guard Anti-Fraud"
        className="grid grid-cols-1 xl:grid-cols-12 gap-6"
      >
        <CashHealthGaugeCard cashHealth={cashHealth} />

        <FraudControlSummaryCard
          fraudGuard={fraudGuard}
          activeRulesCount={fraudAuditStats.activeRulesCount}
          pendingAlertCount={fraudAuditStats.pendingAlertCount}
          withPhotoCount={fraudAuditStats.withPhotoCount}
          totalActiveCount={fraudAuditStats.totalActiveCount}
          latestOpnameVariance={cashHealth.latestOpnameVariance}
          openKasbonsCount={openKasbonsCount}
          forecastModuleEnabled={forecastModuleEnabled}
          onNavigateApprovals={onNavigateApprovals}
          onNavigateDownPayments={onNavigateDownPayments}
          onNavigateDepartments={onNavigateDepartments}
          onNavigateForecast={onNavigateForecast}
          onNavigateModules={onNavigateModules}
        />
      </section>

      {/* Real-time Department Balance Monitor */}
      <section aria-labelledby="dept-monitor-heading">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2
              id="dept-monitor-heading"
              className="text-lg font-semibold text-slate-900"
            >
              Monitoring Saldo Real-Time Divisi Kargo
            </h2>
            <p className="text-sm text-slate-500">
              Saldo tersedia langsung berkurang saat ada pengajuan masuk atau
              pencairan disetujui Direktur.
            </p>
          </div>
          {canCreateRequest && (
            <button
              type="button"
              onClick={onOpenNewRequest}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Buat Pengajuan</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {metrics
            .filter((m) => m.department.active !== false)
            .map((m) => {
              const { department } = m;
              const utilizationBarWidth = Math.min(100, m.budgetUtilizationPct);
              return (
                <article
                  key={department.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          {department.code} · PIC: {department.picName}
                        </p>
                        <h3 className="mt-0.5 text-base font-semibold text-slate-900">
                          {department.name}
                        </h3>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${
                          m.healthStatus === 'kritis'
                            ? 'text-rose-700'
                            : m.healthStatus === 'menipis'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {m.healthStatus === 'kritis' ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : m.healthStatus === 'menipis' ? (
                          <Clock className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {m.healthStatus === 'kritis'
                            ? 'Kritis'
                            : m.healthStatus === 'menipis'
                            ? 'Menipis'
                            : 'Nominal'}
                        </span>
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs text-slate-500">Saldo Tersedia</p>
                      <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-0.5">
                        {formatIDR(m.availableBalance)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums">
                        <span>Buku: {formatIDR(department.balance)}</span>
                        <span aria-hidden="true">·</span>
                        <span>Tertahan: {formatIDR(m.pendingHold)}</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                        <span>Serapan Anggaran Bulanan</span>
                        <span className="font-mono tabular-nums font-medium">
                          {m.budgetUtilizationPct}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            m.budgetUtilizationPct >= 90
                              ? 'bg-rose-600'
                              : m.budgetUtilizationPct >= 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-700'
                          }`}
                          style={{ width: `${utilizationBarWidth}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
                        <span>Terpakai {formatIDR(m.monthSpent)}</span>
                        <span>Plafon {formatIDR(department.monthlyBudget)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      {m.monthRequestCount} pencairan bulan ini
                    </span>
                    {canTopUp && (
                      <button
                        type="button"
                        onClick={() => onOpenTopUp(department)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                      >
                        + Top-Up Saldo {department.code}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
      </section>

      {/* Bottom Split: Pending Director Approvals + Cargo Expense Category Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section
          aria-labelledby="pending-pipeline-heading"
          className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5"
        >
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2
                id="pending-pipeline-heading"
                className="text-base font-semibold text-slate-900"
              >
                Pengajuan Menunggu Persetujuan Direktur
              </h2>
              <p className="text-xs text-slate-500">
                Approval langsung 1 tahap oleh Direktur sebelum dana dicairkan.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateApprovals}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
            >
              <span>Lihat Semua</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                Tidak ada pengajuan yang menunggu persetujuan Direktur.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Semua transaksi kas kecil telah diproses.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingRequests.slice(0, 5).map((req) => {
                const dept = deptMap.get(req.departmentId);
                const signals = auditExistingRequestFraudSignals(
                  req,
                  fraudGuard,
                  requests,
                  categories
                );
                return (
                  <div
                    key={req.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-700">
                          {req.requestNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{dept?.name ?? req.departmentId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{req.requesterName}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-slate-900 truncate">
                        {req.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{getStatusLabel(req.status)}</span>
                        </span>
                        {signals.length > 0 && (
                          <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span>{signals.length} Peringatan Guard</span>
                          </span>
                        )}
                        {req.receiptImageUrl && (
                          <button
                            type="button"
                            onClick={() => onPreviewReceipt(req)}
                            aria-label={`Lihat Nota ${req.requestNumber}`}
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            <span>Lihat Nota</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                        {formatIDR(req.amount)}
                      </span>
                      {canDecideRequest ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onQuickDecision(req, 'approve')}
                            aria-label={`Setujui ${req.requestNumber}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Setujui</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickDecision(req, 'reject')}
                            aria-label={`Tolak ${req.requestNumber}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 whitespace-nowrap"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Tolak</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          Menunggu Otorisasi
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section
          aria-labelledby="cargo-category-heading"
          className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5"
        >
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2
                id="cargo-category-heading"
                className="text-base font-semibold text-slate-900"
              >
                Realisasi Kategori Biaya Kargo
              </h2>
              <p className="text-xs text-slate-500">
                Akumulasi pengeluaran disetujui periode {currentMonthKey}.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateReports}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
            >
              <span>Laporan Lengkap</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {monthlySummary.byCategory.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Belum ada pencairan disetujui pada bulan ini.
            </p>
          ) : (
            <div className="space-y-4">
              {monthlySummary.byCategory.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-800">
                      {cat.category}
                    </span>
                    <span className="font-mono tabular-nums text-slate-700">
                      {formatIDR(cat.totalSpent)} ({cat.sharePct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-700"
                      style={{ width: `${Math.min(100, cat.sharePct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
