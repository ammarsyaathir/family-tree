// Shared helpers for the /api/people functions (Cloudflare Pages Functions + D1).
// Table layout (see db/schema.sql): people(id TEXT PRIMARY KEY, data TEXT, updated_at TEXT, updated_by TEXT)

export const DEFAULT_CITY = "Bandar Saujana Putra";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function getDb(env) {
  if (!env || !env.DB) throw new Error("D1 binding 'DB' is missing. Check wrangler.toml / Pages settings.");
  return env.DB;
}

export function newId() {
  return `member_${Date.now().toString(36)}`;
}

export function firstCity(value, fallback = DEFAULT_CITY) {
  return value ? String(value).split(",")[0].trim() || fallback : fallback;
}

export async function readBody(request) {
  try {
    return (await request.json()) || {};
  } catch {
    return {};
  }
}

export async function loadRows(db) {
  const { results } = await db.prepare("SELECT id, data, updated_at, updated_by FROM people ORDER BY rowid").all();
  return results.map((r) => ({
    id: r.id,
    data: JSON.parse(r.data),
    updated_at: r.updated_at,
    updated_by: r.updated_by,
  }));
}

const UPSERT_SQL =
  "INSERT INTO people (id, data, updated_at, updated_by) VALUES (?, ?, ?, ?) " +
  "ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by";

export async function runBatch(db, statements) {
  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50));
  }
}

export async function upsertRows(db, rows) {
  const stmt = db.prepare(UPSERT_SQL);
  await runBatch(
    db,
    rows.map((r) => stmt.bind(r.id, JSON.stringify(r.data), r.updated_at, r.updated_by || null)),
  );
}

/**
 * Keeps parent / child / spouse links two-way whenever someone is created or changed.
 * Mutates the other rows in place and returns only the rows that changed.
 */
export function reconcileRelationships(rows, target) {
  const id = target.id;
  const now = new Date().toISOString();
  const spouseIds = new Set((target.spouses || []).map((s) => s.id).filter(Boolean));
  const childIds = new Set((target.children || []).filter(Boolean));
  const changed = [];

  for (const row of rows) {
    if (row.id === id) continue;
    const p = row.data;
    let modified = false;

    if (target.fatherId === p.id || target.motherId === p.id) {
      const children = Array.isArray(p.children) ? [...p.children] : [];
      if (!children.includes(id)) {
        children.push(id);
        p.children = children;
        modified = true;
      }
    } else if (Array.isArray(p.children) && p.children.includes(id)) {
      if ((p.gender === "male" && target.fatherId !== p.id) || (p.gender === "female" && target.motherId !== p.id)) {
        p.children = p.children.filter((cid) => cid !== id);
        modified = true;
      }
    }

    if (childIds.has(p.id)) {
      if (target.gender === "male" && p.fatherId !== id) {
        p.fatherId = id;
        modified = true;
      } else if (target.gender === "female" && p.motherId !== id) {
        p.motherId = id;
        modified = true;
      }
    }

    const spouses = Array.isArray(p.spouses) ? [...p.spouses] : [];
    const hasTarget = spouses.some((s) => s.id === id);
    if (spouseIds.has(p.id) && !hasTarget) {
      spouses.push({ id, status: "married" });
      p.spouses = spouses;
      modified = true;
    } else if (!spouseIds.has(p.id) && hasTarget) {
      p.spouses = spouses.filter((s) => s.id !== id);
      modified = true;
    }

    if (modified) {
      row.updated_at = now;
      changed.push(row);
    }
  }
  return changed;
}

export function safe(handler) {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      console.error(error);
      return json({ error: String(error && error.message ? error.message : error) }, 500);
    }
  };
}
