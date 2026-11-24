import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  Department,
  FraudGuardConfig,
  MasterCategory,
  PermissionKey,
  PettyCashRequest,
} from '../types/pettycash.ts';
import { formatDateTime, formatIDR, getStatusLabel } from '../utils/formatters.ts';
import {
  auditExistingRequestFraudSignals,
  hasPermission,
} from '../utils/pettycashLogic.ts';
import { SecureReceiptImage } from './common/SecureReceiptImage.tsx';

interface ApprovalsViewProps {
  requests: PettyCashRequest[];
  departments: Department[];
  categories: MasterCategory[];
  fraudGuard: FraudGuardConfig;
  userPermissions: readonly PermissionKey[];
  currentRoleName: string;
  onDecision: (
    request: PettyCashRequest,
    decision: 'approve' | 'reject'
  ) => void;
  onOpenNewRequest: () => void;
  onPreviewReceipt: (request: PettyCashRequest) => void;
}

type FilterMode = 'all' | 'pending' | 'approved' | 'rejected';

export function ApprovalsView({
  requests,
  departments,
  categories,
  fraudGuard,
  userPermissions,
  currentRoleName,
  onDecision,
  onOpenNewRequest,
  onPreviewReceipt,
}: ApprovalsViewProps) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const canCreateRequest = hasPermission(userPermissions, 'requests:create');
  const canDecideRequest = hasPermission(userPermissions, 'requests:decide');

  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((req) => {
      if (deptFilter !== 'all' && req.departmentId !== deptFilter) {
        return false;
      }
      if (filter === 'pending' && req.status !== 'pending_director') {
        return false;
      }
      if (filter === 'approved' && req.status !== 'approved') {
        return false;
      }
      if (filter === 'rejected' && req.status !== 'rejected') {
        return false;
      }
      if (query) {
        const deptName = deptMap.get(req.departmentId)?.name.toLowerCase() ?? '';
        return (
          req.requestNumber.toLowerCase().includes(query) ||
          req.title.toLowerCase().includes(query) ||
          req.requesterName.toLowerCase().includes(query) ||
          deptName.includes(query)
        );
      }
      return true;
    });
  }, [requests, deptFilter, filter, search, deptMap]);

  const filterButtons: { id: FilterMode; label: string }[] = [
    { id: 'all', label: 'Semua' },
    { id: 'pending', label: 'Menunggu Direktur' },
    { id: 'approved', label: 'Disetujui' },
    { id: 'rejected', label: 'Ditolak' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilter(btn.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                filter === btn.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor, keperluan, pemohon..."
              aria-label="Cari pengajuan petty cash"
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Filter divisi"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-700 focus:outline-none"
          >
            <option value="all">Semua Divisi</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Direct Approval Policy Reference */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          <span className="font-semibold text-slate-800">
            Alur Persetujuan Langsung:
          </span>{' '}
          <span>
            Setiap pengajuan kas kecil langsung ditinjau dan disetujui oleh
            pemegang izin persetujuan (1 tahap).
          </span>
        </div>
        <div className="text-slate-500">
          Role Aktif:{' '}
          <span className="font-semibold text-slate-900">
            {currentRoleName}
          </span>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-14 px-6 text-center">
          <p className="text-base font-semibold text-slate-900">
            Tidak ada pengajuan yang sesuai filter
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Ubah kata kunci pencarian atau ajukan pengeluaran kas kecil baru.
          </p>
          {canCreateRequest && (
            <button
              type="button"
              onClick={onOpenNewRequest}
              className="mt-4 inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Ajukan Petty Cash Baru
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const dept = deptMap.get(req.departmentId);
            const fraudSignals = auditExistingRequestFraudSignals(
              req,
              fraudGuard,
              requests,
              categories
            );

            return (
              <article
                key={req.id}
                className="bg-white border border-slate-200 rounded-xl p-5"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-800">
                        {req.requestNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{dept?.name ?? req.departmentId}</span>
                      <span aria-hidden="true">·</span>
                      <span>{req.category}</span>
                      {req.vehiclePlate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-medium text-slate-700">
                            {req.vehiclePlate}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>Pemohon: {req.requesterName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatDateTime(req.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900">
                      {req.title}
                    </h3>

                    {req.notes && (
                      <p className="text-sm text-slate-600">{req.notes}</p>
                    )}

                    <p className="text-xs text-slate-500">
                      Ref. Bukti / Surat Jalan:{' '}
                      <span className="font-mono text-slate-700">
                        {req.receiptRef || '-'}
                      </span>
                    </p>

                    {req.receiptImageUrl && (
                      <div className="pt-1.5">
                        <button
                          type="button"
                          onClick={() => onPreviewReceipt(req)}
                          aria-label={`Lihat Nota ${req.requestNumber}`}
                          className="inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-left hover:border-emerald-700/40 hover:bg-emerald-50/40 transition-colors"
                        >
                          <SecureReceiptImage
                            src={req.receiptImageUrl}
                            alt={`Lampiran nota ${req.requestNumber}`}
                            className="h-9 w-9 rounded object-cover border border-slate-200 bg-white shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                              <span>Lihat Nota / Invoice</span>
                            </span>
                            {req.receiptImageName && (
                              <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                                {req.receiptImageName}
                              </p>
                            )}
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-1.5 shrink-0">
                    <div className="lg:text-right">
                      <p className="font-mono tabular-nums text-xl font-semibold text-slate-900">
                        {formatIDR(req.amount)}
                      </p>
                      {req.tax && req.tax.taxType !== 'none' && (
                        <p className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
                          {req.tax.label} · DPP {formatIDR(req.tax.dppAmount)}
                          {req.tax.ppnAmount > 0
                            ? ` · PPN +${formatIDR(req.tax.ppnAmount)}`
                            : ''}
                          {req.tax.pphAmount > 0
                            ? ` · PPh -${formatIDR(req.tax.pphAmount)}`
                            : ''}
                        </p>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        req.status === 'approved'
                          ? 'text-emerald-700'
                          : req.status === 'rejected'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {req.status === 'approved' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : req.status === 'rejected' ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                      <span>{getStatusLabel(req.status)}</span>
                    </span>
                  </div>
                </div>

                {/* Anti-Fraud Audit Strip */}
                {fraudGuard.enabled && (
                  <div className="mt-4">
                    {fraudSignals.length > 0 ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-xs text-rose-900 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-rose-800">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Temuan Guard Anti-Fraud ({fraudSignals.length}{' '}
                            catatan audit)
                          </span>
                        </div>
                        <ul className="list-disc pl-5 space-y-0.5 text-rose-800">
                          {fraudSignals.map((flag) => (
                            <li key={flag.code}>
                              <span className="font-semibold">
                                {flag.title}:
                              </span>{' '}
                              {flag.detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Guard Anti-Fraud: Bersih · Foto Nota &amp; Batas
                          Terverifikasi
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Single-Step Director Approval Box */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div
                    className={`flex-1 rounded-lg border px-3.5 py-2.5 text-xs ${
                      req.approval.status === 'approved'
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : req.approval.status === 'rejected'
                        ? 'border-rose-200 bg-rose-50/50'
                        : 'border-amber-300 bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        Persetujuan Langsung: Direktur / Otorisator
                      </span>
                      {req.approval.status === 'approved' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                      ) : req.approval.status === 'rejected' ? (
                        <XCircle className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      )}
                    </div>
                    {req.approval.approverName ? (
                      <p className="mt-1 text-slate-600">
                        {req.approval.approverName}
                        {req.approval.decidedAt && (
                          <span className="text-slate-400">
                            {' '}
                            · {formatDateTime(req.approval.decidedAt)}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="mt-1 text-slate-600">
                        Menunggu keputusan persetujuan
                      </p>
                    )}
                    {req.approval.note && (
                      <p className="mt-1 text-slate-600 italic">
                        “{req.approval.note}”
                      </p>
                    )}
                  </div>

                  {req.status === 'pending_director' && (
                    <div className="shrink-0">
                      {canDecideRequest ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onDecision(req, 'reject')}
                            aria-label={`Tolak pengajuan ${req.requestNumber}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 whitespace-nowrap"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Tolak Pengajuan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDecision(req, 'approve')}
                            aria-label={`Setujui pengajuan ${req.requestNumber}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Setujui & Cairkan</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Role Anda hanya dapat melihat status pengajuan.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
