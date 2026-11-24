import type { DepartmentMetrics, PettyCashRequest } from '../../types/pettycash.ts';

export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function isValidIndonesianWhatsAppPhone(raw: string): boolean {
  const normalized = normalizeWhatsAppPhone(raw);
  return /^62\d{8,13}$/.test(normalized);
}

export function buildWhatsAppDeepLink(phone: string, message: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildRequestWhatsAppMessage(params: {
  eventType: 'new_request' | 'decision';
  request: PettyCashRequest;
  departmentName: string;
}): string {
  const { eventType, request, departmentName } = params;
  const amountText = `Rp ${request.amount.toLocaleString('id-ID')}`;
  const header =
    eventType === 'new_request'
      ? '*[KasKu Kargo] Pengajuan Petty Cash Baru*'
      : request.status === 'approved'
      ? '*[KasKu Kargo] Petty Cash DISETUJUI Direktur*'
      : '*[KasKu Kargo] Petty Cash DITOLAK Direktur*';

  const lines = [
    header,
    `No. Pengajuan: ${request.requestNumber}`,
    `Divisi: ${departmentName}`,
    `Pemohon: ${request.requesterName}`,
    `Keperluan: ${request.title}`,
    `Kategori: ${request.category}${request.vehiclePlate ? ` (${request.vehiclePlate})` : ''}`,
    `Nominal: ${amountText}`,
    `Ref. Bukti: ${request.receiptRef || '-'}`,
  ];

  if (eventType === 'decision' && request.approval.note) {
    lines.push(`Catatan Direktur: ${request.approval.note}`);
  }
  if (eventType === 'new_request') {
    lines.push('Mohon review & persetujuan Direktur di dashboard KasKu Kargo.');
  }
  return lines.join('\n');
}

export function buildLowBalanceWhatsAppMessage(
  metrics: DepartmentMetrics[]
): string {
  const lowDepts = metrics.filter(
    (m) => m.department.active !== false && m.healthStatus !== 'normal'
  );
  if (lowDepts.length === 0) {
    return '*[KasKu Kargo] Status Kas Aman*\nSeluruh saldo kas kecil divisi kargo saat ini berada di atas batas aman.';
  }
  const lines = [
    '*[KasKu Kargo] Peringatan Saldo Kas Menipis*',
    ...lowDepts.map(
      (m) =>
        `• ${m.department.code} (${m.department.name}): Tersedia Rp ${m.availableBalance.toLocaleString('id-ID')} (Batas aman Rp ${m.department.lowBalanceThreshold.toLocaleString('id-ID')})`
    ),
    'Mohon otorisasi Top-Up saldo dari Direktur.',
  ];
  return lines.join('\n');
}
