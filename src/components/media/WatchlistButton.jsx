import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Check, Loader2 } from 'lucide-react';

/**
 * Small overlay button to add/remove a media item from the user's watchlist
 * directly from a card, without opening the details page.
 *
 * mediaId: the Watchlist key for this item (e.g. "emby:<id>" or a DB id).
 * title: used for the toast message.
 */
export default function WatchlistButton({ mediaId, title }) {
  const queryClient = useQueryClient();

  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => base44.entities.Watchlist.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const entry = watchlist.find(w => w.media_id === mediaId);
  const inList = !!entry;

  const toggle = useMutation({
    mutationFn: async () => {
      if (entry) {
        await base44.entities.Watchlist.delete(entry.id);
      } else {
        await base44.entities.Watchlist.create({ media_id: mediaId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success(inList ? `Removed "${title}" from watchlist` : `Added "${title}" to watchlist`);
    },
    onError: () => toast.error('Could not update watchlist'),
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (!mediaId || toggle.isPending) return;
    toggle.mutate();
  };

  return (
    <button
      onClick={handleClick}
      title={inList ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
        inList
          ? 'bg-primary text-primary-foreground'
          : 'bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground'
      }`}
    >
      {toggle.isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : inList ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Plus className="w-3.5 h-3.5" />
      )}
    </button>
  );
}