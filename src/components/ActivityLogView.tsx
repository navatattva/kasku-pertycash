import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  ActivityLogEntityType,
  ActivityLogEntry,
  ActivityLogIntegrityReport,
  PermissionKey,
  RbacRole,
} from '../types/pettycash.ts';
import {
  formatDateTimeWithSeconds,
  formatIDR,
} from '../utils/formatters.ts';
import {
  ACTIVITY_LOG_GENESIS_HASH,
  ROLE_LABELS,
  generateActivityLogCsv,
  getActivityActionLabel,
  hasPermission,
  verifyActivityLogChainAsync,
} from '../utils/pettycashLogic.ts';

interface ActivityLogViewProps {
  activityLogs: ActivityLogEntry[];
  integrity: ActivityLogIntegrityReport;
  userPermissions: readonly PermissionKey[];
  roles?: RbacRole[];
}

type DecisionFilter = 'all' | 'approve' | 'reject' | 'info' | 'warning';
type EntityFilter = 'all' | ActivityLogEntityType;

async function sha256HexBrowser(payload: string): Promise<string> {
  const bytes = new TextEncoder().encode(payload);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function ActivityLogView({
  activityLogs,
  integrity,
  userPermissions,
  roles = [],
}: ActivityLogViewProps) {
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [search, setSearch] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [clientVerification, setClientVerification] = useState<{
    entryCount: number;
    lastHash: string;
    report: ActivityLogIntegrityReport;
  } | null>(null);

  const canExportCsv = hasPermission(userPermissions, 'activity_log:export');

  const roleNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [slug, label] of Object.entries(ROLE_LABELS)) {
      map.set(slug, label);
    }
    for (const r of roles) {
      map.set(r.slug, r.name);
      map.set(r.id, r.name);
    }
    return map;
  }, [roles]);

  const activeIntegrity =
    clientVerification &&
    clientVerification.entryCount === activityLogs.length &&
    clientVerification.lastHash ===
      (activityLogs[0]?.entryHash ?? ACTIVITY_LOG_GENESIS_HASH)
      ? clientVerification.report
      : integrity;

  const sortedLogs = useMemo(
    () => [...activityLogs].sort((a, b) => b.sequence - a.sequence),
    [activityLogs]
  );

  const stats = useMemo(() => {
    let approveCount = 0;
    let approveAmount = 0;
    let rejectCount = 0;
    let rejectAmount = 0;
    let securityCount = 0;
    let warningCount = 0;
    for (const log of activityLogs) {
      if (log.decision === 'approve') {
        approveCount += 1;
        approveAmount += log.amount;
      } else if (log.decision === 'reject') {
        rejectCount += 1;
        rejectAmount += log.amount;
      } else if (log.decision === 'warning') {
        warningCount += 1;
        securityCount += 1;
      } else {
        securityCount += 1;
      }
    }
    return {
      approveCount,
      approveAmount,
      rejectCount,
      rejectAmount,
      securityCount,
      warningCount,
    };
  }, [activityLogs]);

  const issueSeqSet = useMemo(
    () => new Set(activeIntegrity.issues.map((i) => i.sequence)),
    [activeIntegrity.issues]
  );

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortedLogs.filter((entry) => {
      if (decisionFilter !== 'all' && entry.decision !== decisionFilter) {
        return false;
      }
      if (entityFilter !== 'all' && entry.entityType !== entityFilter) {
        return false;
      }
      if (query) {
        return (
          entry.referenceNumber.toLowerCase().includes(query) ||
          entry.actorName.toLowerCase().includes(query) ||
          entry.requesterName.toLowerCase().includes(query) ||
          entry.title.toLowerCase().includes(query) ||
          entry.departmentName.toLowerCase().includes(query) ||
          entry.note.toLowerCase().includes(query) ||
          entry.entryHash.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [sortedLogs, decisionFilter, entityFilter, search]);

  async function handleVerifyClientChain() {
    if (!window.crypto?.subtle) return;
    setVerifying(true);
    try {
      const report = await verifyActivityLogChainAsync(
        activityLogs,
        sha256HexBrowser,
        new Date().toISOString()
      );
      setClientVerification({
        entryCount: activityLogs.length,
        lastHash: activityLogs[0]?.entryHash ?? ACTIVITY_LOG_GENESIS_HASH,
        report,
      });
    } finally {
      setVerifying(false);
    }
  }

  function handleExportCsv() {
    if (!canExportCsv) return;
    const csv = generateActivityLogCsv(activityLogs, activeIntegrity);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `log-aktivitas-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  const filterButtons: { id: DecisionFilter; label: string }[] = [
    { id: 'all', label: 'Semua' },
    { id: 'approve', label: 'Disetujui' },
    { id: 'reject', label: 'Ditolak' },
    { id: 'info', label: 'Sesi & RBAC' },
    { id: 'warning', label: 'Peringatan' },
  ];

  const decisionBadgeMeta: Record<
    ActivityLogEntry['decision'],
    { label: string; colorClass: string }
  > = {
    approve: { label: 'Disetujui', colorClass: 'text-emerald-700' },
    reject: { label: 'Ditolak', colorClass: 'text-rose-700' },
    info: { label: 'Info / Sesi', colorClass: 'text-sky-700' },
    warning: { label: 'Peringatan', colorClass: 'text-amber-700' },
  };

  return (
    <div className="space-y-6">
      {/* Cryptographic Tamper-Proof Integrity Banner */}
      <section
        aria-label="Status Integritas Log Aktivitas"
        className={`rounded-xl border p-5 ${
          activeIntegrity.valid
            ? 'border-emerald-200 bg-white'
            : 'border-rose-300 bg-rose-50'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                activeIntegrity.valid
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {activeIntegrity.valid ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {activeIntegrity.valid
                    ? 'Rantai Audit Persetujuan & Keamanan Terverifikasi (Anti-Tampering)'
                    : 'Peringatan: Ketidaksesuaian Hash Rantai Audit Terdeteksi'}
                </h2>
                <span
                  data-testid="activity-log-integrity-status"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                    activeIntegrity.valid
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  <Lock className="h-3 w-3" />
                  <span>
                    {activeIntegrity.valid
                      ? `Valid (${activeIntegrity.totalEntries}/${activeIntegrity.totalEntries})`
                      : `${activeIntegrity.issues.length} Anomali`}
                  </span>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 max-w-3xl">
                Setiap aksi persetujuan, penolakan, login, rotasi token,
                perubahan role/RBAC, serta kedaluwarsa sesi dicatat append-only
                dengan identitas pengguna, timestamp UTC server, dan tanda tangan
                rantai hash SHA-256.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
                <span>
                  Head Hash:{' '}
                  <code className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                    {activeIntegrity.lastHash === ACTIVITY_LOG_GENESIS_HASH
                      ? 'GENESIS'
                      : `${activeIntegrity.lastHash.slice(0, 14)}…${activeIntegrity.lastHash.slice(-8)}`}
                  </code>
                </span>
                <span>
                  Verifikasi Terakhir:{' '}
                  <span className="font-mono tabular-nums text-slate-800">
                    {formatDateTimeWithSeconds(activeIntegrity.verifiedAt)}
                  </span>
                </span>
                {clientVerification &&
                  clientVerification.entryCount === activityLogs.length && (
                    <span className="text-emerald-700 font-medium">
                      Diverifikasi independen via WebCrypto SHA-256
                    </span>
                  )}
              </div>

              {!activeIntegrity.valid && activeIntegrity.issues.length > 0 && (
                <ul className="mt-3 list-disc pl-5 space-y-1 text-xs text-rose-800">
                  {activeIntegrity.issues.map((issue) => (
                    <li key={`${issue.id}-${issue.sequence}`}>
                      <span className="font-mono font-semibold">
                        Seq #{issue.sequence}
                      </span>
                      : {issue.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleVerifyClientChain}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`}
              />
              <span>
                {verifying ? 'Memverifikasi...' : 'Verifikasi Ulang Hash'}
              </span>
            </button>
            {canExportCsv && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Ekspor CSV Audit</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Summary Strip */}
      <section
        aria-label="Ringkasan Aktivitas Keputusan & Keamanan"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">
            Total Log Tercatat (Append-Only)
          </p>
          <p
            data-testid="activity-log-total-count"
            className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900"
          >
            {activityLogs.length} Aktivitas
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sekuens #{activeIntegrity.lastSequence} · Tidak dapat dimodifikasi
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">
            Keputusan Disetujui
          </p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-emerald-700">
            {stats.approveCount} Aksi
          </p>
          <p className="mt-1 font-mono tabular-nums text-xs text-slate-500">
            Nilai: {formatIDR(stats.approveAmount)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">
            Keputusan Ditolak
          </p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-rose-700">
            {stats.rejectCount} Aksi
          </p>
          <p className="mt-1 font-mono tabular-nums text-xs text-slate-500">
            Nilai: {formatIDR(stats.rejectAmount)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">
            Aktivitas Sesi &amp; RBAC
          </p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-sky-700">
            {stats.securityCount} Kejadian
          </p>
          <p className="mt-1 font-mono tabular-nums text-xs text-slate-500">
            {stats.warningCount} peringatan keamanan tercatat
          </p>
        </div>
      </section>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setDecisionFilter(btn.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                decisionFilter === btn.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari no. ref, pelaku, hash..."
              aria-label="Cari log aktivitas audit"
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value as EntityFilter)}
            aria-label="Filter jenis dokumen audit"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-700 focus:outline-none"
          >
            <option value="all">Semua Sumber Aktivitas</option>
            <option value="petty_cash_request">Petty Cash</option>
            <option value="down_payment">Kasbon</option>
            <option value="auth_session">Sesi Autentikasi</option>
            <option value="rbac_policy">Role &amp; Kebijakan RBAC</option>
            <option value="user_account">Akun Pengguna</option>
          </select>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Riwayat Keputusan, Autentikasi &amp; Perubahan RBAC
            </h3>
            <p className="text-xs text-slate-500">
              Menampilkan {filteredLogs.length} dari {activityLogs.length} catatan
              audit berantai SHA-256.
            </p>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-12 px-6 text-center text-sm text-slate-500">
            Tidak ada rekaman log aktivitas yang sesuai dengan filter saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              aria-label="Tabel Log Aktivitas Audit Persetujuan"
              className="w-full text-left border-collapse"
            >
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Seq</th>
                  <th className="py-3 px-4">Timestamp Tepat</th>
                  <th className="py-3 px-4">Pelaku / Pengguna</th>
                  <th className="py-3 px-4">Kategori Aksi</th>
                  <th className="py-3 px-4">Objek &amp; Detail</th>
                  <th className="py-3 px-4">Catatan / Alasan</th>
                  <th className="py-3 px-4">Hash SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredLogs.map((entry) => {
                  const hasIssue = issueSeqSet.has(entry.sequence);
                  const meta = decisionBadgeMeta[entry.decision];
                  const roleDisplay =
                    roleNameMap.get(entry.actorRole) ?? entry.actorRole;
                  return (
                    <tr
                      key={entry.id}
                      className={hasIssue ? 'bg-rose-50/60' : 'hover:bg-slate-50/70'}
                    >
                      <td className="py-3.5 px-4 align-top font-mono tabular-nums font-semibold text-slate-700 whitespace-nowrap">
                        #{String(entry.sequence).padStart(3, '0')}
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-mono tabular-nums font-medium text-slate-900">
                          {formatDateTimeWithSeconds(entry.timestamp)}
                        </div>
                        <div
                          className="mt-0.5 font-mono tabular-nums text-[11px] text-slate-500"
                          title={`Timestamp server UTC: ${entry.timestamp}`}
                        >
                          {entry.timestamp}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-900">
                          {entry.actorName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Peran: {roleDisplay}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div
                          className={`inline-flex items-center gap-1.5 font-semibold ${meta.colorClass}`}
                        >
                          {entry.decision === 'approve' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : entry.decision === 'reject' ? (
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                          ) : entry.decision === 'warning' ? (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <Info className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{meta.label}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {getActivityActionLabel(entry.actionType)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top min-w-[230px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-900">
                            {entry.referenceNumber}
                          </span>
                          {entry.amount > 0 && (
                            <>
                              <span
                                className="text-slate-300"
                                aria-hidden="true"
                              >
                                ·
                              </span>
                              <span className="font-mono tabular-nums font-semibold text-slate-800">
                                {formatIDR(entry.amount)}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="mt-0.5 text-slate-700 line-clamp-2">
                          {entry.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {entry.departmentName} · Subjek: {entry.requesterName}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-[240px]">
                        <p className="text-slate-600 italic break-words">
                          {entry.note ? `“${entry.note}”` : '-'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div
                          className="font-mono text-[11px] text-slate-800"
                          title={`Entry Hash: ${entry.entryHash}\nPrevious Hash: ${entry.previousHash}`}
                        >
                          {entry.entryHash.slice(0, 12)}…{entry.entryHash.slice(-6)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                          <span className="font-mono text-slate-400">
                            prev:{' '}
                            {entry.previousHash === ACTIVITY_LOG_GENESIS_HASH
                              ? 'GENESIS'
                              : `${entry.previousHash.slice(0, 8)}…`}
                          </span>
                          <span
                            className={`font-semibold ${
                              hasIssue ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {hasIssue ? '· Rusak' : '· Valid'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
