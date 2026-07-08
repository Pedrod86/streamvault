import React from 'react';

// Small stacked quality/codec badge (e.g. "1080p" over "H264"),
// mirroring the overlay shown on episode thumbnails.
export default function QualityBadge({ quality, codec, className = '' }) {
  if (!quality && !codec) return null;
  return (
    <div className={`inline-flex flex-col items-stretch rounded-md overflow-hidden text-[8px] font-bold leading-none shadow ${className}`}>
      {quality && (
        <span className="px-1.5 py-0.5 bg-black/80 text-white text-center">{quality}</span>
      )}
      {codec && (
        <span className="px-1.5 py-0.5 bg-primary text-primary-foreground text-center">{codec}</span>
      )}
    </div>
  );
}