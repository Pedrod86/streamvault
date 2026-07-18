import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();

    // Hard failsafe: no matter what happens in checkAppState (a stalled fetch,
    // a WebView that never resolves, an unhandled edge case), force the loading
    // state off after 8s so the app can never stay frozen on the logo splash.
    const failsafe = setTimeout(() => {
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }, 11000);

    return () => clearTimeout(failsafe);
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      try {
        const headers = { 'X-App-Id': appParams.appId, 'Content-Type': 'application/json' };
        if (appParams.token) headers['Authorization'] = `Bearer ${appParams.token}`;

        // Resolve against the absolute app base URL — a relative `/api/...` URL
        // doesn't resolve correctly inside an Android TV / APK WebView, where it
        // would otherwise hang forever and trap the app on the logo splash.
        const base = (appParams.appBaseUrl || '').replace(/\/$/, '');
        const settingsUrl = `${base}/api/apps/public/prod/public-settings/by-id/${appParams.appId}`;

        // Hard timeout so a stalled request can never block boot past the splash.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        let resp;
        try {
          resp = await fetch(settingsUrl, { headers, signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          const err = new Error(errData?.message || 'Failed to load app');
          err.status = resp.status;
          err.data = errData;
          throw err;
        }
        const publicSettings = await resp.json();
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        const reason = appError.data?.extra_data?.reason || appError.data?.reason;
        if (appError.status === 403 && reason) {
          if (reason === 'auth_required') {
            setAuthError({ type: 'auth_required', message: 'Authentication required' });
          } else if (reason === 'user_not_registered') {
            setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
          } else {
            setAuthError({ type: reason, message: appError.message });
          }
        } else if (appError.status === 403) {
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        } else if (appError.status >= 400 && appError.status < 500) {
          // Only treat explicit HTTP client errors as unknown errors
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        // Network errors (no status) — silently continue, don't force logout
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      // Guard against a hanging me() call — on a slow/offline mobile connection
      // this could otherwise never resolve and trap the app on the splash.
      const currentUser = await Promise.race([
        base44.auth.me(),
        new Promise((_, reject) =>
          setTimeout(() => reject(Object.assign(new Error('auth timeout'), { isTimeout: true })), 5000)
        ),
      ]);
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setAuthChecked(true);

      // Only treat explicit auth errors as logout triggers — not network failures
      if (error.status === 401 || error.status === 403) {
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
      // For network errors or unknown errors, leave auth state unchanged (don't log out)
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use simple hash navigation to avoid WebView external redirect issues on TV
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};