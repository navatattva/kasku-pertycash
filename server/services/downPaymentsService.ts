import crypto from 'node:crypto';
import type {
  DownPaymentRecord,
  ExpenseCategory,
  UserRole,
} from '../../src/types/pettycash.ts';
import {
  checkSelfApprovalGuard,
  createInitialDirectorApproval,
  processDownPaymentDecision,
  validateDownPaymentCreation,
  validateDownPaymentSettlement,
} from '../../src/utils/pettycashLogic.ts';
import { normalizePersonName, normalizeRefCode } from '../../src/utils/formatters.ts';
import {
  checkLockedPeriodError,
  memoryDb,
  writeDbAtomically,
} from '../db.ts';
import { appendApprovalActivityLog } from './activityLogService.ts';

export function createDownPayment(payload: {
  departmentId: string;
  employeeId?: string;
  createdByUserId?: string;
  requesterName: string;
  title: string;
  category: ExpenseCategory;
  vehicleId?: string;
  requestedAmount: number;
  dueDate: string;
  notes?: string;
}): { ok: boolean; error?: string; downPayment?: DownPaymentRecord } {
  const nowIso = new Date().toISOString();
  const lockErr = checkLockedPeriodError(nowIso);
  if (lockErr) return { ok: false, error: lockErr };

  const dept = memoryDb.departments.find((d) => d.id === payload.departmentId);
  const employee = payload.employeeId
    ? memoryDb.employees.find((e) => e.id === payload.employeeId)
    : undefined;
  if (payload.employeeId && (!employee || !employee.active)) {
    return { ok: false, error: 'Pemohon tidak ditemukan atau berstatus nonaktif.' };
  }
  const canonicalRequesterName = employee
    ? employee.name
    : normalizePersonName(payload.requesterName);

  const vehicle = payload.vehicleId
    ? memoryDb.vehicles.find((v) => v.id === payload.vehicleId)
    : undefined;
  if (payload.vehicleId && (!vehicle || !vehicle.active)) {
    return { ok: false, error: 'Unit armada tidak ditemukan atau nonaktif.' };
  }

  const check = validateDownPaymentCreation(
    {
      departmentId: payload.departmentId,
      employeeId: employee?.id,
      requesterName: canonicalRequesterName,
      title: payload.title,
      category: payload.category,
      requestedAmount: payload.requestedAmount,
      dueDate: payload.dueDate,
      notes: payload.notes,
    },
    dept,
    memoryDb.requests,
    memoryDb.downPayments,
    nowIso
  );
  if (!check.valid || !dept) {
    return { ok: false, error: check.error || 'Data kasbon tidak valid.' };
  }

  const monthCompact = nowIso.slice(0, 7).replace('-', '');
  const seq = String(memoryDb.dpCounter).padStart(3, '0');
  memoryDb.dpCounter += 1;

  const newDp: DownPaymentRecord = {
    id: `dp-${crypto.randomUUID().slice(0, 8)}`,
    dpNumber: `KSB-${monthCompact}-${seq}`,
    departmentId: dept.id,
    employeeId: employee?.id,
    createdByUserId: payload.createdByUserId,
    requesterName: canonicalRequesterName,
    title: payload.title.trim(),
    category: payload.category,
    vehicleId: vehicle?.id,
    vehiclePlate: vehicle?.plateNumber,
    requestedAmount: payload.requestedAmount,
    dueDate: payload.dueDate,
    notes: (payload.notes ?? '').trim().slice(0, 400),
    status: 'pending_director',
    approval: createInitialDirectorApproval(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  memoryDb.downPayments = [newDp, ...memoryDb.downPayments];
  writeDbAtomically(memoryDb);
  return { ok: true, downPayment: newDp };
}

export function decideDownPayment(params: {
  dpId: string;
  actorUserId?: string;
  actorRole: UserRole | string;
  actorName: string;
  actorRoleLabel?: string;
  authorizedByRbac?: boolean;
  decision: 'approve' | 'reject';
  note: string;
}): { ok: boolean; error?: string; downPayment?: DownPaymentRecord } {
  const nowIso = new Date().toISOString();
  const lockErr = checkLockedPeriodError(nowIso);
  if (lockErr) return { ok: false, error: lockErr };

  const existingDp = memoryDb.downPayments.find((d) => d.id === params.dpId);
  if (!existingDp) {
    return { ok: false, error: 'Data kasbon tidak ditemukan.' };
  }
  const dept = memoryDb.departments.find((d) => d.id === existingDp.departmentId);
  if (!dept) {
    return { ok: false, error: 'Divisi kasbon tidak ditemukan.' };
  }

  if (params.decision === 'approve') {
    if (
      memoryDb.fraudGuard.enabled &&
      memoryDb.fraudGuard.preventSelfApproval &&
      params.actorUserId &&
      existingDp.createdByUserId &&
      params.actorUserId === existingDp.createdByUserId
    ) {
      return {
        ok: false,
        error:
          'Guard Anti-Fraud (Pemisahan Tugas): Akun yang menginput kasbon tidak diizinkan menyetujui kasbonnya sendiri.',
      };
    }
    const selfCheck = checkSelfApprovalGuard(
      existingDp.requesterName,
      params.actorName,
      memoryDb.fraudGuard
    );
    if (!selfCheck.ok) {
      return { ok: false, error: selfCheck.error };
    }
  }

  const transition = processDownPaymentDecision(
    existingDp,
    params.actorRole,
    params.actorName,
    params.decision,
    params.note,
    nowIso,
    {
      authorizedByRbac: params.authorizedByRbac,
      roleLabel: params.actorRoleLabel,
    }
  );
  if (!transition.ok || !transition.updatedDownPayment) {
    return { ok: false, error: transition.error };
  }

  if (transition.outcome === 'approved_open') {
    if (dept.balance < existingDp.requestedAmount) {
      return {
        ok: false,
        error: `Saldo aktual divisi ${dept.name} tidak mencukupi untuk mencairkan uang muka kasbon (saldo Rp ${dept.balance.toLocaleString('id-ID')}).`,
      };
    }
    dept.balance -= existingDp.requestedAmount;
    dept.updatedAt = nowIso;
  }

  memoryDb.downPayments = memoryDb.downPayments.map((dp) =>
    dp.id === existingDp.id ? transition.updatedDownPayment! : dp
  );

  appendApprovalActivityLog({
    actionType:
      params.decision === 'approve' ? 'kasbon_approved' : 'kasbon_rejected',
    entityType: 'down_payment',
    entityId: transition.updatedDownPayment.id,
    referenceNumber: transition.updatedDownPayment.dpNumber,
    title: transition.updatedDownPayment.title,
    departmentId: dept.id,
    departmentName: dept.name,
    requesterName: transition.updatedDownPayment.requesterName,
    amount: transition.updatedDownPayment.requestedAmount,
    decision: params.decision,
    actorName:
      transition.updatedDownPayment.approval.approverName ?? params.actorName,
    actorRole: params.actorRoleLabel ?? String(params.actorRole),
    note: transition.updatedDownPayment.approval.note ?? params.note,
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);
  return { ok: true, downPayment: transition.updatedDownPayment };
}

export function settleDownPayment(params: {
  dpId: string;
  actualAmount: number;
  receiptRef: string;
  receiptImageUrl?: string;
  receiptImageName?: string;
  settledBy: string;
  note?: string;
}): { ok: boolean; error?: string; downPayment?: DownPaymentRecord } {
  const nowIso = new Date().toISOString();
  const lockErr = checkLockedPeriodError(nowIso);
  if (lockErr) return { ok: false, error: lockErr };

  const existingDp = memoryDb.downPayments.find((d) => d.id === params.dpId);
  if (!existingDp) {
    return { ok: false, error: 'Data kasbon tidak ditemukan.' };
  }
  const dept = memoryDb.departments.find((d) => d.id === existingDp.departmentId);
  if (!dept) {
    return { ok: false, error: 'Divisi kasbon tidak ditemukan.' };
  }

  const safeImageUrl =
    params.receiptImageUrl &&
    /^\/api\/uploads\/[a-zA-Z0-9_\-]+\.(jpg|png|webp)$/.test(
      params.receiptImageUrl
    )
      ? params.receiptImageUrl
      : undefined;
  const formattedRef = normalizeRefCode(params.receiptRef ?? '').slice(0, 60);

  const check = validateDownPaymentSettlement({
    dp: existingDp,
    actualAmount: params.actualAmount,
    receiptRef: formattedRef || '-',
    receiptImageUrl: safeImageUrl,
    settledBy: params.settledBy,
    note: params.note,
    departmentBalance: dept.balance,
    fraudGuard: memoryDb.fraudGuard,
    existingRequests: memoryDb.requests,
    existingDownPayments: memoryDb.downPayments,
  });

  if (!check.valid || !check.settlementCalc) {
    return { ok: false, error: check.error || 'Realisasi struk kasbon tidak valid.' };
  }

  const { differenceAmount, differenceType, actualAmount } = check.settlementCalc;
  if (differenceType === 'refund' && differenceAmount > 0) {
    dept.balance += differenceAmount;
    dept.updatedAt = nowIso;
  } else if (differenceType === 'reimburse' && differenceAmount < 0) {
    dept.balance -= Math.abs(differenceAmount);
    dept.updatedAt = nowIso;
  }

  const updatedDp: DownPaymentRecord = {
    ...existingDp,
    status: 'settled',
    updatedAt: nowIso,
    settlement: {
      actualAmount,
      differenceAmount,
      differenceType,
      receiptRef: formattedRef || '-',
      receiptImageUrl: safeImageUrl,
      receiptImageName: safeImageUrl
        ? (params.receiptImageName ?? '').trim().slice(0, 80) || 'Lampiran Struk'
        : undefined,
      settledBy: normalizePersonName(params.settledBy),
      note: (params.note ?? '').trim().slice(0, 400),
      settledAt: nowIso,
    },
  };

  memoryDb.downPayments = memoryDb.downPayments.map((dp) =>
    dp.id === existingDp.id ? updatedDp : dp
  );
  writeDbAtomically(memoryDb);
  return { ok: true, downPayment: updatedDp };
}
