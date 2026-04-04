"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';

const formatCurrency = (val: number) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  const absVal = Math.abs(val);
  let formatted = '';
  if (absVal >= 10000000) formatted = (absVal / 10000000).toFixed(2) + 'Cr';
  else if (absVal >= 100000) formatted = (absVal / 100000).toFixed(2) + 'L';
  else formatted = absVal.toFixed(2);
  
  return (val < 0 ? '-' : '+') + ' ₹' + formatted;
};

export default function MatchDetail() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchMatch = async (silent = false) => {
    try {
      const res = await fetch(`http://localhost:3001/api/match/${matchId}`);
      if (res.ok) {
        const data = await res.json();
        setMatch(data);
      } else if (!silent) {
        router.push('/');
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const checkPollingStatus = async () => {
    try {
        const res = await fetch(`http://localhost:3001/api/match/${matchId}/polling-status`);
        if (res.ok) {
            const data = await res.json();
            setIsPolling(data.isPolling);
        }
    } catch (err) {
        console.error(err);
    }
  };

  useEffect(() => {
    if (matchId) {
      fetchMatch();
      checkPollingStatus();

      const socket = io('http://localhost:3001');
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('join_match', matchId);
      });

      socket.on('odds_update', (data) => {
        if (data.matchId === matchId) {
          setMatch((prev: any) => {
            if (!prev) return prev;
            const existingIds = new Set((prev.snapshots || []).map((s: any) => s._id || s.sequenceId));
            if (existingIds.has(data.snapshot._id || data.snapshot.sequenceId)) {
               return { ...prev, finalBook: data.finalBook };
            }
            return {
              ...prev,
              finalBook: data.finalBook,
              snapshots: [...(prev.snapshots || []), data.snapshot]
            };
          });
        }
      });

      return () => {
        socket.emit('leave_match', matchId);
        socket.disconnect();
      };
    }
  }, [matchId]);

  const startPolling = async () => {
    setIsPolling(true);
    try {
      await fetch(`http://localhost:3001/api/match/${matchId}/start-polling`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to start polling:', err);
      setIsPolling(false);
    }
  };

  const stopPolling = async () => {
    setIsPolling(false);
    try {
      await fetch(`http://localhost:3001/api/match/${matchId}/stop-polling`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop polling:', err);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <svg className="animate-spin h-12 w-12 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!match) return null;

  return (
    <main className="min-h-screen bg-[#0F172A] text-white p-6 md:p-12 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto z-10 relative">
        <Link href="/" className="inline-flex items-center text-cyan-400 hover:text-cyan-300 transition-colors mb-8 group font-medium">
          <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Header Section */}
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {match.status.toUpperCase()}
              </span>
              <span className="text-slate-400 font-mono text-sm">Market: {match.marketId}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">
              {match.name}
            </h1>
          </div>

          <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700/50 self-stretch md:self-auto min-w-[180px]">
            {isPolling ? (
              <button
                onClick={stopPolling}
                className="flex-1 px-6 py-3 rounded-lg bg-red-500/20 text-red-400 font-semibold flex items-center justify-center gap-2 hover:bg-red-500/30 transition-colors border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                Stop Polling
              </button>
            ) : (
              <button
                onClick={startPolling}
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

        {/* Final Book Live Display */}
        {match.finalBook && (
          <div className="bg-slate-800/40 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6 md:p-8 mb-8 shadow-[0_0_30px_rgba(6,182,212,0.1)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <h2 className="text-xl font-bold flex items-center gap-3 border-b border-slate-700/50 pb-4 mb-6">
              <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Live Odyssey Final Book
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 flex flex-col items-center justify-center">
                <span className="text-slate-400 text-sm font-semibold mb-2">{match.teamA || 'Team A'} Projection</span>
                <span className={`text-4xl font-black ${match.finalBook.teamA_PL >= 0 ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'}`}>
                  {formatCurrency(match.finalBook.teamA_PL)}
                </span>
                <span className="text-xs text-slate-500 mt-2 font-mono">Raw: {match.finalBook.teamA_PL?.toFixed(4)}</span>
              </div>
              
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 flex flex-col items-center justify-center">
                <span className="text-slate-400 text-sm font-semibold mb-2">{match.teamB || 'Team B'} Projection</span>
                <span className={`text-4xl font-black ${match.finalBook.teamB_PL >= 0 ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'}`}>
                  {formatCurrency(match.finalBook.teamB_PL)}
                </span>
                <span className="text-xs text-slate-500 mt-2 font-mono">Raw: {match.finalBook.teamB_PL?.toFixed(4)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Snapshots Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-3 border-b-2 border-cyan-500/30 pb-2 pr-4 inline-flex">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Live Odyssey Grid
            </h2>
            <span className="text-sm font-mono text-slate-400">Total Frames: {match.snapshots?.length || 0}</span>
          </div>

          {!match.snapshots || match.snapshots.length === 0 ? (
            <div className="bg-slate-800/20 border border-slate-700/30 border-dashed rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center">
              <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-lg">No odds tracked yet.</p>
              <p className="text-sm text-slate-600 mt-2">Click 'Start Polling' above to securely pull live snapshots.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {match.snapshots.slice().reverse().map((snap: any, index: number) => (
                <div key={index} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:border-cyan-500/30 transition-all shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-700/50 pb-3">
                    <span className="text-xs font-mono bg-slate-900/50 px-2 py-1 rounded text-cyan-400">FRAME #{match.snapshots.length - index}</span>
                    <span className="text-sm text-slate-400">{new Date(snap.capturedAt).toLocaleTimeString()}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Team A */}
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                      <h4 className="text-sm font-semibold text-slate-300 mb-3 truncate" title={match.teamA || match.name.split(' v ')[0]}>
                        {match.teamA || 'Team A'}
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs bg-[#1e3a8a]/20 p-2 rounded border border-blue-500/20">
                          <span className="text-blue-300 font-bold">{snap.teamA.odds[0]?.toFixed(2)}</span>
                          <span className="text-blue-400 text-right">{snap.teamA.pricing[0]?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs bg-[#9f1239]/20 p-2 rounded border border-rose-500/20">
                          <span className="text-rose-300 font-bold">{snap.teamA.odds[1]?.toFixed(2)}</span>
                          <span className="text-rose-400 text-right">{snap.teamA.pricing[1]?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    {/* Team B */}
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                      <h4 className="text-sm font-semibold text-slate-300 mb-3 truncate" title={match.teamB || match.name.split(' v ')[1]}>
                        {match.teamB || 'Team B'}
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs bg-[#1e3a8a]/20 p-2 rounded border border-blue-500/20">
                          <span className="text-blue-300 font-bold">{snap.teamB.odds[0]?.toFixed(2)}</span>
                          <span className="text-blue-400 text-right">{snap.teamB.pricing[0]?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs bg-[#9f1239]/20 p-2 rounded border border-rose-500/20">
                          <span className="text-rose-300 font-bold">{snap.teamB.odds[1]?.toFixed(2)}</span>
                          <span className="text-rose-400 text-right">{snap.teamB.pricing[1]?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
