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
        <div className="p-3 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 hover:border-cyan-500/30 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/5 rounded-bl-[30px] pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />

          <div className="flex flex-col justify-between items-start gap-2 pr-8">
            <div className="w-full">
              <div className="flex justify-between items-start w-full">
                <h3 className="font-semibold text-sm sm:text-base text-slate-100 uppercase tracking-wide group-hover:text-cyan-400 transition-colors truncate max-w-[80%]">
                  {match.name}
                </h3>
                <StatusBadge status={match.status} />
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 w-full">
                <div className="flex gap-2 text-[10px] sm:text-xs text-slate-400 font-mono">
                  <span className="inline-flex items-center gap-1 bg-slate-800 py-0.5 px-2 rounded-md border border-slate-700/50">
                    EV: <span className="text-slate-200">{match.eventId || '---'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-800 py-0.5 px-2 rounded-md border border-slate-700/50">
                    MKT: <span className="text-slate-200">{match.marketId || '---'}</span>
                  </span>
                </div>
                
                <span className="text-[10px] sm:text-xs text-slate-500 flex items-center">
                  {new Date(match.createdAt || match.startTime).toLocaleString()}
                  <svg className="w-3 h-3 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Delete button (overlay) */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(match); }}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white border border-slate-700/50 hover:border-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-300 shadow-md hover:shadow-[0_0_15px_rgba(244,63,94,0.4)]"
        title="Delete Match"
        aria-label={`Delete ${match.name}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
