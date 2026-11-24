import type { TaxSchemeId, UserRole } from '../../types/pettycash.ts';

export const ROLE_LABELS: Record<UserRole, string> = {
  director: 'Direktur',
  staff: 'Staff Pemohon',
};

export interface TaxSchemeMeta {
  id: TaxSchemeId;
  group: 'none' | 'ppn' | 'pph23' | 'pph21';
  label: string;
  shortLabel: string;
  ratePct: number;
  description: string;
}

export const TAX_SCHEMES: TaxSchemeMeta[] = [
  {
    id: 'none',
    group: 'none',
    label: 'Tanpa Pajak / Harga Final',
    shortLabel: 'Non-Pajak',
    ratePct: 0,
    description: 'Nominal nota langsung dicairkan penuh tanpa pemisahan PPN/PPh.',
  },
  {
    id: 'ppn_exclusive',
    group: 'ppn',
    label: 'PPN 11% (Eksklusif · Tambah di atas DPP)',
    shortLabel: 'PPN 11% (+)',
    ratePct: 11,
    description:
      'Input nominal DPP; sistem menambahkan PPN Masukan 11% ke total kas dibayar (tarif efektif sesuai PMK 131/2024 & UU HPP).',
  },
  {
    id: 'ppn_inclusive',
    group: 'ppn',
    label: 'PPN 11% (Inklusif · Sudah Termasuk di Nota)',
    shortLabel: 'PPN 11% (Inkl.)',
    ratePct: 11,
    description:
      'Input total nota termasuk PPN; sistem memisahkan DPP dan PPN Masukan 11% tanpa mengubah kas keluar.',
  },
  {
    id: 'pph23_2',
    group: 'pph23',
    label: 'PPh Pasal 23 — Jasa Vendor / Servis / Sewa (Potong 2%)',
    shortLabel: 'PPh 23 (-2%)',
    ratePct: 2,
    description:
      'Input nilai jasa bruto; perusahaan memotong 2% PPh 23 sehingga kas yang dibayarkan ke vendor adalah 98%.',
  },
  {
    id: 'pph21_ter_05',
    group: 'pph21',
    label: 'PPh Pasal 21 — Buruh Harian > Rp 450rb/hari (TER 0,5%)',
    shortLabel: 'PPh 21 (TER 0,5%)',
    ratePct: 0.5,
    description:
      'Upah harian lepas Rp 450rb–2,5jt/hari dipotong TER 0,5% sesuai PP 58/2023 & PMK 168/2023 (≤ Rp 450rb/hari bebas potong 0%).',
  },
  {
    id: 'pph21_non_emp_25',
    group: 'pph21',
    label: 'PPh Pasal 21 — Jasa Perorangan Bukan Pegawai (Efektif 2,5%)',
    shortLabel: 'PPh 21 (-2,5%)',
    ratePct: 2.5,
    description:
      'Jasa teknisi/tenaga lepas perorangan: DPP 50% × bruto × tarif lapisan pertama 5% (efektif potong 2,5%).',
  },
];

export function getPreviousMonthKey(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  let year = Number(match[1]);
  let month = Number(match[2]) - 1;
  if (month === 0) {
    year -= 1;
    month = 12;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function computeMomDelta(
  current: number,
  previous: number
): { deltaAmount: number; deltaPct: number | null } {
  const deltaAmount = current - previous;
  if (previous <= 0) {
    return { deltaAmount, deltaPct: null };
  }
  const deltaPct = Math.round(((current - previous) / previous) * 1000) / 10;
  return { deltaAmount, deltaPct };
}

export function escapeCsvCell(value: string | number): string {
  let str = String(value);
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const REQUEST_REJECT_QUICK_ANSWERS: readonly string[] = [
  'Foto nota tidak terbaca / buram',
  'Nominal pengajuan tidak sesuai bukti struk',
  'No. polisi armada belum dicantumkan',
  'Melebihi batas kewajaran biaya rute',
  'Bukan biaya operasional mendesak (non-petty cash)',
  'Dugaan klaim ganda / nota sudah pernah diajukan',
];

export const REQUEST_APPROVE_QUICK_ANSWERS: readonly string[] = [
  'Sesuai surat jalan & bukti nota',
  'Disetujui sesuai plafon operasional',
  'Harap arsipkan struk asli ke bagian keuangan',
];

export const KASBON_REJECT_QUICK_ANSWERS: readonly string[] = [
  'Masih ada kasbon aktif yang belum direalisasi',
  'Estimasi uang muka melebihi kebutuhan rute',
  'Rincian keperluan & tanggal realisasi belum jelas',
  'Melebihi batas saldo tersedia divisi',
];

export const KASBON_APPROVE_QUICK_ANSWERS: readonly string[] = [
  'Wajib setor struk asli sebelum jatuh tempo',
  'Sesuai estimasi biaya rute kargo',
];

export const QUICK_ANSWER_CONSTANTS = {
  requestReject: REQUEST_REJECT_QUICK_ANSWERS,
  requestApprove: REQUEST_APPROVE_QUICK_ANSWERS,
  kasbonReject: KASBON_REJECT_QUICK_ANSWERS,
  kasbonApprove: KASBON_APPROVE_QUICK_ANSWERS,
} as const;

export function composeQuickAnswerNote(
  selectedOptions: readonly string[],
  includeOther: boolean,
  otherText: string
): string {
  const uniqueSelected: string[] = [];
  const seen = new Set<string>();
  for (const item of selectedOptions) {
    const trimmed = item.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      uniqueSelected.push(trimmed);
    }
  }

  const trimmedOther = includeOther ? otherText.trim() : '';
  if (uniqueSelected.length === 0) {
    return trimmedOther;
  }
  if (!trimmedOther) {
    return uniqueSelected.join('; ');
  }
  return `${uniqueSelected.join('; ')}; Lainnya: ${trimmedOther}`;
}

