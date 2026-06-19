import React, { useState, useEffect } from 'react';
import { PlayCircle, Volume2, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';

const STORAGE_KEY = 'sv_player_prefs';

const defaults = {
  skipSeconds: '10',
  defaultVolume: '1',
  autoplay: 'true',
  fitMode: 'contain',
};

export function loadPlayerPrefs() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return defaults;
  }
}

export default function VideoAudioSection() {
  const [prefs, setPrefs] = useState(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(loadPlayerPrefs());
  }, []);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const set = (key, val) => setPrefs(p => ({ ...p, [key]: val }));

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 }}
      className="space-y-4 p-5 rounded-xl bg-card border border-border"
    >
      <div className="flex items-center gap-2 mb-1">
        <PlayCircle className="w-4 h-4 text-primary" />
        <h2 className="font-heading font-semibold text-foreground">Video & Audio</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">Configure default playback behaviour for the built-in player.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Skip interval */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Skip interval</Label>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{prefs.skipSeconds}s</span>
          </div>
          <Select value={prefs.skipSeconds} onValueChange={v => set('skipSeconds', v)}>
            <SelectTrigger className="mt-1 bg-secondary border-border h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {['5','10','15','30'].map(s => (
                <SelectItem key={s} value={s}>{s} seconds</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Default volume */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Default volume</Label>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{Math.round(parseFloat(prefs.defaultVolume) * 100)}%</span>
          </div>
          <Select value={prefs.defaultVolume} onValueChange={v => set('defaultVolume', v)}>
            <SelectTrigger className="mt-1 bg-secondary border-border h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {[['0.25','25%'],['0.5','50%'],['0.75','75%'],['1','100%']].map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Autoplay */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Autoplay</Label>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{prefs.autoplay === 'true' ? 'On' : 'Off'}</span>
          </div>
          <Select value={prefs.autoplay} onValueChange={v => set('autoplay', v)}>
            <SelectTrigger className="mt-1 bg-secondary border-border h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="true">Enabled</SelectItem>
              <SelectItem value="false">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fit mode */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Video fit</Label>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{prefs.fitMode}</span>
          </div>
          <Select value={prefs.fitMode} onValueChange={v => set('fitMode', v)}>
            <SelectTrigger className="mt-1 bg-secondary border-border h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="contain">Contain (letterbox)</SelectItem>
              <SelectItem value="cover">Cover (crop to fill)</SelectItem>
              <SelectItem value="fill">Stretch to fill</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        className="w-full h-10 rounded-xl font-semibold bg-primary hover:bg-primary/90 gap-2 mt-1"
        onClick={save}
      >
        {saved ? <><CheckCircle2 className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />Save Playback Settings</>}
      </Button>
    </motion.section>
  );
}