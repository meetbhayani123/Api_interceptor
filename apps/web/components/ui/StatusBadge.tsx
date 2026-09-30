import { getStatusStyles, getStatusDot, getStatusLabel, type DisplayStatus } from '@/lib/format';

interface StatusBadgeProps {
  status: DisplayStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizing = size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`${sizing} font-semibold uppercase tracking-wide rounded-full border inline-flex items-center gap-1.5 ${getStatusStyles(status)}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDot(status)}`} />
      {getStatusLabel(status)}
    </span>
  );
}
