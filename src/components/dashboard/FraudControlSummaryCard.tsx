import { ShieldAlert, ShieldCheck, TrendingUp } from 'lucide-react';
import type { FraudGuardConfig } from '../../types/pettycash.ts';
import { formatIDR } from '../../utils/formatters.ts';

interface FraudControlSummaryCardProps {
  fraudGuard: FraudGuardConfig;
  activeRulesCount: number;
  pendingAlertCount: number;
  withPhotoCount: number;
  totalActiveCount: number;
  latestOpnameVariance: number;
  openKasbonsCount: number;
  forecastModuleEnabled: boolean;
  onNavigateApprovals: () => void;
  onNavigateDownPayments?: () => void;
  onNavigateDepartments: () => void;
  onNavigateForecast: () => void;
  onNavigateModules: () => void;
}

export function FraudControlSummaryCard({
  fraudGuard,
  activeRulesCount,
  pendingAlertCount,
  withPhotoCount,
  totalActiveCount,
  latestOpnameVariance,
  openKasbonsCount,
  forecastModuleEnabled,
  onNavigateApprovals,
  onNavigateDownPayments,
  onNavigateDepartments,
  onNavigateForecast,
  onNavigateModules,
}: FraudControlSummaryCardProps) {
  return (
    <article className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              {fraudGuard.enabled ? (
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-amber-600" />
              )}
              <span>Guard Anti-Fraud &amp; Pengendalian Internal</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lapisan proteksi otomatis untuk mencegah nota fiktif, klaim ganda,
              pecah nota, &amp; penyalahgunaan kas kecil.
            </p>
          </div>
          <span
            className={`text-xs font-semibold whitespace-nowrap ${
              fraudGuard.enabled ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {fraudGuard.enabled
              ? `${activeRulesCount}/5 Guard Aktif`
              : 'Guard Nonaktif'}
          </span>
        </div>

        {/* 3 Control KPIs */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-medium text-slate-500">
              Anomali Pengajuan Pending
            </p>
            <p
              data-testid="fraud-pending-alerts"
              className={`mt-1 font-mono tabular-nums text-lg font-semibold ${
                pendingAlertCount > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {pendingAlertCount} Pengajuan
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Ditandai untuk verifikasi teliti Direktur
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-medium text-slate-500">
              Kepatuhan Lampiran Foto Nota
            </p>
            <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-slate-900">
              {withPhotoCount}/{totalActiveCount} Nota
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {fraudGuard.requireReceiptImage
                ? 'Wajib unggah foto untuk pengajuan baru'
                : 'Lampiran foto bersifat opsional'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-medium text-slate-500">
              Selisih Cash Opname Fisik
            </p>
            <p
              className={`mt-1 font-mono tabular-nums text-lg font-semibold ${
                latestOpnameVariance === 0
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {latestOpnameVariance === 0
                ? 'Klop Rp 0'
                : `${latestOpnameVariance > 0 ? '+' : '-'}${formatIDR(
                    Math.abs(latestOpnameVariance)
                  )}`}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Akumulasi hasil hitung fisik terbaru
            </p>
          </div>
        </div>

        {/* Active Rules Matrix */}
        <div className="mt-4 divide-y divide-slate-100 border border-slate-200 rounded-lg px-4">
          <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-700 font-medium">
              1. Wajib Lampirkan Foto Nota / Invoice Asli
            </span>
            <span
              className={`font-mono font-semibold whitespace-nowrap ${
                fraudGuard.enabled && fraudGuard.requireReceiptImage
                  ? 'text-emerald-700'
                  : 'text-slate-400'
              }`}
            >
              {fraudGuard.enabled && fraudGuard.requireReceiptImage
                ? fraudGuard.receiptRequiredMinAmount > 0
                  ? `Aktif (≥ ${formatIDR(fraudGuard.receiptRequiredMinAmount)})`
                  : 'Blokir Otomatis (Semua)'
                : 'Off'}
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-700 font-medium">
              2. Blokir Nomor Nota / Surat Jalan Duplikat
            </span>
            <span
              className={`font-mono font-semibold whitespace-nowrap ${
                fraudGuard.enabled && fraudGuard.blockDuplicateReceiptRef
                  ? 'text-emerald-700'
                  : 'text-slate-400'
              }`}
            >
              {fraudGuard.enabled && fraudGuard.blockDuplicateReceiptRef
                ? 'Blokir Otomatis'
                : 'Off'}
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-700 font-medium">
              3. Batas Maksimal Kas Kecil per Pengajuan
            </span>
            <span className="font-mono font-semibold text-slate-800 whitespace-nowrap">
              {fraudGuard.enabled && fraudGuard.maxSingleRequestAmount > 0
                ? `Maks ${formatIDR(fraudGuard.maxSingleRequestAmount)}`
                : 'Tidak Dibatasi'}
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-700 font-medium">
              4. Pemisahan Wewenang (Cegah Self-Approval) &amp; Pecah Nota
            </span>
            <span
              className={`font-mono font-semibold whitespace-nowrap ${
                fraudGuard.enabled && fraudGuard.preventSelfApproval
                  ? 'text-emerald-700'
                  : 'text-slate-400'
              }`}
            >
              {fraudGuard.enabled
                ? `Aktif (${fraudGuard.detectDuplicateClaimWindowHours} jam)`
                : 'Off'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onNavigateApprovals}
            className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Periksa Antrean Approval →
          </button>
          {onNavigateDownPayments && (
            <button
              type="button"
              onClick={onNavigateDownPayments}
              className="font-semibold text-slate-700 hover:text-slate-900 hover:underline"
            >
              {openKasbonsCount > 0
                ? `${openKasbonsCount} Kasbon Aktif · Cek Kasbon →`
                : 'Cek Kasbon & Realisasi →'}
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateDepartments}
            className="font-semibold text-slate-700 hover:text-slate-900 hover:underline"
          >
            Cek Mutasi &amp; Cash Opname →
          </button>
        </div>
        <div className="flex items-center gap-3">
          {forecastModuleEnabled && (
            <button
              type="button"
              onClick={onNavigateForecast}
              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Buka Forecast Kas</span>
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateModules}
            className="font-semibold text-slate-600 hover:text-slate-900 hover:underline"
          >
            Atur Guard &amp; Modul
          </button>
        </div>
      </div>
    </article>
  );
}
