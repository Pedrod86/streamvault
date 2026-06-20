import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import StreamVaultLogo from '@/components/StreamVaultLogo';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await base44.auth.verifyOtp({ email, otpCode: otp });
      base44.auth.setToken(res.access_token);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider('google', '/');
  };

  const handleApple = () => {
    base44.auth.loginWithProvider('apple', '/');
  };

  const handleFacebook = () => {
    base44.auth.loginWithProvider('facebook', '/');
  };

  const handleMicrosoft = () => {
    base44.auth.loginWithProvider('microsoft', '/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <StreamVaultLogo size="lg" />
          </div>
          <h1 className="font-heading font-bold text-2xl text-foreground mt-2">
            {showOtp ? 'Verify Email' : 'Create Account'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {showOtp ? `Enter the code sent to ${email}` : 'Join StreamVault'}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        {showOtp ? (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map(i => (
                    <InputOTPSlot key={i} index={i} className="bg-secondary border-border text-foreground" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 rounded-xl font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
            </Button>
            <Button type="button" variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => base44.auth.resendOtp(email)}>
              Resend Code
            </Button>
          </form>
        ) : (
          <>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label className="text-foreground text-sm">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-secondary border-border h-11" required />
              </div>
              <div>
                <Label className="text-foreground text-sm">Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 bg-secondary border-border h-11" required />
              </div>
              <div>
                <Label className="text-foreground text-sm">Confirm Password</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 bg-secondary border-border h-11" required />
              </div>
              <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 rounded-xl font-semibold" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
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

            <Button variant="outline" className="w-full h-11 border-border rounded-xl font-medium mt-3" onClick={handleApple}>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.41.86 1.26 1.89 2.67 3.24 2.62 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.72-1.04-2.75-4.13M14.54 4.4c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.76-1.24 1.99-1.08 3.16 1.15.09 2.32-.58 3.03-1.43"/></svg>
              Continue with Apple
            </Button>

            <Button variant="outline" className="w-full h-11 border-border rounded-xl font-medium mt-3" onClick={handleFacebook}>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07"/></svg>
              Continue with Facebook
            </Button>

            <Button variant="outline" className="w-full h-11 border-border rounded-xl font-medium mt-3" onClick={handleMicrosoft}>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>
              Continue with Microsoft
            </Button>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}