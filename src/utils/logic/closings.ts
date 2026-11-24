import type {
  CashOpnameRecord,
  ClosedPeriodRecord,
  Department,
  DownPaymentRecord,
  PettyCashRequest,
  TopUpRecord,
} from '../../types/pettycash.ts';
import { normalizePersonName } from '../formatters.ts';
import { buildCashLedger } from './ledgerAndOpname.ts';

export function isPeriodClosed(
  isoDateOrMonthKey: string,
  closedPeriods: ClosedPeriodRecord[]
): ClosedPeriodRecord | undefined {
  const monthKey = isoDateOrMonthKey.slice(0, 7);
  return closedPeriods.find((cp) => cp.monthKey === monthKey);
}

export function calculateDailyClosingSummary(params: {
  closingDate: string;
  departmentId: string;
  departments: Department[];
  requests: PettyCashRequest[];
  topUps: TopUpRecord[];
  downPayments: DownPaymentRecord[];
  opnames: CashOpnameRecord[];
}): {
  departmentName: string;
  openingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  systemClosingBalance: number;
  physicalCountTotal: number | null;
  variance: number | null;
  openKasbonCount: number;
  openKasbonAmount: number;
} {
  const fullLedger = buildCashLedger(
    params.departments,
    params.requests,
    params.topUps,
    params.departmentId,
    'all',
    params.downPayments
  );

  const chronological = fullLedger.entries.slice().reverse();
  let openingBalance = fullLedger.openingBalance;
  let totalInflow = 0;
  let totalOutflow = 0;

  for (const entry of chronological) {
    const entryDate = entry.date.slice(0, 10);
    if (entryDate < params.closingDate) {
      openingBalance += entry.debit - entry.credit;
    } else if (entryDate === params.closingDate) {
      totalInflow += entry.debit;
      totalOutflow += entry.credit;
    }
  }

  const systemClosingBalance = openingBalance + totalInflow - totalOutflow;

  const deptOpnameToday = params.opnames.find(
    (op) =>
      op.departmentId === params.departmentId &&
      op.createdAt.slice(0, 10) === params.closingDate
  );

  const physicalCountTotal = deptOpnameToday
    ? deptOpnameToday.physicalTotal
    : null;
  const variance =
    physicalCountTotal !== null
      ? physicalCountTotal - systemClosingBalance
      : null;

  const openKasbons = params.downPayments.filter(
    (dp) =>
      dp.departmentId === params.departmentId && dp.status === 'open'
  );
  const openKasbonCount = openKasbons.length;
  const openKasbonAmount = openKasbons.reduce(
    (sum, dp) => sum + dp.requestedAmount,
    0
  );

  const dept = params.departments.find((d) => d.id === params.departmentId);

  return {
    departmentName: dept?.name ?? params.departmentId,
    openingBalance,
    totalInflow,
    totalOutflow,
    systemClosingBalance,
    physicalCountTotal,
    variance,
    openKasbonCount,
    openKasbonAmount,
  };
}

export function validateClosePeriod(params: {
  monthKey: string;
  closedPeriods: ClosedPeriodRecord[];
  requests: PettyCashRequest[];
  downPayments: DownPaymentRecord[];
  closedBy: string;
}): { valid: boolean; error?: string } {
  if (!/^\d{4}-\d{2}$/.test(params.monthKey)) {
    return { valid: false, error: 'Format periode harus YYYY-MM.' };
  }
  if (isPeriodClosed(params.monthKey, params.closedPeriods)) {
    return {
      valid: false,
      error: `Periode ${params.monthKey} sudah berstatus Terkunci.`,
    };
  }
  if (normalizePersonName(params.closedBy).length < 2) {
    return {
      valid: false,
      error: 'Nama Direktur/penutup periode wajib diisi.',
    };
  }

  const pendingReqs = params.requests.filter(
    (r) =>
      r.status === 'pending_director' &&
      r.createdAt.startsWith(params.monthKey)
  );
  if (pendingReqs.length > 0) {
    return {
      valid: false,
      error: `Periode ${params.monthKey} masih memiliki ${pendingReqs.length} pengajuan petty cash menunggu persetujuan. Proses atau tolak terlebih dahulu.`,
    };
  }

  const pendingDps = params.downPayments.filter(
    (dp) =>
      dp.status === 'pending_director' &&
      dp.createdAt.startsWith(params.monthKey)
  );
  if (pendingDps.length > 0) {
    return {
      valid: false,
      error: `Periode ${params.monthKey} masih memiliki ${pendingDps.length} pengajuan kasbon menunggu persetujuan.`,
    };
  }

  return { valid: true };
}
