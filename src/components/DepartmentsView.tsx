import { useMemo, useState } from 'react';
import { BookOpen, Calculator, Wallet } from 'lucide-react';
import type {
  AuthUserPublic,
  CashOpnameRecord,
  Department,
  DepartmentMetrics,
  DownPaymentRecord,
  PermissionKey,
  PettyCashRequest,
  TopUpRecord,
} from '../types/pettycash.ts';
import {
  buildCashLedger,
  generateCashLedgerCsv,
  hasPermission,
} from '../utils/pettycashLogic.ts';
import { DepartmentBalancesTab } from './departments/DepartmentBalancesTab.tsx';
import { CashLedgerTab } from './departments/CashLedgerTab.tsx';
import { CashOpnameTab } from './departments/CashOpnameTab.tsx';
import { EditDepartmentModal } from './departments/EditDepartmentModal.tsx';
import { OpnameDetailModal } from './departments/OpnameDetailModal.tsx';

type DeptSubTab = 'balances' | 'ledger' | 'opname';

interface DepartmentsViewProps {
  metrics: DepartmentMetrics[];
  requests: PettyCashRequest[];
  topUps: TopUpRecord[];
  opnames: CashOpnameRecord[];
  downPayments?: DownPaymentRecord[];
  userPermissions: readonly PermissionKey[];
  currentUser: AuthUserPublic;
  currentRoleName: string;
  onOpenTopUp: (dept: Department) => void;
  onUpdateDepartment: (payload: {
    departmentId: string;
    picName: string;
    monthlyBudget: number;
    lowBalanceThreshold: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  onCreateOpname: (payload: {
    departmentId: string;
    note: string;
    denominations: { denomination: number; count: number }[];
  }) => Promise<{ ok: boolean; error?: string }>;
  onPreviewReceipt: (request: PettyCashRequest) => void;
}

export function DepartmentsView({
  metrics,
  requests,
  topUps,
  opnames,
  downPayments = [],
  userPermissions,
  currentUser,
  currentRoleName,
  onOpenTopUp,
  onUpdateDepartment,
  onCreateOpname,
  onPreviewReceipt,
}: DepartmentsViewProps) {
  const [subTab, setSubTab] = useState<DeptSubTab>('balances');
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [ledgerDeptId, setLedgerDeptId] = useState<string>('all');
  const [ledgerMonth, setLedgerMonth] = useState<string>('all');
  const [detailOpname, setDetailOpname] = useState<CashOpnameRecord | null>(
    null
  );

  const canTopUp = hasPermission(userPermissions, 'departments:topup');
  const canEditDept = hasPermission(userPermissions, 'departments:edit');
  const canExport = hasPermission(userPermissions, 'reports:export');
  const canCreateOpname = hasPermission(userPermissions, 'opname:create');

  const departments = useMemo(() => metrics.map((m) => m.department), [metrics]);
  const activeDepts = useMemo(
    () => departments.filter((d) => d.active !== false),
    [departments]
  );
  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );
  const requestById = useMemo(
    () => new Map(requests.map((r) => [r.id, r])),
    [requests]
  );
  const downPaymentById = useMemo(
    () => new Map(downPayments.map((dp) => [dp.id, dp])),
    [downPayments]
  );

  const ledgerMonths = useMemo(() => {
    const set = new Set<string>();
    for (const t of topUps) {
      if (t.createdAt.length >= 7) set.add(t.createdAt.slice(0, 7));
    }
    for (const r of requests) {
      if (r.status === 'approved') {
        const d = r.disbursedAt ?? r.updatedAt;
        if (d.length >= 7) set.add(d.slice(0, 7));
      }
    }
    for (const dp of downPayments) {
      if (dp.status === 'open' || dp.status === 'settled') {
        const outDate = dp.disbursedAt ?? dp.updatedAt;
        if (outDate.length >= 7) set.add(outDate.slice(0, 7));
      }
      const stDate = dp.settlement?.settledAt;
      if (stDate && stDate.length >= 7) {
        set.add(stDate.slice(0, 7));
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [topUps, requests, downPayments]);

  const cashLedger = useMemo(
    () =>
      buildCashLedger(
        departments,
        requests,
        topUps,
        ledgerDeptId,
        ledgerMonth,
        downPayments
      ),
    [departments, requests, topUps, ledgerDeptId, ledgerMonth, downPayments]
  );

  function handleDownloadLedgerCsv() {
    if (!canExport) return;
    const scopeLabel =
      ledgerDeptId === 'all'
        ? 'Semua-Divisi'
        : deptMap.get(ledgerDeptId)?.code ?? ledgerDeptId;
    const csv = generateCashLedgerCsv(cashLedger, scopeLabel);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mutasi-kas-${scopeLabel.toLowerCase()}-${ledgerMonth}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  const subTabs: { id: DeptSubTab; label: string; icon: typeof Wallet }[] = [
    { id: 'balances', label: 'Saldo & Plafon Divisi', icon: Wallet },
    { id: 'ledger', label: 'Buku Mutasi Kas', icon: BookOpen },
    { id: 'opname', label: 'Cash Opname Fisik', icon: Calculator },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {subTabs.map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    active ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <span className="px-2 text-xs text-slate-500 hidden sm:inline">
          Kontrol saldo buku, arus masuk-keluar, &amp; hitung fisik kas
        </span>
      </div>

      {subTab === 'balances' && (
        <DepartmentBalancesTab
          metrics={metrics}
          topUps={topUps}
          deptMap={deptMap}
          canTopUp={canTopUp}
          canEdit={canEditDept}
          onOpenTopUp={onOpenTopUp}
          onStartEdit={setEditingDept}
        />
      )}

      {subTab === 'ledger' && (
        <CashLedgerTab
          departments={departments}
          ledgerDeptId={ledgerDeptId}
          onLedgerDeptIdChange={setLedgerDeptId}
          ledgerMonth={ledgerMonth}
          onLedgerMonthChange={setLedgerMonth}
          ledgerMonths={ledgerMonths}
          cashLedger={cashLedger}
          requestById={requestById}
          downPaymentById={downPaymentById}
          canExport={canExport}
          onDownloadCsv={handleDownloadLedgerCsv}
          onPreviewReceipt={onPreviewReceipt}
        />
      )}

      {subTab === 'opname' && (
        <CashOpnameTab
          activeDepts={activeDepts.length > 0 ? activeDepts : departments}
          deptMap={deptMap}
          opnames={opnames}
          canCreateOpname={canCreateOpname}
          currentUser={currentUser}
          currentRoleName={currentRoleName}
          onCreateOpname={onCreateOpname}
          onSelectOpnameDetail={setDetailOpname}
        />
      )}

      <EditDepartmentModal
        key={editingDept?.id ?? 'none'}
        department={editingDept}
        onClose={() => setEditingDept(null)}
        onSave={onUpdateDepartment}
      />

      <OpnameDetailModal
        opname={detailOpname}
        deptMap={deptMap}
        onClose={() => setDetailOpname(null)}
      />
    </div>
  );
}
