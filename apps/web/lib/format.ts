/**
 * How a match should be presented, which is not the same as its stored status.
 *
 * Polling now begins 30 minutes before startTime, so `status: 'running'` no
 * longer means the match is under way — 'capturing' covers that lead window.
 */
export type DisplayStatus = 'upcoming' | 'capturing' | 'live' | 'completed';

/**
 * Format a number into Indian currency notation (L for Lakhs, Cr for Crores).
 */
export function formatCurrency(val: number): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  const absVal = Math.abs(val);
  let formatted: string;

  if (absVal >= 1_00_00_000) {
    formatted = (absVal / 1_00_00_000).toFixed(2) + 'Cr';
  } else if (absVal >= 1_00_000) {
    formatted = (absVal / 1_00_000).toFixed(2) + 'L';
  } else {
    formatted = absVal.toFixed(2);
  }

  return (val < 0 ? '- ' : '+ ') + '₹' + formatted;
}

/**
 * Resolve what to show for a match. `now` is null before hydration, in which
 * case we fall back to the stored status rather than guessing at the clock.
 */
export function getDisplayStatus(
  match: { status?: string; isPolling?: boolean; startTime?: string | Date },
  now: number | null
): DisplayStatus {
  if (match.status === 'completed') return 'completed';

  const isCapturing = match.status === 'running' || Boolean(match.isPolling);
  if (!isCapturing) return 'upcoming';
  if (now === null) return 'capturing';

  const hasStarted = match.startTime
    ? new Date(match.startTime).getTime() <= now
    : true;

  return hasStarted ? 'live' : 'capturing';
}

/** Human label for a display status. */
export function getStatusLabel(status: DisplayStatus): string {
  return status === 'capturing' ? 'capturing' : status;
}

/**
 * Countdown to a match's start, or null once it has started / before hydration.
 */
export function getCountdown(startTime: string | Date | undefined, now: number | null): string | null {
  if (!startTime || now === null) return null;
  const diff = new Date(startTime).getTime() - now;
  if (diff <= 0) return null;

  const hrs = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/**
 * How healthy a match's odds feed looks.
 *
 * 'ok' is omitted deliberately — a working feed needs no badge. Only trouble
 * is worth the user's attention.
 */
export type FeedHealth = 'ok' | 'stale' | 'failing';

/**
 * Captures land every few seconds, but a success is only written to the
 * database on a throttle, and a failing poll retries internally for several
 * seconds first. 45s is comfortably past both, so this does not cry wolf.
 */
const STALE_AFTER_MS = 45_000;

/**
 * Whether a match that should be capturing actually is.
 *
 * Returns null when the match is not capturing, so the caller shows nothing.
 */
export function getFeedHealth(
  match: {
    status?: string;
    isPolling?: boolean;
    lastSuccessfulPollAt?: string | Date | null;
    consecutiveFailures?: number;
    lastPollError?: string | null;
  },
  now: number | null
): FeedHealth | null {
  const isCapturing = match.status === 'running' || Boolean(match.isPolling);
  if (!isCapturing || now === null) return null;

  if ((match.consecutiveFailures ?? 0) > 0 && match.lastPollError) return 'failing';

  // Polling just started and has not reported in yet — not yet a problem.
  if (!match.lastSuccessfulPollAt) return 'ok';

  const since = now - new Date(match.lastSuccessfulPollAt).getTime();
  return since > STALE_AFTER_MS ? 'stale' : 'ok';
}

/**
 * Compact relative time, e.g. "12s ago". Null before hydration.
 */
export function formatAgo(when: string | Date | null | undefined, now: number | null): string | null {
  if (!when || now === null) return null;

  const diff = now - new Date(when).getTime();
  if (diff < 0) return 'just now';

  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;

  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Status badge color classes.
 */
export function getStatusStyles(status: DisplayStatus | string): string {
  switch ((status || '').toLowerCase()) {
    case 'live':
      return 'bg-profit/15 text-profit border-profit/30';
    case 'capturing':
      return 'bg-accent/15 text-accent border-accent/30';
    case 'completed':
      return 'bg-slate-500/15 text-slate-400 border-subtle/50';
    case 'upcoming':
    default:
      return 'bg-slate-700/40 text-slate-300 border-subtle/60';
  }
}

/**
 * Status dot indicator classes.
 */
export function getStatusDot(status: DisplayStatus | string): string {
  switch ((status || '').toLowerCase()) {
    case 'live':
      return 'bg-profit animate-pulse';
    case 'capturing':
      return 'bg-accent animate-pulse';
    case 'completed':
      return 'bg-slate-400';
    case 'upcoming':
    default:
      return 'bg-slate-400';
  }
}
