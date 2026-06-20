import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wifi } from 'lucide-react';

// Optional local-network URL input. When set, the app tries this address first
// while on the same network (fast, direct), falling back to the remote URL.
export default function LocalUrlField({ value, onChange }) {
  return (
    <div>
      <Label className="text-foreground text-sm flex items-center gap-1.5">
        <Wifi className="w-3.5 h-3.5 text-accent" /> Local Network URL (optional)
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="http://192.168.1.10:8096"
        className="mt-1 bg-secondary border-border h-11 font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Tried first when you're on the same Wi-Fi for faster, direct playback.
      </p>
    </div>
  );
}