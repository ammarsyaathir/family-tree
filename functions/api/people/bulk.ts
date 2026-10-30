/**
 * Cloudflare Pages Function: /functions/api/people/bulk.ts
 * Handles bulk import or reset to default seed on Cloudflare D1.
 */

export interface Env {
  DB: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const body: any = await context.request.json();
    const { action, people } = body || {};
    const now = new Date().toISOString();

    if (action === 'reset') {
      // In D1, clear and re-populate with seed
      await context.env.DB.prepare('DELETE FROM people').run();

      // Return ok; client re-fetches seed
      return new Response(JSON.stringify({ ok: true, action: 'reset' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (Array.isArray(people)) {
      // Execute inserts for each member
      const statements: any[] = [];
      people.forEach((item: any) => {
        const p = item.data || item;
        const id = String(p.id || `member_${Date.now().toString(36)}`).trim();
        const clean = { ...p, id };
        statements.push(
          context.env.DB.prepare(
            `INSERT INTO people (id, data, updated_at, updated_by)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET
               data = excluded.data,
               updated_at = excluded.updated_at,
               updated_by = excluded.updated_by`
          ).bind(id, JSON.stringify(clean), now, 'bulk_import')
        );
      });

      if (statements.length > 0) {
        await context.env.DB.batch(statements);
      }

      return new Response(
        JSON.stringify({ ok: true, total: people.length }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
