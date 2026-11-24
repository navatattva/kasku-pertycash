import crypto from 'node:crypto';
import type {
  ActivityLogEntry,
  ActivityLogIntegrityReport,
  Department,
  DownPaymentRecord,
  PettyCashRequest,
} from '../src/types/pettycash.ts';
import {
  buildActivityLogEntry,
  verifyActivityLogChainSync,
  type CreateActivityLogInput,
} from '../src/utils/pettycashLogic.ts';

export function sha256HexNode(payload: string): string {
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function verifyActivityLogsIntegrity(
  entries: ActivityLogEntry[]
): ActivityLogIntegrityReport {
  return verifyActivityLogChainSync(
    entries,
    sha256HexNode,
    new Date().toISOString()
  );
}

export function buildSeededActivityLogs(params: {
  departments: Department[];
  requests: PettyCashRequest[];
  downPayments: DownPaymentRecord[];
}): ActivityLogEntry[] {
  const deptMap = new Map(params.departments.map((d) => [d.id, d.name]));

  const historicalInputs: Omit<CreateActivityLogInput, 'id'>[] = [];

  for (const req of params.requests) {
    if (
      (req.approval.status === 'approved' ||
        req.approval.status === 'rejected') &&
      req.approval.decidedAt &&
      req.approval.approverName
    ) {
      const decision =
        req.approval.status === 'approved' ? 'approve' : 'reject';
      historicalInputs.push({
        actionType:
          decision === 'approve' ? 'request_approved' : 'request_rejected',
        entityType: 'petty_cash_request',
        entityId: req.id,
        referenceNumber: req.requestNumber,
        title: req.title,
        departmentId: req.departmentId,
        departmentName: deptMap.get(req.departmentId) ?? req.departmentId,
        requesterName: req.requesterName,
        amount: req.amount,
        decision,
        actorName: req.approval.approverName,
        actorRole: 'director',
        note: req.approval.note ?? '',
        timestamp: req.approval.decidedAt,
      });
    }
  }

  for (const dp of params.downPayments) {
    if (
      (dp.approval.status === 'approved' || dp.approval.status === 'rejected') &&
      dp.approval.decidedAt &&
      dp.approval.approverName
    ) {
      const decision = dp.approval.status === 'approved' ? 'approve' : 'reject';
      historicalInputs.push({
        actionType:
          decision === 'approve' ? 'kasbon_approved' : 'kasbon_rejected',
        entityType: 'down_payment',
        entityId: dp.id,
        referenceNumber: dp.dpNumber,
        title: dp.title,
        departmentId: dp.departmentId,
        departmentName: deptMap.get(dp.departmentId) ?? dp.departmentId,
        requesterName: dp.requesterName,
        amount: dp.requestedAmount,
        decision,
        actorName: dp.approval.approverName,
        actorRole: 'director',
        note: dp.approval.note ?? '',
        timestamp: dp.approval.decidedAt,
      });
    }
  }

  historicalInputs.sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
  );

  const chainAsc: ActivityLogEntry[] = [];
  for (let i = 0; i < historicalInputs.length; i += 1) {
    const prev = chainAsc[chainAsc.length - 1];
    const entry = buildActivityLogEntry(
      {
        ...historicalInputs[i],
        id: `act-seed-${String(i + 1).padStart(3, '0')}`,
      },
      prev,
      sha256HexNode
    );
    chainAsc.push(entry);
  }

  return chainAsc.reverse();
}
