import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Eye, EyeOff, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_SERVICES = [
  {
    id: 'opensubtitles',
    label: 'OpenSubtitles',
    description: 'Fetch subtitles for movies & TV shows.',
    storageKey: 'api_key_opensubtitles',
    placeholder: 'Enter your OpenSubtitles API key',
    docsUrl: 'https://www.opensubtitles.com/en/consumers',
  },
  {
    id: 'tmdb',
    label: 'TMDB (The Movie Database)',
    description: 'Posters, backdrops, cast, and metadata.',
    storageKey: 'api_key_tmdb',
    placeholder: 'Enter your TMDB API key',
    docsUrl: 'https://developer.themoviedb.org/docs/getting-started',
  },
  {
    id: 'tvdb',
    label: 'TVDB',
    description: 'TV show metadata and episode info.',
    storageKey: 'api_key_tvdb',
    placeholder: 'Enter your TVDB API key',
    docsUrl: 'https://thetvdb.com/api-information',
  },
  {
    id: 'omdb',
    label: 'OMDb (Open Movie Database)',
    description: 'Movie ratings, plot, and IMDb data.',
    storageKey: 'api_key_omdb',
    placeholder: 'Enter your OMDb API key',
    docsUrl: 'https://www.omdbapi.com/apikey.aspx',
  },
  {
    id: 'trakt',
    label: 'Trakt',
    description: 'Track what you watch, get recommendations.',
    storageKey: 'api_key_trakt',
    placeholder: 'Enter your Trakt client ID',
    docsUrl: 'https://trakt.tv/oauth/applications',
  },
  {
    id: 'fanart',
    label: 'Fanart.tv',
    description: 'High-quality fan art and artwork for media.',
    storageKey: 'api_key_fanart',
    placeholder: 'Enter your Fanart.tv API key',
    docsUrl: 'https://fanart.tv/get-an-api-key/',
  },
];

function ApiKeyRow({ service }) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(service.storageKey) || '';
    setValue(stored);
  }, [service.storageKey]);

  const handleSave = () => {
    localStorage.setItem(service.storageKey, value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasSaved = !!localStorage.getItem(service.storageKey);

  return (
    <div className="space-y-2 p-3 rounded-xl bg-secondary/40 border border-border">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{service.label}</span>
            {hasSaved && !saved && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
          </div>
          <p className="text-[11px] text-muted-foreground">{service.description}</p>
        </div>
        <a
          href={service.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
          title="Get API key"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={service.placeholder}
            className="bg-background border-border h-9 text-sm pr-9"
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
          onClick={handleSave}
        >
          {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : 'Save'}
        </Button>
      </div>
    </div>
  );
}

export default function ApiKeysSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.13 }}
      className="space-y-4 p-5 rounded-xl bg-card border border-border"
    >
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="w-4 h-4 text-primary" />
        <h2 className="font-heading font-semibold text-foreground">API Keys</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Store your personal API keys for third-party services. Keys are saved locally on this device.
      </p>

      <div className="space-y-3">
        {API_SERVICES.map(service => (
          <ApiKeyRow key={service.id} service={service} />
        ))}
      </div>
    </motion.section>
  );
}