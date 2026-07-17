import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useDownloads } from '@/hooks/useDownloads';

/**
 * Per-item download button. Given a direct file URL, it triggers the browser's
 * native "save as / choose location" dialog so the user picks where to save it,
 * then records the item as downloaded so a status indicator can show it's ready
 * for offline viewing.
 *
 * Falls back to opening the URL in a new tab if a programmatic download is
 * blocked (e.g. cross-origin without CORS on some devices).
 */
export default function DownloadButton({ url, filename, item, className = '' }) {
  const [status, setStatus] = useState('idle'); // idle | working | done
  const { downloadedKeys, markDownloaded } = useDownloads();

  if (!url) return null;

  const alreadyDownloaded = item?.media_key && downloadedKeys.has(item.media_key);

  const recordDownload = () => {
    if (item?.media_key) markDownloaded.mutate(item);
  };

  const handleDownload = async () => {
    if (status === 'working') return;
    setStatus('working');
    try {
      // Fetch as a blob so the browser shows a real "save to…" picker with the
      // right filename, rather than streaming/playing the file inline.
      const res = await fetch(url);
      if (!res.ok) throw new Error('Fetch failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      recordDownload();
      setStatus('done');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (_) {
      // Fallback: let the browser handle it directly (still prompts to save
      // for non-inline content types).
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'download';
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        recordDownload();
        setStatus('idle');
      } catch (e) {
        toast.error('Could not start the download for this title.');
        setStatus('idle');
      }
    }
  };

  return (
    <Button
      variant="outline"
      className={`border-border text-foreground hover:bg-secondary gap-2 h-11 px-5 rounded-xl select-none ${className}`}
      onClick={handleDownload}
      disabled={status === 'working'}
    >
      {status === 'working' ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
      ) : status === 'done' || alreadyDownloaded ? (
        <><Check className="w-4 h-4 text-green-400" /> {alreadyDownloaded ? 'Downloaded' : 'Saved'}</>
      ) : (
        <><Download className="w-4 h-4" /> Download</>
      )}
    </Button>
  );
}