import Link from 'next/link';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface MatchCardProps {
  match: any;
  onDelete: (match: any) => void;
}

export function MatchCard({ match, onDelete }: MatchCardProps) {
  return (
    <div className="relative group/card cursor-pointer">
      <Link href={`/match/${match._id}`} className="block">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-700/50 hover:border-cyan-500/30 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-[40px] pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />

          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pr-10">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg text-slate-100 uppercase tracking-wide group-hover:text-cyan-400 transition-colors truncate">
                {match.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-400 font-mono">
                <span className="inline-flex items-center gap-1.5 bg-slate-800 py-1 px-2.5 rounded-lg border border-slate-700/50">
                  EV: <span className="text-slate-200">{match.eventId || '---'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-slate-800 py-1 px-2.5 rounded-lg border border-slate-700/50">
                  MKT: <span className="text-slate-200">{match.marketId || '---'}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <StatusBadge status={match.status} />
              <span className="text-xs text-slate-500 flex items-center gap-1">
                {new Date(match.createdAt || match.startTime).toLocaleString()}
                <svg className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Delete button (overlay) */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(match); }}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white border border-slate-700/50 hover:border-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-300 shadow-md hover:shadow-[0_0_15px_rgba(244,63,94,0.4)]"
        title="Delete Match"
        aria-label={`Delete ${match.name}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
