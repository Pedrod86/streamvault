import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { AnimatePresence, motion } from 'framer-motion';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-yellow-500/95 text-yellow-950 text-sm font-semibold py-2 px-4 shadow-lg backdrop-blur-sm"
          style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          You're offline — browsing your cached library
        </motion.div>
      )}
    </AnimatePresence>
  );
}