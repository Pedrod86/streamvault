import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Play, CheckCircle2, XCircle, Loader2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function StreamTester() {
  const [customUrl, setCustomUrl] = useState('');
  const [testUrl, setTestUrl] = useState('');
  const [proxyStatus, setProxyStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [proxyMsg, setProxyMsg] = useState('');
  const [videoError, setVideoError] = useState('');
  const [videoOk, setVideoOk] = useState(false);
  const videoRef = useRef(null);

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list(),
    staleTime: 60 * 1000,
  });

  const embyServer = servers.find(s => s.server_type === 'emby' && s.is_active !== false);

  const embyStreamUrl = embyServer
    ? `${embyServer.server_url.replace(/\/$/, '')}/Videos/`
    : null;

  const runTest = async (url) => {
    if (!url) return;
    setTestUrl(url);
    setProxyStatus('loading');
    setProxyMsg('');
    setVideoError('');
    setVideoOk(false);

    // Step 1: test via proxy
    try {
      const res = await base44.functions.invoke('mediaProxy', { url });
      if (res.data?.ok) {
        setProxyStatus('ok');
        setProxyMsg(`Proxy reached server ✓ (HTTP ${res.data.status})`);
      } else {
        setProxyStatus('error');
        setProxyMsg(res.data?.error || `HTTP ${res.data?.status}`);
      }
    } catch (e) {
      setProxyStatus('error');
      setProxyMsg(e.message);
    }

    // Step 2: test direct video load
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
    }
  };

  const embyInfoUrl = embyServer
    ? `${embyServer.server_url.replace(/\/$/, '')}/System/Info/Public`
    : null;

  return (
    <div className="pt-16 pb-24 px-4 sm:px-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 pt-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Radio className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-lg text-foreground">Stream Tester</h1>
          <p className="text-xs text-muted-foreground">Diagnose connectivity and playback issues</p>
        </div>
      </div>

      {/* Quick tests */}
      {embyServer && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Quick Tests — {embyServer.server_name || 'Emby'}</p>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start text-xs"
              onClick={() => runTest(embyInfoUrl)}
            >
              Test API: /System/Info/Public
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start text-xs"
              onClick={() => runTest(`${embyServer.server_url.replace(/\/$/, '')}/Users/Public`)}
            >
              Test API: /Users/Public
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono break-all">{embyServer.server_url}</p>
        </div>
      )}

      {/* Custom URL */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Test Custom URL</p>
        <div className="flex gap-2">
          <Input
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            placeholder="https://your-server.com/Videos/123/stream?api_key=..."
            className="bg-secondary border-border rounded-xl text-xs"
          />
          <Button size="sm" onClick={() => runTest(customUrl)} disabled={!customUrl}>
            <Play className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Results */}
      {testUrl && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-4">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Results</p>
          <p className="text-[11px] text-muted-foreground font-mono break-all">{testUrl}</p>

          {/* Proxy test */}
          <div className="flex items-start gap-2">
            {proxyStatus === 'loading' && <Loader2 className="w-4 h-4 text-primary animate-spin mt-0.5 shrink-0" />}
            {proxyStatus === 'ok' && <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />}
            {proxyStatus === 'error' && <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
            <div>
              <p className="text-xs font-medium text-foreground">Backend Proxy</p>
              <p className="text-[11px] text-muted-foreground">{proxyMsg || 'Testing…'}</p>
            </div>
          </div>

          {/* Direct browser video test */}
          <div className="flex items-start gap-2">
            {!videoOk && !videoError && <Loader2 className="w-4 h-4 text-primary animate-spin mt-0.5 shrink-0" />}
            {videoOk && <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />}
            {videoError && <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
            <div>
              <p className="text-xs font-medium text-foreground">Browser Direct Access</p>
              <p className="text-[11px] text-muted-foreground">
                {videoOk ? 'Video stream accessible from browser ✓' : videoError || 'Testing…'}
              </p>
            </div>
          </div>

          {/* Hidden video element for testing */}
          <video
            ref={videoRef}
            className="hidden"
            preload="metadata"
            onCanPlay={() => setVideoOk(true)}
            onError={(e) => {
              const code = e.target.error?.code;
              const msgs = {
                1: 'Aborted',
                2: 'Network error — browser cannot reach this URL (possible CORS block)',
                3: 'Decode error — stream format not supported',
                4: 'Source not supported or CORS blocked',
              };
              setVideoError(msgs[code] || `Video error code ${code}`);
            }}
          />

          {/* Diagnosis */}
          {proxyStatus === 'ok' && videoError && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-xs text-yellow-400 font-medium">⚠ CORS Issue Detected</p>
              <p className="text-[11px] text-yellow-400/80 mt-1">
                The backend proxy can reach the server, but your browser cannot load the video directly.
                This is a CORS restriction on the Emby server. Try enabling CORS in Emby settings
                (Dashboard → Advanced → Allow remote access) or ensure the server sends
                <code className="mx-1 px-1 bg-yellow-500/20 rounded">Access-Control-Allow-Origin: *</code>
                headers for video streams.
              </p>
            </div>
          )}
          {proxyStatus === 'ok' && videoOk && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <p className="text-xs text-green-400 font-medium">✓ Everything working</p>
              <p className="text-[11px] text-green-400/80 mt-1">Server is reachable and video streams correctly.</p>
            </div>
          )}
          {proxyStatus === 'error' && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <p className="text-xs text-destructive font-medium">✗ Server unreachable</p>
              <p className="text-[11px] text-destructive/80 mt-1">
                Neither the backend proxy nor the browser can reach this URL. Check the server URL and that it's publicly accessible.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}