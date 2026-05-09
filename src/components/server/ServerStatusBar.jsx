import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Server, Wifi, WifiOff, Loader2, RefreshCw, Plus } from 'lucide-react';
import { fetchServerLibrary } from '@/lib/serverSync';

const SERVER_COLORS = {
  plex: { dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'Plex' },
  emby: { dot: 'bg-green-400', text: 'text-green-400', label: 'Emby' },
  jellyfin: { dot: 'bg-blue-400', text: 'text-blue-400', label: 'Jellyfin' },
  trakt: { dot: 'bg-red-400', text: 'text-red-400', label: 'Trakt' },
};

function ServerChip({ server }) {
  const [status, setStatus] = useState('idle'); // idle | checking | ok | error
  const meta = SERVER_COLORS[server.server_type] || { dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: server.server_type };

  const checkConnection = async () => {
    if (server.server_type === 'trakt') return; // no ping for trakt
    setStatus('checking');
    try {
      await fetchServerLibrary({ ...server, _pingOnly: true });
      setStatus('ok');
    } catch {
      setStatus('error');
    }
    setTimeout(() => setStatus('idle'), 5000);
  };

  const statusDot = () => {
    if (status === 'checking') return <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground" />;
    if (status === 'ok') return <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />;
    if (status === 'error') return <span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block" />;
    return <span className={`w-2.5 h-2.5 rounded-full ${meta.dot} inline-block animate-pulse`} />;
  };

  const statusLabel = () => {
    if (status === 'checking') return 'Checking…';
    if (status === 'ok') return 'Reachable';
    if (status === 'error') return 'Unreachable';
    return 'Connected';
  };

  return (
    <button
      onClick={checkConnection}
      disabled={status === 'checking' || server.server_type === 'trakt'}
      title={server.server_type !== 'trakt' ? 'Click to ping server' : 'Trakt'}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/50 hover:bg-secondary transition-colors disabled:cursor-default group"
    >
      {statusDot()}
      <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
        {server.server_name || meta.label}
      </span>
      <span className={`text-xs hidden sm:block ${status === 'error' ? 'text-destructive' : status === 'ok' ? 'text-green-400' : 'text-muted-foreground'}`}>
        {statusLabel()}
      </span>
      {status === 'idle' && server.server_type !== 'trakt' && (
        <RefreshCw className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}

export default function ServerStatusBar() {
  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
  });

  if (servers.length === 0) {
    return (
      <div className="flex items-center gap-3 px-4 sm:px-6 mb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <WifiOff className="w-3.5 h-3.5" />
          <span>No media servers connected</span>
        </div>
        <Link
          to="/connect-server"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="w-3 h-3" /> Connect a server
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 sm:px-6 mb-4 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
        <Server className="w-3.5 h-3.5" />
        <span>Servers:</span>
      </div>
      {servers.map(srv => (
        <ServerChip key={srv.id} server={srv} />
      ))}
      <Link
        to="/connect-server"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg border border-dashed border-border/50 hover:border-border transition-colors"
      >
        <Plus className="w-3 h-3" /> Add
      </Link>
    </div>
  );
}