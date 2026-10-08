'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  /** What is being counted, e.g. "match" / "record". */
  noun?: string;
  /** Plural form, when adding "s" is wrong ("match" -> "matches"). */
  nounPlural?: string;
}

export function Pagination({ page, totalPages, total, onPageChange, noun = 'result', nounPlural }: PaginationProps) {
  const label = total === 1 ? noun : (nounPlural ?? `${noun}s`);

  if (totalPages <= 1) {
    return (
      <p className="text-xs text-slate-500 tabular-nums">
        {total} {label}
      </p>
    );
  }

  const button =
    'min-h-[40px] min-w-[40px] px-3 rounded-lg border border-subtle/60 text-xs font-semibold ' +
    'text-slate-300 hover:bg-slate-700/40 disabled:opacity-40 disabled:hover:bg-transparent ' +
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none transition-colors';

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-slate-500 tabular-nums">
        Page {page} of {totalPages} · {total} {label}
      </p>
      <div className="flex items-center gap-2">
        <button className={button} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </button>
        <button className={button} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}
