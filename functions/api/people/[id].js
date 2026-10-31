// PATCH / PUT /api/people/:id -> update (or create) one member
// DELETE      /api/people/:id -> remove one member and clean up links to them
import {
  json, getDb, newId, firstCity, readBody, loadRows, upsertRows, runBatch, reconcileRelationships, safe, DEFAULT_CITY,
} from "../../_lib/people.js";

const update = safe(async ({ request, env, params }) => {
  const db = getDb(env);
  const body = await readBody(request);
  const incoming = body.data || body;
  const rawId = String(params.id || "").trim();
  const id =
    rawId && rawId !== "undefined" && rawId !== "null"
      ? rawId
      : incoming && incoming.id && incoming.id !== "undefined"
      ? String(incoming.id).trim()
      : newId();

  const rows = await loadRows(db);
  const idx = rows.findIndex((r) => r.id === id);
  const now = new Date().toISOString();
  const updatedBy = body.updated_by || "family_archivist";

  let row;
  let status = 200;
  if (idx === -1) {
    if (!incoming || !incoming.name) return json({ error: "Member name is required" }, 400);
    row = {
      id,
      data: {
        ...incoming,
        id,
        name: String(incoming.name).trim(),
        city: firstCity(incoming.city),
        spouses: Array.isArray(incoming.spouses) ? incoming.spouses : [],
        children: Array.isArray(incoming.children) ? incoming.children : [],
      },
      updated_at: now,
      updated_by: updatedBy,
    };
    rows.push(row);
  } else {
    const current = rows[idx].data;
    row = {
      id,
      data: {
        ...current,
        ...incoming,
        id,
        city: incoming.city ? firstCity(incoming.city) : current.city || DEFAULT_CITY,
        spouses: Array.isArray(incoming.spouses) ? incoming.spouses : current.spouses || [],
        children: Array.isArray(incoming.children) ? incoming.children : current.children || [],
      },
      updated_at: now,
      updated_by: updatedBy,
    };
    rows[idx] = row;
  }

  const changed = reconcileRelationships(rows, row.data);
  await upsertRows(db, [row, ...changed]);
  return json({ ok: true, row, total: rows.length }, status);
});

export const onRequestPatch = update;
export const onRequestPut = update;

export const onRequestDelete = safe(async ({ env, params }) => {
  const db = getDb(env);
  const id = String(params.id || "").trim();
  const rows = await loadRows(db);
  if (!rows.some((r) => r.id === id)) return json({ error: `Member ${id} not found` }, 404);

  const now = new Date().toISOString();
  const touched = [];
  for (const row of rows) {
    if (row.id === id) continue;
    const p = row.data;
    let changed = false;
    if (p.fatherId === id) { p.fatherId = null; changed = true; }
    if (p.motherId === id) { p.motherId = null; changed = true; }
    if (Array.isArray(p.children) && p.children.includes(id)) { p.children = p.children.filter((c) => c !== id); changed = true; }
    if (Array.isArray(p.spouses) && p.spouses.some((s) => s.id === id)) { p.spouses = p.spouses.filter((s) => s.id !== id); changed = true; }
    if (changed) { row.updated_at = now; touched.push(row); }
  }

  await runBatch(db, [db.prepare("DELETE FROM people WHERE id = ?").bind(id)]);
  await upsertRows(db, touched);
  return json({ ok: true, deletedId: id, total: rows.length - 1 });
});
