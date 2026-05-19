import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

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
        url = `${base}/player_api.php?username=${u}&password=${p}`;
      } else {
        url = `${base}/System/Info/Public`;
      }

      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        setErrorMsg('Timed out — server unreachable');
      } else if (err.message === 'Failed to fetch' || err instanceof TypeError) {
        setErrorMsg('Cannot reach server (CORS or network)');
      } else {
        setErrorMsg(err.message || 'Unreachable');
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