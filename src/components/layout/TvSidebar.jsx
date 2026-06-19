import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Film, Tv, BookmarkPlus, Database, Search,
  History, Compass, LayoutGrid, Zap, Server, Settings,
  ChevronRight, LogOut, Radio
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const LOGO_URL = 'https://www.dropbox.com/scl/fi/ub9cr2djh0cb7x57m25c7/streamvault.png?rlkey=png0dj93b0c1m3ksls5t5b7wn&st=4nd7duli&dl=1';

const LINKS = [
  { to: '/',          label: 'Home',       icon: Home },
  { to: '/search',    label: 'Search',     icon: Search },
  { to: '/emby',      label: 'Library',    icon: Database },
  { to: '/iptv',      label: 'IPTV',       icon: Radio },
  { to: '/watchlist', label: 'My List',    icon: BookmarkPlus },
  { to: '/discover',  label: 'Discover',   icon: Compass },
  { to: '/settings',  label: 'Settings',   icon: Settings },
];

export default function TvSidebar() {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300 ${
        expanded ? 'w-56' : 'w-20'
      }`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 shrink-0">
        <img src={LOGO_URL} alt="StreamVault" className="w-9 h-9 rounded-xl object-cover shrink-0" />
        {expanded && (
          <span
            className="font-heading font-extrabold text-base bg-gradient-to-r from-[#ff00e5] via-[#00f0ff] to-[#a64dff] bg-clip-text text-transparent whitespace-nowrap overflow-hidden tracking-wide"
            style={{ filter: 'drop-shadow(0 0 4px rgba(0,240,255,0.8)) drop-shadow(0 0 10px rgba(255,0,229,0.6))' }}
          >
            StreamVault
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1 px-2">
        {LINKS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`tv-focusable flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all outline-none ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary focus:text-foreground focus:bg-secondary'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {expanded && (
                <span className="whitespace-nowrap overflow-hidden">{label}</span>
              )}
              {expanded && active && (
                <ChevronRight className="w-4 h-4 ml-auto shrink-0 opacity-60" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-2 border-t border-border">
        <button
          onClick={() => base44.auth.logout()}
          className="tv-focusable w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary focus:text-foreground focus:bg-secondary transition-all outline-none"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {expanded && <span className="whitespace-nowrap">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}