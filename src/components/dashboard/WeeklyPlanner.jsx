import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { CalendarDays, Plus, Check, Trash2, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import WatchedDayList from './WatchedDayList';

const DAYS = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

// JS getDay(): 0=Sun..6=Sat → our day ids
const DAY_BY_INDEX = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function WeeklyPlanner({ pendingItem, onConsumePending }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [addingDay, setAddingDay] = useState(null);
  const [titleInput, setTitleInput] = useState('');
  const [loadingPlayId, setLoadingPlayId] = useState(null);

  // Play a planned item — for shows, resolve & play the latest episode; otherwise open the title.
  const handlePlay = async (plan) => {
    if (!plan.emby_id) {
      navigate(`/search?q=${encodeURIComponent(plan.title)}`);
      return;
    }
    if (plan.media_type === 'tv_show') {
      setLoadingPlayId(plan.id);
      try {
        const res = await base44.functions.invoke('embyEpisodes', { seriesId: plan.emby_id, latest: true });
        const ep = res.data?.episode;
        if (ep?.id) {
          navigate(`/media/emby:${ep.id}?type=Episode&title=${encodeURIComponent(plan.title + ' · ' + (ep.name || ''))}`);
        } else {
          navigate(`/media/emby:${plan.emby_id}`);
        }
      } catch {
        toast.error('Could not load the latest episode');
        navigate(`/media/emby:${plan.emby_id}`);
      } finally {
        setLoadingPlayId(null);
      }
    } else {
      navigate(`/media/emby:${plan.emby_id}`);
    }
  };

  const { data: plans = [] } = useQuery({
    queryKey: ['weeklyPlan'],
    queryFn: () => base44.entities.WeeklyPlan.list('-created_date', 200),
  });

  // This week's watch history, resolved to titles and bucketed by weekday
  const { data: history = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-last_watched', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allMedia = [] } = useQuery({
    queryKey: ['media'],
    queryFn: () => base44.entities.Media.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const watchedByDay = React.useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const mediaById = new Map(allMedia.map(m => [m.id, m]));
    const buckets = {};
    history.forEach(h => {
      if (!h.last_watched) return;
      const ts = new Date(h.last_watched).getTime();
      if (ts < weekAgo) return;
      const dayId = DAY_BY_INDEX[new Date(h.last_watched).getDay()];
      const media = mediaById.get(h.media_id);
      const title = media?.title
        || (h.media_id?.startsWith('emby:') ? 'Emby title' : h.media_id);
      (buckets[dayId] ||= []).push({
        id: h.id,
        media_id: h.media_id,
        title,
        last_watched: h.last_watched,
      });
    });
    return buckets;
  }, [history, allMedia]);

  const createPlan = useMutation({
    mutationFn: (data) => base44.entities.WeeklyPlan.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weeklyPlan'] }),
  });

  const updatePlan = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WeeklyPlan.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weeklyPlan'] }),
  });

  const deletePlan = useMutation({
    mutationFn: (id) => base44.entities.WeeklyPlan.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weeklyPlan'] }),
  });

  // When a suggestion is "added to plan", prompt to pick a day
  React.useEffect(() => {
    if (pendingItem) setAddingDay('__pick__');
  }, [pendingItem]);

  const addPendingToDay = (day) => {
    createPlan.mutate({
      day,
      title: pendingItem.title,
      media_type: pendingItem.media_type,
      poster_url: pendingItem.poster_url,
      emby_id: pendingItem.emby_id || undefined,
    });
    onConsumePending?.();
    setAddingDay(null);
  };

  const addManual = (day) => {
    if (!titleInput.trim()) return;
    createPlan.mutate({ day, title: titleInput.trim() });
    setTitleInput('');
    setAddingDay(null);
  };

  return (
    <div className="px-4 sm:px-6 mb-10">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h2 className="font-heading font-bold text-base text-foreground">Plan My Week</h2>
      </div>

      {/* Day picker prompt for pending suggestion */}
      {pendingItem && addingDay === '__pick__' && (
        <div className="mb-4 p-3 rounded-xl bg-secondary border border-border">
          <p className="text-sm text-foreground mb-2">
            Add <span className="font-semibold">{pendingItem.title}</span> to which day?
          </p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(d => (
              <button key={d.id} onClick={() => addPendingToDay(d.id)}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                {d.label}
              </button>
            ))}
            <button onClick={() => { onConsumePending?.(); setAddingDay(null); }}
              className="px-3 py-1.5 rounded-lg bg-card text-muted-foreground text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {DAYS.map(day => {
          const dayPlans = plans.filter(p => p.day === day.id);
          const dayWatched = watchedByDay[day.id] || [];
          return (
            <div key={day.id} className="rounded-xl bg-card border border-border p-3 min-h-[120px]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-heading font-semibold text-sm text-foreground">{day.label}</span>
                <button
                  onClick={() => { setAddingDay(addingDay === day.id ? null : day.id); setTitleInput(''); }}
                  className="w-6 h-6 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground flex items-center justify-center text-muted-foreground transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {addingDay === day.id && (
                <div className="mb-2 flex gap-1">
                  <Input
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addManual(day.id)}
                    placeholder="Title…"
                    className="h-8 text-xs bg-secondary border-border"
                    autoFocus
                  />
                  <Button size="sm" className="h-8 px-2" onClick={() => addManual(day.id)}>Add</Button>
                </div>
              )}

              <div className="space-y-1.5">
                {dayPlans.length === 0 && dayWatched.length === 0 && addingDay !== day.id && (
                  <p className="text-[11px] text-muted-foreground">Nothing planned</p>
                )}
                {dayPlans.map(p => (
                  <div key={p.id} className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 ${p.watched ? 'bg-secondary/50' : 'bg-secondary'}`}>
                    <button
                      onClick={() => updatePlan.mutate({ id: p.id, data: { watched: !p.watched } })}
                      className={`w-4 h-4 rounded shrink-0 border flex items-center justify-center ${p.watched ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}
                    >
                      {p.watched && <Check className="w-3 h-3 text-primary-foreground" />}
                    </button>
                    <span
                      className={`flex-1 text-xs truncate cursor-pointer ${p.watched ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                      onClick={() => handlePlay(p)}
                    >
                      {p.title}
                    </span>
                    <button
                      onClick={() => handlePlay(p)}
                      title={p.media_type === 'tv_show' ? 'Play latest episode' : 'Play'}
                      className="w-6 h-6 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center text-primary-foreground shrink-0"
                    >
                      {loadingPlayId === p.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3 fill-current" />
                      )}
                    </button>
                    <button onClick={() => deletePlan.mutate(p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <WatchedDayList entries={dayWatched} />
            </div>
          );
        })}
      </div>
    </div>
  );
}