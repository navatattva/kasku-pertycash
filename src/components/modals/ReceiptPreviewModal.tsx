import { useState } from 'react';
import { Download, Image as ImageIcon, X } from 'lucide-react';
import type { PettyCashRequest } from '../../types/pettycash.ts';
import { fetchAuthorizedBlobUrl } from '../../api/pettycashApi.ts';
import { formatIDR } from '../../utils/formatters.ts';
import { SecureReceiptImage } from '../common/SecureReceiptImage.tsx';

export interface ReceiptPreviewModalProps {
  request: PettyCashRequest | null;
  onClose: () => void;
}

export function ReceiptPreviewModal({
  request,
  onClose,
}: ReceiptPreviewModalProps) {
  const [downloading, setDownloading] = useState(false);

  if (!request || !request.receiptImageUrl) return null;

  async function handleDownload() {
    if (!request?.receiptImageUrl) return;
    setDownloading(true);
    try {
      const objectUrl = request.receiptImageUrl.startsWith('data:image/')
        ? request.receiptImageUrl
        : await fetchAuthorizedBlobUrl(request.receiptImageUrl);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download =
        request.receiptImageName || `${request.requestNumber}-nota.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (!request.receiptImageUrl.startsWith('data:image/')) {
        URL.revokeObjectURL(objectUrl);
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-preview-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="min-w-0">
            <h2
              id="receipt-preview-title"
              className="text-sm font-semibold text-slate-900 truncate"
            >
              Bukti Nota / Invoice — {request.requestNumber}
            </h2>
            <p className="text-xs text-slate-500 truncate">
              {request.title} · {formatIDR(request.amount)} · Ref:{' '}
              {request.receiptRef || '-'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau nota"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-slate-100 p-4 flex items-center justify-center max-h-[75vh] overflow-auto">
          <SecureReceiptImage
            src={request.receiptImageUrl}
            alt={`Lampiran nota untuk ${request.requestNumber}`}
            className="max-w-full max-h-[68vh] object-contain rounded-lg border border-slate-200 bg-white"
          />
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 truncate">
            <ImageIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {request.receiptImageName || 'Lampiran Nota'}
            </span>
          </span>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{downloading ? 'Mengunduh...' : 'Unduh Lampiran'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
