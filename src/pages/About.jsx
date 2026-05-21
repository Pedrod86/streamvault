import React from 'react';
import { Link } from 'react-router-dom';
import { Tv, Library, Radio, Zap, Users, ShieldCheck } from 'lucide-react';

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