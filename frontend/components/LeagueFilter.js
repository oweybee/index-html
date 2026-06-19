'use client';

const LEAGUES = [
  { id: 'soccer_fifa_world_cup', name: 'World Cup' },
  { id: 'soccer_conmebol_copa_libertadores', name: 'Libertadores' },
  { id: 'soccer_norway_eliteserien', name: 'Eliteserien' },
  { id: 'soccer_sweden_allsvenskan', name: 'Allsvenskan' },
  { id: 'soccer_brazil_serie_b', name: 'Brazil B' },
];

export default function LeagueFilter({ selected, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-dim text-xs shrink-0">Competition:</span>
      <button
        onClick={() => onChange(null)}
        className={`text-xs px-2 py-1 rounded border transition-colors ${
          selected === null
            ? 'border-signal text-signal bg-signal/10'
            : 'border-line text-ghost hover:border-dim hover:text-dim'
        }`}
      >
        All
      </button>
      {LEAGUES.map(league => (
        <button
          key={league.id}
          onClick={() => onChange(league.id)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            selected === league.id
              ? 'border-signal text-signal bg-signal/10'
              : 'border-line text-ghost hover:border-dim hover:text-dim'
          }`}
        >
          {league.name}
        </button>
      ))}
    </div>
  );
}
