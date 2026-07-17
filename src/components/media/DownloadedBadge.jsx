import React from 'react';
import { Download } from 'lucide-react';

/**
 * Small "downloaded / ready for offline" status pill shown on media cards
 * and rows. Two sizes: 'chip' (poster overlay) and 'inline' (list rows).
 */
export default function DownloadedBadge({ variant = 'chip', className = '' }) {
  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] text-green-400 ${className}`}>
        <Download className="w-2.5 h-2.5" /> Offline
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 bg-green-500/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md backdrop-blur-sm shadow ${className}`}
      title="Downloaded — ready for offline viewing"
    >
      <Download className="w-2.5 h-2.5" /> Offline
    </span>
  );
}