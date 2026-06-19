'use client';
import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import FeedMeta from '../components/FeedMeta';
import LeagueFilter from '../components/LeagueFilter';
import TimeFilter from '../components/TimeFilter';
import MatchCard from '../components/MatchCard';
import BetslipSidebar from '../components/BetslipSidebar';
import EmptyState from '../components/EmptyState';
import { fetchValueFeed } from '../lib/feed';
import { useBetslip } from '../contexts/BetslipContext';

const REFRESH_MS = 15000;

function inTimeframe(kickoffAt, tf) {
  if (!kickoffAt) return false;
  const k = new Date(kickoffAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const dayAfter = new Date(today.getTime() + 172800000);
  const weekEnd = new Date(today.getTime() + 7 * 86400000);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  if (tf === 'today') return k >= today && k < tomorrow;
  if (tf === 'tomorrow') return k >= tomorrow && k < dayAfter;
  if (tf === 'week') return k >= today && k < weekEnd;
  if (tf === 'month') return k >= today && k < monthEnd;
  return true;
}

function inEdgeBand(maxEdge, band) {
  if (band === 'high') return maxEdge != null && maxEdge >= 0.08;
  if (band === 'mid') return maxEdge != null && maxEdge >= 0.03 && maxEdge < 0.08;
  if (band === 'low') return maxEdge != null && maxEdge > 0 && maxEdge < 0.03;
  if (band === 'none') return maxEdge == null || maxEdge <= 0;
  return false;
}

function getMaxAiProb(item) {
  const probs = [
    item.home_edge != null && item.best_home_odds ? item.home_edge + 1 / item.best_home_odds : null,
    item.draw_edge != null && item.best_draw_odds ? item.draw_edge + 1 / item.best_draw_odds : null,
    item.away_edge != null && item.best_away_odds ? item.away_edge + 1 / item.best_away_odds : null,
  ].filter(p => p != null);
  return probs.length ? Math.max(...probs) : 0;
}

function getShortestOdds(item) {
  const odds = [item.best_home_odds, item.best_draw_odds, item.best_away_odds].filter(Boolean);
  return odds.length ? Math.min(...odds) : Infinity;
}

function getLongestOdds(item) {
  const odds = [item.best_home_odds, item.best_draw_odds, item.best_away_odds].filter(Boolean);
  return odds.length ? Math.max(...odds) : 0;
}

function sortItems(items, sortKey) {
  const ruby = items.filter(i => i.home_ruby || i.draw_ruby || i.away_ruby);
  const rest = items.filter(i => !i.home_ruby && !i.draw_ruby && !i.away_ruby);

  function sortGroup(arr) {
    const copy = [...arr];
    switch (sortKey) {
      case 'kickoff':
        return copy.sort((a, b) =>
          new Date(a.matches?.kickoff_at || 0) - new Date(b.matches?.kickoff_at || 0)
        );
      case 'ai_prob':
        return copy.sort((a, b) => getMaxAiProb(b) - getMaxAiProb(a));
      case 'odds_asc':
        return copy.sort((a, b) => getShortestOdds(a) - getShortestOdds(b));
      case 'odds_desc':
        return copy.sort((a, b) => getLongestOdds(b) - getLongestOdds(a));
      case 'mes':
        return copy.sort((a, b) => (b.mes_score || 0) - (a.mes_score || 0));
      case 'freshest':
        return copy.sort((a, b) => new Date(b.computed_at || 0) - new Date(a.computed_at || 0));
      case 'ruby_first':
        return copy.sort((a, b) => (b.max_edge || 0) - (a.max_edge || 0));
      default: // max_edge
        return copy.sort((a, b) => (b.max_edge || 0) - (a.max_edge || 0));
    }
  }

  return [...sortGroup(ruby), ...sortGroup(rest)];
}

export default function HomePage() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [leagueFilter, setLeagueFilter] = useState('soccer_fifa_world_cup');
  const [timeFilter, setTimeFilter] = useState('week');
  const [edgeBands, setEdgeBands] = useState(['high', 'mid', 'low', 'none']);
  const [marketView, setMarketView] = useState('both');
  const [sort, setSort] = useState('max_edge');

  const { selections } = useBetslip();
  const betslipOpen = selections.length > 0;

  const load = useCallback(async () => {
    try {
      const data = await fetchValueFeed();
      setFeed(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  function toggleEdgeBand(band) {
    setEdgeBands(prev =>
      prev.includes(band) ? prev.filter(b => b !== band) : [...prev, band]
    );
  }

  // Client-side filtering
  const filtered = feed.filter(item => {
    const match = item.matches;
    if (!match) return false;
    if (leagueFilter && match.league?.id !== leagueFilter) return false;
    if (!inTimeframe(match.kickoff_at, timeFilter)) return false;
    if (edgeBands.length < 4 && !edgeBands.some(b => inEdgeBand(item.max_edge, b))) return false;
    if (marketView === 'totals' && !item.over_odds) return false;
    if (marketView === 'match' && !item.best_home_odds) return false;
    return true;
  });

  const sorted = sortItems(filtered, sort);

  const signalCount = feed.filter(
    i => i.home_value || i.draw_value || i.away_value || i.home_ruby || i.draw_ruby || i.away_ruby
  ).length;

  return (
    <div className="min-h-screen bg-pitch">
      <Header signalCount={signalCount} onRefresh={load} lastRefresh={lastRefresh} />

      <div
        className="max-w-7xl mx-auto"
        style={betslipOpen ? { display: 'grid', gridTemplateColumns: '1fr 280px', alignItems: 'start' } : {}}
      >
        <main className="px-4 py-6 min-w-0">
          <div className="space-y-2 mb-5">
            <LeagueFilter selected={leagueFilter} onChange={setLeagueFilter} />
            <TimeFilter selected={timeFilter} onChange={setTimeFilter} />
          </div>

          <FeedMeta
            sort={sort}
            onSort={setSort}
            edgeBands={edgeBands}
            onToggleBand={toggleEdgeBand}
            marketView={marketView}
            onMarketView={setMarketView}
            total={feed.length}
            filtered={sorted.length}
          />

          {loading ? (
            <EmptyState loading />
          ) : error ? (
            <EmptyState error={error} />
          ) : sorted.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-5">
              {sorted.map((item, i) => (
                <MatchCard
                  key={item.match_id}
                  item={item}
                  rank={i + 1}
                  marketView={marketView}
                />
              ))}
            </div>
          )}
        </main>

        {betslipOpen && <BetslipSidebar />}
      </div>
    </div>
  );
}
