'use client';

import { SidebarNav } from '@/components/sidebar-nav';
import { TopBar } from '@/components/top-bar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SidebarNav />
      <main className="ml-64 min-h-screen">
        <TopBar />
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
