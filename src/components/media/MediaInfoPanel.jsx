import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Video, Music, FileText, Loader2 } from 'lucide-react';

function SpecRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-2 text-sm py-0.5">
      <span className="text-foreground font-medium shrink-0">{label}:</span>
      <span className="text-muted-foreground break-all">{value}</span>
    </div>
  );
}

function SpecCard({ icon: Icon, title, children }) {
  return (
    <div className="bg-secondary/50 rounded-2xl p-5 min-w-[280px] flex-1">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5 text-foreground" />
        <h4 className="font-heading font-bold text-lg text-foreground">{title}</h4>
      </div>
      <div>{children}</div>
    </div>
  );
}

// Renders the full technical Video/Audio breakdown + file path for an Emby item.
export default function MediaInfoPanel({ itemId, serverId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['embyMediaInfo', itemId, serverId || 'default'],
    enabled: !!itemId,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const res = await base44.functions.invoke('embyMediaInfo', {
        itemId,
        ...(serverId ? { serverId } : {}),
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
  });

  if (!itemId) return null;

  if (isLoading) {
    return (
      <div className="mb-8">
        <h3 className="font-heading font-bold text-2xl text-foreground mb-4">Media Information</h3>
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading media details…
        </div>
      </div>
    );
  }

  if (error || (!data?.video && !data?.audio)) return null;

  const { video, audio, file } = data;

  return (
    <div className="mb-8">
      <h3 className="font-heading font-bold text-2xl text-foreground mb-4">Media Information</h3>

      <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {video && (
          <SpecCard icon={Video} title="Video">
            <SpecRow label="Title" value={video.title} />
            <SpecRow label="Codec" value={video.codec} />
            <SpecRow label="Profile" value={video.profile} />
            <SpecRow label="Level" value={video.level} />
            <SpecRow label="Resolution" value={video.resolution} />
            <SpecRow label="Aspect Ratio" value={video.aspectRatio} />
            <SpecRow label="Interlaced" value={video.interlaced} />
            <SpecRow label="Frame Rate" value={video.frameRate} />
            <SpecRow label="Bit Rate" value={video.bitRate} />
            <SpecRow label="Video Range" value={video.videoRange} />
            <SpecRow label="Color Primaries" value={video.colorPrimaries} />
            <SpecRow label="Color Space" value={video.colorSpace} />
            <SpecRow label="Color Transfer" value={video.colorTransfer} />
            <SpecRow label="Bit Depth" value={video.bitDepth} />
            <SpecRow label="Pixel Format" value={video.pixelFormat} />
            <SpecRow label="Ref Frames" value={video.refFrames} />
          </SpecCard>
        )}

        {audio && (
          <SpecCard icon={Music} title="Audio">
            <SpecRow label="Title" value={audio.title} />
            <SpecRow label="Language" value={audio.language} />
            <SpecRow label="Codec" value={audio.codec} />
            <SpecRow label="Channel Layout" value={audio.channelLayout} />
            <SpecRow label="Channels" value={audio.channels} />
            <SpecRow label="Sample Rate" value={audio.sampleRate} />
            <SpecRow label="Bit Rate" value={audio.bitRate} />
            <SpecRow label="Default" value={audio.default} />
          </SpecCard>
        )}
      </div>

      {file && (file.path || file.size) && (
        <div className="mt-4 bg-secondary/50 rounded-2xl p-5 text-center">
          {file.path && (
            <p className="text-muted-foreground text-sm break-all flex items-center justify-center gap-2">
              <FileText className="w-4 h-4 shrink-0" /> {file.path}
            </p>
          )}
          <p className="text-muted-foreground text-sm mt-2">
            {[file.runtime, file.size, file.summary].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}