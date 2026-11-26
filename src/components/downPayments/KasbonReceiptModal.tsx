import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  QrCode,
  Receipt,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { DownPaymentRecord } from '../../types/pettycash.ts';
import { formatDateTime, formatIDR } from '../../utils/formatters.ts';
import {
  buildKasbonVerificationUrl,
  generateQrDataUrl,
} from '../../utils/qrVerification.ts';
import { SecureReceiptImage } from '../common/SecureReceiptImage.tsx';
import { DP_STATUS_LABELS } from './dpShared.ts';

interface KasbonReceiptModalProps {
  dp: DownPaymentRecord | null;
  departmentName?: string;
  openedFromQrLink?: boolean;
  onClose: () => void;
}

export function KasbonReceiptModal({
  dp,
  departmentName,
  openedFromQrLink = false,
  onClose,
}: KasbonReceiptModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const verificationUrl = useMemo(() => {
    if (!dp) return '';
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'http://localhost:3000';
    return buildKasbonVerificationUrl(origin, dp);
  }, [dp]);

  useEffect(() => {
    let active = true;
    if (!dp || !verificationUrl) {
      setQrDataUrl('');
      setQrError(null);
      return;
    }

    setQrError(null);
    generateQrDataUrl(verificationUrl, 360)
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrError('Gagal membuat QR Code verifikasi.');
      });

    return () => {
      active = false;
    };
  }, [dp, verificationUrl]);

  useEffect(() => {
    setCopied(false);
  }, [dp?.id]);

  if (!dp) return null;

  async function handleCopyLink() {
    if (!verificationUrl) return;
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const settlement = dp.settlement;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kasbon-receipt-title"
      data-testid="kasbon-verification-modal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <h3
              id="kasbon-receipt-title"
              className="text-sm sm:text-base font-semibold text-slate-900 truncate"
            >
              Verifikasi Struk &amp; Detail Kasbon — {dp.dpNumber}
            </h3>
            <p className="text-xs text-slate-500 truncate">
              {dp.title} · {dp.requesterName} · {departmentName ?? dp.departmentId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail & QR kasbon"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {openedFromQrLink && (
            <div
              data-testid="qr-verified-banner"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex items-center gap-2.5 text-xs text-emerald-900"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>
                <strong>Terverifikasi dari Tautan QR:</strong> Data pengajuan dan
                realisasi struk dimuat langsung untuk nomor kasbon{' '}
                <span className="font-mono font-semibold">{dp.dpNumber}</span>.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-5 items-start">
            {/* Left Column: Request & Receipt Verification Details */}
            <div className="space-y-4 min-w-0">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5 text-emerald-700" />
                    Rincian Pengajuan Kasbon
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      dp.status === 'settled'
                        ? 'bg-emerald-100 text-emerald-800'
                        : dp.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {dp.status === 'settled' && (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {DP_STATUS_LABELS[dp.status]}
                  </span>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  <div>
                    <dt className="text-slate-500">Pemohon &amp; Divisi</dt>
                    <dd className="font-semibold text-slate-900">
                      {dp.requesterName} ({departmentName ?? dp.departmentId})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Kategori &amp; Armada</dt>
                    <dd className="font-medium text-slate-900">
                      {dp.category}
                      {dp.vehiclePlate ? ` · ${dp.vehiclePlate}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Uang Muka Diajukan</dt>
                    <dd className="font-mono tabular-nums font-semibold text-slate-900">
                      {formatIDR(dp.requestedAmount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Jatuh Tempo Struk</dt>
                    <dd className="font-mono tabular-nums text-slate-900">
                      {dp.dueDate}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Otorisasi Direktur</dt>
                    <dd className="text-slate-900">
                      {dp.approval.approverName
                        ? `${dp.approval.approverName} (${
                            dp.approval.decidedAt
                              ? formatDateTime(dp.approval.decidedAt)
                              : '-'
                          })`
                        : 'Menunggu keputusan'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Catatan Pengajuan</dt>
                    <dd className="text-slate-700">
                      {dp.notes || '-'}
                    </dd>
                  </div>
                </dl>
              </div>

              {settlement ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-emerald-950">
                    Hasil Verifikasi &amp; Realisasi Struk
                  </h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                    <div>
                      <dt className="text-slate-500">Nominal Struk Aktual</dt>
                      <dd className="font-mono tabular-nums font-semibold text-slate-900">
                        {formatIDR(settlement.actualAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Selisih Penyelesaian</dt>
                      <dd className="font-mono tabular-nums font-semibold text-slate-900">
                        {settlement.differenceType === 'refund'
                          ? `Sisa Kembali +${formatIDR(settlement.differenceAmount)}`
                          : settlement.differenceType === 'reimburse'
                          ? `Kurang Bayar -${formatIDR(Math.abs(settlement.differenceAmount))}`
                          : 'Pas (Selisih Rp 0)'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">No. Referensi Struk</dt>
                      <dd className="font-mono font-semibold text-slate-900">
                        {settlement.receiptRef}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Diverifikasi Oleh</dt>
                      <dd className="text-slate-900">
                        {settlement.settledBy} ({formatDateTime(settlement.settledAt)})
                      </dd>
                    </div>
                    {settlement.note && (
                      <div className="sm:col-span-2">
                        <dt className="text-slate-500">Catatan Realisasi</dt>
                        <dd className="text-slate-800">{settlement.note}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  Kasbon ini belum direalisasikan dengan struk akhir. Gunakan QR
                  Code di samping untuk membuka langsung rincian kasbon ini saat
                  pemeriksaan lapangan atau audit.
                </div>
              )}

              {/* Receipt Image Preview */}
              <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 flex flex-col items-center justify-center min-h-[180px]">
                {settlement?.receiptImageUrl ? (
                  <SecureReceiptImage
                    src={settlement.receiptImageUrl}
                    alt={`Struk realisasi ${dp.dpNumber}`}
                    className="max-w-full max-h-[42vh] object-contain rounded-lg border border-slate-200 bg-white"
                  />
                ) : (
                  <p className="text-xs text-slate-500 text-center">
                    Belum ada foto bukti struk yang diunggah untuk kasbon ini.
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Scannable QR Verification Utility */}
            <aside
              aria-label="QR Code Verifikasi Struk"
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3.5"
            >
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-emerald-700 shrink-0" />
                <h4 className="text-xs font-semibold text-slate-900">
                  QR Code Verifikasi Struk
                </h4>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                Pindai QR ini untuk membuka langsung detail pengajuan dan bukti
                struk kasbon{' '}
                <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">
                  {dp.dpNumber}
                </span>
                .
              </p>

              <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center">
                {qrError ? (
                  <p className="text-xs text-rose-600 py-10 text-center">
                    {qrError}
                  </p>
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Verifikasi ${dp.dpNumber}`}
                    data-testid="kasbon-qr-image"
                    className="w-44 h-44 object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                    Membuat QR...
                  </div>
                )}
                <span className="mt-2 font-mono text-[11px] font-semibold text-slate-700">
                  {dp.dpNumber}
                </span>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="kasbon-verify-url"
                  className="block text-[11px] font-medium text-slate-600"
                >
                  Tautan Verifikasi Langsung
                </label>
                <input
                  id="kasbon-verify-url"
                  type="text"
                  readOnly
                  value={verificationUrl}
                  data-testid="kasbon-verify-url"
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-700 focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-700" />
                      <span className="text-emerald-700">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Salin Link</span>
                    </>
                  )}
                </button>

                {qrDataUrl ? (
                  <a
                    href={qrDataUrl}
                    download={`qr-${dp.dpNumber.toLowerCase()}.png`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh QR</span>
                  </a>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-500">
                    Unduh QR
                  </span>
                )}
              </div>

              <a
                href={verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Buka Tautan Verifikasi</span>
              </a>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
