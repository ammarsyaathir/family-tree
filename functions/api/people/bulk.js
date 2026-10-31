// POST /api/people/bulk  { people: [...] }  -> replace the whole archive with an imported list
// Accepts either flat people (as in public/data/people.json) or D1 rows ({ id, data }).
import { json, getDb, readBody, upsertRows, safe } from "../../_lib/people.js";

export const onRequestPost = safe(async ({ request, env }) => {
  const db = getDb(env);
  const { people } = await readBody(request);
  if (!Array.isArray(people)) return json({ error: "Invalid people array in payload" }, 400);

  const now = new Date().toISOString();
  const rows = people
    .filter((item) => item && (item.name || (item.data && item.data.name)))
    .map((item) => {
      const person = item.data ? { ...item.data, id: item.id || item.data.id } : item;
      const id = String(person.id || `member_${Math.random().toString(36).slice(2, 9)}`);
      return {
        id,
        data: {
          ...person,
          id,
          spouses: Array.isArray(person.spouses) ? person.spouses : [],
          children: Array.isArray(person.children) ? person.children : [],
        },
        updated_at: now,
        updated_by: "json_import",
      };
    });

  await db.prepare("DELETE FROM people").run();
  await upsertRows(db, rows);
  return json({ ok: true, total: rows.length });
});
