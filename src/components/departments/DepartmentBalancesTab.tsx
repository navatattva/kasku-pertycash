import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
} from 'lucide-react';
import type {
  Department,
  DepartmentMetrics,
  TopUpRecord,
} from '../../types/pettycash.ts';
import { formatDateTime, formatIDR } from '../../utils/formatters.ts';

interface DepartmentBalancesTabProps {
  metrics: DepartmentMetrics[];
  topUps: TopUpRecord[];
  deptMap: Map<string, Department>;
  canTopUp: boolean;
  canEdit: boolean;
  onOpenTopUp: (dept: Department) => void;
  onStartEdit: (dept: Department) => void;
}

export function DepartmentBalancesTab({
  metrics,
  topUps,
  deptMap,
  canTopUp,
  canEdit,
  onOpenTopUp,
  onStartEdit,
}: DepartmentBalancesTabProps) {
  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Buku Besar Saldo &amp; Plafon Divisi Kargo
            </h2>
            <p className="text-xs text-slate-500">
              Pantau saldo buku, dana tertahan oleh pengajuan aktif, dan batas
              peringatan kas kecil tiap unit operasional.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Divisi</th>
                <th className="py-3 px-4">Penanggung Jawab</th>
                <th className="py-3 px-4 text-right">Saldo Buku</th>
                <th className="py-3 px-4 text-right">Dana Tertahan</th>
                <th className="py-3 px-4 text-right">Saldo Tersedia</th>
                <th className="py-3 px-4 text-right">Plafon Bulanan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.map((m) => {
                const d = m.department;
                return (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{d.name}</p>
                      <p className="text-xs font-mono text-slate-500">
                        Kode: {d.code}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-800">{d.picName}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatIDR(d.balance)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-amber-700">
                      {formatIDR(m.pendingHold)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatIDR(m.availableBalance)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatIDR(d.monthlyBudget)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${
                          m.healthStatus === 'kritis'
                            ? 'text-rose-700'
                            : m.healthStatus === 'menipis'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {m.healthStatus === 'kritis' ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : m.healthStatus === 'menipis' ? (
                          <Clock className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {m.healthStatus === 'kritis'
                            ? 'Kritis'
                            : m.healthStatus === 'menipis'
                            ? 'Menipis'
                            : 'Nominal'}
                        </span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {canTopUp && (
                          <button
                            type="button"
                            onClick={() => onOpenTopUp(d)}
                            aria-label={`Top-Up Saldo ${d.name}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Top-Up</span>
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onStartEdit(d)}
                            aria-label={`Ubah konfigurasi ${d.name}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Ubah</span>
                          </button>
                        )}
                        {!canTopUp && !canEdit && (
                          <span className="text-xs text-slate-400">Read-Only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Riwayat Pengisian Ulang (Top-Up) Kas Kecil
          </h2>
          <p className="text-xs text-slate-500">
            Catatan penambahan dana imprest divisi operasional kargo.
          </p>
        </div>

        {topUps.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Belum ada riwayat top-up tercatat.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {topUps.slice(0, 10).map((t) => {
              const dept = deptMap.get(t.departmentId);
              return (
                <div
                  key={t.id}
                  className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {dept?.name ?? t.departmentId} — {t.note}
                    </p>
                    <p className="text-xs text-slate-500">
                      Oleh {t.performedBy} ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatDateTime(t.createdAt)}
                      </span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums text-sm font-semibold text-emerald-700">
                    <ArrowUpRight className="h-4 w-4" />+{formatIDR(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
