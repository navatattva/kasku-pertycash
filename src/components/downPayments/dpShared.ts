import type {
  DownPaymentStatus,
  ExpenseCategory,
} from '../../types/pettycash.ts';

export const DP_STATUS_LABELS: Record<DownPaymentStatus, string> = {
  pending_director: 'Menunggu Direktur',
  open: 'Open (Belum Realisasi)',
  settled: 'Selesai Realisasi',
  rejected: 'Ditolak',
};

export function addDaysIso(baseDateStr: string, days: number): string {
  const baseMs = Date.parse(`${baseDateStr}T00:00:00.000Z`);
  if (!Number.isFinite(baseMs)) return baseDateStr;
  return new Date(baseMs + days * 86_400_000).toISOString().slice(0, 10);
}

export function diffDays(fromIsoDate: string, toIsoDate: string): number {
  const a = Date.parse(`${fromIsoDate}T00:00:00.000Z`);
  const b = Date.parse(`${toIsoDate}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export type CreateDownPaymentFn = (payload: {
  departmentId: string;
  employeeId?: string;
  requesterName: string;
  title: string;
  category: ExpenseCategory;
  vehicleId?: string;
  requestedAmount: number;
  dueDate: string;
  notes: string;
}) => Promise<{ ok: boolean; error?: string }>;

export type DecideDownPaymentFn = (payload: {
  dpId: string;
  decision: 'approve' | 'reject';
  note: string;
}) => Promise<{ ok: boolean; error?: string }>;

export type SettleDownPaymentFn = (payload: {
  dpId: string;
  actualAmount: number;
  receiptRef: string;
  receiptImageUrl?: string;
  receiptImageName?: string;
  note: string;
}) => Promise<{ ok: boolean; error?: string }>;
