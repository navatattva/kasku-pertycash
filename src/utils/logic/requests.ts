import type {
  ApprovalDecisionInfo,
  Department,
  DepartmentMetrics,
  DownPaymentRecord,
  ExpenseCategory,
  PettyCashRequest,
  UserRole,
} from '../../types/pettycash.ts';

export function createInitialDirectorApproval(): ApprovalDecisionInfo {
  return {
    roleLabel: 'Direktur',
    status: 'pending',
  };
}

export function calculatePendingHoldForDepartment(
  departmentId: string,
  requests: PettyCashRequest[],
  downPayments: DownPaymentRecord[] = []
): number {
  const reqHold = requests.reduce((sum, req) => {
    if (req.departmentId === departmentId && req.status === 'pending_director') {
      return sum + req.amount;
    }
    return sum;
  }, 0);
  const dpHold = downPayments.reduce((sum, dp) => {
    if (dp.departmentId === departmentId && dp.status === 'pending_director') {
      return sum + dp.requestedAmount;
    }
    return sum;
  }, 0);
  return reqHold + dpHold;
}

export interface SubmissionInput {
  departmentId: string;
  requesterName: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string;
  receiptRef?: string;
}

export function validateRequestSubmission(
  input: SubmissionInput,
  department: Department | undefined,
  existingRequests: PettyCashRequest[],
  existingDownPayments: DownPaymentRecord[] = []
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
      error: 'Judul keperluan wajib diisi (3–140 karakter).',
    };
  }
  const requesterName = input.requesterName?.trim() ?? '';
  if (requesterName.length < 2 || requesterName.length > 80) {
    return {
      valid: false,
      error: 'Nama pemohon wajib diisi (2–80 karakter).',
    };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return {
      valid: false,
      error: 'Nominal pengajuan harus lebih besar dari Rp 0.',
    };
  }
  if (!Number.isInteger(input.amount)) {
    return {
      valid: false,
      error: 'Nominal pengajuan harus berupa angka bulat Rupiah.',
    };
  }
  const pendingHold = calculatePendingHoldForDepartment(
    department.id,
    existingRequests,
    existingDownPayments
  );
  const availableBalance = department.balance - pendingHold;
  if (input.amount > availableBalance) {
    return {
      valid: false,
      error: `Nominal melebihi saldo tersedia divisi ${department.name} (tersedia Rp ${availableBalance.toLocaleString('id-ID')}).`,
    };
  }
  return { valid: true };
}

export function canRoleActOnRequest(
  role: UserRole,
  request: PettyCashRequest
): boolean {
  return role === 'director' && request.status === 'pending_director';
}

export interface ApprovalTransitionResult {
  ok: boolean;
  error?: string;
  updatedRequest?: PettyCashRequest;
  outcome?: 'final_approved' | 'rejected';
}

export function processApprovalTransition(
  request: PettyCashRequest,
  actorRole: UserRole | string,
  actorName: string,
  decision: 'approve' | 'reject',
  note: string,
  nowIso: string,
  options?: { authorizedByRbac?: boolean; roleLabel?: string }
): ApprovalTransitionResult {
  if (request.status !== 'pending_director') {
    return {
      ok: false,
      error: 'Pengajuan ini sudah berstatus final dan tidak dapat diubah.',
    };
  }
  const hasAuthority =
    options?.authorizedByRbac === true ||
    canRoleActOnRequest(actorRole as UserRole, request);
  if (!hasAuthority) {
    return {
      ok: false,
      error: 'Peran Anda tidak memiliki izin menyetujui atau menolak pengajuan kas kecil.',
    };
  }
  const trimmedNote = note.trim();
  if (decision === 'reject' && trimmedNote.length < 3) {
    return {
      ok: false,
      error: 'Alasan penolakan wajib diisi minimal 3 karakter.',
    };
  }

  const updatedApproval: ApprovalDecisionInfo = {
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
      updatedRequest: {
        ...request,
        status: 'rejected',
        approval: updatedApproval,
        updatedAt: nowIso,
      },
    };
  }

  return {
    ok: true,
    outcome: 'final_approved',
    updatedRequest: {
      ...request,
      status: 'approved',
      approval: updatedApproval,
      updatedAt: nowIso,
      disbursedAt: nowIso,
    },
  };
}

export function calculateDepartmentMetrics(
  department: Department,
  requests: PettyCashRequest[],
  monthKey: string,
  downPayments: DownPaymentRecord[] = []
): DepartmentMetrics {
  const pendingHold = calculatePendingHoldForDepartment(
    department.id,
    requests,
    downPayments
  );
  const availableBalance = Math.max(0, department.balance - pendingHold);

  const monthApproved = requests.filter(
    (r) =>
      r.departmentId === department.id &&
      r.status === 'approved' &&
      (r.disbursedAt ?? r.updatedAt).startsWith(monthKey)
  );
  const monthSettledKasbon = downPayments.filter(
    (dp) =>
      dp.departmentId === department.id &&
      dp.status === 'settled' &&
      dp.settlement &&
      dp.settlement.settledAt.startsWith(monthKey)
  );
  const monthSpent =
    monthApproved.reduce((sum, r) => sum + r.amount, 0) +
    monthSettledKasbon.reduce(
      (sum, dp) => sum + (dp.settlement?.actualAmount ?? 0),
      0
    );
  const budgetUtilizationPct =
    department.monthlyBudget > 0
      ? Math.round((monthSpent / department.monthlyBudget) * 1000) / 10
      : 0;

  let healthStatus: 'normal' | 'menipis' | 'kritis' = 'normal';
  if (availableBalance <= department.lowBalanceThreshold * 0.5) {
    healthStatus = 'kritis';
  } else if (availableBalance <= department.lowBalanceThreshold) {
    healthStatus = 'menipis';
  }

  return {
    department,
    pendingHold,
    availableBalance,
    monthSpent,
    monthRequestCount: monthApproved.length + monthSettledKasbon.length,
    budgetUtilizationPct,
    healthStatus,
  };
}
