import { getStatusStyles, getStatusDot } from '@/lib/format';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full border flex items-center gap-1.5 ${getStatusStyles(status)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(status)}`} />
      {status}
    </span>
  );
}
