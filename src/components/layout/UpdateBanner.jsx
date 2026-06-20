import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { downloadApk } from '@/lib/appVersion';

// App-wide banner that appears automatically when a newer GitHub release
// is available. Tapping "Update" downloads the APK in-place (no browser tab);
// Android then shows its install prompt.
export default function UpdateBanner() {
  const { release, updateAvailable } = useUpdateCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  const handleUpdate = () => {
    downloadApk(release.apk.download_url, release.apk.name);
  };

  return (
    <div
      className="fixed left-0 right-0 z-[60] flex items-center gap-3 px-4 py-2.5 bg-primary text-primary-foreground shadow-lg"
      style={{ top: 'env(safe-area-inset-top)' }}
    >
      <Download className="w-4 h-4 shrink-0" />
      <p className="text-sm font-medium flex-1 min-w-0 truncate">
        Update available — {release.tag} is ready to install
      </p>
      <button
        onClick={handleUpdate}
        className="shrink-0 bg-primary-foreground text-primary rounded-lg px-3 py-1 text-xs font-bold hover:opacity-90 transition-opacity"
      >
        Update ({release.apk.size_mb} MB)
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-primary-foreground/80 hover:text-primary-foreground"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}