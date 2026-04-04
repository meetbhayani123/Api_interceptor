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
    <header className="sticky top-0 z-30 bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/60">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 rounded-lg border border-slate-700/50">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400 font-medium">System Online</span>
          </div>
        </div>
      </div>
    </header>
  );
}
