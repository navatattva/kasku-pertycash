import crypto from 'node:crypto';
import type { CashOpnameRecord, TopUpRecord } from '../../src/types/pettycash.ts';
import { validateCashOpnameInput } from '../../src/utils/pettycashLogic.ts';
import {
  checkLockedPeriodError,
  memoryDb,
  writeDbAtomically,
} from '../db.ts';

export function topUpDepartment(params: {
  departmentId: string;
  amount: number;
  performedBy: string;
  note: string;
}): { ok: boolean; error?: string } {
  const dept = memoryDb.departments.find((d) => d.id === params.departmentId);
  if (!dept) {
    return { ok: false, error: 'Divisi tidak ditemukan.' };
  }
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    return { ok: false, error: 'Nominal top-up harus angka bulat positif.' };
  }
  if (params.amount > 500_000_000) {
    return {
      ok: false,
      error: 'Nominal top-up melebihi batas maksimum per transaksi.',
    };
  }
  const nowIso = new Date().toISOString();
  const lockErr = checkLockedPeriodError(nowIso);
  if (lockErr) return { ok: false, error: lockErr };

  dept.balance += params.amount;
  dept.updatedAt = nowIso;

  const record: TopUpRecord = {
    id: `top-${crypto.randomUUID().slice(0, 8)}`,
    departmentId: dept.id,
    amount: params.amount,
    performedBy: params.performedBy.trim() || 'Direktur',
    note: params.note.trim() || 'Pengisian ulang saldo kas kecil',
    createdAt: nowIso,
  };
  memoryDb.topUps = [record, ...memoryDb.topUps];
  writeDbAtomically(memoryDb);
  return { ok: true };
}

export function createCashOpnameRecord(params: {
  departmentId: string;
  countedBy: string;
  note: string;
  denominations: { denomination: number; count: number }[];
}): { ok: boolean; error?: string; opname?: CashOpnameRecord } {
  const nowIso = new Date().toISOString();
  const lockErr = checkLockedPeriodError(nowIso);
  if (lockErr) return { ok: false, error: lockErr };

  const dept = memoryDb.departments.find((d) => d.id === params.departmentId);
  const check = validateCashOpnameInput({
    department: dept,
    countedBy: params.countedBy,
    note: params.note,
    denominations: params.denominations,
  });

  if (!check.valid || !check.summary || !dept) {
    return { ok: false, error: check.error || 'Data cash opname tidak valid.' };
  }

  const monthCompact = nowIso.slice(0, 7).replace('-', '');
  const seq = String(memoryDb.opnameCounter).padStart(3, '0');
  memoryDb.opnameCounter += 1;

  const newOpname: CashOpnameRecord = {
    id: `opn-${crypto.randomUUID().slice(0, 8)}`,
    opnameNumber: `OPN-${monthCompact}-${seq}`,
    departmentId: dept.id,
    systemBalance: dept.balance,
    physicalTotal: check.summary.physicalTotal,
    variance: check.summary.variance,
    status: check.summary.status,
    denominations: check.summary.denominations,
    countedBy: check.countedBy!,
    note: check.note!,
    createdAt: nowIso,
  };

  memoryDb.opnames = [newOpname, ...memoryDb.opnames];
  writeDbAtomically(memoryDb);
  return { ok: true, opname: newOpname };
}
