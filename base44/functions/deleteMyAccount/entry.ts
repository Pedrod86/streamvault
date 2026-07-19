import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// User-owned entities that should be wiped when a user deletes their account.
const USER_OWNED_ENTITIES = [
  'Watchlist',
  'WatchHistory',
  'Downloaded',
  'UserLibrary',
  'Collection',
  'WeeklyPlan',
  'MediaServer',
  'SyncLog',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Remove all records this user owns.
    for (const entityName of USER_OWNED_ENTITIES) {
      try {
        await base44.asServiceRole.entities[entityName].deleteMany({ created_by_id: user.id });
      } catch (_) {
        // Skip entities that error (e.g. none exist) — keep deleting the rest.
      }
    }

    // Finally remove the user record itself.
    await base44.asServiceRole.entities.User.delete(user.id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});