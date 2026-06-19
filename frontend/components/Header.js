'use client';

export default function Header({ signalCount, onRefresh, lastRefresh }) {
  const timeStr = lastRefresh
    ? lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="border-b border-line bg-surface sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-chalk select-none">
            E<span className="text-signal">V</span>E
          </span>
          <span className="text-ghost text-xs hidden sm:block">
            Value Edge Intelligence
          </span>
        </div>

        <div className="flex items-center gap-4">
          {signalCount > 0 && (
            <span className="text-signal text-sm font-medium">
              {signalCount} signal{signalCount !== 1 ? 's' : ''}
            </span>
          )}
          {timeStr && (
            <span className="text-ghost text-xs hidden sm:block">
              Updated {timeStr}
            </span>
          )}
          <button
            onClick={onRefresh}
            className="text-dim hover:text-chalk text-xs transition-colors px-2 py-1 rounded border border-line hover:border-dim"
          >
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
