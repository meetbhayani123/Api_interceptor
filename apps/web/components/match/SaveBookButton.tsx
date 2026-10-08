'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';

type Phase = 'idle' | 'saving' | 'saved' | 'error';

interface SaveBookButtonProps {
  matchId: string;
  /** Compact styling for the dashboard card. */
  size?: 'sm' | 'md';
  onSaved?: () => void;
  className?: string;
}

/**
 * Records the match's current book as a permanent, timestamped row.
 *
 * The figures are read server-side, so this sends no numbers — the button
 * cannot be used to write an arbitrary book.
 */
export function SaveBookButton({ matchId, size = 'md', onSaved, className = '' }: SaveBookButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.MouseEvent) => {
    // The card wraps everything in a link; don't navigate on save.
    e.preventDefault();
    e.stopPropagation();
    if (phase === 'saving') return;

    setPhase('saving');
    setError(null);

    try {
      await api.saveBook(matchId);
      setPhase('saved');
      onSaved?.();
      // Return to idle so repeated saves are obviously possible.
      setTimeout(() => setPhase('idle'), 2000);
    } catch (err: any) {
      setError(err?.message || 'Could not save the book.');
      setPhase('error');
      setTimeout(() => setPhase('idle'), 4000);
    }
  };

  const sizing = size === 'sm'
    ? 'px-3 py-1.5 text-[11px] gap-1'
    : 'min-h-[48px] px-5 py-3 text-sm gap-2';

  const tone =
    phase === 'saved'
      ? 'bg-profit/20 text-profit border-profit/40'
      : phase === 'error'
        ? 'bg-danger/15 text-rose-200 border-danger/40'
        : 'bg-accent/15 text-accent border-accent/30 hover:bg-accent/25';

  return (
    <div className={`flex flex-col items-stretch ${className}`}>
      <button
        type="button"
        onClick={handleSave}
        disabled={phase === 'saving'}
        title="Save the current book as a permanent record"
        className={`relative shrink-0 inline-flex items-center justify-center rounded-lg border font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-70 ${sizing} ${tone}`}
      >
        {phase === 'saving' ? (
          <><Spinner size="sm" /> Saving…</>
        ) : phase === 'saved' ? (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </>
        ) : phase === 'error' ? (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Failed
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1-4l-4 4m0 0L8 3m4 4V1" />
            </svg>
            Save Book
          </>
        )}
      </button>

      {error && (
        <span role="alert" className="mt-1.5 text-[11px] text-rose-300 break-words">
          {error}
        </span>
      )}
    </div>
  );
}
