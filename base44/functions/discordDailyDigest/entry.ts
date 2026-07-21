import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getDiscordWebhookUrl } from '../../shared/discordWebhook.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== 'admin') return new Response('Forbidden', { status: 403 });

    const webhookUrl = await getDiscordWebhookUrl(base44);
    if (!webhookUrl) return Response.json({ ok: true, skipped: 'no_webhook' });

    // Everything added in the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await base44.asServiceRole.entities.Media.filter(
      { created_date: { $gte: since.toISOString() } },
      '-created_date',
      200
    );

    if (!recent || recent.length === 0) {
      return Response.json({ ok: true, added: 0 });
    }

    const movies = recent.filter(m => m.media_type === 'movie');
    const shows = recent.filter(m => m.media_type === 'tv_show');

    const fmt = (list) =>
      list.slice(0, 15)
        .map(m => `• **${m.title}**${m.year ? ` (${m.year})` : ''}${m.rating ? ` ⭐ ${m.rating}` : ''}`)
        .join('\n') + (list.length > 15 ? `\n…and ${list.length - 15} more` : '');

    const fields = [];
    if (movies.length) fields.push({ name: `🎬 Movies (${movies.length})`, value: fmt(movies), inline: false });
    if (shows.length) fields.push({ name: `📺 TV Shows (${shows.length})`, value: fmt(shows), inline: false });

    const embed = {
      title: `🆕 ${recent.length} new ${recent.length === 1 ? 'item' : 'items'} added today`,
      description: 'Here\'s what landed on your servers in the last 24 hours.',
      color: 0x5865F2,
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: 'StreamVault · Daily Digest' },
      thumbnail: recent[0]?.poster_url ? { url: recent[0].poster_url } : undefined,
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    return Response.json({ ok: true, added: recent.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});