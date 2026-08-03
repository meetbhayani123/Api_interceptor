'use client';

import { formatCurrency } from '@/lib/format';
import { useState } from 'react';

interface BookResult {
  teamA_PL: number;
  teamB_PL: number;
}

interface BookHighLow {
  teamA_high: number;
  teamA_low: number;
  teamB_high: number;
  teamB_low: number;
}

interface TeamBookTabsProps {
  fullBook: BookResult;
  rollingBook5m: BookResult;
  bookHighLow: BookHighLow;
  teamA: string;
  teamB: string;
}

type ActiveTab = 'high' | 'low';

export function TeamBookTabs({ fullBook, rollingBook5m, bookHighLow, teamA, teamB }: TeamBookTabsProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('high');

  const teamAName = teamA || 'Team A';
  const teamBName = teamB || 'Team B';

  const isHigh = activeTab === 'high';

  return (
    <div className="bg-slate-800/40 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6 md:p-8 mb-8 shadow-[0_0_30px_rgba(6,182,212,0.1)] relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-6 relative z-10">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Team Book Overview
        </h2>
      </div>

      {/* Tab Switcher: High / Low */}
      <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/30 gap-1.5 mb-6 relative z-10 max-w-sm">
        <button
          onClick={() => setActiveTab('high')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'high'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.15)]'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          Team High
        </button>
        <button
          onClick={() => setActiveTab('low')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
            activeTab === 'low'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          Team Low
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-4">
        {/* Label */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            isHigh ? 'text-emerald-400/70' : 'text-rose-400/70'
          }`}>
            {isHigh
              ? '▲ Historical High — Peak cumulative P/L reached across all data'
              : '▼ Historical Low — Trough cumulative P/L reached across all data'}
          </span>
        </div>

        {/* Two-column: Team A + Team B high/low values */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HighLowCard
            teamName={teamAName}
            value={isHigh ? bookHighLow.teamA_high : bookHighLow.teamA_low}
            currentPL={fullBook.teamA_PL}
            rollingPL={rollingBook5m.teamA_PL}
            mode={activeTab}
          />
          <HighLowCard
            teamName={teamBName}
            value={isHigh ? bookHighLow.teamB_high : bookHighLow.teamB_low}
            currentPL={fullBook.teamB_PL}
            rollingPL={rollingBook5m.teamB_PL}
            mode={activeTab}
          />
        </div>

        {/* Summary Row: Current values at a glance */}
        <div className="mt-4 bg-slate-900/40 border border-slate-700/30 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">
            Current Book Values
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label={`${teamAName} (Current)`} value={fullBook.teamA_PL} />
            <MiniStat label={`${teamBName} (Current)`} value={fullBook.teamB_PL} />
            <MiniStat label={`${teamAName} (5m)`} value={rollingBook5m.teamA_PL} />
            <MiniStat label={`${teamBName} (5m)`} value={rollingBook5m.teamB_PL} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function HighLowCard({
  teamName,
  value,
  currentPL,
  rollingPL,
  mode,
}: {
  teamName: string;
  value: number;
  currentPL: number;
  rollingPL: number;
  mode: 'high' | 'low';
}) {
  const isHigh = mode === 'high';
  const isProfit = value >= 0;

  const borderClass = isHigh
    ? 'border-emerald-500/20 hover:border-emerald-500/40'
    : 'border-rose-500/20 hover:border-rose-500/40';

  const glowClass = isHigh
    ? 'hover:shadow-[0_0_20px_rgba(52,211,153,0.08)]'
    : 'hover:shadow-[0_0_20px_rgba(244,63,94,0.08)]';

  const accentText = isHigh ? 'text-emerald-400/60' : 'text-rose-400/60';

  // How far current is from the high/low
  const diff = currentPL - value;

  return (
    <div className={`bg-slate-900/60 border ${borderClass} rounded-xl p-5 transition-all duration-300 ${glowClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={accentText}>
            {isHigh ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            )}
          </span>
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            {isHigh ? 'All-Time High' : 'All-Time Low'}
          </span>
        </div>
      </div>

      {/* Team Name */}
      <div className="text-sm font-semibold text-slate-300 mb-2">{teamName}</div>

      {/* Main Value */}
      <span
        className={`text-3xl md:text-4xl font-black block ${
          isProfit
            ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]'
            : 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'
        }`}
      >
        {formatCurrency(value)}
      </span>

      <span className="text-xs text-slate-500 mt-1 font-mono block">
        Raw: {value?.toFixed(4)}
      </span>

      {/* Distance from current */}
      <div className="mt-3 pt-3 border-t border-slate-700/30 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          vs Current
        </span>
        <span className={`text-xs font-bold font-mono ${
          diff >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'
        }`}>
          {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
        </span>
      </div>

      {/* Rolling 5m value */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          Latest 5m P/L
        </span>
        <span className={`text-xs font-bold font-mono ${
          rollingPL >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'
        }`}>
          {formatCurrency(rollingPL)}
        </span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  const isProfit = value >= 0;

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1 truncate" title={label}>
        {label}
      </div>
      <div className={`text-sm font-bold ${
        isProfit ? 'text-emerald-400' : 'text-rose-400'
      }`}>
        {formatCurrency(value)}
      </div>
    </div>
  );
}
