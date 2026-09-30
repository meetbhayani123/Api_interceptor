import type { ReactNode } from 'react';

type Tone = 'default' | 'accent' | 'warn';
type Padding = 'none' | 'sm' | 'md';

interface CardProps {
  children: ReactNode;
  /** Border emphasis. Only one card per view should claim `accent`. */
  tone?: Tone;
  padding?: Padding;
  className?: string;
}

const TONES: Record<Tone, string> = {
  default: 'border-subtle/50',
  accent: 'border-accent/30',
  warn: 'border-amber-500/30',
};

const PADDING: Record<Padding, string> = {
  none: '',
  sm: 'p-3 sm:p-5',
  md: 'p-4 sm:p-6 md:p-8',
};

/**
 * The shared panel shell. This markup was copy-pasted across six components;
 * changing the surface treatment now means changing it once.
 */
export function Card({ children, tone = 'default', padding = 'md', className = '' }: CardProps) {
  return (
    <div
      className={`bg-surface/40 backdrop-blur-xl border ${TONES[tone]} rounded-2xl shadow-xl ${PADDING[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
