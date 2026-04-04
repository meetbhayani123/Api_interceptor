"use client";

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { ImportPanel } from '@/components/dashboard/ImportPanel';
import { MatchCard } from '@/components/dashboard/MatchCard';
import { DeleteModal } from '@/components/modals/DeleteModal';

export default function DashboardPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchMatches = useCallback(async () => {
    try {
      const data = await api.getMatches();
      setMatches(data);
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  return (
    <div className="p-6 lg:p-8 z-10 relative">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Import Panel */}
        <div className="lg:col-span-4">
          <ImportPanel onImportSuccess={fetchMatches} />
        </div>

        {/* Matches List */}
        <div className="lg:col-span-8 bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-xl flex flex-col overflow-hidden lg:max-h-[85vh]">
          <div className="p-5 border-b border-slate-700/50 bg-slate-800/60 flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Recent Matches
            </h2>
            <span className="px-3 py-1 bg-slate-700/50 rounded-full text-xs font-medium text-slate-300">
              {matches.length} total
            </span>
          </div>

          <div className="flex-1 lg:overflow-y-auto p-5 space-y-3 custom-scrollbar">
            {matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-3 py-16">
                <svg className="w-12 h-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p>No matches yet. Import events to get started.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {matches.map((match) => (
                  <MatchCard
                    key={match._id}
                    match={match}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
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
