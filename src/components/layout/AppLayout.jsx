import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';

export default function AppLayout() {
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
        <Outlet />
      </main>
      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  );
}