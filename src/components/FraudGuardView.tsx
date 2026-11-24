import { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  Department,
  FraudGuardConfig,
  MasterCategory,
  PermissionKey,
  PettyCashRequest,
} from '../types/pettycash.ts';
import {
  formatDateTime,
  formatIDR,
  formatNumberInput,
  parseFormattedNumber,
} from '../utils/formatters.ts';
import {
  auditExistingRequestFraudSignals,
  hasPermission,
} from '../utils/pettycashLogic.ts';

interface FraudGuardViewProps {
  fraudGuard: FraudGuardConfig;
  requests: PettyCashRequest[];
  departments: Department[];
  categories: MasterCategory[];
  userPermissions: readonly PermissionKey[];
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
  onNavigateApprovals: () => void;
  onNavigateModules: () => void;
}

export function FraudGuardView({
  fraudGuard,
  requests,
  departments,
  categories,
  userPermissions,
  onUpdateFraudGuard,
  onNavigateApprovals,
  onNavigateModules,
}: FraudGuardViewProps) {
  const canManageModules = hasPermission(userPermissions, 'modules:manage');
  const canViewApprovals = hasPermission(userPermissions, 'approvals:view');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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

  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments]
  );

  const auditedRequests = useMemo(() => {
    return requests
      .filter((r) => r.status !== 'rejected')
      .map((req) => ({
        req,
        signals: auditExistingRequestFraudSignals(
          req,
          fraudGuard,
          requests,
          categories
        ),
      }))
      .filter((item) => item.signals.length > 0);
  }, [requests, fraudGuard, categories]);

  if (!fraudGuard.enabled) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-2xl mx-auto">
        <SlidersHorizontal className="h-8 w-8 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">
          Guard Anti-Fraud &amp; Anti-Korupsi Sedang Nonaktif
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Aktifkan guard ini untuk mewajibkan lampiran foto nota, memblokir
          surat jalan ganda, membatasi plafon per transaksi, dan mendeteksi
          klaim pecah nota secara otomatis.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {canManageModules && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onUpdateFraudGuard({ enabled: true });
                setSaving(false);
              }}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {saving ? 'Mengaktifkan...' : 'Aktifkan Guard Anti-Fraud'}
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

  async function applyGuardUpdate(patch: {
    requireReceiptImage?: boolean;
    receiptRequiredMinAmount?: number;
    blockDuplicateReceiptRef?: boolean;
    preventSelfApproval?: boolean;
    detectDuplicateClaimWindowHours?: number;
    highValueAlertAmount?: number;
    maxSingleRequestAmount?: number;
  }) {
    setError('');
    setSaving(true);
    const res = await onUpdateFraudGuard(patch);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Gagal menyimpan pengaturan guard anti-fraud.');
    }
  }

  async function handleSaveThresholds(e: React.FormEvent) {
    e.preventDefault();
    await applyGuardUpdate({
      receiptRequiredMinAmount: parseFormattedNumber(receiptMinStr),
      maxSingleRequestAmount: parseFormattedNumber(maxSingleStr),
      highValueAlertAmount: parseFormattedNumber(highValueStr),
      detectDuplicateClaimWindowHours: Math.max(
        1,
        Math.min(168, Math.round(Number(dupWindowStr) || 48))
      ),
    });
  }

  return (
    <div className="space-y-6">
      {/* Rule Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              <span>Aturan Penegakan &amp; Ambang Guard Anti-Fraud</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Diperbarui: {formatDateTime(fraudGuard.updatedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateModules}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
          >
            Pusat Modul
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 cursor-pointer hover:border-slate-300">
            <input
              type="checkbox"
              checked={fraudGuard.requireReceiptImage}
              disabled={saving || !canManageModules}
              onChange={(e) =>
                applyGuardUpdate({ requireReceiptImage: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
            />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                Wajib Foto Nota / Struk
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Menolak pengajuan baru tanpa foto nota/invoice pada batas
                nominal yang ditetapkan.
              </span>
            </div>
          </label>

          <label className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 cursor-pointer hover:border-slate-300">
            <input
              type="checkbox"
              checked={fraudGuard.blockDuplicateReceiptRef}
              disabled={saving || !canManageModules}
              onChange={(e) =>
                applyGuardUpdate({ blockDuplicateReceiptRef: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
            />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                Blokir No. Bukti / SJ Ganda
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Mencegah struk atau nomor surat jalan yang sama diklaim ulang.
              </span>
            </div>
          </label>

          <label className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 cursor-pointer hover:border-slate-300">
            <input
              type="checkbox"
              checked={fraudGuard.preventSelfApproval}
              disabled={saving || !canManageModules}
              onChange={(e) =>
                applyGuardUpdate({ preventSelfApproval: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
            />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                Segregation of Duties
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Pemohon tidak dapat menyetujui pengajuannya sendiri.
              </span>
            </div>
          </label>
        </div>

        <form
          onSubmit={handleSaveThresholds}
          className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="fg-receipt-min"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Wajib Foto Mulai (IDR)
              </label>
              <input
                id="fg-receipt-min"
                type="text"
                inputMode="numeric"
                disabled={!canManageModules}
                value={receiptMinStr}
                onChange={(e) =>
                  setReceiptMinStr(formatNumberInput(e.target.value))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="fg-max-single"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Plafon Maks / Transaksi (IDR)
              </label>
              <input
                id="fg-max-single"
                type="text"
                inputMode="numeric"
                disabled={!canManageModules}
                value={maxSingleStr}
                onChange={(e) =>
                  setMaxSingleStr(formatNumberInput(e.target.value))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="fg-high-value"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Peringatan Nilai Tinggi (IDR)
              </label>
              <input
                id="fg-high-value"
                type="text"
                inputMode="numeric"
                disabled={!canManageModules}
                value={highValueStr}
                onChange={(e) =>
                  setHighValueStr(formatNumberInput(e.target.value))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="fg-dup-window"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Jendela Klaim Kembar (Jam)
              </label>
              <input
                id="fg-dup-window"
                type="number"
                min={1}
                max={168}
                disabled={!canManageModules}
                value={dupWindowStr}
                onChange={(e) => setDupWindowStr(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              Wajib foto Rp{' '}
              {fraudGuard.receiptRequiredMinAmount.toLocaleString('id-ID')} ·
              Maks tunggal {formatIDR(fraudGuard.maxSingleRequestAmount)}
            </span>
            {canManageModules && (
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan Batas Guard'}
              </button>
            )}
          </div>
        </form>

        {error && (
          <p className="text-xs font-medium text-rose-700" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* Flagged Transactions Audit Queue */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span>Daftar Transaksi dengan Catatan Audit Guard</span>
            </h3>
            <p className="text-xs text-slate-500">
              Setiap pengajuan yang belum memiliki foto nota atau melewati batas
              peringatan langsung ditandai untuk pemeriksaan Direktur.
            </p>
          </div>
          {canViewApprovals && (
            <button
              type="button"
              onClick={onNavigateApprovals}
              className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap"
            >
              Buka Approval Direktur →
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {auditedRequests.map(({ req, signals }) => (
            <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-800">
                    {req.requestNumber}
                  </span>
                  <span>·</span>
                  <span>{deptMap.get(req.departmentId) ?? req.departmentId}</span>
                  <span>·</span>
                  <span>{req.requesterName}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {req.title}
                </p>
                <ul className="list-disc pl-4 text-xs text-rose-800 space-y-0.5">
                  {signals.map((s) => (
                    <li key={s.code}>
                      <strong>{s.title}:</strong> {s.detail}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sm:text-right shrink-0">
                <p className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                  {formatIDR(req.amount)}
                </p>
                <p className="text-xs text-slate-500">
                  {req.status === 'pending_director'
                    ? 'Menunggu Direktur'
                    : 'Sudah Dicairkan'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
