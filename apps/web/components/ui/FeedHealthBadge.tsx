import type { FeedHealth } from '@/lib/format';

interface FeedHealthBadgeProps {
  health: FeedHealth | null;
  /** e.g. "2m ago" — shown so the user can judge how bad it is. */
  lastCapture?: string | null;
  size?: 'sm' | 'md';
}

/**
 * Shown only when something is wrong. A healthy feed gets no badge, so the
 * absence of one means "fine" and the presence of one always means "look".
 */
export function FeedHealthBadge({ health, lastCapture, size = 'md' }: FeedHealthBadgeProps) {
  if (!health || health === 'ok') return null;

  const failing = health === 'failing';
  const sizing = size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs';

  return (
    <span
      role="status"
      title={failing ? 'The odds feed is returning errors' : 'No new odds captured recently'}
      className={`${sizing} inline-flex items-center gap-1 rounded font-semibold border ${
        failing
          ? 'bg-danger/15 text-rose-200 border-danger/40'
          : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
      }`}
    >
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      {failing ? 'Feed failing' : 'No data'}
      {lastCapture && <span className="font-normal opacity-80 tabular-nums">· {lastCapture}</span>}
    </span>
  );
}
