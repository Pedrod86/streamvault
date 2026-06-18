import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MediaGrid from '../components/media/MediaGrid';

export default function CategoryView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { title = 'Category', items = [] } = location.state || {};

  const { data: watchHistory = [] } = useQuery({
    queryKey: ['watchHistory'],
    queryFn: () => base44.entities.WatchHistory.list('-updated_date', 50),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-bold text-2xl text-foreground">{title}</h1>
        <span className="text-sm text-muted-foreground ml-1">({items.length})</span>
      </div>
      <MediaGrid items={items} watchHistory={watchHistory} />
    </div>
  );
}