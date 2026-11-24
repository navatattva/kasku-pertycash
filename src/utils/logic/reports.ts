import type {
  Department,
  DownPaymentRecord,
  ExpenseCategory,
  MasterVehicle,
  MonthlyCategoryBreakdown,
  MonthlyDepartmentBreakdown,
  MonthlyReport,
  MonthlyVehicleBreakdown,
  PettyCashRequest,
  TopUpRecord,
} from '../../types/pettycash.ts';
import {
  computeMomDelta,
  escapeCsvCell,
  getPreviousMonthKey,
} from './constants.ts';

export function generateMonthlyReport(
  monthKey: string,
  departments: Department[],
  requests: PettyCashRequest[],
  topUps: TopUpRecord[],
  filterDepartmentId?: string,
  vehicles: MasterVehicle[] = [],
  downPayments: DownPaymentRecord[] = []
): MonthlyReport {
  const previousMonthKey = getPreviousMonthKey(monthKey);
  const scopedDepartments = filterDepartmentId
    ? departments.filter((d) => d.id === filterDepartmentId)
    : departments;
  const deptNameMap = new Map(departments.map((d) => [d.id, d.name]));
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  const monthRequests = requests.filter((r) => {
    const refDate =
      r.status === 'approved' ? r.disbursedAt ?? r.updatedAt : r.createdAt;
    const matchesMonth = refDate.startsWith(monthKey);
    const matchesDept = filterDepartmentId
      ? r.departmentId === filterDepartmentId
      : true;
    return matchesMonth && matchesDept;
  });

  const prevApprovedTransactions = requests.filter((r) => {
    if (r.status !== 'approved') return false;
    const refDate = r.disbursedAt ?? r.updatedAt;
    const matchesMonth = refDate.startsWith(previousMonthKey);
    const matchesDept = filterDepartmentId
      ? r.departmentId === filterDepartmentId
      : true;
    return matchesMonth && matchesDept;
  });

  const approvedTransactions = monthRequests
    .filter((r) => r.status === 'approved')
    .sort((a, b) =>
      (b.disbursedAt ?? b.updatedAt).localeCompare(a.disbursedAt ?? a.updatedAt)
    );

  const settledKasbons = downPayments
    .filter((dp) => {
      if (dp.status !== 'settled' || !dp.settlement) return false;
      const matchesMonth = dp.settlement.settledAt.startsWith(monthKey);
      const matchesDept = filterDepartmentId
        ? dp.departmentId === filterDepartmentId
        : true;
      return matchesMonth && matchesDept;
    })
    .sort((a, b) =>
      (b.settlement?.settledAt ?? '').localeCompare(
        a.settlement?.settledAt ?? ''
      )
    );

  const prevSettledKasbons = downPayments.filter((dp) => {
    if (dp.status !== 'settled' || !dp.settlement) return false;
    const matchesMonth = dp.settlement.settledAt.startsWith(previousMonthKey);
    const matchesDept = filterDepartmentId
      ? dp.departmentId === filterDepartmentId
      : true;
    return matchesMonth && matchesDept;
  });

  const rejectedCount = monthRequests.filter((r) => r.status === 'rejected').length;
  const pendingCount = monthRequests.filter(
    (r) => r.status === 'pending_director'
  ).length;

  const monthTopUps = topUps.filter(
    (t) =>
      t.createdAt.startsWith(monthKey) &&
      (!filterDepartmentId || t.departmentId === filterDepartmentId)
  );

  const settledKasbonTotal = settledKasbons.reduce(
    (s, dp) => s + (dp.settlement?.actualAmount ?? 0),
    0
  );
  const prevSettledKasbonTotal = prevSettledKasbons.reduce(
    (s, dp) => s + (dp.settlement?.actualAmount ?? 0),
    0
  );

  const totalSpent =
    approvedTransactions.reduce((s, r) => s + r.amount, 0) + settledKasbonTotal;
  const previousTotalSpent =
    prevApprovedTransactions.reduce((s, r) => s + r.amount, 0) +
    prevSettledKasbonTotal;
  const { deltaAmount: momDeltaAmount, deltaPct: momDeltaPct } =
    computeMomDelta(totalSpent, previousTotalSpent);

  const totalBudget = scopedDepartments.reduce((s, d) => s + d.monthlyBudget, 0);
  const totalTopUp = monthTopUps.reduce((s, t) => s + t.amount, 0);
  const totalRealizedTxCount =
    approvedTransactions.length + settledKasbons.length;
  const averageExpense =
    totalRealizedTxCount > 0 ? Math.round(totalSpent / totalRealizedTxCount) : 0;

  const byDepartment: MonthlyDepartmentBreakdown[] = scopedDepartments.map((dept) => {
    const deptTx = approvedTransactions.filter((r) => r.departmentId === dept.id);
    const deptDp = settledKasbons.filter((dp) => dp.departmentId === dept.id);
    const prevDeptTx = prevApprovedTransactions.filter(
      (r) => r.departmentId === dept.id
    );
    const prevDeptDp = prevSettledKasbons.filter(
      (dp) => dp.departmentId === dept.id
    );
    const deptSpent =
      deptTx.reduce((s, r) => s + r.amount, 0) +
      deptDp.reduce((s, dp) => s + (dp.settlement?.actualAmount ?? 0), 0);
    const prevDeptSpent =
      prevDeptTx.reduce((s, r) => s + r.amount, 0) +
      prevDeptDp.reduce((s, dp) => s + (dp.settlement?.actualAmount ?? 0), 0);
    const { deltaAmount, deltaPct } = computeMomDelta(deptSpent, prevDeptSpent);
    const deptTopUp = monthTopUps
      .filter((t) => t.departmentId === dept.id)
      .reduce((s, t) => s + t.amount, 0);
    const remainingBudget = dept.monthlyBudget - deptSpent;
    const utilizationPct =
      dept.monthlyBudget > 0
        ? Math.round((deptSpent / dept.monthlyBudget) * 1000) / 10
        : 0;

    return {
      departmentId: dept.id,
      departmentCode: dept.code,
      departmentName: dept.name,
      monthlyBudget: dept.monthlyBudget,
      totalSpent: deptSpent,
      prevTotalSpent: prevDeptSpent,
      deltaAmount,
      deltaPct,
      totalTopUp: deptTopUp,
      transactionCount: deptTx.length + deptDp.length,
      remainingBudget,
      utilizationPct,
    };
  });

  const categoryTotals = new Map<
    ExpenseCategory,
    { total: number; prevTotal: number; count: number }
  >();
  for (const tx of approvedTransactions) {
    const existing = categoryTotals.get(tx.category) ?? {
      total: 0,
      prevTotal: 0,
      count: 0,
    };
    categoryTotals.set(tx.category, {
      total: existing.total + tx.amount,
      prevTotal: existing.prevTotal,
      count: existing.count + 1,
    });
  }
  for (const dp of settledKasbons) {
    const act = dp.settlement?.actualAmount ?? 0;
    const existing = categoryTotals.get(dp.category) ?? {
      total: 0,
      prevTotal: 0,
      count: 0,
    };
    categoryTotals.set(dp.category, {
      total: existing.total + act,
      prevTotal: existing.prevTotal,
      count: existing.count + 1,
    });
  }
  for (const ptx of prevApprovedTransactions) {
    const existing = categoryTotals.get(ptx.category) ?? {
      total: 0,
      prevTotal: 0,
      count: 0,
    };
    categoryTotals.set(ptx.category, {
      total: existing.total,
      prevTotal: existing.prevTotal + ptx.amount,
      count: existing.count,
    });
  }
  for (const pdp of prevSettledKasbons) {
    const act = pdp.settlement?.actualAmount ?? 0;
    const existing = categoryTotals.get(pdp.category) ?? {
      total: 0,
      prevTotal: 0,
      count: 0,
    };
    categoryTotals.set(pdp.category, {
      total: existing.total,
      prevTotal: existing.prevTotal + act,
      count: existing.count,
    });
  }

  const byCategory: MonthlyCategoryBreakdown[] = Array.from(
    categoryTotals.entries()
  )
    .map(([category, info]) => {
      const { deltaAmount, deltaPct } = computeMomDelta(
        info.total,
        info.prevTotal
      );
      return {
        category,
        totalSpent: info.total,
        prevTotalSpent: info.prevTotal,
        deltaAmount,
        deltaPct,
        transactionCount: info.count,
        sharePct:
          totalSpent > 0 ? Math.round((info.total / totalSpent) * 1000) / 10 : 0,
      };
    })
    .filter((c) => c.totalSpent > 0 || c.prevTotalSpent > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent || b.prevTotalSpent - a.prevTotalSpent);

  // Per-vehicle cost aggregation + MoM comparison
  const vehicleAcc = new Map<
    string,
    {
      plateNumber: string;
      unitType: string;
      departmentName: string;
      transactionCount: number;
      fuelTollSpent: number;
      maintenanceSpent: number;
      otherSpent: number;
      totalSpent: number;
      prevTotalSpent: number;
    }
  >();

  for (const v of vehicles) {
    if (filterDepartmentId && v.departmentId !== filterDepartmentId) continue;
    if (!v.active) continue;
    vehicleAcc.set(v.id, {
      plateNumber: v.plateNumber,
      unitType: v.unitType,
      departmentName: deptNameMap.get(v.departmentId) ?? v.departmentId,
      transactionCount: 0,
      fuelTollSpent: 0,
      maintenanceSpent: 0,
      otherSpent: 0,
      totalSpent: 0,
      prevTotalSpent: 0,
    });
  }

  function resolveVehicleSlot(tx: PettyCashRequest): string {
    if (tx.vehicleId) return tx.vehicleId;
    if (tx.vehiclePlate) return `plate:${tx.vehiclePlate}`;
    return 'non-unit';
  }

  function ensureVehicleEntry(tx: PettyCashRequest, key: string) {
    const existing = vehicleAcc.get(key);
    if (existing) return existing;
    const master = tx.vehicleId ? vehicleById.get(tx.vehicleId) : undefined;
    const created = {
      plateNumber:
        key === 'non-unit'
          ? 'Non-Armada / Umum'
          : master?.plateNumber ?? tx.vehiclePlate ?? 'Unit Tidak Terdaftar',
      unitType:
        key === 'non-unit'
          ? 'Operasional Gudang, Pelabuhan & Kantor'
          : master?.unitType ?? 'Armada Kargo',
      departmentName:
        key === 'non-unit'
          ? filterDepartmentId
            ? deptNameMap.get(filterDepartmentId) ?? '-'
            : 'Semua Divisi'
          : deptNameMap.get(master?.departmentId ?? tx.departmentId) ??
            tx.departmentId,
      transactionCount: 0,
      fuelTollSpent: 0,
      maintenanceSpent: 0,
      otherSpent: 0,
      totalSpent: 0,
      prevTotalSpent: 0,
    };
    vehicleAcc.set(key, created);
    return created;
  }

  for (const tx of approvedTransactions) {
    const key = resolveVehicleSlot(tx);
    const entry = ensureVehicleEntry(tx, key);
    entry.transactionCount += 1;
    entry.totalSpent += tx.amount;
    const catLower = tx.category.toLowerCase();
    if (catLower.includes('bbm') || catLower.includes('tol')) {
      entry.fuelTollSpent += tx.amount;
    } else if (
      catLower.includes('perawatan') ||
      catLower.includes('servis') ||
      catLower.includes('armada')
    ) {
      entry.maintenanceSpent += tx.amount;
    } else {
      entry.otherSpent += tx.amount;
    }
  }

  for (const ptx of prevApprovedTransactions) {
    const key = resolveVehicleSlot(ptx);
    const entry = ensureVehicleEntry(ptx, key);
    entry.prevTotalSpent += ptx.amount;
  }

  for (const dp of settledKasbons) {
    const act = dp.settlement?.actualAmount ?? 0;
    const key = dp.vehicleId
      ? dp.vehicleId
      : dp.vehiclePlate
      ? `plate:${dp.vehiclePlate}`
      : 'non-unit';
    const entry = ensureVehicleEntry(
      {
        departmentId: dp.departmentId,
        vehicleId: dp.vehicleId,
        vehiclePlate: dp.vehiclePlate,
      } as PettyCashRequest,
      key
    );
    entry.transactionCount += 1;
    entry.totalSpent += act;
    const catLower = dp.category.toLowerCase();
    if (catLower.includes('bbm') || catLower.includes('tol')) {
      entry.fuelTollSpent += act;
    } else if (
      catLower.includes('perawatan') ||
      catLower.includes('servis') ||
      catLower.includes('armada')
    ) {
      entry.maintenanceSpent += act;
    } else {
      entry.otherSpent += act;
    }
  }

  for (const pdp of prevSettledKasbons) {
    const act = pdp.settlement?.actualAmount ?? 0;
    const key = pdp.vehicleId
      ? pdp.vehicleId
      : pdp.vehiclePlate
      ? `plate:${pdp.vehiclePlate}`
      : 'non-unit';
    const entry = ensureVehicleEntry(
      {
        departmentId: pdp.departmentId,
        vehicleId: pdp.vehicleId,
        vehiclePlate: pdp.vehiclePlate,
      } as PettyCashRequest,
      key
    );
    entry.prevTotalSpent += act;
  }

  const byVehicle: MonthlyVehicleBreakdown[] = Array.from(
    vehicleAcc.entries()
  )
    .map(([vehicleKey, info]) => {
      const { deltaAmount, deltaPct } = computeMomDelta(
        info.totalSpent,
        info.prevTotalSpent
      );
      return {
        vehicleKey,
        plateNumber: info.plateNumber,
        unitType: info.unitType,
        departmentName: info.departmentName,
        transactionCount: info.transactionCount,
        fuelTollSpent: info.fuelTollSpent,
        maintenanceSpent: info.maintenanceSpent,
        otherSpent: info.otherSpent,
        totalSpent: info.totalSpent,
        prevTotalSpent: info.prevTotalSpent,
        deltaAmount,
        deltaPct,
      };
    })
    .sort((a, b) => {
      if (a.vehicleKey === 'non-unit' && b.vehicleKey !== 'non-unit') return 1;
      if (b.vehicleKey === 'non-unit' && a.vehicleKey !== 'non-unit') return -1;
      return b.totalSpent - a.totalSpent || b.prevTotalSpent - a.prevTotalSpent;
    });

  const totalPpnInput = approvedTransactions.reduce(
    (sum, tx) => sum + (tx.tax?.ppnAmount ?? 0),
    0
  );
  const totalPphWithheld = approvedTransactions.reduce(
    (sum, tx) => sum + (tx.tax?.pphAmount ?? 0),
    0
  );

  return {
    monthKey,
    previousMonthKey,
    totalSpent,
    previousTotalSpent,
    momDeltaAmount,
    momDeltaPct,
    totalBudget,
    totalTopUp,
    approvedCount: totalRealizedTxCount,
    rejectedCount,
    pendingCount,
    averageExpense,
    byDepartment,
    byCategory,
    byVehicle,
    transactions: approvedTransactions,
    settledKasbons,
    settledKasbonTotal,
    settledKasbonCount: settledKasbons.length,
    totalPpnInput,
    totalPphWithheld,
  };
}

export function generateReportCsv(
  report: MonthlyReport,
  departments: Department[],
  includeTaxColumns = false
): string {
  const deptLookup = new Map(departments.map((d) => [d.id, d.name]));
  const showTax =
    includeTaxColumns ||
    report.totalPpnInput > 0 ||
    report.totalPphWithheld > 0;

  const headers = [
    'Nomor Pengajuan',
    'Tanggal Pencairan',
    'Divisi / Departemen',
    'Pemohon',
    'Kategori',
    'Judul Keperluan',
    'No. Polisi Armada',
    'Referensi Bukti',
    ...(showTax
      ? ['Skema Pajak', 'DPP (IDR)', 'PPN Masukan (IDR)', 'Potongan PPh (IDR)']
      : []),
    'Nominal Kas Cair (IDR)',
    'Disetujui Oleh',
  ];

  const rows = report.transactions.map((tx) => [
    tx.requestNumber,
    (tx.disbursedAt ?? tx.updatedAt).slice(0, 10),
    deptLookup.get(tx.departmentId) ?? tx.departmentId,
    tx.requesterName,
    tx.category,
    tx.title,
    tx.vehiclePlate || '-',
    tx.receiptRef || '-',
    ...(showTax
      ? [
          tx.tax?.label ?? 'Non-Pajak',
          tx.tax?.dppAmount ?? tx.amount,
          tx.tax?.ppnAmount ?? 0,
          tx.tax?.pphAmount ?? 0,
        ]
      : []),
    tx.amount,
    tx.approval.approverName ?? 'Direktur',
  ]);

  const csvBody = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');

  return `\uFEFF${csvBody}`;
}

export function generateVehicleComparisonCsv(report: MonthlyReport): string {
  const headers = [
    'Periode Bulan Ini',
    'Periode Pembanding',
    'No. Polisi / Kelompok',
    'Jenis Unit',
    'Divisi',
    'Jumlah Transaksi',
    'BBM & Tol (IDR)',
    'Perawatan Armada (IDR)',
    'Biaya Lainnya (IDR)',
    'Total Bulan Ini (IDR)',
    'Total Bulan Lalu (IDR)',
    'Selisih (IDR)',
    'Perubahan (%)',
  ];

  const rows = report.byVehicle.map((v) => [
    report.monthKey,
    report.previousMonthKey,
    v.plateNumber,
    v.unitType,
    v.departmentName,
    v.transactionCount,
    v.fuelTollSpent,
    v.maintenanceSpent,
    v.otherSpent,
    v.totalSpent,
    v.prevTotalSpent,
    v.deltaAmount,
    v.deltaPct === null ? 'Baru' : `${v.deltaPct}%`,
  ]);

  const csvBody = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');

  return `\uFEFF${csvBody}`;
}
