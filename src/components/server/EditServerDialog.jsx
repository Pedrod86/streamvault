import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

// Which fields to show per server type
const FIELDS_BY_TYPE = {
  trakt: [
    { key: 'server_name', label: 'Display Name', placeholder: 'My Trakt' },
    { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client Secret', secret: true },
    { key: 'api_token', label: 'Access Token', secret: true },
  ],
  plex: [
    { key: 'server_name', label: 'Display Name', placeholder: 'My Plex' },
    { key: 'server_url', label: 'Remote / Relay URL', placeholder: 'https://my-plex.example.com' },
    { key: 'local_url', label: 'Local Network URL (optional)', placeholder: 'http://192.168.1.10:32400' },
    { key: 'plex_token', label: 'Plex Token', secret: true },
  ],
  xtream: [
    { key: 'server_name', label: 'Display Name', placeholder: 'My Xtream' },
    { key: 'server_url', label: 'Server URL', placeholder: 'http://host:port' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', secret: true },
  ],
  _default: [
    { key: 'server_name', label: 'Display Name', placeholder: 'My Server' },
    { key: 'server_url', label: 'Remote / Relay URL', placeholder: 'https://my-server.example.com' },
    { key: 'local_url', label: 'Local Network URL (optional)', placeholder: 'http://192.168.1.10:8096' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', secret: true },
    { key: 'api_token', label: 'API Token', secret: true },
  ],
};

export default function EditServerDialog({ server, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const fields = FIELDS_BY_TYPE[server.server_type] || FIELDS_BY_TYPE._default;

  const [form, setForm] = useState(() => {
    const init = {};
    fields.forEach(f => { init[f.key] = server[f.key] || ''; });
    return init;
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.MediaServer.update(server.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediaServers'] });
      onOpenChange(false);
    },
  });

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading capitalize">Edit {server.server_type} Server</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          {fields.map(({ key, label, placeholder, secret }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key} className="text-xs text-muted-foreground">{label}</Label>
              <Input
                id={key}
                type={secret ? 'password' : 'text'}
                value={form[key]}
                placeholder={placeholder}
                onChange={(e) => handleChange(key, e.target.value)}
                className="bg-input border-border"
              />
            </div>
          ))}
        </div>

        {saveMutation.isError && (
          <p className="text-xs text-destructive">Failed to save. Please try again.</p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 gap-2"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}