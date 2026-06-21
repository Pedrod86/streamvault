import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Folder, X } from 'lucide-react';
import MediaCard from '@/components/media/MediaCard';

export default function FolderDetail() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const folderId = window.location.pathname.split('/folder/')[1];

  const { data: collection, isLoading: colLoading } = useQuery({
    queryKey: ['collection', folderId],
    queryFn: async () => {
      const items = await base44.entities.Collection.filter({ id: folderId });
      return items[0];
    },
    enabled: !!folderId,
  });

  const mediaIds = collection?.media_ids || [];

  // Resolve local Media records for the saved ids (skips non-local emby keys)
  const { data: items = [], isLoading: mediaLoading } = useQuery({
    queryKey: ['collectionMedia', mediaIds.join(',')],
    enabled: mediaIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        mediaIds.map(id => base44.entities.Media.filter({ id }).then(r => r[0]).catch(() => null))
      );
      return results.filter(Boolean);
    },
  });

  const removeItem = useMutation({
    mutationFn: (mediaId) => {
      const updated = mediaIds.filter(id => id !== mediaId);
      return base44.entities.Collection.update(folderId, { media_ids: updated });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', folderId] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const isLoading = colLoading || (mediaIds.length > 0 && mediaLoading);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/folders')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Folder className="w-6 h-6 text-primary" />
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground truncate">
          {collection?.name || 'Folder'}
        </h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-xl bg-secondary" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">This folder is empty</p>
          <p className="text-muted-foreground text-sm mt-1">Open any title and use "Collections" to add it here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map(media => (
            <div key={media.id} className="relative group">
              <MediaCard media={media} />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-black/60 text-white hover:bg-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeItem.mutate(media.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}