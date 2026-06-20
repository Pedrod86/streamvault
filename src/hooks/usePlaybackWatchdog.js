import { useEffect, useRef } from 'react';

// Watches a <video> element and its HLS instance for frozen playback and network
// changes, recovering automatically. This is the main defence against the
// "stuck buffering forever" problem on flaky relay/mobile connections.
//
// - If playback is meant to be running but currentTime hasn't advanced for a few
//   seconds, it nudges the playhead and asks HLS to resume loading.
// - On browser 'online' / connection-change events, it kicks the loader so the
//   stream reconnects cleanly instead of sitting dead after the network returns.
export function usePlaybackWatchdog({ videoRef, hlsRef, playing, onBuffering }) {
  const lastTime = useRef(0);
  const stalledFor = useRef(0);

  // Frozen-playback watchdog — checks every 2s
  useEffect(() => {
    if (!playing) { stalledFor.current = 0; return; }

    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || v.ended) { stalledFor.current = 0; return; }

      const t = v.currentTime;
      if (Math.abs(t - lastTime.current) < 0.1) {
        // Time hasn't moved — we're stalled
        stalledFor.current += 2;
        onBuffering?.(true);

        if (stalledFor.current >= 4) {
          // Nudge: re-trigger the loader and bump the playhead slightly past a gap
          const hls = hlsRef.current;
          try { hls?.startLoad(); } catch (_) {}
          try {
            // If there's buffered data just ahead, jump into it to clear a hole
            for (let i = 0; i < v.buffered.length; i++) {
              if (v.buffered.start(i) > t && v.buffered.start(i) - t < 3) {
                v.currentTime = v.buffered.start(i) + 0.1;
                break;
              }
            }
            v.play?.().catch(() => {});
          } catch (_) {}
          stalledFor.current = 0;
        }
      } else {
        stalledFor.current = 0;
        onBuffering?.(false);
      }
      lastTime.current = t;
    }, 2000);

    return () => clearInterval(id);
  }, [playing, videoRef, hlsRef, onBuffering]);

  // Network-recovery — resume the stream when connectivity returns
  useEffect(() => {
    const resume = () => {
      const hls = hlsRef.current;
      const v = videoRef.current;
      try { hls?.startLoad(); } catch (_) {}
      try { if (v && !v.paused) v.play?.().catch(() => {}); } catch (_) {}
    };
    window.addEventListener('online', resume);
    const conn = navigator.connection;
    conn?.addEventListener?.('change', resume);
    return () => {
      window.removeEventListener('online', resume);
      conn?.removeEventListener?.('change', resume);
    };
  }, [videoRef, hlsRef]);
}