import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Server, Plus, RefreshCw, Trash2, CheckCircle2,
  AlertCircle, Loader2, Wifi, WifiOff, Clock, Database, Pencil
} from 'lucide-react';
import { motion } from 'framer-motion';
import SyncServerButton from '@/components/server/SyncServerButton';
import EditServerDialog from '@/components/server/EditServerDialog';
import ConnectionRouteBadge from '@/components/server/ConnectionRouteBadge';

const SERVER_META = {
  plex:     { name: 'Plex',     color: 'from-yellow-500 to-orange-500', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  emby:     { name: 'Emby',     color: 'from-green-500 to-emerald-600',  border: 'border-green-500/30',  bg: 'bg-green-500/10',  text: 'text-green-400' },
  jellyfin: { name: 'Jellyfin', color: 'from-blue-500 to-violet-600',    border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   text: 'text-blue-400' },
  trakt:    { name: 'Trakt',    color: 'from-red-500 to-rose-600',       border: 'border-red-500/30',    bg: 'bg-red-500/10',    text: 'text-red-400' },
  xtream:   { name: 'Xtream',   color: 'from-purple-500 to-fuchsia-600', border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400' },
};

function useServerPing(server) {
  const [status, setStatus] = useState('checking');
  const [latency, setLatency] = useState(null);

  const ping = async () => {
    setStatus('checking');
    setLatency(null);

    if (server.server_type === 'trakt') {
      try {
        const t0 = Date.now();
        const res = await base44.functions.invoke('traktSync', { action: 'ping' });
        if (res.data?.error || !res.data?.ok) throw new Error(res.data?.error || 'Ping failed');
        setLatency(Date.now() - t0);
        setStatus('ok');
      } catch (err) {
        setStatus('error');
      }
      return;
    }

    try {
      let base = (server.server_url || '').trim().replace(/\/$/, '');
      if (!base) throw new Error('No URL');
      if (!/^https?:\/\//i.test(base)) base = 'http://' + base;

      const token = server.api_token || server.plex_token;
      let url;
      if (server.server_type === 'plex') {
        url = `${base}/identity?X-Plex-Token=${token}`;
      } else if (server.server_type === 'xtream') {
        url = `${base}/player_api.php?username=${encodeURIComponent(server.username || '')}&password=${encodeURIComponent(server.password || '')}`;
      } else {
        url = `${base}/System/Info/Public`;
      }

      const t0 = Date.now();
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLatency(Date.now() - t0);
      setStatus('ok');
    } catch (err) {
      setStatus('error');
    }
  };

  useEffect(() => { ping(); }, [server.id]);
  return { status, latency, ping };
}

function StatusBadge({ status, latency }) {
  if (status === 'checking') return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
    </span>
  );
  if (status === 'ok') return (
    <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" /> Online {latency !== null && <span className="text-green-400/60">{latency}ms</span>}
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs text-destructive font-medium">
      <AlertCircle className="w-3.5 h-3.5" /> Offline
    </span>
  );
}

function ServerCard({ server, onDelete, deleting }) {
  const meta = SERVER_META[server.server_type] || SERVER_META.emby;
  const { status, latency, ping } = useServerPing(server);
  const isTrakt = server.server_type === 'trakt';
  const [editOpen, setEditOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${meta.border} ${meta.bg} p-5 flex flex-col gap-4`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shadow-md shrink-0`}>
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className={`font-heading font-bold ${meta.text}`}>{server.server_name || meta.name}</p>
            <p className="text-muted-foreground text-xs truncate max-w-[200px]">{server.server_url || (isTrakt ? 'trakt.tv' : '—')}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
          status === 'ok' ? 'bg-green-500/15 text-green-400' :
          status === 'error' ? 'bg-destructive/15 text-destructive' :
          'bg-muted text-muted-foreground'
        }`}>
          {status === 'ok' ? <Wifi className="w-3 h-3" /> : status === 'error' ? <WifiOff className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
          {status === 'ok' ? 'Online' : status === 'error' ? 'Offline' : 'Checking'}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-black/20 px-3 py-2">
          <p className="text-muted-foreground mb-0.5">Type</p>
          <p className="text-foreground font-medium capitalize">{server.server_type}</p>
        </div>
        <div className="rounded-lg bg-black/20 px-3 py-2">
          <p className="text-muted-foreground mb-0.5">Auth</p>
          <p className="text-foreground font-medium capitalize">
            {server.auth_method === 'oauth_pin' ? 'OAuth PIN' : server.auth_method === 'api_key' ? 'API Key' : server.auth_method === 'token' ? 'Token' : 'Credentials'}
          </p>
        </div>
        {latency !== null && (
          <div className="rounded-lg bg-black/20 px-3 py-2">
            <p className="text-muted-foreground mb-0.5">Latency</p>
            <p className={`font-medium ${latency < 200 ? 'text-green-400' : latency < 600 ? 'text-yellow-400' : 'text-destructive'}`}>{latency}ms</p>
          </div>
        )}
        <div className="rounded-lg bg-black/20 px-3 py-2">
          <p className="text-muted-foreground mb-0.5">Status</p>
          <StatusBadge status={status} latency={null} />
        </div>
        {server.local_url && ['emby', 'jellyfin', 'plex'].includes(server.server_type) && (
          <div className="rounded-lg bg-black/20 px-3 py-2">
            <p className="text-muted-foreground mb-0.5">Route</p>
            <ConnectionRouteBadge server={server} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        {!isTrakt && <SyncServerButton server={server} />}
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto" onClick={ping}>
          <RefreshCw className="w-3.5 h-3.5" /> Ping
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditOpen(true)}>
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-destructive" onClick={onDelete} disabled={deleting}>
          <Trash2 className="w-3.5 h-3.5" /> Remove
        </Button>
      </div>

      {editOpen && <EditServerDialog server={server} open={editOpen} onOpenChange={setEditOpen} />}
    </motion.div>
  );
}

function SummaryBar({ servers }) {
  const media = servers.filter(s => s.server_type !== 'trakt');
  const trakt = servers.filter(s => s.server_type === 'trakt');
  const types = [...new Set(media.map(s => s.server_type))];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {[
        { label: 'Total Servers', value: servers.length, icon: Server, color: 'text-primary' },
        { label: 'Media Servers', value: media.length, icon: Database, color: 'text-blue-400' },
        { label: 'Server Types', value: types.length, icon: Wifi, color: 'text-green-400' },
        { label: 'Trakt Accounts', value: trakt.length, icon: Clock, color: 'text-red-400' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg bg-secondary flex items-center justify-center ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ServerDashboard() {
  const queryClient = useQueryClient();

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MediaServer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mediaServers'] }),
  });

  const mediaServers = servers.filter(s => s.server_type !== 'trakt');
  const traktServers = servers.filter(s => s.server_type === 'trakt');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">Server Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Live connection status for all your media servers</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 rounded-xl gap-2">
          <Link to="/connect-server"><Plus className="w-4 h-4" /> Add Server</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <Server className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-heading font-semibold text-foreground">No servers connected</p>
            <p className="text-muted-foreground text-sm mt-1">Connect Plex, Emby, or Jellyfin to get started</p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-xl gap-2 mt-2">
            <Link to="/connect-server"><Plus className="w-4 h-4" /> Connect a Server</Link>
          </Button>
        </div>
      ) : (
        <>
          <SummaryBar servers={servers} />

          {mediaServers.length > 0 && (
            <div className="mb-8">
              <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Media Servers</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mediaServers.map(srv => (
                  <ServerCard key={srv.id} server={srv} onDelete={() => deleteMutation.mutate(srv.id)} deleting={deleteMutation.isPending} />
                ))}
              </div>
            </div>
          )}

          {traktServers.length > 0 && (
            <div>
              <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Tracking Services</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {traktServers.map(srv => (
                  <ServerCard key={srv.id} server={srv} onDelete={() => deleteMutation.mutate(srv.id)} deleting={deleteMutation.isPending} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}