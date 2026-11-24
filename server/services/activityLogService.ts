import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ActivityLogEntry } from '../../src/types/pettycash.ts';
import {
  buildActivityLogEntry,
  type CreateActivityLogInput,
} from '../../src/utils/pettycashLogic.ts';
import {
  sha256HexNode,
  verifyActivityLogsIntegrity,
} from '../activityLogUtils.ts';
import { DATA_DIR, memoryDb } from '../db.ts';

const AUDIT_JOURNAL_FILE = path.join(DATA_DIR, 'activity-audit-journal.jsonl');

export { verifyActivityLogsIntegrity };

function getLatestEntry(entries: ActivityLogEntry[]): ActivityLogEntry | undefined {
  if (entries.length === 0) return undefined;
  return entries.reduce((latest, current) =>
    current.sequence > latest.sequence ? current : latest
  );
}

function appendAuditJournalLine(entry: ActivityLogEntry): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.appendFileSync(AUDIT_JOURNAL_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    // Non-fatal fallback if journal file is temporarily unavailable
  }
}

export function appendAuditTrailLog(
  input: Omit<CreateActivityLogInput, 'id'>
): ActivityLogEntry {
  const prev = getLatestEntry(memoryDb.activityLogs);
  const entry = buildActivityLogEntry(
    {
      ...input,
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
    },
    prev,
    sha256HexNode
  );
  memoryDb.activityLogs = [entry, ...memoryDb.activityLogs];
  appendAuditJournalLine(entry);
  return entry;
}

export function appendApprovalActivityLog(
  input: Omit<CreateActivityLogInput, 'id'>
): ActivityLogEntry {
  return appendAuditTrailLog(input);
}
