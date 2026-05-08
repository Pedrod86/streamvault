import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Server, Key, User, Globe, CheckCircle2, ExternalLink, Plus, Trash2, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';

const SERVERS = [
  {
    id: 'plex',
    name: 'Plex',
    color: 'from-yellow-500 to-orange-500',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    text: 'text-yellow-400',
    logo: '🟡',
    description: 'Connect your Plex Media Server',
    tokenUrl: 'https://www.plex.tv/claim/',
    tokenLabel: 'Plex Token',
    tokenHelp: 'Find your token at plex.tv/claim or in Plex Web → Settings → Account',
  },
  {
    id: 'emby',
    name: 'Emby',
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-500/10 border-green-500/30',
    text: 'text-green-400',
    logo: '🟢',
    description: 'Connect your Emby Media Server',
    tokenUrl: 'https://emby.media/community/index.php?/topic/30935-how-to-obtain-an-api-key/',
    tokenLabel: 'API Key',
    tokenHelp: 'Generate an API key in Emby Dashboard → Advanced → API Keys',
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    color: 'from-blue-500 to-violet-600',
    bg: 'bg-blue-500/10 border-blue-500/30',
    text: 'text-blue-400',
    logo: '🔵',
    description: 'Connect your Jellyfin Media Server',
    tokenUrl: 'https://jellyfin.org/docs/general/server/api/',
    tokenLabel: 'API Key',
    tokenHelp: 'Generate an API key in Jellyfin Dashboard → Administration → API Keys',
  },
];

export default function ConnectServer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedServer, setSelectedServer] = useState(null);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: connectedServers = [] } = useQuery({
    queryKey: ['mediaServers'],
    queryFn: () => base44.entities.MediaServer.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.MediaServer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediaServers'] });
      setSaved(true);
      setTimeout(() => { setSaved(false); setAdding(false); setSelectedServer(null); }, 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MediaServer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mediaServers'] }),
  });

  if (saved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
          <h2 className="font-heading font-bold text-2xl text-foreground">Server Connected!</h2>
          <p className="text-muted-foreground">Returning to your servers...</p>
        </motion.div>
      </div>
    );
  }

  if (adding && selectedServer) {
    return (
      <ServerForm
        server={SERVERS.find(s => s.id === selectedServer)}
        onBack={() => setSelectedServer(null)}
        onSave={(data) => saveMutation.mutate({ ...data, server_type: selectedServer })}
        isSaving={saveMutation.isPending}
      />
    );
  }

  if (adding && !selectedServer) {
    return <ServerPicker onSelect={setSelectedServer} onBack={() => setAdding(false)} />;
  }

  // Main servers list view
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">Media Servers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your Plex, Emby & Jellyfin connections</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 rounded-xl gap-2"
          onClick={() => setAdding(true)}
        >
          <Plus className="w-4 h-4" /> Add Server
        </Button>
      </div>

      {connectedServers.length === 0 ? (
        <div className="text-center py-20">
          <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-semibold text-lg mb-1">No servers connected</p>
          <p className="text-muted-foreground text-sm mb-6">Add your Plex, Emby, or Jellyfin server to get started</p>
          <Button className="bg-primary hover:bg-primary/90 rounded-xl gap-2" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4" /> Connect a Server
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {connectedServers.map((srv) => {
            const meta = SERVERS.find(s => s.id === srv.server_type) || SERVERS[0];
            return (
              <motion.div
                key={srv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-4 p-4 rounded-xl border ${meta.bg}`}
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shadow-md shrink-0`}>
                  <Server className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-heading font-semibold ${meta.text}`}>{srv.server_name || `${meta.name} Server`}</p>
                  <p className="text-muted-foreground text-xs truncate">{srv.server_url || 'No URL set'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <Wifi className="w-3 h-3" /> Connected
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground capitalize">{srv.auth_method === 'token' ? 'API Token' : 'Credentials'}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => deleteMutation.mutate(srv.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </motion.div>
            );
          })}

          <div className="pt-4">
            <p className="text-xs text-muted-foreground text-center">
              Note: This app stores your server credentials. StreamVault does not currently proxy media — use your server's native app for playback.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ServerPicker({ onSelect, onBack }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground">Connect a Server</h1>
            <p className="text-muted-foreground text-sm">Choose your media server platform</p>
          </div>
        </div>

        <div className="space-y-4">
          {SERVERS.map((server) => (
            <motion.button
              key={server.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(server.id)}
              className={`w-full flex items-center gap-4 p-5 rounded-xl border ${server.bg} hover:bg-opacity-20 transition-all text-left`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${server.color} flex items-center justify-center text-2xl shadow-lg`}>
                <Server className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className={`font-heading font-bold text-lg ${server.text}`}>{server.name}</p>
                <p className="text-muted-foreground text-sm">{server.description}</p>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
            </motion.button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Your credentials are stored securely and only used to connect to your server.
        </p>
      </div>
    </div>
  );
}

function ServerForm({ server, onBack, onSave, isSaving }) {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [serverName, setServerName] = useState('');

  const handleCredentials = (e) => {
    e.preventDefault();
    onSave({
      server_url: url,
      username,
      server_name: serverName || `${server.name} Server`,
      auth_method: 'credentials',
    });
  };

  const handleToken = (e) => {
    e.preventDefault();
    onSave({
      server_url: url,
      api_token: server.id === 'plex' ? undefined : token,
      plex_token: server.id === 'plex' ? token : undefined,
      server_name: serverName || `${server.name} Server`,
      auth_method: 'token',
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${server.color} flex items-center justify-center shadow-lg`}>
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl text-foreground">Connect to {server.name}</h1>
              <p className="text-muted-foreground text-xs">Choose your login method</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="credentials">
          <TabsList className="w-full bg-secondary mb-6">
            <TabsTrigger value="credentials" className="flex-1 gap-2 data-[state=active]:bg-card">
              <User className="w-3.5 h-3.5" /> Username & Password
            </TabsTrigger>
            <TabsTrigger value="token" className="flex-1 gap-2 data-[state=active]:bg-card">
              <Key className="w-3.5 h-3.5" /> {server.id === 'plex' ? 'Plex Token' : 'API Key'}
            </TabsTrigger>
          </TabsList>

          {/* Credentials Tab */}
          <TabsContent value="credentials">
            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <Label className="text-foreground text-sm flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Server URL
                </Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={server.id === 'plex' ? 'http://localhost:32400' : 'http://192.168.1.10:8096'}
                  className="mt-1 bg-secondary border-border h-11 font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">Include port number if not on standard ports</p>
              </div>
              <div>
                <Label className="text-foreground text-sm">Server Name (optional)</Label>
                <Input
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder={`My ${server.name} Server`}
                  className="mt-1 bg-secondary border-border h-11"
                />
              </div>
              <div>
                <Label className="text-foreground text-sm">Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 bg-secondary border-border h-11"
                  required
                />
              </div>
              <div>
                <Label className="text-foreground text-sm">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 bg-secondary border-border h-11"
                  required
                />
              </div>
              <Button type="submit" className={`w-full h-11 rounded-xl font-semibold bg-gradient-to-r ${server.color} text-white border-0`} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Connect to ${server.name}`}
              </Button>
            </form>
          </TabsContent>

          {/* Token Tab */}
          <TabsContent value="token">
            <form onSubmit={handleToken} className="space-y-4">
              <div>
                <Label className="text-foreground text-sm flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Server URL
                </Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={server.id === 'plex' ? 'http://localhost:32400' : 'http://192.168.1.10:8096'}
                  className="mt-1 bg-secondary border-border h-11 font-mono text-sm"
                  required
                />
              </div>
              <div>
                <Label className="text-foreground text-sm">Server Name (optional)</Label>
                <Input
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder={`My ${server.name} Server`}
                  className="mt-1 bg-secondary border-border h-11"
                />
              </div>
              <div>
                <Label className="text-foreground text-sm flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-muted-foreground" /> {server.tokenLabel}
                </Label>
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your token here..."
                  className="mt-1 bg-secondary border-border h-11 font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">{server.tokenHelp}</p>
                <a
                  href={server.tokenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-xs mt-1 ${server.text} hover:underline`}
                >
                  <ExternalLink className="w-3 h-3" /> How to get your {server.tokenLabel}
                </a>
              </div>
              <Button type="submit" className={`w-full h-11 rounded-xl font-semibold bg-gradient-to-r ${server.color} text-white border-0`} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Connect to ${server.name}`}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}