import crypto from 'node:crypto';
import type {
  ClosedPeriodRecord,
  DailyClosingRecord,
  UserRole,
} from '../../src/types/pettycash.ts';
import {
  calculateDailyClosingSummary,
  generateMonthlyReport,
  validateClosePeriod,
} from '../../src/utils/pettycashLogic.ts';
import { normalizePersonName } from '../../src/utils/formatters.ts';
import {
  checkLockedPeriodError,
  memoryDb,
  writeDbAtomically,
} from '../db.ts';

export function createDailyClosing(params: {
  closingDate: string;
  departmentId: string;
  closedBy: string;
  note?: string;
}): { ok: boolean; error?: string; closing?: DailyClosingRecord } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.closingDate ?? '')) {
    return { ok: false, error: 'Format tanggal tutup kas harus YYYY-MM-DD.' };
  }
  const lockErr = checkLockedPeriodError(params.closingDate);
  if (lockErr) return { ok: false, error: lockErr };

  const dept = memoryDb.departments.find((d) => d.id === params.departmentId);
  if (!dept) {
    return { ok: false, error: 'Divisi tidak ditemukan.' };
  }
  const closedBy = normalizePersonName(params.closedBy ?? '');
  if (closedBy.length < 2 || closedBy.length > 80) {
    return { ok: false, error: 'Nama petugas tutup kas wajib diisi (2–80 karakter).' };
  }

  const summary = calculateDailyClosingSummary({
    closingDate: params.closingDate,
    departmentId: dept.id,
    departments: memoryDb.departments,
    requests: memoryDb.requests,
    topUps: memoryDb.topUps,
    downPayments: memoryDb.downPayments,
    opnames: memoryDb.opnames,
  });

  const nowIso = new Date().toISOString();
  const monthCompact = params.closingDate.slice(0, 7).replace('-', '');
  const seq = String(memoryDb.closingCounter).padStart(3, '0');
  memoryDb.closingCounter += 1;

  const newClosing: DailyClosingRecord = {
    id: `cld-${crypto.randomUUID().slice(0, 8)}`,
    closingNumber: `CLD-${monthCompact}-${seq}`,
    closingDate: params.closingDate,
    departmentId: dept.id,
    departmentName: summary.departmentName,
    openingBalance: summary.openingBalance,
    totalInflow: summary.totalInflow,
    totalOutflow: summary.totalOutflow,
    systemClosingBalance: summary.systemClosingBalance,
    physicalCountTotal: summary.physicalCountTotal,
    variance: summary.variance,
    openKasbonCount: summary.openKasbonCount,
    openKasbonAmount: summary.openKasbonAmount,
    closedBy,
    note:
      (params.note ?? '').trim().slice(0, 400) ||
      'Tutup kas harian terverifikasi.',
    createdAt: nowIso,
  };

  memoryDb.dailyClosings = [newClosing, ...memoryDb.dailyClosings];
  writeDbAtomically(memoryDb);
  return { ok: true, closing: newClosing };
}

export function closeMonthlyPeriod(params: {
  monthKey: string;
  actorRole: UserRole | string;
  authorizedByRbac?: boolean;
  closedBy: string;
  note?: string;
}): { ok: boolean; error?: string; closedPeriod?: ClosedPeriodRecord } {
  if (!params.authorizedByRbac && params.actorRole !== 'director') {
    return {
      ok: false,
      error: 'Peran Anda tidak berwenang menutup & mengunci periode bulanan.',
    };
  }
  const check = validateClosePeriod({
    monthKey: params.monthKey,
    closedPeriods: memoryDb.closedPeriods,
    requests: memoryDb.requests,
    downPayments: memoryDb.downPayments,
    closedBy: params.closedBy,
  });
  if (!check.valid) {
    return { ok: false, error: check.error };
  }

  const report = generateMonthlyReport(
    params.monthKey,
    memoryDb.departments,
    memoryDb.requests,
    memoryDb.topUps,
    undefined,
    memoryDb.vehicles,
    memoryDb.downPayments
  );

  const endingBalance = memoryDb.departments.reduce((s, d) => s + d.balance, 0);
  const openKasbonAtClose = memoryDb.downPayments.filter(
    (dp) => dp.status === 'open'
  ).length;
  const nowIso = new Date().toISOString();

  const record: ClosedPeriodRecord = {
    id: `cp-${params.monthKey.replace('-', '')}`,
    monthKey: params.monthKey,
    totalTopUp: report.totalTopUp,
    totalSpent: report.totalSpent,
    endingBalance,
    approvedCount: report.approvedCount,
    openKasbonAtClose,
    closedBy: normalizePersonName(params.closedBy),
    note:
      (params.note ?? '').trim().slice(0, 400) ||
      `Tutup buku periode ${params.monthKey}.`,
    closedAt: nowIso,
  };

  memoryDb.closedPeriods = [record, ...memoryDb.closedPeriods].sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey)
  );
  writeDbAtomically(memoryDb);
  return { ok: true, closedPeriod: record };
}

export function reopenMonthlyPeriod(params: {
  monthKey: string;
  actorRole: UserRole | string;
  authorizedByRbac?: boolean;
}): { ok: boolean; error?: string } {
  if (!params.authorizedByRbac && params.actorRole !== 'director') {
    return {
      ok: false,
      error: 'Peran Anda tidak berwenang membuka kembali kunci periode bulanan.',
    };
  }
  const exists = memoryDb.closedPeriods.some(
    (cp) => cp.monthKey === params.monthKey
  );
  if (!exists) {
    return {
      ok: false,
      error: `Periode ${params.monthKey} tidak sedang dalam status terkunci.`,
    };
  }
  memoryDb.closedPeriods = memoryDb.closedPeriods.filter(
    (cp) => cp.monthKey !== params.monthKey
  );
  writeDbAtomically(memoryDb);
  return { ok: true };
}
