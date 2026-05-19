import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Globe, User, Key, Loader2, Tv2, AlertTriangle, Info } from 'lucide-react';

export const XTREAM = {
  id: 'xtream',
  name: 'Xtream Codes',
  color: 'from-purple-500 to-indigo-600',
  bg: 'bg-purple-500/10 border-purple-500/30',
  text: 'text-purple-400',
  description: 'Connect your IPTV provider via Xtream Codes API',
};

/**
 * Tries to extract base URL + credentials from an M3U/Xtream playlist URL.
 * e.g. http://host:port/get.php?username=foo&password=bar
 *      http://host:port/player_api.php?username=foo&password=bar
 *      http://host:port/api/player_api.php?username=foo&password=bar  (with /api/ prefix)
 */
function parseXtreamUrl(raw) {
  try {
    const u = new URL(raw.includes('://') ? raw : 'http://' + raw);
    const username = u.searchParams.get('username') || '';
    const password = u.searchParams.get('password') || '';
    if (!username && !password) return null;

    // Detect /api/ prefix path (e.g. /api/player_api.php or /api/get.php)
    const apiPrefixMatch = u.pathname.match(/^(\/[^/]+)\/(player_api\.php|get\.php|xmltv\.php)/i);
    const base = apiPrefixMatch
      ? `${u.protocol}//${u.host}${apiPrefixMatch[1]}`
      : `${u.protocol}//${u.host}`;

    return { base, username, password };
  } catch {}
  return null;
}

export default function XtreamForm({ onBack, onSave, isSaving }) {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverName, setServerName] = useState('');
  const [error, setError] = useState('');
  const [corsWarning, setCorsWarning] = useState(false);

  // Auto-parse M3U/playlist URLs pasted into the URL field
  const handleUrlChange = (e) => {
    const val = e.target.value;
    setUrl(val);
    const parsed = parseXtreamUrl(val);
    if (parsed) {
      setUrl(parsed.base);
      if (parsed.username) setUsername(parsed.username);
      if (parsed.password) setPassword(parsed.password);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCorsWarning(false);

    // Normalize URL
    let base = url.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(base)) base = 'http://' + base;

    // Warn about HTTP servers (mixed content) but still try
    const isHttp = base.startsWith('http://');

    const testUrl = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    let res;
    try {
      res = await fetch(testUrl);
    } catch (err) {
      if (isHttp) {
        // Almost certainly a mixed-content / CORS block
        setCorsWarning(true);
        // Save anyway without verification — user can try
        onSave({
          server_url: base,
          username,
          password,
          server_name: serverName || 'My IPTV Provider',
          auth_method: 'credentials',
        });
        return;
      }
      setError('Cannot reach the server. Check the URL and ensure it is reachable from your device.');
      return;
    }

    let data;
    try {
      const text = await res.text();
      data = JSON.parse(text);
    } catch {
      // Non-JSON response — save anyway, might still work for streaming
      onSave({
        server_url: base,
        username,
        password,
        server_name: serverName || data?.server_info?.server_name || 'My IPTV Provider',
        auth_method: 'credentials',
      });
      return;
    }

    // Explicit auth failure: auth field is present AND equals 0
    const authField = data?.user_info?.auth;
    if (authField !== undefined && authField !== null && Number(authField) === 0) {
      setError('Authentication failed. Check your username and password.');
      return;
    }

    // Some providers return an HTTP error status with a JSON error body
    if (!res.ok && !data?.user_info) {
      setError(`Server responded with status ${res.status}. Check your credentials.`);
      return;
    }

    const detectedName = data?.server_info?.server_name || data?.user_info?.username || 'My IPTV Provider';

    onSave({
      server_url: base,
      username,
      password,
      server_name: serverName || detectedName,
      auth_method: 'credentials',
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Tv2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl text-foreground">Connect IPTV Provider</h1>
              <p className="text-muted-foreground text-xs">Xtream Codes API login</p>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 mb-5 space-y-1">
          <p className="font-semibold flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Tips</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-300/80">
            <li>You can paste your full M3U URL — credentials will be auto-filled</li>
            <li>Server URL format: <span className="font-mono">http://provider.com:8080</span></li>
            <li>Get your details from your IPTV provider</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-foreground text-sm flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Server URL or M3U Link
            </Label>
            <Input
              value={url}
              onChange={handleUrlChange}
              placeholder="http://provider.com:8080 or paste full M3U URL"
              className="mt-1 bg-secondary border-border h-11 font-mono text-sm"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">Paste your full playlist URL to auto-fill credentials</p>
          </div>

          <div>
            <Label className="text-foreground text-sm">Provider Name (optional)</Label>
            <Input
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="My IPTV Provider"
              className="mt-1 bg-secondary border-border h-11"
            />
          </div>

          <div>
            <Label className="text-foreground text-sm flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" /> Username
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 bg-secondary border-border h-11"
              required
            />
          </div>

          <div>
            <Label className="text-foreground text-sm flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-muted-foreground" /> Password
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 bg-secondary border-border h-11"
              required
            />
          </div>

          {corsWarning && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 leading-relaxed space-y-1">
              <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Saved — but connection test was blocked</p>
              <p>Your provider uses HTTP (not HTTPS), which browsers block when running inside a secure app. Your credentials have been saved. Library sync may be limited, but stream URLs will still work in a native player.</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive leading-relaxed">
              <p className="font-semibold mb-1">Connection failed</p>
              <p>{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 rounded-xl font-semibold bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0"
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect IPTV Provider'}
          </Button>
        </form>
      </div>
    </div>
  );
}