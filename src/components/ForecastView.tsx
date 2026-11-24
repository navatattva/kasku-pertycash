import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Info,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import type {
  ColdForecastMethod,
  Department,
  DownPaymentRecord,
  ForecastModuleConfig,
  PermissionKey,
  PettyCashRequest,
} from '../types/pettycash.ts';
import { formatIDR } from '../utils/formatters.ts';
import {
  calculateCashForecast,
  hasPermission,
} from '../utils/pettycashLogic.ts';

interface ForecastViewProps {
  departments: Department[];
  requests: PettyCashRequest[];
  downPayments?: DownPaymentRecord[];
  forecastModule: ForecastModuleConfig;
  userPermissions: readonly PermissionKey[];
  referenceIso: string;
  currentMonthKey: string;
  onOpenTopUp: (dept: Department) => void;
  onEnableForecastModule: () => Promise<{ ok: boolean; error?: string }>;
  onNavigateModules: () => void;
}

const COLD_METHOD_LABELS: Record<ColdForecastMethod, string> = {
  budget_baseline: 'Baseline Plafon (Cold-Start)',
  hybrid_historical: 'Historis Bulan Lalu + Plafon',
  zero_conservative: 'Aktual Murni (Konservatif Rp 0)',
};

const SOURCE_LABELS: Record<string, string> = {
  actual_mtd: 'Aktual Bulan Berjalan (MTD)',
  hybrid_prev_month: 'Blended Bulan Lalu + MTD',
  hybrid_budget: 'Blended Plafon + MTD',
  cold_budget: 'Cold-Start Baseline Plafon',
  zero_actual: 'Aktual Murni (Belum Ada Transaksi)',
};

function formatCompactAxisIDR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const jt = abs / 1_000_000;
    return `${sign}${jt % 1 === 0 ? jt.toFixed(0) : jt.toFixed(1)} jt`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)} rb`;
  }
  return `${sign}${abs}`;
}

export function ForecastView({
  departments,
  requests,
  downPayments = [],
  forecastModule,
  userPermissions,
  referenceIso,
  currentMonthKey,
  onOpenTopUp,
  onEnableForecastModule,
  onNavigateModules,
}: ForecastViewProps) {
  const canManageModules = hasPermission(userPermissions, 'modules:manage');
  const canTopUp = hasPermission(userPermissions, 'departments:topup');
  const [horizonDays, setHorizonDays] = useState<14 | 30 | 60>(
    forecastModule.horizonDays
  );
  const [coldMethod, setColdMethod] = useState<ColdForecastMethod>(
    forecastModule.coldStartMethod
  );
  const [assumptionPct, setAssumptionPct] = useState<number>(
    forecastModule.budgetUtilizationAssumptionPct
  );
  const [includePending, setIncludePending] = useState(false);
  const [surgeMode, setSurgeMode] = useState<'normal' | 'surge25'>('normal');
  const [enabling, setEnabling] = useState(false);

  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );

  const forecast = useMemo(
    () =>
      calculateCashForecast(
        departments,
        requests,
        referenceIso,
        {
          includePending,
          surgeMultiplier: surgeMode === 'surge25' ? 1.25 : 1,
          coldStartMethod: coldMethod,
          budgetUtilizationAssumptionPct: assumptionPct,
          horizonDays,
        },
        downPayments
      ),
    [
      departments,
      requests,
      downPayments,
      referenceIso,
      includePending,
      surgeMode,
      coldMethod,
      assumptionPct,
      horizonDays,
    ]
  );

  if (!forecastModule.enabled) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-2xl mx-auto">
        <SlidersHorizontal className="h-8 w-8 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">
          Modul Forecast &amp; Ketahanan Kas Sedang Nonaktif
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Seperti Modul Pajak, fitur proyeksi kas dan analisis{' '}
          <em>cold-start</em> bersifat opsional agar sistem tetap ringkas bila
          belum diperlukan. Aktifkan modul ini untuk memantau proyeksi{' '}
          <em>runway</em> kas kecil dan rekomendasi top-up otomatis.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {canManageModules && (
            <button
              type="button"
              disabled={enabling}
              onClick={async () => {
                setEnabling(true);
                await onEnableForecastModule();
                setEnabling(false);
              }}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {enabling ? 'Mengaktifkan...' : 'Aktifkan Modul Forecast'}
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateModules}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Buka Pengaturan Modul
          </button>
        </div>
      </section>
    );
  }

  // SVG chart geometry
  const chartW = 760;
  const chartH = 210;
  const padLeft = 54;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 28;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  const curveValues = forecast.curvePoints.map((p) => p.projectedBalance);
  const rawMax = Math.max(
    1_000_000,
    ...curveValues,
    forecast.totalLowThreshold * 1.15
  );
  const rawMin = Math.min(0, ...curveValues);
  const valueSpan = Math.max(1, rawMax - rawMin);

  const toX = (idx: number) => {
    const count = Math.max(1, forecast.curvePoints.length - 1);
    return padLeft + (idx / count) * plotW;
  };
  const toY = (val: number) => padTop + ((rawMax - val) / valueSpan) * plotH;

  const linePoints = forecast.curvePoints
    .map((pt, idx) => `${toX(idx).toFixed(1)},${toY(pt.projectedBalance).toFixed(1)}`)
    .join(' ');
  const zeroY = toY(0);
  const baseLineY = Math.min(padTop + plotH, Math.max(padTop, zeroY));
  const areaPath =
    forecast.curvePoints.length > 0
      ? `M ${toX(0).toFixed(1)} ${baseLineY.toFixed(1)} ${forecast.curvePoints
          .map(
            (pt, idx) =>
              `L ${toX(idx).toFixed(1)} ${toY(pt.projectedBalance).toFixed(1)}`
          )
          .join(' ')} L ${toX(forecast.curvePoints.length - 1).toFixed(1)} ${baseLineY.toFixed(1)} Z`
      : '';
  const thresholdY = toY(forecast.totalLowThreshold);

  return (
    <div className="space-y-6">
      {/* Toolbar & Scenario Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <div>
            <label
              htmlFor="forecast-horizon"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Horizon Proyeksi
            </label>
            <select
              id="forecast-horizon"
              value={horizonDays}
              onChange={(e) =>
                setHorizonDays(Number(e.target.value) as 14 | 30 | 60)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none"
            >
              <option value={14}>14 Hari Ke Depan</option>
              <option value={30}>30 Hari Ke Depan</option>
              <option value={60}>60 Hari Ke Depan</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="forecast-cold-method"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Metode Cold-Start (Data Kosong/Minim)
            </label>
            <select
              id="forecast-cold-method"
              value={coldMethod}
              onChange={(e) =>
                setColdMethod(e.target.value as ColdForecastMethod)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none"
            >
              {(Object.keys(COLD_METHOD_LABELS) as ColdForecastMethod[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {COLD_METHOD_LABELS[key]}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="forecast-assumption"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Asumsi Serapan Cold-Start (%)
            </label>
            <input
              id="forecast-assumption"
              type="number"
              min={10}
              max={100}
              step={5}
              disabled={coldMethod === 'zero_conservative'}
              value={assumptionPct}
              onChange={(e) =>
                setAssumptionPct(
                  Math.max(10, Math.min(100, Number(e.target.value) || 70))
                )
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-2 shrink-0"
          role="group"
          aria-label="Skenario simulasi stres"
        >
          <button
            type="button"
            aria-pressed={includePending}
            onClick={() => setIncludePending((prev) => !prev)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              includePending
                ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Sertakan Pending
          </button>
          <button
            type="button"
            aria-pressed={surgeMode === 'surge25'}
            onClick={() =>
              setSurgeMode((prev) =>
                prev === 'normal' ? 'surge25' : 'normal'
              )
            }
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              surgeMode === 'surge25'
                ? 'border-amber-600 bg-amber-50 text-amber-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Simulasi Lonjakan +25%
          </button>
          <button
            type="button"
            onClick={onNavigateModules}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap"
          >
            Atur Default Modul
          </button>
        </div>
      </section>

      {/* Cold-Start & Data Quality Transparency Notice */}
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5 text-slate-700">
          <Sparkles className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900">
              Cakupan Data &amp; Penanganan Cold-Start ({currentMonthKey}):
            </span>{' '}
            <span>
              <strong className="font-mono">
                {forecast.matureDivisionsCount}
              </strong>{' '}
              divisi data matang ·{' '}
              <strong className="font-mono">
                {forecast.partialDivisionsCount}
              </strong>{' '}
              divisi parsial (blended historis/plafon) ·{' '}
              <strong className="font-mono">
                {forecast.coldDivisionsCount}
              </strong>{' '}
              divisi cold-start (belum ada transaksi).
            </span>
          </div>
        </div>
        <span className="font-mono text-slate-500">
          Periode berjalan: {forecast.daysElapsedInMonth} hr · Sisa:{' '}
          {forecast.daysRemainingInMonth} hr
        </span>
      </section>

      {/* KPI Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Estimasi Burn Rate Harian
          </p>
          <p
            data-testid="forecast-burn-rate"
            className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900"
          >
            {formatIDR(forecast.dailyBurnRate)}/hr
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {COLD_METHOD_LABELS[forecast.coldStartMethod]}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Ketahanan Kas Konsolidasi
          </p>
          <p
            data-testid="forecast-runway"
            className={`mt-2 font-mono tabular-nums text-2xl font-semibold ${
              forecast.overallRunwayDays !== null &&
              forecast.overallRunwayDays <= 10
                ? 'text-rose-700'
                : forecast.overallRunwayDays !== null &&
                  forecast.overallRunwayDays <= 21
                ? 'text-amber-700'
                : 'text-emerald-700'
            }`}
          >
            {forecast.overallRunwayDays === null
              ? 'Sangat Aman'
              : `${forecast.overallRunwayDays} Hari`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Hingga saldo tersedia mendekati Rp 0
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Proyeksi Sisa Akhir Bulan
          </p>
          <p
            data-testid="forecast-month-end-balance"
            className={`mt-2 font-mono tabular-nums text-2xl font-semibold ${
              forecast.projectedMonthEndBalance < forecast.totalLowThreshold
                ? 'text-amber-700'
                : 'text-slate-900'
            }`}
          >
            {formatIDR(forecast.projectedMonthEndBalance)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Batas aman gabungan {formatIDR(forecast.totalLowThreshold)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Rekomendasi Top-Up Akhir Bln
          </p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-emerald-700">
            {forecast.totalRecommendedTopUp > 0
              ? formatIDR(forecast.totalRecommendedTopUp)
              : 'Belum Perlu'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Menjaga setiap divisi di atas batas aman
          </p>
        </div>
      </section>

      {/* Trajectory SVG Chart */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-emerald-700" />
              <span>
                Kurva Proyeksi Saldo Kas Kecil ({forecast.horizonDays} Hari)
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Menghitung penurunan saldo tersedia dari posisi hari ini terhadap
              garis batas aman operasional.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500">
            Acuan: {forecast.referenceDate}
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-4">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label={`Grafik proyeksi saldo kas kecil ${forecast.horizonDays} hari ke depan dengan burn rate ${formatIDR(forecast.dailyBurnRate)} per hari`}
          >
            <defs>
              <linearGradient
                id="forecastViewAreaGrad"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#047857" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#047857" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const val = rawMin + valueSpan * (1 - ratio);
              const y = padTop + plotH * ratio;
              return (
                <g key={ratio}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={chartW - padRight}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 3}
                    fontSize="10"
                    fill="#64748b"
                    textAnchor="end"
                    className="font-mono"
                  >
                    {formatCompactAxisIDR(val)}
                  </text>
                </g>
              );
            })}

            <line
              x1={padLeft}
              y1={thresholdY}
              x2={chartW - padRight}
              y2={thresholdY}
              stroke="#d97706"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text
              x={chartW - padRight}
              y={Math.max(12, thresholdY - 5)}
              fontSize="10"
              fill="#b45309"
              textAnchor="end"
              className="font-medium"
            >
              Batas Aman ({formatCompactAxisIDR(forecast.totalLowThreshold)})
            </text>

            {rawMin < 0 && (
              <line
                x1={padLeft}
                y1={zeroY}
                x2={chartW - padRight}
                y2={zeroY}
                stroke="#e11d48"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            )}

            {areaPath && (
              <path d={areaPath} fill="url(#forecastViewAreaGrad)" />
            )}
            <polyline
              fill="none"
              stroke="#047857"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={linePoints}
            />

            {forecast.curvePoints.map((pt, idx) => {
              const x = toX(idx);
              const y = toY(pt.projectedBalance);
              const isBelowSafe =
                pt.projectedBalance < forecast.totalLowThreshold;
              return (
                <g key={pt.dayOffset}>
                  <circle
                    cx={x}
                    cy={y}
                    r={
                      idx === 0 || idx === forecast.curvePoints.length - 1
                        ? 4.5
                        : 3.5
                    }
                    fill={isBelowSafe ? '#d97706' : '#047857'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={x}
                    y={chartH - 6}
                    fontSize="10"
                    fill="#64748b"
                    textAnchor={
                      idx === 0
                        ? 'start'
                        : idx === forecast.curvePoints.length - 1
                        ? 'end'
                        : 'middle'
                    }
                    className="font-mono"
                  >
                    {pt.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Per-Division Forecast Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Proyeksi Ketahanan &amp; Kualitas Data per Divisi
            </h3>
            <p className="text-xs text-slate-500">
              Divisi dengan data kosong (<em>Cold-Start</em>) atau parsial
              otomatis memakai estimasi plafon/bulan lalu agar risiko kekurangan
              kas tetap terdeteksi.
            </p>
          </div>
          <Info className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-3">Divisi</th>
                <th className="py-3 px-3">Kualitas Data</th>
                <th className="py-3 px-3">Basis Estimasi</th>
                <th className="py-3 px-3 text-right">Saldo Tersedia</th>
                <th className="py-3 px-3 text-right">Burn / Hari</th>
                <th className="py-3 px-3 text-right">Runway</th>
                <th className="py-3 px-3 text-right">Proyeksi Akhir Bln</th>
                <th className="py-3 px-3 text-right">Saran Top-Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {forecast.byDivision.map((div) => {
                const dept = deptMap.get(div.departmentId);
                return (
                  <tr key={div.departmentId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <span className="font-mono font-semibold text-slate-900">
                        {div.departmentCode}
                      </span>{' '}
                      <span className="font-medium text-slate-800">
                        {div.departmentName}
                      </span>
                      <span className="block text-[11px] text-slate-500 font-mono tabular-nums">
                        {div.monthTxCount} trx bln ini · Bln lalu{' '}
                        {formatIDR(div.prevMonthSpent)}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          div.dataConfidence === 'cold'
                            ? 'text-amber-700'
                            : div.dataConfidence === 'partial'
                            ? 'text-slate-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {div.dataConfidence === 'cold' ? (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        ) : div.dataConfidence === 'partial' ? (
                          <Database className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>
                          {div.dataConfidence === 'cold'
                            ? 'Cold-Start'
                            : div.dataConfidence === 'partial'
                            ? 'Parsial'
                            : 'Matang'}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {SOURCE_LABELS[div.burnRateSource] ?? div.burnRateSource}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatIDR(div.availableBalance)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {formatIDR(div.dailyBurnRate)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        div.riskLevel === 'kritis'
                          ? 'text-rose-700'
                          : div.riskLevel === 'perhatian'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {div.runwayDays === null
                        ? 'Stabil'
                        : `${div.runwayDays} hari`}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatIDR(div.projectedMonthEndBalance)}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {div.recommendedTopUp > 0 && dept ? (
                        canTopUp ? (
                          <button
                            type="button"
                            onClick={() => onOpenTopUp(dept)}
                            className="font-mono tabular-nums font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                          >
                            + {formatIDR(div.recommendedTopUp)}
                          </button>
                        ) : (
                          <span className="font-mono tabular-nums font-medium text-amber-700">
                            {formatIDR(div.recommendedTopUp)}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">Aman</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
