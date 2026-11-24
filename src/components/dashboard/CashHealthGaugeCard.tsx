import { Activity } from 'lucide-react';
import type { CashHealthMetrics } from '../../types/pettycash.ts';

function polarPoint(cx: number, cy: number, r: number, pct: number) {
  const clamped = Math.max(0, Math.min(100, pct));
  const angle = Math.PI * (1 - clamped / 100);
  return {
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  };
}

function describeGaugeArc(
  cx: number,
  cy: number,
  r: number,
  startPct: number,
  endPct: number
): string {
  const start = polarPoint(cx, cy, r, startPct);
  const end = polarPoint(cx, cy, r, endPct);
  const largeArcFlag = Math.abs(endPct - startPct) > 100 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

interface CashHealthGaugeCardProps {
  cashHealth: CashHealthMetrics;
}

export function CashHealthGaugeCard({ cashHealth }: CashHealthGaugeCardProps) {
  const gaugeCx = 120;
  const gaugeCy = 114;
  const gaugeR = 80;
  const needleTip = polarPoint(gaugeCx, gaugeCy, gaugeR - 14, cashHealth.score);
  const marker45 = polarPoint(gaugeCx, gaugeCy, gaugeR + 18, 45);
  const marker75 = polarPoint(gaugeCx, gaugeCy, gaugeR + 18, 75);
  const gaugeColor =
    cashHealth.status === 'kritis'
      ? '#e11d48'
      : cashHealth.status === 'waspada'
      ? '#d97706'
      : '#047857';

  return (
    <article className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-700" />
              <span>Indeks Kesehatan Kas</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Skor komposit dari kecukupan saldo, sisa plafon, &amp; selisih
              opname fisik.
            </p>
          </div>
          <span
            className={`text-xs font-semibold whitespace-nowrap ${
              cashHealth.status === 'kritis'
                ? 'text-rose-700'
                : cashHealth.status === 'waspada'
                ? 'text-amber-700'
                : 'text-emerald-700'
            }`}
          >
            Status: {cashHealth.statusLabel}
          </span>
        </div>

        <div className="mt-3 flex flex-col items-center">
          <svg
            viewBox="0 0 240 138"
            className="w-full max-w-[260px] overflow-visible"
            role="img"
            aria-label={`Gauge Indeks Kesehatan Kas skor ${cashHealth.score} dari 100 dengan status ${cashHealth.statusLabel}`}
          >
            {/* Zone background tracks */}
            <path
              d={describeGaugeArc(gaugeCx, gaugeCy, gaugeR, 0, 44)}
              fill="none"
              stroke="#ffe4e6"
              strokeWidth="15"
              strokeLinecap="butt"
            />
            <path
              d={describeGaugeArc(gaugeCx, gaugeCy, gaugeR, 45, 74)}
              fill="none"
              stroke="#fef3c7"
              strokeWidth="15"
              strokeLinecap="butt"
            />
            <path
              d={describeGaugeArc(gaugeCx, gaugeCy, gaugeR, 75, 100)}
              fill="none"
              stroke="#d1fae5"
              strokeWidth="15"
              strokeLinecap="butt"
            />

            {/* Active score arc */}
            {cashHealth.score > 0 && (
              <path
                d={describeGaugeArc(
                  gaugeCx,
                  gaugeCy,
                  gaugeR,
                  0,
                  cashHealth.score
                )}
                fill="none"
                stroke={gaugeColor}
                strokeWidth="15"
                strokeLinecap="round"
              />
            )}

            {/* Needle */}
            <line
              x1={gaugeCx}
              y1={gaugeCy}
              x2={needleTip.x}
              y2={needleTip.y}
              stroke="#0f172a"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx={gaugeCx} cy={gaugeCy} r="5" fill="#0f172a" />
            <circle cx={gaugeCx} cy={gaugeCy} r="2" fill="#ffffff" />

            {/* Threshold markers placed outside arc */}
            <text
              x={gaugeCx - gaugeR}
              y={gaugeCy + 16}
              fontSize="10"
              fill="#64748b"
              textAnchor="middle"
              className="font-mono"
            >
              0
            </text>
            <text
              x={marker45.x}
              y={marker45.y}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
              className="font-mono"
            >
              45
            </text>
            <text
              x={marker75.x}
              y={marker75.y}
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
              className="font-mono"
            >
              75
            </text>
            <text
              x={gaugeCx + gaugeR}
              y={gaugeCy + 16}
              fontSize="10"
              fill="#64748b"
              textAnchor="middle"
              className="font-mono"
            >
              100
            </text>
          </svg>

          <div className="-mt-1 text-center">
            <div className="inline-flex items-baseline gap-1">
              <span
                data-testid="cash-health-score"
                className="font-mono tabular-nums text-3xl font-bold text-slate-900"
              >
                {cashHealth.score}
              </span>
              <span className="font-mono text-xs text-slate-400">/100</span>
            </div>
            <p className="text-xs font-medium text-slate-600 mt-0.5">
              {cashHealth.status === 'sehat'
                ? 'Likuiditas kas kecil kargo kuat & terkendali'
                : cashHealth.status === 'waspada'
                ? 'Perlu pantau saldo divisi yang mulai menipis'
                : 'Segera lakukan top-up untuk menjaga kelancaran operasional'}
            </p>
          </div>
        </div>
      </div>

      {/* 3 Weighted Pillar Bars */}
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5 text-xs">
        <div>
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span>Kecukupan Saldo vs Batas Aman</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {cashHealth.coveragePoints}/45 pts ({cashHealth.coverageRatioPct}%)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-700"
              style={{ width: `${(cashHealth.coveragePoints / 45) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span>Sisa Plafon Anggaran Bulanan</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {cashHealth.budgetPoints}/30 pts ({cashHealth.budgetRemainingPct}%)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-700"
              style={{ width: `${(cashHealth.budgetPoints / 30) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span>Stabilitas Divisi &amp; Akurasi Opname</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {cashHealth.stabilityPoints}/25 pts
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-700"
              style={{ width: `${(cashHealth.stabilityPoints / 25) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
