import crypto from 'node:crypto';
import type {
  ExpenseCategory,
  PettyCashRequest,
  TaxCalculationInfo,
  TaxSchemeId,
  UserRole,
  WhatsAppDispatchLog,
} from '../../src/types/pettycash.ts';
import {
  buildRequestWhatsAppMessage,
  buildWhatsAppDeepLink,
  calculateIndonesianTax,
  checkSelfApprovalGuard,
  createInitialDirectorApproval,
  evaluateFraudGuards,
  processApprovalTransition,
  validateRequestSubmission,
} from '../../src/utils/pettycashLogic.ts';
import { normalizeRefCode } from '../../src/utils/formatters.ts';
import {
  checkLockedPeriodError,
  memoryDb,
  writeDbAtomically,
} from '../db.ts';
import { appendApprovalActivityLog } from './activityLogService.ts';

export function createPettyCashRequest(payload: {
  departmentId: string;
  employeeId?: string;
  createdByUserId?: string;
  requesterName: string;
  title: string;
  category: ExpenseCategory;
  vehicleId?: string;
  amount: number;
  taxType?: TaxSchemeId;
  notes?: string;
  receiptRef?: string;
  receiptImageUrl?: string;
  receiptImageName?: string;
}): { ok: boolean; error?: string; request?: PettyCashRequest } {
  const dept = memoryDb.departments.find((d) => d.id === payload.departmentId);

  const employee = payload.employeeId
    ? memoryDb.employees.find((e) => e.id === payload.employeeId)
    : undefined;
  if (payload.employeeId && (!employee || !employee.active)) {
    return { ok: false, error: 'Pemohon tidak ditemukan atau berstatus nonaktif.' };
  }

  const canonicalRequesterName = employee
    ? employee.name
    : payload.requesterName.trim();

  const vehicle = payload.vehicleId
    ? memoryDb.vehicles.find((v) => v.id === payload.vehicleId)
    : undefined;
  if (payload.vehicleId && (!vehicle || !vehicle.active)) {
    return { ok: false, error: 'Unit armada tidak ditemukan atau nonaktif.' };
  }

  const requestedTaxType: TaxSchemeId = payload.taxType ?? 'none';
  let taxInfo: TaxCalculationInfo | undefined;
  let effectiveAmount = payload.amount;

  if (requestedTaxType !== 'none') {
    if (!memoryDb.taxModule.enabled) {
      return {
        ok: false,
        error:
          'Modul Perhitungan Pajak sedang nonaktif. Pilih Tanpa Pajak atau aktifkan modul di menu Modul Pajak.',
      };
    }
    const isPpn =
      requestedTaxType === 'ppn_exclusive' ||
      requestedTaxType === 'ppn_inclusive';
    const isPph23 = requestedTaxType === 'pph23_2';
    const isPph21 =
      requestedTaxType === 'pph21_ter_05' ||
      requestedTaxType === 'pph21_non_emp_25';
    if (
      (isPpn && !memoryDb.taxModule.enablePpn) ||
      (isPph23 && !memoryDb.taxModule.enablePph23) ||
      (isPph21 && !memoryDb.taxModule.enablePph21)
    ) {
      return {
        ok: false,
        error: 'Skema pajak yang dipilih sedang dinonaktifkan pada pengaturan modul.',
      };
    }
    if (!Number.isInteger(payload.amount) || payload.amount <= 0) {
      return {
        ok: false,
        error: 'Nominal dasar pengajuan harus berupa angka bulat Rupiah lebih dari Rp 0.',
      };
    }
    taxInfo = calculateIndonesianTax(payload.amount, requestedTaxType);
    effectiveAmount = taxInfo.netDisbursed;
  }

  const nowIso = new Date().toISOString();
  const lockErr = checkLockedPeriodError(nowIso);
  if (lockErr) return { ok: false, error: lockErr };

  const validation = validateRequestSubmission(
    {
      ...payload,
      amount: effectiveAmount,
      requesterName: canonicalRequesterName,
    },
    dept,
    memoryDb.requests,
    memoryDb.downPayments
  );
  if (!validation.valid || !dept) {
    return { ok: false, error: validation.error || 'Data pengajuan tidak valid.' };
  }

  const monthCompact = nowIso.slice(0, 7).replace('-', '');

  const safeImageUrl =
    payload.receiptImageUrl &&
    /^\/api\/uploads\/[a-zA-Z0-9_\-]+\.(jpg|png|webp)$/.test(
      payload.receiptImageUrl
    )
      ? payload.receiptImageUrl
      : undefined;

  const formattedRef = normalizeRefCode(payload.receiptRef ?? '').slice(0, 60);

  const fraudEval = evaluateFraudGuards(
    {
      departmentId: dept.id,
      requesterName: canonicalRequesterName,
      category: payload.category,
      vehicleId: vehicle?.id,
      amount: effectiveAmount,
      receiptRef: formattedRef || '-',
      receiptImageUrl: safeImageUrl,
    },
    memoryDb.fraudGuard,
    memoryDb.requests,
    memoryDb.categories,
    nowIso
  );

  if (fraudEval.blockingErrors.length > 0) {
    return { ok: false, error: fraudEval.blockingErrors[0] };
  }

  const seq = String(memoryDb.sequenceCounter).padStart(3, '0');
  memoryDb.sequenceCounter += 1;

  const newRequest: PettyCashRequest = {
    id: `req-${crypto.randomUUID().slice(0, 8)}`,
    requestNumber: `PC-${monthCompact}-${seq}`,
    departmentId: dept.id,
    employeeId: employee?.id,
    createdByUserId: payload.createdByUserId,
    requesterName: canonicalRequesterName,
    title: payload.title.trim(),
    category: payload.category,
    vehicleId: vehicle?.id,
    vehiclePlate: vehicle?.plateNumber,
    amount: effectiveAmount,
    ...(taxInfo ? { tax: taxInfo } : {}),
    ...(fraudEval.warnings.length > 0 ? { fraudFlags: fraudEval.warnings } : {}),
    notes: (payload.notes ?? '').trim().slice(0, 400),
    receiptRef: formattedRef || '-',
    receiptImageUrl: safeImageUrl,
    receiptImageName: safeImageUrl
      ? (payload.receiptImageName ?? '').trim().slice(0, 80) || 'Lampiran Nota'
      : undefined,
    status: 'pending_director',
    approval: createInitialDirectorApproval(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  memoryDb.requests = [newRequest, ...memoryDb.requests];
  if (
    memoryDb.whatsappModule.enabled &&
    memoryDb.whatsappModule.autoSendOnNewRequest
  ) {
    const waText = buildRequestWhatsAppMessage({
      eventType: 'new_request',
      request: newRequest,
      departmentName: dept.name,
    });
    const waLog: WhatsAppDispatchLog = {
      id: `wa-${crypto.randomUUID().slice(0, 8)}`,
      eventType: 'new_request',
      recipientPhone: memoryDb.whatsappModule.directorPhone,
      referenceNumber: newRequest.requestNumber,
      messagePreview: waText,
      waLink: buildWhatsAppDeepLink(
        memoryDb.whatsappModule.directorPhone,
        waText
      ),
      status: 'queued',
      createdAt: nowIso,
    };
    memoryDb.whatsappLogs = [waLog, ...memoryDb.whatsappLogs].slice(0, 50);
  }
  writeDbAtomically(memoryDb);

  return { ok: true, request: newRequest };
}

export function decidePettyCashRequest(params: {
  requestId: string;
  actorUserId?: string;
  actorRole: UserRole | string;
  actorName: string;
  actorRoleLabel?: string;
  authorizedByRbac?: boolean;
  decision: 'approve' | 'reject';
  note: string;
}): { ok: boolean; error?: string; request?: PettyCashRequest } {
  const existingReq = memoryDb.requests.find((r) => r.id === params.requestId);
  if (!existingReq) {
    return { ok: false, error: 'Pengajuan tidak ditemukan.' };
  }
  const dept = memoryDb.departments.find(
    (d) => d.id === existingReq.departmentId
  );
  if (!dept) {
    return { ok: false, error: 'Divisi terkait tidak ditemukan.' };
  }

  if (params.decision === 'approve') {
    if (
      memoryDb.fraudGuard.enabled &&
      memoryDb.fraudGuard.preventSelfApproval &&
      params.actorUserId &&
      existingReq.createdByUserId &&
      params.actorUserId === existingReq.createdByUserId
    ) {
      return {
        ok: false,
        error:
          'Guard Anti-Fraud (Pemisahan Tugas): Akun yang menginput pengajuan tidak diizinkan menyetujui pengajuannya sendiri.',
      };
    }
    const selfCheck = checkSelfApprovalGuard(
      existingReq.requesterName,
      params.actorName,
      memoryDb.fraudGuard
    );
    if (!selfCheck.ok) {
      return { ok: false, error: selfCheck.error };
    }
  }

  const nowIso = new Date().toISOString();
  const lockErr = checkLockedPeriodError(nowIso);
  if (lockErr) return { ok: false, error: lockErr };

  const transition = processApprovalTransition(
    existingReq,
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

  if (!transition.ok || !transition.updatedRequest) {
    return { ok: false, error: transition.error };
  }

  if (transition.outcome === 'final_approved') {
    if (dept.balance < existingReq.amount) {
      return {
        ok: false,
        error: `Saldo aktual divisi ${dept.name} tidak mencukupi untuk pencairan (Rp ${dept.balance.toLocaleString('id-ID')}). Silakan lakukan Top-Up saldo terlebih dahulu.`,
      };
    }
    dept.balance -= existingReq.amount;
    dept.updatedAt = nowIso;
  }

  memoryDb.requests = memoryDb.requests.map((r) =>
    r.id === existingReq.id ? transition.updatedRequest! : r
  );
  if (
    memoryDb.whatsappModule.enabled &&
    memoryDb.whatsappModule.autoSendOnDecision
  ) {
    const waText = buildRequestWhatsAppMessage({
      eventType: 'decision',
      request: transition.updatedRequest,
      departmentName: dept.name,
    });
    const waLog: WhatsAppDispatchLog = {
      id: `wa-${crypto.randomUUID().slice(0, 8)}`,
      eventType: 'decision',
      recipientPhone: memoryDb.whatsappModule.directorPhone,
      referenceNumber: transition.updatedRequest.requestNumber,
      messagePreview: waText,
      waLink: buildWhatsAppDeepLink(
        memoryDb.whatsappModule.directorPhone,
        waText
      ),
      status: 'queued',
      createdAt: nowIso,
    };
    memoryDb.whatsappLogs = [waLog, ...memoryDb.whatsappLogs].slice(0, 50);
  }

  appendApprovalActivityLog({
    actionType:
      params.decision === 'approve' ? 'request_approved' : 'request_rejected',
    entityType: 'petty_cash_request',
    entityId: transition.updatedRequest.id,
    referenceNumber: transition.updatedRequest.requestNumber,
    title: transition.updatedRequest.title,
    departmentId: dept.id,
    departmentName: dept.name,
    requesterName: transition.updatedRequest.requesterName,
    amount: transition.updatedRequest.amount,
    decision: params.decision,
    actorName:
      transition.updatedRequest.approval.approverName ?? params.actorName,
    actorRole: params.actorRoleLabel ?? String(params.actorRole),
    note: transition.updatedRequest.approval.note ?? params.note,
    timestamp: nowIso,
  });

  writeDbAtomically(memoryDb);

  return { ok: true, request: transition.updatedRequest };
}
