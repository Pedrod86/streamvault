import React from 'react';
import { Server } from 'lucide-react';

/**
 * A labeled section header for a single media server on the Home page.
 * Groups that server's rows (continue watching, recently added, categories)
 * underneath a clear title. Renders nothing if it has no children with content.
 */
export default function ServerSection({ name, accentClass = 'text-primary', children }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2.5 px-4 sm:px-6 mb-4">
        <div className={`w-1.5 h-6 rounded-full bg-current ${accentClass}`} />
        <Server className={`w-4 h-4 ${accentClass}`} />
        <h2 className="font-heading font-extrabold text-lg text-foreground tracking-tight">
          {name}
        </h2>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </section>
  );
}