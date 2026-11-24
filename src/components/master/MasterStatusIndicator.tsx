import { Ban, CheckCircle2 } from 'lucide-react';

export function MasterStatusIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        active ? 'text-emerald-700' : 'text-slate-400'
      }`}
    >
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Ban className="h-3.5 w-3.5" />
      )}
      <span>{active ? 'Aktif' : 'Nonaktif'}</span>
    </span>
  );
}
