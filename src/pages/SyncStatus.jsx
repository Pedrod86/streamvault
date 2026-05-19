import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchServerLibrary } from '@/lib/serverSync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, AlertCircle, RefreshCw, Clock, Database,
  Server, ChevronDown, ChevronUp, Trash2, Copy, Check,
  Wifi, WifiOff, Filter, Info
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

function StatusBadge({ status }) {
  if (status === 'success') return <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1 shrink-0"><CheckCircle2 className="w-3 h-3" />Success</Badge>;
  if (status === 'error')   return <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1 shrink-0"><AlertCircle className="w-3 h-3" />Failed</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 shrink-0"><AlertCircle className="w-3 h-3" />Partial</Badge>;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <Server className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{log.server_name || log.server_type}</p>
          <p className="text-xs text-muted-foreground">
            {log.started_at
              ? formatDistanceToNow(new Date(log.started_at), { addSuffix: true })
              : formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}
            {log.duration_seconds != null && ` · ${log.duration_seconds}s`}
            {log.items_fetched != null && ` · ${log.items_fetched} fetched`}
          </p>
        </div>
        <StatusBadge status={log.status} />
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Fetched', value: log.items_fetched ?? '—', color: 'text-foreground' },
                  { label: 'Created', value: log.items_created ?? '—', color: 'text-green-400' },
                  { label: 'Updated', value: log.items_updated ?? '—', color: 'text-accent' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-secondary rounded-lg p-3 text-center">
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Timestamps */}
              <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                {log.started_at && (
                  <p><span className="text-foreground/70 font-medium">Started: </span>{format(new Date(log.started_at), 'dd MMM yyyy, HH:mm:ss')}</p>
                )}
                <p><span className="text-foreground/70 font-medium">Recorded: </span>{format(new Date(log.created_date), 'dd MMM yyyy, HH:mm:ss')}</p>
                {log.duration_seconds != null && (
                  <p><span className="text-foreground/70 font-medium">Duration: </span>{log.duration_seconds}s</p>
                )}
                <p><span className="text-foreground/70 font-medium">Server ID: </span><span className="font-mono">{log.server_id}</span></p>
              </div>

              {/* Error details */}
              {log.error_message && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <p className="text-xs font-semibold text-destructive">Error Details</p>
                    <CopyButton text={log.error_message} />
                  </div>
                  <p className="text-xs text-destructive/80 font-mono break-all leading-relaxed whitespace-pre-wrap">{log.error_message}</p>

                  {/* Helpful hints based on error content */}
                  {/local|private|ECONNREFUSED|dns|unreachable|network/i.test(log.error_message) && (
                    <div className="mt-2 pt-2 border-t border-destructive/20 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-400/80">This looks like a network error. Make sure your server URL is publicly accessible (not a local IP like 192.168.x.x), or that your Emby server has port forwarding set up.</p>
                    </div>
                  )}
                  {/401|403|unauthorized|api.?key|token/i.test(log.error_message) && (
                    <div className="mt-2 pt-2 border-t border-destructive/20 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-400/80">Authentication failed. Check that your API key is correct and hasn't expired. In Emby: Dashboard → Advanced → Security → API Keys.</p>
                    </div>
                  )}
                  {/timeout|abort/i.test(log.error_message) && (
                    <div className="mt-2 pt-2 border-t border-destructive/20 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-400/80">Request timed out. Your server may be slow or unreachable. Try again or check server health in the Emby dashboard.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ServerCard({ server, lastLog, onSync, isSyncing, syncError, pingStatus, onPing }) {
  return (
    <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          <Server className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{server.server_name || server.server_type}</p>
          <p className="text-xs text-muted-foreground capitalize">{server.server_type} · {server.auth_method}</p>
        </div>
        {lastLog && <StatusBadge status={lastLog.status} />}
      </div>

      {/* Server URL */}
      <div className="bg-card rounded-lg px-3 py-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium shrink-0">URL</span>
        <span className="text-xs text-foreground font-mono truncate flex-1">{server.server_url || '—'}</span>
        {server.server_url && <CopyButton text={server.server_url} />}
      </div>

      {/* Last sync info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {lastLog
            ? `Last synced ${formatDistanceToNow(new Date(lastLog.created_date), { addSuffix: true })}`
            : 'Never synced'}
          {lastLog?.items_fetched != null && ` · ${lastLog.items_fetched} items`}
        </span>
        {pingStatus === 'ok' && <span className="flex items-center gap-1 text-green-400"><Wifi className="w-3 h-3" />Online</span>}
        {pingStatus === 'err' && <span className="flex items-center gap-1 text-destructive"><WifiOff className="w-3 h-3" />Offline</span>}
      </div>

      {/* Inline sync error */}
      {syncError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive/80 leading-snug break-all">{syncError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="border-border h-8 px-3 gap-1.5 text-xs flex-1"
          disabled={isSyncing}
          onClick={onSync}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing…' : 'Sync Now'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-3 gap-1.5 text-xs text-muted-foreground border border-border"
          disabled={pingStatus === 'pinging'}
          onClick={onPing}
        >
          <Wifi className={`w-3.5 h-3.5 ${pingStatus === 'pinging' ? 'animate-pulse' : ''}`} />
          {pingStatus === 'pinging' ? 'Testing…' : 'Test'}
        </Button>
      </div>
    </div>
  );
}

export default function SyncStatus() {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState(null);
  const [syncError, setSyncError] = useState({});
  const [pingStatus, setPingStatus] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['syncLogs'],
    queryFn: () => base44.entities.SyncLog.list('-created_date', 100),
    staleTime: 30 * 1000,
  });

  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
  });

  const mediaServers = servers.filter(s => s.server_type !== 'trakt' && s.is_active !== false);

  const runSync = async (server) => {
    setSyncingId(server.id);
    setSyncError(e => ({ ...e, [server.id]: null }));
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    try {
      const result = await fetchServerLibrary(server);
      const duration = Math.round((Date.now() - t0) / 1000);
      const fetched = Array.isArray(result) ? result.length : (result?.fetched || 0);
      await base44.entities.SyncLog.create({
        server_id: server.id,
        server_name: server.server_name || server.server_type,
        server_type: server.server_type,
        status: 'success',
        items_fetched: fetched,
        items_created: result?.created || 0,
        items_updated: result?.updated || 0,
        duration_seconds: duration,
        started_at: startedAt,
      });
      queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
    } catch (err) {
      const duration = Math.round((Date.now() - t0) / 1000);
      const msg = err.message || String(err);
      setSyncError(e => ({ ...e, [server.id]: msg }));
      await base44.entities.SyncLog.create({
        server_id: server.id,
        server_name: server.server_name || server.server_type,
        server_type: server.server_type,
        status: 'error',
        error_message: msg,
        duration_seconds: duration,
        started_at: startedAt,
      });
      queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
    } finally {
      setSyncingId(null);
    }
  };

  const pingServer = async (server) => {
    setPingStatus(p => ({ ...p, [server.id]: 'pinging' }));
    try {
      await fetchServerLibrary({ ...server, _pingOnly: true });
      setPingStatus(p => ({ ...p, [server.id]: 'ok' }));
    } catch {
      setPingStatus(p => ({ ...p, [server.id]: 'err' }));
    }
    setTimeout(() => setPingStatus(p => ({ ...p, [server.id]: null })), 5000);
  };

  const clearLogs = async () => {
    await Promise.all(logs.map(l => base44.entities.SyncLog.delete(l.id)));
    queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
  };

  // Group logs by server for last-sync lookup
  const logsByServer = {};
  logs.forEach(l => {
    if (!logsByServer[l.server_id]) logsByServer[l.server_id] = [];
    logsByServer[l.server_id].push(l);
  });

  const filteredLogs = statusFilter === 'all' ? logs : logs.filter(l => l.status === statusFilter);
  const errorCount = logs.filter(l => l.status === 'error').length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-28 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Sync Status</h1>
        <p className="text-muted-foreground text-sm mt-1">Troubleshoot failed imports and view sync history</p>
      </div>

      {/* Summary stats */}
      {logs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Syncs', value: logs.length, color: 'text-foreground' },
            { label: 'Successful', value: logs.filter(l => l.status === 'success').length, color: 'text-green-400' },
            { label: 'Failed', value: errorCount, color: errorCount > 0 ? 'text-destructive' : 'text-muted-foreground' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold font-heading ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Servers */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold text-foreground">Connected Servers</h2>
        </div>

        {mediaServers.length === 0 ? (
          <div className="p-6 rounded-xl bg-card border border-border text-center">
            <p className="text-sm text-muted-foreground">No media servers connected. Go to Settings to add one.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mediaServers.map(server => (
              <ServerCard
                key={server.id}
                server={server}
                lastLog={(logsByServer[server.id] || [])[0]}
                onSync={() => runSync(server)}
                isSyncing={syncingId === server.id}
                syncError={syncError[server.id]}
                pingStatus={pingStatus[server.id]}
                onPing={() => pingServer(server)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Sync History */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <h2 className="font-heading font-semibold text-foreground">Sync History</h2>
          <span className="text-xs text-muted-foreground ml-1">{logs.length} entries</span>

          {/* Filter pills */}
          <div className="flex gap-1.5 ml-auto">
            {['all', 'success', 'error'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                  statusFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {logs.length > 0 && (
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5 h-7 px-2 text-xs" onClick={clearLogs}>
              <Trash2 className="w-3 h-3" />
              Clear
            </Button>
          )}
        </div>

        {logsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
              <Database className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {statusFilter !== 'all' ? `No ${statusFilter} syncs found.` : 'No sync history yet. Run a sync above to see logs here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map(log => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </section>
    </div>
  );
}