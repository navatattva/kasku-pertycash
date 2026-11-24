import type {
  ExpenseCategory,
  FraudFlag,
  FraudGuardConfig,
  MasterCategory,
  PettyCashRequest,
} from '../../types/pettycash.ts';
import { normalizePersonName } from '../formatters.ts';

export interface FraudEvaluationInput {
  departmentId: string;
  requesterName: string;
  category: ExpenseCategory;
  vehicleId?: string;
  amount: number;
  receiptRef?: string;
  receiptImageUrl?: string;
}

export function evaluateFraudGuards(
  input: FraudEvaluationInput,
  config: FraudGuardConfig,
  existingRequests: PettyCashRequest[],
  categories: MasterCategory[],
  nowIso: string
): {
  blockingErrors: string[];
  warnings: FraudFlag[];
} {
  if (!config.enabled) {
    return { blockingErrors: [], warnings: [] };
  }

  const blockingErrors: string[] = [];
  const warnings: FraudFlag[] = [];
  const normalizedRef = (input.receiptRef ?? '').trim().toUpperCase();
  const normalizedRequester = normalizePersonName(input.requesterName).toLowerCase();
  const todayStr = nowIso.slice(0, 10);
  const nowMs = Date.parse(nowIso) || Date.now();
  const windowMs = Math.max(1, config.detectDuplicateClaimWindowHours) * 3600 * 1000;

  // 1. Mandatory receipt image guard
  if (
    config.requireReceiptImage &&
    input.amount >= config.receiptRequiredMinAmount &&
    !input.receiptImageUrl
  ) {
    const minNote =
      config.receiptRequiredMinAmount > 0
        ? ` untuk nominal ≥ Rp ${config.receiptRequiredMinAmount.toLocaleString('id-ID')}`
        : '';
    blockingErrors.push(
      `Guard Anti-Fraud: Foto nota/invoice wajib dilampirkan${minNote} agar pengajuan dapat diverifikasi Direktur.`
    );
  }

  // 2. Max single petty cash transaction limit (prevent large unapproved outflows)
  if (
    config.maxSingleRequestAmount > 0 &&
    input.amount > config.maxSingleRequestAmount
  ) {
    blockingErrors.push(
      `Guard Anti-Fraud: Nominal Rp ${input.amount.toLocaleString('id-ID')} melebihi batas maksimal per transaksi petty cash (Rp ${config.maxSingleRequestAmount.toLocaleString('id-ID')}). Pengeluaran besar wajib melalui PO/transfer bank perusahaan.`
    );
  }

  const activeRequests = existingRequests.filter((r) => r.status !== 'rejected');

  // 3. Duplicate receipt reference guard
  if (
    config.blockDuplicateReceiptRef &&
    normalizedRef.length > 0 &&
    normalizedRef !== '-'
  ) {
    const duplicateRef = activeRequests.find(
      (r) => r.receiptRef.trim().toUpperCase() === normalizedRef
    );
    if (duplicateRef) {
      blockingErrors.push(
        `Guard Anti-Fraud: Nomor bukti/surat jalan "${normalizedRef}" sudah pernah dipakai pada ${duplicateRef.requestNumber} (${duplicateRef.requesterName}).`
      );
    }
  }

  // 4. Duplicate amount claim within N hours (same department + same requester or vehicle)
  const dupWindowMatch = activeRequests.find((r) => {
    if (r.departmentId !== input.departmentId || r.amount !== input.amount) {
      return false;
    }
    const reqMs = Date.parse(r.createdAt);
    if (!Number.isFinite(reqMs) || Math.abs(nowMs - reqMs) > windowMs) {
      return false;
    }
    const samePerson =
      normalizePersonName(r.requesterName).toLowerCase() === normalizedRequester;
    const sameVehicle = Boolean(input.vehicleId && r.vehicleId === input.vehicleId);
    return samePerson || sameVehicle;
  });

  if (dupWindowMatch) {
    warnings.push({
      code: 'SAME_WINDOW_DUPLICATE_CLAIM',
      severity: 'warning',
      title: 'Indikasi Klaim Nominal Identik',
      detail: `Nominal Rp ${input.amount.toLocaleString('id-ID')} sama persis dengan ${dupWindowMatch.requestNumber} dalam ${config.detectDuplicateClaimWindowHours} jam terakhir.`,
    });
  }

  // 5. Split-transaction ("pecah nota") detection on same day by same requester
  const sameDayByRequester = activeRequests.filter(
    (r) =>
      r.departmentId === input.departmentId &&
      r.createdAt.startsWith(todayStr) &&
      normalizePersonName(r.requesterName).toLowerCase() === normalizedRequester
  );
  if (sameDayByRequester.length >= 1) {
    const combinedToday =
      sameDayByRequester.reduce((s, r) => s + r.amount, 0) + input.amount;
    if (combinedToday >= config.highValueAlertAmount) {
      warnings.push({
        code: 'SPLIT_TRANSACTION_SUSPECT',
        severity: 'warning',
        title: 'Indikasi Pecah Nota (Split Claim)',
        detail: `${sameDayByRequester.length + 1} pengajuan hari ini oleh ${normalizePersonName(input.requesterName)} dengan total kumulatif Rp ${combinedToday.toLocaleString('id-ID')}.`,
      });
    }
  }

  // 6. Same vehicle + same category claimed twice on same day
  if (input.vehicleId) {
    const sameVehicleSameDay = activeRequests.find(
      (r) =>
        r.vehicleId === input.vehicleId &&
        r.category === input.category &&
        r.createdAt.startsWith(todayStr)
    );
    if (sameVehicleSameDay) {
      warnings.push({
        code: 'VEHICLE_SAME_DAY_CLAIM',
        severity: 'warning',
        title: 'Klaim Armada Berulang di Hari Sama',
        detail: `Unit armada ini sudah memiliki pengajuan ${input.category} hari ini (${sameVehicleSameDay.requestNumber}).`,
      });
    }
  }

  // 7. Missing fleet unit for vehicle-required category (catches "phantom truck" claims)
  const catMeta = categories.find((c) => c.name === input.category);
  if (catMeta?.requiresVehicle && !input.vehicleId) {
    warnings.push({
      code: 'MISSING_FLEET_UNIT',
      severity: 'warning',
      title: 'Armada Belum Dipilih',
      detail: `Kategori "${input.category}" seharusnya dikaitkan ke nomor polisi truk terdaftar.`,
    });
  }

  // 8. High-value transaction alert
  if (
    config.highValueAlertAmount > 0 &&
    input.amount >= config.highValueAlertAmount
  ) {
    warnings.push({
      code: 'HIGH_VALUE_ALERT',
      severity: 'warning',
      title: 'Transaksi Bernilai Tinggi',
      detail: `Nominal ≥ Rp ${config.highValueAlertAmount.toLocaleString('id-ID')}; pastikan nota fisik & surat jalan diperiksa teliti.`,
    });
  }

  return { blockingErrors, warnings };
}

export function auditExistingRequestFraudSignals(
  request: PettyCashRequest,
  config: FraudGuardConfig,
  allRequests: PettyCashRequest[],
  categories: MasterCategory[]
): FraudFlag[] {
  if (!config.enabled) return [];

  const others = allRequests.filter((r) => r.id !== request.id);
  const evalRes = evaluateFraudGuards(
    {
      departmentId: request.departmentId,
      requesterName: request.requesterName,
      category: request.category,
      vehicleId: request.vehicleId,
      amount: request.amount,
      receiptRef: request.receiptRef,
      receiptImageUrl: request.receiptImageUrl,
    },
    config,
    others,
    categories,
    request.createdAt
  );

  const flags: FraudFlag[] = [...evalRes.warnings];

  if (
    config.requireReceiptImage &&
    request.amount >= config.receiptRequiredMinAmount &&
    !request.receiptImageUrl
  ) {
    flags.unshift({
      code: 'MISSING_RECEIPT_IMAGE',
      severity: 'warning',
      title: 'Belum Ada Foto Nota',
      detail:
        'Pengajuan ini tidak memiliki lampiran foto nota/struk untuk verifikasi visual.',
    });
  }

  // Deduplicate by code
  const seen = new Set<string>();
  return flags.filter((f) => {
    if (seen.has(f.code)) return false;
    seen.add(f.code);
    return true;
  });
}

export function checkSelfApprovalGuard(
  requesterName: string,
  approverName: string,
  config: FraudGuardConfig
): { ok: boolean; error?: string } {
  if (!config.enabled || !config.preventSelfApproval) {
    return { ok: true };
  }
  const clean = (s: string) =>
    normalizePersonName(s.replace(/\([^)]*\)/g, '')).toLowerCase();
  const reqClean = clean(requesterName);
  const appClean = clean(approverName);
  if (reqClean && appClean && reqClean === appClean) {
    return {
      ok: false,
      error:
        'Guard Anti-Fraud (Segregation of Duties): Pemohon tidak diperbolehkan menyetujui pengajuannya sendiri.',
    };
  }
  return { ok: true };
}
