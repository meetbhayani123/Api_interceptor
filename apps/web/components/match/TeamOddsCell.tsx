interface TeamOddsCellProps {
  teamName: string;
  odds: number[];
  pricing: number[];
}

export function TeamOddsCell({ teamName, odds, pricing }: TeamOddsCellProps) {
  return (
    <div className="bg-surface-raised/50 rounded-lg p-2 sm:p-3 border border-subtle/50 min-w-0">
      <h4 className="text-xs sm:text-sm font-semibold text-slate-300 mb-2 sm:mb-3 truncate" title={teamName}>
        {teamName}
      </h4>
      <div className="space-y-2">
        {/* Back Odds */}
        <div className="flex justify-between gap-1 text-[11px] sm:text-xs bg-back/10 p-1.5 sm:p-2 rounded border border-back/20 tabular-nums">
          <span className="text-back font-bold">{odds[0]?.toFixed(2)}</span>
          <span className="text-back/80">{pricing[0]?.toLocaleString()}</span>
        </div>
        {/* Lay Odds */}
        <div className="flex justify-between gap-1 text-[11px] sm:text-xs bg-lay/10 p-1.5 sm:p-2 rounded border border-lay/20 tabular-nums">
          <span className="text-lay font-bold">{odds[1]?.toFixed(2)}</span>
          <span className="text-lay/80">{pricing[1]?.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
