import type {
  CashForecastPoint,
  CashForecastSummary,
  CashHealthMetrics,
  CashOpnameRecord,
  ColdForecastMethod,
  Department,
  DepartmentMetrics,
  DivisionForecast,
  DownPaymentRecord,
  ForecastBurnRateSource,
  ForecastDataConfidence,
  PettyCashRequest,
} from '../../types/pettycash.ts';
import { getPreviousMonthKey } from './constants.ts';
import { calculatePendingHoldForDepartment } from './requests.ts';

export function calculateCashHealth(
  metrics: DepartmentMetrics[],
  opnames: CashOpnameRecord[] = []
): CashHealthMetrics {
  const activeMetrics = metrics.filter((m) => m.department.active !== false);
  const totalActiveDeptsCount = activeMetrics.length;
  const totalAvailableBalance = activeMetrics.reduce(
    (s, m) => s + m.availableBalance,
    0
  );
  const totalLowThreshold = activeMetrics.reduce(
    (s, m) => s + m.department.lowBalanceThreshold,
    0
  );
  const totalBudget = activeMetrics.reduce(
    (s, m) => s + m.department.monthlyBudget,
    0
  );
  const totalMonthSpent = activeMetrics.reduce((s, m) => s + m.monthSpent, 0);
  const healthyDeptsCount = activeMetrics.filter(
    (m) => m.healthStatus === 'normal'
  ).length;

  const coverageRatioPct =
    totalLowThreshold > 0
      ? Math.min(200, Math.round((totalAvailableBalance / totalLowThreshold) * 100))
      : 100;
  const budgetRemainingPct =
    totalBudget > 0
      ? Math.max(
          0,
          Math.min(100, Math.round(((totalBudget - totalMonthSpent) / totalBudget) * 100))
        )
      : 100;

  // Weighted score 0..100
  // 1) Coverage vs 2x safe threshold (45 pts)
  const coverageScore =
    totalLowThreshold > 0
      ? Math.min(45, (totalAvailableBalance / (totalLowThreshold * 2)) * 45)
      : totalAvailableBalance > 0
      ? 45
      : 0;
  // 2) Monthly budget headroom (30 pts)
  const budgetScore = (budgetRemainingPct / 100) * 30;
  // 3) Division status & latest opname accuracy (25 pts)
  const divisionRatio =
    totalActiveDeptsCount > 0 ? healthyDeptsCount / totalActiveDeptsCount : 1;
  const latestByDept = new Map<string, CashOpnameRecord>();
  for (const op of opnames) {
    if (!latestByDept.has(op.departmentId)) {
      latestByDept.set(op.departmentId, op);
    }
  }
  const latestOpnameVariance = Array.from(latestByDept.values()).reduce(
    (sum, op) => sum + op.variance,
    0
  );
  const opnamePenalty = Math.min(5, Math.abs(latestOpnameVariance) / 100_000);
  const stabilityScore = Math.max(0, divisionRatio * 20 + (5 - opnamePenalty));

  const score = Math.max(
    0,
    Math.min(100, Math.round(coverageScore + budgetScore + stabilityScore))
  );

  let status: 'sehat' | 'waspada' | 'kritis' = 'sehat';
  let statusLabel = 'Sehat';
  if (score < 45) {
    status = 'kritis';
    statusLabel = 'Kritis';
  } else if (score < 75) {
    status = 'waspada';
    statusLabel = 'Waspada';
  }

  const coveragePoints = Math.round(coverageScore * 10) / 10;
  const budgetPoints = Math.round(budgetScore * 10) / 10;
  const stabilityPoints = Math.round(stabilityScore * 10) / 10;

  return {
    score,
    status,
    statusLabel,
    totalAvailableBalance,
    totalLowThreshold,
    healthyDeptsCount,
    totalActiveDeptsCount,
    latestOpnameVariance,
    coverageRatioPct,
    budgetRemainingPct,
    coveragePoints,
    budgetPoints,
    stabilityPoints,
  };
}

export interface CashForecastOptions {
  surgeMultiplier?: number;
  includePending?: boolean;
  coldStartMethod?: ColdForecastMethod;
  budgetUtilizationAssumptionPct?: number;
  horizonDays?: 14 | 30 | 60;
}

export function calculateCashForecast(
  departments: Department[],
  requests: PettyCashRequest[],
  referenceIso: string,
  options: CashForecastOptions = {},
  downPayments: DownPaymentRecord[] = []
): CashForecastSummary {
  const surgeMultiplier = options.surgeMultiplier ?? 1;
  const includePending = options.includePending ?? false;
  const coldStartMethod: ColdForecastMethod =
    options.coldStartMethod ?? 'budget_baseline';
  const budgetUtilizationAssumptionPct = Math.max(
    10,
    Math.min(100, Math.round(options.budgetUtilizationAssumptionPct ?? 70))
  );
  const horizonDays: 14 | 30 | 60 = options.horizonDays ?? 30;

  const safeIso = /^\d{4}-\d{2}-\d{2}/.test(referenceIso)
    ? referenceIso
    : new Date().toISOString();
  const monthKey = safeIso.slice(0, 7);
  const previousMonthKey = getPreviousMonthKey(monthKey);
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate() || 30;
  const prevYear = Number(previousMonthKey.slice(0, 4));
  const prevMonth = Number(previousMonthKey.slice(5, 7));
  const daysInPrevMonth =
    new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate() || 30;

  const dayOfMonth = Math.max(
    1,
    Math.min(daysInMonth, Number(safeIso.slice(8, 10)) || 1)
  );
  const daysElapsedInMonth = dayOfMonth;
  const daysRemainingInMonth = Math.max(0, daysInMonth - dayOfMonth);

  const activeDepartments = departments.filter((d) => d.active !== false);

  const byDivision: DivisionForecast[] = activeDepartments.map((dept) => {
    const pendingHold = calculatePendingHoldForDepartment(
      dept.id,
      requests,
      downPayments
    );
    const availableBalance = Math.max(0, dept.balance - pendingHold);

    const monthApprovedReqs = requests.filter(
      (r) =>
        r.departmentId === dept.id &&
        r.status === 'approved' &&
        (r.disbursedAt ?? r.updatedAt).startsWith(monthKey)
    );
    const monthTxCount = monthApprovedReqs.length;
    const monthApprovedSpend = monthApprovedReqs.reduce(
      (sum, r) => sum + r.amount,
      0
    );

    const prevMonthApprovedReqs = requests.filter(
      (r) =>
        r.departmentId === dept.id &&
        r.status === 'approved' &&
        (r.disbursedAt ?? r.updatedAt).startsWith(previousMonthKey)
    );
    const prevMonthTxCount = prevMonthApprovedReqs.length;
    const prevMonthSpent = prevMonthApprovedReqs.reduce(
      (sum, r) => sum + r.amount,
      0
    );

    const currentActualDailyBurn = monthApprovedSpend / daysElapsedInMonth;
    const prevMonthDailyBurn = prevMonthSpent / daysInPrevMonth;
    const coldBaselineDailyBurn = Math.round(
      ((dept.monthlyBudget * (budgetUtilizationAssumptionPct / 100)) /
        daysInMonth) *
        surgeMultiplier
    );

    let dataConfidence: ForecastDataConfidence = 'mature';
    if (monthTxCount === 0 && prevMonthTxCount === 0) {
      dataConfidence = 'cold';
    } else if (monthTxCount < 2 || daysElapsedInMonth < 7) {
      dataConfidence = 'partial';
    }

    let baseDailyBurn = currentActualDailyBurn;
    let burnRateSource: ForecastBurnRateSource = 'actual_mtd';

    if (coldStartMethod === 'zero_conservative') {
      baseDailyBurn = currentActualDailyBurn;
      burnRateSource = monthTxCount === 0 ? 'zero_actual' : 'actual_mtd';
    } else if (dataConfidence === 'cold') {
      baseDailyBurn =
        (dept.monthlyBudget * (budgetUtilizationAssumptionPct / 100)) /
        daysInMonth;
      burnRateSource = 'cold_budget';
    } else if (dataConfidence === 'partial') {
      if (prevMonthDailyBurn > 0) {
        const mtdWeight =
          monthTxCount === 0
            ? 0
            : Math.min(0.7, Math.max(0.25, daysElapsedInMonth / 15));
        baseDailyBurn =
          prevMonthDailyBurn * (1 - mtdWeight) +
          currentActualDailyBurn * mtdWeight;
        burnRateSource = 'hybrid_prev_month';
      } else if (coldStartMethod === 'hybrid_historical') {
        const budgetDaily =
          (dept.monthlyBudget * (budgetUtilizationAssumptionPct / 100)) /
          daysInMonth;
        const mtdWeight = Math.min(0.75, 0.35 + (daysElapsedInMonth / 30) * 0.4);
        baseDailyBurn =
          budgetDaily * (1 - mtdWeight) + currentActualDailyBurn * mtdWeight;
        burnRateSource = 'hybrid_budget';
      } else {
        const budgetDaily =
          (dept.monthlyBudget * (budgetUtilizationAssumptionPct / 100)) /
          daysInMonth;
        const mtdWeight = Math.min(
          0.75,
          (monthTxCount / 2) * 0.45 + (daysElapsedInMonth / 30) * 0.3
        );
        baseDailyBurn =
          budgetDaily * (1 - mtdWeight) + currentActualDailyBurn * mtdWeight;
        burnRateSource = 'hybrid_budget';
      }
    } else {
      baseDailyBurn = currentActualDailyBurn;
      burnRateSource = 'actual_mtd';
    }

    const pendingAdjustmentPerDay = includePending
      ? pendingHold / daysElapsedInMonth
      : 0;
    const dailyBurnRate = Math.round(
      (baseDailyBurn + pendingAdjustmentPerDay) * surgeMultiplier
    );

    const runwayDays =
      dailyBurnRate > 0 ? Math.floor(availableBalance / dailyBurnRate) : null;
    const projectedAdditional = Math.round(dailyBurnRate * daysRemainingInMonth);
    const projectedMonthEndSpend = monthApprovedSpend + projectedAdditional;
    const projectedMonthEndBalance = availableBalance - projectedAdditional;

    let recommendedTopUp = 0;
    if (projectedMonthEndBalance < dept.lowBalanceThreshold) {
      recommendedTopUp =
        Math.ceil(
          (dept.lowBalanceThreshold - projectedMonthEndBalance) / 50_000
        ) * 50_000;
    }

    let riskLevel: 'aman' | 'perhatian' | 'kritis' = 'aman';
    if (
      availableBalance <= dept.lowBalanceThreshold * 0.5 ||
      projectedMonthEndBalance <= 0
    ) {
      riskLevel = 'kritis';
    } else if (
      availableBalance <= dept.lowBalanceThreshold ||
      projectedMonthEndBalance < dept.lowBalanceThreshold
    ) {
      riskLevel = 'perhatian';
    }

    return {
      departmentId: dept.id,
      departmentCode: dept.code,
      departmentName: dept.name,
      monthlyBudget: dept.monthlyBudget,
      availableBalance,
      lowBalanceThreshold: dept.lowBalanceThreshold,
      monthTxCount,
      prevMonthSpent,
      coldBaselineDailyBurn,
      dataConfidence,
      burnRateSource,
      dailyBurnRate,
      runwayDays,
      projectedMonthEndSpend,
      projectedMonthEndBalance,
      recommendedTopUp,
      riskLevel,
    };
  });

  const totalAvailableBalance = byDivision.reduce(
    (s, d) => s + d.availableBalance,
    0
  );
  const totalLowThreshold = byDivision.reduce(
    (s, d) => s + d.lowBalanceThreshold,
    0
  );
  const dailyBurnRate = byDivision.reduce((s, d) => s + d.dailyBurnRate, 0);
  const overallRunwayDays =
    dailyBurnRate > 0 ? Math.floor(totalAvailableBalance / dailyBurnRate) : null;
  const projectedMonthEndSpend = byDivision.reduce(
    (s, d) => s + d.projectedMonthEndSpend,
    0
  );
  const projectedMonthEndBalance = byDivision.reduce(
    (s, d) => s + d.projectedMonthEndBalance,
    0
  );
  const totalRecommendedTopUp = byDivision.reduce(
    (s, d) => s + d.recommendedTopUp,
    0
  );

  const coldDivisionsCount = byDivision.filter(
    (d) => d.dataConfidence === 'cold'
  ).length;
  const partialDivisionsCount = byDivision.filter(
    (d) => d.dataConfidence === 'partial'
  ).length;
  const matureDivisionsCount = byDivision.filter(
    (d) => d.dataConfidence === 'mature'
  ).length;

  let overallConfidence: ForecastDataConfidence = 'mature';
  if (
    byDivision.length === 0 ||
    coldDivisionsCount === byDivision.length
  ) {
    overallConfidence = 'cold';
  } else if (coldDivisionsCount > 0 || partialDivisionsCount > 0) {
    overallConfidence = 'partial';
  }

  const offsetsByHorizon: Record<14 | 30 | 60, number[]> = {
    14: [0, 2, 4, 7, 10, 12, 14],
    30: [0, 5, 10, 15, 20, 25, 30],
    60: [0, 10, 20, 30, 40, 50, 60],
  };
  const offsets = offsetsByHorizon[horizonDays];
  const curvePoints: CashForecastPoint[] = offsets.map((dayOffset) => ({
    dayOffset,
    label: dayOffset === 0 ? 'Hari Ini' : `+${dayOffset} Hr`,
    projectedBalance:
      totalAvailableBalance - Math.round(dailyBurnRate * dayOffset),
  }));

  return {
    referenceDate: safeIso.slice(0, 10),
    horizonDays,
    coldStartMethod,
    budgetUtilizationAssumptionPct,
    daysElapsedInMonth,
    daysRemainingInMonth,
    dailyBurnRate,
    overallRunwayDays,
    projectedMonthEndSpend,
    projectedMonthEndBalance,
    totalLowThreshold,
    totalRecommendedTopUp,
    overallConfidence,
    coldDivisionsCount,
    partialDivisionsCount,
    matureDivisionsCount,
    curvePoints,
    byDivision: byDivision.sort((a, b) => {
      const rank = { kritis: 0, perhatian: 1, aman: 2 };
      return (
        rank[a.riskLevel] - rank[b.riskLevel] ||
        b.recommendedTopUp - a.recommendedTopUp
      );
    }),
  };
}
