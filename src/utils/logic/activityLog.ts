import type {
  ActivityLogActionType,
  ActivityLogEntityType,
  ActivityLogEntry,
  ActivityLogIntegrityIssue,
  ActivityLogIntegrityReport,
} from '../../types/pettycash.ts';
import { escapeCsvCell } from './constants.ts';

export const ACTIVITY_LOG_GENESIS_HASH = 'GENESIS';

export type HashHexSync = (payload: string) => string;
export type HashHexAsync = (payload: string) => Promise<string>;

export interface CreateActivityLogInput {
  id: string;
  actionType: ActivityLogActionType;
  entityType: ActivityLogEntityType;
  entityId: string;
  referenceNumber: string;
  title: string;
  departmentId: string;
  departmentName: string;
  requesterName: string;
  amount: number;
  decision: 'approve' | 'reject' | 'info' | 'warning';
  actorName: string;
  actorRole: string;
  note: string;
  timestamp: string;
}

export function canonicalizeActivityLogPayload(
  entry: Omit<ActivityLogEntry, 'entryHash'>
): string {
  return JSON.stringify([
    entry.id,
    entry.sequence,
    entry.actionType,
    entry.entityType,
    entry.entityId,
    entry.referenceNumber,
    entry.title,
    entry.departmentId,
    entry.departmentName,
    entry.requesterName,
    entry.amount,
    entry.decision,
    entry.actorName,
    entry.actorRole,
    entry.note,
    entry.timestamp,
    entry.previousHash,
  ]);
}

export function buildActivityLogEntry(
  input: CreateActivityLogInput,
  previousEntry: ActivityLogEntry | undefined,
  hashHex: HashHexSync
): ActivityLogEntry {
  const sequence = previousEntry ? previousEntry.sequence + 1 : 1;
  const previousHash = previousEntry
    ? previousEntry.entryHash
    : ACTIVITY_LOG_GENESIS_HASH;

  const unsignedEntry: Omit<ActivityLogEntry, 'entryHash'> = {
    id: input.id,
    sequence,
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId,
    referenceNumber: input.referenceNumber,
    title: input.title,
    departmentId: input.departmentId,
    departmentName: input.departmentName,
    requesterName: input.requesterName,
    amount: Math.round(input.amount),
    decision: input.decision,
    actorName: input.actorName.trim(),
    actorRole: input.actorRole.trim() || 'system',
    note: input.note.trim(),
    timestamp: input.timestamp,
    previousHash,
  };

  return {
    ...unsignedEntry,
    entryHash: hashHex(canonicalizeActivityLogPayload(unsignedEntry)),
  };
}

function validateLogStructureAndBuildIssues(
  sorted: ActivityLogEntry[],
  computedHashes: string[]
): ActivityLogIntegrityIssue[] {
  const issues: ActivityLogIntegrityIssue[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const entry = sorted[i];
    const expectedSequence = i + 1;
    const prev = i > 0 ? sorted[i - 1] : undefined;
    const expectedPrevHash = prev ? prev.entryHash : ACTIVITY_LOG_GENESIS_HASH;

    if (entry.sequence !== expectedSequence) {
      issues.push({
        sequence: entry.sequence,
        id: entry.id,
        reason: `Urutan log terputus (tercatat #${entry.sequence}, seharusnya #${expectedSequence}).`,
      });
    }

    if (!entry.actorName || !entry.actorName.trim()) {
      issues.push({
        sequence: entry.sequence,
        id: entry.id,
        reason: 'Identitas pengguna (actorName) kosong atau dihapus.',
      });
    }

    const parsedTime = Date.parse(entry.timestamp);
    if (!entry.timestamp || Number.isNaN(parsedTime)) {
      issues.push({
        sequence: entry.sequence,
        id: entry.id,
        reason: 'Timestamp tidak valid atau rusak.',
      });
    } else if (prev) {
      const prevTime = Date.parse(prev.timestamp);
      if (!Number.isNaN(prevTime) && parsedTime < prevTime) {
        issues.push({
          sequence: entry.sequence,
          id: entry.id,
          reason: `Timestamp (${entry.timestamp}) lebih awal dari entri sebelumnya (${prev.timestamp}).`,
        });
      }
    }

    if (entry.previousHash !== expectedPrevHash) {
      issues.push({
        sequence: entry.sequence,
        id: entry.id,
        reason: 'Tautan hash sebelumnya (previousHash) tidak cocok dengan entri pendahulu.',
      });
    }

    if (entry.entryHash !== computedHashes[i]) {
      issues.push({
        sequence: entry.sequence,
        id: entry.id,
        reason: 'Hash SHA-256 tidak cocok — isi catatan aktivitas kemungkinan telah diubah.',
      });
    }
  }

  return issues;
}

export function verifyActivityLogChainSync(
  entries: ActivityLogEntry[],
  hashHex: HashHexSync,
  verifiedAt: string = new Date().toISOString()
): ActivityLogIntegrityReport {
  const sorted = [...entries].sort((a, b) => a.sequence - b.sequence);
  const computedHashes = sorted.map((entry) => {
    const { entryHash: _ignored, ...unsigned } = entry;
    return hashHex(canonicalizeActivityLogPayload(unsigned));
  });

  const issues = validateLogStructureAndBuildIssues(sorted, computedHashes);
  const last = sorted[sorted.length - 1];

  return {
    valid: issues.length === 0,
    totalEntries: sorted.length,
    lastSequence: last ? last.sequence : 0,
    lastHash: last ? last.entryHash : ACTIVITY_LOG_GENESIS_HASH,
    verifiedAt,
    issues,
  };
}

export async function verifyActivityLogChainAsync(
  entries: ActivityLogEntry[],
  hashHexAsync: HashHexAsync,
  verifiedAt: string = new Date().toISOString()
): Promise<ActivityLogIntegrityReport> {
  const sorted = [...entries].sort((a, b) => a.sequence - b.sequence);
  const computedHashes = await Promise.all(
    sorted.map((entry) => {
      const { entryHash: _ignored, ...unsigned } = entry;
      return hashHexAsync(canonicalizeActivityLogPayload(unsigned));
    })
  );

  const issues = validateLogStructureAndBuildIssues(sorted, computedHashes);
  const last = sorted[sorted.length - 1];

  return {
    valid: issues.length === 0,
    totalEntries: sorted.length,
    lastSequence: last ? last.sequence : 0,
    lastHash: last ? last.entryHash : ACTIVITY_LOG_GENESIS_HASH,
    verifiedAt,
    issues,
  };
}

export function getActivityActionLabel(actionType: ActivityLogActionType): string {
  switch (actionType) {
    case 'request_approved':
      return 'Persetujuan Pengajuan';
    case 'request_rejected':
      return 'Penolakan Pengajuan';
    case 'kasbon_approved':
      return 'Persetujuan Kasbon';
    case 'kasbon_rejected':
      return 'Penolakan Kasbon';
    case 'auth_bootstrap':
      return 'Setup Admin Pertama';
    case 'auth_login':
      return 'Login Pengguna';
    case 'auth_login_failed':
      return 'Login Gagal / Rate Limit';
    case 'auth_token_refreshed':
      return 'Refresh Token Sesi';
    case 'auth_logout':
      return 'Logout Pengguna';
    case 'auth_session_expired':
      return 'Sesi Habis (Auto-Logout)';
    case 'rbac_role_created':
      return 'Buat Role RBAC';
    case 'rbac_role_updated':
      return 'Ubah Permission Role';
    case 'rbac_role_deleted':
      return 'Hapus Role RBAC';
    case 'rbac_user_created':
      return 'Tambah Akun Pengguna';
    case 'rbac_user_updated':
      return 'Ubah Role / Status User';
    case 'rbac_session_revoked':
      return 'Cabut Sesi Aktif';
    case 'security_policy_updated':
      return 'Ubah Kebijakan Keamanan';
  }
}

export function getActivityEntityLabel(entityType: ActivityLogEntityType): string {
  switch (entityType) {
    case 'petty_cash_request':
      return 'Petty Cash';
    case 'down_payment':
      return 'Kasbon';
    case 'auth_session':
      return 'Sesi & Auth';
    case 'rbac_policy':
      return 'Role & Keamanan';
    case 'user_account':
      return 'Akun Pengguna';
  }
}

export function generateActivityLogCsv(
  entries: ActivityLogEntry[],
  integrity: ActivityLogIntegrityReport
): string {
  const sortedDesc = [...entries].sort((a, b) => b.sequence - a.sequence);
  const lines: string[] = [
    [
      'Seq',
      'Timestamp_UTC',
      'Aksi',
      'Jenis_Dokumen',
      'No_Referensi',
      'Divisi',
      'Pemohon',
      'Judul_Keperluan',
      'Nominal_IDR',
      'Pengguna_Aktor',
      'Peran_Aktor',
      'Keputusan',
      'Catatan_Alasan',
      'Previous_Hash',
      'Entry_Hash_SHA256',
      'Status_Rantai',
    ]
      .map(escapeCsvCell)
      .join(','),
  ];

  const badSeqs = new Set(integrity.issues.map((i) => i.sequence));

  for (const e of sortedDesc) {
    const decisionText =
      e.decision === 'approve'
        ? 'Disetujui'
        : e.decision === 'reject'
        ? 'Ditolak'
        : e.decision === 'warning'
        ? 'Peringatan Keamanan'
        : 'Info Sistem';
    const roleLabel =
      e.actorRole === 'director'
        ? 'Direktur'
        : e.actorRole === 'staff'
        ? 'Staff'
        : e.actorRole;

    lines.push(
      [
        e.sequence,
        e.timestamp,
        getActivityActionLabel(e.actionType),
        getActivityEntityLabel(e.entityType),
        e.referenceNumber,
        e.departmentName,
        e.requesterName,
        e.title,
        e.amount,
        e.actorName,
        roleLabel,
        decisionText,
        e.note || '-',
        e.previousHash,
        e.entryHash,
        badSeqs.has(e.sequence) ? 'ANOMALI_HASH' : 'TERVERIFIKASI',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return lines.join('\r\n');
}

