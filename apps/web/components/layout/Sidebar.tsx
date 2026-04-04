'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[72px] bg-slate-900/80 backdrop-blur-xl border-r border-slate-800 flex flex-col items-center py-6 z-40 gap-2">
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-lg mb-8 shadow-lg shadow-cyan-500/20">
        A
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 group relative
                ${isActive
                  ? 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              title={item.label}
              aria-label={item.label}
            >
              {item.icon}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-cyan-400 rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Indicator */}
      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>
    </aside>
  );
}
