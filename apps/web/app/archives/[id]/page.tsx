'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { FrameJumpToTime } from '@/components/archives/FrameJumpToTime';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const PAGE_SIZE = 50;

export default function ArchiveDetailPage() {
  // useSearchParams must sit under a Suspense boundary to prerender.
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>}>
      <ArchiveDetail />
    </Suspense>
  );
}

function ArchiveDetail() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const archiveId = params.id as string;

  // Page and the moment jumped to live in the URL, so a position can be shared
  // or bookmarked and the back button returns to where you were.
  const at = searchParams.get('at') ?? '';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [jumpNotice, setJumpNotice] = useState<string | null>(null);

  const targetRowRef = useRef<HTMLTableRowElement | null>(null);

  /** The frame the user jumped to, so it can be marked among fifty rows. */
  const isTarget = (frame: { capturedAt: string | Date }) =>
    Boolean(at) && new Date(frame.capturedAt).getTime() === new Date(at).getTime();

  const goTo = useCallback(
    (next: { page: number; at?: string }) => {
      const query = new URLSearchParams();
      if (next.page > 1) query.set('page', String(next.page));
      if (next.at) query.set('at', next.at);
      const qs = query.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname]
  );

  /**
   * Ask the server which page holds this moment, then go there. The page is
   * worked out from an indexed count rather than by walking rows, so this is
   * one quick request regardless of how long the capture ran.
   */
  const handleJump = useCallback(
    async (isoTime: string) => {
      setJumping(true);
      setJumpNotice(null);
      try {
        const found = await api.locateArchiveFrame(archiveId, isoTime, PAGE_SIZE);
        if (found.afterLastFrame) {
          setJumpNotice('That time is after the last capture — showing the final frames.');
        }
        goTo({ page: found.page, at: found.capturedAt ?? isoTime });
      } catch (err: any) {
        setJumpNotice(err?.message || 'Could not find that time.');
      } finally {
        setJumping(false);
      }
    },
    [archiveId, goTo]
  );

  const [archive, setArchive] = useState<any>(null);
  const [frames, setFrames] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [framesLoading, setFramesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArchive = useCallback(async () => {
    if (!archiveId) return;
    try {
      setArchive(await api.getArchive(archiveId));
    } catch (err: any) {
      setError(err?.message || 'Could not load this archive.');
    } finally {
      setLoading(false);
    }
  }, [archiveId]);

  const fetchFrames = useCallback(async () => {
    if (!archiveId) return;
    setFramesLoading(true);
    try {
      const data = await api.getArchiveFrames(archiveId, { page, limit: PAGE_SIZE });
      setFrames(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err?.message || 'Could not load frames.');
    } finally {
      setFramesLoading(false);
    }
  }, [archiveId, page]);

  useEffect(() => { fetchArchive(); }, [fetchArchive]);

  // Bring the jumped-to row into view; landing on page 7 with nothing
  // highlighted on screen would leave the user hunting for it.
  useEffect(() => {
    if (!at || framesLoading) return;
    targetRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [at, framesLoading, frames]);
  useEffect(() => { fetchFrames(); }, [fetchFrames]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  }

  const teamA = archive?.teamA || 'Team A';
  const teamB = archive?.teamB || 'Team B';
  const firstIndexOnPage = (page - 1) * PAGE_SIZE + 1;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 z-10 relative w-full">
      <div className="max-w-5xl mx-auto flex flex-col gap-4 sm:gap-6 w-full">

        <Link
          href="/archives"
          className="inline-flex items-center min-h-[44px] -ml-1 pl-1 pr-2 rounded-lg text-accent hover:brightness-125 transition-colors group font-medium text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none w-fit"
        >
          <svg className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Archives
        </Link>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-rose-200 text-sm">
            {error}
          </div>
        )}

        <Card padding="sm" className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-100 break-words">
              {archive?.name || 'Archived match'}
            </h1>
            <p className="text-sm text-slate-400 mt-1 tabular-nums">
              {total} captured {total === 1 ? 'frame' : 'frames'}
              {archive?.archivedAt && (
                <> · archived {new Date(archive.archivedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</>
              )}
            </p>
            {archive?.marketId && (
              <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums break-all">
                Market: {archive.marketId}
              </p>
            )}
          </div>

          {/* A plain link, not a fetch: the export can be large and the browser
              handles saving it far better than JavaScript would. */}
          <div className="shrink-0 flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <a
              href={api.archiveDownloadUrl(archiveId)}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-lg border border-accent/30 bg-accent/15 text-accent text-sm font-semibold hover:bg-accent/25 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download JSON
            </a>

            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-lg border border-subtle/60 text-slate-300 text-sm font-semibold hover:bg-danger/20 hover:text-rose-200 hover:border-danger/40 transition-colors focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </Card>

        {archive?.finalBook && (
          <Card padding="sm">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Final Book</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-surface-raised/60 border border-subtle/50 rounded-xl p-4 text-center min-w-0">
                <p className="text-xs text-slate-400 mb-1 truncate">{teamA}</p>
                <p className={`text-xl sm:text-2xl font-black tabular-nums ${archive.finalBook.teamA_PL >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatCurrency(archive.finalBook.teamA_PL)}
                </p>
              </div>
              <div className="bg-surface-raised/60 border border-subtle/50 rounded-xl p-4 text-center min-w-0">
                <p className="text-xs text-slate-400 mb-1 truncate">{teamB}</p>
                <p className={`text-xl sm:text-2xl font-black tabular-nums ${archive.finalBook.teamB_PL >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatCurrency(archive.finalBook.teamB_PL)}
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card padding="none" className="flex flex-col overflow-hidden">
          <div className="p-3 sm:p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-slate-300">Captured Frames</h2>

            <FrameJumpToTime
              value={at}
              firstFrameAt={archive?.firstFrameAt}
              lastFrameAt={archive?.lastFrameAt}
              busy={jumping || framesLoading}
              notice={jumpNotice}
              onFind={handleJump}
            />

            {framesLoading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : frames.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-12">This archive has no frames.</p>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <table className="w-full min-w-[640px] text-xs tabular-nums border-collapse">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-subtle/40">
                      <th className="text-left font-semibold py-2 pr-3">#</th>
                      <th className="text-left font-semibold py-2 pr-3">Captured</th>
                      <th className="text-right font-semibold py-2 px-2 text-back" colSpan={2}>{teamA} back / lay</th>
                      <th className="text-right font-semibold py-2 px-2 text-lay" colSpan={2}>{teamA} prices</th>
                      <th className="text-right font-semibold py-2 px-2 text-back" colSpan={2}>{teamB} back / lay</th>
                      <th className="text-right font-semibold py-2 pl-2 text-lay" colSpan={2}>{teamB} prices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frames.map((f, i) => (
                      <tr
                        key={f._id}
                        ref={isTarget(f) ? targetRowRef : undefined}
                        className={`border-b border-subtle/20 hover:bg-surface-raised/40 ${
                          isTarget(f) ? 'bg-accent/10 ring-1 ring-inset ring-accent/40' : ''
                        }`}
                      >
                        <td className="py-1.5 pr-3 text-slate-600 font-mono">{firstIndexOnPage + i}</td>
                        <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">
                          {new Date(f.capturedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                        </td>
                        <td className="py-1.5 px-2 text-right text-back">{f.teamA?.odds?.[0]?.toFixed(2) ?? '—'}</td>
                        <td className="py-1.5 px-2 text-right text-lay">{f.teamA?.odds?.[1]?.toFixed(2) ?? '—'}</td>
                        <td className="py-1.5 px-2 text-right text-slate-400">{f.teamA?.pricing?.[0]?.toLocaleString() ?? '—'}</td>
                        <td className="py-1.5 px-2 text-right text-slate-400">{f.teamA?.pricing?.[1]?.toLocaleString() ?? '—'}</td>
                        <td className="py-1.5 px-2 text-right text-back">{f.teamB?.odds?.[0]?.toFixed(2) ?? '—'}</td>
                        <td className="py-1.5 px-2 text-right text-lay">{f.teamB?.odds?.[1]?.toFixed(2) ?? '—'}</td>
                        <td className="py-1.5 px-2 text-right text-slate-400">{f.teamB?.pricing?.[0]?.toLocaleString() ?? '—'}</td>
                        <td className="py-1.5 pl-2 text-right text-slate-400">{f.teamB?.pricing?.[1]?.toLocaleString() ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!framesLoading && frames.length > 0 && (
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={(next) => goTo({ page: next })} noun="frame" />
            )}
          </div>
        </Card>
      </div>

      {confirmingDelete && (
        <ConfirmModal
          title="Delete archive?"
          confirmLabel="Delete archive"
          onClose={() => setConfirmingDelete(false)}
          onConfirm={async () => {
            await api.deleteArchive(archiveId);
            // Nothing left to show on this page once it is gone.
            router.push('/archives');
          }}
        >
          <p>
            Permanently delete <strong className="text-white">{archive?.name || 'this archive'}</strong> and its{' '}
            <strong className="text-white">{total}</strong> captured frames. This cannot be undone.
          </p>
          <p className="mt-2 text-slate-400">
            Any JSON export you already downloaded is unaffected.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}
