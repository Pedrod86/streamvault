import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Library, Check, Plus, Loader2 } from 'lucide-react';

export default function AddToLibrarySection({ mediaId }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: libraries = [] } = useQuery({
    queryKey: ['userLibraries'],
    queryFn: () => base44.entities.UserLibrary.list('-created_date', 100),
  });

  const toggleMutation = useMutation({
    mutationFn: async (library) => {
      const ids = library.media_ids || [];
      const has = ids.includes(mediaId);
      const updated = has ? ids.filter(id => id !== mediaId) : [...ids, mediaId];
      return base44.entities.UserLibrary.update(library.id, { media_ids: updated });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userLibraries'] }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) return;
      return base44.entities.UserLibrary.create({ name, media_ids: [mediaId] });
    },
    onSuccess: () => {
      setNewName('');
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['userLibraries'] });
    },
  });

  return (
    <div className="border-t border-border/60 pt-3 mt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <Library className="w-3.5 h-3.5 text-primary" /> My Libraries
      </p>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {libraries.length === 0 && !creating && (
          <p className="text-sm text-muted-foreground text-center py-3">No libraries yet. Create one below.</p>
        )}
        {libraries.map(lib => {
          const has = (lib.media_ids || []).includes(mediaId);
          return (
            <button
              key={lib.id}
              onClick={() => toggleMutation.mutate(lib)}
              disabled={toggleMutation.isPending}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border/50 transition-colors text-left"
            >
              <span className="text-sm font-medium text-foreground truncate">{lib.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground">{(lib.media_ids || []).length} items</span>
                {has && <Check className="w-4 h-4 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>

      {creating ? (
        <div className="flex gap-2 mt-2">
          <Input
            autoFocus
            placeholder="Library name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createMutation.mutate()}
            className="bg-secondary border-border text-foreground h-9"
          />
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!newName.trim() || createMutation.isPending}
            className="h-9 px-3"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)} className="h-9 px-3">
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full mt-2 border-dashed border-border/70 text-muted-foreground hover:text-foreground gap-2"
          onClick={() => setCreating(true)}
        >
          <Plus className="w-4 h-4" /> New Library
        </Button>
      )}
    </div>
  );
}