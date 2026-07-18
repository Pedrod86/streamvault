import React from 'react';
import { Link } from 'react-router-dom';
import { Download, Trash2, Film, Tv, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDownloads } from '@/hooks/useDownloads';

export default function Downloads() {
  const { downloads, removeDownloaded } = useDownloads();

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Download className="w-6 h-6 text-primary" />
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">Downloads</h1>
        {downloads.length > 0 && (
          <span className="text-sm text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">
            {downloads.length.toLocaleString()}
          </span>
        )}
      </div>

      {downloads.length === 0 ? (
        <div className="text-center py-24">
          <Download className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No downloads yet</p>
          <p className="text-muted-foreground/70 text-sm mt-1">
            Downloaded titles will appear here for offline access.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {downloads.map(item => {
            const detailKey = String(item.media_key);
            const detailUrl = detailKey.startsWith('emby:')
              ? `/media/${detailKey}?type=${item.media_type === 'tv_show' ? 'Series' : 'Movie'}&title=${encodeURIComponent(item.title || '')}${item.poster_url ? `&poster=${encodeURIComponent(item.poster_url)}` : ''}`
              : `/media/${detailKey}`;
            return (
              <div key={item.id} className="group relative rounded-xl overflow-hidden bg-secondary flex flex-col">
                <Link to={detailUrl} className="block">
                  <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                    {item.poster_url ? (
                      <img
                        src={item.poster_url}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {item.media_type === 'tv_show' ? (
                          <Tv className="w-10 h-10 text-muted-foreground" />
                        ) : (
                          <Film className="w-10 h-10 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary/90 text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                      <Download className="w-2.5 h-2.5" />
                      Saved
                    </div>
                  </div>
                </Link>
                <div className="p-2 flex items-center justify-between gap-1">
                  <p className="text-xs font-medium text-foreground truncate leading-tight">{item.title}</p>
                  <button
                    onClick={() => removeDownloaded.mutate(item.media_key)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove download"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}