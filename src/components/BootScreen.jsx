import React, { useState, useEffect } from 'react';

/**
 * Loading splash shown while auth/app settings resolve.
 * On TV/APK WebViews a stalled boot used to freeze on a bare logo with no
 * feedback. This shows progressive status text and, after a few seconds,
 * a manual escape button to the login page so the user is never stuck.
 */
export default function BootScreen() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">
        {seconds < 4 ? 'Loading…' : seconds < 8 ? 'Connecting…' : 'Still working — almost there'}
      </p>
      {seconds >= 6 && (
        <button
          onClick={() => { window.location.href = '/login'; }}
          className="mt-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Go to Sign In
        </button>
      )}
    </div>
  );
}