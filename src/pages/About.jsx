import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tv, Library, Radio, Zap, Users, ShieldCheck, Download, Smartphone, RefreshCw, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { downloadApk } from '@/lib/appVersion';

function ApkDownloadSection() {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [release, setRelease] = useState(null);
  const [error, setError] = useState(null);

  const fetchRelease = async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await base44.functions.invoke('githubLatestRelease', {});
      if (res.data?.error) {
        setError(res.data.error);
        setStatus('error');
      } else {
        setRelease(res.data);
        setStatus('done');
      }
    } catch (e) {
      setError('Could not fetch release info. Try again later.');
      setStatus('error');
    }
  };

  useEffect(() => { fetchRelease(); }, []);

  return (
    <div className="mt-10 p-5 rounded-xl bg-card border border-primary/30 space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-semibold text-lg text-foreground">Download Android APK</h2>
        <button onClick={fetchRelease} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
          Checking GitHub for latest release…
        </div>
      )}

      {status === 'error' && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {status === 'done' && release && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">{release.tag}</span>
            {release.published_at && (
              <span className="text-xs text-muted-foreground">
                Released {new Date(release.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {release.body && (
            <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2 line-clamp-3 whitespace-pre-line">{release.body}</p>
          )}

          {release.apk ? (
            <button
              onClick={() => downloadApk(release.apk.download_url, release.apk.name)}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" />
              Download APK ({release.apk.size_mb} MB)
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">No APK found in the latest release.</p>
          )}

          {release.html_url && (
            <a
              href={release.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> View release on GitHub
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 pb-24">
      <h1 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mb-4">
        About StreamVault
      </h1>
      <p className="text-muted-foreground text-sm mb-10">
        Your personal media hub — built for cinephiles, cord-cutters, and power users.
      </p>

      <div className="space-y-8 text-foreground/90 leading-relaxed">
        <section>
          <h2 className="font-heading font-semibold text-lg text-foreground mb-2 flex items-center gap-2">
            <Library className="w-5 h-5 text-primary" /> What is StreamVault?
          </h2>
          <p>
            StreamVault is a personal media management platform that brings together all your streaming
            servers and content libraries in one beautiful, unified interface. Whether you run Emby,
            Jellyfin, Plex, or an IPTV/Xtream Codes server, StreamVault connects to them all and gives
            you a Netflix-style browsing experience — complete with watchlists, watch history, continue
            watching, and rich metadata sourced from IMDb and TheTVDB.
          </p>
        </section>

        <section>
          <h2 className="font-heading font-semibold text-lg text-foreground mb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Who is it for?
          </h2>
          <p>
            StreamVault is built for home media enthusiasts, self-hosting fans, and anyone who wants a
            polished front-end for their personal media collection. If you're tired of jumping between
            different apps to manage movies, TV shows, and live IPTV channels, StreamVault was designed
            exactly for you. It works great on desktop browsers, mobile devices, and Android TV — so your
            library travels with you on every screen in your home.
          </p>
        </section>

        <section>
          <h2 className="font-heading font-semibold text-lg text-foreground mb-2 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Key Features
          </h2>
          <ul className="space-y-1.5 list-disc list-inside text-foreground/80">
            <li>Connect Emby, Jellyfin, Plex, and Xtream IPTV servers</li>
            <li>Automatic library sync with background metadata enrichment</li>
            <li>Live TV browsing with HLS playback built in</li>
            <li>Watchlist, watch history, and continue watching across devices</li>
            <li>Discord notifications when library syncs complete</li>
            <li>Android TV and D-pad friendly navigation</li>
            <li>Customisable accent colours and dark-first design</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading font-semibold text-lg text-foreground mb-2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Built with privacy in mind
          </h2>
          <p>
            Your media server credentials are stored privately under your own account and are never shared
            with third parties. StreamVault communicates directly with your servers and only fetches
            metadata from trusted public sources like IMDb and TheTVDB. We don't sell data and we don't
            track what you watch.
          </p>
        </section>
      </div>

      {/* ── Android APK Download ── */}
      <ApkDownloadSection />

      <div className="mt-12 border-t border-border pt-8 flex flex-wrap gap-4">
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Contact Us
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}