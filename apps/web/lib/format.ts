import type { MatchStatus } from '@repo/types';

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
 * Status badge color classes.
 */
export function getStatusStyles(status: MatchStatus | string): string {
  switch ((status || '').toLowerCase()) {
    case 'running':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'completed':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    case 'upcoming':
    default:
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
}

/**
 * Status dot indicator classes.
 */
export function getStatusDot(status: MatchStatus | string): string {
  switch ((status || '').toLowerCase()) {
    case 'running':
      return 'bg-cyan-400 animate-pulse';
    case 'completed':
      return 'bg-slate-400';
    case 'upcoming':
    default:
      return 'bg-emerald-400';
  }
}
