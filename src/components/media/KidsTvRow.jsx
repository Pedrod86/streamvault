import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import MediaRow from './MediaRow';

// Renders a "Kids TV" row sourced from the user's "Kids Movies" collection/folder.
export default function KidsTvRow() {
  const { data: items = [] } = useQuery({
    queryKey: ['kidsMoviesFolder'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const folders = await base44.entities.Collection.filter({ name: 'Kids Movies' });
      const folder = folders[0];
      const ids = folder?.media_ids || [];
      if (!ids.length) return [];

      // Resolve local Media records (skip emby: prefixed ids — those have no local row)
      const localIds = ids.filter(id => !String(id).startsWith('emby:'));
      if (!localIds.length) return [];

      const all = await base44.entities.Media.list('-created_date', 2000);
      const byId = new Map(all.map(m => [m.id, m]));
      return localIds.map(id => byId.get(id)).filter(Boolean);
    },
  });

  if (!items.length) return null;

  return <MediaRow title="Kids Movies" items={items} />;
}