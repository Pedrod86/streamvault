import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PullToRefresh from '../components/layout/PullToRefresh';
import EmbyContinueWatching from '../components/media/EmbyContinueWatching';
import EmbyRecentlyAdded from '../components/media/EmbyRecentlyAdded';
import WatchSuggestions from '../components/dashboard/WatchSuggestions';
import WeeklyPlanner from '../components/dashboard/WeeklyPlanner';
import HoursWatchedSummary from '../components/dashboard/HoursWatchedSummary';
import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [pendingItem, setPendingItem] = useState(null);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['embyContinueWatching'] });
    await queryClient.invalidateQueries({ queryKey: ['embyRecentlyAdded'] });
    await queryClient.invalidateQueries({ queryKey: ['watchSuggestions'] });
    await queryClient.invalidateQueries({ queryKey: ['weeklyPlan'] });
  };

  const handleAddToPlan = (item) => {
    setPendingItem({
      title: item.title,
      media_type: item.media_type,
      poster_url: item.poster_url,
      emby_id: item.emby_id,
    });
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="pt-6">
        <div className="flex items-center gap-2 px-4 sm:px-6 mb-6">
          <LayoutDashboard className="w-6 h-6 text-primary" />
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">My Dashboard</h1>
        </div>

        <HoursWatchedSummary />
        <EmbyContinueWatching />
        <EmbyRecentlyAdded />
        <WatchSuggestions onAddToPlan={handleAddToPlan} />
        <WeeklyPlanner pendingItem={pendingItem} onConsumePending={() => setPendingItem(null)} />
      </div>
    </PullToRefresh>
  );
}