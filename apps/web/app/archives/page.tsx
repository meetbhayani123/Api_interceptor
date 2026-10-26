'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { DEFAULT_ARCHIVE_RETENTION_DAYS } from '@repo/types';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const PAGE_SIZE = 20;

export default function ArchivesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Debounce typing so each keystroke does not hit the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getArchives({ search, page, limit: PAGE_SIZE });
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err?.message || 'Could not load archives.');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 z-10 relative w-full">
      <div className="max-w-4xl mx-auto flex flex-col gap-4 sm:gap-6 w-full">

        <Card padding="sm">
          <h1 className="text-lg sm:text-xl font-bold text-slate-100">Archives</h1>
          <p className="text-sm text-slate-400 mt-1">
            Matches you have deleted, with every frame they captured. Archives are removed after{' '}
            {DEFAULT_ARCHIVE_RETENTION_DAYS} days — the JSON export you were given at delete time is the
            copy that lasts.
          </p>

          <label htmlFor="archive-search" className="sr-only">Search archived matches</label>
          <div className="relative mt-4">
            <svg className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              id="archive-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by match name…"
              className="w-full min-h-[48px] pl-10 pr-4 py-3 bg-surface-raised/50 border border-subtle/80 rounded-xl text-white placeholder-slate-500 text-sm outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
            />
          </div>
        </Card>

        <Card padding="none" className="flex flex-col overflow-hidden">
          <div className="p-3 sm:p-4 flex flex-col gap-3">
            {error && (
              <div role="alert" className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-rose-200 text-sm flex items-start gap-2">
                <span className="flex-1 min-w-0">{error}</span>
                <button onClick={fetchPage} className="shrink-0 px-2.5 py-1 rounded-lg bg-danger/20 hover:bg-danger/30 text-rose-100 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none">
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-3 py-12 px-4 text-center">
                <svg className="w-10 h-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <p className="text-sm">
                  {search ? `No archives match “${search}”.` : 'Nothing archived yet. Deleting a match will archive it here.'}
                </p>
              </div>
            ) : (
              <ul className="grid gap-2">
                {items.map((a) => (
                  <li key={a._id} className="relative group/row">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(a); }}
                      title="Delete this archive"
                      aria-label={`Delete archive ${a.name}`}
                      className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-surface/90 text-slate-500 hover:bg-danger hover:text-white border border-subtle/50 hover:border-transparent opacity-70 sm:opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none transition-all duration-200 after:absolute after:-inset-2.5 after:content-['']"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    <Link
                      href={`/archives/${a._id}`}
                      className="block rounded-lg bg-surface-raised/60 border border-subtle/50 border-l-2 border-l-accent/50 hover:border-accent/30 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none p-3"
                    >
                      {/* Padded right so the frame count clears the delete control,
                          which is visible rather than hover-revealed on touch. */}
                      <div className="flex items-start justify-between gap-2 mb-2 pr-7">
                        <h2 className="font-semibold text-sm text-slate-200 min-w-0 break-words">{a.name}</h2>
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-700/50 text-[11px] font-semibold text-slate-300 tabular-nums">
                          {a.frameCount} frames
                        </span>
                      </div>

                      {a.finalBook && (
                        <div className="flex gap-1.5 mb-2">
                          <div className={`flex-1 min-w-0 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-0.5 xs:gap-2 px-2 py-1.5 rounded ${a.finalBook.teamA_PL >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
                            <span className="text-[11px] text-slate-400 truncate">{a.teamA}</span>
                            <span className={`text-sm font-bold tabular-nums shrink-0 ${a.finalBook.teamA_PL >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {formatCurrency(a.finalBook.teamA_PL)}
                            </span>
                          </div>
                          <div className={`flex-1 min-w-0 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-0.5 xs:gap-2 px-2 py-1.5 rounded ${a.finalBook.teamB_PL >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
                            <span className="text-[11px] text-slate-400 truncate">{a.teamB}</span>
                            <span className={`text-sm font-bold tabular-nums shrink-0 ${a.finalBook.teamB_PL >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {formatCurrency(a.finalBook.teamB_PL)}
                            </span>
                          </div>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-500 tabular-nums">
                        Archived {new Date(a.archivedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {!loading && items.length > 0 && (
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} noun="archive" />
            )}
          </div>
        </Card>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete archive?"
          confirmLabel="Delete archive"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await api.deleteArchive(deleteTarget._id);
            setDeleteTarget(null);
            // Step back a page if that was the last row on this one.
            if (items.length === 1 && page > 1) setPage(page - 1);
            else fetchPage();
          }}
        >
          <p>
            Permanently delete <strong className="text-white">{deleteTarget.name}</strong> and its{' '}
            <strong className="text-white">{deleteTarget.frameCount}</strong> captured frames. This cannot be undone.
          </p>
          <p className="mt-2 text-slate-400">
            Any JSON export you already downloaded is unaffected.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}
