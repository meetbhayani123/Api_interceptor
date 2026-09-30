'use client';

import { useEffect, useRef, useState } from 'react';

type Direction = 'up' | 'down' | null;

/**
 * Reports whether `value` just moved up or down, clearing itself once the
 * flash has played. Returns null on first render and while the value is steady.
 */
export function useChangeDirection(value: number | undefined, resetMs = 700): Direction {
  const previous = useRef<number | undefined>(undefined);
  const [direction, setDirection] = useState<Direction>(null);

  useEffect(() => {
    const prev = previous.current;
    previous.current = value;

    if (typeof value !== 'number' || typeof prev !== 'number' || prev === value) return;

    setDirection(value > prev ? 'up' : 'down');
    const timer = setTimeout(() => setDirection(null), resetMs);
    return () => clearTimeout(timer);
  }, [value, resetMs]);

  return direction;
}

interface LiveNumberProps {
  value: number | undefined;
  /** Formatter for the displayed value. Defaults to String(value). */
  format?: (v: number) => string;
  className?: string;
  /** Reserve space for a ▲/▼ marker that appears on change. */
  showArrow?: boolean;
}

/**
 * A number that visibly reacts when it changes: a brief green/red background
 * flash plus a direction marker. Always renders tabular figures so columns
 * don't jitter as digits change.
 */
export function LiveNumber({ value, format, className = '', showArrow = true }: LiveNumberProps) {
  const direction = useChangeDirection(value);

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return <span className={`tabular-nums ${className}`}>&mdash;</span>;
  }

  const flash = direction === 'up' ? 'flash-up' : direction === 'down' ? 'flash-down' : '';

  return (
    <span className={`inline-flex items-center gap-1 rounded px-1 -mx-1 tabular-nums ${flash} ${className}`}>
      {showArrow && (
        // Fixed width so the marker appearing never shifts the layout.
        <span aria-hidden="true" className="inline-block w-[0.7em] text-[0.7em] leading-none opacity-80">
          {direction === 'up' ? '▲' : direction === 'down' ? '▼' : ''}
        </span>
      )}
      {format ? format(value) : value}
    </span>
  );
}
