import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getDiscordWebhookUrl } from '../../shared/discordWebhook.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const webhookUrl = await getDiscordWebhookUrl(base44);
    if (!webhookUrl) return Response.json({ ok: true }); // silently skip if not configured

    // Only handle 'create' events
    const eventType = body?.event?.type;
    if (eventType !== 'create') return Response.json({ ok: true });

    const media = body.data;
    if (!media) return Response.json({ ok: true });

    const typeEmoji = media.media_type === 'movie' ? '🎬' : '📺';
    const year = media.year ? ` (${media.year})` : '';
    const rating = media.rating ? ` ⭐ ${media.rating}` : '';
    const genres = media.genre?.length ? media.genre.slice(0, 3).join(', ') : null;

    const embed = {
      title: `${typeEmoji} New ${media.media_type === 'movie' ? 'Movie' : 'TV Show'} Added`,
      description: `**${media.title}**${year}${rating}`,
      color: media.media_type === 'movie' ? 0x5865F2 : 0x57F287,
      fields: [],
      timestamp: new Date().toISOString(),
      footer: { text: 'StreamVault' },
    };

    if (genres) embed.fields.push({ name: 'Genres', value: genres, inline: true });
    if (media.description) embed.fields.push({ name: 'Overview', value: media.description.slice(0, 200) + (media.description.length > 200 ? '…' : ''), inline: false });
    if (media.poster_url) embed.thumbnail = { url: media.poster_url };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});