/**
 * Cloudflare Pages Function: /functions/api/people/[id].ts
 * Handles PATCH, PUT, and DELETE for individual family profiles in Cloudflare D1.
 */

export interface Env {
  DB: any;
}

export const onRequestPatch = async (context: {
  request: Request;
  env: Env;
  params: { id: string };
}) => {
  try {
    const id = String(context.params.id || '').trim();
    const body: any = await context.request.json();
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
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPut = onRequestPatch;

export const onRequestDelete = async (context: {
  env: Env;
  params: { id: string };
}) => {
  try {
    const id = String(context.params.id || '').trim();
    await context.env.DB.prepare('DELETE FROM people WHERE id = ?1').bind(id).run();

    return new Response(JSON.stringify({ ok: true, deletedId: id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
