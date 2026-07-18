import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Film, Tv, Radio, Sparkles, Search, Download, Settings } from 'lucide-react';

const LOGO_URL = 'https://media.base44.com/images/public/69fe35055df988e0955e5c11/50f25d6c4_generated_image.png';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/movies', label: 'Movies', icon: Film },
  { to: '/shows', label: 'TV Shows', icon: Tv },
  { to: '/iptv', label: 'Live TV', icon: Radio },
  { to: '/anime', label: 'Anime', icon: Sparkles },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/downloads', label: 'Downloads', icon: Download },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavIcon({ to, label, icon: Icon, active }) {
  return (
    <Link
      to={to}
      className="group relative flex items-center justify-center w-12 h-12"
      aria-label={label}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-2xl bg-primary shadow-lg shadow-primary/40"
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      )}
      <span
        className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 group-hover:scale-110 ${
          active
            ? 'text-primary-foreground'
            : 'text-muted-foreground group-hover:text-foreground group-hover:bg-secondary'
        }`}
      >
        <Icon className="w-5 h-5" />
      </span>

      {/* Tooltip */}
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-card border border-border px-2.5 py-1 text-xs font-medium text-foreground opacity-0 -translate-x-1 shadow-xl transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 z-20">
        {label}
      </span>
    </Link>
  );
}

export default function FloatingSidebar() {
  const location = useLocation();

  const isActive = (to) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <aside className="fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col items-center gap-2 rounded-3xl border border-border bg-card/80 backdrop-blur-xl px-2 py-4 shadow-2xl shadow-black/40">
      <Link to="/" className="mb-2 flex items-center justify-center w-11 h-11 rounded-2xl overflow-hidden">
        <img src={LOGO_URL} alt="StreamVault" className="w-9 h-9 rounded-xl object-cover" />
      </Link>
      <div className="w-8 h-px bg-border mb-1" />
      {NAV_ITEMS.map(item => (
        <NavIcon key={item.to} {...item} active={isActive(item.to)} />
      ))}
    </aside>
  );
}