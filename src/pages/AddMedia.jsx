import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, X, Film, Tv } from 'lucide-react';
import { motion } from 'framer-motion';

const GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Thriller'];
const CONTENT_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];

const EMPTY = {
  title: '', media_type: 'movie', description: '', year: '', rating: '',
  duration_minutes: '', poster_url: '', backdrop_url: '', video_url: '',
  director: '', studio: '', content_rating: '', season_count: '', episode_count: '',
  genre: [], cast: [], tags: [], is_featured: false,
};

export default function AddMedia() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [castInput, setCastInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleGenre = (g) => set('genre', form.genre.includes(g) ? form.genre.filter(x => x !== g) : [...form.genre, g]);

  const addCast = () => {
    const name = castInput.trim();
    if (name && !form.cast.includes(name)) set('cast', [...form.cast, name]);
    setCastInput('');
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) set('tags', [...form.tags, tag]);
    setTagInput('');
  };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Media.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      navigate(`/media/${created.id}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      year: form.year ? Number(form.year) : undefined,
      rating: form.rating ? Number(form.rating) : undefined,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      season_count: form.season_count ? Number(form.season_count) : undefined,
      episode_count: form.episode_count ? Number(form.episode_count) : undefined,
    };
    saveMutation.mutate(payload);
  };

  const isTV = form.media_type === 'tv_show';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Add New Media</h1>
          <p className="text-muted-foreground text-sm">Manually add a movie or TV show</p>
        </div>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* Type Toggle */}
        <div className="flex gap-3">
          {[{ val: 'movie', label: 'Movie', Icon: Film }, { val: 'tv_show', label: 'TV Show', Icon: Tv }].map(({ val, label, Icon }) => (
            <button key={val} type="button"
              onClick={() => set('media_type', val)}
              className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border font-semibold text-sm transition-all ${
                form.media_type === val
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Basic Info */}
        <div className="space-y-4 p-5 rounded-xl bg-card border border-border">
          <h2 className="font-heading font-semibold text-foreground text-sm uppercase tracking-wider">Basic Info</h2>
          <div>
            <Label className="text-sm text-foreground">Title <span className="text-destructive">*</span></Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Enter title..." className="mt-1 bg-secondary border-border h-11" required />
          </div>
          <div>
            <Label className="text-sm text-foreground">Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Plot summary..." className="mt-1 bg-secondary border-border resize-none" rows={3} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm text-foreground">Year</Label>
              <Input type="number" value={form.year} onChange={e => set('year', e.target.value)} placeholder="2024" className="mt-1 bg-secondary border-border h-11" min="1900" max="2030" />
            </div>
            <div>
              <Label className="text-sm text-foreground">Rating (0–10)</Label>
              <Input type="number" value={form.rating} onChange={e => set('rating', e.target.value)} placeholder="8.5" className="mt-1 bg-secondary border-border h-11" min="0" max="10" step="0.1" />
            </div>
            {isTV ? (
              <>
                <div>
                  <Label className="text-sm text-foreground">Seasons</Label>
                  <Input type="number" value={form.season_count} onChange={e => set('season_count', e.target.value)} placeholder="3" className="mt-1 bg-secondary border-border h-11" min="1" />
                </div>
                <div>
                  <Label className="text-sm text-foreground">Episodes</Label>
                  <Input type="number" value={form.episode_count} onChange={e => set('episode_count', e.target.value)} placeholder="24" className="mt-1 bg-secondary border-border h-11" min="1" />
                </div>
              </>
            ) : (
              <div>
                <Label className="text-sm text-foreground">Duration (mins)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} placeholder="120" className="mt-1 bg-secondary border-border h-11" min="1" />
              </div>
            )}
            <div>
              <Label className="text-sm text-foreground">Content Rating</Label>
              <Select value={form.content_rating} onValueChange={v => set('content_rating', v)}>
                <SelectTrigger className="mt-1 bg-secondary border-border h-11"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {CONTENT_RATINGS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Genres */}
        <div className="space-y-3 p-5 rounded-xl bg-card border border-border">
          <h2 className="font-heading font-semibold text-foreground text-sm uppercase tracking-wider">Genres</h2>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <button key={g} type="button" onClick={() => toggleGenre(g)}
                className={`h-8 px-3 rounded-full text-xs font-medium border transition-all ${
                  form.genre.includes(g)
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >{g}</button>
            ))}
          </div>
        </div>

        {/* Credits */}
        <div className="space-y-4 p-5 rounded-xl bg-card border border-border">
          <h2 className="font-heading font-semibold text-foreground text-sm uppercase tracking-wider">Credits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-foreground">Director</Label>
              <Input value={form.director} onChange={e => set('director', e.target.value)} placeholder="Director name" className="mt-1 bg-secondary border-border h-11" />
            </div>
            <div>
              <Label className="text-sm text-foreground">Studio</Label>
              <Input value={form.studio} onChange={e => set('studio', e.target.value)} placeholder="Production studio" className="mt-1 bg-secondary border-border h-11" />
            </div>
          </div>
          <div>
            <Label className="text-sm text-foreground">Cast</Label>
            <div className="flex gap-2 mt-1">
              <Input value={castInput} onChange={e => setCastInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCast())} placeholder="Actor name, press Enter" className="bg-secondary border-border h-11" />
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 border-border shrink-0" onClick={addCast}><Plus className="w-4 h-4" /></Button>
            </div>
            {form.cast.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.cast.map(c => (
                  <Badge key={c} variant="secondary" className="gap-1 pr-1">
                    {c}
                    <button type="button" onClick={() => set('cast', form.cast.filter(x => x !== c))}><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Images & URLs */}
        <div className="space-y-4 p-5 rounded-xl bg-card border border-border">
          <h2 className="font-heading font-semibold text-foreground text-sm uppercase tracking-wider">Images & URLs</h2>
          <div>
            <Label className="text-sm text-foreground">Poster URL</Label>
            <Input value={form.poster_url} onChange={e => set('poster_url', e.target.value)} placeholder="https://…" className="mt-1 bg-secondary border-border h-11" />
          </div>
          <div>
            <Label className="text-sm text-foreground">Backdrop URL</Label>
            <Input value={form.backdrop_url} onChange={e => set('backdrop_url', e.target.value)} placeholder="https://…" className="mt-1 bg-secondary border-border h-11" />
          </div>
          <div>
            <Label className="text-sm text-foreground">Video URL</Label>
            <Input value={form.video_url} onChange={e => set('video_url', e.target.value)} placeholder="https://…" className="mt-1 bg-secondary border-border h-11" />
          </div>
        </div>

        {/* Tags & Featured */}
        <div className="space-y-4 p-5 rounded-xl bg-card border border-border">
          <h2 className="font-heading font-semibold text-foreground text-sm uppercase tracking-wider">Tags & Settings</h2>
          <div>
            <Label className="text-sm text-foreground">Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Tag, press Enter" className="bg-secondary border-border h-11" />
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 border-border shrink-0" onClick={addTag}><Plus className="w-4 h-4" /></Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1 pr-1">
                    {t}
                    <button type="button" onClick={() => set('tags', form.tags.filter(x => x !== t))}><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} className="w-4 h-4 accent-primary rounded" />
            <span className="text-sm text-foreground">Feature on homepage hero banner</span>
          </label>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pb-8">
          <Button type="button" variant="outline" className="flex-1 h-11 border-border rounded-xl" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" className="flex-1 h-11 bg-primary hover:bg-primary/90 rounded-xl font-semibold" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Add Media'}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}