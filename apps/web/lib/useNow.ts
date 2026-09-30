'use client';

import { useEffect, useState } from 'react';

/**
 * Re-renders on an interval so relative times (countdowns) stay current.
 *
 * Returns null on the server and on the first client render, so prerendered
 * markup matches hydration; the real clock starts once mounted.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
