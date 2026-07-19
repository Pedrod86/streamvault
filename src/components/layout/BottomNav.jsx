import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Film, Tv, Radio, Download, LogIn } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/movies', label: 'Movies', icon: Film },
  { to: '/shows', label: 'TV Shows', icon: Tv },
  { to: '/iptv', label: 'Live TV', icon: Radio },
  { to: '/downloads', label: 'Downloads', icon: Download },
];

const TAB_PATHS = new Set(TABS.map(t => t.to));
const SCROLL_KEY = (path) => `sv_scroll_${path}`;
const SUBPATH_KEY = (tab) => `sv_subpath_${tab}`;

// Which tab "owns" a given pathname (longest matching tab root wins).
const tabForPath = (pathname) => {
  let match = null;
  for (const tab of TABS) {
    if (tab.to === '/') continue;
    if (pathname === tab.to || pathname.startsWith(tab.to + '/')) {
      if (!match || tab.to.length > match.length) match = tab.to;
    }
  }
  return match;
};

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const prevPathRef = useRef(location.pathname);
  const [isAuthed, setIsAuthed] = useState(null);

  useEffect(() => {
    base44.auth.isAuthenticated().then(setIsAuthed).catch(() => setIsAuthed(false));
  }, []);

  // Remember the last active sub-path (including search) for the current tab
  // category, so returning to that tab restores where the user left off.
  useEffect(() => {
    const owner = tabForPath(location.pathname);
    if (owner && owner !== location.pathname) {
      sessionStorage.setItem(SUBPATH_KEY(owner), location.pathname + location.search);
    } else if (owner) {
      // At the tab root — clear any stored sub-path.
      sessionStorage.removeItem(SUBPATH_KEY(owner));
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const prev = prevPathRef.current;
    const next = location.pathname;
    if (prev === next) return;
    if (TAB_PATHS.has(prev)) {
      sessionStorage.setItem(SCROLL_KEY(prev), String(window.scrollY));
    }
    if (TAB_PATHS.has(next)) {
      const saved = sessionStorage.getItem(SCROLL_KEY(next));
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved ? parseInt(saved, 10) : 0, behavior: 'instant' });
      });
    }
    prevPathRef.current = next;
  }, [location.pathname]);

  const handleTabPress = useCallback((e, to) => {
    const currentOwner = tabForPath(location.pathname);

    // Re-tapping the tab you're already inside → go to its root and scroll up.
    if (location.pathname === to || currentOwner === to) {
      e.preventDefault();
      sessionStorage.removeItem(SCROLL_KEY(to));
      sessionStorage.removeItem(SUBPATH_KEY(to));
      if (location.pathname !== to) {
        navigate(to);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    // Tapping a different tab → restore its last sub-path if we have one.
    e.preventDefault();
    const saved = to !== '/' ? sessionStorage.getItem(SUBPATH_KEY(to)) : null;
    navigate(saved || to);
  }, [location.pathname, navigate]);

  if (isAuthed === null) return null;

  if (isAuthed === false) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          <Link
            to="/login"
            className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 select-none text-primary"
          >
            <LogIn className="w-5 h-5" />
            <span className="text-[10px] font-medium">Sign In</span>
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {TABS.map((tab) => {
          const { to, label, icon: Icon } = tab;
          const active = to === '/'
            ? location.pathname === '/'
            : (location.pathname === to || tabForPath(location.pathname) === to);
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