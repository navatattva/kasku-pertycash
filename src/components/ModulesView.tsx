import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Layers,
  MessageSquare,
  Receipt,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';
import type {
  ColdForecastMethod,
  ForecastModuleConfig,
  FraudGuardConfig,
  PermissionKey,
  TaxModuleConfig,
  WhatsAppModuleConfig,
} from '../types/pettycash.ts';
import {
  formatDateTime,
  formatIDR,
  formatNumberInput,
  parseFormattedNumber,
} from '../utils/formatters.ts';
import { hasPermission } from '../utils/pettycashLogic.ts';
import type { NavTab } from './Sidebar.tsx';

type ModuleCardId = 'fraud-guard' | 'forecast' | 'tax' | 'whatsapp';

interface ModulesViewProps {
  taxModule: TaxModuleConfig;
  forecastModule: ForecastModuleConfig;
  fraudGuard: FraudGuardConfig;
  whatsappModule: WhatsAppModuleConfig;
  userPermissions: readonly PermissionKey[];
  onUpdateTaxModule: (payload: {
    enabled?: boolean;
    enablePpn?: boolean;
    enablePph23?: boolean;
    enablePph21?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateForecastModule: (payload: {
    enabled?: boolean;
    coldStartMethod?: ColdForecastMethod;
    budgetUtilizationAssumptionPct?: number;
    horizonDays?: 14 | 30 | 60;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateFraudGuard: (payload: {
    enabled?: boolean;
    requireReceiptImage?: boolean;
    receiptRequiredMinAmount?: number;
    blockDuplicateReceiptRef?: boolean;
    preventSelfApproval?: boolean;
    detectDuplicateClaimWindowHours?: number;
    highValueAlertAmount?: number;
    maxSingleRequestAmount?: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateWhatsAppModule: (payload: {
    enabled?: boolean;
    directorPhone?: string;
    autoSendOnNewRequest?: boolean;
    autoSendOnDecision?: boolean;
    lowBalanceReminder?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onNavigateTab: (tab: NavTab) => void;
}

export function ModulesView({
  taxModule,
  forecastModule,
  fraudGuard,
  whatsappModule,
  userPermissions,
  onUpdateTaxModule,
  onUpdateForecastModule,
  onUpdateFraudGuard,
  onUpdateWhatsAppModule,
  onNavigateTab,
}: ModulesViewProps) {
  const canManageModules = hasPermission(userPermissions, 'modules:manage');
  const [selectedConfigId, setSelectedConfigId] =
    useState<ModuleCardId | null>(null);
  const [busyModule, setBusyModule] = useState<ModuleCardId | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Forecast local inputs
  const [assumptionInput, setAssumptionInput] = useState(
    String(forecastModule.budgetUtilizationAssumptionPct)
  );

  // Fraud Guard local inputs
  const [receiptMinStr, setReceiptMinStr] = useState(
    formatNumberInput(String(fraudGuard.receiptRequiredMinAmount))
  );
  const [maxSingleStr, setMaxSingleStr] = useState(
    formatNumberInput(String(fraudGuard.maxSingleRequestAmount))
  );
  const [highValueStr, setHighValueStr] = useState(
    formatNumberInput(String(fraudGuard.highValueAlertAmount))
  );
  const [dupWindowStr, setDupWindowStr] = useState(
    String(fraudGuard.detectDuplicateClaimWindowHours)
  );

  // WhatsApp local phone input
  const [waPhoneInput, setWaPhoneInput] = useState(
    whatsappModule.directorPhone
  );

  useEffect(() => {
    setAssumptionInput(String(forecastModule.budgetUtilizationAssumptionPct));
  }, [forecastModule.budgetUtilizationAssumptionPct]);

  useEffect(() => {
    setReceiptMinStr(
      formatNumberInput(String(fraudGuard.receiptRequiredMinAmount))
    );
    setMaxSingleStr(
      formatNumberInput(String(fraudGuard.maxSingleRequestAmount))
    );
    setHighValueStr(
      formatNumberInput(String(fraudGuard.highValueAlertAmount))
    );
    setDupWindowStr(String(fraudGuard.detectDuplicateClaimWindowHours));
  }, [
    fraudGuard.receiptRequiredMinAmount,
    fraudGuard.maxSingleRequestAmount,
    fraudGuard.highValueAlertAmount,
    fraudGuard.detectDuplicateClaimWindowHours,
  ]);

  useEffect(() => {
    setWaPhoneInput(whatsappModule.directorPhone);
  }, [whatsappModule.directorPhone]);

  const activeCount =
    (fraudGuard.enabled ? 1 : 0) +
    (forecastModule.enabled ? 1 : 0) +
    (taxModule.enabled ? 1 : 0) +
    (whatsappModule.enabled ? 1 : 0);

  async function toggleGuard() {
    setErrorMsg('');
    setBusyModule('fraud-guard');
    const res = await onUpdateFraudGuard({ enabled: !fraudGuard.enabled });
    setBusyModule(null);
    if (!res.ok) setErrorMsg(res.error || 'Gagal memperbarui Guard Anti-Fraud.');
  }

  async function toggleForecast() {
    setErrorMsg('');
    setBusyModule('forecast');
    const res = await onUpdateForecastModule({
      enabled: !forecastModule.enabled,
    });
    setBusyModule(null);
    if (!res.ok) setErrorMsg(res.error || 'Gagal memperbarui Modul Forecast.');
  }

  async function toggleTax() {
    setErrorMsg('');
    setBusyModule('tax');
    const res = await onUpdateTaxModule({ enabled: !taxModule.enabled });
    setBusyModule(null);
    if (!res.ok) setErrorMsg(res.error || 'Gagal memperbarui Modul Pajak.');
  }

  async function toggleWhatsApp() {
    setErrorMsg('');
    setBusyModule('whatsapp');
    const res = await onUpdateWhatsAppModule({
      enabled: !whatsappModule.enabled,
    });
    setBusyModule(null);
    if (!res.ok) setErrorMsg(res.error || 'Gagal memperbarui Modul WhatsApp.');
  }

  const moduleCards: {
    id: ModuleCardId;
    title: string;
    category: string;
    enabled: boolean;
    defaultLabel: string;
    description: string;
    summaryLine: string;
    updatedAt: string;
    toggleLabel: string;
    sidebarMenuName: string;
    icon: typeof ShieldCheck;
    onToggle: () => Promise<void>;
  }[] = [
    {
      id: 'fraud-guard',
      title: 'Guard Anti-Fraud & Anti-Korupsi',
      category: 'Pengendalian Internal Kas',
      enabled: fraudGuard.enabled,
      defaultLabel: 'Aktif (Default)',
      description:
        'Menutup celah manipulasi kas kecil: wajib foto struk asli, blokir nomor surat jalan ganda, plafon per transaksi, cegah self-approval, dan deteksi pecah nota.',
      summaryLine: fraudGuard.enabled
        ? `Maks tunggal ${formatIDR(fraudGuard.maxSingleRequestAmount)} · Jendela ${fraudGuard.detectDuplicateClaimWindowHours} jam`
        : 'Seluruh aturan proteksi anti-fraud sedang dinonaktifkan',
      updatedAt: fraudGuard.updatedAt,
      toggleLabel: fraudGuard.enabled
        ? 'Nonaktifkan Guard Anti-Fraud'
        : 'Aktifkan Guard Anti-Fraud',
      sidebarMenuName: 'Guard Anti-Fraud',
      icon: fraudGuard.enabled ? ShieldCheck : ShieldAlert,
      onToggle: toggleGuard,
    },
    {
      id: 'forecast',
      title: 'Modul Forecast & Cold-Start Kas',
      category: 'Proyeksi Likuiditas',
      enabled: forecastModule.enabled,
      defaultLabel: 'Nonaktif (Default)',
      description:
        'Memproyeksikan ketahanan saldo (runway), perkiraan tanggal kas habis, dan rekomendasi top-up—tetap akurat saat data kosong lewat metode Cold-Start.',
      summaryLine: `Horizon ${forecastModule.horizonDays} hari · Serapan Cold-Start ${forecastModule.budgetUtilizationAssumptionPct}%`,
      updatedAt: forecastModule.updatedAt,
      toggleLabel: forecastModule.enabled
        ? 'Nonaktifkan Modul Forecast'
        : 'Aktifkan Modul Forecast',
      sidebarMenuName: 'Forecast Kas',
      icon: TrendingUp,
      onToggle: toggleForecast,
    },
    {
      id: 'tax',
      title: 'Modul Pajak Indonesia (PPN & PPh)',
      category: 'Kepatuhan Fiskal',
      enabled: taxModule.enabled,
      defaultLabel: 'Nonaktif (Default)',
      description:
        'Perhitungan otomatis DPP, PPN Masukan 11%, pemotongan PPh Pasal 23 (2%) jasa vendor, dan PPh Pasal 21 (TER 0,5% / jasa 2,5%) pada nota kargo.',
      summaryLine: [
        taxModule.enablePpn ? 'PPN 11%' : null,
        taxModule.enablePph23 ? 'PPh 23' : null,
        taxModule.enablePph21 ? 'PPh 21' : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Belum ada skema pajak dicentang',
      updatedAt: taxModule.updatedAt,
      toggleLabel: taxModule.enabled
        ? 'Nonaktifkan Modul Pajak'
        : 'Aktifkan Modul Pajak',
      sidebarMenuName: 'Pajak Indonesia',
      icon: Receipt,
      onToggle: toggleTax,
    },
    {
      id: 'whatsapp',
      title: 'Modul Notifikasi WhatsApp Direktur',
      category: 'Komunikasi & Otorisasi Cepat',
      enabled: whatsappModule.enabled,
      defaultLabel: 'Nonaktif (Default)',
      description:
        'Membuat format ringkasan pengajuan kas kecil, konfirmasi keputusan approval, serta peringatan saldo divisi menipis untuk dikirim cepat ke WhatsApp Direktur.',
      summaryLine: `Nomor Direktur: +${whatsappModule.directorPhone} · ${
        whatsappModule.autoSendOnNewRequest ? 'Auto-antre aktif' : 'Manual'
      }`,
      updatedAt: whatsappModule.updatedAt,
      toggleLabel: whatsappModule.enabled
        ? 'Nonaktifkan Modul WhatsApp'
        : 'Aktifkan Modul WhatsApp',
      sidebarMenuName: 'Notifikasi WhatsApp',
      icon: MessageSquare,
      onToggle: toggleWhatsApp,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-700 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900">
              Pusat Modul Tambahan &amp; Pengendalian KasKu Kargo
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
            Aktifkan atau nonaktifkan setiap modul sesuai kebutuhan operasional
            perusahaan. Modul yang aktif otomatis muncul di grup{' '}
            <strong>Modul Aktif</strong> pada menu navigasi sebelah kiri.
          </p>
        </div>

        <div className="shrink-0 sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Status Modul Sistem
          </p>
          <p className="mt-0.5 font-mono tabular-nums text-xl font-bold text-slate-900">
            <span className="text-emerald-700">{activeCount}</span>
            <span className="text-slate-400 text-sm"> / 4 Aktif</span>
          </p>
        </div>
      </section>

      {errorMsg && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700"
        >
          {errorMsg}
        </p>
      )}

      {/* 2x2 Unified Card Grid */}
      <section
        aria-label="Daftar Modul KasKu Kargo"
        className="grid grid-cols-1 md:grid-cols-2 gap-5"
      >
        {moduleCards.map((card) => {
          const Icon = card.icon;
          const isBusy = busyModule === card.id;
          const isConfiguring = selectedConfigId === card.id;

          return (
            <article
              key={card.id}
              data-testid={`module-card-${card.id}`}
              className={`bg-white rounded-xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                card.enabled
                  ? 'border-emerald-700/35'
                  : 'border-slate-200'
              }`}
            >
              <div className="space-y-3">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        card.enabled
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-500">
                        {card.category}
                      </p>
                      <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                        {card.title}
                      </h3>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                      card.enabled ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {card.enabled ? 'Aktif' : card.defaultLabel}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 leading-relaxed">
                  {card.description}
                </p>

                {/* Live Summary Strip */}
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-slate-700 truncate">
                    {card.summaryLine}
                  </span>
                  <span className="font-mono text-slate-400 whitespace-nowrap">
                    {formatDateTime(card.updatedAt)}
                  </span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {canManageModules && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedConfigId(isConfiguring ? null : card.id)
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        isConfiguring
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      <span>{isConfiguring ? 'Tutup' : 'Pengaturan'}</span>
                    </button>
                  )}

                  {card.enabled && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab(card.id)}
                      aria-label={`Buka ${card.sidebarMenuName}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/30 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                    >
                      <span>Buka Menu</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {canManageModules ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={card.enabled}
                    aria-label={card.toggleLabel}
                    disabled={isBusy}
                    onClick={card.onToggle}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
                      card.enabled
                        ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                        : 'bg-emerald-700 text-white hover:bg-emerald-800'
                    }`}
                  >
                    {card.enabled ? 'Nonaktifkan' : card.toggleLabel}
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">
                    Mode Baca
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* Inline Parameter Panel when "Pengaturan" is clicked */}
      {canManageModules && selectedConfigId === 'fraud-guard' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Pengaturan Cepat: Guard Anti-Fraud &amp; Anti-Korupsi
              </h3>
              <p className="text-xs text-slate-500">
                Atur aturan validasi nota dan ambang batas persetujuan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedConfigId(null)}
              aria-label="Tutup panel pengaturan"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="rounded-lg border border-slate-200 p-3 flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={fraudGuard.requireReceiptImage}
                disabled={!fraudGuard.enabled}
                onChange={(e) =>
                  onUpdateFraudGuard({ requireReceiptImage: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
              />
              <span>
                <strong className="block text-slate-900">
                  Wajib Foto Nota / Struk
                </strong>
                <span className="text-slate-500">
                  Tolak pengajuan tanpa lampiran foto nota.
                </span>
              </span>
            </label>

            <label className="rounded-lg border border-slate-200 p-3 flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={fraudGuard.blockDuplicateReceiptRef}
                disabled={!fraudGuard.enabled}
                onChange={(e) =>
                  onUpdateFraudGuard({
                    blockDuplicateReceiptRef: e.target.checked,
                  })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
              />
              <span>
                <strong className="block text-slate-900">
                  Blokir No. Bukti / SJ Ganda
                </strong>
                <span className="text-slate-500">
                  Cegah nomor bukti yang sama diklaim ulang.
                </span>
              </span>
            </label>

            <label className="rounded-lg border border-slate-200 p-3 flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={fraudGuard.preventSelfApproval}
                disabled={!fraudGuard.enabled}
                onChange={(e) =>
                  onUpdateFraudGuard({ preventSelfApproval: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
              />
              <span>
                <strong className="block text-slate-900">
                  Segregation of Duties
                </strong>
                <span className="text-slate-500">
                  Pemohon tidak bisa menyetujui pengajuannya sendiri.
                </span>
              </span>
            </label>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onUpdateFraudGuard({
                receiptRequiredMinAmount: parseFormattedNumber(receiptMinStr),
                maxSingleRequestAmount: parseFormattedNumber(maxSingleStr),
                highValueAlertAmount: parseFormattedNumber(highValueStr),
                detectDuplicateClaimWindowHours: Math.max(
                  1,
                  Math.min(720, Math.round(Number(dupWindowStr) || 48))
                ),
              });
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Wajib Foto Mulai (IDR)
              </label>
              <input
                type="text"
                inputMode="numeric"
                disabled={!fraudGuard.enabled}
                value={receiptMinStr}
                onChange={(e) =>
                  setReceiptMinStr(formatNumberInput(e.target.value))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plafon Maks / Nota (IDR)
              </label>
              <input
                type="text"
                inputMode="numeric"
                disabled={!fraudGuard.enabled}
                value={maxSingleStr}
                onChange={(e) =>
                  setMaxSingleStr(formatNumberInput(e.target.value))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alert Nilai Tinggi (IDR)
              </label>
              <input
                type="text"
                inputMode="numeric"
                disabled={!fraudGuard.enabled}
                value={highValueStr}
                onChange={(e) =>
                  setHighValueStr(formatNumberInput(e.target.value))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jendela Klaim Kembar (Jam)
              </label>
              <input
                type="number"
                min={1}
                max={720}
                disabled={!fraudGuard.enabled}
                value={dupWindowStr}
                onChange={(e) => setDupWindowStr(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!fraudGuard.enabled}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Simpan Batas
            </button>
          </form>
        </section>
      )}

      {canManageModules && selectedConfigId === 'forecast' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Pengaturan Cepat: Modul Forecast &amp; Cold-Start Kas
              </h3>
              <p className="text-xs text-slate-500">
                Tentukan metode estimasi saat data historis belum tersedia.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedConfigId(null)}
              aria-label="Tutup panel pengaturan"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Metode Cold-Start
              </label>
              <select
                disabled={!forecastModule.enabled}
                value={forecastModule.coldStartMethod}
                onChange={(e) =>
                  onUpdateForecastModule({
                    coldStartMethod: e.target.value as ColdForecastMethod,
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="budget_baseline">
                  Baseline Plafon Bulanan (Direkomendasikan)
                </option>
                <option value="hybrid_historical">
                  Blended Historis + Plafon
                </option>
                <option value="zero_conservative">
                  Aktual Murni (Rp 0 jika kosong)
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Asumsi Serapan Cold-Start (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={100}
                  step={5}
                  disabled={!forecastModule.enabled}
                  value={assumptionInput}
                  onChange={(e) => setAssumptionInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                />
                <button
                  type="button"
                  disabled={!forecastModule.enabled}
                  onClick={() =>
                    onUpdateForecastModule({
                      budgetUtilizationAssumptionPct: Math.max(
                        10,
                        Math.min(100, Math.round(Number(assumptionInput) || 70))
                      ),
                    })
                  }
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Simpan
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Horizon Proyeksi Default
              </label>
              <select
                disabled={!forecastModule.enabled}
                value={forecastModule.horizonDays}
                onChange={(e) =>
                  onUpdateForecastModule({
                    horizonDays: Number(e.target.value) as 14 | 30 | 60,
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value={14}>14 Hari Ke Depan</option>
                <option value={30}>30 Hari Ke Depan</option>
                <option value={60}>60 Hari Ke Depan</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {canManageModules && selectedConfigId === 'tax' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Pengaturan Cepat: Modul Pajak Indonesia
              </h3>
              <p className="text-xs text-slate-500">
                Pilih skema pajak yang ditampilkan pada form pengajuan petty cash.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedConfigId(null)}
              aria-label="Tutup panel pengaturan"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="rounded-lg border border-slate-200 p-3 flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={taxModule.enablePpn}
                disabled={!taxModule.enabled}
                onChange={(e) =>
                  onUpdateTaxModule({ enablePpn: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
              />
              <span>
                <strong className="block text-slate-900">PPN Masukan 11%</strong>
                <span className="text-slate-500">
                  Eksklusif &amp; Inklusif sesuai UU HPP.
                </span>
              </span>
            </label>
            <label className="rounded-lg border border-slate-200 p-3 flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={taxModule.enablePph23}
                disabled={!taxModule.enabled}
                onChange={(e) =>
                  onUpdateTaxModule({ enablePph23: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
              />
              <span>
                <strong className="block text-slate-900">PPh Pasal 23 (2%)</strong>
                <span className="text-slate-500">
                  Jasa servis armada, sewa alat, &amp; vendor badan.
                </span>
              </span>
            </label>
            <label className="rounded-lg border border-slate-200 p-3 flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={taxModule.enablePph21}
                disabled={!taxModule.enabled}
                onChange={(e) =>
                  onUpdateTaxModule({ enablePph21: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
              />
              <span>
                <strong className="block text-slate-900">
                  PPh Pasal 21 (TER 0,5% &amp; 2,5%)
                </strong>
                <span className="text-slate-500">
                  Upah harian bongkar muat &amp; jasa perorangan.
                </span>
              </span>
            </label>
          </div>
        </section>
      )}

      {canManageModules && selectedConfigId === 'whatsapp' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Pengaturan Cepat: Modul Notifikasi WhatsApp Direktur
              </h3>
              <p className="text-xs text-slate-500">
                Simpan nomor WhatsApp tujuan dan pemicu notifikasi otomatis.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedConfigId(null)}
              aria-label="Tutup panel pengaturan"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onUpdateWhatsAppModule({ directorPhone: waPhoneInput });
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-[260px] flex-1 max-w-sm">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor WhatsApp Direktur (08xx / 628xx)
              </label>
              <input
                type="text"
                value={waPhoneInput}
                onChange={(e) => setWaPhoneInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Simpan Nomor WA
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="rounded-lg border border-slate-200 p-3 flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappModule.autoSendOnNewRequest}
                disabled={!whatsappModule.enabled}
                onChange={(e) =>
                  onUpdateWhatsAppModule({
                    autoSendOnNewRequest: e.target.checked,
                  })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
              />
              <span>
                <strong className="block text-slate-900">
                  Notifikasi Pengajuan Baru
                </strong>
                <span className="text-slate-500">
                  Catat ringkasan pengajuan ke log WA secara otomatis.
                </span>
              </span>
            </label>
            <label className="rounded-lg border border-slate-200 p-3 flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappModule.autoSendOnDecision}
                disabled={!whatsappModule.enabled}
                onChange={(e) =>
                  onUpdateWhatsAppModule({
                    autoSendOnDecision: e.target.checked,
                  })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
              />
              <span>
                <strong className="block text-slate-900">
                  Konfirmasi Approval / Tolak
                </strong>
                <span className="text-slate-500">
                  Siapkan notifikasi status keputusan Direktur.
                </span>
              </span>
            </label>
            <label className="rounded-lg border border-slate-200 p-3 flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappModule.lowBalanceReminder}
                disabled={!whatsappModule.enabled}
                onChange={(e) =>
                  onUpdateWhatsAppModule({
                    lowBalanceReminder: e.target.checked,
                  })
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
              />
              <span>
                <strong className="block text-slate-900">
                  Pengingat Saldo Menipis
                </strong>
                <span className="text-slate-500">
                  Aktifkan template pengingat top-up divisi.
                </span>
              </span>
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
