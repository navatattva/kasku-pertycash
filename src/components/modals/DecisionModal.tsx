import { useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type {
  AuthUserPublic,
  FraudGuardConfig,
  MasterCategory,
  PettyCashRequest,
} from '../../types/pettycash.ts';
import { formatIDR } from '../../utils/formatters.ts';
import {
  auditExistingRequestFraudSignals,
  composeQuickAnswerNote,
  REQUEST_APPROVE_QUICK_ANSWERS,
  REQUEST_REJECT_QUICK_ANSWERS,
} from '../../utils/pettycashLogic.ts';
import { QuickAnswerSelector } from '../common/QuickAnswerSelector.tsx';
import { SecureReceiptImage } from '../common/SecureReceiptImage.tsx';

export interface DecisionModalProps {
  target: {
    request: PettyCashRequest;
    decision: 'approve' | 'reject';
  } | null;
  currentUser: AuthUserPublic;
  currentRoleName: string;
  fraudGuard: FraudGuardConfig;
  existingRequests: PettyCashRequest[];
  categories: MasterCategory[];
  onClose: () => void;
  onConfirm: (payload: {
    requestId: string;
    decision: 'approve' | 'reject';
    note: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function DecisionModal({
  target,
  currentUser,
  currentRoleName,
  fraudGuard,
  existingRequests,
  categories,
  onClose,
  onConfirm,
}: DecisionModalProps) {
  const [selectedQuickAnswers, setSelectedQuickAnswers] = useState<string[]>(
    []
  );
  const [includeOther, setIncludeOther] = useState(false);
  const [otherNote, setOtherNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!target) return null;

  const isApprove = target.decision === 'approve';
  const quickOptions = isApprove
    ? REQUEST_APPROVE_QUICK_ANSWERS
    : REQUEST_REJECT_QUICK_ANSWERS;

  const fraudWarnings = auditExistingRequestFraudSignals(
    target.request,
    fraudGuard,
    existingRequests,
    categories
  );

  function handleToggleQuickAnswer(option: string) {
    setError('');
    setSelectedQuickAnswers((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setError('');

    if (includeOther && !otherNote.trim()) {
      setError(
        'Silakan isi keterangan pada kolom Lainnya atau hapus centang Lainnya.'
      );
      return;
    }

    const composedNote = composeQuickAnswerNote(
      selectedQuickAnswers,
      includeOther,
      otherNote
    );

    if (!isApprove && !composedNote) {
      setError(
        'Pilih minimal satu alasan penolakan atau centang Lainnya lalu isi alasan.'
      );
      return;
    }

    setSubmitting(true);
    const res = await onConfirm({
      requestId: target.request.id,
      decision: target.decision,
      note: composedNote,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Gagal memproses keputusan.');
      return;
    }
    setSelectedQuickAnswers([]);
    setIncludeOther(false);
    setOtherNote('');
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <h2
          id="decision-modal-title"
          className="text-base font-semibold text-slate-900"
        >
          {isApprove
            ? `Setujui & Cairkan ${target.request.requestNumber}`
            : `Tolak Pengajuan ${target.request.requestNumber}`}
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          {target.request.title} ·{' '}
          <span className="font-mono font-semibold text-slate-900">
            {formatIDR(target.request.amount)}
          </span>
        </p>

        {target.request.tax && target.request.tax.taxType !== 'none' && (
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {target.request.tax.label} · Nota{' '}
            {formatIDR(target.request.tax.baseInputAmount)} · DPP{' '}
            {formatIDR(target.request.tax.dppAmount)}
            {target.request.tax.ppnAmount > 0
              ? ` · PPN +${formatIDR(target.request.tax.ppnAmount)}`
              : ''}
            {target.request.tax.pphAmount > 0
              ? ` · PPh -${formatIDR(target.request.tax.pphAmount)}`
              : ''}
          </p>
        )}

        {fraudGuard.enabled && fraudWarnings.length > 0 && isApprove && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-rose-800">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>Peringatan Guard Anti-Fraud Sebelum Cairkan</span>
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-rose-800">
              {fraudWarnings.map((flag) => (
                <li key={flag.code}>
                  <strong>{flag.title}:</strong> {flag.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {target.request.receiptImageUrl && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex items-center gap-3">
            <SecureReceiptImage
              src={target.request.receiptImageUrl}
              alt={`Lampiran nota ${target.request.requestNumber}`}
              className="h-14 w-14 rounded object-cover border border-slate-200 bg-white shrink-0"
            />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-slate-800 truncate">
                {target.request.receiptImageName || 'Lampiran Nota'}
              </p>
              <p className="text-slate-500">
                Ref: {target.request.receiptRef || '-'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>Otorisator Terverifikasi (Sesi Login)</span>
            </p>
            <p className="mt-0.5 font-semibold text-slate-900">
              {currentUser.name}{' '}
              <span className="font-normal text-slate-600">
                · {currentRoleName}
              </span>
            </p>
            <p className="text-[11px] font-mono text-slate-500">
              {currentUser.email}
            </p>
          </div>

          <QuickAnswerSelector
            idPrefix="decision-qa"
            label={
              isApprove
                ? 'Catatan Cepat Persetujuan (Opsional · Bisa pilih lebih dari 1)'
                : 'Alasan Penolakan (Wajib · Bisa pilih lebih dari 1)'
            }
            helperText={
              isApprove
                ? 'Pilih catatan standar atau centang Lainnya untuk menulis catatan khusus.'
                : 'Centang satu atau beberapa alasan standar, atau centang Lainnya untuk alasan khusus.'
            }
            options={quickOptions}
            selectedOptions={selectedQuickAnswers}
            onToggleOption={handleToggleQuickAnswer}
            includeOther={includeOther}
            onToggleOther={(next) => {
              setError('');
              setIncludeOther(next);
            }}
            otherText={otherNote}
            onOtherTextChange={(val) => {
              setError('');
              setOtherNote(val);
            }}
            otherPlaceholder={
              isApprove
                ? 'Contoh: Sesuai surat jalan pengiriman rute Surabaya'
                : 'Jelaskan alasan penolakan agar pemohon dapat menindaklanjuti'
            }
            variant={isApprove ? 'approve' : 'reject'}
          />

          {error && (
            <p className="text-xs font-medium text-rose-700" role="alert">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                isApprove
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-rose-700 hover:bg-rose-800'
              }`}
            >
              {submitting
                ? 'Memproses...'
                : isApprove
                ? 'Konfirmasi Setujui'
                : 'Konfirmasi Tolak'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
