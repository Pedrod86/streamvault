import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import PageTransition from './PageTransition';

export default function AppLayout() {
  const location = useLocation();

  // Restore saved theme from settings
  const { data: settingsList = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });
  useEffect(() => {
    const s = settingsList[0];
    if (!s) return;
    if (s.accent_color) {
      document.documentElement.style.setProperty('--primary', s.accent_color);
      document.documentElement.style.setProperty('--ring', s.accent_color);
      document.documentElement.style.setProperty('--chart-1', s.accent_color);
    }
    if (s.secondary_color) {
      document.documentElement.style.setProperty('--accent', s.secondary_color);
      document.documentElement.style.setProperty('--chart-2', s.secondary_color);
    }
  }, [settingsList]);

  // Auto-apply dark mode based on OS preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (e) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Top navbar — hidden on mobile */}
      <div className="hidden md:block">
        <Navbar />
      </div>
      {/* On mobile, add safe-area top padding instead of navbar */}
      <main
        className="md:pt-16"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 0px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)',
        }}
      >
        {/* On md+ remove bottom padding override */}
        <style>{`@media (min-width: 768px) { main { padding-bottom: 0 !important; } }`}</style>
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  );
}