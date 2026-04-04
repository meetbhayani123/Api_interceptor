import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'Antigravity — Match Odds Dashboard',
  description: 'Real-time match odds monitoring and book calculation dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <Sidebar />
        <div className="ml-[72px] min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 relative overflow-hidden">
            {/* Background decorations */}
            <div className="fixed top-[-10%] left-[5%] w-[35%] h-[35%] rounded-full bg-cyan-600/[0.07] blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-5%] w-[35%] h-[35%] rounded-full bg-blue-600/[0.07] blur-[120px] pointer-events-none" />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
