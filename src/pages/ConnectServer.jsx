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
import SyncServerButton from '@/components/server/SyncServerButton';

const SERVERS = [
  {
    id: 'plex',
    name: 'Plex',
    color: 'from-yellow-500 to-orange-500',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    text: 'text-yellow-400',
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
    description: 'Connect your Jellyfin Media Server',
    tokenUrl: 'https://jellyfin.org/docs/general/server/api/',
    tokenLabel: 'API Key',
    tokenHelp: 'Generate an API key in Jellyfin Dashboard → Administration → API Keys',
  },
];

const TRAKT = {
  id: 'trakt',
  name: 'Trakt',
  color: 'from-red-500 to-rose-600',
  bg: 'bg-red-500/10 border-red-500/30',
  text: 'text-red-400',
  description: 'Sync watch history, ratings & lists',
};

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
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['mediaServers'] });
      setSaved(true);
      // Auto-sync library for media servers (not Trakt)
      if (created.server_type !== 'trakt') {
        import('@/lib/serverSync').then(({ fetchServerLibrary }) => {
          fetchServerLibrary(created).then(async (items) => {
            if (!items.length) return;
            const BATCH = 50;
            for (let i = 0; i < items.length; i += BATCH) {
              await base44.entities.Media.bulkCreate(items.slice(i, i + BATCH));
            }
            queryClient.invalidateQueries({ queryKey: ['media'] });
          }).catch(() => {/* silent — user can manually sync later */});
        });
      }
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

  if (adding && selectedServer === 'trakt') {
    return (
      <TraktForm
        onBack={() => setSelectedServer(null)}
        onSave={(data) => saveMutation.mutate({ ...data, server_type: 'trakt' })}
        isSaving={saveMutation.isPending}
      />
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

  const mediaServers = connectedServers.filter(s => s.server_type !== 'trakt');
  const traktConnections = connectedServers.filter(s => s.server_type === 'trakt');

  // Main servers list view
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Media Servers Section */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">Connections</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage Plex, Emby, Jellyfin & Trakt connections</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 rounded-xl gap-2" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4" /> Add Server
        </Button>
      </div>

      {/* Media Servers */}
      <div className="mb-8">
        <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Media Servers</h2>
        {mediaServers.length === 0 ? (
          <div className="flex items-center gap-4 p-5 rounded-xl border border-dashed border-border text-muted-foreground">
            <Server className="w-8 h-8 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">No media servers</p>
              <p className="text-xs mt-0.5">Connect Plex, Emby or Jellyfin</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto border-border rounded-lg gap-1.5" onClick={() => setAdding(true)}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {mediaServers.map((srv) => <ServerCard key={srv.id} srv={srv} allMeta={[...SERVERS, TRAKT]} onDelete={() => deleteMutation.mutate(srv.id)} deleting={deleteMutation.isPending} />)}
          </div>
        )}
      </div>

      {/* Trakt Section */}
      <div>
        <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Tracking Services</h2>
        {traktConnections.length === 0 ? (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => { setSelectedServer('trakt'); setAdding(true); }}
            className={`w-full flex items-center gap-4 p-5 rounded-xl border ${TRAKT.bg} text-left`}
          >
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${TRAKT.color} flex items-center justify-center shadow-md shrink-0`}>
              <ActivityIcon />
            </div>
            <div className="flex-1">
              <p className={`font-heading font-bold ${TRAKT.text}`}>Trakt</p>
              <p className="text-muted-foreground text-sm">{TRAKT.description}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 bg-secondary">
              <Plus className="w-3 h-3" /> Connect
            </div>
          </motion.button>
        ) : (
          <div className="space-y-3">
            {traktConnections.map((srv) => <ServerCard key={srv.id} srv={srv} allMeta={[...SERVERS, TRAKT]} onDelete={() => deleteMutation.mutate(srv.id)} deleting={deleteMutation.isPending} />)}
            <Button variant="outline" size="sm" className="border-border rounded-lg gap-1.5 text-muted-foreground" onClick={() => { setSelectedServer('trakt'); setAdding(true); }}>
              <Plus className="w-3.5 h-3.5" /> Add Another Trakt Account
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ServerCard({ srv, allMeta, onDelete, deleting }) {
  const meta = allMeta.find(s => s.id === srv.server_type) || allMeta[0];
  const isTrakt = srv.server_type === 'trakt';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-4 p-4 rounded-xl border ${meta.bg}`}
    >
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shadow-md shrink-0`}>
        {isTrakt ? <ActivityIcon /> : <Server className="w-5 h-5 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-heading font-semibold ${meta.text}`}>{srv.server_name || `${meta.name}`}</p>
        <p className="text-muted-foreground text-xs truncate">{srv.server_url || (isTrakt ? 'trakt.tv' : 'No URL set')}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Wifi className="w-3 h-3" /> Connected
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground capitalize">
            {srv.auth_method === 'oauth_pin' ? 'OAuth PIN' : srv.auth_method === 'api_key' ? 'API Key' : srv.auth_method === 'token' ? 'API Token' : 'Credentials'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isTrakt && <SyncServerButton server={srv} />}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete} disabled={deleting}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function ServerPicker({ onSelect, onBack }) {
  const allOptions = [...SERVERS, TRAKT];
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground">Add Connection</h1>
            <p className="text-muted-foreground text-sm">Choose a platform to connect</p>
          </div>
        </div>

        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Media Servers</p>
        <div className="space-y-3 mb-6">
          {SERVERS.map((server) => (
            <motion.button key={server.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => onSelect(server.id)}
              className={`w-full flex items-center gap-4 p-5 rounded-xl border ${server.bg} transition-all text-left`}
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${server.color} flex items-center justify-center shadow-lg`}>
                <Server className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className={`font-heading font-bold ${server.text}`}>{server.name}</p>
                <p className="text-muted-foreground text-sm">{server.description}</p>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
            </motion.button>
          ))}
        </div>

        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Tracking Services</p>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => onSelect('trakt')}
          className={`w-full flex items-center gap-4 p-5 rounded-xl border ${TRAKT.bg} transition-all text-left`}
        >
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${TRAKT.color} flex items-center justify-center shadow-lg`}>
            <ActivityIcon />
          </div>
          <div className="flex-1">
            <p className={`font-heading font-bold ${TRAKT.text}`}>{TRAKT.name}</p>
            <p className="text-muted-foreground text-sm">{TRAKT.description}</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
        </motion.button>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Your credentials are stored securely.
        </p>
      </div>
    </div>
  );
}

function TraktForm({ onBack, onSave, isSaving }) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [accountName, setAccountName] = useState('');

  const handleApiKey = (e) => {
    e.preventDefault();
    onSave({
      client_id: clientId,
      client_secret: clientSecret,
      server_name: accountName || 'My Trakt Account',
      auth_method: 'api_key',
    });
  };

  const handleOAuthPin = (e) => {
    e.preventDefault();
    onSave({
      api_token: accessToken,
      server_name: accountName || 'My Trakt Account',
      auth_method: 'oauth_pin',
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
              <ActivityIcon />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl text-foreground">Connect to Trakt</h1>
              <p className="text-muted-foreground text-xs">Sync your watch history & ratings</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="apikey">
          <TabsList className="w-full bg-secondary mb-6">
            <TabsTrigger value="apikey" className="flex-1 gap-2 data-[state=active]:bg-card">
              <Key className="w-3.5 h-3.5" /> API Keys
            </TabsTrigger>
            <TabsTrigger value="oauth" className="flex-1 gap-2 data-[state=active]:bg-card">
              <User className="w-3.5 h-3.5" /> OAuth Token
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="apikey">
            <form onSubmit={handleApiKey} className="space-y-4">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 space-y-1">
                <p className="font-semibold">How to get your API keys:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-red-300/80">
                  <li>Go to <a href="https://trakt.tv/oauth/applications" target="_blank" rel="noopener noreferrer" className="underline">trakt.tv/oauth/applications</a></li>
                  <li>Click "New Application"</li>
                  <li>Copy your Client ID & Secret</li>
                </ol>
              </div>
              <div>
                <Label className="text-foreground text-sm">Account Name (optional)</Label>
                <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="My Trakt Account" className="mt-1 bg-secondary border-border h-11" />
              </div>
              <div>
                <Label className="text-foreground text-sm flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-muted-foreground" /> Client ID
                </Label>
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Your Trakt Client ID" className="mt-1 bg-secondary border-border h-11 font-mono text-sm" required />
              </div>
              <div>
                <Label className="text-foreground text-sm flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-muted-foreground" /> Client Secret
                </Label>
                <Input value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Your Trakt Client Secret" className="mt-1 bg-secondary border-border h-11 font-mono text-sm" required />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-rose-600 text-white border-0" disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Trakt'}
              </Button>
            </form>
          </TabsContent>

          {/* OAuth Token Tab */}
          <TabsContent value="oauth">
            <form onSubmit={handleOAuthPin} className="space-y-4">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 space-y-1">
                <p className="font-semibold">How to get an OAuth access token:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-red-300/80">
                  <li>Visit <a href="https://trakt.tv/oauth/authorize" target="_blank" rel="noopener noreferrer" className="underline">trakt.tv/oauth/authorize</a></li>
                  <li>Authorize your app and copy the access token</li>
                  <li>Paste it below</li>
                </ol>
                <a href="https://trakt.docs.apiary.io/#reference/authentication-oauth" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline mt-1">
                  <ExternalLink className="w-3 h-3" /> Trakt OAuth docs
                </a>
              </div>
              <div>
                <Label className="text-foreground text-sm">Account Name (optional)</Label>
                <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="My Trakt Account" className="mt-1 bg-secondary border-border h-11" />
              </div>
              <div>
                <Label className="text-foreground text-sm flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-muted-foreground" /> Access Token
                </Label>
                <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Paste your OAuth access token..." className="mt-1 bg-secondary border-border h-11 font-mono text-sm" required />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-rose-600 text-white border-0" disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Trakt'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
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