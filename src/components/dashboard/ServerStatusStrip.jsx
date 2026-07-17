import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Server } from 'lucide-react';
import ServerHealthBadge from '../server/ServerHealthBadge';

const TYPE_LABELS = { plex: 'Plex', emby: 'Emby', jellyfin: 'Jellyfin' };
const TYPE_COLORS = { plex: 'text-yellow-500', emby: 'text-green-500', jellyfin: 'text-purple-500' };

export default function ServerStatusStrip() {
  const { data: servers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list(),
    staleTime: 60 * 1000,
  });

  const monitored = servers.filter(
    s => ['plex', 'emby', 'jellyfin'].includes(s.server_type) && s.is_active !== false
  );

  if (monitored.length === 0) return null;

  return (
    <div className="px-4 sm:px-6 mt-6">
      <h2 className="flex items-center gap-1.5 font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
        <Server className="w-4 h-4" />
        Server Status
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {monitored.map(server => (
          <div
            key={server.id}
            className="flex items-center justify-between gap-2 p-3 rounded-lg bg-card border border-border"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {server.server_name || TYPE_LABELS[server.server_type]}
              </p>
              <p className={`text-[11px] font-semibold ${TYPE_COLORS[server.server_type]}`}>
                {TYPE_LABELS[server.server_type]}
              </p>
            </div>
            <ServerHealthBadge server={server} />
          </div>
        ))}
      </div>
    </div>
  );
}