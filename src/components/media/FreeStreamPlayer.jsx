import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Full-screen overlay player for free/legal embeddable streams.
 */
export default function FreeStreamPlayer({ title, embedUrl, watchUrl, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/80 backdrop-blur shrink-0">
        <h2 className="text-sm font-semibold text-white truncate max-w-[60vw]">{title}</h2>
        <div className="flex items-center gap-2">
          {watchUrl && (
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-white transition-colors"
              title="Open in original site"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-white h-8 w-8"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Iframe embed */}
      <div className="flex-1 relative">
        <iframe
          src={embedUrl}
          title={title}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          frameBorder="0"
        />
      </div>
    </div>
  );
}