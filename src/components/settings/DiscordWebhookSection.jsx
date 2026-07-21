import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Save, CheckCircle2, Send, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DiscordWebhookSection() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState('idle'); // idle | sending | sent | error
  const loadedRef = useRef(false);

  const { data: settingsList = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });
  const settings = settingsList[0] || null;

  useEffect(() => {
    if (settings && !loadedRef.current) {
      setUrl(settings.discord_webhook_url || '');
      loadedRef.current = true;
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const patch = { discord_webhook_url: url.trim() };
      if (settings?.id) {
        await base44.entities.AppSettings.update(settings.id, patch);
      } else {
        await base44.entities.AppSettings.create(patch);
      }
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const sendTest = async () => {
    if (!url.trim()) return;
    setTestStatus('sending');
    try {
      const res = await fetch(url.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '✅ StreamVault test message',
            description: 'Your Discord webhook is working!',
            color: 0x5865F2,
            timestamp: new Date().toISOString(),
            footer: { text: 'StreamVault' },
          }],
        }),
      });
      setTestStatus(res.ok ? 'sent' : 'error');
    } catch (_) {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.11 }}
      className="space-y-4 p-5 rounded-xl bg-card border border-border"
    >
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="w-4 h-4 text-indigo-400" />
        <h2 className="font-heading font-semibold text-foreground">Discord Notifications</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Add a Discord webhook URL to receive alerts for new media, sync results, and watchlist episodes.
      </p>

      <div>
        <Label className="text-sm text-foreground">Webhook URL</Label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
          className="mt-1 bg-secondary border-border h-11"
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          In Discord: Server Settings → Integrations → Webhooks → Copy Webhook URL.
        </p>
      </div>

      {testStatus === 'sent' && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /><span>Test message sent — check your Discord channel.</span>
        </div>
      )}
      {testStatus === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>Couldn't send. Double-check the webhook URL.</span>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          className="flex-1 h-10 rounded-xl font-semibold bg-primary hover:bg-primary/90 gap-2"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saved ? <><CheckCircle2 className="w-4 h-4" />Saved!</> : <><Save className="w-4 h-4" />{saveMutation.isPending ? 'Saving…' : 'Save Webhook'}</>}
        </Button>
        <Button
          variant="outline"
          className="h-10 rounded-xl border-border gap-2"
          onClick={sendTest}
          disabled={!url.trim() || testStatus === 'sending'}
        >
          <Send className={`w-4 h-4 ${testStatus === 'sending' ? 'animate-pulse' : ''}`} />
          {testStatus === 'sending' ? 'Sending…' : 'Test'}
        </Button>
      </div>
    </motion.section>
  );
}