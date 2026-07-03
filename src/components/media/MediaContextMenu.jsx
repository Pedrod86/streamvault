import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Search } from 'lucide-react';
import MetadataEditDialog from './MetadataEditDialog';
import MetadataFetchDialog from './MetadataFetchDialog';

/**
 * Long-press / right-click options for a catalogue item.
 * Offers "Fetch Metadata" (TMDB/TVDB) and "Edit Metadata" (manual).
 */
export default function MediaContextMenu({ open, onOpenChange, media }) {
  const [editOpen, setEditOpen] = useState(false);
  const [fetchOpen, setFetchOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-foreground truncate">{media?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => { onOpenChange(false); setFetchOpen(true); }}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary border border-border text-left transition-colors"
            >
              <Search className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Fetch Metadata</p>
                <p className="text-[11px] text-muted-foreground">Search TMDB or TVDB</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { onOpenChange(false); setEditOpen(true); }}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary border border-border text-left transition-colors"
            >
              <Pencil className="w-5 h-5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Edit Metadata</p>
                <p className="text-[11px] text-muted-foreground">Title, poster, description, genres, year</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {media && <MetadataEditDialog open={editOpen} onOpenChange={setEditOpen} media={media} />}
      {media && <MetadataFetchDialog open={fetchOpen} onOpenChange={setFetchOpen} media={media} />}
    </>
  );
}