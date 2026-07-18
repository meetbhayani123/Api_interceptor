'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';

interface ImportPanelProps {
  onImportSuccess: () => void;
}

export function ImportPanel({ onImportSuccess }: ImportPanelProps) {
  const [eventIds, setEventIds] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.importMatches(eventIds);
      setResult(data);
      setEventIds('');
      onImportSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 transition-all duration-500 hover:shadow-cyan-500/10 hover:border-cyan-500/30 group">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center p-3 bg-cyan-500/10 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-300">
          <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
          Event Importer
        </h2>
        <p className="text-slate-400 text-sm mt-2">
          Paste Event IDs (comma or newline separated)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="eventIds" className="block text-sm font-medium text-slate-300 mb-1.5">
            Event IDs
          </label>
          <textarea
            id="eventIds"
            required
            rows={3}
            value={eventIds}
            onChange={(e) => setEventIds(e.target.value)}
            className="block w-full px-4 py-3 bg-slate-900/50 border border-slate-700/80 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all text-white placeholder-slate-500 font-mono text-sm resize-none"
            placeholder="e.g. 33170560, 33171000"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !eventIds.trim()}
          className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-300 
            ${loading || !eventIds.trim()
              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600/50'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] active:scale-[0.98]'
            }`}
        >
          {loading ? <><Spinner size="sm" /> Processing...</> : 'Import Matches'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          {/* Success summary */}
          <div className={`p-4 rounded-xl border ${result.errors?.length ? 'bg-amber-900/20 border-amber-500/30' : 'bg-cyan-900/20 border-cyan-500/30'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${result.errors?.length ? 'bg-amber-500/20' : 'bg-cyan-500/20'}`}>
                {result.errors?.length ? (
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <h3 className={`font-semibold text-sm ${result.errors?.length ? 'text-amber-400' : 'text-cyan-400'}`}>
                {result.errors?.length ? 'Import Completed with Errors' : 'Import Finished'}
              </h3>
            </div>
            <p className="text-sm text-slate-300 pl-8">{result.message}</p>
          </div>

          {/* Per-event errors */}
          {result.errors && result.errors.length > 0 && (
            <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/30 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-red-400 font-semibold text-sm">Failed Events</h4>
              </div>
              <div className="space-y-1.5 pl-6">
                {result.errors.map((err: { id: string; message: string }, i: number) => (
                  <div key={i} className="text-sm flex flex-col gap-0.5">
                    <span className="text-red-300 font-mono text-xs bg-red-900/30 px-2 py-0.5 rounded-md w-fit">
                      Event: {err.id}
                    </span>
                    <span className="text-slate-400 text-xs pl-1">
                      {err.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
