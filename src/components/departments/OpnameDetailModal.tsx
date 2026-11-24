import { X } from 'lucide-react';
import type { CashOpnameRecord, Department } from '../../types/pettycash.ts';
import { formatIDR } from '../../utils/formatters.ts';

interface OpnameDetailModalProps {
  opname: CashOpnameRecord | null;
  deptMap: Map<string, Department>;
  onClose: () => void;
}

export function OpnameDetailModal({
  opname,
  deptMap,
  onClose,
}: OpnameDetailModalProps) {
  if (!opname) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opname-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div>
            <h3
              id="opname-detail-title"
              className="text-sm font-semibold text-slate-900"
            >
              Rincian Pecahan — {opname.opnameNumber}
            </h3>
            <p className="text-xs text-slate-500">
              {deptMap.get(opname.departmentId)?.name ?? opname.departmentId} ·{' '}
              {opname.countedBy}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup rincian pecahan"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2 px-3">Pecahan</th>
                  <th className="py-2 px-3 text-right">Jumlah</th>
                  <th className="py-2 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {opname.denominations
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <tr key={d.denomination}>
                      <td className="py-2 px-3 font-mono text-slate-800">
                        {formatIDR(d.denomination)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        {d.count}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatIDR(d.subtotal)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Fisik</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {formatIDR(opname.physicalTotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Saldo Sistem</span>
              <span className="font-mono tabular-nums text-slate-800">
                {formatIDR(opname.systemBalance)}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 font-semibold">
              <span>Selisih</span>
              <span
                className={`font-mono tabular-nums ${
                  opname.status === 'matched'
                    ? 'text-emerald-700'
                    : opname.status === 'over'
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {opname.variance > 0
                  ? `+${formatIDR(opname.variance)}`
                  : formatIDR(opname.variance)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
