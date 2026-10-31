// GET  /api/people  -> every member
// POST /api/people  -> create (or replace) one member
import { json, getDb, newId, readBody, loadRows, upsertRows, reconcileRelationships, safe } from "../../_lib/people.js";

export const onRequestGet = safe(async ({ env }) => {
  const rows = await loadRows(getDb(env));
  return json({ source: "cloudflare-d1", total: rows.length, people: rows });
});

export const onRequestPost = safe(async ({ request, env }) => {
  const db = getDb(env);
  const body = await readBody(request);
  const raw = body.data || body;
  const id = String(body.id || raw.id || newId()).trim();

  if (!raw || !raw.name) return json({ error: "Member name is required" }, 400);

  const person = {
    ...raw,
    id,
    name: String(raw.name).trim(),
    spouses: Array.isArray(raw.spouses) ? raw.spouses : [],
    children: Array.isArray(raw.children) ? raw.children : [],
  };

  const rows = await loadRows(db);
  const now = new Date().toISOString();
  const row = { id, data: person, updated_at: now, updated_by: body.updated_by || "family_archivist" };
  const idx = rows.findIndex((r) => r.id === id);
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);

  const changed = reconcileRelationships(rows, person);
  await upsertRows(db, [row, ...changed]);
  return json({ ok: true, row, total: rows.length }, 201);
});
