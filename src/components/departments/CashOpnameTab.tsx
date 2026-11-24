import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, ShieldCheck } from 'lucide-react';
import {
  INDONESIAN_DENOMINATIONS,
  type AuthUserPublic,
  type CashOpnameRecord,
  type Department,
} from '../../types/pettycash.ts';
import { formatDateTime, formatIDR } from '../../utils/formatters.ts';
import { calculateOpnameSummary } from '../../utils/pettycashLogic.ts';

interface CashOpnameTabProps {
  activeDepts: Department[];
  deptMap: Map<string, Department>;
  opnames: CashOpnameRecord[];
  canCreateOpname: boolean;
  currentUser: AuthUserPublic;
  currentRoleName: string;
  onCreateOpname: (payload: {
    departmentId: string;
    note: string;
    denominations: { denomination: number; count: number }[];
  }) => Promise<{ ok: boolean; error?: string }>;
  onSelectOpnameDetail: (op: CashOpnameRecord) => void;
}

export function CashOpnameTab({
  activeDepts,
  deptMap,
  opnames,
  canCreateOpname,
  currentUser,
  currentRoleName,
  onCreateOpname,
  onSelectOpnameDetail,
}: CashOpnameTabProps) {
  const [opnameDeptId, setOpnameDeptId] = useState<string>(
    activeDepts[0]?.id ?? ''
  );
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    for (const d of INDONESIAN_DENOMINATIONS) init[d] = 0;
    return init;
  });
  const [opnameNote, setOpnameNote] = useState('');
  const [opnameError, setOpnameError] = useState('');
  const [submittingOpname, setSubmittingOpname] = useState(false);

  const selectedOpnameDept = deptMap.get(opnameDeptId) ?? activeDepts[0];

  const liveOpnameSummary = useMemo(
    () =>
      calculateOpnameSummary(
        selectedOpnameDept?.balance ?? 0,
        denomCounts
      ),
    [selectedOpnameDept, denomCounts]
  );

  function updateDenomCount(denom: number, raw: string) {
    const digits = raw.replace(/\D/g, '');
    const parsed = digits ? Math.min(100_000, Number(digits)) : 0;
    setDenomCounts((prev) => ({ ...prev, [denom]: parsed }));
  }

  function resetOpnameCounts() {
    const zero: Record<number, number> = {};
    for (const d of INDONESIAN_DENOMINATIONS) zero[d] = 0;
    setDenomCounts(zero);
    setOpnameNote('');
    setOpnameError('');
  }

  async function handleSaveOpname(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOpnameDept || !canCreateOpname) return;
    setOpnameError('');
    setSubmittingOpname(true);
    const res = await onCreateOpname({
      departmentId: selectedOpnameDept.id,
      note: opnameNote,
      denominations: INDONESIAN_DENOMINATIONS.map((denomination) => ({
        denomination,
        count: denomCounts[denomination] ?? 0,
      })),
    });
    setSubmittingOpname(false);
    if (!res.ok) {
      setOpnameError(res.error || 'Gagal menyimpan berita acara cash opname.');
      return;
    }
    resetOpnameCounts();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Denomination Counter Form */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Formulir Hitung Fisik Kas (Cash Opname)
              </h2>
              <p className="text-xs text-slate-500">
                Hitung jumlah lembar/keping uang tunai di laci/brankas dan
                cocokkan dengan saldo buku sistem.
              </p>
            </div>
            <button
              type="button"
              onClick={resetOpnameCounts}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Reset Hitungan
            </button>
          </div>

          <form onSubmit={handleSaveOpname} className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="opname-dept-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Divisi / Brankas yang Diperiksa
                </label>
                <select
                  id="opname-dept-select"
                  value={selectedOpnameDept?.id ?? ''}
                  onChange={(e) => setOpnameDeptId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none"
                >
                  {activeDepts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Petugas Penghitung Tercatat</span>
                </p>
                <p className="mt-0.5 font-semibold text-slate-900 truncate">
                  {currentUser.name}{' '}
                  <span className="font-normal text-slate-600">
                    · {currentRoleName}
                  </span>
                </p>
              </div>
            </div>

            {/* Denomination Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Pecahan Rupiah</th>
                    <th className="py-2.5 px-3 text-center">
                      Jumlah (Lembar / Keping)
                    </th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {liveOpnameSummary.denominations.map((row) => (
                    <tr key={row.denomination}>
                      <td className="py-2 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                        {formatIDR(row.denomination)}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          disabled={!canCreateOpname}
                          aria-label={`Jumlah pecahan ${row.denomination}`}
                          value={denomCounts[row.denomination] ?? 0}
                          onChange={(e) =>
                            updateDenomCount(row.denomination, e.target.value)
                          }
                          className="w-24 rounded-md border border-slate-300 px-2.5 py-1 text-right font-mono tabular-nums text-xs text-slate-900 focus:border-emerald-700 focus:outline-none disabled:bg-slate-100"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatIDR(row.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <label
                htmlFor="opname-note"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Catatan Berita Acara{' '}
                {liveOpnameSummary.variance !== 0
                  ? '(Wajib diisi karena ada selisih)'
                  : '(Opsional)'}
              </label>
              <input
                id="opname-note"
                type="text"
                disabled={!canCreateOpname}
                value={opnameNote}
                onChange={(e) => setOpnameNote(e.target.value)}
                required={liveOpnameSummary.variance !== 0}
                placeholder={
                  liveOpnameSummary.variance !== 0
                    ? 'Jelaskan penyebab selisih kas fisik vs saldo buku...'
                    : 'Contoh: Pemeriksaan kas tutup buku harian'
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-700 focus:outline-none disabled:bg-slate-100"
              />
            </div>

            {opnameError && (
              <p className="text-xs font-medium text-rose-700" role="alert">
                {opnameError}
              </p>
            )}

            <div className="flex items-center justify-end">
              {canCreateOpname ? (
                <button
                  type="submit"
                  disabled={submittingOpname || !selectedOpnameDept}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {submittingOpname
                    ? 'Menyimpan...'
                    : 'Simpan Berita Acara Opname'}
                </button>
              ) : (
                <span className="text-xs text-slate-500">
                  Mode baca: Role Anda tidak memiliki izin mencatat opname baru.
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Right: Live Reconciliation Result */}
        <aside className="xl:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Hasil Rekonsiliasi Langsung
            </h3>
            <p className="text-xs text-slate-500">
              Divisi:{' '}
              <span className="font-semibold text-slate-800">
                {selectedOpnameDept?.name ?? '-'}
              </span>{' '}
              · PIC: {selectedOpnameDept?.picName ?? '-'}
            </p>

            <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Saldo Buku Sistem</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 text-sm">
                  {formatIDR(selectedOpnameDept?.balance ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">
                  Total Hitung Fisik Tunai
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 text-sm">
                  {formatIDR(liveOpnameSummary.physicalTotal)}
                </span>
              </div>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  Selisih Kas (Fisik − Sistem)
                </span>
                <span
                  className={`font-mono tabular-nums text-base font-semibold ${
                    liveOpnameSummary.status === 'matched'
                      ? 'text-emerald-700'
                      : liveOpnameSummary.status === 'over'
                      ? 'text-amber-700'
                      : 'text-rose-700'
                  }`}
                >
                  {liveOpnameSummary.variance > 0
                    ? `+${formatIDR(liveOpnameSummary.variance)}`
                    : formatIDR(liveOpnameSummary.variance)}
                </span>
              </div>
            </div>

            <div
              className={`rounded-lg border px-3.5 py-2.5 text-xs flex items-center gap-2 ${
                liveOpnameSummary.status === 'matched'
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                  : liveOpnameSummary.status === 'over'
                  ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                  : 'border-rose-200 bg-rose-50/70 text-rose-900'
              }`}
            >
              {liveOpnameSummary.status === 'matched' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>
                    <strong>Klop / Sesuai:</strong> Uang fisik cocok 100% dengan
                    catatan sistem.
                  </span>
                </>
              ) : liveOpnameSummary.status === 'over' ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>Selisih Lebih:</strong> Fisik melebihi catatan buku.
                    Wajib sertakan catatan audit.
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-rose-700 shrink-0" />
                  <span>
                    <strong>Selisih Kurang:</strong> Fisik kurang dari catatan
                    buku. Wajib sertakan catatan audit.
                  </span>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Opname History Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            Riwayat Berita Acara Cash Opname ({opnames.length})
          </h3>
          <p className="text-xs text-slate-500">
            Jejak pemeriksaan fisik kas kecil yang tersimpan permanen untuk
            audit Direktur.
          </p>
        </div>

        {opnames.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Belum ada berita acara cash opname tersimpan.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">No. Opname</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Divisi</th>
                  <th className="py-3 px-4">Penghitung</th>
                  <th className="py-3 px-4 text-right">Saldo Sistem</th>
                  <th className="py-3 px-4 text-right">Hitung Fisik</th>
                  <th className="py-3 px-4 text-right">Selisih</th>
                  <th className="py-3 px-4">Status &amp; Catatan</th>
                  <th className="py-3 px-4 text-right">Pecahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {opnames.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {op.opnameNumber}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDateTime(op.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                      {deptMap.get(op.departmentId)?.name ?? op.departmentId}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {op.countedBy}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {formatIDR(op.systemBalance)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatIDR(op.physicalTotal)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        op.status === 'matched'
                          ? 'text-emerald-700'
                          : op.status === 'over'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {op.variance > 0
                        ? `+${formatIDR(op.variance)}`
                        : formatIDR(op.variance)}
                    </td>
                    <td className="py-3 px-4 max-w-[260px]">
                      <span
                        className={`font-semibold ${
                          op.status === 'matched'
                            ? 'text-emerald-700'
                            : op.status === 'over'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {op.status === 'matched'
                          ? 'Klop'
                          : op.status === 'over'
                          ? 'Selisih Lebih'
                          : 'Selisih Kurang'}
                      </span>
                      <p className="text-slate-500 mt-0.5">{op.note}</p>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectOpnameDetail(op)}
                        aria-label={`Lihat rincian pecahan ${op.opnameNumber}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Rincian</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
