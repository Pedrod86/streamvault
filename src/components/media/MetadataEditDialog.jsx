import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Manually edit a media item's metadata: title, poster, description, genres, year.
 */
export default function MetadataEditDialog({ open, onOpenChange, media }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(media?.title || '');
  const [year, setYear] = useState(media?.year ? String(media.year) : '');
  const [posterUrl, setPosterUrl] = useState(media?.poster_url || '');
  const [description, setDescription] = useState(media?.description || '');
  const [genres, setGenres] = useState((media?.genre || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await base44.entities.Media.update(media.id, {
        title: title.trim(),
        year: year ? parseInt(year, 10) || undefined : undefined,
        poster_url: posterUrl.trim() || undefined,
        description: description.trim() || undefined,
        genre: genres.split(',').map(g => g.trim()).filter(Boolean),
      });
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setDone(true);
      setTimeout(() => onOpenChange(false), 1000);
    } catch (e) {
      setError(e.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Metadata</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-secondary border-border h-10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Year</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" placeholder="2024" className="bg-secondary border-border h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Poster URL</Label>
            <Input value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="https://…" className="bg-secondary border-border h-10" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Genres <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
            <Input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Action, Drama" className="bg-secondary border-border h-10" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-foreground">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="bg-secondary border-border resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <Button className="w-full h-10 gap-2" onClick={save} disabled={saving || !title.trim()}>
            {done ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}