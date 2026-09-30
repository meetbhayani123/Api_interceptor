/**
 * Placeholder shown while the first match fetch is in flight, so the dashboard
 * never briefly claims "No matches yet" before the data has arrived.
 */
export function MatchCardSkeleton() {
  return (
    <div
      className="rounded-lg bg-surface-raised/60 border border-subtle/50 border-l-2 border-l-subtle animate-pulse"
      aria-hidden="true"
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="h-3 w-2/3 rounded bg-slate-700/60" />
      </div>
      <div className="px-3 pb-1.5 flex items-center gap-1.5">
        <div className="h-3 w-12 rounded bg-slate-700/50" />
        <div className="h-3 w-24 rounded bg-surface/70" />
      </div>
      <div className="px-3 pb-1.5 flex gap-1.5">
        <div className="h-7 flex-1 rounded bg-surface/70" />
        <div className="h-7 flex-1 rounded bg-surface/70" />
      </div>
      <div className="px-3 pb-2 flex items-center justify-between">
        <div className="h-4 w-14 rounded bg-surface/70" />
        <div className="h-3 w-28 rounded bg-surface/50" />
      </div>
    </div>
  );
}
