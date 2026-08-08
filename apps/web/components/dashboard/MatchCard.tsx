import Link from 'next/link';

interface MatchCardProps {
  match: any;
  onDelete: (match: any) => void;
  onTogglePolling?: (matchId: string, currentStatus: boolean) => void;
}

export function MatchCard({ match, onDelete, onTogglePolling }: MatchCardProps) {
  const teamA_PL = match.finalBook?.teamA_PL;
  const teamB_PL = match.finalBook?.teamB_PL;
  const hasBook = typeof teamA_PL === 'number' && typeof teamB_PL === 'number';

  const isRunning = match.status === 'running' || match.isPolling;

  // Countdown helper
  const countdown = (() => {
    if (!match.startTime) return null;
    const diff = new Date(match.startTime).getTime() - Date.now();
    if (isRunning) return { label: 'LIVE', type: 'live' as const };
    if (diff > 0) {
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return { label: `in ${hrs > 0 ? `${hrs}h ` : ''}${mins}m`, type: 'upcoming' as const };
    }
    return null;
  })();

  return (
    <div className="relative group/card">
      {/* Delete button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(match); }}
        className="absolute top-1.5 right-1.5 z-20 p-1 rounded-full bg-slate-800/90 text-slate-500 hover:bg-rose-500 hover:text-white border border-slate-700/50 hover:border-transparent opacity-70 sm:opacity-0 group-hover/card:opacity-100 transition-all duration-200"
        title="Delete Match"
        aria-label={`Delete ${match.name}`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <Link href={`/match/${match._id}`} className="block">
        <div className={`rounded-lg bg-slate-900/60 border border-slate-700/50 hover:border-cyan-500/30 transition-all relative overflow-hidden ${
          isRunning ? 'border-l-2 border-l-emerald-500' : 'border-l-2 border-l-cyan-500/50'
        }`}>

          {/* ── Top: Match Name ── */}
          <div className="px-3 pt-2.5 pb-1.5 pr-7">
            <h3 className="font-bold text-[13px] text-slate-100 uppercase leading-tight">
              {match.name}
            </h3>
          </div>

          {/* ── Row 2: Status + Start At + Countdown — all in one line ── */}
          <div className="px-3 pb-1.5 flex items-center gap-1.5 flex-wrap">
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
              isRunning
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : match.status === 'completed'
                  ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
            }`}>
              {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              {isRunning ? 'live' : match.status}
            </span>

            {/* Start At */}
            {match.startTime && (
              <span className="flex items-center gap-1 text-[9px] text-slate-500">
                <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-slate-400">
                  {new Date(match.startTime).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
                  })}
                </span>
              </span>
            )}

            {/* Countdown badge */}
            {countdown && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                countdown.type === 'live'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}>
                {countdown.label}
              </span>
            )}
          </div>

          {/* ── Book Data (only when available) ── */}
          {hasBook && (
            <div className="px-3 pb-1.5">
              <div className="flex gap-1.5">
                {/* Team A PL */}
                <div className={`flex-1 flex items-center justify-between px-2 py-1 rounded ${
                  teamA_PL >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                }`}>
                  <span className="text-[9px] text-slate-400 font-medium truncate mr-1">{match.teamA}</span>
                  <span className={`text-[11px] font-bold shrink-0 ${
                    teamA_PL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {teamA_PL > 0 ? '+' : ''}{teamA_PL.toFixed(2)}
                  </span>
                </div>
                {/* Team B PL */}
                <div className={`flex-1 flex items-center justify-between px-2 py-1 rounded ${
                  teamB_PL >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                }`}>
                  <span className="text-[9px] text-slate-400 font-medium truncate mr-1">{match.teamB}</span>
                  <span className={`text-[11px] font-bold shrink-0 ${
                    teamB_PL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {teamB_PL > 0 ? '+' : ''}{teamB_PL.toFixed(2)}
                  </span>
                </div>
              </div>
              {(match.totalSnapshotCount > 0) && (
                <div className="text-right text-[8px] text-slate-600 mt-0.5">{match.totalSnapshotCount} snaps</div>
              )}
            </div>
          )}

          {/* ── Bottom: Start/Stop + IDs ── */}
          <div className="px-3 pb-2 flex items-center justify-between gap-2">
            {/* Start/Stop */}
            {onTogglePolling && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePolling(match._id, match.isPolling); }}
                className={`shrink-0 px-2 py-0.5 rounded border text-[9px] font-bold flex items-center gap-1 transition-colors ${
                  match.isPolling
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                }`}
              >
                {match.isPolling ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    Stop
                  </>
                ) : (
                  <>
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    Start
                  </>
                )}
              </button>
            )}

            {/* EV + MKT — compact */}
            <div className="flex items-center gap-1 font-mono text-[8px] text-slate-600 min-w-0 overflow-hidden">
              <span className="shrink-0">EV:</span>
              <span className="truncate max-w-[50px]">{match.eventId || '---'}</span>
              <span className="shrink-0">MKT:</span>
              <span className="truncate max-w-[60px]">{match.marketId || '---'}</span>
            </div>
          </div>

        </div>
      </Link>
    </div>
  );
}
