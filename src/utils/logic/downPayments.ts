import type {
  ApprovalDecisionInfo,
  Department,
  DownPaymentRecord,
  ExpenseCategory,
  FraudGuardConfig,
  PettyCashRequest,
  UserRole,
} from '../../types/pettycash.ts';
import { normalizePersonName } from '../formatters.ts';
import { calculatePendingHoldForDepartment } from './requests.ts';

export interface DownPaymentCreationInput {
  departmentId: string;
  employeeId?: string;
  requesterName: string;
  title: string;
  category: ExpenseCategory;
  requestedAmount: number;
  dueDate: string;
  notes?: string;
}

export function validateDownPaymentCreation(
  input: DownPaymentCreationInput,
  department: Department | undefined,
  existingRequests: PettyCashRequest[],
  existingDownPayments: DownPaymentRecord[],
  nowIso: string
): { valid: boolean; error?: string } {
  if (!department) {
    return { valid: false, error: 'Divisi tidak ditemukan.' };
  }
  if (department.active === false) {
    return {
      valid: false,
      error: `Divisi ${department.name} sedang berstatus nonaktif.`,
    };
  }
  const title = input.title?.trim() ?? '';
  if (title.length < 3 || title.length > 140) {
    return {
      valid: false,
      error: 'Judul keperluan kasbon wajib diisi (3–140 karakter).',
    };
  }
  const requesterName = normalizePersonName(input.requesterName ?? '');
  if (requesterName.length < 2 || requesterName.length > 80) {
    return {
      valid: false,
      error: 'Nama pemohon kasbon wajib diisi (2–80 karakter).',
    };
  }
  if (!Number.isInteger(input.requestedAmount) || input.requestedAmount <= 0) {
    return {
      valid: false,
      error: 'Nominal uang muka kasbon harus angka bulat lebih dari Rp 0.',
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate ?? '')) {
    return {
      valid: false,
      error: 'Tanggal jatuh tempo realisasi struk wajib diisi (YYYY-MM-DD).',
    };
  }
  if (input.dueDate < nowIso.slice(0, 10)) {
    return {
      valid: false,
      error: 'Tanggal jatuh tempo realisasi tidak boleh di masa lalu.',
    };
  }

  // Block creating new kasbon if requester still has an open or pending kasbon
  const requesterLower = requesterName.toLowerCase();
  const activeKasbon = existingDownPayments.find((dp) => {
    if (dp.status !== 'open' && dp.status !== 'pending_director') return false;
    if (input.employeeId && dp.employeeId === input.employeeId) return true;
    return (
      normalizePersonName(dp.requesterName).toLowerCase() === requesterLower
    );
  });
  if (activeKasbon) {
    return {
      valid: false,
      error: `Kontrol Kasbon: ${requesterName} masih memiliki kasbon ${activeKasbon.dpNumber} (${
        activeKasbon.status === 'open'
          ? 'Belum Realisasi Struk'
          : 'Menunggu Persetujuan'
      }). Selesaikan realisasi struk terlebih dahulu.`,
    };
  }

  const pendingHold = calculatePendingHoldForDepartment(
    department.id,
    existingRequests,
    existingDownPayments
  );
  const availableBalance = department.balance - pendingHold;
  if (input.requestedAmount > availableBalance) {
    return {
      valid: false,
      error: `Nominal kasbon melebihi saldo tersedia divisi ${department.name} (tersedia Rp ${availableBalance.toLocaleString('id-ID')}).`,
    };
  }

  return { valid: true };
}

export function processDownPaymentDecision(
  dp: DownPaymentRecord,
  actorRole: UserRole | string,
  actorName: string,
  decision: 'approve' | 'reject',
  note: string,
  nowIso: string,
  options?: { authorizedByRbac?: boolean; roleLabel?: string }
): {
  ok: boolean;
  error?: string;
  updatedDownPayment?: DownPaymentRecord;
  outcome?: 'approved_open' | 'rejected';
} {
  if (dp.status !== 'pending_director') {
    return {
      ok: false,
      error: 'Kasbon ini sudah diputuskan dan tidak dapat diproses ulang.',
    };
  }
  const hasAuthority =
    options?.authorizedByRbac === true || actorRole === 'director';
  if (!hasAuthority) {
    return {
      ok: false,
      error: 'Peran Anda tidak memiliki izin menyetujui atau menolak pencairan kasbon.',
    };
  }
  const trimmedNote = note.trim();
  if (decision === 'reject' && trimmedNote.length < 3) {
    return {
      ok: false,
      error: 'Alasan penolakan kasbon wajib diisi minimal 3 karakter.',
    };
  }

  const approval: ApprovalDecisionInfo = {
    roleLabel: options?.roleLabel?.trim() || 'Direktur',
    status: decision === 'approve' ? 'approved' : 'rejected',
    approverName: actorName.trim() || 'Direktur',
    decidedAt: nowIso,
    note: trimmedNote || undefined,
  };

  if (decision === 'reject') {
    return {
      ok: true,
      outcome: 'rejected',
      updatedDownPayment: {
        ...dp,
        status: 'rejected',
        approval,
        updatedAt: nowIso,
      },
    };
  }

  return {
    ok: true,
    outcome: 'approved_open',
    updatedDownPayment: {
      ...dp,
      status: 'open',
      approval,
      updatedAt: nowIso,
      disbursedAt: nowIso,
    },
  };
}

export function calculateDownPaymentSettlement(
  requestedAmount: number,
  actualAmount: number
): {
  actualAmount: number;
  differenceAmount: number;
  differenceType: 'exact' | 'refund' | 'reimburse';
} {
  const safeReq = Math.max(0, Math.round(requestedAmount));
  const safeAct = Math.max(0, Math.round(actualAmount));
  const differenceAmount = safeReq - safeAct;
  if (differenceAmount > 0) {
    return {
      actualAmount: safeAct,
      differenceAmount,
      differenceType: 'refund',
    };
  }
  if (differenceAmount < 0) {
    return {
      actualAmount: safeAct,
      differenceAmount,
      differenceType: 'reimburse',
    };
  }
  return {
    actualAmount: safeAct,
    differenceAmount: 0,
    differenceType: 'exact',
  };
}

export function validateDownPaymentSettlement(params: {
  dp: DownPaymentRecord | undefined;
  actualAmount: number;
  receiptRef: string;
  receiptImageUrl?: string;
  settledBy: string;
  note?: string;
  departmentBalance: number;
  fraudGuard: FraudGuardConfig;
  existingRequests: PettyCashRequest[];
  existingDownPayments: DownPaymentRecord[];
}): {
  valid: boolean;
  error?: string;
  settlementCalc?: ReturnType<typeof calculateDownPaymentSettlement>;
} {
  const { dp } = params;
  if (!dp) {
    return { valid: false, error: 'Data kasbon tidak ditemukan.' };
  }
  if (dp.status !== 'open') {
    return {
      valid: false,
      error: 'Hanya kasbon berstatus Open (Belum Realisasi) yang dapat direalisasikan.',
    };
  }
  if (!Number.isInteger(params.actualAmount) || params.actualAmount < 0) {
    return {
      valid: false,
      error: 'Nominal realisasi struk harus berupa angka bulat ≥ Rp 0.',
    };
  }
  const settledBy = normalizePersonName(params.settledBy);
  if (settledBy.length < 2) {
    return { valid: false, error: 'Nama petugas verifikasi wajib diisi.' };
  }

  if (
    params.fraudGuard.enabled &&
    params.fraudGuard.requireReceiptImage &&
    params.actualAmount >= params.fraudGuard.receiptRequiredMinAmount &&
    params.actualAmount > 0 &&
    !params.receiptImageUrl
  ) {
    return {
      valid: false,
      error:
        'Guard Anti-Fraud: Foto nota/struk asli wajib dilampirkan saat realisasi kasbon.',
    };
  }

  const normalizedRef = (params.receiptRef ?? '').trim().toUpperCase();
  if (
    params.fraudGuard.enabled &&
    params.fraudGuard.blockDuplicateReceiptRef &&
    normalizedRef &&
    normalizedRef !== '-'
  ) {
    const dupReq = params.existingRequests.find(
      (r) =>
        r.status !== 'rejected' &&
        r.receiptRef.trim().toUpperCase() === normalizedRef
    );
    const dupDp = params.existingDownPayments.find(
      (other) =>
        other.id !== dp.id &&
        other.status === 'settled' &&
        other.settlement?.receiptRef.trim().toUpperCase() === normalizedRef
    );
    if (dupReq || dupDp) {
      return {
        valid: false,
        error: `Guard Anti-Fraud: Nomor bukti "${normalizedRef}" sudah pernah digunakan pada ${
          dupReq?.requestNumber ?? dupDp?.dpNumber
        }.`,
      };
    }
  }

  const settlementCalc = calculateDownPaymentSettlement(
    dp.requestedAmount,
    params.actualAmount
  );

  if (settlementCalc.differenceType === 'reimburse') {
    const reimburseNeeded = Math.abs(settlementCalc.differenceAmount);
    if (params.departmentBalance < reimburseNeeded) {
      return {
        valid: false,
        error: `Saldo divisi tidak mencukupi untuk membayar selisih kurang bayar realisasi (butuh Rp ${reimburseNeeded.toLocaleString('id-ID')}).`,
      };
    }
  }

  return { valid: true, settlementCalc };
}
