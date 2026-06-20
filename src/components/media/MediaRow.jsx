import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronRight as ChevronArrow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MediaCard from './MediaCard';

export default function MediaRow({ title, items, watchHistory, showProgress }) {
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  const openCategory = () => {
    navigate('/category', { state: { title, items } });
  };

  const scroll = (dir) => {
    if (scrollRef.current) {
      const amount = dir === 'left' ? -400 : 400;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
        <button
          onClick={openCategory}
          className="group flex items-center gap-1 font-heading font-bold text-lg sm:text-xl text-foreground hover:text-primary transition-colors"
        >
          {title}
          <ChevronArrow className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => scroll('left')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => scroll('right')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((media) => {
          const progress = watchHistory?.find(h => h.media_id === media.id);
          return (
            <div key={media.id} className="shrink-0 w-[140px] sm:w-[160px] lg:w-[180px]">
              <MediaCard media={media} showProgress={showProgress} progress={progress} />
            </div>
          );
        })}
      </div>
    </section>
  );
}