import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getDiscordWebhookUrl } from '../../shared/discordWebhook.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== 'admin') return new Response('Forbidden', { status: 403 });

    const body = await req.json();

    const { data } = body;
    const webhookUrl = await getDiscordWebhookUrl(base44);

    if (!webhookUrl) {
      return Response.json({ error: 'No Discord webhook configured' }, { status: 500 });
    }

    const serverName = data?.server_name || 'Unknown Server';
    const serverType = data?.server_type || '';
    const itemsCreated = data?.items_created ?? 0;
    const itemsUpdated = data?.items_updated ?? 0;
    const itemsFetched = data?.items_fetched ?? 0;
    const duration = data?.duration_seconds ? `${data.duration_seconds}s` : 'N/A';
    const status = data?.status || 'unknown';

    const totalInDb = data?.total_in_db;
    const color = status === 'success' ? 0x57F287 : status === 'partial' ? 0xFEE75C : 0xED4245;
    const emoji = status === 'success' ? '✅' : status === 'partial' ? '⚠️' : '❌';

    const embed = {
      title: `${emoji} Media Library Sync ${status === 'success' ? 'Completed' : status === 'partial' ? 'Partially Completed' : 'Failed'}`,
      color,
      fields: [
        { name: 'Server', value: `${serverName}${serverType ? ` (${serverType})` : ''}`, inline: true },
        { name: 'Duration', value: duration, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: 'Items Fetched', value: String(itemsFetched), inline: true },
        { name: 'New Items', value: String(itemsCreated), inline: true },
        { name: 'Updated', value: String(itemsUpdated), inline: true },
        ...(totalInDb != null ? [{ name: '📦 Total in Library', value: String(totalInDb), inline: false }] : []),
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'StreamVault Sync' },
    };

    if (data?.error_message) {
      embed.fields.push({ name: 'Error', value: data.error_message, inline: false });
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Discord returned ${res.status}: ${text}` }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});