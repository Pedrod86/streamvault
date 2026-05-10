import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import PageTransition from './PageTransition';

export default function AppLayout() {
  const location = useLocation();

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