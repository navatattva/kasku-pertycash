import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import type {
  AuthUserPublic,
  CashOpnameRecord,
  ClosedPeriodRecord,
  DailyClosingRecord,
  Department,
  DownPaymentRecord,
  PermissionKey,
  PettyCashRequest,
  TopUpRecord,
} from '../types/pettycash.ts';
import {
  formatDateTime,
  formatIDR,
  formatMonthLabel,
} from '../utils/formatters.ts';
import {
  calculateDailyClosingSummary,
  generateMonthlyReport,
  hasPermission,
  isPeriodClosed,
} from '../utils/pettycashLogic.ts';

interface ClosingViewProps {
  departments: Department[];
  requests: PettyCashRequest[];
  topUps: TopUpRecord[];
  opnames: CashOpnameRecord[];
  downPayments: DownPaymentRecord[];
  dailyClosings: DailyClosingRecord[];
  closedPeriods: ClosedPeriodRecord[];
  userPermissions: readonly PermissionKey[];
  currentUser: AuthUserPublic;
  currentRoleName: string;
  serverTime: string;
  onCreateDailyClosing: (payload: {
    closingDate: string;
    departmentId: string;
    note: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onClosePeriod: (payload: {
    monthKey: string;
    note: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onReopenPeriod: (payload: {
    monthKey: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function ClosingView({
  departments,
  requests,
  topUps,
  opnames,
  downPayments,
  dailyClosings,
  closedPeriods,
  userPermissions,
  currentUser,
  currentRoleName,
  serverTime,
  onCreateDailyClosing,
  onClosePeriod,
  onReopenPeriod,
}: ClosingViewProps) {
  const activeDepts = useMemo(
    () => departments.filter((d) => d.active !== false),
    [departments]
  );
  const todayDate = (serverTime || new Date().toISOString()).slice(0, 10);

  const canDailyClosing = hasPermission(userPermissions, 'closing:daily');
  const canLockPeriod = hasPermission(userPermissions, 'closing:lock_period');
  const canReopenPeriod = hasPermission(
    userPermissions,
    'closing:reopen_period'
  );

  const [closingDate, setClosingDate] = useState(todayDate);
  const [selectedDeptId, setSelectedDeptId] = useState(
    activeDepts[0]?.id ?? departments[0]?.id ?? ''
  );
  const [closingNote, setClosingNote] = useState('');
  const [closingError, setClosingError] = useState('');
  const [submittingDaily, setSubmittingDaily] = useState(false);

  // Period lock modal state
  const [lockModalTarget, setLockModalTarget] = useState<{
    monthKey: string;
    action: 'lock' | 'unlock';
  } | null>(null);
  const [lockNote, setLockNote] = useState('');
  const [lockError, setLockError] = useState('');
  const [submittingLock, setSubmittingLock] = useState(false);

  const liveDailySummary = useMemo(
    () =>
      calculateDailyClosingSummary({
        closingDate,
        departmentId: selectedDeptId,
        departments,
        requests,
        topUps,
        downPayments,
        opnames,
      }),
    [
      closingDate,
      selectedDeptId,
      departments,
      requests,
      topUps,
      downPayments,
      opnames,
    ]
  );

  const dateLockedPeriod = isPeriodClosed(closingDate, closedPeriods);

  const periodRows = useMemo(() => {
    const monthSet = new Set<string>([todayDate.slice(0, 7)]);
    for (const r of requests) monthSet.add(r.createdAt.slice(0, 7));
    for (const t of topUps) monthSet.add(t.createdAt.slice(0, 7));
    for (const dp of downPayments) monthSet.add(dp.createdAt.slice(0, 7));
    for (const cp of closedPeriods) monthSet.add(cp.monthKey);

    return Array.from(monthSet)
      .filter((m) => /^\d{4}-\d{2}$/.test(m))
      .sort((a, b) => b.localeCompare(a))
      .map((monthKey) => {
        const closedRecord = closedPeriods.find(
          (cp) => cp.monthKey === monthKey
        );
        const report = generateMonthlyReport(
          monthKey,
          departments,
          requests,
          topUps,
          undefined,
          [],
          downPayments
        );
        const pendingKasbonCount = downPayments.filter(
          (dp) =>
            dp.status === 'pending_director' &&
            dp.createdAt.startsWith(monthKey)
        ).length;
        return {
          monthKey,
          closedRecord,
          report,
          pendingTotalCount: report.pendingCount + pendingKasbonCount,
        };
      });
  }, [todayDate, requests, topUps, downPayments, closedPeriods, departments]);

  async function handleSaveDailyClosing(e: React.FormEvent) {
    e.preventDefault();
    setClosingError('');
    setSubmittingDaily(true);
    const res = await onCreateDailyClosing({
      closingDate,
      departmentId: selectedDeptId,
      note: closingNote,
    });
    setSubmittingDaily(false);
    if (!res.ok) {
      setClosingError(res.error || 'Gagal menyimpan tutup kas harian.');
      return;
    }
    setClosingNote('');
  }

  async function handleConfirmLockModal(e: React.FormEvent) {
    e.preventDefault();
    if (!lockModalTarget) return;
    setLockError('');
    setSubmittingLock(true);
    const res =
      lockModalTarget.action === 'lock'
        ? await onClosePeriod({
            monthKey: lockModalTarget.monthKey,
            note: lockNote,
          })
        : await onReopenPeriod({
            monthKey: lockModalTarget.monthKey,
          });
    setSubmittingLock(false);
    if (!res.ok) {
      setLockError(res.error || 'Gagal memperbarui status kunci periode.');
      return;
    }
    setLockNote('');
    setLockModalTarget(null);
  }

  return (
    <div className="space-y-8">
      {/* SECTION 1: TUTUP KAS HARIAN */}
      <section aria-labelledby="daily-closing-heading" className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2
                id="daily-closing-heading"
                className="text-base font-semibold text-slate-900 flex items-center gap-2"
              >
                <CalendarCheck2 className="h-4 w-4 text-emerald-700" />
                <span>Tutup Kas Harian (Daily Closing)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Rekonsiliasi saldo awal, mutasi harian, fisik kas opname, dan
                posisi kasbon terbuka sebelum kas akhir hari ditutup.
              </p>
            </div>

            <form onSubmit={handleSaveDailyClosing} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="closing-date"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Tanggal Tutup Kas
                  </label>
                  <input
                    id="closing-date"
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-emerald-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="closing-dept"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Divisi Kas Kecil
                  </label>
                  <select
                    id="closing-dept"
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-700 focus:outline-none"
                  >
                    {activeDepts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Saldo Awal Hari ({closingDate})</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {formatIDR(liveDailySummary.openingBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Kas Masuk (Top-Up &amp; Sisa Kasbon)</span>
                  <span className="font-mono tabular-nums font-semibold">
                    +{formatIDR(liveDailySummary.totalInflow)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-rose-700">
                  <span>Kas Keluar (Pencairan &amp; Uang Muka)</span>
                  <span className="font-mono tabular-nums font-semibold">
                    -{formatIDR(liveDailySummary.totalOutflow)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-semibold text-slate-900">
                  <span>Saldo Akhir Sistem</span>
                  <span className="font-mono tabular-nums text-sm">
                    {formatIDR(liveDailySummary.systemClosingBalance)}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Hitung Fisik Opname Hari Ini</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {liveDailySummary.physicalCountTotal !== null
                        ? formatIDR(liveDailySummary.physicalCountTotal)
                        : 'Belum diinput'}
                    </span>
                  </div>
                  {liveDailySummary.variance !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">
                        Selisih Fisik vs Sistem
                      </span>
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          liveDailySummary.variance === 0
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {liveDailySummary.variance > 0
                          ? `+${formatIDR(liveDailySummary.variance)}`
                          : formatIDR(liveDailySummary.variance)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Kasbon Open Belum Realisasi</span>
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        liveDailySummary.openKasbonCount > 0
                          ? 'text-amber-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {liveDailySummary.openKasbonCount} kasbon (
                      {formatIDR(liveDailySummary.openKasbonAmount)})
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
                <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Petugas Penutup Kas Tercatat</span>
                </p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {currentUser.name}{' '}
                  <span className="font-normal text-slate-600">
                    · {currentRoleName}
                  </span>
                </p>
              </div>

              <div>
                <label
                  htmlFor="closing-note"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Catatan Berita Acara (Opsional)
                </label>
                <input
                  id="closing-note"
                  type="text"
                  disabled={!canDailyClosing}
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  placeholder="Contoh: Saldo brankas sesuai dengan mutasi harian"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-700 focus:outline-none disabled:bg-slate-100"
                />
              </div>

              {dateLockedPeriod && (
                <p className="text-xs font-medium text-amber-800">
                  Periode {dateLockedPeriod.monthKey} berstatus Terkunci. Tutup
                  kas harian pada bulan terkunci dinonaktifkan.
                </p>
              )}

              {closingError && (
                <p className="text-xs font-medium text-rose-700" role="alert">
                  {closingError}
                </p>
              )}

              {canDailyClosing ? (
                <button
                  type="submit"
                  disabled={submittingDaily || Boolean(dateLockedPeriod)}
                  className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {submittingDaily
                    ? 'Menyimpan...'
                    : 'Simpan Tutup Kas Harian'}
                </button>
              ) : (
                <p className="text-xs text-slate-500 text-center py-1">
                  Role Anda hanya memiliki akses lihat (tanpa izin Tutup Kas Harian).
                </p>
              )}
            </form>
          </div>

          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                Riwayat Berita Acara Tutup Kas Harian ({dailyClosings.length})
              </h3>
              <p className="text-xs text-slate-500">
                Rekap saldo penutupan harian per divisi beserta kondisi selisih
                opname fisik.
              </p>
            </div>

            {dailyClosings.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Belum ada laporan tutup kas harian tercatat.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-3 whitespace-nowrap">No. Dokumen</th>
                      <th className="py-3 px-3">Divisi &amp; Catatan</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">
                        Saldo Sistem
                      </th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">
                        Opname &amp; Selisih
                      </th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">
                        Kasbon Open
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyClosings.map((cld) => (
                      <tr key={cld.id} className="hover:bg-slate-50/70 align-top">
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-mono font-semibold text-slate-900 block">
                            {cld.closingNumber}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-slate-500">
                            {cld.closingDate}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-[200px]">
                          <span className="font-medium text-slate-800 block">
                            {cld.departmentName}
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            Oleh {cld.closedBy} · {cld.note}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono tabular-nums">
                          <span className="font-semibold text-slate-900 block">
                            {formatIDR(cld.systemClosingBalance)}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            +{formatIDR(cld.totalInflow)} / -
                            {formatIDR(cld.totalOutflow)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono tabular-nums">
                          {cld.physicalCountTotal !== null ? (
                            <div>
                              <span className="font-semibold text-slate-900 block">
                                {formatIDR(cld.physicalCountTotal)}
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  cld.variance === 0
                                    ? 'text-emerald-700'
                                    : 'text-rose-700'
                                }`}
                              >
                                {cld.variance === 0
                                  ? 'Klop Rp 0'
                                  : `Selisih ${
                                      cld.variance! > 0 ? '+' : '-'
                                    }${formatIDR(Math.abs(cld.variance!))}`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Belum opname</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono tabular-nums">
                          {cld.openKasbonCount > 0 ? (
                            <span className="font-semibold text-amber-700">
                              {cld.openKasbonCount} ({formatIDR(cld.openKasbonAmount)})
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: KUNCI PERIODE BULANAN (PERIOD LOCK) */}
      <section
        aria-labelledby="period-lock-heading"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="period-lock-heading"
              className="text-base font-semibold text-slate-900 flex items-center gap-2"
            >
              <Lock className="h-4 w-4 text-emerald-700" />
              <span>Kunci Periode Bulanan (Tutup Buku)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mengunci periode bulanan agar mutasi, pengajuan baru, atau edit
              pada bulan yang sudah diaudit tidak bisa diubah tanpa otorisasi.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-600">
            {closedPeriods.length} Periode Terkunci
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">Periode</th>
                <th className="py-3 px-4">Status Kunci</th>
                <th className="py-3 px-4 text-right">Total Pengeluaran</th>
                <th className="py-3 px-4 text-right">Total Top-Up</th>
                <th className="py-3 px-4 text-center">Pending</th>
                <th className="py-3 px-4">Audit Penutupan</th>
                <th className="py-3 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periodRows.map((row) => {
                const locked = Boolean(row.closedRecord);
                return (
                  <tr
                    key={row.monthKey}
                    className="hover:bg-slate-50/70 align-middle"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-900 block">
                        {formatMonthLabel(row.monthKey)}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {row.monthKey}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {locked ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                          <Lock className="h-3.5 w-3.5" />
                          <span>Terkunci</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                          <Unlock className="h-3.5 w-3.5" />
                          <span>Terbuka</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatIDR(
                        row.closedRecord
                          ? row.closedRecord.totalSpent
                          : row.report.totalSpent
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                      +
                      {formatIDR(
                        row.closedRecord
                          ? row.closedRecord.totalTopUp
                          : row.report.totalTopUp
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono tabular-nums whitespace-nowrap">
                      {row.pendingTotalCount > 0 ? (
                        <span className="font-semibold text-amber-700">
                          {row.pendingTotalCount} pending
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-[260px]">
                      {row.closedRecord ? (
                        <div>
                          <p className="font-medium text-slate-800">
                            {row.closedRecord.closedBy} ·{' '}
                            <span className="font-mono text-[11px] text-slate-500">
                              {formatDateTime(row.closedRecord.closedAt)}
                            </span>
                          </p>
                          <p className="text-slate-500">
                            {row.closedRecord.note}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          Periode masih aktif untuk pencatatan
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {locked ? (
                        canReopenPeriod ? (
                          <button
                            type="button"
                            onClick={() => {
                              setLockError('');
                              setLockModalTarget({
                                monthKey: row.monthKey,
                                action: 'unlock',
                              });
                            }}
                            aria-label={`Buka Kunci Periode ${row.monthKey}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                            <span>Buka Kunci</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">Terkunci</span>
                        )
                      ) : canLockPeriod ? (
                        <button
                          type="button"
                          onClick={() => {
                            setLockError('');
                            setLockModalTarget({
                              monthKey: row.monthKey,
                              action: 'lock',
                            });
                          }}
                          aria-label={`Tutup Buku Periode ${row.monthKey}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>Tutup Buku Periode</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">Read-Only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {lockModalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="period-lock-modal-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3
                id="period-lock-modal-title"
                className="text-base font-semibold text-slate-900"
              >
                {lockModalTarget.action === 'lock'
                  ? `Tutup Buku & Kunci Periode ${formatMonthLabel(
                      lockModalTarget.monthKey
                    )}`
                  : `Buka Kunci Periode ${formatMonthLabel(
                      lockModalTarget.monthKey
                    )}`}
              </h3>
              <button
                type="button"
                onClick={() => setLockModalTarget(null)}
                aria-label="Tutup dialog kunci periode"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmLockModal} className="mt-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
                <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Otorisator Terverifikasi</span>
                </p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {currentUser.name}{' '}
                  <span className="font-normal text-slate-600">
                    · {currentRoleName}
                  </span>
                </p>
              </div>

              {lockModalTarget.action === 'lock' ? (
                <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      Setelah periode <strong>{lockModalTarget.monthKey}</strong>{' '}
                      dikunci, sistem menolak pengajuan, top-up, tutup kas, dan
                      perubahan transaksi di periode tersebut.
                    </span>
                  </div>
                  <div>
                    <label
                      htmlFor="lock-note"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Catatan Tutup Buku (Opsional)
                    </label>
                    <input
                      id="lock-note"
                      type="text"
                      value={lockNote}
                      onChange={(e) => setLockNote(e.target.value)}
                      placeholder="Contoh: Sudah dicek dan sesuai rekening koran"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    Membuka kunci periode{' '}
                    <strong className="font-mono">
                      {lockModalTarget.monthKey}
                    </strong>{' '}
                    mengizinkan pencatatan koreksi atau penyesuaian di bulan
                    tersebut. Kunci kembali setelah koreksi selesai.
                  </span>
                </div>
              )}

              {lockError && (
                <p className="text-xs font-medium text-rose-700" role="alert">
                  {lockError}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLockModalTarget(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingLock}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {submittingLock
                    ? 'Memproses...'
                    : lockModalTarget.action === 'lock'
                    ? 'Kunci Periode Sekarang'
                    : 'Konfirmasi Buka Kunci'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
