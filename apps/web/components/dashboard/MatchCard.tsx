'use client';

import Link from 'next/link';
import { LiveNumber } from '@/components/ui/LiveNumber';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getDisplayStatus, getCountdown, getFeedHealth, formatAgo } from '@/lib/format';
import { FeedHealthBadge } from '@/components/ui/FeedHealthBadge';
import { useNow } from '@/lib/useNow';

interface MatchCardProps {
  match: any;
  onDelete: (match: any) => void;
  onTogglePolling?: (matchId: string, currentStatus: boolean) => void;
}

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

export function MatchCard({ match, onDelete, onTogglePolling }: MatchCardProps) {
  const teamA_PL = match.finalBook?.teamA_PL;
  const teamB_PL = match.finalBook?.teamB_PL;
  const hasBook = typeof teamA_PL === 'number' && typeof teamB_PL === 'number';

  const now = useNow();
  const displayStatus = getDisplayStatus(match, now);
  const countdown = getCountdown(match.startTime, now);
  const feedHealth = getFeedHealth(match, now);
  const isRunning = displayStatus === 'live' || displayStatus === 'capturing';

  return (
    <div className="relative group/card">
      {/* Delete button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(match); }}
        className="absolute top-1.5 right-1.5 z-20 p-1.5 rounded-full bg-surface/90 text-slate-500 hover:bg-danger hover:text-white border border-subtle/50 hover:border-transparent opacity-70 sm:opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none transition-all duration-200 after:absolute after:-inset-2.5 after:content-['']"
        title="Delete Match"
        aria-label={`Delete ${match.name}`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <Link href={`/match/${match._id}`} className="block">
        <div className={`rounded-lg bg-surface-raised/60 border border-subtle/50 hover:border-accent/30 transition-all relative overflow-hidden ${
          isRunning ? 'border-l-2 border-l-profit' : 'border-l-2 border-l-accent/50'
        }`}>

          {/* ── Top: Match Name ── */}
          <div className="px-3 pt-2.5 pb-1.5 pr-7">
            <h3 className="font-semibold text-sm text-slate-200 leading-tight">
              {match.name}
            </h3>
          </div>

          {/* ── Row 2: Status + Start At + Countdown — all in one line ── */}
          <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
            {/* Status badge */}
            <StatusBadge status={displayStatus} size="sm" />

            <FeedHealthBadge health={feedHealth} lastCapture={formatAgo(match.lastSuccessfulPollAt, now)} size="sm" />

            {/* Start At */}
            {match.startTime && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-slate-400 tabular-nums">
                  {new Date(match.startTime).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
                  })}
                </span>
              </span>
            )}

            {/* Countdown badge — only while the match is still pending */}
            {countdown && (
              <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums bg-amber-500/15 text-amber-400">
                in {countdown}
              </span>
            )}
          </div>

          {/* ── Book Data — the primary number on this card ── */}
          {hasBook && (
            <div className="px-3 pb-2">
              <div className="flex gap-1.5">
                {/* Team A PL */}
                <div className={`flex-1 min-w-0 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-0.5 xs:gap-2 px-2 py-1.5 rounded ${
                  teamA_PL >= 0 ? 'bg-profit/10' : 'bg-loss/10'
                }`}>
                  <span className="text-[11px] text-slate-400 truncate">{match.teamA}</span>
                  <LiveNumber
                    value={teamA_PL}
                    format={signed}
                    className={`text-base font-bold shrink-0 ${teamA_PL >= 0 ? 'text-profit' : 'text-loss'}`}
                  />
                </div>
                {/* Team B PL */}
                <div className={`flex-1 min-w-0 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-0.5 xs:gap-2 px-2 py-1.5 rounded ${
                  teamB_PL >= 0 ? 'bg-profit/10' : 'bg-loss/10'
                }`}>
                  <span className="text-[11px] text-slate-400 truncate">{match.teamB}</span>
                  <LiveNumber
                    value={teamB_PL}
                    format={signed}
                    className={`text-base font-bold shrink-0 ${teamB_PL >= 0 ? 'text-profit' : 'text-loss'}`}
                  />
                </div>
              </div>
              {(match.totalSnapshotCount > 0) && (
                <div className="text-right text-[11px] text-slate-500 mt-1 tabular-nums">
                  {match.totalSnapshotCount} snaps
                </div>
              )}
            </div>
          )}

          {/* ── Bottom: Start/Stop + IDs ── */}
          <div className="px-3 pb-2.5 flex items-center justify-between gap-2">
            {/* Start/Stop */}
            {onTogglePolling && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePolling(match._id, match.isPolling); }}
                className={`relative shrink-0 px-3 py-1.5 sm:px-2.5 rounded border text-[11px] font-semibold flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none after:absolute after:-inset-1.5 after:content-[''] ${
                  match.isPolling
                    ? 'bg-slate-700/40 text-slate-200 border-subtle/60 hover:bg-slate-700/60'
                    : 'bg-accent/15 text-accent border-accent/30 hover:bg-accent/25'
                }`}
              >
                {match.isPolling ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
                    Stop
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    Start
                  </>
                )}
              </button>
            )}

            {/* EV + MKT — secondary, but still legible */}
            <div className="hidden xs:flex items-center gap-1 font-mono text-[11px] text-slate-600 min-w-0 overflow-hidden tabular-nums">
              <span className="shrink-0">EV:</span>
              <span className="truncate max-w-[64px]">{match.eventId || '---'}</span>
              <span className="shrink-0">MKT:</span>
              <span className="truncate max-w-[72px]">{match.marketId || '---'}</span>
            </div>
          </div>

        </div>
      </Link>
    </div>
  );
}
