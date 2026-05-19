import React, { useCallback, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Film, Tv, BookmarkPlus, LayoutGrid } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/movies', label: 'Movies', icon: Film },
  { to: '/shows', label: 'TV Shows', icon: Tv },
  { to: '/tv-guide', label: 'TV Guide', icon: LayoutGrid },
  { to: '/watchlist', label: 'My List', icon: BookmarkPlus },
];

const TAB_PATHS = new Set(TABS.map(t => t.to));

const SCROLL_KEY = (path) => `sv_scroll_${path}`;

export default function BottomNav() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // Save scroll position of current tab before leaving it
  useEffect(() => {
    const prev = prevPathRef.current;
    const next = location.pathname;
    if (prev === next) return;

    // Save scroll of the tab we just left (only main tabs)
    if (TAB_PATHS.has(prev)) {
      sessionStorage.setItem(SCROLL_KEY(prev), String(window.scrollY));
    }

    // Restore scroll for the tab we're entering (only main tabs)
    if (TAB_PATHS.has(next)) {
      const saved = sessionStorage.getItem(SCROLL_KEY(next));
      // Use rAF to wait for page render before scrolling
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved ? parseInt(saved, 10) : 0, behavior: 'instant' });
      });
    }

    prevPathRef.current = next;
  }, [location.pathname]);

  const handleTabPress = useCallback((e, to) => {
    if (location.pathname === to) {
      // Already on this tab — scroll to top and clear saved position
      e.preventDefault();
      sessionStorage.removeItem(SCROLL_KEY(to));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              onClick={(e) => handleTabPress(e, to)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 select-none transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}