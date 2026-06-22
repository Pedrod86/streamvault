import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Library, Plus, Trash2, Loader2, Pencil, Check, X } from 'lucide-react';

export default function Libraries() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const { data: libraries = [], isLoading } = useQuery({
    queryKey: ['userLibraries'],
    queryFn: () => base44.entities.UserLibrary.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) return;
      return base44.entities.UserLibrary.create({ name, media_ids: [] });
    },
    onSuccess: () => {
      setNewName('');
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['userLibraries'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }) => base44.entities.UserLibrary.update(id, { name: name.trim() }),
    onSuccess: () => {
      setEditingId(null);
      setEditName('');
      queryClient.invalidateQueries({ queryKey: ['userLibraries'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.UserLibrary.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userLibraries'] }),
  });

  const startEdit = (lib) => {
    setEditingId(lib.id);
    setEditName(lib.name);
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Library className="w-6 h-6 text-primary" />
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">My Libraries</h1>
        </div>
        {!creating && (
          <Button className="bg-primary hover:bg-primary/90 rounded-xl gap-2" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> New Library
          </Button>
        )}
      </div>

      {creating && (
        <div className="flex gap-2 mb-6">
          <Input
            autoFocus
            placeholder="Library name… e.g. Weekend Watchlist"
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
      ) : libraries.length === 0 ? (
        <div className="text-center py-20">
          <Library className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No libraries yet</p>
          <p className="text-muted-foreground text-sm mt-1">Create a library, name it whatever you like, and add titles to it</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {libraries.map(lib => (
            <div
              key={lib.id}
              onClick={() => editingId !== lib.id && navigate(`/library/${lib.id}`)}
              className="relative group cursor-pointer rounded-xl bg-card border border-border hover:border-primary/40 transition-colors p-5 flex flex-col gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                <Library className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                {editingId === lib.id ? (
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <Input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && editName.trim()) renameMutation.mutate({ id: lib.id, name: editName });
                        if (e.key === 'Escape') { setEditingId(null); setEditName(''); }
                      }}
                      className="bg-secondary border-border text-foreground h-8 rounded-lg text-sm"
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-lg"
                      disabled={!editName.trim() || renameMutation.isPending}
                      onClick={() => renameMutation.mutate({ id: lib.id, name: editName })}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-lg"
                      onClick={() => { setEditingId(null); setEditName(''); }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="font-heading font-semibold text-foreground truncate">{lib.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{(lib.media_ids || []).length} items</p>
                  </>
                )}
              </div>
              {editingId !== lib.id && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); startEdit(lib); }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(lib.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}