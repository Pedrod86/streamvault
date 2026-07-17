import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { KeyRound, Eye, EyeOff, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_SERVICES = [
  {
    id: 'opensubtitles',
    label: 'OpenSubtitles',
    description: 'Fetch subtitles for movies & TV shows.',
    settingsKey: 'api_key_opensubtitles',
    placeholder: 'Enter your OpenSubtitles API key',
    docsUrl: 'https://www.opensubtitles.com/en/consumers',
  },
  {
    id: 'tmdb',
    label: 'TMDB (The Movie Database)',
    description: 'Posters, backdrops, cast, and metadata.',
    settingsKey: 'api_key_tmdb',
    placeholder: 'Enter your TMDB API key',
    docsUrl: 'https://developer.themoviedb.org/docs/getting-started',
  },
  {
    id: 'tvdb',
    label: 'TVDB',
    description: 'TV show metadata and episode info.',
    settingsKey: 'api_key_tvdb',
    placeholder: 'Enter your TVDB API key',
    docsUrl: 'https://thetvdb.com/api-information',
  },
  {
    id: 'omdb',
    label: 'OMDb (Open Movie Database)',
    description: 'Movie ratings, plot, and IMDb data.',
    settingsKey: 'api_key_omdb',
    placeholder: 'Enter your OMDb API key',
    docsUrl: 'https://www.omdbapi.com/apikey.aspx',
  },
  {
    id: 'trakt',
    label: 'Trakt',
    description: 'Track what you watch, get recommendations.',
    settingsKey: 'api_key_trakt',
    placeholder: 'Enter your Trakt client ID',
    docsUrl: 'https://trakt.tv/oauth/applications',
  },
];

function ApiKeyRow({ service, currentValue, onSave }) {
  const [value, setValue] = useState(currentValue || '');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(currentValue || '');
  }, [currentValue]);

  const handleSave = async () => {
    await onSave(service.settingsKey, value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-2 p-3 rounded-xl bg-secondary/40 border border-border">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{service.label}</span>
            {currentValue && !saved && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
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
  const queryClient = useQueryClient();

  const { data: settingsList = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
    staleTime: 60 * 1000,
  });

  const settings = settingsList[0] || null;

  const handleSave = async (key, value) => {
    if (settings?.id) {
      await base44.entities.AppSettings.update(settings.id, { [key]: value });
    } else {
      await base44.entities.AppSettings.create({ [key]: value });
    }
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

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
        API keys are saved to your account and sync across all your devices.
      </p>

      <div className="space-y-3">
        {API_SERVICES.map(service => (
          <ApiKeyRow
            key={service.id}
            service={service}
            currentValue={settings?.[service.settingsKey] || ''}
            onSave={handleSave}
          />
        ))}
      </div>
    </motion.section>
  );
}