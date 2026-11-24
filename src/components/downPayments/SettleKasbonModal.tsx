import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import type {
  AuthUserPublic,
  DownPaymentRecord,
  FraudGuardConfig,
} from '../../types/pettycash.ts';
import {
  formatIDR,
  formatNumberInput,
  normalizeRefCode,
  parseFormattedNumber,
} from '../../utils/formatters.ts';
import { calculateDownPaymentSettlement } from '../../utils/pettycashLogic.ts';
import {
  ReceiptUploader,
  type UploadedReceiptImage,
} from '../common/ReceiptUploader.tsx';
import type { SettleDownPaymentFn } from './dpShared.ts';

interface SettleKasbonModalProps {
  dp: DownPaymentRecord | null;
  fraudGuard: FraudGuardConfig;
  currentUser: AuthUserPublic;
  currentRoleName: string;
  onClose: () => void;
  onSubmit: SettleDownPaymentFn;
}

export function SettleKasbonModal({
  dp,
  fraudGuard,
  currentUser,
  currentRoleName,
  onClose,
  onSubmit,
}: SettleKasbonModalProps) {
  const [actualAmountStr, setActualAmountStr] = useState(
    dp ? formatNumberInput(String(dp.requestedAmount)) : ''
  );
  const [receiptRef, setReceiptRef] = useState('');
  const [note, setNote] = useState('');
  const [uploadedImage, setUploadedImage] =
    useState<UploadedReceiptImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!dp) return null;

  const actualAmount = parseFormattedNumber(actualAmountStr);
  const settlementCalc = calculateDownPaymentSettlement(
    dp.requestedAmount,
    actualAmount
  );
  const isPhotoRequired =
    fraudGuard.enabled &&
    fraudGuard.requireReceiptImage &&
    actualAmount > 0 &&
    actualAmount >= fraudGuard.receiptRequiredMinAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dp) return;
    setError('');
    setSubmitting(true);
    const res = await onSubmit({
      dpId: dp.id,
      actualAmount,
      receiptRef: normalizeRefCode(receiptRef),
      receiptImageUrl: uploadedImage?.url,
      receiptImageName: uploadedImage?.name,
      note,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Gagal menyimpan realisasi kasbon.');
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settle-kasbon-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="settle-kasbon-title"
              className="text-base font-semibold text-slate-900"
            >
              Realisasi Struk Kasbon — {dp.dpNumber}
            </h2>
            <p className="text-xs text-slate-500">
              {dp.requesterName} · {dp.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form realisasi"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="settle-actual-amount"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nominal Realisasi Struk (IDR)
              </label>
              <input
                id="settle-actual-amount"
                type="text"
                inputMode="numeric"
                value={actualAmountStr}
                onChange={(e) =>
                  setActualAmountStr(formatNumberInput(e.target.value))
                }
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="settle-receipt-ref"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                No. Struk / Kuitansi
              </label>
              <input
                id="settle-receipt-ref"
                type="text"
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value.toUpperCase())}
                onBlur={() => setReceiptRef(normalizeRefCode(receiptRef))}
                placeholder="STRUK-BKM-001"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase text-slate-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-600">
              <span>Uang Muka Diberikan</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {formatIDR(dp.requestedAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Total Struk Belanja Aktual</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {formatIDR(settlementCalc.actualAmount)}
              </span>
            </div>
            <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-semibold">
              <span>
                {settlementCalc.differenceType === 'refund'
                  ? 'Sisa Dikembalikan ke Kas'
                  : settlementCalc.differenceType === 'reimburse'
                  ? 'Kekurangan Dibayarkan (Reimburse)'
                  : 'Selisih Realisasi'}
              </span>
              <span
                className={`font-mono tabular-nums ${
                  settlementCalc.differenceType === 'refund'
                    ? 'text-emerald-700'
                    : settlementCalc.differenceType === 'reimburse'
                    ? 'text-amber-700'
                    : 'text-slate-700'
                }`}
              >
                {settlementCalc.differenceType === 'refund'
                  ? `+${formatIDR(settlementCalc.differenceAmount)}`
                  : settlementCalc.differenceType === 'reimburse'
                  ? `-${formatIDR(Math.abs(settlementCalc.differenceAmount))}`
                  : formatIDR(0)}
              </span>
            </div>
          </div>

          <ReceiptUploader
            inputId="settle-receipt-file"
            labelText="Foto Nota / Struk Realisasi"
            isRequired={isPhotoRequired}
            value={uploadedImage}
            onChange={setUploadedImage}
            onError={setError}
            onUploadingChange={setUploadingImage}
            idleTitle="Pilih foto struk belanja asli"
            uploadingText="Mengunggah foto struk..."
            readyText="Foto struk siap diverifikasi"
            previewSizeClass="h-12 w-12 rounded"
            sizeErrorMessage="Ukuran foto struk maksimal 4 MB."
            typeErrorMessage="Format lampiran harus JPG, PNG, atau WEBP."
            networkErrorMessage="Gagal mengunggah foto struk ke server."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                <span>Petugas Verifikasi</span>
              </p>
              <p className="mt-0.5 font-semibold text-slate-900 truncate">
                {currentUser.name}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {currentRoleName}
              </p>
            </div>
            <div>
              <label
                htmlFor="settle-note"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Catatan Realisasi (Opsional)
              </label>
              <input
                id="settle-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Sisa uang tunai disetor ke brankas"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>
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
              disabled={submitting || uploadingImage}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Selesaikan Realisasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
