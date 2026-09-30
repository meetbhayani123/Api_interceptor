'use client';

import { usePathname } from 'next/navigation';

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Match Command Center';
  if (pathname.startsWith('/match/')) return 'Match Detail';
  return 'Antigravity';
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 bg-surface-raised/60 backdrop-blur-xl border-b border-subtle/40">
      <div className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6 gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-400 truncate">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface/60 rounded-lg border border-subtle/50">
            <div className="w-2 h-2 rounded-full bg-profit animate-pulse" />
            <span className="text-xs text-slate-400 font-medium">System Online</span>
          </div>
        </div>
      </div>
    </header>
  );
}
