"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Spinner } from '@/components/ui/Spinner';
import { FinalBookCard } from '@/components/match/FinalBookCard';
import { SnapshotGrid } from '@/components/match/SnapshotGrid';

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  const fetchMatch = useCallback(async (silent = false) => {
    try {
      const data = await api.getMatch(matchId);
      setMatch(data);
    } catch (err) {
      console.error(err);
      if (!silent) router.push('/');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [matchId, router]);

  // Initial load + socket subscription
  useEffect(() => {
    if (!matchId) return;

    fetchMatch();
    api.getPollingStatus(matchId).then((d) => setIsPolling(d.isPolling)).catch(console.error);

    const socket = getSocket();
    socket.emit('join_match', matchId);

    socket.on('odds_update', (data) => {
      if (data.matchId !== matchId) return;

      setMatch((prev: any) => {
        if (!prev) return prev;
        const existingIds = new Set(
          (prev.snapshots || []).map((s: any) => s._id || s.sequenceId)
        );
        const snapshotId = data.snapshot._id || data.snapshot.sequenceId;

        if (existingIds.has(snapshotId)) {
          return { ...prev, finalBook: data.finalBook };
        }

        return {
          ...prev,
          finalBook: data.finalBook,
          snapshots: [...(prev.snapshots || []), data.snapshot],
        };
      });
    });

    return () => {
      socket.emit('leave_match', matchId);
      socket.off('odds_update');
    };
  }, [matchId, fetchMatch]);

  const handleStartPolling = async () => {
    setIsPolling(true);
    try {
      await api.startPolling(matchId);
    } catch (err) {
      console.error('Failed to start polling:', err);
      setIsPolling(false);
    }
  };

  const handleStopPolling = async () => {
    setIsPolling(false);
    try {
      await api.stopPolling(matchId);
    } catch (err) {
      console.error('Failed to stop polling:', err);
    }
  };

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!match) return null;

  return (
    <div className="p-6 md:p-8 z-10 relative">
      <div className="max-w-7xl mx-auto">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center text-cyan-400 hover:text-cyan-300 transition-colors mb-6 group font-medium text-sm"
        >
          <svg className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Match Header */}
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {match.status?.toUpperCase()}
              </span>
              <span className="text-slate-400 font-mono text-sm">Market: {match.marketId}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">
              {match.name}
            </h1>
          </div>

          {/* Polling Toggle */}
          <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700/50 self-stretch md:self-auto min-w-[180px]">
            {isPolling ? (
              <button
                onClick={handleStopPolling}
                className="flex-1 px-6 py-3 rounded-lg bg-red-500/20 text-red-400 font-semibold flex items-center justify-center gap-2 hover:bg-red-500/30 transition-colors border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                Stop Polling
              </button>
            ) : (
              <button
                onClick={handleStartPolling}
                className="flex-1 px-6 py-3 rounded-lg bg-emerald-500/20 text-emerald-400 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Polling
              </button>
            )}
          </div>
        </div>

        {/* Final Book */}
        {match.finalBook && (
          <FinalBookCard
            finalBook={match.finalBook}
            teamA={match.teamA}
            teamB={match.teamB}
          />
        )}

        {/* Snapshots */}
        <SnapshotGrid
          snapshots={match.snapshots}
          teamA={match.teamA}
          teamB={match.teamB}
        />
      </div>
    </div>
  );
}
