import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Folder, FolderPlus, Plus, Trash2, Loader2 } from 'lucide-react';

export default function Folders() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => base44.entities.Collection.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) return;
      return base44.entities.Collection.create({ name, media_ids: [] });
    },
    onSuccess: () => {
      setNewName('');
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Collection.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  });

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Folder className="w-6 h-6 text-primary" />
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">Folders</h1>
        </div>
        {!creating && (
          <Button className="bg-primary hover:bg-primary/90 rounded-xl gap-2" onClick={() => setCreating(true)}>
            <FolderPlus className="w-4 h-4" /> New Folder
          </Button>
        )}
      </div>

      {creating && (
        <div className="flex gap-2 mb-6">
          <Input
            autoFocus
            placeholder="Folder name… e.g. Kids Movies"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createMutation.mutate()}
            className="bg-secondary border-border text-foreground h-11 rounded-xl"
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!newName.trim() || createMutation.isPending}
            className="h-11 px-4 rounded-xl"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
          </Button>
          <Button variant="ghost" onClick={() => { setCreating(false); setNewName(''); }} className="h-11 px-4 rounded-xl">
            Cancel
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl bg-secondary" />)}
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-20">
          <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No folders yet</p>
          <p className="text-muted-foreground text-sm mt-1">Create a folder like "Kids Movies" and add titles to it</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {collections.map(col => (
            <div
              key={col.id}
              onClick={() => navigate(`/folder/${col.id}`)}
              className="relative group cursor-pointer rounded-xl bg-card border border-border hover:border-primary/40 transition-colors p-5 flex flex-col gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                <Folder className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-semibold text-foreground truncate">{col.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{(col.media_ids || []).length} items</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(col.id); }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}