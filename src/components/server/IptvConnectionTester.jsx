import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FlaskConical, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const STEPS = [
  {
    id: 'auth',
    label: 'Auth check',
    getUrl: (s) => {
      const u = encodeURIComponent(s.username || '');
      const p = encodeURIComponent(s.password || '');
      return `${s.server_url}/player_api.php?username=${u}&password=${p}`;
    },
  },
  {
    id: 'vod',
    label: 'VOD streams',
    getUrl: (s) => {
      const u = encodeURIComponent(s.username || '');
      const p = encodeURIComponent(s.password || '');
      return `${s.server_url}/player_api.php?username=${u}&password=${p}&action=get_vod_streams`;
    },
  },
  {
    id: 'series',
    label: 'Series list',
    getUrl: (s) => {
      const u = encodeURIComponent(s.username || '');
      const p = encodeURIComponent(s.password || '');
      return `${s.server_url}/player_api.php?username=${u}&password=${p}&action=get_series`;
    },
  },
];

export default function IptvConnectionTester({ server }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const runTest = async () => {
    setRunning(true);
    setResults(null);
    setExpanded(null);

    const stepResults = [];

    for (const step of STEPS) {
      const url = step.getUrl(server);
      const start = Date.now();
      let status, ok, preview, error;

      try {
        const res = await base44.functions.invoke('mediaProxy', { url });
        const d = res.data;
        const ms = Date.now() - start;
        let redirectChain = d?.redirectChain || null;

        if (d?.error) {
          status = d.status || 0;
          ok = false;
          error = d.error;
          preview = null;
        } else {
          status = d?.status;
          ok = d?.ok;
          const raw = d?.data;
          if (raw && typeof raw === 'object') {
            if (Array.isArray(raw)) {
              preview = `Array[${raw.length}]${raw[0] ? ` — first item: ${JSON.stringify(raw[0]).slice(0, 120)}` : ''}`;
            } else {
              preview = Object.keys(raw).slice(0, 6).map(k => {
                const v = raw[k];
                return `${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : v}`;
              }).join('\n');
            }
          } else if (typeof raw === 'string' && raw.includes('<html')) {
            // HTML response (e.g. Cloudflare redirect page) — flag it clearly
            ok = false;
            error = `Server returned HTML instead of JSON (HTTP ${status}). This usually means a redirect to a different URL or a login wall.\n\nHTML snippet: ${raw.slice(0, 300)}`;
            preview = null;
          } else {
            preview = String(raw ?? '').slice(0, 200);
          }
        }

        stepResults.push({ ...step, ms, status, ok, error, preview, redirectChain });
      } catch (err) {
        stepResults.push({ ...step, ms: Date.now() - start, status: 0, ok: false, error: err.message, preview: null, redirectChain: null });
      }

      // Stop after first failure
      if (!ok) break;
    }

    setResults(stepResults);
    setRunning(false);
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Connection Tester</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 text-xs gap-1.5 border-border"
          onClick={runTest}
          disabled={running}
        >
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
          {running ? 'Testing…' : 'Run Test'}
        </Button>
      </div>

      {results && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.id} className={`rounded-lg border text-xs overflow-hidden ${r.ok ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
              {/* Step header */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${r.ok ? 'bg-green-400' : 'bg-destructive'}`} />
                <span className={`font-semibold ${r.ok ? 'text-green-400' : 'text-destructive'}`}>{r.label}</span>
                <span className="text-muted-foreground ml-auto mr-1">{r.ms}ms · HTTP {r.status || '—'}</span>
                {expanded === r.id ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
              </button>

              {/* Expanded detail */}
              {expanded === r.id && (
                <div className="px-3 pb-3 border-t border-border/50 space-y-2">
                  {r.redirectChain && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-amber-400 mb-1">↪ Redirect chain ({r.redirectChain.length - 1} hop{r.redirectChain.length > 2 ? 's' : ''})</p>
                      <div className="space-y-0.5">
                        {r.redirectChain.map((u, i) => (
                          <p key={i} className="font-mono text-xs break-all">
                            <span className="text-muted-foreground mr-1">{i}.</span>
                            <span className={i === r.redirectChain.length - 1 ? 'text-foreground' : 'text-muted-foreground'}>{u}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {r.error ? (
                    <p className="text-destructive mt-2 leading-relaxed font-mono text-xs break-all whitespace-pre-wrap">{r.error}</p>
                  ) : (
                    <pre className="text-muted-foreground mt-2 whitespace-pre-wrap break-all leading-relaxed font-mono text-xs">{r.preview}</pre>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* All passed summary */}
          {results.length === STEPS.length && results.every(r => r.ok) && (
            <p className="text-xs text-green-400 font-medium pt-1">✓ All steps passed — server is reachable and authenticated</p>
          )}
        </div>
      )}
    </div>
  );
}