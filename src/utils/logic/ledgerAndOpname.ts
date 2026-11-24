import {
  INDONESIAN_DENOMINATIONS,
  type CashLedgerEntry,
  type CashLedgerSummary,
  type DenominationCount,
  type Department,
  type DownPaymentRecord,
  type PettyCashRequest,
  type TopUpRecord,
} from '../../types/pettycash.ts';
import { normalizePersonName } from '../formatters.ts';
import { escapeCsvCell } from './constants.ts';

export function buildCashLedger(
  departments: Department[],
  requests: PettyCashRequest[],
  topUps: TopUpRecord[],
  filterDepartmentId?: string,
  filterMonthKey?: string,
  downPayments: DownPaymentRecord[] = []
): CashLedgerSummary {
  const scopedDepartments =
    filterDepartmentId && filterDepartmentId !== 'all'
      ? departments.filter((d) => d.id === filterDepartmentId)
      : departments;
  const scopedIds = new Set(scopedDepartments.map((d) => d.id));
  const deptNameMap = new Map(departments.map((d) => [d.id, d.name]));

  type RawLedgerItem = Omit<CashLedgerEntry, 'runningBalance'>;
  const rawItems: RawLedgerItem[] = [];

  for (const t of topUps) {
    if (!scopedIds.has(t.departmentId)) continue;
    rawItems.push({
      id: `topup-${t.id}`,
      date: t.createdAt,
      type: 'topup',
      referenceNumber: 'TOP-UP',
      departmentId: t.departmentId,
      departmentName: deptNameMap.get(t.departmentId) ?? t.departmentId,
      categoryOrSource: 'Pengisian Saldo',
      description: t.note,
      actor: t.performedBy,
      debit: t.amount,
      credit: 0,
    });
  }

  for (const r of requests) {
    if (r.status !== 'approved' || !scopedIds.has(r.departmentId)) continue;
    rawItems.push({
      id: `req-${r.id}`,
      date: r.disbursedAt ?? r.updatedAt,
      type: 'disbursement',
      referenceNumber: r.requestNumber,
      departmentId: r.departmentId,
      departmentName: deptNameMap.get(r.departmentId) ?? r.departmentId,
      categoryOrSource: r.category,
      description: r.vehiclePlate ? `${r.title} (${r.vehiclePlate})` : r.title,
      actor: r.requesterName,
      debit: 0,
      credit: r.amount,
      receiptImageUrl: r.receiptImageUrl,
    });
  }

  for (const dp of downPayments) {
    if (!scopedIds.has(dp.departmentId)) continue;
    if (dp.status === 'open' || dp.status === 'settled') {
      rawItems.push({
        id: `dp-out-${dp.id}`,
        date: dp.disbursedAt ?? dp.updatedAt,
        type: 'kasbon_out',
        referenceNumber: dp.dpNumber,
        departmentId: dp.departmentId,
        departmentName: deptNameMap.get(dp.departmentId) ?? dp.departmentId,
        categoryOrSource: `Kasbon · ${dp.category}`,
        description: dp.vehiclePlate
          ? `Uang Muka: ${dp.title} (${dp.vehiclePlate})`
          : `Uang Muka: ${dp.title}`,
        actor: dp.requesterName,
        debit: 0,
        credit: dp.requestedAmount,
      });
    }
    if (dp.status === 'settled' && dp.settlement) {
      if (dp.settlement.differenceType === 'refund' && dp.settlement.differenceAmount > 0) {
        rawItems.push({
          id: `dp-ref-${dp.id}`,
          date: dp.settlement.settledAt,
          type: 'kasbon_refund',
          referenceNumber: `${dp.dpNumber}-SET`,
          departmentId: dp.departmentId,
          departmentName: deptNameMap.get(dp.departmentId) ?? dp.departmentId,
          categoryOrSource: 'Pengembalian Sisa Kasbon',
          description: `Sisa kasbon ${dp.dpNumber} (${dp.settlement.receiptRef})`,
          actor: dp.requesterName,
          debit: dp.settlement.differenceAmount,
          credit: 0,
          receiptImageUrl: dp.settlement.receiptImageUrl,
        });
      } else if (
        dp.settlement.differenceType === 'reimburse' &&
        dp.settlement.differenceAmount < 0
      ) {
        rawItems.push({
          id: `dp-rem-${dp.id}`,
          date: dp.settlement.settledAt,
          type: 'kasbon_reimburse',
          referenceNumber: `${dp.dpNumber}-SET`,
          departmentId: dp.departmentId,
          departmentName: deptNameMap.get(dp.departmentId) ?? dp.departmentId,
          categoryOrSource: 'Kekurangan Realisasi Kasbon',
          description: `Tambah kurang bayar ${dp.dpNumber} (${dp.settlement.receiptRef})`,
          actor: dp.requesterName,
          debit: 0,
          credit: Math.abs(dp.settlement.differenceAmount),
          receiptImageUrl: dp.settlement.receiptImageUrl,
        });
      }
    }
  }

  rawItems.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );

  const currentBookBalance = scopedDepartments.reduce(
    (sum, d) => sum + d.balance,
    0
  );
  const netRecordedDelta = rawItems.reduce(
    (sum, item) => sum + item.debit - item.credit,
    0
  );
  const baseOpeningBalance = currentBookBalance - netRecordedDelta;

  let running = baseOpeningBalance;
  const withRunning: CashLedgerEntry[] = rawItems.map((item) => {
    running += item.debit - item.credit;
    return {
      ...item,
      runningBalance: running,
    };
  });

  if (filterMonthKey && filterMonthKey !== 'all') {
    const firstIdx = withRunning.findIndex((e) =>
      e.date.startsWith(filterMonthKey)
    );
    const openingBeforeMonth =
      firstIdx === -1
        ? withRunning.length > 0 &&
          withRunning[withRunning.length - 1].date.slice(0, 7) < filterMonthKey
          ? withRunning[withRunning.length - 1].runningBalance
          : baseOpeningBalance
        : firstIdx === 0
        ? baseOpeningBalance
        : withRunning[firstIdx - 1].runningBalance;

    const filtered = withRunning.filter((e) =>
      e.date.startsWith(filterMonthKey)
    );
    const totalInflow = filtered.reduce((s, e) => s + e.debit, 0);
    const totalOutflow = filtered.reduce((s, e) => s + e.credit, 0);
    const closingBalance = openingBeforeMonth + totalInflow - totalOutflow;

    return {
      openingBalance: openingBeforeMonth,
      totalInflow,
      totalOutflow,
      closingBalance,
      entries: filtered.slice().reverse(),
    };
  }

  const totalInflow = withRunning.reduce((s, e) => s + e.debit, 0);
  const totalOutflow = withRunning.reduce((s, e) => s + e.credit, 0);

  return {
    openingBalance: baseOpeningBalance,
    totalInflow,
    totalOutflow,
    closingBalance: currentBookBalance,
    entries: withRunning.slice().reverse(),
  };
}

export function generateCashLedgerCsv(
  ledger: CashLedgerSummary,
  scopeLabel: string
): string {
  const headers = [
    'Tanggal',
    'Tipe Mutasi',
    'No. Referensi',
    'Divisi',
    'Sumber / Kategori',
    'Keterangan',
    'Petugas / Pemohon',
    'Masuk / Debit (IDR)',
    'Keluar / Kredit (IDR)',
    'Saldo Berjalan (IDR)',
  ];

  const typeLabels: Record<CashLedgerEntry['type'], string> = {
    topup: 'KAS MASUK (TOP-UP)',
    disbursement: 'KAS KELUAR (PENCAIRAN)',
    kasbon_out: 'KASBON KELUAR (UANG MUKA)',
    kasbon_refund: 'MASUK SISA KASBON',
    kasbon_reimburse: 'KURANG BAYAR KASBON',
  };

  const chronological = ledger.entries.slice().reverse();
  const rows = [
    [
      '-',
      'SALDO AWAL',
      scopeLabel,
      scopeLabel,
      '-',
      'Saldo awal sebelum mutasi periode ini',
      '-',
      0,
      0,
      ledger.openingBalance,
    ],
    ...chronological.map((e) => [
      e.date.slice(0, 16).replace('T', ' '),
      typeLabels[e.type] ?? e.type,
      e.referenceNumber,
      e.departmentName,
      e.categoryOrSource,
      e.description,
      e.actor,
      e.debit,
      e.credit,
      e.runningBalance,
    ]),
  ];

  const csvBody = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');

  return `\uFEFF${csvBody}`;
}

export function calculateOpnameSummary(
  systemBalance: number,
  rawCounts: Partial<Record<number, number>> | DenominationCount[]
): {
  denominations: DenominationCount[];
  physicalTotal: number;
  variance: number;
  status: 'matched' | 'over' | 'short';
} {
  const countMap = new Map<number, number>();
  if (Array.isArray(rawCounts)) {
    for (const item of rawCounts) {
      if (Number.isInteger(item.count) && item.count >= 0) {
        countMap.set(item.denomination, item.count);
      }
    }
  } else {
    for (const denom of INDONESIAN_DENOMINATIONS) {
      const val = rawCounts[denom] ?? 0;
      if (Number.isInteger(val) && val >= 0) {
        countMap.set(denom, val);
      }
    }
  }

  const denominations: DenominationCount[] = INDONESIAN_DENOMINATIONS.map(
    (denomination) => {
      const count = countMap.get(denomination) ?? 0;
      return {
        denomination,
        count,
        subtotal: denomination * count,
      };
    }
  );

  const physicalTotal = denominations.reduce((sum, d) => sum + d.subtotal, 0);
  const variance = physicalTotal - systemBalance;
  const status: 'matched' | 'over' | 'short' =
    variance === 0 ? 'matched' : variance > 0 ? 'over' : 'short';

  return {
    denominations,
    physicalTotal,
    variance,
    status,
  };
}

export function validateCashOpnameInput(params: {
  department: Department | undefined;
  countedBy: string;
  note: string;
  denominations: { denomination: number; count: number }[];
}): {
  valid: boolean;
  error?: string;
  summary?: ReturnType<typeof calculateOpnameSummary>;
  countedBy?: string;
  note?: string;
} {
  if (!params.department) {
    return { valid: false, error: 'Divisi untuk cash opname tidak ditemukan.' };
  }
  const countedBy = normalizePersonName(params.countedBy);
  if (countedBy.length < 2 || countedBy.length > 80) {
    return {
      valid: false,
      error: 'Nama petugas penghitung kas wajib diisi (2–80 karakter).',
    };
  }
  for (const item of params.denominations) {
    if (!Number.isInteger(item.count) || item.count < 0 || item.count > 100_000) {
      return {
        valid: false,
        error: 'Jumlah lembar/keping pecahan harus angka bulat non-negatif.',
      };
    }
  }

  const summary = calculateOpnameSummary(
    params.department.balance,
    params.denominations.map((d) => ({
      denomination: d.denomination,
      count: d.count,
      subtotal: d.denomination * d.count,
    }))
  );

  const trimmedNote = params.note.trim();
  if (summary.variance !== 0 && trimmedNote.length < 3) {
    return {
      valid: false,
      error:
        'Catatan penjelasan selisih wajib diisi (minimal 3 karakter) karena total fisik berbeda dari saldo sistem.',
    };
  }

  return {
    valid: true,
    summary,
    countedBy,
    note:
      trimmedNote ||
      'Saldo fisik kas sesuai dengan saldo buku sistem.',
  };
}
