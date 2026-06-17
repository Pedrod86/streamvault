import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Database, BookOpen, Radio, Settings, LogIn, Compass } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/emby', label: 'Library', icon: Database },
  { to: '/browse', label: 'Browse', icon: Compass },
  { to: '/audiobooks', label: 'Books', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const TAB_PATHS = new Set(TABS.map(t => t.to));
const SCROLL_KEY = (path) => `sv_scroll_${path}`;

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const prevPathRef = useRef(location.pathname);
  const [isAuthed, setIsAuthed] = useState(null);

  useEffect(() => {
    base44.auth.isAuthenticated().then(setIsAuthed).catch(() => setIsAuthed(false));
  }, []);

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
    if (location.pathname === to) {
      e.preventDefault();
      sessionStorage.removeItem(SCROLL_KEY(to));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (!TAB_PATHS.has(location.pathname)) {
      e.preventDefault();
      navigate(to);
    }
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