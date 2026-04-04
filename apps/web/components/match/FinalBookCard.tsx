import { formatCurrency } from '@/lib/format';

interface FinalBookCardProps {
  finalBook: { teamA_PL: number; teamB_PL: number };
  teamA: string;
  teamB: string;
}

export function FinalBookCard({ finalBook, teamA, teamB }: FinalBookCardProps) {
  return (
    <div className="bg-slate-800/40 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6 md:p-8 mb-8 shadow-[0_0_30px_rgba(6,182,212,0.1)] relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <h2 className="text-xl font-bold flex items-center gap-3 border-b border-slate-700/50 pb-4 mb-6">
        <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Final Book
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        <TeamProjection label={teamA || 'Team A'} value={finalBook.teamA_PL} />
        <TeamProjection label={teamB || 'Team B'} value={finalBook.teamB_PL} />
      </div>
    </div>
  );
}

function TeamProjection({ label, value }: { label: string; value: number }) {
  const isProfit = value >= 0;

  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 flex flex-col items-center justify-center">
      <span className="text-slate-400 text-sm font-semibold mb-2">{label} Projection</span>
      <span
        className={`text-4xl font-black ${
          isProfit
            ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]'
            : 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'
        }`}
      >
        {formatCurrency(value)}
      </span>
      <span className="text-xs text-slate-500 mt-2 font-mono">
        Raw: {value?.toFixed(4)}
      </span>
    </div>
  );
}
