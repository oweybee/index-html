export default function EmptyState({ error, loading }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-8 h-8 border-2 border-signal border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-dim text-sm">Scanning markets…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-warn text-sm mb-2">Feed unavailable</p>
        <p className="text-ghost text-xs max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-dim text-sm mb-1">No signals detected</p>
      <p className="text-ghost text-xs max-w-xs">
        Try adjusting filters or check back after the next engine run
      </p>
    </div>
  );
}
