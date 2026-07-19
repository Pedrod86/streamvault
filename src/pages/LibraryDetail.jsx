import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Library, X, Pencil, Check } from 'lucide-react';
import MediaCard from '@/components/media/MediaCard';

export default function LibraryDetail() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const libraryId = window.location.pathname.split('/library/')[1];
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const { data: library, isLoading: libLoading } = useQuery({
    queryKey: ['userLibrary', libraryId],
    queryFn: async () => {
      const items = await base44.entities.UserLibrary.filter({ id: libraryId });
      return items[0];
    },
    enabled: !!libraryId,
  });

  const mediaIds = library?.media_ids || [];

  const { data: items = [], isLoading: mediaLoading } = useQuery({
    queryKey: ['userLibraryMedia', mediaIds.join(',')],
    enabled: mediaIds.length > 0,
    queryFn: async () => {
      // media_ids can hold local Media ids OR emby:<id> keys (items added
      // straight from a live Emby detail page that have no local record).
      const embyIds = mediaIds.filter(id => id.startsWith('emby:')).map(id => id.slice(5));
      const localIds = mediaIds.filter(id => !id.startsWith('emby:'));

      const localResults = await Promise.all(
        localIds.map(id => base44.entities.Media.filter({ id }).then(r => r[0]).catch(() => null))
      );

      // Resolve emby: keys through the Emby library function, mapping to the
      // display shape MediaCard expects (id stays emby:<id> so it links right).
      let embyResults = [];
      if (embyIds.length > 0) {
        try {
          const res = await base44.functions.invoke('embyLibrary', { ids: embyIds, pageSize: embyIds.length });
          embyResults = (res.data?.items || []).map(it => ({
            id: `emby:${it.id}`,
            title: it.title,
            media_type: it.type === 'Series' ? 'tv_show' : 'movie',
            poster_url: it.posterUrl,
            year: it.year,
            rating: it.rating,
            genre: it.genres || [],
          }));
        } catch (_) { /* skip emby items we can't read */ }
      }

      return [...localResults.filter(Boolean), ...embyResults];
    },
  });

  const renameMutation = useMutation({
    mutationFn: (name) => base44.entities.UserLibrary.update(libraryId, { name: name.trim() }),
    onSuccess: () => {
      setEditingName(false);
      queryClient.invalidateQueries({ queryKey: ['userLibrary', libraryId] });
      queryClient.invalidateQueries({ queryKey: ['userLibraries'] });
    },
  });

  const removeItem = useMutation({
    mutationFn: (mediaId) => {
      const updated = mediaIds.filter(id => id !== mediaId);
      return base44.entities.UserLibrary.update(libraryId, { media_ids: updated });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userLibrary', libraryId] });
      queryClient.invalidateQueries({ queryKey: ['userLibraries'] });
    },
  });

  const isLoading = libLoading || (mediaIds.length > 0 && mediaLoading);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/libraries')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Library className="w-6 h-6 text-primary shrink-0" />
        {editingName ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && editName.trim()) renameMutation.mutate(editName);
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="bg-secondary border-border text-foreground h-10 rounded-xl max-w-sm"
            />
            <Button size="icon" className="h-10 w-10 rounded-xl shrink-0" disabled={!editName.trim() || renameMutation.isPending} onClick={() => renameMutation.mutate(editName)}>
              <Check className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => setEditingName(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground truncate">
              {library?.name || 'Library'}
            </h1>
            {library && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => { setEditName(library.name); setEditingName(true); }}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-xl bg-secondary" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Library className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">This library is empty</p>
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