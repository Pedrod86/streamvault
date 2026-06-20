import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useReconnectRefetch } from '@/hooks/useReconnectRefetch';
import BootScreen from '@/components/BootScreen';

import Home from './pages/Home';
import Movies from './pages/Movies';
import Shows from './pages/Shows';
import MediaDetail from './pages/MediaDetail';
import WatchlistPage from './pages/WatchlistPage';
import SearchPage from './pages/SearchPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AppLayout from './components/layout/AppLayout';
import ConnectServer from './pages/ConnectServer';
import AddMedia from './pages/AddMedia';
import Settings from './pages/Settings';
import WatchHistory from './pages/WatchHistory';
import Discover from './pages/Discover';
import TVGuide from './pages/TVGuide';
import EmbyLibrary from './pages/EmbyLibrary';
import SyncStatus from './pages/SyncStatus';
import StreamTester from './pages/StreamTester';
import IPTV from './pages/IPTV';
import About from './pages/About';
import Contact from './pages/Contact';
import FourK from './pages/FourK';
import Audiobooks from './pages/Audiobooks';
import MetadataBrowser from './pages/MetadataBrowser';
import ServerDashboard from './pages/ServerDashboard';
import CategoryView from './pages/CategoryView';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Auto-refetch stale data when the network reconnects
  useReconnectRefetch();

  // Handle auth_required in an effect to avoid calling navigate during render
  React.useEffect(() => {
    if (authError?.type === 'auth_required') {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }, [authError]);

  // On auth/login pages, never block with a spinner — always let them render
  const isAuthRoute = ['/login', '/register', '/forgot-password', '/reset-password'].includes(window.location.pathname);

  if (!isAuthRoute && (isLoadingPublicSettings || isLoadingAuth)) {
    return <BootScreen />;
  }

  if (!isAuthRoute && authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return null; // handled by useEffect above
    }
  }

  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes with layout */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/shows" element={<Shows />} />
          <Route path="/media/:id" element={<MediaDetail />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/connect-server" element={<ConnectServer />} />
          <Route path="/ConnectServer" element={<ConnectServer />} />
          <Route path="/add-media" element={<AddMedia />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/history" element={<WatchHistory />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/tv-guide" element={<TVGuide />} />
          <Route path="/emby" element={<EmbyLibrary />} />
          <Route path="/sync-status" element={<SyncStatus />} />
          <Route path="/stream-tester" element={<StreamTester />} />
          <Route path="/iptv" element={<IPTV />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/4k" element={<FourK />} />
          <Route path="/audiobooks" element={<Audiobooks />} />
          <Route path="/browse" element={<MetadataBrowser />} />
          <Route path="/category" element={<CategoryView />} />
          <Route path="/server-dashboard" element={<ServerDashboard />} />
          <Route path="/ServerDashboard" element={<ServerDashboard />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster position="bottom-right" richColors />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App