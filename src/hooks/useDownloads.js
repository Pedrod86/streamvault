import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Central hook for the user's "downloaded / ready for offline" records.
// Exposes the set of downloaded media keys plus a mutation to mark one saved.
export function useDownloads() {
  const queryClient = useQueryClient();

  const { data: downloads = [] } = useQuery({
    queryKey: ['downloads'],
    queryFn: () => base44.entities.Downloaded.list('-created_date', 1000),
    staleTime: 60 * 1000,
  });

  const downloadedKeys = new Set(downloads.map(d => d.media_key));

  const markDownloaded = useMutation({
    mutationFn: async ({ media_key, title, media_type, poster_url }) => {
      const existing = await base44.entities.Downloaded.filter({ media_key });
      if (existing[0]) return existing[0];
      return base44.entities.Downloaded.create({ media_key, title, media_type, poster_url });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads'] }),
  });

  const removeDownloaded = useMutation({
    mutationFn: async (media_key) => {
      const existing = await base44.entities.Downloaded.filter({ media_key });
      if (existing[0]) return base44.entities.Downloaded.delete(existing[0].id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads'] }),
  });

  return { downloads, downloadedKeys, markDownloaded, removeDownloaded };
}