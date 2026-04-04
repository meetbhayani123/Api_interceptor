interface TeamOddsCellProps {
  teamName: string;
  odds: number[];
  pricing: number[];
}

export function TeamOddsCell({ teamName, odds, pricing }: TeamOddsCellProps) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
      <h4 className="text-sm font-semibold text-slate-300 mb-3 truncate" title={teamName}>
        {teamName}
      </h4>
      <div className="space-y-2">
        {/* Back Odds */}
        <div className="flex justify-between text-xs bg-[#1e3a8a]/20 p-2 rounded border border-blue-500/20">
          <span className="text-blue-300 font-bold">{odds[0]?.toFixed(2)}</span>
          <span className="text-blue-400">{pricing[0]?.toLocaleString()}</span>
        </div>
        {/* Lay Odds */}
        <div className="flex justify-between text-xs bg-[#9f1239]/20 p-2 rounded border border-rose-500/20">
          <span className="text-rose-300 font-bold">{odds[1]?.toFixed(2)}</span>
          <span className="text-rose-400">{pricing[1]?.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
