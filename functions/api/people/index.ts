/**
 * Cloudflare Pages Function: /functions/api/people/index.ts
 * Connects directly to Cloudflare D1 binding `DB` (table: `people`).
 */

export interface Env {
  DB: any;
}

export const onRequestGet = async (context: { env: Env }) => {
  try {
    const { results } = await context.env.DB.prepare(
      'SELECT id, data, updated_at, updated_by FROM people ORDER BY id ASC'
    ).all();

    const people = (results || []).map((row: any) => ({
      id: row.id,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
    }));

    return new Response(JSON.stringify({ people, total: people.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const body: any = await context.request.json();
    const id = String(body.id || body.data?.id || `member_${Date.now().toString(36)}`).trim();
    const dataObj = { ...(body.data || body), id };
    const updatedBy = body.updated_by || null;
    const now = new Date().toISOString();

    await context.env.DB.prepare(
      `INSERT INTO people (id, data, updated_at, updated_by)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(id) DO UPDATE SET
         data = excluded.data,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`
    )
      .bind(id, JSON.stringify(dataObj), now, updatedBy)
      .run();

    return new Response(
      JSON.stringify({ ok: true, id, data: dataObj, updated_at: now }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
