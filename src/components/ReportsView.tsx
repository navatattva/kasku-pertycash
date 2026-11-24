import { useMemo, useState } from 'react';
import {
  Download,
  Image as ImageIcon,
  Lock,
  Printer,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react';
import type {
  ClosedPeriodRecord,
  Department,
  DownPaymentRecord,
  MasterVehicle,
  PermissionKey,
  PettyCashRequest,
  TopUpRecord,
} from '../types/pettycash.ts';
import {
  formatDateTime,
  formatIDR,
  formatMonthLabel,
  formatShortDate,
} from '../utils/formatters.ts';
import {
  generateMonthlyReport,
  generateReportCsv,
  generateVehicleComparisonCsv,
  hasPermission,
  isPeriodClosed,
} from '../utils/pettycashLogic.ts';

interface ReportsViewProps {
  departments: Department[];
  vehicles: MasterVehicle[];
  requests: PettyCashRequest[];
  topUps: TopUpRecord[];
  downPayments?: DownPaymentRecord[];
  closedPeriods?: ClosedPeriodRecord[];
  defaultMonthKey: string;
  taxModuleEnabled: boolean;
  userPermissions: readonly PermissionKey[];
  onPreviewReceipt: (request: PettyCashRequest) => void;
}

function formatMomBadge(deltaAmount: number, deltaPct: number | null) {
  if (deltaAmount === 0) {
    return {
      text: 'Sama dg bulan lalu (0%)',
      tone: 'text-slate-500',
      direction: 'flat' as const,
    };
  }
  const sign = deltaAmount > 0 ? '+' : '-';
  const pctStr =
    deltaPct === null
      ? 'Baru'
      : `${deltaPct > 0 ? '+' : ''}${deltaPct}%`;
  return {
    text: `${sign}${formatIDR(Math.abs(deltaAmount))} (${pctStr})`,
    tone: deltaAmount > 0 ? 'text-rose-700' : 'text-emerald-700',
    direction: deltaAmount > 0 ? ('up' as const) : ('down' as const),
  };
}

export function ReportsView({
  departments,
  vehicles,
  requests,
  topUps,
  downPayments = [],
  closedPeriods = [],
  defaultMonthKey,
  taxModuleEnabled,
  userPermissions,
  onPreviewReceipt,
}: ReportsViewProps) {
  const canExport = hasPermission(userPermissions, 'reports:export');
  const availableMonths = useMemo(() => {
    const set = new Set<string>([defaultMonthKey]);
    for (const req of requests) {
      const dateStr =
        req.status === 'approved'
          ? req.disbursedAt ?? req.updatedAt
          : req.createdAt;
      if (dateStr.length >= 7) {
        set.add(dateStr.slice(0, 7));
      }
    }
    for (const dp of downPayments) {
      const settledDate = dp.settlement?.settledAt;
      if (settledDate && settledDate.length >= 7) {
        set.add(settledDate.slice(0, 7));
      }
    }
    for (const cp of closedPeriods) {
      if (cp.monthKey) set.add(cp.monthKey);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [requests, downPayments, closedPeriods, defaultMonthKey]);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonthKey);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');

  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );

  const report = useMemo(
    () =>
      generateMonthlyReport(
        selectedMonth,
        departments,
        requests,
        topUps,
        selectedDeptId === 'all' ? undefined : selectedDeptId,
        vehicles,
        downPayments
      ),
    [
      selectedMonth,
      departments,
      requests,
      topUps,
      selectedDeptId,
      vehicles,
      downPayments,
    ]
  );

  const closedPeriodInfo = useMemo(
    () => isPeriodClosed(selectedMonth, closedPeriods),
    [selectedMonth, closedPeriods]
  );

  const showTaxSection =
    taxModuleEnabled ||
    report.totalPpnInput > 0 ||
    report.totalPphWithheld > 0;

  const overallMom = formatMomBadge(
    report.momDeltaAmount,
    report.momDeltaPct
  );
  const prevMonthLabel = formatMonthLabel(report.previousMonthKey);

  const vehicleOnlyRows = report.byVehicle.filter(
    (v) => v.vehicleKey !== 'non-unit'
  );
  const totalVehicleSpent = vehicleOnlyRows.reduce(
    (sum, v) => sum + v.totalSpent,
    0
  );
  const topVehicle = vehicleOnlyRows[0];

  function handleDownloadCsv() {
    const csv = generateReportCsv(report, departments, showTaxSection);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `laporan-petty-cash-kargo-${selectedMonth}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function handleDownloadVehicleCsv() {
    const csv = generateVehicleComparisonCsv(report);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `laporan-biaya-armada-mom-${selectedMonth}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label
              htmlFor="report-month-select"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Periode Laporan
            </label>
            <select
              id="report-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)} ({m})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="report-dept-select"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Cakupan Divisi
            </label>
            <select
              id="report-dept-select"
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none"
            >
              <option value="all">Semua Divisi Kargo</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canExport && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Cetak Laporan</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh CSV</span>
            </button>
          </div>
        )}
      </div>

      {closedPeriodInfo && (
        <div
          role="status"
          data-testid="locked-period-banner"
          className="rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950"
        >
          <div className="flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                Periode Terkunci (Tutup Buku {formatMonthLabel(selectedMonth)})
              </p>
              <p className="text-amber-800 mt-0.5">
                Ditutup oleh {closedPeriodInfo.closedBy} pada{' '}
                <span className="font-mono">
                  {formatDateTime(closedPeriodInfo.closedAt)}
                </span>
                {closedPeriodInfo.note ? ` · ${closedPeriodInfo.note}` : ''}
              </p>
            </div>
          </div>
          <span className="font-mono font-semibold text-amber-800 whitespace-nowrap">
            Arsip Final
          </span>
        </div>
      )}

      {/* Report Header & KPI Summary */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Laporan Pengeluaran Petty Cash Otomatis —{' '}
              {formatMonthLabel(selectedMonth)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rekap pengeluaran disetujui beserta perbandingan periode{' '}
              {prevMonthLabel} dan rincian biaya per unit armada.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500">
            Periode: {selectedMonth} (vs {report.previousMonthKey})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          <div>
            <p className="text-xs text-slate-500">Total Pengeluaran Disetujui</p>
            <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-slate-900">
              {formatIDR(report.totalSpent)}
            </p>
            <p
              className={`mt-1 inline-flex items-center gap-1 text-xs font-mono tabular-nums font-medium ${overallMom.tone}`}
            >
              {overallMom.direction === 'up' && (
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              )}
              {overallMom.direction === 'down' && (
                <TrendingDown className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>
                vs {prevMonthLabel}: {overallMom.text}
              </span>
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Total Plafon Anggaran</p>
            <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-slate-900">
              {formatIDR(report.totalBudget)}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              Sisa plafon {formatIDR(report.totalBudget - report.totalSpent)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Rata-Rata per Pencairan</p>
            <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-slate-900">
              {formatIDR(report.averageExpense)}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              {report.approvedCount} transaksi cair · Top-Up{' '}
              {formatIDR(report.totalTopUp)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Status Persetujuan</p>
            <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-slate-900">
              {report.pendingCount} Menunggu
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              {report.rejectedCount} pengajuan ditolak
            </p>
          </div>
        </div>

        {showTaxSection && (
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
              <div>
                <p className="font-semibold text-slate-800">
                  Total PPN Masukan (11%)
                </p>
                <p className="text-slate-500">
                  Akumulasi pajak masukan transaksi yang telah disetujui
                </p>
              </div>
              <p className="font-mono tabular-nums text-sm font-semibold text-emerald-700">
                {formatIDR(report.totalPpnInput)}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
              <div>
                <p className="font-semibold text-slate-800">
                  Total Potongan PPh (Pasal 21 &amp; 23)
                </p>
                <p className="text-slate-500">
                  Kewajiban setor pajak yang dipotong dari vendor/tenaga lepas
                </p>
              </div>
              <p className="font-mono tabular-nums text-sm font-semibold text-amber-700">
                {formatIDR(report.totalPphWithheld)}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Department Realization (with MoM) & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">
              Realisasi &amp; Perbandingan Divisi (vs {prevMonthLabel})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Divisi</th>
                  <th className="py-3 px-4 text-right">Bulan Ini</th>
                  <th className="py-3 px-4 text-right">Bulan Lalu</th>
                  <th className="py-3 px-4 text-right">Selisih MoM</th>
                  <th className="py-3 px-4 text-right">Serapan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.byDepartment.map((row) => {
                  const mom = formatMomBadge(row.deltaAmount, row.deltaPct);
                  return (
                    <tr key={row.departmentId}>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900 block">
                          {row.departmentName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {row.transactionCount} trx · Plafon{' '}
                          {formatIDR(row.monthlyBudget)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatIDR(row.totalSpent)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatIDR(row.prevTotalSpent)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-medium whitespace-nowrap ${mom.tone}`}
                      >
                        {row.deltaAmount === 0
                          ? '0%'
                          : row.deltaPct === null
                          ? `+${formatIDR(row.deltaAmount)} (Baru)`
                          : `${row.deltaAmount > 0 ? '+' : '-'}${formatIDR(
                              Math.abs(row.deltaAmount)
                            )} (${row.deltaPct > 0 ? '+' : ''}${row.deltaPct}%)`}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-800 whitespace-nowrap">
                        {row.utilizationPct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            Distribusi &amp; Tren Kategori Biaya Kargo
          </h3>
          {report.byCategory.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              Belum ada pengeluaran disetujui pada periode ini atau bulan lalu.
            </p>
          ) : (
            <div className="space-y-4">
              {report.byCategory.map((cat) => {
                const mom = formatMomBadge(cat.deltaAmount, cat.deltaPct);
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <span className="font-medium text-slate-800 truncate">
                        {cat.category}
                      </span>
                      <span className="font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatIDR(cat.totalSpent)} ({cat.sharePct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-700"
                        style={{ width: `${Math.min(100, cat.sharePct)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-slate-500">
                        {prevMonthLabel}: {formatIDR(cat.prevTotalSpent)}
                      </span>
                      <span className={mom.tone}>
                        {cat.deltaAmount === 0
                          ? 'Stabil (0%)'
                          : cat.deltaPct === null
                          ? 'Baru bulan ini'
                          : `${cat.deltaPct > 0 ? '+' : ''}${cat.deltaPct}%`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Per-Vehicle Cost & MoM Comparison */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Truck className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Laporan Biaya per Unit Armada &amp; Perbandingan MoM
              </h3>
              <p className="text-xs text-slate-500">
                Melacak biaya BBM/tol, perawatan ringan, dan lonjakan biaya tiap
                plat nomor truk dibanding {prevMonthLabel}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="font-mono tabular-nums text-slate-600">
              Total Armada:{' '}
              <span className="font-semibold text-slate-900">
                {formatIDR(totalVehicleSpent)}
              </span>
              {topVehicle && topVehicle.totalSpent > 0 && (
                <span>
                  {' '}
                  · Tertinggi:{' '}
                  <strong className="text-slate-900">
                    {topVehicle.plateNumber}
                  </strong>
                </span>
              )}
            </div>
            {canExport && (
              <button
                type="button"
                onClick={handleDownloadVehicleCsv}
                className="no-print inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh CSV Armada</span>
              </button>
            )}
          </div>
        </div>

        {report.byVehicle.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Belum ada data biaya armada pada periode ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-2.5 sm:px-3">No. Polisi / Kelompok</th>
                  <th className="py-3 px-2.5 sm:px-3">Divisi</th>
                  <th className="py-3 px-2.5 sm:px-3 text-right">Trx</th>
                  <th className="py-3 px-2.5 sm:px-3 text-right whitespace-nowrap">
                    BBM &amp; Tol
                  </th>
                  <th className="py-3 px-2.5 sm:px-3 text-right whitespace-nowrap">
                    Perawatan
                  </th>
                  <th className="py-3 px-2.5 sm:px-3 text-right whitespace-nowrap">
                    Lainnya
                  </th>
                  <th className="py-3 px-2.5 sm:px-3 text-right whitespace-nowrap">
                    Bulan Ini
                  </th>
                  <th className="py-3 px-2.5 sm:px-3 text-right whitespace-nowrap">
                    Bulan Lalu
                  </th>
                  <th className="py-3 px-2.5 sm:px-3 text-right whitespace-nowrap">
                    Selisih MoM
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.byVehicle.map((v) => {
                  const mom = formatMomBadge(v.deltaAmount, v.deltaPct);
                  return (
                    <tr key={v.vehicleKey} className="hover:bg-slate-50/70">
                      <td className="py-3 px-2.5 sm:px-3 whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-900 block">
                          {v.plateNumber}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {v.unitType}
                        </span>
                      </td>
                      <td className="py-3 px-2.5 sm:px-3 text-slate-700 max-w-[160px]">
                        {v.departmentName}
                      </td>
                      <td className="py-3 px-2.5 sm:px-3 text-right font-mono tabular-nums text-slate-600">
                        {v.transactionCount}
                      </td>
                      <td className="py-3 px-2.5 sm:px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {v.fuelTollSpent > 0 ? formatIDR(v.fuelTollSpent) : '-'}
                      </td>
                      <td className="py-3 px-2.5 sm:px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {v.maintenanceSpent > 0
                          ? formatIDR(v.maintenanceSpent)
                          : '-'}
                      </td>
                      <td className="py-3 px-2.5 sm:px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {v.otherSpent > 0 ? formatIDR(v.otherSpent) : '-'}
                      </td>
                      <td className="py-3 px-2.5 sm:px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatIDR(v.totalSpent)}
                      </td>
                      <td className="py-3 px-2.5 sm:px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatIDR(v.prevTotalSpent)}
                      </td>
                      <td
                        className={`py-3 px-2.5 sm:px-3 text-right font-mono tabular-nums font-medium whitespace-nowrap ${mom.tone}`}
                      >
                        {v.deltaAmount === 0 ? (
                          <span>0%</span>
                        ) : v.deltaPct === null ? (
                          <div className="leading-tight">
                            <span className="block">
                              +{formatIDR(v.deltaAmount)}
                            </span>
                            <span className="block text-[11px]">(Baru)</span>
                          </div>
                        ) : (
                          <div className="leading-tight">
                            <span className="block">
                              {v.deltaAmount > 0 ? '+' : '-'}
                              {formatIDR(Math.abs(v.deltaAmount))}
                            </span>
                            <span className="block text-[11px]">
                              ({v.deltaPct > 0 ? '+' : ''}
                              {v.deltaPct}%)
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Itemized Ledger Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            Rincian Transaksi Dicairkan ({report.transactions.length})
          </h3>
        </div>
        {report.transactions.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Belum ada transaksi yang dicairkan pada bulan{' '}
            {formatMonthLabel(selectedMonth)}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">No. Pengajuan</th>
                  <th className="py-3 px-4">Tanggal Cair</th>
                  <th className="py-3 px-4">Divisi</th>
                  <th className="py-3 px-4">Keperluan &amp; Kategori</th>
                  <th className="py-3 px-4">Pemohon</th>
                  <th className="py-3 px-4">Bukti Nota</th>
                  {showTaxSection && (
                    <th className="py-3 px-4 text-right">Pajak (PPN / PPh)</th>
                  )}
                  <th className="py-3 px-4 text-right">Nominal Kas Cair</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {tx.requestNumber}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatShortDate(tx.disbursedAt ?? tx.updatedAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                      {deptMap.get(tx.departmentId)?.name ?? tx.departmentId}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{tx.title}</p>
                      <p className="text-slate-500">
                        {tx.category}
                        {tx.vehiclePlate ? ` · ${tx.vehiclePlate}` : ''} · Ref:{' '}
                        {tx.receiptRef || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {tx.requesterName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {tx.receiptImageUrl ? (
                        <button
                          type="button"
                          onClick={() => onPreviewReceipt(tx)}
                          aria-label={`Lihat Nota ${tx.requestNumber}`}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>Lihat Nota</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">Tidak ada foto</span>
                      )}
                    </td>
                    {showTaxSection && (
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        {tx.tax && tx.tax.taxType !== 'none' ? (
                          <div>
                            <span className="block text-slate-700">
                              {tx.tax.label}
                            </span>
                            {tx.tax.ppnAmount > 0 && (
                              <span className="block text-[11px] text-emerald-700">
                                PPN +{formatIDR(tx.tax.ppnAmount)}
                              </span>
                            )}
                            {tx.tax.pphAmount > 0 && (
                              <span className="block text-[11px] text-amber-700">
                                PPh -{formatIDR(tx.tax.pphAmount)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatIDR(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {report.settledKasbons.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Realisasi Kasbon Periode Ini ({report.settledKasbonCount})
              </h3>
              <p className="text-xs text-slate-500">
                Nilai realisasi struk kasbon sudah otomatis terhitung ke dalam
                total pengeluaran &amp; biaya armada periode ini.
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs font-semibold text-slate-900">
              Total Realisasi: {formatIDR(report.settledKasbonTotal)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">No. Kasbon</th>
                  <th className="py-3 px-4">Tgl Realisasi</th>
                  <th className="py-3 px-4">Divisi</th>
                  <th className="py-3 px-4">Keperluan &amp; Ref Struk</th>
                  <th className="py-3 px-4">Pemohon</th>
                  <th className="py-3 px-4 text-right">Uang Muka</th>
                  <th className="py-3 px-4 text-right">Realisasi Struk</th>
                  <th className="py-3 px-4 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.settledKasbons.map((dp) => {
                  const st = dp.settlement!;
                  return (
                    <tr key={dp.id}>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {dp.dpNumber}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatShortDate(st.settledAt)}
                      </td>
                      <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                        {deptMap.get(dp.departmentId)?.name ?? dp.departmentId}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{dp.title}</p>
                        <p className="text-slate-500">
                          {dp.category}
                          {dp.vehiclePlate ? ` · ${dp.vehiclePlate}` : ''} · Ref:{' '}
                          {st.receiptRef || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {dp.requesterName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatIDR(dp.requestedAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatIDR(st.actualAmount)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-medium whitespace-nowrap ${
                          st.differenceType === 'refund'
                            ? 'text-emerald-700'
                            : st.differenceType === 'reimburse'
                            ? 'text-rose-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {st.differenceType === 'exact'
                          ? 'Pas Rp 0'
                          : st.differenceType === 'refund'
                          ? `Kembali +${formatIDR(st.differenceAmount)}`
                          : `Kurang -${formatIDR(Math.abs(st.differenceAmount))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
