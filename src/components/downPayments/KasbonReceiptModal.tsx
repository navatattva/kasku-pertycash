import { X } from 'lucide-react';
import type { DownPaymentRecord } from '../../types/pettycash.ts';
import { formatIDR } from '../../utils/formatters.ts';
import { SecureReceiptImage } from '../common/SecureReceiptImage.tsx';

interface KasbonReceiptModalProps {
  dp: DownPaymentRecord | null;
  onClose: () => void;
}

export function KasbonReceiptModal({ dp, onClose }: KasbonReceiptModalProps) {
  if (!dp || !dp.settlement?.receiptImageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kasbon-receipt-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="min-w-0">
            <h3
              id="kasbon-receipt-title"
              className="text-sm font-semibold text-slate-900 truncate"
            >
              Bukti Realisasi Struk — {dp.dpNumber}
            </h3>
            <p className="text-xs text-slate-500 truncate">
              {dp.title} · Aktual {formatIDR(dp.settlement.actualAmount)} ·
              Ref: {dp.settlement.receiptRef}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau struk kasbon"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-slate-100 p-4 flex items-center justify-center max-h-[75vh] overflow-auto">
          <SecureReceiptImage
            src={dp.settlement.receiptImageUrl}
            alt={`Struk realisasi ${dp.dpNumber}`}
            className="max-w-full max-h-[68vh] object-contain rounded-lg border border-slate-200 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
