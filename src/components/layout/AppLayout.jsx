import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAutoSync } from '@/hooks/useAutoSync';
import { Search, UserCircle2, ArrowLeft } from 'lucide-react';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import TvSidebar from './TvSidebar';
import PageTransition from './PageTransition';
import StreamVaultLogo from '@/components/StreamVaultLogo';
import { useTvDevice } from '@/hooks/useTvDevice';
import { runScan } from '@/lib/embyScanState';

const ROOT_TABS = new Set(['/', '/emby', '/watchlist', '/search', '/settings', '/discover']);

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isRootTab = ROOT_TABS.has(location.pathname);
  useAutoSync();

  // Kick off Emby background scan once at app startup — survives all navigation
  useEffect(() => { runScan(); }, []);

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

  const isTV = useTvDevice();

  if (isTV) {
    return (
      <div className="min-h-screen bg-background font-body flex">
        <TvSidebar />
        <main className="flex-1 min-w-0" style={{ marginLeft: '80px' }}>
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Top navbar — desktop only */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* Mobile header — visible only on small screens */}
      <header
        className="fixed top-0 left-0 right-0 z-50 md:hidden flex items-center justify-between px-4 bg-card/95 backdrop-blur-md border-b border-border"
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(52px + env(safe-area-inset-top))' }}
      >
        {isRootTab ? (
          <Link to="/" className="flex items-center gap-2">
            <img
              src="https://www.dropbox.com/scl/fi/ub9cr2djh0cb7x57m25c7/streamvault.png?rlkey=png0dj93b0c1m3ksls5t5b7wn&st=4nd7duli&dl=1"
              alt="StreamVault"
              className="w-7 h-7 rounded-xl object-cover"
            />
            <span className="font-heading font-bold text-base bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              StreamVault
            </span>
          </Link>
        ) : (
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-1">
          <Link
            to="/search"
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Search className="w-5 h-5" />
          </Link>
          <Link
            to="/settings"
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <UserCircle2 className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main
        className="md:pt-16 md:[padding-bottom:0]"
        style={{
          paddingTop: 'calc(52px + env(safe-area-inset-top))',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)',
        }}
      >
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