import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Pings a media server and shows a live health badge.
 * Props: server (MediaServer entity record)
 */
export default function ServerHealthBadge({ server }) {
  const [status, setStatus] = useState('checking'); // checking | ok | error
  const [errorMsg, setErrorMsg] = useState('');

  const ping = async () => {
    setStatus('checking');
    setErrorMsg('');
    try {
      let base = (server.server_url || '').trim();
      if (base && !/^https?:\/\//i.test(base)) base = 'http://' + base;
      base = base.replace(/\/$/, '');

      if (!base) throw new Error('No server URL configured');

      const token = server.api_token || server.plex_token;
      let url;
      if (server.server_type === 'plex') {
        url = `${base}/identity?X-Plex-Token=${token}`;
      } else if (server.server_type === 'xtream') {
        const u = encodeURIComponent(server.username || '');
        const p = encodeURIComponent(server.password || '');
        // base may include a path prefix like /api — use it directly
        url = `${base}/player_api.php?username=${u}&password=${p}`;
      } else {
        url = `${base}/System/Info/Public`;
      }

      // Ping through the backend proxy (same path the rest of the app uses).
      // A direct browser fetch gets blocked by CORS on most Emby servers,
      // which would falsely report a perfectly healthy server as "offline".
      const res = await base44.functions.invoke('mediaProxy', { url });
      if (res.data?.error) throw new Error(res.data.error);
      if (!res.data?.ok) throw new Error(`HTTP ${res.data?.status || '???'}`);
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      const msg = err?.message || 'Unreachable';
      if (/timed out|timeout/i.test(msg)) {
        setErrorMsg('Timed out — server unreachable');
      } else {
        setErrorMsg(msg);
      }
    }
  };

  useEffect(() => { ping(); }, [server.id]);

  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Checking…
      </span>
    );
  }

  if (status === 'ok') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
        <CheckCircle2 className="w-3 h-3" /> Online
      </span>
    );
  }

  // error
  return (
    <span
      className="flex items-center gap-1.5 text-xs text-destructive font-medium cursor-pointer group"
      title={errorMsg}
      onClick={ping}
    >
      <AlertCircle className="w-3 h-3 shrink-0" />
      <span className="truncate max-w-[140px]">{errorMsg}</span>
      <RefreshCw className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </span>
  );
}