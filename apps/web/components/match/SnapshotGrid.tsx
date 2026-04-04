import { TeamOddsCell } from './TeamOddsCell';

interface SnapshotGridProps {
  snapshots: any[];
  teamA: string;
  teamB: string;
}

export function SnapshotGrid({ snapshots, teamA, teamB }: SnapshotGridProps) {
  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="bg-slate-800/20 border border-slate-700/30 border-dashed rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center">
        <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-lg">No odds tracked yet.</p>
        <p className="text-sm text-slate-600 mt-2">Click &apos;Start Polling&apos; to begin capturing live snapshots.</p>
      </div>
    );
  }

  const total = snapshots.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-3 border-b-2 border-cyan-500/30 pb-2 pr-4">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Live Snapshot Grid
        </h2>
        <span className="text-sm font-mono text-slate-400">Total Frames: {total}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {snapshots.slice().reverse().map((snap: any, index: number) => (
          <div
            key={snap._id || index}
            className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:border-cyan-500/30 transition-all shadow-lg"
          >
            <div className="flex justify-between items-center mb-4 border-b border-slate-700/50 pb-3">
              <span className="text-xs font-mono bg-slate-900/50 px-2 py-1 rounded text-cyan-400">
                FRAME #{total - index}
              </span>
              <span className="text-sm text-slate-400">
                {new Date(snap.capturedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TeamOddsCell
                teamName={teamA || 'Team A'}
                odds={snap.teamA.odds}
                pricing={snap.teamA.pricing}
              />
              <TeamOddsCell
                teamName={teamB || 'Team B'}
                odds={snap.teamB.odds}
                pricing={snap.teamB.pricing}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
