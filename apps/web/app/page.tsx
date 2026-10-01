"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { ImportPanel } from '@/components/dashboard/ImportPanel';
import { MatchCard } from '@/components/dashboard/MatchCard';
import { MatchCardSkeleton } from '@/components/dashboard/MatchCardSkeleton';
import { DeleteModal } from '@/components/modals/DeleteModal';
import { Card } from '@/components/ui/Card';

export default function DashboardPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchMatches = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getMatches();
      setMatches(data);
    } catch (err: any) {
      // Surface this — a silent console.error leaves an empty dashboard that
      // looks identical to "you have no matches".
      setError(err?.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const matchIdsStr = useMemo(() => matches.map(m => m._id).join(','), [matches]);

  useEffect(() => {
    if (!matchIdsStr) return;
    const socket = getSocket();
    const ids = matchIdsStr.split(',');

    ids.forEach(id => socket.emit('join_match', id));

    const handleOddsUpdate = (data: any) => {
      setMatches((prev) =>
        prev.map((m) =>
          m._id === data.matchId
            ? {
                ...m,
                finalBook: data.finalBook,
                totalSnapshotCount: data.totalSnapshotCount,
                // Keep feed health current, or a card would look stale while
                // odds are visibly updating in front of the user.
                lastSuccessfulPollAt: data.lastSuccessfulPollAt ?? m.lastSuccessfulPollAt,
                consecutiveFailures: data.consecutiveFailures ?? m.consecutiveFailures,
                lastPollError: data.consecutiveFailures === 0 ? undefined : m.lastPollError,
              }
            : m
        )
      );
    };

    socket.on('odds_update', handleOddsUpdate);

    return () => {
      ids.forEach(id => socket.emit('leave_match', id));
      socket.off('odds_update', handleOddsUpdate);
    };
  }, [matchIdsStr]);

  const handleTogglePolling = async (matchId: string, currentPollingStatus: boolean) => {
    const next = !currentPollingStatus;
    setMatches(prev => prev.map(m => m._id === matchId ? { ...m, isPolling: next } : m));

    try {
      await (next ? api.startPolling(matchId) : api.stopPolling(matchId));
    } catch (err: any) {
      setError(err?.message || `Could not ${next ? 'start' : 'stop'} polling.`);
      fetchMatches();
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 z-10 relative w-full">
      <div className="max-w-4xl mx-auto flex flex-col gap-4 sm:gap-6 w-full">

        {/* Import Panel */}
        <ImportPanel onImportSuccess={fetchMatches} />

        {/* Matches List */}
        <Card padding="none" className="w-full flex flex-col overflow-hidden">
          <div className="p-4 border-b border-subtle/50 bg-surface/60 flex justify-between items-center gap-3">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 min-w-0">
              <svg className="w-5 h-5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="truncate">Recent Matches</span>
            </h2>
            <span className="px-3 py-1 bg-slate-700/50 rounded-full text-xs font-medium text-slate-300 shrink-0 tabular-nums">
              {loading ? 'Loading…' : `${matches.length} total`}
            </span>
          </div>

          {/* On phones the list flows with the page; only on larger screens does
              it become its own scroll region, so there is no nested scrolling. */}
          <div className="flex-1 sm:overflow-y-auto sm:max-h-[65vh] p-3 sm:p-4 space-y-2 custom-scrollbar">
            {error && (
              <div
                role="alert"
                className="mb-3 p-3 rounded-xl bg-danger/10 border border-danger/30 text-rose-200 text-sm flex items-start gap-2"
              >
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="flex-1 min-w-0">{error}</span>
                <button
                  onClick={fetchMatches}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-danger/20 hover:bg-danger/30 text-rose-100 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
                >
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <MatchCardSkeleton key={i} />
                ))}
              </div>
            ) : matches.length === 0 && !error ? (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-3 py-10 px-4 text-center">
                <svg className="w-10 h-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-sm">No matches yet. Import events to get started.</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {matches.map((match) => (
                  <MatchCard
                    key={match._id}
                    match={match}
                    onDelete={setDeleteTarget}
                    onTogglePolling={handleTogglePolling}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Delete Modal */}
      {deleteTarget && (
        <DeleteModal
          match={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); fetchMatches(); }}
        />
      )}
    </div>
  );
}
