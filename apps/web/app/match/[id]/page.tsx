"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Spinner } from '@/components/ui/Spinner';
import { FinalBookCard } from '@/components/match/FinalBookCard';
import { HighLowBookCard } from '@/components/match/HighLowBookCard';
import { SnapshotGrid } from '@/components/match/SnapshotGrid';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { getDisplayStatus, getCountdown } from '@/lib/format';
import { useNow } from '@/lib/useNow';

const SNAPSHOT_WINDOW_SIZE = 30;

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [activeTab, setActiveTab] = useState<'full' | 'rolling5m' | 'highlow'>('full');
  const now = useNow();

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
          return {
            ...prev,
            finalBook: data.finalBook,
            rollingBook5m: data.rollingBook5m,
            bookHighLow: data.bookHighLow,
            totalSnapshotCount: data.totalSnapshotCount ?? prev.totalSnapshotCount ?? 0,
          };
        }

        const nextSnapshots = [...(prev.snapshots || []), data.snapshot].slice(-SNAPSHOT_WINDOW_SIZE);

        return {
          ...prev,
          finalBook: data.finalBook,
          rollingBook5m: data.rollingBook5m,
          bookHighLow: data.bookHighLow,
          snapshots: nextSnapshots,
          totalSnapshotCount:
            data.totalSnapshotCount ??
            (typeof prev.totalSnapshotCount === 'number'
              ? prev.totalSnapshotCount + 1
              : nextSnapshots.length),
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

  const displayStatus = getDisplayStatus(match, now);
  const countdown = getCountdown(match.startTime, now);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 md:p-8 z-10 relative">
      <div className="max-w-7xl mx-auto">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center min-h-[44px] -ml-1 pl-1 pr-2 rounded-lg text-accent hover:brightness-125 transition-colors mb-2 sm:mb-4 group font-medium text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <svg className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Match Header */}
        <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <StatusBadge status={displayStatus} />
              <span className="text-slate-400 font-mono text-sm tabular-nums">Market: {match.marketId}</span>
              {match.startTime && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-slate-300 whitespace-nowrap">Start At:</span>
                  <span className="tabular-nums whitespace-nowrap">
                    {new Date(match.startTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  {countdown && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-medium text-[11px] tabular-nums">
                      Starts in {countdown}
                    </span>
                  )}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100">
              {match.name}
            </h1>
            {displayStatus === 'capturing' && (
              <p className="mt-1.5 text-xs text-accent/80">
                Capturing odds ahead of start — polling begins 30 minutes before the scheduled time.
              </p>
            )}
          </div>

          {/* Polling Toggle */}
          <div className="flex bg-surface-raised/50 p-1 rounded-xl border border-subtle/50 self-stretch md:self-auto w-full md:w-auto md:min-w-[180px]">
            {isPolling ? (
              <button
                onClick={handleStopPolling}
                className="flex-1 min-h-[48px] px-6 py-3 rounded-lg bg-slate-700/40 text-slate-200 font-semibold flex items-center justify-center gap-2 hover:bg-slate-700/60 transition-colors border border-subtle/60 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <span className="w-2 h-2 rounded-full bg-profit animate-pulse" />
                Stop Polling
              </button>
            ) : (
              <button
                onClick={handleStartPolling}
                className="flex-1 min-h-[48px] px-6 py-3 rounded-lg bg-accent/15 text-accent font-semibold flex items-center justify-center gap-2 hover:bg-accent/25 transition-colors border border-accent/30 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Polling
              </button>
            )}
          </div>
        </Card>

        {/* Book Selection Tabs */}
        <div className="mb-6">
          <div role="tablist" className="flex bg-surface-raised/40 p-1.5 rounded-xl border border-subtle/30 gap-1 sm:gap-1.5 w-full max-w-2xl">
            <button
              onClick={() => setActiveTab('full')}
              className={`flex-1 min-h-[44px] py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                activeTab === 'full'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <span className="hidden sm:inline">Full History Book</span>
              <span className="sm:hidden">Full</span>
            </button>
            <button
              onClick={() => setActiveTab('rolling5m')}
              className={`flex-1 min-h-[44px] py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                activeTab === 'rolling5m'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <span className="hidden sm:inline">Latest 5 Min Book</span>
              <span className="sm:hidden">5 Min</span>
            </button>
            <button
              onClick={() => setActiveTab('highlow')}
              className={`flex-1 min-h-[44px] py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${
                activeTab === 'highlow'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
              <span className="hidden sm:inline">High &amp; Low</span>
              <span className="sm:hidden">H/L</span>
            </button>
          </div>
        </div>

        {/* Book Content — Tab 1: Full History, Tab 2: Rolling 5m, Tab 3: High & Low */}
        {activeTab === 'highlow' ? (
          <HighLowBookCard
            bookHighLow={match.bookHighLow || { teamA_high: 0, teamA_low: 0, teamB_high: 0, teamB_low: 0 }}
            currentBook={match.finalBook || { teamA_PL: 0, teamB_PL: 0 }}
            teamA={match.teamA}
            teamB={match.teamB}
          />
        ) : match.finalBook ? (
          <FinalBookCard
            title={activeTab === 'full' ? 'Final Book (Full History)' : 'Final Book (Latest 5 Minutes)'}
            finalBook={activeTab === 'full' ? match.finalBook : (match.rollingBook5m || { teamA_PL: 0, teamB_PL: 0 })}
            teamA={match.teamA}
            teamB={match.teamB}
          />
        ) : (
          <div className="bg-surface/20 border border-subtle/30 border-dashed rounded-2xl p-10 mb-8 text-center">
            <p className="text-slate-400">No book yet.</p>
            <p className="text-sm text-slate-600 mt-1">
              The book is calculated from captured snapshots — it appears once polling records its first frame.
            </p>
          </div>
        )}

        {/* Snapshots */}
        <SnapshotGrid
          snapshots={match.snapshots}
          totalFrames={match.totalSnapshotCount ?? match.snapshots?.length ?? 0}
          teamA={match.teamA}
          teamB={match.teamB}
        />
      </div>
    </div>
  );
}
