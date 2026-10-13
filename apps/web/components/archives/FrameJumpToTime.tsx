'use client';

import { useState, useEffect } from 'react';

interface FrameJumpToTimeProps {
  /** The moment currently jumped to, as an ISO string. */
  value: string;
  /** Capture bounds of the archive, for input limits and guidance. */
  firstFrameAt?: string | null;
  lastFrameAt?: string | null;
  onFind: (isoTime: string) => void;
  busy?: boolean;
  /** Set when the requested time sat past the final capture. */
  notice?: string | null;
}

/** `datetime-local` needs local wall-clock text, not a UTC ISO string. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** A `datetime-local` value is local time; Date parses it as such. */
function fromLocalInput(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/**
 * Jump the frame table to whichever page holds a given moment.
 *
 * Deliberately not a filter: every frame stays reachable, this only moves you
 * to the right page so you can keep reading forwards and backwards from there.
 */
export function FrameJumpToTime({
  value, firstFrameAt, lastFrameAt, onFind, busy = false, notice = null,
}: FrameJumpToTimeProps) {
  const [input, setInput] = useState(() => toLocalInput(value));
  const [error, setError] = useState<string | null>(null);

  // Follow the URL when it changes elsewhere: a jump, the back button, or a
  // shared link.
  useEffect(() => { setInput(toLocalInput(value)); }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const iso = fromLocalInput(input);
    if (!iso) {
      setError('Pick a date and time first.');
      return;
    }
    onFind(iso);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="frame-at" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Go to time
      </label>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          id="frame-at"
          type="datetime-local"
          step="1"
          value={input}
          min={toLocalInput(firstFrameAt) || undefined}
          max={toLocalInput(lastFrameAt) || undefined}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 min-w-0 min-h-[48px] px-3 py-2 bg-surface-raised/50 border border-subtle/80 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all [color-scheme:dark]"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 min-h-[48px] px-6 rounded-xl border border-accent/30 bg-accent/15 text-accent text-sm font-semibold hover:bg-accent/25 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60"
        >
          Find
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
      {!error && notice && <p className="text-xs text-amber-300">{notice}</p>}

      {(firstFrameAt || lastFrameAt) && (
        <p className="text-[11px] text-slate-500 tabular-nums">
          Odds were captured between{' '}
          {firstFrameAt ? new Date(firstFrameAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }) : '—'}
          {' and '}
          {lastFrameAt ? new Date(lastFrameAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }) : '—'}.
        </p>
      )}
    </form>
  );
}
