'use client';
import { useState } from 'react';
import { useBetslip } from '../contexts/BetslipContext';
import { fetchMatchOdds, formatEdge, edgeColor } from '../lib/feed';

const BOOK_LABELS = {
  bet365: 'Bet365',
  skybet: 'Sky Bet',
  williamhill: 'William Hill',
  paddypower: 'Paddy Power',
  coral: 'Coral',
  ladbrokes_uk: 'Ladbrokes',
  betfred_uk: 'Betfred',
  betway: 'Betway',
  betvictor: 'BetVictor',
  boylesports: 'BoyleSports',
  betfair_sb_uk: 'Betfair SB',
  betfair_ex_uk: 'Betfair Ex',
  unibet_uk: 'Unibet',
  virginbet: 'Virgin Bet',
  sport888: '888sport',
  smarkets: 'Smarkets',
  matchbook: 'Matchbook',
};

function bookLabel(key) {
  return BOOK_LABELS[key] || key;
}

function formatKickoff(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d >= todayStart && d < tomorrowStart) return `Today ${time}`;
  if (d >= tomorrowStart && d < new Date(tomorrowStart.getTime() + 86400000)) return `Tomorrow ${time}`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + time;
}

function profitPer10(odds) {
  if (!odds || odds <= 1) return null;
  return ((odds - 1) * 10).toFixed(2);
}

function getOutlier(allOdds) {
  if (!allOdds || allOdds.length < 2) return null;
  const avgHomeImpl = allOdds.reduce((s, b) => s + (b.home_odds ? 1 / b.home_odds : 0), 0) / allOdds.length;
  const avgDrawImpl = allOdds.reduce((s, b) => s + (b.draw_odds ? 1 / b.draw_odds : 0), 0) / allOdds.length;
  const avgAwayImpl = allOdds.reduce((s, b) => s + (b.away_odds ? 1 / b.away_odds : 0), 0) / allOdds.length;

  let best = null;
  let bestDiff = 0;

  for (const row of allOdds) {
    const candidates = [
      { outcome: 'Home', diff: avgHomeImpl - (row.home_odds ? 1 / row.home_odds : 0) },
      { outcome: 'Draw', diff: avgDrawImpl - (row.draw_odds ? 1 / row.draw_odds : 0) },
      { outcome: 'Away', diff: avgAwayImpl - (row.away_odds ? 1 / row.away_odds : 0) },
    ];
    for (const c of candidates) {
      if (c.diff > bestDiff) {
        bestDiff = c.diff;
        best = { book: bookLabel(row.bookmaker), outcome: c.outcome, pct: (c.diff * 100).toFixed(1) };
      }
    }
  }
  return best;
}

function OddsCell({ label, outcome, odds, book, aiProb, edge, isValue, isRuby, isFav, onToggle, selected }) {
  const impliedProb = odds ? Math.round((1 / odds) * 100) : null;
  const profit = (isValue || isRuby) ? profitPer10(odds) : null;

  return (
    <div className={`bg-surface p-3 relative ${isRuby ? 'bg-ruby/5' : isValue ? 'bg-signal/5' : ''}`}>
      {/* Tags row */}
      <div className="flex items-center gap-1 mb-2 flex-wrap min-h-[20px]">
        <span className="text-ghost text-xs font-medium">{label}</span>
        {isFav && (
          <span className="text-xs px-1 py-px rounded bg-muted text-dim border border-line leading-tight">
            FAV
          </span>
        )}
        {isRuby && (
          <span className="text-xs px-1 py-px rounded bg-ruby/20 text-ruby font-bold leading-tight">
            RUBY
          </span>
        )}
        {!isRuby && isValue && (
          <span className="text-xs px-1 py-px rounded bg-signal/20 text-signal font-bold leading-tight">
            VALUE
          </span>
        )}
      </div>

      {/* Best odds — large */}
      <div className={`text-2xl font-bold mb-0.5 leading-none ${isRuby ? 'text-ruby' : isValue ? 'text-signal' : 'text-chalk'}`}>
        {odds ? odds.toFixed(2) : '—'}
      </div>

      {/* Bookmaker badge */}
      <div className="text-ghost text-xs mb-2">
        {book ? bookLabel(book) : '—'}
      </div>

      {/* Probability + edge stats */}
      <div className="space-y-0.5 text-xs">
        {aiProb != null && (
          <div className="flex justify-between gap-2">
            <span className="text-ghost">AI Prob</span>
            <span className="text-chalk font-medium">{aiProb}%</span>
          </div>
        )}
        {impliedProb != null && (
          <div className="flex justify-between gap-2">
            <span className="text-ghost">Market</span>
            <span className="text-dim">{impliedProb}%</span>
          </div>
        )}
        {edge != null && (
          <div className="flex justify-between gap-2">
            <span className="text-ghost">Edge</span>
            <span className={edgeColor(edge)}>{formatEdge(edge)}</span>
          </div>
        )}
        {profit && (
          <div className="flex justify-between gap-2 mt-1 pt-1 border-t border-line/50">
            <span className="text-ghost">Per £10</span>
            <span className="text-signal font-medium">£{profit}</span>
          </div>
        )}
      </div>

      {/* Add to betslip button */}
      <button
        onClick={onToggle}
        title={selected ? 'Remove from betslip' : 'Add to betslip'}
        className={`absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all ${
          selected
            ? 'bg-signal text-pitch'
            : 'bg-muted text-dim hover:bg-ghost hover:text-chalk'
        }`}
      >
        {selected ? '✓' : '+'}
      </button>
    </div>
  );
}

export default function MatchCard({ item, rank, marketView }) {
  const [expanded, setExpanded] = useState(false);
  const [allOdds, setAllOdds] = useState(null);
  const [loadingOdds, setLoadingOdds] = useState(false);
  const { selections, addSelection, removeSelection } = useBetslip();

  const match = item.matches;
  if (!match) return null;

  const homeTeam = match.home_team?.name || 'Home';
  const awayTeam = match.away_team?.name || 'Away';
  const league = match.league?.name || '';

  // Derive model (AI) probabilities: edge = modelProb - (1/bestOdds)  →  modelProb = edge + (1/bestOdds)
  const homeAiProb = item.home_edge != null && item.best_home_odds
    ? Math.round((item.home_edge + 1 / item.best_home_odds) * 100)
    : null;
  const drawAiProb = item.draw_edge != null && item.best_draw_odds
    ? Math.round((item.draw_edge + 1 / item.best_draw_odds) * 100)
    : null;
  const awayAiProb = item.away_edge != null && item.best_away_odds
    ? Math.round((item.away_edge + 1 / item.best_away_odds) * 100)
    : null;

  // FAV = highest AI prob
  const probEntries = [
    { outcome: 'home', prob: homeAiProb },
    { outcome: 'draw', prob: drawAiProb },
    { outcome: 'away', prob: awayAiProb },
  ].filter(p => p.prob != null);
  const maxAiProb = probEntries.length ? Math.max(...probEntries.map(p => p.prob)) : null;
  const favOutcome = probEntries.find(p => p.prob === maxAiProb)?.outcome;

  const isRuby = !!(item.home_ruby || item.draw_ruby || item.away_ruby);
  const isValue = !!(item.home_value || item.draw_value || item.away_value);
  const maxEdgePct = item.max_edge != null ? (item.max_edge * 100).toFixed(1) : null;

  function isSelected(outcome) {
    return selections.some(s => s.matchId === item.match_id && s.outcome === outcome);
  }

  function toggleSelection(outcome, odds, book, aiProb) {
    if (isSelected(outcome)) {
      removeSelection(item.match_id, outcome);
    } else {
      addSelection({
        matchId: item.match_id,
        matchLabel: `${homeTeam} vs ${awayTeam}`,
        outcome,
        odds,
        bookmaker: book ? bookLabel(book) : null,
        aiProb,
      });
    }
  }

  async function handleExpandOdds() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!allOdds) {
      setLoadingOdds(true);
      try {
        const data = await fetchMatchOdds(item.match_id);
        setAllOdds(data);
      } catch (e) {
        console.error('Failed to load odds:', e.message);
      }
      setLoadingOdds(false);
    }
  }

  // Sub-header: "X favoured · Y%"
  let favouredLabel = null;
  if (favOutcome && maxAiProb != null) {
    const name = favOutcome === 'home' ? homeTeam : favOutcome === 'away' ? awayTeam : 'Draw';
    favouredLabel = `${name} favoured · ${maxAiProb}%`;
  }

  return (
    <div
      className={`bg-surface border border-line rounded-lg overflow-hidden ${isRuby ? 'ruby-glow border-ruby/30' : ''}`}
    >
      {/* Top accent line */}
      <div className={`h-0.5 ${isRuby ? 'bg-ruby' : isValue ? 'bg-signal' : 'bg-line'}`} />

      {/* Card header */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-ghost text-xs font-mono tabular-nums shrink-0">
              {String(rank).padStart(2, '0')}
            </span>
            <span className="text-chalk font-semibold text-sm leading-tight">
              {homeTeam} <span className="text-ghost font-normal">vs</span> {awayTeam}
            </span>
            {isRuby && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-ruby/20 text-ruby border border-ruby/40 shrink-0">
                RUBY
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-ghost flex-wrap">
            {league && <span>{league}</span>}
            {league && <span>·</span>}
            <span>{formatKickoff(match.kickoff_at)}</span>
            {favouredLabel && (
              <>
                <span>·</span>
                <span className="text-dim">{favouredLabel}</span>
              </>
            )}
          </div>
        </div>
        {maxEdgePct && (
          <span className={`text-sm font-bold shrink-0 ${isRuby ? 'text-ruby' : 'text-signal'}`}>
            +{maxEdgePct}%
          </span>
        )}
      </div>

      {/* Match odds grid (HOME / DRAW / AWAY) */}
      {marketView !== 'totals' && (
        <div className="grid grid-cols-3 gap-px bg-line mx-4 mb-3 rounded overflow-hidden">
          <OddsCell
            label="HOME" outcome="home"
            odds={item.best_home_odds} book={item.best_home_book}
            aiProb={homeAiProb} edge={item.home_edge}
            isValue={!!item.home_value} isRuby={!!item.home_ruby}
            isFav={favOutcome === 'home'}
            selected={isSelected('home')}
            onToggle={() => toggleSelection('home', item.best_home_odds, item.best_home_book, homeAiProb)}
          />
          <OddsCell
            label="DRAW" outcome="draw"
            odds={item.best_draw_odds} book={item.best_draw_book}
            aiProb={drawAiProb} edge={item.draw_edge}
            isValue={!!item.draw_value} isRuby={!!item.draw_ruby}
            isFav={favOutcome === 'draw'}
            selected={isSelected('draw')}
            onToggle={() => toggleSelection('draw', item.best_draw_odds, item.best_draw_book, drawAiProb)}
          />
          <OddsCell
            label="AWAY" outcome="away"
            odds={item.best_away_odds} book={item.best_away_book}
            aiProb={awayAiProb} edge={item.away_edge}
            isValue={!!item.away_value} isRuby={!!item.away_ruby}
            isFav={favOutcome === 'away'}
            selected={isSelected('away')}
            onToggle={() => toggleSelection('away', item.best_away_odds, item.best_away_book, awayAiProb)}
          />
        </div>
      )}

      {/* Goals O/U section */}
      {marketView !== 'match' && item.over_odds && item.under_odds && (
        <div className="px-4 mb-3">
          <div className="text-ghost text-xs mb-1.5 font-medium">
            GOALS O/U {item.totals_line ?? '2.5'}
          </div>
          <div className="grid grid-cols-2 gap-px bg-line rounded overflow-hidden">
            {[
              {
                label: `OVER ${item.totals_line ?? 2.5}`,
                outcome: 'over',
                odds: item.over_odds,
                book: item.over_book,
                edge: item.over_edge,
                isValue: !!item.over_value,
              },
              {
                label: `UNDER ${item.totals_line ?? 2.5}`,
                outcome: 'under',
                odds: item.under_odds,
                book: item.under_book,
                edge: item.under_edge,
                isValue: !!item.under_value,
              },
            ].map(cell => {
              const impliedProb = cell.odds ? Math.round((1 / cell.odds) * 100) : null;
              const profit = cell.isValue ? profitPer10(cell.odds) : null;
              const sel = isSelected(cell.outcome);
              return (
                <div key={cell.outcome} className={`bg-surface p-3 relative ${cell.isValue ? 'bg-signal/5' : ''}`}>
                  <div className="flex items-center gap-1 mb-2 min-h-[20px]">
                    <span className="text-ghost text-xs font-medium">{cell.label}</span>
                    {cell.isValue && (
                      <span className="text-xs px-1 py-px rounded bg-signal/20 text-signal font-bold">VALUE</span>
                    )}
                  </div>
                  <div className={`text-2xl font-bold mb-0.5 ${cell.isValue ? 'text-signal' : 'text-chalk'}`}>
                    {cell.odds?.toFixed(2) ?? '—'}
                  </div>
                  <div className="text-ghost text-xs mb-2">{cell.book ? bookLabel(cell.book) : '—'}</div>
                  <div className="space-y-0.5 text-xs">
                    {impliedProb != null && (
                      <div className="flex justify-between gap-2">
                        <span className="text-ghost">Market</span>
                        <span className="text-dim">{impliedProb}%</span>
                      </div>
                    )}
                    {cell.edge != null && (
                      <div className="flex justify-between gap-2">
                        <span className="text-ghost">Edge</span>
                        <span className={edgeColor(cell.edge)}>{formatEdge(cell.edge)}</span>
                      </div>
                    )}
                    {profit && (
                      <div className="flex justify-between gap-2 mt-1 pt-1 border-t border-line/50">
                        <span className="text-ghost">Per £10</span>
                        <span className="text-signal font-medium">£{profit}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleSelection(cell.outcome, cell.odds, cell.book, null)}
                    className={`absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      sel ? 'bg-signal text-pitch' : 'bg-muted text-dim hover:bg-ghost hover:text-chalk'
                    }`}
                  >
                    {sel ? '✓' : '+'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isRuby && maxEdgePct && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-ruby/20 text-ruby font-bold border border-ruby/30">
              RUBY +{maxEdgePct}%
            </span>
          )}
          {!isRuby && isValue && maxEdgePct && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-signal/20 text-signal font-bold border border-signal/30">
              VALUE +{maxEdgePct}%
            </span>
          )}
          {item.value_book_count != null && item.soft_book_count != null && item.soft_book_count > 0 && (
            <span className="text-ghost text-xs">
              {item.value_book_count} of {item.soft_book_count} books offer value
            </span>
          )}
          {item.mes_score != null && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-dim tabular-nums">
              MES {item.mes_score}
            </span>
          )}
          {item.computed_at && (
            <span className="text-ghost text-xs tabular-nums">
              {new Date(item.computed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          onClick={handleExpandOdds}
          className="text-ghost hover:text-chalk text-xs transition-colors"
        >
          {expanded ? 'Hide odds ↑' : 'All odds ↓'}
        </button>
      </div>

      {/* Expanded odds table */}
      {expanded && (
        <div className="border-t border-line px-4 pb-4">
          {loadingOdds ? (
            <div className="py-4 text-center text-ghost text-xs">Loading…</div>
          ) : allOdds && allOdds.length > 0 ? (
            <>
              <table className="w-full text-xs mt-3">
                <thead>
                  <tr className="text-ghost border-b border-line">
                    <th className="text-left pb-2 font-medium">Bookmaker</th>
                    <th className="text-right pb-2 font-medium">Home</th>
                    <th className="text-right pb-2 font-medium">Draw</th>
                    <th className="text-right pb-2 font-medium">Away</th>
                    <th className="text-right pb-2 font-medium">vs Market</th>
                  </tr>
                </thead>
                <tbody>
                  {allOdds.map((row, i) => {
                    const avgHI = allOdds.reduce((s, b) => s + (b.home_odds ? 1 / b.home_odds : 0), 0) / allOdds.length;
                    const avgDI = allOdds.reduce((s, b) => s + (b.draw_odds ? 1 / b.draw_odds : 0), 0) / allOdds.length;
                    const avgAI = allOdds.reduce((s, b) => s + (b.away_odds ? 1 / b.away_odds : 0), 0) / allOdds.length;
                    const diffs = [
                      row.home_odds ? avgHI - 1 / row.home_odds : -1,
                      row.draw_odds ? avgDI - 1 / row.draw_odds : -1,
                      row.away_odds ? avgAI - 1 / row.away_odds : -1,
                    ];
                    const maxDiff = Math.max(...diffs);
                    return (
                      <tr key={i} className="border-b border-line/40">
                        <td className="py-1.5 text-dim">{bookLabel(row.bookmaker)}</td>
                        <td className="text-right py-1.5 text-chalk tabular-nums">{row.home_odds?.toFixed(2) ?? '—'}</td>
                        <td className="text-right py-1.5 text-chalk tabular-nums">{row.draw_odds?.toFixed(2) ?? '—'}</td>
                        <td className="text-right py-1.5 text-chalk tabular-nums">{row.away_odds?.toFixed(2) ?? '—'}</td>
                        <td className="text-right py-1.5 tabular-nums">
                          {maxDiff > 0.001
                            ? <span className="text-signal">+{(maxDiff * 100).toFixed(1)}%</span>
                            : <span className="text-ghost">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(() => {
                const outlier = getOutlier(allOdds);
                return outlier ? (
                  <p className="mt-3 text-xs text-signal">
                    🔥 {outlier.book} is {outlier.pct}% above market on {outlier.outcome}
                  </p>
                ) : null;
              })()}
            </>
          ) : (
            <p className="py-4 text-center text-ghost text-xs">No bookmaker data available</p>
          )}
        </div>
      )}
    </div>
  );
}
