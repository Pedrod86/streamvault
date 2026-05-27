import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import StreamVaultLogo from '@/components/StreamVaultLogo';
import { useTvDevice } from '@/hooks/useTvDevice';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isTV = useTvDevice();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      // Use navigate for TV WebView compatibility — avoids full page reload issues
      if (isTV) {
        navigate('/', { replace: true });
        // Also try hard reload as fallback after a short delay
        setTimeout(() => { window.location.href = '/'; }, 300);
      } else {
        window.location.href = '/';
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider('google', '/');
  };

  // On TV: clicking a field label focuses the input so D-pad select works
  const focusInput = (ref) => {
    ref.current?.focus();
    // Trigger native keyboard on Android TV WebView
    ref.current?.click();
  };

  // TV layout: only for actual TV devices, not regular Android phones/tablets
  const tvLayout = isTV;

  if (tvLayout) {
    return (
      <div
        className="bg-background"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto',
          zIndex: 9999,
        }}
      >
        <div style={{ width: '100%', maxWidth: 520, padding: '40px', margin: '0 auto' }}
          className="bg-card rounded-2xl border border-border shadow-2xl">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <StreamVaultLogo size="lg" />
            </div>
            <h1 className="font-heading font-bold text-3xl text-foreground mt-2">Sign In</h1>
            <p className="text-muted-foreground text-base mt-1">Use your remote to navigate</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            <div>
              <Label className="text-foreground text-base mb-2 block">Email</Label>
              <Input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary border-border h-14 text-lg px-4 focus:ring-2 focus:ring-primary tv-focusable"
                tabIndex={1}
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            <div>
              <Label className="text-foreground text-base mb-2 block">Password</Label>
              <Input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary border-border h-14 text-lg px-4 focus:ring-2 focus:ring-primary tv-focusable"
                tabIndex={2}
                autoComplete="current-password"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 bg-primary hover:bg-primary/90 rounded-xl font-bold text-lg tv-focusable mt-2"
              tabIndex={3}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <StreamVaultLogo size="lg" />
          </div>
          <h1 className="font-heading font-bold text-2xl text-foreground mt-2">Welcome back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <Label className="text-foreground text-sm">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 bg-secondary border-border h-11"
              autoComplete="email"
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
              autoComplete="current-password"
              required
            />
          </div>

          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 rounded-xl font-semibold" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">or</span></div>
        </div>

        <Button variant="outline" className="w-full h-11 border-border rounded-xl font-medium" onClick={handleGoogle}>
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:underline font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}