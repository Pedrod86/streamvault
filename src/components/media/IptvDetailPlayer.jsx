import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { base44 } from '@/api/base44Client';
import { X, Maximize } from 'lucide-react';

/**
 * Simple fullscreen player for IPTV VOD streams.
 * Fetches the m3u8 playlist through the backend proxy to avoid CORS,
 * then rewrites segment URLs through a custom hls.js loader.
 */
export default function IptvDetailPlayer({ url, title, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    async function start() {
      // For non-HLS (mp4 etc.) try direct first
      if (!url.includes('.m3u8')) {
        video.src = url;
        video.play().catch(() => {});
        return;
      }

      if (!Hls.isSupported()) {
        video.src = url;
        video.play().catch(() => {});
        return;
      }

      // Fetch playlist through proxy
      let playlistText = null;
      try {
        const res = await base44.functions.invoke('streamProxy', { url });
        playlistText = res?.data?.content;
      } catch (_) {}

      if (!playlistText) {
        video.src = url;
        video.play().catch(() => {});
        return;
      }

      // Rewrite segment URLs to go through streamProxy
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const rewritten = playlistText.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const absUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
        return `proxy::${absUrl}`;
      }).join('\n');

      // Custom loader that intercepts proxy:: segment requests
      const DefaultLoader = Hls.DefaultConfig.loader;
      class ProxyLoader extends DefaultLoader {
        load(context, config, callbacks) {
          if (context.url.startsWith('proxy::')) {
            const realUrl = context.url.slice(7);
            base44.functions.invoke('streamProxy', { url: realUrl }).then(res => {
              const content = res?.data?.content;
              if (content) {
                callbacks.onSuccess({ data: content, url: context.url }, { code: 200, text: '' }, context);
              } else {
                callbacks.onError({ code: 0, text: 'proxy error' }, context, null);
              }
            }).catch(() => callbacks.onError({ code: 0, text: 'proxy error' }, context, null));
          } else {
            super.load(context, config, callbacks);
          }
        }
      }

      const blob = new Blob([rewritten], { type: 'application/vnd.apple.mpegurl' });
      const blobUrl = URL.createObjectURL(blob);

      const hls = new Hls({ enableWorker: false, loader: ProxyLoader });
      hlsRef.current = hls;
      hls.loadSource(blobUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    }

    start();

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="text-white/80 hover:text-white p-1">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white/80 text-sm font-medium truncate max-w-[200px]">{title}</span>
        <button onClick={() => videoRef.current?.requestFullscreen?.()} className="text-white/70 hover:text-white p-1">
          <Maximize className="w-5 h-5" />
        </button>
      </div>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        controls
        playsInline
        webkit-playsinline="true"
      />
    </div>
  );
}