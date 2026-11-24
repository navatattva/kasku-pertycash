import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import type { AuthUserPublic, Department } from '../../types/pettycash.ts';
import {
  formatIDR,
  formatNumberInput,
  parseFormattedNumber,
} from '../../utils/formatters.ts';

export interface TopUpModalProps {
  department: Department | null;
  currentUser: AuthUserPublic;
  currentRoleName: string;
  onClose: () => void;
  onSubmit: (payload: {
    departmentId: string;
    amount: number;
    note: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function TopUpModal({
  department,
  currentUser,
  currentRoleName,
  onClose,
  onSubmit,
}: TopUpModalProps) {
  const [amountStr, setAmountStr] = useState('2.500.000');
  const [note, setNote] = useState('Pengisian ulang saldo kas kecil');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!department) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!department) return;
    setError('');
    setSubmitting(true);
    const res = await onSubmit({
      departmentId: department.id,
      amount: parseFormattedNumber(amountStr),
      note,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Gagal melakukan top-up saldo.');
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="topup-title" className="text-base font-semibold text-slate-900">
            Isi Ulang Saldo — {department.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal top-up"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
          Saldo buku saat ini: {formatIDR(department.balance)}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="topup-amount"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Nominal Top-Up (IDR)
            </label>
            <input
              id="topup-amount"
              type="text"
              inputMode="numeric"
              value={amountStr}
              onChange={(e) => setAmountStr(formatNumberInput(e.target.value))}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>Petugas / Otorisator Tercatat</span>
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
              htmlFor="topup-note"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Keterangan
            </label>
            <input
              id="topup-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
            />
          </div>

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
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Tambah Saldo Divisi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
