import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Plus,
  QrCode,
  Receipt,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type {
  AuthUserPublic,
  ClosedPeriodRecord,
  DepartmentMetrics,
  DownPaymentRecord,
  DownPaymentStatus,
  FraudGuardConfig,
  MasterCategory,
  MasterEmployee,
  MasterVehicle,
  PermissionKey,
  PettyCashRequest,
} from '../types/pettycash.ts';
import { formatIDR, formatShortDate } from '../utils/formatters.ts';
import { hasPermission, isPeriodClosed } from '../utils/pettycashLogic.ts';
import { CreateKasbonModal } from './downPayments/CreateKasbonModal.tsx';
import { KasbonDecisionModal } from './downPayments/KasbonDecisionModal.tsx';
import { KasbonReceiptModal } from './downPayments/KasbonReceiptModal.tsx';
import { SettleKasbonModal } from './downPayments/SettleKasbonModal.tsx';
import {
  diffDays,
  DP_STATUS_LABELS,
  type CreateDownPaymentFn,
  type DecideDownPaymentFn,
  type SettleDownPaymentFn,
} from './downPayments/dpShared.ts';

interface DownPaymentsViewProps {
  downPayments: DownPaymentRecord[];
  metrics: DepartmentMetrics[];
  employees: MasterEmployee[];
  categories: MasterCategory[];
  vehicles: MasterVehicle[];
  requests: PettyCashRequest[];
  closedPeriods: ClosedPeriodRecord[];
  fraudGuard: FraudGuardConfig;
  userPermissions: readonly PermissionKey[];
  currentUser: AuthUserPublic;
  currentRoleName: string;
  serverTime: string;
  initialVerifyDpId?: string | null;
  onConsumeVerifyDp?: () => void;
  onCreateDownPayment: CreateDownPaymentFn;
  onDecideDownPayment: DecideDownPaymentFn;
  onSettleDownPayment: SettleDownPaymentFn;
}

export function DownPaymentsView({
  downPayments,
  metrics,
  employees,
  categories,
  vehicles,
  closedPeriods,
  fraudGuard,
  userPermissions,
  currentUser,
  currentRoleName,
  serverTime,
  initialVerifyDpId = null,
  onConsumeVerifyDp,
  onCreateDownPayment,
  onDecideDownPayment,
  onSettleDownPayment,
}: DownPaymentsViewProps) {
  const todayDate = (serverTime || new Date().toISOString()).slice(0, 10);
  const currentMonthKey = todayDate.slice(0, 7);
  const lockedCurrentMonth = isPeriodClosed(currentMonthKey, closedPeriods);

  const canCreateDp = hasPermission(userPermissions, 'down_payments:create');
  const canDecideDp = hasPermission(userPermissions, 'down_payments:decide');
  const canSettleDp = hasPermission(userPermissions, 'down_payments:settle');

  const [statusFilter, setStatusFilter] = useState<'all' | DownPaymentStatus>(
    'all'
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<DownPaymentRecord | null>(
    null
  );
  const [decisionTarget, setDecisionTarget] = useState<{
    dp: DownPaymentRecord;
    decision: 'approve' | 'reject';
  } | null>(null);
  const [previewDp, setPreviewDp] = useState<DownPaymentRecord | null>(null);
  const [openedFromQrLink, setOpenedFromQrLink] = useState(false);
  const [missingVerifyId, setMissingVerifyId] = useState<string | null>(null);

  const deptMap = useMemo(
    () => new Map(metrics.map((m) => [m.department.id, m.department])),
    [metrics]
  );

  useEffect(() => {
    if (!initialVerifyDpId) return;
    const match = downPayments.find(
      (dp) => dp.id === initialVerifyDpId || dp.dpNumber === initialVerifyDpId
    );
    if (match) {
      setStatusFilter('all');
      setPreviewDp(match);
      setOpenedFromQrLink(true);
      setMissingVerifyId(null);
    } else {
      setMissingVerifyId(initialVerifyDpId);
    }
  }, [initialVerifyDpId, downPayments]);

  // KPI computations
  const openDps = downPayments.filter((dp) => dp.status === 'open');
  const openTotal = openDps.reduce((s, dp) => s + dp.requestedAmount, 0);
  const overdueDps = openDps.filter((dp) => dp.dueDate < todayDate);
  const overdueTotal = overdueDps.reduce((s, dp) => s + dp.requestedAmount, 0);
  const pendingDps = downPayments.filter(
    (dp) => dp.status === 'pending_director'
  );
  const pendingTotal = pendingDps.reduce((s, dp) => s + dp.requestedAmount, 0);
  const settledThisMonth = downPayments.filter(
    (dp) =>
      dp.status === 'settled' &&
      dp.settlement?.settledAt.startsWith(currentMonthKey)
  );
  const settledActualTotal = settledThisMonth.reduce(
    (s, dp) => s + (dp.settlement?.actualAmount ?? 0),
    0
  );

  const filteredDps = useMemo(() => {
    if (statusFilter === 'all') return downPayments;
    return downPayments.filter((dp) => dp.status === statusFilter);
  }, [downPayments, statusFilter]);

  const filterTabs: {
    id: 'all' | DownPaymentStatus;
    label: string;
    count: number;
  }[] = [
    { id: 'all', label: 'Semua Kasbon', count: downPayments.length },
    {
      id: 'pending_director',
      label: 'Menunggu Approval',
      count: pendingDps.length,
    },
    { id: 'open', label: 'Open (Belum Realisasi)', count: openDps.length },
    {
      id: 'settled',
      label: 'Sudah Realisasi',
      count: downPayments.filter((d) => d.status === 'settled').length,
    },
    {
      id: 'rejected',
      label: 'Ditolak',
      count: downPayments.filter((d) => d.status === 'rejected').length,
    },
  ];

  return (
    <div className="space-y-6">
      {lockedCurrentMonth && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
          <span>
            <strong>Periode {lockedCurrentMonth.monthKey} Terkunci:</strong>{' '}
            Pengajuan, persetujuan, dan realisasi kasbon baru diblokir hingga
            kunci periode dibuka oleh otorisator di menu Tutup Kas &amp; Periode.
          </span>
        </div>
      )}

      {missingVerifyId && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 flex items-center justify-between gap-3"
        >
          <span>
            Tautan verifikasi QR tidak menemukan data kasbon dengan ID{' '}
            <strong className="font-mono">{missingVerifyId}</strong>.
          </span>
          <button
            type="button"
            onClick={() => {
              setMissingVerifyId(null);
              onConsumeVerifyDp?.();
            }}
            className="font-semibold text-rose-700 hover:underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <section aria-label="Ringkasan Kasbon & Realisasi">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Kasbon Belum Realisasi (Open)</span>
              <Banknote className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatIDR(openTotal)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
              {openDps.length} karyawan memegang uang muka aktif
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Lewat Jatuh Tempo Struk</span>
              <AlertTriangle
                className={`h-4 w-4 ${
                  overdueDps.length > 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              />
            </div>
            <p
              className={`mt-2 font-mono tabular-nums text-2xl font-semibold ${
                overdueDps.length > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {overdueDps.length} Kasbon
            </p>
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
              {overdueDps.length > 0
                ? `Nilai tertunggak ${formatIDR(overdueTotal)}`
                : 'Semua kasbon aktif masih dalam batas waktu'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Menunggu Approval Direktur</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {pendingDps.length} Pengajuan
            </p>
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
              Dana ditahan {formatIDR(pendingTotal)}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Realisasi Struk Bulan Ini</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatIDR(settledActualTotal)}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
              {settledThisMonth.length} kasbon telah dipertanggungjawabkan
            </p>
          </div>
        </div>
      </section>

      {/* Filter Toolbar & Primary CTA */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterTabs.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono tabular-nums text-[11px] opacity-80">
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        {canCreateDp && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={Boolean(lockedCurrentMonth)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Ajukan Kasbon</span>
          </button>
        )}
      </div>

      {/* Down Payments Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Uang Muka (Kasbon) &amp; Pertanggungjawaban Struk
            </h2>
            <p className="text-xs text-slate-500">
              Setiap karyawan hanya boleh memiliki 1 kasbon aktif hingga struk
              asli direalisasikan dan selisih kas diselesaikan.
            </p>
          </div>
        </div>

        {filteredDps.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Tidak ada data kasbon pada filter status ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">No. Kasbon</th>
                  <th className="py-3 px-4">Pemohon &amp; Divisi</th>
                  <th className="py-3 px-4">Keperluan</th>
                  <th className="py-3 px-4 text-right">Uang Muka</th>
                  <th className="py-3 px-4">Jatuh Tempo Struk</th>
                  <th className="py-3 px-4">Realisasi &amp; Selisih</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDps.map((dp) => {
                  const dept = deptMap.get(dp.departmentId);
                  const daysPastDue =
                    dp.status === 'open' ? diffDays(dp.dueDate, todayDate) : 0;
                  const isOverdue = dp.status === 'open' && daysPastDue > 0;
                  return (
                    <tr key={dp.id} className="hover:bg-slate-50/70 align-top">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-900 block">
                          {dp.dpNumber}
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-slate-500">
                          {formatShortDate(dp.createdAt)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block">
                          {dp.requesterName}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {dept?.code ?? dp.departmentId} — {dept?.name ?? '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <p className="font-medium text-slate-900">{dp.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {dp.category}
                          {dp.vehiclePlate ? ` · ${dp.vehiclePlate}` : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatIDR(dp.requestedAmount)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono tabular-nums text-slate-700 block">
                          {dp.dueDate}
                        </span>
                        {isOverdue && (
                          <span className="text-[11px] font-semibold text-rose-700">
                            Terlambat {daysPastDue} hari
                          </span>
                        )}
                        {dp.status === 'open' && !isOverdue && (
                          <span className="text-[11px] text-amber-700">
                            Menunggu setor struk
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {dp.status === 'settled' && dp.settlement ? (
                          <div>
                            <span className="font-mono tabular-nums font-semibold text-slate-900 block">
                              Aktual: {formatIDR(dp.settlement.actualAmount)}
                            </span>
                            {dp.settlement.differenceType === 'refund' && (
                              <span className="font-mono tabular-nums text-[11px] font-semibold text-emerald-700 block">
                                Sisa Kembali +
                                {formatIDR(dp.settlement.differenceAmount)}
                              </span>
                            )}
                            {dp.settlement.differenceType === 'reimburse' && (
                              <span className="font-mono tabular-nums text-[11px] font-semibold text-amber-700 block">
                                Kurang Bayar -
                                {formatIDR(
                                  Math.abs(dp.settlement.differenceAmount)
                                )}
                              </span>
                            )}
                            {dp.settlement.differenceType === 'exact' && (
                              <span className="font-mono text-[11px] text-slate-500 block">
                                Pas (Selisih Rp 0)
                              </span>
                            )}
                            <span className="font-mono text-[11px] text-slate-500">
                              Ref: {dp.settlement.receiptRef}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Belum ada</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            dp.status === 'settled'
                              ? 'text-emerald-700'
                              : dp.status === 'open'
                              ? isOverdue
                                ? 'text-rose-700'
                                : 'text-amber-700'
                              : dp.status === 'pending_director'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {dp.status === 'settled' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : dp.status === 'rejected' ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          <span>{DP_STATUS_LABELS[dp.status]}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {dp.status === 'pending_director' && canDecideDp ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setDecisionTarget({ dp, decision: 'approve' })
                                }
                                aria-label={`Setujui ${dp.dpNumber}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Setujui</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDecisionTarget({ dp, decision: 'reject' })
                                }
                                aria-label={`Tolak ${dp.dpNumber}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span>Tolak</span>
                              </button>
                            </>
                          ) : dp.status === 'open' && canSettleDp ? (
                            <button
                              type="button"
                              onClick={() => setSettleTarget(dp)}
                              aria-label={`Realisasi Struk ${dp.dpNumber}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              <span>Realisasi Struk</span>
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => {
                              setOpenedFromQrLink(false);
                              setPreviewDp(dp);
                            }}
                            aria-label={`QR Verifikasi & Detail ${dp.dpNumber}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {dp.settlement?.receiptImageUrl ? (
                              <ImageIcon className="h-3.5 w-3.5 text-emerald-700" />
                            ) : (
                              <QrCode className="h-3.5 w-3.5 text-emerald-700" />
                            )}
                            <span>
                              {dp.settlement?.receiptImageUrl
                                ? 'Struk & QR'
                                : 'QR & Detail'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CreateKasbonModal
        open={createOpen}
        metrics={metrics}
        employees={employees}
        categories={categories}
        vehicles={vehicles}
        existingDownPayments={downPayments}
        todayDate={todayDate}
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreateDownPayment}
      />

      <KasbonDecisionModal
        key={`${decisionTarget?.dp.id ?? 'none'}-${decisionTarget?.decision ?? 'none'}`}
        target={decisionTarget}
        currentUser={currentUser}
        currentRoleName={currentRoleName}
        onClose={() => setDecisionTarget(null)}
        onConfirm={onDecideDownPayment}
      />

      <SettleKasbonModal
        key={settleTarget?.id ?? 'none'}
        dp={settleTarget}
        fraudGuard={fraudGuard}
        currentUser={currentUser}
        currentRoleName={currentRoleName}
        onClose={() => setSettleTarget(null)}
        onSubmit={onSettleDownPayment}
      />

      <KasbonReceiptModal
        dp={previewDp}
        departmentName={
          previewDp
            ? deptMap.get(previewDp.departmentId)?.name ?? previewDp.departmentId
            : undefined
        }
        openedFromQrLink={openedFromQrLink}
        onClose={() => {
          setPreviewDp(null);
          setOpenedFromQrLink(false);
          onConsumeVerifyDp?.();
        }}
      />
    </div>
  );
}
