'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';

const PAGE_SIZE = 25;

export default function SavedBookHistoryPage() {
  const params = useParams();
  const matchId = params.matchId as string;

  const [items, setItems] = useState<any[]>([]);
  const [matchName, setMatchName] = useState('');
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSavedBooksForMatch(matchId, { page, limit: PAGE_SIZE });
      setItems(data.items ?? []);
      setMatchName(data.matchName ?? '');
      setTeamA(data.teamA ?? 'Team A');
      setTeamB(data.teamB ?? 'Team B');
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err?.message || 'Could not load this history.');
    } finally {
      setLoading(false);
    }
  }, [matchId, page]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // Newest first, so entry numbers count down the page.
  const firstIndexOnPage = total - (page - 1) * PAGE_SIZE;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 z-10 relative w-full">
      <div className="max-w-4xl mx-auto flex flex-col gap-4 sm:gap-6 w-full">

        <Link
          href="/saved"
          className="inline-flex items-center min-h-[44px] -ml-1 pl-1 pr-2 rounded-lg text-accent hover:brightness-125 transition-colors group font-medium text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none w-fit"
        >
          <svg className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Saved Books
        </Link>

        <Card padding="sm">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-100 break-words">
            {matchName || 'Saved Books'}
          </h1>
          <p className="text-sm text-slate-400 mt-1 tabular-nums">
            {total} saved {total === 1 ? 'record' : 'records'}, newest first
          </p>
          <Link
            href={`/match/${matchId}`}
            className="inline-block mt-2 text-xs text-accent hover:brightness-125 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded"
          >
            Open the live match →
          </Link>
        </Card>

        <Card padding="none" className="flex flex-col overflow-hidden">
          <div className="p-3 sm:p-4 flex flex-col gap-3">
            {error && (
              <div role="alert" className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-rose-200 text-sm flex items-start gap-2">
                <span className="flex-1 min-w-0">{error}</span>
                <button
                  onClick={fetchPage}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-danger/20 hover:bg-danger/30 text-rose-100 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
                >
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : items.length === 0 && !error ? (
              <p className="text-sm text-slate-500 text-center py-12">No saved records for this match.</p>
            ) : (
              <>
                {/* Column headings, wide screens only — the rows are self-describing on mobile. */}
                <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 pb-2 border-b border-subtle/40 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>#</span>
                  <span>Saved at</span>
                  <span className="text-right truncate max-w-[140px]">{teamA}</span>
                  <span className="text-right truncate max-w-[140px]">{teamB}</span>
                </div>

                <ul className="grid gap-2 sm:gap-0">
                  {items.map((row, i) => (
                    <li
                      key={row._id}
                      className="rounded-lg sm:rounded-none bg-surface-raised/60 sm:bg-transparent border sm:border-0 sm:border-b border-subtle/50 sm:border-subtle/20 p-3 sm:px-3 sm:py-2.5 grid gap-2 sm:grid-cols-[auto_1fr_auto_auto] sm:gap-3 sm:items-center"
                    >
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                        #{firstIndexOnPage - i}
                      </span>

                      <span className="text-xs sm:text-sm text-slate-300 tabular-nums">
                        {new Date(row.savedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}
                        {row.snapshotCount > 0 && (
                          <span className="text-slate-600 ml-2">· {row.snapshotCount} frames</span>
                        )}
                      </span>

                      <span className="flex sm:block items-center justify-between gap-2">
                        <span className="sm:hidden text-[11px] text-slate-400 truncate">{teamA}</span>
                        <span className={`text-sm font-bold tabular-nums sm:text-right sm:block ${row.teamA_PL >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(row.teamA_PL)}
                        </span>
                      </span>

                      <span className="flex sm:block items-center justify-between gap-2">
                        <span className="sm:hidden text-[11px] text-slate-400 truncate">{teamB}</span>
                        <span className={`text-sm font-bold tabular-nums sm:text-right sm:block ${row.teamB_PL >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatCurrency(row.teamB_PL)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!loading && items.length > 0 && (
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} noun="record" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
