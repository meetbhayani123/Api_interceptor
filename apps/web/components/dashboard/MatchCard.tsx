import Link from 'next/link';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface MatchCardProps {
  match: any;
  onDelete: (match: any) => void;
  onTogglePolling?: (matchId: string, currentStatus: boolean) => void;
}

export function MatchCard({ match, onDelete, onTogglePolling }: MatchCardProps) {
  const teamA_PL = match.finalBook?.teamA_PL;
  const teamB_PL = match.finalBook?.teamB_PL;
  const hasBook = typeof teamA_PL === 'number' && typeof teamB_PL === 'number';

  return (
    <div className="relative group/card">
      {/* Delete button — always visible on touch, hover on desktop */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(match); }}
        className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white border border-slate-700/50 hover:border-transparent opacity-60 sm:opacity-0 group-hover/card:opacity-100 transition-all duration-200 shadow-md"
        title="Delete Match"
        aria-label={`Delete ${match.name}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      <Link href={`/match/${match._id}`} className="block">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50 hover:border-cyan-500/30 transition-all relative overflow-hidden">
          {/* Decorative corner */}
          <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/5 rounded-bl-[30px] pointer-events-none" />

          {/* ── Row 1: Match Name + Status ── */}
          <div className="flex items-start justify-between gap-2 pr-6 mb-2">
            <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wide hover:text-cyan-400 transition-colors truncate min-w-0 flex-1">
              {match.name}
            </h3>
            <div className="shrink-0">
              <StatusBadge status={match.status} />
            </div>
          </div>

          {/* ── Row 2: Book Status ── */}
          {hasBook && (
            <div className="mb-2 p-2 bg-slate-800/60 rounded-lg border border-slate-700/40 text-xs">
              <div className="flex justify-between items-center text-slate-500 mb-1.5 text-[10px]">
                <span className="uppercase tracking-wider font-medium">Book</span>
                <span>{match.totalSnapshotCount || 0} snapshots</span>
              </div>
              <div className="flex gap-2">
                {/* Team A */}
                <div className={`flex-1 min-w-0 flex justify-between items-center px-2 py-1 rounded-md ${teamA_PL >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <span className="truncate text-[10px] font-medium mr-1" title={match.teamA}>{match.teamA}</span>
                  <span className="font-bold text-xs shrink-0">
                    {teamA_PL > 0 ? `+${teamA_PL.toFixed(2)}` : teamA_PL.toFixed(2)}
                  </span>
                </div>
                {/* Team B */}
                <div className={`flex-1 min-w-0 flex justify-between items-center px-2 py-1 rounded-md ${teamB_PL >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <span className="truncate text-[10px] font-medium mr-1" title={match.teamB}>{match.teamB}</span>
                  <span className="font-bold text-xs shrink-0">
                    {teamB_PL > 0 ? `+${teamB_PL.toFixed(2)}` : teamB_PL.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Row 3: Actions + Meta ── */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Left: Start/Stop button */}
            {onTogglePolling && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePolling(match._id, match.isPolling); }}
                className={`shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                  match.isPolling
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start
                  </>
                )}
              </button>
            )}

            {/* Right: EV + MKT truncated */}
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500 min-w-0 overflow-hidden">
              <span className="shrink-0">EV:</span>
              <span className="text-slate-400 truncate max-w-[60px]">{match.eventId || '---'}</span>
              <span className="shrink-0 ml-1">MKT:</span>
              <span className="text-slate-400 truncate max-w-[60px]">{match.marketId || '---'}</span>
            </div>
          </div>

          {/* ── Row 4: Date ── */}
          <div className="mt-1.5 text-[9px] text-slate-600">
            {new Date(match.createdAt || match.startTime).toLocaleString()}
          </div>
        </div>
      </Link>
    </div>
  );
}
