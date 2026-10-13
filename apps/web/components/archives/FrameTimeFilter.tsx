'use client';

import { useState, useEffect } from 'react';

interface FrameTimeFilterProps {
  /** Current window, as ISO strings. Empty means unbounded on that side. */
  from: string;
  to: string;
  /** Capture bounds of the archive, used for input limits and guidance. */
  firstFrameAt?: string | null;
  lastFrameAt?: string | null;
  onFind: (next: { from: string; to: string }) => void;
  onClear: () => void;
  busy?: boolean;
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

export function FrameTimeFilter({
  from, to, firstFrameAt, lastFrameAt, onFind, onClear, busy = false,
}: FrameTimeFilterProps) {
  const [fromInput, setFromInput] = useState(() => toLocalInput(from));
  const [toInput, setToInput] = useState(() => toLocalInput(to));
  const [error, setError] = useState<string | null>(null);

  // Keep the controls in step when the window changes elsewhere: the back
  // button, a shared link, or Clear.
  useEffect(() => { setFromInput(toLocalInput(from)); }, [from]);
  useEffect(() => { setToInput(toLocalInput(to)); }, [to]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nextFrom = fromLocalInput(fromInput);
    const nextTo = fromLocalInput(toInput);

    if (nextFrom && nextTo && new Date(nextFrom) > new Date(nextTo)) {
      setError('“From” is after “To”. Swap them, or clear one side.');
      return;
    }

    onFind({ from: nextFrom, to: nextTo });
  };

  const handleClear = () => {
    setFromInput('');
    setToInput('');
    setError(null);
    onClear();
  };

  const field =
    'w-full min-h-[48px] px-3 py-2 bg-surface-raised/50 border border-subtle/80 rounded-xl ' +
    'text-white text-sm outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all ' +
    '[color-scheme:dark]';

  const minAttr = toLocalInput(firstFrameAt);
  const maxAttr = toLocalInput(lastFrameAt);
  const isFiltered = Boolean(from || to);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label htmlFor="frame-from" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            From
          </label>
          <input
            id="frame-from"
            type="datetime-local"
            step="1"
            value={fromInput}
            min={minAttr || undefined}
            max={maxAttr || undefined}
            onChange={(e) => setFromInput(e.target.value)}
            className={field}
          />
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="frame-to" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            To
          </label>
          <input
            id="frame-to"
            type="datetime-local"
            step="1"
            value={toInput}
            min={minAttr || undefined}
            max={maxAttr || undefined}
            onChange={(e) => setToInput(e.target.value)}
            className={field}
          />
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 sm:flex-none min-h-[48px] px-6 rounded-xl border border-accent/30 bg-accent/15 text-accent text-sm font-semibold hover:bg-accent/25 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60"
          >
            Find
          </button>
          {isFiltered && (
            <button
              type="button"
              onClick={handleClear}
              disabled={busy}
              className="flex-1 sm:flex-none min-h-[48px] px-4 rounded-xl border border-subtle/60 text-slate-300 text-sm font-semibold hover:bg-slate-700/40 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-60"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}

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
