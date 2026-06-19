'use client';

const TIME_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export default function TimeFilter({ selected, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-dim text-xs shrink-0">Time:</span>
      {TIME_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            selected === opt.value
              ? 'border-signal text-signal bg-signal/10'
              : 'border-line text-ghost hover:border-dim hover:text-dim'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
