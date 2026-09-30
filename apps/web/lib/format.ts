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
