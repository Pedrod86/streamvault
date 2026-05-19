import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchServerLibrary } from '@/lib/serverSync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, AlertCircle, RefreshCw, Clock, Database,
  Server, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

function StatusBadge({ status }) {
  if (status === 'success') return <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1"><CheckCircle2 className="w-3 h-3" />Success</Badge>;
  if (status === 'error')   return <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1"><AlertCircle className="w-3 h-3" />Failed</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1"><AlertCircle className="w-3 h-3" />Partial</Badge>;
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
            {log.started_at ? formatDistanceToNow(new Date(log.started_at), { addSuffix: true }) : formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}
            {log.duration_seconds != null && ` · ${log.duration_seconds}s`}
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
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Fetched', value: log.items_fetched ?? '—' },
                  { label: 'Created', value: log.items_created ?? '—' },
                  { label: 'Updated', value: log.items_updated ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-secondary rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground space-y-1">
                {log.started_at && (
                  <p><span className="text-foreground/60">Started:</span> {format(new Date(log.started_at), 'dd MMM yyyy, HH:mm:ss')}</p>
                )}
                <p><span className="text-foreground/60">Recorded:</span> {format(new Date(log.created_date), 'dd MMM yyyy, HH:mm:ss')}</p>
              </div>

              {/* Error details */}
              {log.error_message && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-destructive mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />Error Details
                  </p>
                  <p className="text-xs text-destructive/80 font-mono break-all leading-relaxed">{log.error_message}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SyncStatus() {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState(null);
  const [syncError, setSyncError] = useState({});

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
      const created = result?._serverSideSync ? (result.created || 0) : 0;
      const fetched = result?._serverSideSync ? (result.fetched || 0) : (Array.isArray(result) ? result.length : 0);
      await base44.entities.SyncLog.create({
        server_id: server.id,
        server_name: server.server_name || server.server_type,
        server_type: server.server_type,
        status: 'success',
        items_fetched: fetched,
        items_created: created,
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

  const clearLogs = async () => {
    await Promise.all(logs.map(l => base44.entities.SyncLog.delete(l.id)));
    queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
  };

  // Group logs by server
  const logsByServer = {};
  logs.forEach(l => {
    if (!logsByServer[l.server_id]) logsByServer[l.server_id] = [];
    logsByServer[l.server_id].push(l);
  });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Sync Status</h1>
          <p className="text-muted-foreground text-sm mt-1">Sync history and error details for each server</p>
        </div>
        {logs.length > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={clearLogs}>
            <Trash2 className="w-3.5 h-3.5" />
            Clear Logs
          </Button>
        )}
      </div>

      {/* Manual Sync Triggers */}
      <section className="space-y-3 p-5 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold text-foreground">Sync Servers</h2>
        </div>

        {mediaServers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No media servers connected.</p>
        ) : (
          <div className="space-y-2">
            {mediaServers.map(server => {
              const isSyncing = syncingId === server.id;
              const err = syncError[server.id];
              const serverLogs = logsByServer[server.id] || [];
              const lastLog = serverLogs[0];
              return (
                <div key={server.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{server.server_name || server.server_type}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {lastLog
                        ? `Last synced ${formatDistanceToNow(new Date(lastLog.created_date), { addSuffix: true })}`
                        : 'Never synced'}
                    </p>
                    {err && <p className="text-xs text-destructive mt-0.5 leading-snug">{err}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border h-8 px-3 gap-1.5 text-xs shrink-0"
                    disabled={isSyncing}
                    onClick={() => runSync(server)}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing…' : 'Sync Now'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sync History */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold text-foreground">Sync History</h2>
          <span className="text-xs text-muted-foreground ml-auto">{logs.length} entries</span>
        </div>

        {logsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
              <Database className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No sync history yet.<br />Run a sync above to see logs here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </section>
    </div>
  );
}