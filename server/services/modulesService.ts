import crypto from 'node:crypto';
import type {
  ColdForecastMethod,
  ForecastModuleConfig,
  FraudGuardConfig,
  TaxModuleConfig,
  WhatsAppDispatchLog,
  WhatsAppModuleConfig,
} from '../../src/types/pettycash.ts';
import {
  buildWhatsAppDeepLink,
  isValidIndonesianWhatsAppPhone,
  normalizeWhatsAppPhone,
} from '../../src/utils/pettycashLogic.ts';
import { memoryDb, writeDbAtomically } from '../db.ts';

export function updateTaxModuleConfig(params: {
  enabled?: boolean;
  enablePpn?: boolean;
  enablePph23?: boolean;
  enablePph21?: boolean;
}): { ok: boolean; error?: string; taxModule?: TaxModuleConfig } {
  const next: TaxModuleConfig = {
    enabled:
      typeof params.enabled === 'boolean'
        ? params.enabled
        : memoryDb.taxModule.enabled,
    enablePpn:
      typeof params.enablePpn === 'boolean'
        ? params.enablePpn
        : memoryDb.taxModule.enablePpn,
    enablePph23:
      typeof params.enablePph23 === 'boolean'
        ? params.enablePph23
        : memoryDb.taxModule.enablePph23,
    enablePph21:
      typeof params.enablePph21 === 'boolean'
        ? params.enablePph21
        : memoryDb.taxModule.enablePph21,
    updatedAt: new Date().toISOString(),
  };

  if (
    next.enabled &&
    !next.enablePpn &&
    !next.enablePph23 &&
    !next.enablePph21
  ) {
    return {
      ok: false,
      error:
        'Pilih minimal satu jenis pajak (PPN, PPh 23, atau PPh 21) saat modul pajak diaktifkan.',
    };
  }

  memoryDb.taxModule = next;
  writeDbAtomically(memoryDb);
  return { ok: true, taxModule: next };
}

const VALID_COLD_METHODS = new Set<ColdForecastMethod>([
  'budget_baseline',
  'hybrid_historical',
  'zero_conservative',
]);

export function updateForecastModuleConfig(params: {
  enabled?: boolean;
  coldStartMethod?: ColdForecastMethod;
  budgetUtilizationAssumptionPct?: number;
  horizonDays?: number;
}): { ok: boolean; error?: string; forecastModule?: ForecastModuleConfig } {
  const nextMethod =
    params.coldStartMethod !== undefined
      ? params.coldStartMethod
      : memoryDb.forecastModule.coldStartMethod;
  if (!VALID_COLD_METHODS.has(nextMethod)) {
    return { ok: false, error: 'Metode cold-start forecast tidak dikenal.' };
  }

  const nextAssumption =
    params.budgetUtilizationAssumptionPct !== undefined
      ? params.budgetUtilizationAssumptionPct
      : memoryDb.forecastModule.budgetUtilizationAssumptionPct;
  if (
    !Number.isInteger(nextAssumption) ||
    nextAssumption < 10 ||
    nextAssumption > 100
  ) {
    return {
      ok: false,
      error: 'Asumsi serapan plafon cold-start harus bilangan bulat 10%–100%.',
    };
  }

  const nextHorizon =
    params.horizonDays !== undefined
      ? params.horizonDays
      : memoryDb.forecastModule.horizonDays;
  if (nextHorizon !== 14 && nextHorizon !== 30 && nextHorizon !== 60) {
    return {
      ok: false,
      error: 'Horizon proyeksi hanya mendukung 14, 30, atau 60 hari.',
    };
  }

  const next: ForecastModuleConfig = {
    enabled:
      typeof params.enabled === 'boolean'
        ? params.enabled
        : memoryDb.forecastModule.enabled,
    coldStartMethod: nextMethod,
    budgetUtilizationAssumptionPct: nextAssumption,
    horizonDays: nextHorizon,
    updatedAt: new Date().toISOString(),
  };

  memoryDb.forecastModule = next;
  writeDbAtomically(memoryDb);
  return { ok: true, forecastModule: next };
}

export function updateFraudGuardConfig(params: {
  enabled?: boolean;
  requireReceiptImage?: boolean;
  receiptRequiredMinAmount?: number;
  blockDuplicateReceiptRef?: boolean;
  preventSelfApproval?: boolean;
  detectDuplicateClaimWindowHours?: number;
  highValueAlertAmount?: number;
  maxSingleRequestAmount?: number;
}): { ok: boolean; error?: string; fraudGuard?: FraudGuardConfig } {
  const receiptMin =
    params.receiptRequiredMinAmount !== undefined
      ? params.receiptRequiredMinAmount
      : memoryDb.fraudGuard.receiptRequiredMinAmount;
  if (!Number.isInteger(receiptMin) || receiptMin < 0) {
    return {
      ok: false,
      error: 'Batas minimal wajib foto nota harus angka bulat ≥ Rp 0.',
    };
  }

  const windowHrs =
    params.detectDuplicateClaimWindowHours !== undefined
      ? params.detectDuplicateClaimWindowHours
      : memoryDb.fraudGuard.detectDuplicateClaimWindowHours;
  if (!Number.isInteger(windowHrs) || windowHrs < 1 || windowHrs > 168) {
    return {
      ok: false,
      error: 'Jendela deteksi klaim ganda harus antara 1 hingga 168 jam.',
    };
  }

  const highAlert =
    params.highValueAlertAmount !== undefined
      ? params.highValueAlertAmount
      : memoryDb.fraudGuard.highValueAlertAmount;
  if (!Number.isInteger(highAlert) || highAlert < 0) {
    return {
      ok: false,
      error: 'Batas peringatan transaksi bernilai tinggi tidak valid.',
    };
  }

  const maxSingle =
    params.maxSingleRequestAmount !== undefined
      ? params.maxSingleRequestAmount
      : memoryDb.fraudGuard.maxSingleRequestAmount;
  if (!Number.isInteger(maxSingle) || maxSingle < 0) {
    return {
      ok: false,
      error: 'Batas maksimal nominal per transaksi tidak valid.',
    };
  }

  const next: FraudGuardConfig = {
    enabled:
      typeof params.enabled === 'boolean'
        ? params.enabled
        : memoryDb.fraudGuard.enabled,
    requireReceiptImage:
      typeof params.requireReceiptImage === 'boolean'
        ? params.requireReceiptImage
        : memoryDb.fraudGuard.requireReceiptImage,
    receiptRequiredMinAmount: receiptMin,
    blockDuplicateReceiptRef:
      typeof params.blockDuplicateReceiptRef === 'boolean'
        ? params.blockDuplicateReceiptRef
        : memoryDb.fraudGuard.blockDuplicateReceiptRef,
    preventSelfApproval:
      typeof params.preventSelfApproval === 'boolean'
        ? params.preventSelfApproval
        : memoryDb.fraudGuard.preventSelfApproval,
    detectDuplicateClaimWindowHours: windowHrs,
    highValueAlertAmount: highAlert,
    maxSingleRequestAmount: maxSingle,
    updatedAt: new Date().toISOString(),
  };

  memoryDb.fraudGuard = next;
  writeDbAtomically(memoryDb);
  return { ok: true, fraudGuard: next };
}

export function updateWhatsAppModuleConfig(params: {
  enabled?: boolean;
  directorPhone?: string;
  autoSendOnNewRequest?: boolean;
  autoSendOnDecision?: boolean;
  lowBalanceReminder?: boolean;
}): { ok: boolean; error?: string; whatsappModule?: WhatsAppModuleConfig } {
  let nextPhone = memoryDb.whatsappModule.directorPhone;
  if (params.directorPhone !== undefined) {
    if (!isValidIndonesianWhatsAppPhone(params.directorPhone)) {
      return {
        ok: false,
        error:
          'Nomor WhatsApp Direktur tidak valid. Gunakan format 08xx atau 628xx (10–15 digit).',
      };
    }
    nextPhone = normalizeWhatsAppPhone(params.directorPhone);
  }

  const next: WhatsAppModuleConfig = {
    enabled:
      typeof params.enabled === 'boolean'
        ? params.enabled
        : memoryDb.whatsappModule.enabled,
    directorPhone: nextPhone,
    autoSendOnNewRequest:
      typeof params.autoSendOnNewRequest === 'boolean'
        ? params.autoSendOnNewRequest
        : memoryDb.whatsappModule.autoSendOnNewRequest,
    autoSendOnDecision:
      typeof params.autoSendOnDecision === 'boolean'
        ? params.autoSendOnDecision
        : memoryDb.whatsappModule.autoSendOnDecision,
    lowBalanceReminder:
      typeof params.lowBalanceReminder === 'boolean'
        ? params.lowBalanceReminder
        : memoryDb.whatsappModule.lowBalanceReminder,
    updatedAt: new Date().toISOString(),
  };

  memoryDb.whatsappModule = next;
  writeDbAtomically(memoryDb);
  return { ok: true, whatsappModule: next };
}

export function dispatchWhatsAppNotification(params: {
  eventType: 'new_request' | 'decision' | 'low_balance' | 'manual_test';
  referenceNumber: string;
  messagePreview: string;
  recipientPhone?: string;
  status?: 'queued' | 'sent';
}): { ok: boolean; error?: string; log?: WhatsAppDispatchLog } {
  if (!memoryDb.whatsappModule.enabled) {
    return {
      ok: false,
      error:
        'Modul Notifikasi WhatsApp sedang nonaktif. Aktifkan terlebih dahulu di Pusat Modul.',
    };
  }
  const phone = normalizeWhatsAppPhone(
    params.recipientPhone || memoryDb.whatsappModule.directorPhone
  );
  if (!isValidIndonesianWhatsAppPhone(phone)) {
    return {
      ok: false,
      error: 'Nomor WhatsApp tujuan tidak valid.',
    };
  }
  const messagePreview = params.messagePreview.trim().slice(0, 1200);
  if (messagePreview.length < 5) {
    return { ok: false, error: 'Isi pesan WhatsApp terlalu pendek.' };
  }

  const log: WhatsAppDispatchLog = {
    id: `wa-${crypto.randomUUID().slice(0, 8)}`,
    eventType: params.eventType,
    recipientPhone: phone,
    referenceNumber: params.referenceNumber.trim().slice(0, 40) || 'UMUM',
    messagePreview,
    waLink: buildWhatsAppDeepLink(phone, messagePreview),
    status: params.status ?? 'sent',
    createdAt: new Date().toISOString(),
  };

  memoryDb.whatsappLogs = [log, ...memoryDb.whatsappLogs].slice(0, 50);
  writeDbAtomically(memoryDb);
  return { ok: true, log };
}
