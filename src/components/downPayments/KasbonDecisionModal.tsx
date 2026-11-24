import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AuthUserPublic, DownPaymentRecord } from '../../types/pettycash.ts';
import { formatIDR } from '../../utils/formatters.ts';
import {
  composeQuickAnswerNote,
  KASBON_APPROVE_QUICK_ANSWERS,
  KASBON_REJECT_QUICK_ANSWERS,
} from '../../utils/pettycashLogic.ts';
import { QuickAnswerSelector } from '../common/QuickAnswerSelector.tsx';
import type { DecideDownPaymentFn } from './dpShared.ts';

interface KasbonDecisionModalProps {
  target: {
    dp: DownPaymentRecord;
    decision: 'approve' | 'reject';
  } | null;
  currentUser: AuthUserPublic;
  currentRoleName: string;
  onClose: () => void;
  onConfirm: DecideDownPaymentFn;
}

export function KasbonDecisionModal({
  target,
  currentUser,
  currentRoleName,
  onClose,
  onConfirm,
}: KasbonDecisionModalProps) {
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
    ? KASBON_APPROVE_QUICK_ANSWERS
    : KASBON_REJECT_QUICK_ANSWERS;

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
      dpId: target.dp.id,
      decision: target.decision,
      note: composedNote,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Gagal memproses keputusan kasbon.');
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kasbon-decision-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <h2
          id="kasbon-decision-title"
          className="text-base font-semibold text-slate-900"
        >
          {isApprove
            ? `Setujui & Cairkan Kasbon ${target.dp.dpNumber}`
            : `Tolak Kasbon ${target.dp.dpNumber}`}
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          {target.dp.requesterName} ·{' '}
          <span className="font-mono font-semibold text-slate-900">
            {formatIDR(target.dp.requestedAmount)}
          </span>{' '}
          · Jatuh tempo {target.dp.dueDate}
        </p>

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
          </div>

          <QuickAnswerSelector
            idPrefix="kasbon-qa"
            label={
              isApprove
                ? 'Catatan Cepat Persetujuan Kasbon (Opsional · Bisa pilih lebih dari 1)'
                : 'Alasan Penolakan Kasbon (Wajib · Bisa pilih lebih dari 1)'
            }
            helperText={
              isApprove
                ? 'Pilih catatan standar atau centang Lainnya untuk mengisi pesan manual.'
                : 'Centang satu atau lebih alasan penolakan kasbon, atau centang Lainnya.'
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
                ? 'Contoh: Wajib setor struk asli maksimal 2 hari'
                : 'Jelaskan alasan penolakan kasbon'
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
                ? 'Cairkan Uang Muka'
                : 'Konfirmasi Tolak'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
