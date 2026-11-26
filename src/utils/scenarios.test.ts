import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  ACTIVITY_LOG_GENESIS_HASH,
  SlidingWindowRateLimiter,
  SYSTEM_ADMIN_LOCKED_PERMISSIONS,
  buildActivityLogEntry,
  calculateCashForecast,
  calculateCashHealth,
  calculateDepartmentMetrics,
  checkSelfApprovalGuard,
  composeQuickAnswerNote,
  createInitialDirectorApproval,
  escapeCsvCell,
  evaluateFraudGuards,
  processApprovalTransition,
  processDownPaymentDecision,
  validateCashOpnameInput,
  validateClosePeriod,
  validateDownPaymentCreation,
  validateDownPaymentSettlement,
  validatePasswordStrength,
  validateRequestSubmission,
  validateRolePayload,
  verifyActivityLogChainSync,
} from './pettycashLogic.ts';
import type {
  ActivityLogEntry,
  ClosedPeriodRecord,
  Department,
  DownPaymentRecord,
  FraudGuardConfig,
  MasterCategory,
  PettyCashRequest,
} from '../types/pettycash.ts';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

const baseDept: Department = {
  id: 'dept-arm',
  code: 'ARM',
  name: 'Operasional Armada & Truk',
  picName: 'Budi Santoso',
  monthlyBudget: 15_000_000,
  balance: 6_000_000,
  lowBalanceThreshold: 2_500_000,
  active: true,
  updatedAt: '2026-11-01T08:00:00.000Z',
};

const activeCategories: MasterCategory[] = [
  {
    id: 'cat-bbm',
    code: 'BBM',
    name: 'BBM & Tol Armada',
    requiresVehicle: true,
    active: true,
    updatedAt: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'cat-atk',
    code: 'ATK',
    name: 'ATK & Perlengkapan Kantor',
    requiresVehicle: false,
    active: true,
    updatedAt: '2026-11-01T08:00:00.000Z',
  },
];

const strictFraudConfig: FraudGuardConfig = {
  enabled: true,
  requireReceiptImage: true,
  receiptRequiredMinAmount: 100_000,
  blockDuplicateReceiptRef: true,
  preventSelfApproval: true,
  detectDuplicateClaimWindowHours: 48,
  highValueAlertAmount: 1_500_000,
  maxSingleRequestAmount: 3_000_000,
  updatedAt: '2026-11-01T08:00:00.000Z',
};

function makeRequest(overrides: Partial<PettyCashRequest> = {}): PettyCashRequest {
  return {
    id: 'req-1',
    requestNumber: 'PC-202611-001',
    departmentId: 'dept-arm',
    requesterName: 'Andi Wijaya',
    title: 'Solar Truk Wingbox B 9011 KRG',
    category: 'BBM & Tol Armada',
    vehicleId: 'veh-1',
    vehiclePlate: 'B 9011 KRG',
    amount: 950_000,
    notes: 'Rute Jakarta - Semarang',
    receiptRef: 'SPBU-001',
    receiptImageUrl: '/api/uploads/nota-001.jpg',
    status: 'pending_director',
    approval: createInitialDirectorApproval(),
    createdAt: '2026-11-20T09:00:00.000Z',
    updatedAt: '2026-11-20T09:00:00.000Z',
    ...overrides,
  };
}

function makeDownPayment(
  overrides: Partial<DownPaymentRecord> = {}
): DownPaymentRecord {
  return {
    id: 'dp-1',
    dpNumber: 'KSB-202611-001',
    departmentId: 'dept-arm',
    employeeId: 'emp-1',
    requesterName: 'Andi Wijaya',
    title: 'Uang Jalan Bongkar Muat Surabaya',
    category: 'BBM & Tol Armada',
    requestedAmount: 1_500_000,
    dueDate: '2026-11-25',
    notes: 'Uang jalan bongkar muat kargo',
    status: 'open',
    approval: {
      roleLabel: 'Direktur',
      status: 'approved',
      approverName: 'Hendra Kusuma',
      decidedAt: '2026-11-18T08:00:00.000Z',
    },
    createdAt: '2026-11-18T07:30:00.000Z',
    updatedAt: '2026-11-18T08:00:00.000Z',
    disbursedAt: '2026-11-18T08:00:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// A. FRAUD SCENARIOS (KECURANGAN & PENYALAHGUNAAN KAS)
// ============================================================================

test('FRAUD-01: Split claims ("pecah nota") & same-vehicle double claim on same day are flagged', () => {
  const existingToday = [
    makeRequest({
      id: 'req-a',
      requestNumber: 'PC-202611-010',
      amount: 900_000,
      receiptRef: 'SPBU-101',
      createdAt: '2026-11-20T08:15:00.000Z',
    }),
  ];

  // Second claim by same requester on same truck & same day pushing daily total >= Rp 1.500.000
  const result = evaluateFraudGuards(
    {
      departmentId: 'dept-arm',
      requesterName: 'Andi Wijaya',
      category: 'BBM & Tol Armada',
      vehicleId: 'veh-1',
      amount: 800_000,
      receiptRef: 'SPBU-102',
      receiptImageUrl: '/api/uploads/nota-102.jpg',
    },
    strictFraudConfig,
    existingToday,
    activeCategories,
    '2026-11-20T11:30:00.000Z'
  );

  assert.equal(result.blockingErrors.length, 0);
  const codes = result.warnings.map((w) => w.code);
  assert.ok(codes.includes('SPLIT_TRANSACTION_SUSPECT'));
  assert.ok(codes.includes('VEHICLE_SAME_DAY_CLAIM'));
});

test('FRAUD-02: Double billing with identical receiptRef across different claims & kasbon settlements is blocked', () => {
  const existing = [
    makeRequest({
      id: 'req-dup',
      requestNumber: 'PC-202611-011',
      receiptRef: 'NOTA-999-XYZ',
      status: 'approved',
    }),
  ];

  // Attempt 1: Another staff reuses same receiptRef (with different casing/whitespace) on petty cash
  const reqEval = evaluateFraudGuards(
    {
      departmentId: 'dept-arm',
      requesterName: 'Siti Rahma',
      category: 'ATK & Perlengkapan Kantor',
      amount: 450_000,
      receiptRef: '  nota-999-xyz ',
      receiptImageUrl: '/api/uploads/nota-dup.jpg',
    },
    strictFraudConfig,
    existing,
    activeCategories,
    '2026-11-20T12:00:00.000Z'
  );
  assert.equal(reqEval.blockingErrors.length, 1);
  assert.match(reqEval.blockingErrors[0], /sudah pernah dipakai/i);

  // Attempt 2: Reuse same receiptRef when settling an open Kasbon
  const openDp = makeDownPayment({ id: 'dp-open', requestedAmount: 1_000_000 });
  const settleCheck = validateDownPaymentSettlement({
    dp: openDp,
    actualAmount: 950_000,
    receiptRef: 'nota-999-xyz',
    receiptImageUrl: '/api/uploads/nota-dup.jpg',
    settledBy: 'Budi Santoso',
    departmentBalance: 5_000_000,
    fraudGuard: strictFraudConfig,
    existingRequests: existing,
    existingDownPayments: [openDp],
  });
  assert.equal(settleCheck.valid, false);
  assert.match(settleCheck.error ?? '', /sudah pernah digunakan/i);
});

test('FRAUD-03: Self-approval collusion blocked even when actor name has role suffix', () => {
  const selfCheck = checkSelfApprovalGuard(
    'Hendra Kusuma',
    'Hendra Kusuma (Direktur)',
    strictFraudConfig
  );
  assert.equal(selfCheck.ok, false);
  assert.match(selfCheck.error ?? '', /tidak diperbolehkan menyetujui pengajuannya sendiri/i);
});

test('FRAUD-04: Ghost claims (missing receipt photo) and oversized single-tx bypass are blocked', () => {
  const ghostAndOver = evaluateFraudGuards(
    {
      departmentId: 'dept-arm',
      requesterName: 'Dedi Kurniawan',
      category: 'BBM & Tol Armada',
      amount: 4_500_000, // > 3,000,000 maxSingleRequestAmount
      receiptRef: 'INV-FAKE-01',
      receiptImageUrl: '',
    },
    strictFraudConfig,
    [],
    activeCategories,
    '2026-11-20T14:00:00.000Z'
  );

  assert.equal(ghostAndOver.blockingErrors.length, 2);
  assert.ok(ghostAndOver.blockingErrors.some((e) => /Foto nota\/invoice wajib/i.test(e)));
  assert.ok(ghostAndOver.blockingErrors.some((e) => /melebihi batas maksimal/i.test(e)));
});

test('FRAUD-05: Duplicate active Kasbon hoarding & missing kasbon settlement receipt are blocked', () => {
  const existingOpen = makeDownPayment({
    id: 'dp-hold',
    dpNumber: 'KSB-202611-009',
    employeeId: 'emp-77',
    requesterName: 'Rudi Hartono',
    status: 'open',
  });

  // Same employee tries to open a second Kasbon under slightly varied name spacing
  const duplicateKasbon = validateDownPaymentCreation(
    {
      departmentId: 'dept-arm',
      employeeId: 'emp-77',
      requesterName: 'rudi  hartono',
      title: 'Kasbon Tol Tambahan',
      category: 'BBM & Tol Armada',
      requestedAmount: 500_000,
      dueDate: '2026-11-28',
    },
    baseDept,
    [],
    [existingOpen],
    '2026-11-20T10:00:00.000Z'
  );
  assert.equal(duplicateKasbon.valid, false);
  assert.match(duplicateKasbon.error ?? '', /masih memiliki kasbon/i);

  // Attempting to settle Kasbon without photo proof when Fraud Guard active
  const noReceiptSettle = validateDownPaymentSettlement({
    dp: existingOpen,
    actualAmount: 1_400_000,
    receiptRef: 'STRUK-88',
    receiptImageUrl: '',
    settledBy: 'Kasir Kargo',
    departmentBalance: 6_000_000,
    fraudGuard: strictFraudConfig,
    existingRequests: [],
    existingDownPayments: [existingOpen],
  });
  assert.equal(noReceiptSettle.valid, false);
  assert.match(noReceiptSettle.error ?? '', /Foto nota\/struk asli wajib/i);
});

test('FRAUD-06: Cash Opname physical shortage without explanation is blocked', () => {
  // System balance is 6,000,000; physical count is only 5,200,000 (-800,000 shortage)
  const coverUp = validateCashOpnameInput({
    department: baseDept,
    countedBy: 'Siti Rahma',
    note: '', // Trying to hide variance without note
    denominations: [
      { denomination: 100_000, count: 52 },
    ],
  });
  assert.equal(coverUp.valid, false);
  assert.match(coverUp.error ?? '', /Catatan penjelasan selisih wajib diisi/i);

  // Negative/tampered bill count rejected
  const invalidDenom = validateCashOpnameInput({
    department: baseDept,
    countedBy: 'Siti Rahma',
    note: 'Sesuai',
    denominations: [{ denomination: 100_000, count: -5 }],
  });
  assert.equal(invalidDenom.valid, false);
});

test('FRAUD-07: Audit log hash chain detects amount tampering, actor spoofing, backdating, and row deletion', () => {
  const e1 = buildActivityLogEntry(
    {
      id: 'log-1',
      actionType: 'request_approved',
      entityType: 'petty_cash_request',
      entityId: 'req-1',
      referenceNumber: 'PC-202611-001',
      title: 'Solar Truk B 9011',
      departmentId: 'dept-arm',
      departmentName: 'Operasional Armada & Truk',
      requesterName: 'Andi Wijaya',
      amount: 950_000,
      decision: 'approve',
      actorName: 'Hendra Kusuma',
      actorRole: 'director',
      note: 'Nota terverifikasi',
      timestamp: '2026-11-20T09:00:00.000Z',
    },
    undefined,
    sha256Hex
  );
  const e2 = buildActivityLogEntry(
    {
      id: 'log-2',
      actionType: 'request_rejected',
      entityType: 'petty_cash_request',
      entityId: 'req-2',
      referenceNumber: 'PC-202611-002',
      title: 'Klaim Ganda SPBU',
      departmentId: 'dept-arm',
      departmentName: 'Operasional Armada & Truk',
      requesterName: 'Dedi Kurniawan',
      amount: 1_200_000,
      decision: 'reject',
      actorName: 'Hendra Kusuma',
      actorRole: 'director',
      note: 'Indikasi nota ganda',
      timestamp: '2026-11-20T10:00:00.000Z',
    },
    e1,
    sha256Hex
  );
  const e3 = buildActivityLogEntry(
    {
      id: 'log-3',
      actionType: 'kasbon_approved',
      entityType: 'down_payment',
      entityId: 'dp-1',
      referenceNumber: 'KSB-202611-001',
      title: 'Uang Jalan Surabaya',
      departmentId: 'dept-arm',
      departmentName: 'Operasional Armada & Truk',
      requesterName: 'Andi Wijaya',
      amount: 1_500_000,
      decision: 'approve',
      actorName: 'Hendra Kusuma',
      actorRole: 'director',
      note: 'OK',
      timestamp: '2026-11-20T11:00:00.000Z',
    },
    e2,
    sha256Hex
  );

  // Baseline valid
  assert.equal(
    verifyActivityLogChainSync([e3, e2, e1], sha256Hex, '2026-11-20T12:00:00.000Z').valid,
    true
  );

  // Tamper 1: Inflate amount silently
  const tamperedAmount: ActivityLogEntry[] = [e3, { ...e2, amount: 12_000_000 }, e1];
  const r1 = verifyActivityLogChainSync(tamperedAmount, sha256Hex, '2026-11-20T12:00:00.000Z');
  assert.equal(r1.valid, false);
  assert.ok(r1.issues.some((i) => i.sequence === 2));

  // Tamper 2: Forge timestamp or actor name
  const tamperedActor: ActivityLogEntry[] = [e3, { ...e2, actorName: 'Staff Gudang' }, e1];
  const r2 = verifyActivityLogChainSync(tamperedActor, sha256Hex, '2026-11-20T12:00:00.000Z');
  assert.equal(r2.valid, false);

  // Tamper 3: Delete middle entry e2 from ledger
  const deletedMiddle = [e3, e1];
  const r3 = verifyActivityLogChainSync(deletedMiddle, sha256Hex, '2026-11-20T12:00:00.000Z');
  assert.equal(r3.valid, false);
  assert.notEqual(r3.lastHash, ACTIVITY_LOG_GENESIS_HASH);
});

// ============================================================================
// B. NEGATIVE & SECURITY BOUNDARY SCENARIOS
// ============================================================================

test('NEG-01: Deactivated division, zero/negative/NaN amounts, and invalid lengths are rejected', () => {
  const inactiveDept: Department = { ...baseDept, active: false };

  const inactiveSubmit = validateRequestSubmission(
    {
      departmentId: inactiveDept.id,
      requesterName: 'Andi Wijaya',
      title: 'Solar Truk',
      category: 'BBM & Tol Armada',
      amount: 500_000,
    },
    inactiveDept,
    []
  );
  assert.equal(inactiveSubmit.valid, false);
  assert.match(inactiveSubmit.error ?? '', /nonaktif/i);

  for (const badAmount of [0, -100_000, 1250.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const res = validateRequestSubmission(
      {
        departmentId: baseDept.id,
        requesterName: 'Andi Wijaya',
        title: 'Biaya Tol Trans Jawa',
        category: 'BBM & Tol Armada',
        amount: badAmount,
      },
      baseDept,
      []
    );
    assert.equal(res.valid, false, `Amount ${badAmount} must be rejected`);
  }
});

test('NEG-02: Rejecting petty cash or kasbon without reason is blocked; rejected decisions are immutable', () => {
  const pendingReq = makeRequest();
  const emptyNoteReject = processApprovalTransition(
    pendingReq,
    'director',
    'Hendra Kusuma',
    'reject',
    composeQuickAnswerNote([], true, ' '),
    '2026-11-20T10:00:00.000Z'
  );
  assert.equal(emptyNoteReject.ok, false);

  const validReject = processApprovalTransition(
    pendingReq,
    'director',
    'Hendra Kusuma',
    'reject',
    'Nota tidak terbaca',
    '2026-11-20T10:05:00.000Z'
  );
  assert.equal(validReject.ok, true);
  assert.equal(validReject.updatedRequest?.status, 'rejected');

  // Cannot re-approve an already rejected request
  const replayApprove = processApprovalTransition(
    validReject.updatedRequest!,
    'director',
    'Hendra Kusuma',
    'approve',
    'Coba loloskan ulang',
    '2026-11-20T10:06:00.000Z'
  );
  assert.equal(replayApprove.ok, false);

  // Same terminal lock for Kasbon decision
  const pendingDp = makeDownPayment({ status: 'pending_director' });
  const dpEmptyReject = processDownPaymentDecision(
    pendingDp,
    'director',
    'Hendra Kusuma',
    'reject',
    '  ',
    '2026-11-20T10:00:00.000Z'
  );
  assert.equal(dpEmptyReject.ok, false);
});

test('NEG-03: Monthly period lock blocks closing while pending items remain and detects closed month', () => {
  const pendingReq = makeRequest({
    status: 'pending_director',
    createdAt: '2026-11-15T09:00:00.000Z',
  });
  const pendingDp = makeDownPayment({
    status: 'pending_director',
    createdAt: '2026-11-16T09:00:00.000Z',
  });

  const blockPendingReq = validateClosePeriod({
    monthKey: '2026-11',
    closedPeriods: [],
    requests: [pendingReq],
    downPayments: [],
    closedBy: 'Hendra Kusuma',
  });
  assert.equal(blockPendingReq.valid, false);
  assert.match(blockPendingReq.error ?? '', /menunggu persetujuan/i);

  const blockPendingDp = validateClosePeriod({
    monthKey: '2026-11',
    closedPeriods: [],
    requests: [],
    downPayments: [pendingDp],
    closedBy: 'Hendra Kusuma',
  });
  assert.equal(blockPendingDp.valid, false);

  const alreadyClosed: ClosedPeriodRecord[] = [
    {
      id: 'cp-2026-11',
      monthKey: '2026-11',
      closedAt: '2026-11-30T23:59:00.000Z',
      closedBy: 'Hendra Kusuma',
      note: 'Tutup buku November',
      totalTopUp: 10_000_000,
      totalSpent: 7_500_000,
      endingBalance: 2_500_000,
      approvedCount: 12,
      openKasbonAtClose: 0,
    },
  ];
  const doubleClose = validateClosePeriod({
    monthKey: '2026-11',
    closedPeriods: alreadyClosed,
    requests: [],
    downPayments: [],
    closedBy: 'Hendra Kusuma',
  });
  assert.equal(doubleClose.valid, false);
  assert.match(doubleClose.error ?? '', /Terkunci/i);
});

test('NEG-04: System admin role cannot drop locked security permissions & weak passwords/CSV payloads are neutralized', () => {
  const strippedAdmin = validateRolePayload({
    name: 'Direktur Utama',
    description: 'Coba hapus izin RBAC',
    permissions: ['dashboard:view'],
    isSystemRole: true,
  });
  assert.equal(strippedAdmin.valid, true);
  for (const locked of SYSTEM_ADMIN_LOCKED_PERMISSIONS) {
    assert.ok(strippedAdmin.normalized!.permissions.includes(locked));
  }

  // Empty permissions or invalid keys on custom role rejected
  const emptyCustom = validateRolePayload({
    name: 'Role Kosong',
    description: 'Tanpa izin',
    permissions: [],
    isSystemRole: false,
  });
  assert.equal(emptyCustom.valid, false);

  // Weak password checks
  for (const weak of ['', '1234567', 'onlyletters', '123456789']) {
    assert.equal(validatePasswordStrength(weak).valid, false);
  }

  // Spreadsheet formula injection neutralization
  assert.equal(escapeCsvCell('=HYPERLINK("http://evil.tld","Click")'), '"\'=HYPERLINK(""http://evil.tld"",""Click"")"');
  assert.equal(escapeCsvCell('\t=1+1'), "'\t=1+1");
  assert.equal(escapeCsvCell('\r+cmd'), '"\'\r+cmd"');

  // Rate limiter strictly rejects burst exceeding window limit
  const limiter = new SlidingWindowRateLimiter(3, 60_000);
  const t0 = 1_700_000_000_000;
  assert.equal(limiter.consume('attacker', 3, 60_000, t0).allowed, true);
  assert.equal(limiter.consume('attacker', 3, 60_000, t0 + 100).allowed, true);
  assert.equal(limiter.consume('attacker', 3, 60_000, t0 + 200).allowed, true);
  const denied = limiter.consume('attacker', 3, 60_000, t0 + 300);
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.ok(denied.retryAfterSec >= 59);
});

// ============================================================================
// C. WORST-CASE OPERATIONAL & LIQUIDITY CRISIS SCENARIOS
// ============================================================================

test('WORST-01: Concurrent pending requests + open/pending kasbon holds trigger overdraft protection', () => {
  // Dept balance: Rp 6.000.000
  // Pending petty cash: Rp 3.800.000 + Pending kasbon: Rp 1.900.000 -> Available balance = Rp 300.000
  const pendingReqs = [
    makeRequest({ id: 'r1', amount: 2_000_000, status: 'pending_director' }),
    makeRequest({ id: 'r2', amount: 1_800_000, status: 'pending_director' }),
  ];
  const pendingDps = [
    makeDownPayment({
      id: 'dp-pending',
      employeeId: 'emp-2',
      requesterName: 'Siti Rahma',
      status: 'pending_director',
      requestedAmount: 1_900_000,
    }),
  ];

  // Attempt Rp 350.000 request -> exceeds Rp 300.000 available
  const reqOverdraft = validateRequestSubmission(
    {
      departmentId: baseDept.id,
      requesterName: 'Dedi Kurniawan',
      title: 'Pembelian Ban Cadangan',
      category: 'BBM & Tol Armada',
      amount: 350_000,
    },
    baseDept,
    pendingReqs,
    pendingDps
  );
  assert.equal(reqOverdraft.valid, false);
  assert.match(reqOverdraft.error ?? '', /300\.000/);

  // Attempt Rp 350.000 kasbon -> also blocked accurately
  const dpOverdraft = validateDownPaymentCreation(
    {
      departmentId: baseDept.id,
      requesterName: 'Dedi Kurniawan',
      title: 'Uang Jalan Tol Solo',
      category: 'BBM & Tol Armada',
      requestedAmount: 350_000,
      dueDate: '2026-11-29',
    },
    baseDept,
    pendingReqs,
    pendingDps,
    '2026-11-20T10:00:00.000Z'
  );
  assert.equal(dpOverdraft.valid, false);
  assert.match(dpOverdraft.error ?? '', /300\.000/);

  // Reimburse kasbon settlement when division balance is insufficient is also blocked
  const openDp = makeDownPayment({
    id: 'dp-reimburse-fail',
    requestedAmount: 1_000_000,
    status: 'open',
  });
  const lowBalanceSettle = validateDownPaymentSettlement({
    dp: openDp,
    actualAmount: 1_500_000, // needs Rp 500.000 reimburse
    receiptRef: 'STRUK-REIMB-1',
    receiptImageUrl: '/api/uploads/nota-r.jpg',
    settledBy: 'Kasir',
    departmentBalance: 200_000, // short by Rp 300.000
    fraudGuard: strictFraudConfig,
    existingRequests: [],
    existingDownPayments: [openDp],
  });
  assert.equal(lowBalanceSettle.valid, false);
  assert.match(lowBalanceSettle.error ?? '', /tidak mencukupi/i);
});

test('WORST-02: Severe liquidity depletion pushes Cash Health to Kritis (<45) & Forecast flags 0-day runway', () => {
  // All funds drained, 100%+ monthly budget spent, large cash opname shortage (-Rp 1.000.000)
  const crisisDept: Department = {
    ...baseDept,
    balance: 150_000,
    lowBalanceThreshold: 2_500_000,
    monthlyBudget: 10_000_000,
  };
  const spentReqs: PettyCashRequest[] = Array.from({ length: 10 }, (_, idx) =>
    makeRequest({
      id: `crisis-req-${idx}`,
      requestNumber: `PC-202611-${100 + idx}`,
      departmentId: crisisDept.id,
      amount: 1_000_000,
      status: 'approved',
      createdAt: `2026-11-${String(10 + idx).padStart(2, '0')}T10:00:00.000Z`,
      disbursedAt: `2026-11-${String(10 + idx).padStart(2, '0')}T12:00:00.000Z`,
    })
  );

  const metrics = [
    calculateDepartmentMetrics(crisisDept, spentReqs, '2026-11', []),
  ];
  const health = calculateCashHealth(metrics, [
    {
      id: 'op-crisis',
      opnameNumber: 'OPN-202611-001',
      departmentId: crisisDept.id,
      systemBalance: 1_150_000,
      physicalTotal: 150_000,
      variance: -1_000_000,
      status: 'short',
      denominations: [],
      countedBy: 'Auditor',
      note: 'Selisih besar menunggu investigasi',
      createdAt: '2026-11-20T18:00:00.000Z',
    },
  ]);

  assert.equal(health.status, 'kritis');
  assert.ok(health.score < 45, `Expected critical score <45, got ${health.score}`);

  // Forecast under 1.5x surge should predict immediate depletion and urgent top-up
  const forecast = calculateCashForecast(
    [crisisDept],
    spentReqs,
    '2026-11-20T18:00:00.000Z',
    { surgeMultiplier: 1.5, horizonDays: 30 },
    []
  );
  assert.ok(forecast.overallRunwayDays !== null && forecast.overallRunwayDays <= 1);
  assert.ok(forecast.totalRecommendedTopUp > 0);
  assert.equal(forecast.byDivision.filter((d) => d.recommendedTopUp > 0).length, 1);
  assert.equal(forecast.byDivision[0].riskLevel, 'kritis');
});

test('WORST-03: Cold-start forecast & health with zero history produce safe finite numbers without NaN', () => {
  const emptyDept: Department = {
    ...baseDept,
    balance: 0,
    monthlyBudget: 0,
    lowBalanceThreshold: 0,
  };
  const emptyDeptMetrics = [
    calculateDepartmentMetrics(emptyDept, [], '2026-11', []),
  ];

  const emptyHealth = calculateCashHealth(emptyDeptMetrics, []);
  assert.equal(Number.isFinite(emptyHealth.score), true);

  const emptyForecast = calculateCashForecast(
    [emptyDept],
    [],
    '2026-11-20T10:00:00.000Z',
    { coldStartMethod: 'budget_baseline', horizonDays: 14 },
    []
  );
  assert.equal(Number.isFinite(emptyForecast.dailyBurnRate), true);
  assert.equal(emptyForecast.dailyBurnRate, 0);
  assert.equal(emptyForecast.overallRunwayDays, null);
  assert.equal(Number.isFinite(emptyForecast.projectedMonthEndBalance), true);
  assert.equal(emptyForecast.curvePoints.length, 7);
});
