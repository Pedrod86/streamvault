import React, { useState, useEffect, useCallback } from 'react';
import { HardDrive, RefreshCw, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDownloads } from '@/hooks/useDownloads';

function formatBytes(bytes) {
  if (!bytes || bytes < 1) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export default function StorageUsageSection() {
  const { downloads } = useDownloads();
  const [estimate, setEstimate] = useState(null); // { usage, quota }
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);

  const measure = useCallback(async () => {
    if (!navigator.storage?.estimate) {
      setSupported(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      setEstimate({ usage, quota });
    } catch {
      setSupported(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { measure(); }, [measure]);

  const usedPct = estimate?.quota ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.045 }}
      className="space-y-4 p-5 rounded-xl bg-card border border-border"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold text-foreground">Storage Usage</h2>
        </div>
        <button
          onClick={measure}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">How much space this app's content is using on this device.</p>

      {!supported ? (
        <p className="text-sm text-muted-foreground py-2">
          Storage information isn't available on this device or browser.
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-heading font-bold text-foreground">
                {loading && !estimate ? '…' : formatBytes(estimate?.usage)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                used{estimate?.quota ? ` of ${formatBytes(estimate.quota)} available` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <Download className="w-4 h-4" />
              <span className="font-semibold">{downloads.length}</span>
              <span className="text-muted-foreground">{downloads.length === 1 ? 'item' : 'items'} offline</span>
            </div>
          </div>

          {estimate?.quota > 0 && (
            <div>
              <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${usedPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{usedPct.toFixed(1)}% of your device allowance for this app</p>
            </div>
          )}
        </>
      )}
    </motion.section>
  );
}