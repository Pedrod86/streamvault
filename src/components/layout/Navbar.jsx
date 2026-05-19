import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Home, Film, Tv, BookmarkPlus, Menu, X, LogOut, User, Server, Plus, Trash2, Settings, History, Compass, LayoutGrid, Zap } from 'lucide-react';

const LOGO_URL = 'https://www.dropbox.com/scl/fi/ub9cr2djh0cb7x57m25c7/streamvault.png?rlkey=png0dj93b0c1m3ksls5t5b7wn&st=4nd7duli&dl=1';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DeleteAccountDialog from './DeleteAccountDialog';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const links = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/movies', label: 'Movies', icon: Film },
    { to: '/shows', label: 'TV Shows', icon: Tv },
    { to: '/watchlist', label: 'My List', icon: BookmarkPlus },
    { to: '/history', label: 'History', icon: History },
    { to: '/discover', label: 'Discover', icon: Compass },
    { to: '/tv-guide', label: 'TV Guide', icon: LayoutGrid },
    { to: '/free-streams', label: 'Free Streams', icon: Zap },
    { to: '/connect-server', label: 'Servers', icon: Server },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background via-background/95 to-transparent">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={LOGO_URL} alt="StreamVault" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-heading font-bold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent hidden sm:block">StreamVault</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? 'text-foreground bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search movies & shows..."
                  className="w-48 sm:w-64 h-9 bg-secondary border-border text-sm"
                />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSearchOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => setSearchOpen(true)}>
                <Search className="w-4 h-4" />
              </Button>
            )}

            <Link to="/add-media">
              <Button size="sm" className="hidden sm:flex bg-primary hover:bg-primary/90 rounded-lg gap-1.5 h-8 px-3 text-xs font-semibold">
                <Plus className="w-3.5 h-3.5" /> Add Media
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground select-none">
                  <User className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuItem className="select-none" onClick={() => base44.auth.logout()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="select-none text-destructive focus:text-destructive" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />

            {/* Mobile hamburger */}
            <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-border/50 mt-2 pt-3">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? 'text-foreground bg-secondary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}