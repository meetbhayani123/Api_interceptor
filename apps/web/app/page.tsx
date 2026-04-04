"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

const getStatusStyles = (status: string) => {
  switch ((status || '').toLowerCase()) {
    case 'running': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'completed': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    case 'upcoming': default: return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
};

const getStatusDot = (status: string) => {
  switch ((status || '').toLowerCase()) {
    case 'running': return 'bg-cyan-400 animate-pulse';
    case 'completed': return 'bg-slate-400';
    case 'upcoming': default: return 'bg-emerald-400';
  }
};

export default function Home() {
  const [eventIds, setEventIds] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deletePassword, setDeletePassword] = useState('');

  const fetchMatches = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/matches');
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
      }
    } catch (err) {
      console.error('Failed to fetch matches', err);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleImportMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('http://localhost:3001/api/match/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventIds })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import match');
      }

      setResult(data);
      setEventIds(''); // clear on success
      fetchMatches();  // auto refresh dashboard list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget || !deletePassword) return;
    
    setDeleteLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/match/${deleteTarget._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete');
      }
      
      // Success
      setDeleteTarget(null);
      setDeletePassword('');
      fetchMatches();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0F172A] text-white p-6 relative overflow-hidden flex flex-col items-center">
      {/* Background decoration */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <div className="z-10 w-full max-w-6xl mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Form Panel */}
        <div className="lg:col-span-4 bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8 transition-all duration-500 hover:shadow-cyan-500/10 hover:border-cyan-500/30 group">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-cyan-500/10 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight">
              Event Importer
            </h1>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Paste single or multiple Event IDs (comma or newline separated).
            </p>
          </div>

          <form onSubmit={handleImportMatch} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="eventIds" className="block text-sm font-medium text-slate-300">
                Event IDs
              </label>
              <div className="relative group/input">
                <div className="absolute top-4 left-0 pl-3 flex items-start pointer-events-none">
                  <svg className="h-5 w-5 text-slate-500 group-focus-within/input:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <textarea
                  id="eventIds"
                  required
                  rows={4}
                  value={eventIds}
                  onChange={(e) => setEventIds(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/80 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-300 text-white placeholder-slate-500 font-mono text-sm resize-none"
                  placeholder="e.g. 33170560, 33171000"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !eventIds.trim()}
              className={`w-full py-3.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-300 
                ${loading || !eventIds.trim()
                  ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600/50' 
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] active:scale-[0.98]'
                }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Import Multiple Matches'
              )}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-red-300 text-sm flex items-start gap-3 animate-[pulse_1s_ease-in-out]">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {result && (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="p-5 rounded-xl bg-cyan-900/20 border border-cyan-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-bl-[100px] pointer-events-none" />
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-cyan-400 font-semibold tracking-wide">Import Finished</h3>
                </div>
                <div className="text-sm text-slate-300 pl-11">
                  {result.message}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Dashboard Panel */}
        <div className="lg:col-span-8 bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[85vh]">
          <div className="p-6 border-b border-slate-700/50 bg-slate-800/60 flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Recent Matches Database
            </h2>
            <div className="px-3 py-1 bg-slate-700/50 rounded-full text-xs font-medium text-slate-300 pointer-events-none">
              {matches.length} Total Elements
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {matches.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3 py-12">
                <svg className="w-12 h-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p>No matches recorded yet. Import events to get started.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {matches.map((match) => (
                  <div key={match._id} className="relative group/card cursor-pointer block">
                    <Link href={`/match/${match._id}`} className="block">
                      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-700/50 hover:border-cyan-500/30 transition-colors group relative overflow-hidden">
                        {/* Status Indicator pulse */}
                        <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-[40px] pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pr-10">
                          <div>
                            <h3 className="font-semibold text-lg text-slate-100 uppercase tracking-wide group-hover:text-cyan-400 transition-colors">
                              {match.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-2 text-sm text-slate-400 font-mono">
                              <span className="flex items-center gap-1.5 bg-slate-800 py-1 px-2.5 rounded-lg border border-slate-700/50">
                                EV: <span className="text-slate-200">{match.eventId || '---'}</span>
                              </span>
                              <span className="flex items-center gap-1.5 bg-slate-800 py-1 px-2.5 rounded-lg border border-slate-700/50">
                                MKT: <span className="text-slate-200">{match.marketId || '---'}</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border flex items-center gap-1.5 ${getStatusStyles(match.status)}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(match.status)}`} />
                              {match.status}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              {new Date(match.createdAt || match.startTime).toLocaleString()}
                              <svg className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                    
                    {/* Delete Icon Overlay */}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(match); }}
                      className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white border border-slate-700/50 hover:border-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-300 shadow-md hover:shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                      title="Permanently Delete Match"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Delete Password Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden slide-in-from-bottom-4 animate-in duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-bl-[100px] pointer-events-none" />
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-rose-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Confirm Deletion
            </h3>
            <p className="text-sm text-slate-300 mb-6">
              You are about to permanently delete <strong className="text-white">{deleteTarget.name}</strong>. All snapshots and match details will be wiped. Please enter the master password to proceed. Ensure the scraper validation is stopped!
            </p>
            
            <form onSubmit={handleDeleteMatch}>
              <div className="mb-6">
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full bg-slate-900 focus:bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                    placeholder="Enter admin password"
                    autoFocus
                  />
                </div>
              </div>
              
              <div className="flex gap-3 justify-end items-center">
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(null); setDeletePassword(''); }}
                  className="px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || !deletePassword}
                  className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-md
                    ${deleteLoading || !deletePassword
                      ? 'bg-rose-500/20 text-rose-300/50 cursor-not-allowed border-transparent'
                      : 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                    }`}
                >
                  {deleteLoading ? (
                    <svg className="animate-spin w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    'Wipe Record'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(56, 189, 248, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(56, 189, 248, 0.4);
        }
      `}</style>
    </main>
  );
}
