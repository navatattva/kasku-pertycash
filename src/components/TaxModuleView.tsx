import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Info,
  Receipt,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  Department,
  PermissionKey,
  PettyCashRequest,
  TaxModuleConfig,
} from '../types/pettycash.ts';
import { formatDateTime, formatIDR } from '../utils/formatters.ts';
import {
  calculateIndonesianTax,
  generateMonthlyReport,
  hasPermission,
  TAX_SCHEMES,
} from '../utils/pettycashLogic.ts';

interface TaxModuleViewProps {
  taxModule: TaxModuleConfig;
  departments: Department[];
  requests: PettyCashRequest[];
  currentMonthKey: string;
  userPermissions: readonly PermissionKey[];
  onUpdateTaxModule: (payload: {
    enabled?: boolean;
    enablePpn?: boolean;
    enablePph23?: boolean;
    enablePph21?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onNavigateModules: () => void;
}

export function TaxModuleView({
  taxModule,
  departments,
  requests,
  currentMonthKey,
  userPermissions,
  onUpdateTaxModule,
  onNavigateModules,
}: TaxModuleViewProps) {
  const canManageModules = hasPermission(userPermissions, 'modules:manage');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const monthlyReport = useMemo(
    () => generateMonthlyReport(currentMonthKey, departments, requests, []),
    [currentMonthKey, departments, requests]
  );

  const taxedTransactions = useMemo(
    () =>
      monthlyReport.transactions.filter(
        (tx) => tx.tax && tx.tax.taxType !== 'none'
      ),
    [monthlyReport.transactions]
  );

  if (!taxModule.enabled) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-2xl mx-auto">
        <SlidersHorizontal className="h-8 w-8 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">
          Modul Perhitungan Pajak Indonesia Sedang Nonaktif
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Aktifkan modul pajak untuk mencatat DPP, PPN Masukan 11%, PPh Pasal
          23 (2%), dan PPh Pasal 21 (TER 0,5% / 2,5%) langsung pada pengajuan
          kas kecil dan laporan bulanan.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {canManageModules && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onUpdateTaxModule({ enabled: true });
                setSaving(false);
              }}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {saving ? 'Mengaktifkan...' : 'Aktifkan Modul Pajak'}
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateModules}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kembali ke Pusat Modul
          </button>
        </div>
      </section>
    );
  }

  async function applyUpdate(patch: {
    enablePpn?: boolean;
    enablePph23?: boolean;
    enablePph21?: boolean;
  }) {
    setError('');
    setSaving(true);
    const res = await onUpdateTaxModule(patch);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Gagal memperbarui pengaturan skema pajak.');
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Rekap Pajak Bulan Ini */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Total PPN Masukan ({currentMonthKey})
          </p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-emerald-700">
            {formatIDR(monthlyReport.totalPpnInput)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Akumulasi PPN 11% dari pencairan disetujui
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Total Potongan PPh 21 &amp; 23
          </p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-amber-700">
            {formatIDR(monthlyReport.totalPphWithheld)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Wajib disetor/dilapor pada SPT Masa PPh
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            Transaksi Kena Pajak Bulan Ini
          </p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {taxedTransactions.length} Transaksi
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Dari total {monthlyReport.approvedCount} pencairan bulan ini
          </p>
        </div>
      </section>

      {/* Active Schemes Config */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-700" />
              <span>Skema Pajak Indonesia Aktif</span>
            </h2>
            <p className="text-xs text-slate-500">
              Skema yang dicentang otomatis tampil pada modal pengajuan kas
              kecil.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-slate-400">
              Diperbarui: {formatDateTime(taxModule.updatedAt)}
            </span>
            <button
              type="button"
              onClick={onNavigateModules}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
            >
              Pusat Modul
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 cursor-pointer hover:border-slate-300">
            <input
              type="checkbox"
              checked={taxModule.enablePpn}
              disabled={saving || !canManageModules}
              onChange={(e) => applyUpdate({ enablePpn: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
            />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                PPN Masukan 11%
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Eksklusif (+11%) &amp; Inklusif (sudah termasuk di struk) sesuai
                UU HPP &amp; PMK 131/2024.
              </span>
            </div>
          </label>

          <label className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 cursor-pointer hover:border-slate-300">
            <input
              type="checkbox"
              checked={taxModule.enablePph23}
              disabled={saving || !canManageModules}
              onChange={(e) => applyUpdate({ enablePph23: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
            />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                PPh Pasal 23 (2%)
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Pemotongan 2% atas jasa bengkel, servis armada, atau sewa alat
                bongkar muat.
              </span>
            </div>
          </label>

          <label className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 cursor-pointer hover:border-slate-300">
            <input
              type="checkbox"
              checked={taxModule.enablePph21}
              disabled={saving || !canManageModules}
              onChange={(e) => applyUpdate({ enablePph21: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
            />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                PPh Pasal 21 (TER 0,5% &amp; Jasa 2,5%)
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Upah buruh harian &gt; Rp 450rb/hari (PP 58/2023) &amp; jasa
                perorangan non-pegawai.
              </span>
            </div>
          </label>
        </div>

        {error && (
          <p className="text-xs font-medium text-rose-700" role="alert">
            {error}
          </p>
        )}

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 flex items-start gap-2.5 text-xs text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <span>
            Saldo kas kecil divisi selalu dipotong sebesar{' '}
            <strong>Kas Keluar Bersih</strong> setelah perhitungan PPN/PPh, dan
            rekap pajak ikut terekspor otomatis ke CSV Laporan Bulanan.
          </span>
        </div>
      </section>

      {/* Reference Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Simulasi Tarif Pajak Indonesia (Contoh Nota Rp 1.000.000)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Referensi cepat DPP, PPN Masukan, Potongan PPh, dan Kas Keluar
              Bersih.
            </p>
          </div>
          <Info className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">Skema Pajak</th>
                <th className="py-3 px-4 text-right">Tarif</th>
                <th className="py-3 px-4 text-right">DPP</th>
                <th className="py-3 px-4 text-right">PPN Masukan</th>
                <th className="py-3 px-4 text-right">Potongan PPh</th>
                <th className="py-3 px-4 text-right">Kas Keluar Bersih</th>
                <th className="py-3 px-4">Keterangan Logistik Kargo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TAX_SCHEMES.filter((s) => s.id !== 'none').map((scheme) => {
                const sim = calculateIndonesianTax(1_000_000, scheme.id);
                return (
                  <tr key={scheme.id}>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {scheme.shortLabel}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {scheme.ratePct}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {formatIDR(sim.dppAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                      {sim.ppnAmount > 0 ? `+${formatIDR(sim.ppnAmount)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700 whitespace-nowrap">
                      {sim.pphAmount > 0 ? `-${formatIDR(sim.pphAmount)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatIDR(sim.netDisbursed)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 min-w-[260px]">
                      {scheme.description}
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
