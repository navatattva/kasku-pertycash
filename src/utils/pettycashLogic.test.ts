import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDepartmentMetrics,
  canRoleActOnRequest,
  createInitialDirectorApproval,
  generateMonthlyReport,
  generateReportCsv,
  processApprovalTransition,
  validateRequestSubmission,
} from './pettycashLogic';
import type {
  Department,
  PettyCashRequest,
  TopUpRecord,
} from '../types/pettycash';

const sampleDept: Department = {
  id: 'dept-arm',
  code: 'ARM',
  name: 'Operasional Armada & Truk',
  picName: 'Budi Santoso',
  monthlyBudget: 15_000_000,
  balance: 6_000_000,
  lowBalanceThreshold: 2_500_000,
  updatedAt: '2026-11-01T08:00:00.000Z',
};

function makeRequest(overrides: Partial<PettyCashRequest> = {}): PettyCashRequest {
  return {
    id: 'req-1',
    requestNumber: 'PC-202611-001',
    departmentId: 'dept-arm',
    requesterName: 'Siti Rahma',
    title: 'Uang Jalan & Tol Truk Wingbox Rute Surabaya',
    category: 'BBM & Tol Armada',
    amount: 1_200_000,
    notes: 'Pengiriman muatan reguler',
    receiptRef: 'SJ-908',
    status: 'pending_director',
    approval: createInitialDirectorApproval(),
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-10T09:00:00.000Z',
    ...overrides,
  };
}

test('validateRequestSubmission rejects empty fields and overdraft against pending holds', () => {
  const existingPending = makeRequest({
    amount: 4_500_000,
    status: 'pending_director',
  });
  // Balance is 6,000,000; pending hold is 4,500,000 -> available is 1,500,000
  const overdraft = validateRequestSubmission(
    {
      departmentId: 'dept-arm',
      requesterName: 'Andi Wijaya',
      title: 'Tambal Ban & Oli Truk Engkel',
      category: 'Perawatan Ringan Armada',
      amount: 1_600_000,
    },
    sampleDept,
    [existingPending]
  );
  assert.equal(overdraft.valid, false);
  assert.match(overdraft.error ?? '', /melebihi saldo tersedia/i);

  const valid = validateRequestSubmission(
    {
      departmentId: 'dept-arm',
      requesterName: 'Andi Wijaya',
      title: 'Biaya Tol Trans Jawa Truk B 9021',
      category: 'BBM & Tol Armada',
      amount: 850_000,
    },
    sampleDept,
    [existingPending]
  );
  assert.equal(valid.valid, true);
});

test('direct-to-director approval completes in 1 step and blocks staff role', () => {
  const req = makeRequest({ amount: 3_200_000 });

  // Staff cannot approve
  assert.equal(canRoleActOnRequest('staff', req), false);
  const staffAttempt = processApprovalTransition(
    req,
    'staff',
    'Andi',
    'approve',
    '',
    '2026-11-10T10:00:00.000Z'
  );
  assert.equal(staffAttempt.ok, false);

  // Director approves directly -> immediately final_approved
  assert.equal(canRoleActOnRequest('director', req), true);
  const approved = processApprovalTransition(
    req,
    'director',
    'Hendra Kusuma (Direktur)',
    'approve',
    'Sesuai manifest muatan',
    '2026-11-10T10:05:00.000Z'
  );
  assert.equal(approved.ok, true);
  assert.equal(approved.outcome, 'final_approved');
  assert.equal(approved.updatedRequest?.status, 'approved');
  assert.equal(
    approved.updatedRequest?.approval.approverName,
    'Hendra Kusuma (Direktur)'
  );
});

test('rejection by director requires reason and locks terminal state', () => {
  const req = makeRequest();

  const missingReason = processApprovalTransition(
    req,
    'director',
    'Hendra Kusuma',
    'reject',
    '  ',
    '2026-11-10T10:00:00.000Z'
  );
  assert.equal(missingReason.ok, false);

  const rejected = processApprovalTransition(
    req,
    'director',
    'Hendra Kusuma',
    'reject',
    'Surat jalan belum dilampirkan',
    '2026-11-10T10:00:00.000Z'
  );
  assert.equal(rejected.ok, true);
  assert.equal(rejected.outcome, 'rejected');
  assert.equal(rejected.updatedRequest?.status, 'rejected');

  // Terminal state cannot be re-processed
  const retry = processApprovalTransition(
    rejected.updatedRequest!,
    'director',
    'Hendra Kusuma',
    'approve',
    '',
    '2026-11-10T11:00:00.000Z'
  );
  assert.equal(retry.ok, false);
});

test('department metrics and monthly expense report aggregate cargo expenses accurately', () => {
  const approvedTx = makeRequest({
    id: 'req-app',
    amount: 1_500_000,
    status: 'approved',
    disbursedAt: '2026-11-12T10:00:00.000Z',
  });
  const pendingTx = makeRequest({
    id: 'req-pend',
    amount: 4_200_000,
    status: 'pending_director',
  });
  const topUps: TopUpRecord[] = [
    {
      id: 'top-1',
      departmentId: 'dept-arm',
      amount: 5_000_000,
      performedBy: 'Direktur',
      note: 'Isi ulang saldo armada',
      createdAt: '2026-11-01T09:00:00.000Z',
    },
  ];

  const metrics = calculateDepartmentMetrics(
    sampleDept,
    [approvedTx, pendingTx],
    '2026-11'
  );
  assert.equal(metrics.pendingHold, 4_200_000);
  assert.equal(metrics.availableBalance, 1_800_000);
  assert.equal(metrics.monthSpent, 1_500_000);
  assert.equal(metrics.healthStatus, 'menipis');

  const report = generateMonthlyReport(
    '2026-11',
    [sampleDept],
    [approvedTx, pendingTx],
    topUps
  );
  assert.equal(report.totalSpent, 1_500_000);
  assert.equal(report.approvedCount, 1);
  assert.equal(report.pendingCount, 1);
  assert.equal(report.totalTopUp, 5_000_000);
  assert.equal(report.byDepartment[0].remainingBudget, 13_500_000);

  const csv = generateReportCsv(report, [sampleDept]);
  assert.ok(csv.startsWith('\uFEFFNomor Pengajuan'));
  assert.ok(csv.includes('PC-202611-001'));
  assert.ok(csv.includes('No. Polisi Armada'));
});

import {
  formatNumberInput,
  normalizePersonName,
  normalizePlateNumber,
  normalizeRefCode,
  parseFormattedNumber,
} from './formatters';
import {
  validateMasterDepartmentInput,
  validateMasterEmployeeInput,
  validateMasterVehicleInput,
} from './pettycashLogic';

test('standardization helpers format plates, names, ref codes, and currency cleanly', () => {
  assert.equal(normalizePlateNumber('b9241krg'), 'B 9241 KRG');
  assert.equal(normalizePlateNumber('  ab  1234  xy '), 'AB 1234 XY');
  assert.equal(normalizePersonName('  budi   santoso '), 'Budi Santoso');
  assert.equal(normalizeRefCode('sj krg 882'), 'SJ-KRG-882');
  assert.equal(formatNumberInput('1850000'), '1.850.000');
  assert.equal(parseFormattedNumber('1.850.000'), 1_850_000);
});

test('master data validators normalize codes and block inactive divisions on submission', () => {
  const deptRes = validateMasterDepartmentInput({
    code: 'arm ',
    name: '  Operasional  Armada ',
    picName: 'budi santoso',
    monthlyBudget: 15_000_000,
    lowBalanceThreshold: 2_000_000,
  });
  assert.equal(deptRes.valid, true);
  assert.equal(deptRes.normalized?.code, 'ARM');
  assert.equal(deptRes.normalized?.picName, 'Budi Santoso');

  const empRes = validateMasterEmployeeInput({
    code: 'kry-01',
    name: 'andi wijaya',
    roleTitle: 'Driver Wingbox',
    departmentId: 'dept-arm',
  });
  assert.equal(empRes.valid, true);
  assert.equal(empRes.normalized?.code, 'KRY-01');
  assert.equal(empRes.normalized?.name, 'Andi Wijaya');

  const vehRes = validateMasterVehicleInput({
    plateNumber: 'b9012krg',
    unitType: 'CDE Box',
    departmentId: 'dept-arm',
  });
  assert.equal(vehRes.valid, true);
  assert.equal(vehRes.normalized?.plateNumber, 'B 9012 KRG');

  const inactiveAttempt = validateRequestSubmission(
    {
      departmentId: 'dept-arm',
      requesterName: 'Andi Wijaya',
      title: 'Test Pengajuan Divisi Nonaktif',
      category: 'BBM & Tol Armada',
      amount: 100_000,
    },
    { ...sampleDept, active: false },
    []
  );
  assert.equal(inactiveAttempt.valid, false);
  assert.match(inactiveAttempt.error ?? '', /nonaktif/i);
});

import { calculateIndonesianTax } from './pettycashLogic';

test('Indonesian tax calculation handles PPN 11%, PPh 23 2%, and PPh 21 accurately', () => {
  const none = calculateIndonesianTax(1_000_000, 'none');
  assert.equal(none.netDisbursed, 1_000_000);
  assert.equal(none.ppnAmount, 0);
  assert.equal(none.pphAmount, 0);

  const ppnEx = calculateIndonesianTax(1_000_000, 'ppn_exclusive');
  assert.equal(ppnEx.dppAmount, 1_000_000);
  assert.equal(ppnEx.ppnAmount, 110_000);
  assert.equal(ppnEx.netDisbursed, 1_110_000);

  const ppnIn = calculateIndonesianTax(1_110_000, 'ppn_inclusive');
  assert.equal(ppnIn.dppAmount, 1_000_000);
  assert.equal(ppnIn.ppnAmount, 110_000);
  assert.equal(ppnIn.netDisbursed, 1_110_000);

  const pph23 = calculateIndonesianTax(1_000_000, 'pph23_2');
  assert.equal(pph23.pphAmount, 20_000);
  assert.equal(pph23.netDisbursed, 980_000);

  const pph21Ter = calculateIndonesianTax(1_000_000, 'pph21_ter_05');
  assert.equal(pph21Ter.pphAmount, 5_000);
  assert.equal(pph21Ter.netDisbursed, 995_000);

  const pph21NonEmp = calculateIndonesianTax(1_000_000, 'pph21_non_emp_25');
  assert.equal(pph21NonEmp.dppAmount, 500_000);
  assert.equal(pph21NonEmp.pphAmount, 25_000);
  assert.equal(pph21NonEmp.netDisbursed, 975_000);

  const reportWithTax = generateMonthlyReport(
    '2026-11',
    [sampleDept],
    [
      makeRequest({
        id: 'req-tx1',
        amount: ppnEx.netDisbursed,
        tax: ppnEx,
        status: 'approved',
        disbursedAt: '2026-11-15T10:00:00.000Z',
      }),
      makeRequest({
        id: 'req-tx2',
        amount: pph23.netDisbursed,
        tax: pph23,
        status: 'approved',
        disbursedAt: '2026-11-16T10:00:00.000Z',
      }),
    ],
    []
  );
  assert.equal(reportWithTax.totalPpnInput, 110_000);
  assert.equal(reportWithTax.totalPphWithheld, 20_000);

  const csvWithTax = generateReportCsv(reportWithTax, [sampleDept], true);
  assert.ok(csvWithTax.includes('PPN Masukan (IDR)'));
  assert.ok(csvWithTax.includes('Potongan PPh (IDR)'));
});

import {
  buildCashLedger,
  calculateOpnameSummary,
  generateCashLedgerCsv,
  generateVehicleComparisonCsv,
  getPreviousMonthKey,
  validateCashOpnameInput,
} from './pettycashLogic';
import type { MasterVehicle } from '../types/pettycash';

test('buildCashLedger reconciles running balance accurately with current book balance', () => {
  const dept: Department = { ...sampleDept, balance: 8_000_000 };
  const topUps: TopUpRecord[] = [
    {
      id: 't1',
      departmentId: 'dept-arm',
      amount: 5_000_000,
      performedBy: 'Direktur',
      note: 'Top up Nov',
      createdAt: '2026-11-01T08:00:00.000Z',
    },
  ];
  const reqs: PettyCashRequest[] = [
    makeRequest({
      id: 'r1',
      requestNumber: 'PC-202611-010',
      amount: 1_200_000,
      status: 'approved',
      disbursedAt: '2026-11-05T10:00:00.000Z',
    }),
  ];

  // Net recorded = +5.000.000 - 1.200.000 = +3.800.000; Current balance = 8.000.000 -> opening = 4.200.000
  const ledger = buildCashLedger([dept], reqs, topUps, 'dept-arm', '2026-11');
  assert.equal(ledger.openingBalance, 4_200_000);
  assert.equal(ledger.totalInflow, 5_000_000);
  assert.equal(ledger.totalOutflow, 1_200_000);
  assert.equal(ledger.closingBalance, 8_000_000);
  assert.equal(ledger.entries[0].runningBalance, 8_000_000); // newest entry
  assert.equal(ledger.entries[1].runningBalance, 9_200_000); // top-up entry

  const csv = generateCashLedgerCsv(ledger, 'ARM');
  assert.ok(csv.includes('SALDO AWAL'));
  assert.ok(csv.includes('PC-202611-010'));
});

test('Cash Opname calculates denominations accurately and enforces note on variance', () => {
  const dept: Department = { ...sampleDept, balance: 1_500_000 };
  const matched = calculateOpnameSummary(dept.balance, {
    100_000: 15,
  });
  assert.equal(matched.physicalTotal, 1_500_000);
  assert.equal(matched.variance, 0);
  assert.equal(matched.status, 'matched');

  const shortValidation = validateCashOpnameInput({
    department: dept,
    countedBy: 'budi santoso',
    note: '',
    denominations: [{ denomination: 100_000, count: 14 }],
  });
  assert.equal(shortValidation.valid, false);
  assert.match(shortValidation.error ?? '', /penjelasan selisih wajib/i);

  const validShort = validateCashOpnameInput({
    department: dept,
    countedBy: 'budi santoso',
    note: 'Selisih Rp 100rb karena nota tol belum diinput',
    denominations: [{ denomination: 100_000, count: 14 }],
  });
  assert.equal(validShort.valid, true);
  assert.equal(validShort.summary?.variance, -100_000);
  assert.equal(validShort.summary?.status, 'short');
});

test('Monthly report computes MoM comparison and per-vehicle cost breakdown', () => {
  assert.equal(getPreviousMonthKey('2026-01'), '2025-12');
  assert.equal(getPreviousMonthKey('2026-11'), '2026-10');

  const vehicles: MasterVehicle[] = [
    {
      id: 'veh-01',
      plateNumber: 'B 9241 KRG',
      unitType: 'Wingbox Tronton',
      departmentId: 'dept-arm',
      active: true,
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ];
  const requests: PettyCashRequest[] = [
    makeRequest({
      id: 'oct-1',
      vehicleId: 'veh-01',
      vehiclePlate: 'B 9241 KRG',
      category: 'BBM & Tol Armada',
      amount: 1_000_000,
      status: 'approved',
      disbursedAt: '2026-10-15T10:00:00.000Z',
    }),
    makeRequest({
      id: 'nov-1',
      vehicleId: 'veh-01',
      vehiclePlate: 'B 9241 KRG',
      category: 'BBM & Tol Armada',
      amount: 1_200_000,
      status: 'approved',
      disbursedAt: '2026-11-15T10:00:00.000Z',
    }),
    makeRequest({
      id: 'nov-2',
      vehicleId: 'veh-01',
      vehiclePlate: 'B 9241 KRG',
      category: 'Perawatan Ringan Armada',
      amount: 300_000,
      status: 'approved',
      disbursedAt: '2026-11-18T10:00:00.000Z',
    }),
  ];

  const report = generateMonthlyReport(
    '2026-11',
    [sampleDept],
    requests,
    [],
    undefined,
    vehicles
  );
  assert.equal(report.previousMonthKey, '2026-10');
  assert.equal(report.totalSpent, 1_500_000);
  assert.equal(report.previousTotalSpent, 1_000_000);
  assert.equal(report.momDeltaAmount, 500_000);
  assert.equal(report.momDeltaPct, 50);

  const truck = report.byVehicle.find((v) => v.vehicleKey === 'veh-01');
  assert.ok(truck);
  assert.equal(truck.fuelTollSpent, 1_200_000);
  assert.equal(truck.maintenanceSpent, 300_000);
  assert.equal(truck.prevTotalSpent, 1_000_000);
  assert.equal(truck.deltaPct, 50);

  const vehCsv = generateVehicleComparisonCsv(report);
  assert.ok(vehCsv.includes('B 9241 KRG'));
  assert.ok(vehCsv.includes('50%'));
});

import {
  calculateCashForecast,
  calculateCashHealth,
} from './pettycashLogic';

test('calculateCashHealth computes bounded 0-100 score and classifies healthy vs critical states', () => {
  const healthyMetrics = [
    calculateDepartmentMetrics(
      { ...sampleDept, balance: 12_000_000, lowBalanceThreshold: 2_500_000 },
      [],
      '2026-11'
    ),
  ];
  const healthOk = calculateCashHealth(healthyMetrics, []);
  assert.ok(healthOk.score >= 85 && healthOk.score <= 100);
  assert.equal(healthOk.status, 'sehat');

  const lowMetrics = [
    calculateDepartmentMetrics(
      {
        ...sampleDept,
        balance: 500_000,
        monthlyBudget: 10_000_000,
        lowBalanceThreshold: 3_000_000,
      },
      [
        makeRequest({
          status: 'approved',
          amount: 9_000_000,
          disbursedAt: '2026-11-15T10:00:00.000Z',
        }),
      ],
      '2026-11'
    ),
  ];
  const healthLow = calculateCashHealth(lowMetrics, []);
  assert.ok(healthLow.score < 45);
  assert.equal(healthLow.status, 'kritis');
});

test('calculateCashForecast projects burn rate, runway days, month-end balance, and top-up recommendations', () => {
  const dept: Department = {
    ...sampleDept,
    balance: 4_000_000,
    lowBalanceThreshold: 2_000_000,
  };
  const reqs: PettyCashRequest[] = [
    makeRequest({
      id: 'f-1',
      status: 'approved',
      amount: 2_000_000,
      disbursedAt: '2026-11-10T10:00:00.000Z',
    }),
    makeRequest({
      id: 'f-2',
      status: 'pending_director',
      amount: 1_000_000,
    }),
  ];

  // Pure actuals mode ('zero_conservative'): Reference Nov 20 (20 elapsed, 10 remaining in Nov). Available = 4M - 1M = 3M.
  // Normal burn = 2M / 20 = 100k/day -> runway 30 days; month-end projected balance = 3M - 1M = 2M (at threshold)
  const normal = calculateCashForecast([dept], reqs, '2026-11-20T08:00:00.000Z', {
    coldStartMethod: 'zero_conservative',
  });
  assert.equal(normal.daysElapsedInMonth, 20);
  assert.equal(normal.daysRemainingInMonth, 10);
  assert.equal(normal.dailyBurnRate, 100_000);
  assert.equal(normal.overallRunwayDays, 30);
  assert.equal(normal.projectedMonthEndBalance, 2_000_000);
  assert.equal(normal.totalRecommendedTopUp, 0);

  // Surge +25% & includePending -> burn = ((2M + 1M) / 20) * 1.25 = 187,500/day -> month-end = 3M - 1.875M = 1.125M < 2M threshold -> recommends 900k top-up
  const stressed = calculateCashForecast([dept], reqs, '2026-11-20T08:00:00.000Z', {
    coldStartMethod: 'zero_conservative',
    surgeMultiplier: 1.25,
    includePending: true,
  });
  assert.equal(stressed.dailyBurnRate, 187_500);
  assert.equal(stressed.projectedMonthEndBalance, 1_125_000);
  assert.equal(stressed.totalRecommendedTopUp, 900_000);
  assert.equal(stressed.curvePoints.length, 7);
});

test('calculateCashForecast handles cold-start (empty data), partial history blending, and custom horizons', () => {
  const coldDept: Department = {
    ...sampleDept,
    id: 'dept-new',
    code: 'NEW',
    name: 'Divisi Baru',
    monthlyBudget: 9_000_000,
    balance: 2_200_000,
    lowBalanceThreshold: 1_500_000,
  };
  const partialDept: Department = {
    ...sampleDept,
    id: 'dept-part',
    code: 'PRT',
    name: 'Divisi Parsial',
    monthlyBudget: 12_000_000,
    balance: 8_000_000,
    lowBalanceThreshold: 2_000_000,
  };

  // Cold dept: 0 transactions in Nov or Oct -> uses 70% of 9M / 30 days = 210,000/day
  // Partial dept: 0 Nov tx on Nov 2, 1 Oct tx of 3.1M (31 days in Oct = 100,000/day) -> hybrid_prev_month
  const reqs: PettyCashRequest[] = [
    makeRequest({
      id: 'oct-prt',
      departmentId: 'dept-part',
      amount: 3_100_000,
      status: 'approved',
      disbursedAt: '2026-10-15T10:00:00.000Z',
    }),
  ];

  const forecast = calculateCashForecast(
    [coldDept, partialDept],
    reqs,
    '2026-11-02T08:00:00.000Z',
    {
      coldStartMethod: 'budget_baseline',
      budgetUtilizationAssumptionPct: 70,
      horizonDays: 60,
    }
  );

  assert.equal(forecast.horizonDays, 60);
  assert.equal(forecast.curvePoints[6].dayOffset, 60);
  assert.equal(forecast.overallConfidence, 'partial');
  assert.equal(forecast.coldDivisionsCount, 1);
  assert.equal(forecast.partialDivisionsCount, 1);

  const coldRow = forecast.byDivision.find((d) => d.departmentId === 'dept-new');
  assert.ok(coldRow);
  assert.equal(coldRow.dataConfidence, 'cold');
  assert.equal(coldRow.burnRateSource, 'cold_budget');
  assert.equal(coldRow.dailyBurnRate, 210_000);
  assert.equal(coldRow.runwayDays, 10);

  const partRow = forecast.byDivision.find((d) => d.departmentId === 'dept-part');
  assert.ok(partRow);
  assert.equal(partRow.dataConfidence, 'partial');
  assert.equal(partRow.burnRateSource, 'hybrid_prev_month');
  assert.equal(partRow.dailyBurnRate, 100_000);
});

import {
  checkSelfApprovalGuard,
  evaluateFraudGuards,
} from './pettycashLogic';
import type { FraudGuardConfig, MasterCategory } from '../types/pettycash';

test('evaluateFraudGuards blocks missing receipts, duplicate refs, over-limit claims, and flags split claims / self-approval', () => {
  const guardCfg: FraudGuardConfig = {
    enabled: true,
    requireReceiptImage: true,
    receiptRequiredMinAmount: 0,
    blockDuplicateReceiptRef: true,
    preventSelfApproval: true,
    detectDuplicateClaimWindowHours: 48,
    highValueAlertAmount: 1_500_000,
    maxSingleRequestAmount: 3_000_000,
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
  const categories: MasterCategory[] = [
    {
      id: 'cat-bbm',
      code: 'KAT-BBM',
      name: 'BBM & Tol Armada',
      requiresVehicle: true,
      active: true,
      updatedAt: '2026-11-01T00:00:00.000Z',
    },
  ];
  const existing = [
    makeRequest({
      id: 'ex-1',
      requestNumber: 'PC-202611-010',
      requesterName: 'Andi Wijaya',
      amount: 900_000,
      receiptRef: 'SJ-DUP-001',
      createdAt: '2026-11-22T08:00:00.000Z',
    }),
  ];

  // 1. Missing photo + duplicate receipt ref + over max limit
  const blocked = evaluateFraudGuards(
    {
      departmentId: 'dept-arm',
      requesterName: 'Andi Wijaya',
      category: 'BBM & Tol Armada',
      amount: 3_500_000,
      receiptRef: 'SJ-DUP-001',
    },
    guardCfg,
    existing,
    categories,
    '2026-11-22T10:00:00.000Z'
  );
  assert.equal(blocked.blockingErrors.length, 3);

  // 2. Same-day split claim ("pecah nota") + same amount window + missing fleet unit warning
  const warned = evaluateFraudGuards(
    {
      departmentId: 'dept-arm',
      requesterName: 'Andi Wijaya',
      category: 'BBM & Tol Armada',
      amount: 900_000,
      receiptRef: 'SJ-NEW-002',
      receiptImageUrl: '/api/uploads/nota-test.png',
    },
    guardCfg,
    existing,
    categories,
    '2026-11-22T12:00:00.000Z'
  );
  assert.equal(warned.blockingErrors.length, 0);
  const codes = warned.warnings.map((w) => w.code);
  assert.ok(codes.includes('SAME_WINDOW_DUPLICATE_CLAIM'));
  assert.ok(codes.includes('SPLIT_TRANSACTION_SUSPECT'));
  assert.ok(codes.includes('MISSING_FLEET_UNIT'));

  // 3. Segregation of duties blocks self-approval
  const selfApp = checkSelfApprovalGuard(
    'Hendra Kusuma',
    'Hendra Kusuma (Direktur)',
    guardCfg
  );
  assert.equal(selfApp.ok, false);
});

import {
  buildLowBalanceWhatsAppMessage,
  buildRequestWhatsAppMessage,
  buildWhatsAppDeepLink,
  isValidIndonesianWhatsAppPhone,
  normalizeWhatsAppPhone,
} from './pettycashLogic';

test('WhatsApp helpers normalize Indonesian numbers and format request/low-balance alerts', () => {
  assert.equal(normalizeWhatsAppPhone('0811-8899-0011'), '6281188990011');
  assert.equal(normalizeWhatsAppPhone('+62 812 3456 7890'), '6281234567890');
  assert.equal(isValidIndonesianWhatsAppPhone('081188990011'), true);
  assert.equal(isValidIndonesianWhatsAppPhone('123'), false);

  const reqMsg = buildRequestWhatsAppMessage({
    eventType: 'new_request',
    request: makeRequest({
      requestNumber: 'PC-202611-050',
      requesterName: 'Andi Wijaya',
      title: 'Solar Truk Pantura',
      amount: 1_250_000,
      receiptRef: 'SJ-99',
    }),
    departmentName: 'Operasional Armada & Truk',
  });
  assert.ok(reqMsg.includes('PC-202611-050'));
  assert.ok(reqMsg.includes('1.250.000'));
  assert.ok(
    buildWhatsAppDeepLink('081188990011', reqMsg).startsWith(
      'https://wa.me/6281188990011?text='
    )
  );

  const lowMsg = buildLowBalanceWhatsAppMessage([
    calculateDepartmentMetrics(
      { ...sampleDept, code: 'GAF', balance: 1_000_000, lowBalanceThreshold: 2_000_000 },
      [],
      '2026-11'
    ),
  ]);
  assert.ok(lowMsg.includes('GAF'));
  assert.ok(lowMsg.includes('Peringatan Saldo Kas Menipis'));
});

import {
  calculateDailyClosingSummary,
  calculateDownPaymentSettlement,
  isPeriodClosed,
  processDownPaymentDecision,
  validateClosePeriod,
  validateDownPaymentCreation,
  validateDownPaymentSettlement,
} from './pettycashLogic';
import type {
  CashOpnameRecord,
  ClosedPeriodRecord,
  DownPaymentRecord,
} from '../types/pettycash';

function makeDownPayment(
  overrides: Partial<DownPaymentRecord> = {}
): DownPaymentRecord {
  return {
    id: 'dp-1',
    dpNumber: 'KSB-202611-001',
    departmentId: 'dept-arm',
    employeeId: 'emp-01',
    requesterName: 'Andi Wijaya',
    title: 'Kasbon Uang Jalan & Tol Wingbox Rute Semarang',
    category: 'BBM & Tol Armada',
    requestedAmount: 2_000_000,
    dueDate: '2026-11-26',
    notes: 'Rute PP Jakarta-Semarang',
    status: 'pending_director',
    approval: createInitialDirectorApproval(),
    createdAt: '2026-11-20T08:00:00.000Z',
    updatedAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
}

test('validateDownPaymentCreation blocks duplicate active kasbon per employee and respects available balance', () => {
  const existingOpenDp = makeDownPayment({
    id: 'dp-open',
    dpNumber: 'KSB-202611-001',
    employeeId: 'emp-01',
    requesterName: 'Andi Wijaya',
    status: 'open',
  });
  const existingPendingDp = makeDownPayment({
    id: 'dp-pend',
    dpNumber: 'KSB-202611-002',
    employeeId: 'emp-02',
    requesterName: 'Bagus Setiawan',
    requestedAmount: 4_500_000,
    status: 'pending_director',
  });

  // Duplicate active kasbon by same employee blocked
  const dupAttempt = validateDownPaymentCreation(
    {
      departmentId: 'dept-arm',
      employeeId: 'emp-01',
      requesterName: 'Andi Wijaya',
      title: 'Kasbon Tambahan Rute Jawa Timur',
      category: 'BBM & Tol Armada',
      requestedAmount: 500_000,
      dueDate: '2026-11-25',
    },
    sampleDept,
    [],
    [existingOpenDp, existingPendingDp],
    '2026-11-22T09:00:00.000Z'
  );
  assert.equal(dupAttempt.valid, false);
  assert.match(dupAttempt.error ?? '', /Kontrol Kasbon/i);

  // New employee allowed only within available balance (6M - 4.5M pending = 1.5M)
  const overAttempt = validateDownPaymentCreation(
    {
      departmentId: 'dept-arm',
      employeeId: 'emp-03',
      requesterName: 'Yusuf Maulana',
      title: 'Kasbon Uang Bongkar Kontainer',
      category: 'Bongkar Muat & Gudang',
      requestedAmount: 1_800_000,
      dueDate: '2026-11-25',
    },
    sampleDept,
    [],
    [existingOpenDp, existingPendingDp],
    '2026-11-22T09:00:00.000Z'
  );
  assert.equal(overAttempt.valid, false);
  assert.match(overAttempt.error ?? '', /melebihi saldo tersedia/i);

  const validAttempt = validateDownPaymentCreation(
    {
      departmentId: 'dept-arm',
      employeeId: 'emp-03',
      requesterName: 'Yusuf Maulana',
      title: 'Kasbon Uang Bongkar Kontainer',
      category: 'Bongkar Muat & Gudang',
      requestedAmount: 1_200_000,
      dueDate: '2026-11-25',
    },
    sampleDept,
    [],
    [existingOpenDp, existingPendingDp],
    '2026-11-22T09:00:00.000Z'
  );
  assert.equal(validAttempt.valid, true);
});

test('Kasbon decision and settlement compute refund/reimburse accurately and enforce fraud guards', () => {
  const dp = makeDownPayment({ requestedAmount: 2_000_000 });
  const dec = processDownPaymentDecision(
    dp,
    'director',
    'Hendra Kusuma (Direktur)',
    'approve',
    'Silakan cairkan uang jalan',
    '2026-11-20T09:00:00.000Z'
  );
  assert.equal(dec.ok, true);
  assert.equal(dec.outcome, 'approved_open');
  assert.equal(dec.updatedDownPayment?.status, 'open');

  const refundCalc = calculateDownPaymentSettlement(2_000_000, 1_650_000);
  assert.equal(refundCalc.differenceType, 'refund');
  assert.equal(refundCalc.differenceAmount, 350_000);

  const reimburseCalc = calculateDownPaymentSettlement(2_000_000, 2_250_000);
  assert.equal(reimburseCalc.differenceType, 'reimburse');
  assert.equal(reimburseCalc.differenceAmount, -250_000);

  const guardCfg: FraudGuardConfig = {
    enabled: true,
    requireReceiptImage: true,
    receiptRequiredMinAmount: 0,
    blockDuplicateReceiptRef: true,
    preventSelfApproval: true,
    detectDuplicateClaimWindowHours: 48,
    highValueAlertAmount: 1_500_000,
    maxSingleRequestAmount: 3_000_000,
    updatedAt: '2026-11-01T00:00:00.000Z',
  };

  // Missing receipt image blocked
  const noPhoto = validateDownPaymentSettlement({
    dp: dec.updatedDownPayment,
    actualAmount: 1_650_000,
    receiptRef: 'STRUK-001',
    settledBy: 'Hendra Kusuma',
    departmentBalance: 4_000_000,
    fraudGuard: guardCfg,
    existingRequests: [],
    existingDownPayments: [],
  });
  assert.equal(noPhoto.valid, false);
  assert.match(noPhoto.error ?? '', /Foto nota/i);

  // Duplicate receipt ref against petty cash requests blocked
  const dupRef = validateDownPaymentSettlement({
    dp: dec.updatedDownPayment,
    actualAmount: 1_650_000,
    receiptRef: 'SJ-908',
    receiptImageUrl: '/api/uploads/nota-abc.png',
    settledBy: 'Hendra Kusuma',
    departmentBalance: 4_000_000,
    fraudGuard: guardCfg,
    existingRequests: [makeRequest({ receiptRef: 'SJ-908', status: 'approved' })],
    existingDownPayments: [],
  });
  assert.equal(dupRef.valid, false);
  assert.match(dupRef.error ?? '', /sudah pernah digunakan/i);

  // Reimburse exceeds department balance blocked
  const overdraftReimburse = validateDownPaymentSettlement({
    dp: dec.updatedDownPayment,
    actualAmount: 2_500_000,
    receiptRef: 'STRUK-002',
    receiptImageUrl: '/api/uploads/nota-abc.png',
    settledBy: 'Hendra Kusuma',
    departmentBalance: 300_000,
    fraudGuard: guardCfg,
    existingRequests: [],
    existingDownPayments: [],
  });
  assert.equal(overdraftReimburse.valid, false);
  assert.match(overdraftReimburse.error ?? '', /Saldo divisi tidak mencukupi/i);

  const validRefund = validateDownPaymentSettlement({
    dp: dec.updatedDownPayment,
    actualAmount: 1_650_000,
    receiptRef: 'STRUK-003',
    receiptImageUrl: '/api/uploads/nota-abc.png',
    settledBy: 'Hendra Kusuma',
    departmentBalance: 4_000_000,
    fraudGuard: guardCfg,
    existingRequests: [],
    existingDownPayments: [],
  });
  assert.equal(validRefund.valid, true);
  assert.equal(validRefund.settlementCalc?.differenceType, 'refund');
  assert.equal(validRefund.settlementCalc?.differenceAmount, 350_000);
});

test('buildCashLedger and generateMonthlyReport reconcile Kasbon outflows and refunds', () => {
  // Start balance 10M, TopUp +5M, Kasbon out -2M, Kasbon refund +350k => current balance 13.35M
  // Net recorded = +5M - 2M + 350k = +3.35M => opening = 10M
  const dept: Department = { ...sampleDept, balance: 13_350_000 };
  const topUps: TopUpRecord[] = [
    {
      id: 't-1',
      departmentId: 'dept-arm',
      amount: 5_000_000,
      performedBy: 'Direktur',
      note: 'Top up',
      createdAt: '2026-11-01T08:00:00.000Z',
    },
  ];
  const settledDp = makeDownPayment({
    id: 'dp-settled',
    dpNumber: 'KSB-202611-001',
    requestedAmount: 2_000_000,
    status: 'settled',
    disbursedAt: '2026-11-10T09:00:00.000Z',
    settlement: {
      actualAmount: 1_650_000,
      differenceAmount: 350_000,
      differenceType: 'refund',
      receiptRef: 'STRUK-SEM-01',
      settledBy: 'Hendra Kusuma',
      note: 'Sisa uang jalan dikembalikan tunai',
      settledAt: '2026-11-12T16:00:00.000Z',
    },
  });

  const ledger = buildCashLedger(
    [dept],
    [],
    topUps,
    'dept-arm',
    '2026-11',
    [settledDp]
  );
  assert.equal(ledger.openingBalance, 10_000_000);
  assert.equal(ledger.totalInflow, 5_350_000);
  assert.equal(ledger.totalOutflow, 2_000_000);
  assert.equal(ledger.closingBalance, 13_350_000);
  assert.equal(ledger.entries[0].type, 'kasbon_refund');
  assert.equal(ledger.entries[1].type, 'kasbon_out');

  const report = generateMonthlyReport(
    '2026-11',
    [dept],
    [],
    topUps,
    undefined,
    [],
    [settledDp]
  );
  assert.equal(report.totalSpent, 1_650_000);
  assert.equal(report.settledKasbonTotal, 1_650_000);
  assert.equal(report.settledKasbonCount, 1);
});

test('Daily closing summary and monthly period lock validate pending items and locked state', () => {
  const dept: Department = { ...sampleDept, balance: 8_500_000 };
  const topUps: TopUpRecord[] = [
    {
      id: 't1',
      departmentId: 'dept-arm',
      amount: 3_000_000,
      performedBy: 'Direktur',
      note: 'Top up',
      createdAt: '2026-11-22T08:00:00.000Z',
    },
  ];
  const reqs: PettyCashRequest[] = [
    makeRequest({
      id: 'r-day',
      status: 'approved',
      amount: 1_500_000,
      disbursedAt: '2026-11-22T11:00:00.000Z',
    }),
    makeRequest({
      id: 'r-pend-nov',
      status: 'pending_director',
      amount: 500_000,
      createdAt: '2026-11-22T12:00:00.000Z',
    }),
  ];
  const dps: DownPaymentRecord[] = [
    makeDownPayment({
      id: 'dp-open',
      requestedAmount: 1_000_000,
      status: 'open',
      disbursedAt: '2026-11-21T09:00:00.000Z',
    }),
  ];
  const opnames: CashOpnameRecord[] = [
    {
      id: 'op-today',
      opnameNumber: 'OPN-202611-005',
      departmentId: 'dept-arm',
      systemBalance: 8_500_000,
      physicalTotal: 8_500_000,
      variance: 0,
      status: 'matched',
      denominations: [],
      countedBy: 'Budi',
      note: 'Klop',
      createdAt: '2026-11-22T17:00:00.000Z',
    },
  ];

  const closing = calculateDailyClosingSummary({
    closingDate: '2026-11-22',
    departmentId: 'dept-arm',
    departments: [dept],
    requests: reqs,
    topUps,
    downPayments: dps,
    opnames,
  });

  // Opening before 2026-11-22 = 8.5M - (3M - 1.5M) = 7M
  assert.equal(closing.openingBalance, 7_000_000);
  assert.equal(closing.totalInflow, 3_000_000);
  assert.equal(closing.totalOutflow, 1_500_000);
  assert.equal(closing.systemClosingBalance, 8_500_000);
  assert.equal(closing.physicalCountTotal, 8_500_000);
  assert.equal(closing.variance, 0);
  assert.equal(closing.openKasbonCount, 1);
  assert.equal(closing.openKasbonAmount, 1_000_000);

  const closedOct: ClosedPeriodRecord = {
    id: 'cp-oct',
    monthKey: '2026-10',
    totalTopUp: 0,
    totalSpent: 4_000_000,
    endingBalance: 7_000_000,
    approvedCount: 3,
    openKasbonAtClose: 0,
    closedBy: 'Hendra Kusuma (Direktur)',
    note: 'Tutup buku Oktober 2026',
    closedAt: '2026-11-01T09:00:00.000Z',
  };
  assert.ok(isPeriodClosed('2026-10-18T10:00:00.000Z', [closedOct]));
  assert.equal(isPeriodClosed('2026-11-22T10:00:00.000Z', [closedOct]), undefined);

  // Cannot close 2026-11 while pending request exists
  const closeNovBlocked = validateClosePeriod({
    monthKey: '2026-11',
    closedPeriods: [closedOct],
    requests: reqs,
    downPayments: dps,
    closedBy: 'Hendra Kusuma',
  });
  assert.equal(closeNovBlocked.valid, false);
  assert.match(closeNovBlocked.error ?? '', /menunggu persetujuan/i);

  // Can close 2026-12 when clean
  const closeDecOk = validateClosePeriod({
    monthKey: '2026-12',
    closedPeriods: [closedOct],
    requests: reqs,
    downPayments: dps,
    closedBy: 'Hendra Kusuma',
  });
  assert.equal(closeDecOk.valid, true);
});

import {
  KASBON_APPROVE_QUICK_ANSWERS,
  KASBON_REJECT_QUICK_ANSWERS,
  QUICK_ANSWER_CONSTANTS,
  REQUEST_APPROVE_QUICK_ANSWERS,
  REQUEST_REJECT_QUICK_ANSWERS,
  composeQuickAnswerNote,
} from './pettycashLogic';

test('Quick answer constants and composeQuickAnswerNote combine multiple reasons and custom other text cleanly', () => {
  assert.ok(REQUEST_REJECT_QUICK_ANSWERS.length >= 4);
  assert.ok(REQUEST_APPROVE_QUICK_ANSWERS.length >= 2);
  assert.ok(KASBON_REJECT_QUICK_ANSWERS.length >= 3);
  assert.ok(KASBON_APPROVE_QUICK_ANSWERS.length >= 2);
  assert.equal(QUICK_ANSWER_CONSTANTS.requestReject, REQUEST_REJECT_QUICK_ANSWERS);

  assert.equal(composeQuickAnswerNote([], false, 'ignored text'), '');
  assert.equal(
    composeQuickAnswerNote([], true, '  Struk SPBU buram dan terpotong  '),
    'Struk SPBU buram dan terpotong'
  );
  assert.equal(
    composeQuickAnswerNote(
      [REQUEST_REJECT_QUICK_ANSWERS[0], REQUEST_REJECT_QUICK_ANSWERS[1]],
      false,
      ''
    ),
    `${REQUEST_REJECT_QUICK_ANSWERS[0]}; ${REQUEST_REJECT_QUICK_ANSWERS[1]}`
  );
  assert.equal(
    composeQuickAnswerNote(
      [REQUEST_REJECT_QUICK_ANSWERS[0], REQUEST_REJECT_QUICK_ANSWERS[0]],
      true,
      'Harap foto ulang dengan lampu terang'
    ),
    `${REQUEST_REJECT_QUICK_ANSWERS[0]}; Lainnya: Harap foto ulang dengan lampu terang`
  );
});

import crypto from 'node:crypto';
import {
  ACTIVITY_LOG_GENESIS_HASH,
  buildActivityLogEntry,
  generateActivityLogCsv,
  verifyActivityLogChainAsync,
  verifyActivityLogChainSync,
} from './pettycashLogic';

function sha256Test(payload: string): string {
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

test('Activity log hash chain records actor, exact timestamp, and detects tampering', async () => {
  const first = buildActivityLogEntry(
    {
      id: 'act-1',
      actionType: 'request_approved',
      entityType: 'petty_cash_request',
      entityId: 'req-1',
      referenceNumber: 'PC-202611-001',
      title: 'Solar Truk Wingbox',
      departmentId: 'dept-arm',
      departmentName: 'Operasional Armada & Truk',
      requesterName: 'Andi Wijaya',
      amount: 1_500_000,
      decision: 'approve',
      actorName: 'Hendra Kusuma (Direktur)',
      actorRole: 'director',
      note: 'Disetujui sesuai rute.',
      timestamp: '2026-11-23T08:10:00.125Z',
    },
    undefined,
    sha256Test
  );

  assert.equal(first.sequence, 1);
  assert.equal(first.previousHash, ACTIVITY_LOG_GENESIS_HASH);
  assert.equal(first.entryHash.length, 64);

  const second = buildActivityLogEntry(
    {
      id: 'act-2',
      actionType: 'kasbon_rejected',
      entityType: 'down_payment',
      entityId: 'dp-3',
      referenceNumber: 'KSB-202611-003',
      title: 'Kasbon Clearance Pelabuhan',
      departmentId: 'dept-cso',
      departmentName: 'Operasional Kargo & Pelabuhan',
      requesterName: 'Dimas Prasetyo',
      amount: 1_100_000,
      decision: 'reject',
      actorName: 'Hendra Kusuma (Direktur)',
      actorRole: 'director',
      note: 'Rincian keperluan belum lengkap',
      timestamp: '2026-11-23T08:15:42.900Z',
    },
    first,
    sha256Test
  );

  assert.equal(second.sequence, 2);
  assert.equal(second.previousHash, first.entryHash);

  const okSync = verifyActivityLogChainSync(
    [second, first],
    sha256Test,
    '2026-11-23T08:16:00.000Z'
  );
  assert.equal(okSync.valid, true);
  assert.equal(okSync.totalEntries, 2);
  assert.equal(okSync.lastSequence, 2);
  assert.equal(okSync.lastHash, second.entryHash);
  assert.equal(okSync.issues.length, 0);

  const okAsync = await verifyActivityLogChainAsync(
    [second, first],
    async (payload) => sha256Test(payload),
    '2026-11-23T08:16:00.000Z'
  );
  assert.equal(okAsync.valid, true);

  // Tamper check 1: altering actorName breaks entryHash
  const tamperedActor = verifyActivityLogChainSync(
    [{ ...first, actorName: 'Orang Lain' }, second],
    sha256Test
  );
  assert.equal(tamperedActor.valid, false);
  assert.ok(
    tamperedActor.issues.some(
      (i) => i.sequence === 1 && /Hash SHA-256 tidak cocok/i.test(i.reason)
    )
  );

  // Tamper check 2: altering timestamp to back-date entry 2 below entry 1 fails both hash and timestamp check
  const tamperedTime = verifyActivityLogChainSync(
    [first, { ...second, timestamp: '2026-11-23T07:00:00.000Z' }],
    sha256Test
  );
  assert.equal(tamperedTime.valid, false);
  assert.ok(
    tamperedTime.issues.some((i) => i.sequence === 2 && /Timestamp/i.test(i.reason))
  );

  // Tamper check 3: deleting entry 1 causes sequence gap and broken previousHash
  const deletedFirst = verifyActivityLogChainSync([second], sha256Test);
  assert.equal(deletedFirst.valid, false);
  assert.ok(deletedFirst.issues.some((i) => /Urutan log terputus/i.test(i.reason)));

  // CSV export includes reference, actor, UTC timestamp, and SHA-256 hash
  const csv = generateActivityLogCsv([second, first], okSync);
  assert.ok(csv.includes('KSB-202611-003'));
  assert.ok(csv.includes('2026-11-23T08:15:42.900Z'));
  assert.ok(csv.includes('Hendra Kusuma (Direktur)'));
  assert.ok(csv.includes(second.entryHash));
});

import { WIKI_ARTICLES, WIKI_CATEGORIES } from '../constants/wikiArticles.ts';

test('Wiki articles cover all core and optional features with valid structure', () => {
  assert.ok(WIKI_ARTICLES.length >= 15);
  assert.equal(WIKI_CATEGORIES.length, 4);

  const ids = new Set<string>();
  const targetTabs = new Set<string>();

  for (const article of WIKI_ARTICLES) {
    assert.ok(!ids.has(article.id), `Duplicate wiki id: ${article.id}`);
    ids.add(article.id);
    targetTabs.add(article.targetTab);

    assert.ok(article.title.trim().length > 5);
    assert.ok(article.summary.trim().length > 20);
    assert.ok(article.keyCapabilities.length >= 2);
    assert.ok(article.workflowSteps.length >= 2);
    assert.ok(article.rulesAndGuards.length >= 1);
    assert.ok(article.keywords.length >= 3);
  }

  for (const requiredTab of [
    'dashboard',
    'approvals',
    'down-payments',
    'departments',
    'closing',
    'activity-log',
    'reports',
    'master',
    'fraud-guard',
    'forecast',
    'tax',
    'whatsapp',
    'modules',
    'rbac',
  ]) {
    assert.ok(targetTabs.has(requiredTab), `Missing wiki guide for tab: ${requiredTab}`);
  }
});

import {
  ALL_PERMISSION_KEYS,
  SlidingWindowRateLimiter,
  SYSTEM_ADMIN_LOCKED_PERMISSIONS,
  canAccessTab,
  createDefaultRbacRoles,
  escapeCsvCell,
  getFirstPermittedTab,
  hasPermission,
  validatePasswordStrength,
  validateRolePayload,
} from './pettycashLogic';

test('Dynamic RBAC permissions, system role protection, and tab fallback work accurately', () => {
  const roles = createDefaultRbacRoles('2026-11-24T00:00:00.000Z');
  assert.equal(roles.length, 4);
  const director = roles.find((r) => r.id === 'role-director')!;
  const staff = roles.find((r) => r.id === 'role-staff')!;
  assert.equal(director.permissions.length, ALL_PERMISSION_KEYS.length);

  assert.equal(hasPermission(staff.permissions, 'requests:create'), true);
  assert.equal(hasPermission(staff.permissions, 'requests:decide'), false);
  assert.equal(canAccessTab(staff.permissions, 'approvals'), true);
  assert.equal(canAccessTab(staff.permissions, 'rbac'), false);

  // Restore last visited tab when permitted, fall back when denied or module disabled
  assert.equal(
    getFirstPermittedTab(staff.permissions, 'down-payments'),
    'down-payments'
  );
  assert.equal(getFirstPermittedTab(staff.permissions, 'rbac'), 'dashboard');
  assert.equal(
    getFirstPermittedTab(director.permissions, 'tax', { taxModule: false }),
    'dashboard'
  );
  assert.equal(
    getFirstPermittedTab(director.permissions, 'tax', { taxModule: true }),
    'tax'
  );

  // System admin role retains locked safety permissions even if caller omits them
  const validatedSys = validateRolePayload({
    name: 'Direktur Utama',
    description: 'Super admin',
    permissions: ['requests:create'],
    isSystemRole: true,
  });
  assert.equal(validatedSys.valid, true);
  for (const locked of SYSTEM_ADMIN_LOCKED_PERMISSIONS) {
    assert.ok(validatedSys.normalized?.permissions.includes(locked));
  }

  // Password policy enforces length >= 8 and alphanumeric
  assert.equal(validatePasswordStrength('abc12').valid, false);
  assert.equal(validatePasswordStrength('abcdefgh').valid, false);
  assert.equal(validatePasswordStrength('12345678').valid, false);
  assert.equal(validatePasswordStrength('CargoAman99').valid, true);
});

test('SlidingWindowRateLimiter blocks bursts and recovers after window expiry', () => {
  const limiter = new SlidingWindowRateLimiter();
  const baseNow = 1_700_000_000_000;

  assert.equal(limiter.consume('ip-1', 2, 60_000, baseNow).allowed, true);
  assert.equal(limiter.consume('ip-1', 2, 60_000, baseNow + 1000).allowed, true);
  const blocked = limiter.consume('ip-1', 2, 60_000, baseNow + 2000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 57);

  // Different key stays independent
  assert.equal(limiter.consume('ip-2', 2, 60_000, baseNow + 2000).allowed, true);

  // After window elapses, requests are allowed again
  assert.equal(limiter.consume('ip-1', 2, 60_000, baseNow + 61_000).allowed, true);
});

test('CSV export neutralizes spreadsheet formula injection prefixes while preserving numeric amounts', () => {
  assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(escapeCsvCell('+cmd|"calc"!A0'), '"\'+cmd|""calc""!A0"');
  assert.equal(escapeCsvCell('@evil'), "'@evil");
  assert.equal(escapeCsvCell('-250000'), "'-250000");
  assert.equal(escapeCsvCell(-250000), '-250000');
});

test('Auth and RBAC events integrate cleanly into the SHA-256 audit chain', () => {
  const loginEntry = buildActivityLogEntry(
    {
      id: 'act-auth-1',
      actionType: 'auth_login',
      entityType: 'auth_session',
      entityId: 'sess-1',
      referenceNumber: 'SES-001',
      title: 'Login pengguna berhasil (hendra@kargo.id)',
      departmentId: 'SYSTEM',
      departmentName: 'Sistem Keamanan',
      requesterName: 'hendra@kargo.id',
      amount: 0,
      decision: 'info',
      actorName: 'Hendra Kusuma',
      actorRole: 'role-director',
      note: 'Pulih ke halaman /approvals',
      timestamp: '2026-11-24T03:00:00.000Z',
    },
    undefined,
    sha256Test
  );
  const roleEntry = buildActivityLogEntry(
    {
      id: 'act-rbac-2',
      actionType: 'rbac_role_created',
      entityType: 'rbac_policy',
      entityId: 'role-kepala-pool',
      referenceNumber: 'ROLE-KEPALA-POOL',
      title: 'Role baru Kepala Pool dibuat',
      departmentId: 'SYSTEM',
      departmentName: 'Manajemen RBAC',
      requesterName: 'Hendra Kusuma',
      amount: 0,
      decision: 'info',
      actorName: 'Hendra Kusuma',
      actorRole: 'role-director',
      note: '6 permissions aktif',
      timestamp: '2026-11-24T03:01:00.000Z',
    },
    loginEntry,
    sha256Test
  );

  const report = verifyActivityLogChainSync([roleEntry, loginEntry], sha256Test);
  assert.equal(report.valid, true);
  assert.equal(report.totalEntries, 2);
});









