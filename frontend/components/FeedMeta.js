'use client';

const SORT_OPTIONS = [
  { value: 'max_edge', label: 'Max Edge ↓' },
  { value: 'kickoff', label: 'Kickoff ↑' },
  { value: 'ai_prob', label: 'AI Prob ↓' },
  { value: 'odds_asc', label: 'Odds ↑' },
  { value: 'odds_desc', label: 'Odds ↓' },
  { value: 'ruby_first', label: 'Ruby first' },
  { value: 'mes', label: 'MES ↓' },
  { value: 'freshest', label: 'Freshest data' },
];

const EDGE_BANDS = [
  { value: 'high', label: '≥8%' },
  { value: 'mid', label: '3–8%' },
  { value: 'low', label: '0–3%' },
  { value: 'none', label: 'No edge' },
];

const MARKET_OPTIONS = [
  { value: 'both', label: 'Both' },
  { value: 'match', label: 'Match Odds' },
  { value: 'totals', label: 'Over/Under' },
];

export default function FeedMeta({
  sort, onSort,
  edgeBands, onToggleBand,
  marketView, onMarketView,
  total, filtered,
}) {
  return (
    <div className="space-y-3 mb-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-dim text-xs">Sort:</span>
          <select
            value={sort}
            onChange={e => onSort(e.target.value)}
            className="bg-surface border border-line text-chalk text-xs rounded px-2 py-1.5 focus:outline-none focus:border-dim cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <span className="text-ghost text-xs">
          {filtered} of {total} match{total !== 1 ? 'es' : ''}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-dim text-xs shrink-0">Edge:</span>
        {EDGE_BANDS.map(band => (
          <button
            key={band.value}
            onClick={() => onToggleBand(band.value)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              edgeBands.includes(band.value)
                ? 'border-signal text-signal bg-signal/10'
                : 'border-line text-ghost hover:border-dim hover:text-dim'
            }`}
          >
            {band.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-dim text-xs shrink-0">Market:</span>
        {MARKET_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onMarketView(opt.value)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              marketView === opt.value
                ? 'border-signal text-signal bg-signal/10'
                : 'border-line text-ghost hover:border-dim hover:text-dim'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
