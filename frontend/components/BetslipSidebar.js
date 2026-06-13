'use client';
import { useBetslip } from '../contexts/BetslipContext';

const OUTCOME_LABELS = {
  home: 'HOME',
  draw: 'DRAW',
  away: 'AWAY',
  over: 'OVER',
  under: 'UNDER',
};

function outcomeLabel(o) {
  return OUTCOME_LABELS[o] || o.toUpperCase();
}

export default function BetslipSidebar() {
  const { selections, removeSelection } = useBetslip();

  if (selections.length === 0) return null;

  const combinedOdds = selections.reduce((acc, s) => acc * (s.odds || 1), 1);
  const combinedProb = selections.reduce((acc, s) => acc * ((s.aiProb || 50) / 100), 1);
  const accEV = combinedProb * combinedOdds - 1;
  const isPositiveEV = accEV > 0;
  const isAccumulator = selections.length > 1;

  return (
    <aside className="w-[280px] bg-surface border-l border-line flex flex-col sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="px-4 py-3 border-b border-line shrink-0">
        <h2 className="text-chalk text-sm font-semibold">Betslip</h2>
        <p className="text-ghost text-xs mt-0.5">
          {selections.length} selection{selections.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto betslip-scroll p-4 space-y-2">
        {selections.map((s, i) => (
          <div key={`${s.matchId}-${s.outcome}-${i}`} className="bg-pitch border border-line rounded p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-chalk text-xs font-medium leading-tight">{s.matchLabel}</span>
              <button
                onClick={() => removeSelection(s.matchId, s.outcome)}
                aria-label="Remove"
                className="text-ghost hover:text-warn text-sm leading-none shrink-0 mt-0.5"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-signal font-medium">
                {outcomeLabel(s.outcome)}
              </span>
              <span className="text-chalk text-sm font-bold tabular-nums">
                {s.odds?.toFixed(2) ?? '—'}
              </span>
              {s.bookmaker && (
                <span className="text-ghost text-xs">{s.bookmaker}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-line shrink-0 space-y-2">
        <div className="text-dim text-xs">
          {isAccumulator ? 'Accumulator' : 'Single'}
        </div>

        {isAccumulator && (
          <div className="flex justify-between items-center">
            <span className="text-ghost text-xs">Combined odds</span>
            <span className="text-chalk text-sm font-bold tabular-nums">
              {combinedOdds.toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-ghost text-xs">Combined edge</span>
          <span className={`text-sm font-bold tabular-nums ${isPositiveEV ? 'text-signal' : 'text-warn'}`}>
            {isPositiveEV ? '+' : ''}{(accEV * 100).toFixed(1)}%
          </span>
        </div>

        {!isPositiveEV && isAccumulator && (
          <p className="text-ghost text-xs border-t border-line pt-2 leading-snug">
            Edge degrades with each added leg
          </p>
        )}
      </div>
    </aside>
  );
}
