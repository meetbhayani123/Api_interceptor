import { formatCurrency } from '@/lib/format';

interface BookHighLow {
  teamA_high: number;
  teamA_low: number;
  teamB_high: number;
  teamB_low: number;
}

interface BookResult {
  teamA_PL: number;
  teamB_PL: number;
}

interface HighLowBookCardProps {
  bookHighLow: BookHighLow;
  currentBook: BookResult;
  teamA: string;
  teamB: string;
}

export function HighLowBookCard({ bookHighLow, currentBook, teamA, teamB }: HighLowBookCardProps) {
  const teamAName = teamA || 'Team A';
  const teamBName = teamB || 'Team B';

  return (
    <div className="bg-slate-800/40 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-6 md:p-8 mb-8 shadow-[0_0_30px_rgba(245,158,11,0.1)] relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <h2 className="text-xl font-bold flex items-center gap-3 border-b border-slate-700/50 pb-4 mb-6 relative z-10">
        <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        Book High &amp; Low (All-Time)
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {/* Team A */}
        <TeamHighLowPanel
          teamName={teamAName}
          high={bookHighLow.teamA_high}
          low={bookHighLow.teamA_low}
          current={currentBook.teamA_PL}
        />

        {/* Team B */}
        <TeamHighLowPanel
          teamName={teamBName}
          high={bookHighLow.teamB_high}
          low={bookHighLow.teamB_low}
          current={currentBook.teamB_PL}
        />
      </div>
    </div>
  );
}

function TeamHighLowPanel({
  teamName,
  high,
  low,
  current,
}: {
  teamName: string;
  high: number;
  low: number;
  current: number;
}) {
  // Gauge: where does current sit between low and high?
  const range = high - low;
  const pct = range > 0 ? ((current - low) / range) * 100 : 50;

  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5">
      {/* Team name */}
      <div className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        {teamName}
      </div>

      {/* High */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">All-Time High</span>
        </div>
        <span className={`text-xl font-black ${
          high >= 0
            ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]'
            : 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]'
        }`}>
          {formatCurrency(high)}
        </span>
      </div>

      {/* Low */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">All-Time Low</span>
        </div>
        <span className={`text-xl font-black ${
          low >= 0
            ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]'
            : 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]'
        }`}>
          {formatCurrency(low)}
        </span>
      </div>

      {/* Visual gauge bar */}
      <div className="mb-3">
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-rose-400/60 font-mono">Low</span>
          <span className="text-[10px] text-emerald-400/60 font-mono">High</span>
        </div>
      </div>

      {/* Current */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700/30">
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Current</span>
        <span className={`text-lg font-bold ${
          current >= 0 ? 'text-emerald-400' : 'text-rose-400'
        }`}>
          {formatCurrency(current)}
        </span>
      </div>

      {/* Raw values */}
      <div className="mt-2 text-[10px] text-slate-600 font-mono space-y-0.5">
        <div>High raw: {high?.toFixed(4)} &nbsp;|&nbsp; Low raw: {low?.toFixed(4)}</div>
        <div>Current raw: {current?.toFixed(4)}</div>
      </div>
    </div>
  );
}
