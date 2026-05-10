import React, { useRef, useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 72;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      // Only activate if already scrolled to top
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY.current === null || refreshing) return;
      if (window.scrollY > 0) { startY.current = null; return; }
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        e.preventDefault();
        setPullY(Math.min(delta * 0.45, THRESHOLD + 20));
      }
    };

    const onTouchEnd = async () => {
      if (pullY >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPullY(THRESHOLD);
        try { await onRefresh(); } catch {}
        setRefreshing(false);
      }
      setPullY(0);
      startY.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullY, refreshing, onRefresh]);

  const progress = Math.min(pullY / THRESHOLD, 1);
  const triggered = pullY >= THRESHOLD;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200 ease-out"
        style={{ height: pullY > 0 || refreshing ? (refreshing ? THRESHOLD : pullY) : 0 }}
      >
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
            triggered || refreshing ? 'border-primary bg-primary/10 text-primary' : 'border-muted-foreground/40 text-muted-foreground'
          }`}
          style={{ transform: `scale(${0.5 + progress * 0.5})`, opacity: Math.max(0.2, progress) }}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${progress * 360}deg)` }} />
        </div>
      </div>
      {children}
    </div>
  );
}