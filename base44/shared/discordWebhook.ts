// Resolves the Discord webhook URL used for StreamVault notifications.
// Prefers the value saved in AppSettings (editable in-app), falling back to the
// DISCORD_WEBHOOK_URL environment secret.
export async function getDiscordWebhookUrl(base44: any): Promise<string | null> {
  try {
    const list = await base44.asServiceRole.entities.AppSettings.list();
    const saved = list?.[0]?.discord_webhook_url;
    if (saved && String(saved).trim()) return String(saved).trim();
  } catch (_) {
    // ignore and fall back to env
  }
  return Deno.env.get('DISCORD_WEBHOOK_URL') || null;
}