import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { SEED_PEOPLE } from './src/data/seedPeople.ts';
import { D1Row, FamilyMember } from './src/types/family.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DATA_DIR = path.join(__dirname, 'public', 'data');
const STORE_PATH = path.join(DATA_DIR, 'd1_people_store.json');
const PUBLIC_JSON_PATH = path.join(PUBLIC_DATA_DIR, 'people.json');

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PUBLIC_DATA_DIR)) fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
}

function syncPublicJson(rows: D1Row[]) {
  ensureDirectories();
  const people = rows.map((r) => ({
    ...r.data,
    id: r.id,
  }));
  const payload = {
    title: 'Ammar Syaathir Family Heritage Tree',
    meta: {
      course: 'ITT588 - Front-End Technology (Lab Work 4)',
      student: 'Muhammad Ammar Syaathir Bin Abd Rahim',
      studentId: '2025179251',
      group: 'CS2666B',
      updatedAt: new Date().toISOString(),
      totalMembers: people.length,
    },
    people,
  };
  fs.writeFileSync(PUBLIC_JSON_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

function loadRows(): D1Row[] {
  ensureDirectories();
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to read store, re-seeding:', e);
    }
  }
  const now = new Date().toISOString();
  const initialRows: D1Row[] = SEED_PEOPLE.map((person) => ({
    id: person.id,
    data: person,
    updated_at: now,
    updated_by: 'system_seed',
  }));
  saveRows(initialRows);
  return initialRows;
}

function saveRows(rows: D1Row[]) {
  ensureDirectories();
  fs.writeFileSync(STORE_PATH, JSON.stringify(rows, null, 2), 'utf8');
  syncPublicJson(rows);
}

/**
 * Ensures bidirectional parent/child/spouse links across the dataset
 * whenever a member is created, updated, or deleted.
 */
function reconcileRelationships(rows: D1Row[], targetPerson: FamilyMember) {
  const id = targetPerson.id;
  const now = new Date().toISOString();
  const spouseIds = new Set((targetPerson.spouses || []).map((s) => s.id).filter(Boolean));
  const childIds = new Set((targetPerson.children || []).filter(Boolean));

  rows.forEach((row) => {
    if (row.id === id) return;
    const p = row.data;
    let modified = false;

    // 1. If target lists this person as father or mother, ensure target is in their children
    if (targetPerson.fatherId === p.id || targetPerson.motherId === p.id) {
      const children = Array.isArray(p.children) ? [...p.children] : [];
      if (!children.includes(id)) {
        children.push(id);
        p.children = children;
        modified = true;
      }
    } else {
      // If this person previously listed target in children, and target was linked as child to them, keep or clean
      if (Array.isArray(p.children) && p.children.includes(id)) {
        // Only remove if target explicitly changed father/mother away from p.id
        if (
          (p.gender === 'male' && targetPerson.fatherId !== p.id) ||
          (p.gender === 'female' && targetPerson.motherId !== p.id)
        ) {
          p.children = p.children.filter((cid) => cid !== id);
          modified = true;
        }
      }
    }

    // 2. If target lists this person in children, link target as father/mother
    if (childIds.has(p.id)) {
      if (targetPerson.gender === 'male' && p.fatherId !== id) {
        p.fatherId = id;
        modified = true;
      } else if (targetPerson.gender === 'female' && p.motherId !== id) {
        p.motherId = id;
        modified = true;
      }
    }

    // 3. Bidirectional spouse link
    const existingSpouses = Array.isArray(p.spouses) ? [...p.spouses] : [];
    const hasTargetAsSpouse = existingSpouses.some((s) => s.id === id);
    if (spouseIds.has(p.id) && !hasTargetAsSpouse) {
      existingSpouses.push({ id, status: 'married' });
      p.spouses = existingSpouses;
      modified = true;
    } else if (!spouseIds.has(p.id) && hasTargetAsSpouse) {
      p.spouses = existingSpouses.filter((s) => s.id !== id);
      modified = true;
    }

    if (modified) {
      row.updated_at = now;
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Initialize store and public/data/people.json on startup
  loadRows();

  // Cloudflare D1 compatible GET /api/people
  app.get('/api/people', (_req, res) => {
    const rows = loadRows();
    res.json({
      source: 'cloudflare-d1-compatible',
      total: rows.length,
      people: rows,
    });
  });

  // POST /api/people - Create or Upsert a family member
  app.post('/api/people', (req, res) => {
    const body = req.body || {};
    const rawData: FamilyMember = body.data || body;
    const id = String(body.id || rawData.id || `member_${Date.now().toString(36)}`).trim();

    if (!rawData || !rawData.name) {
      res.status(400).json({ error: 'Member name is required' });
      return;
    }

    const person: FamilyMember = {
      ...rawData,
      id,
      name: String(rawData.name).trim(),
      spouses: Array.isArray(rawData.spouses) ? rawData.spouses : [],
      children: Array.isArray(rawData.children) ? rawData.children : [],
    };

    const rows = loadRows();
    const now = new Date().toISOString();
    const existingIdx = rows.findIndex((r) => r.id === id);

    const newRow: D1Row = {
      id,
      data: person,
      updated_at: now,
      updated_by: body.updated_by || 'family_archivist',
    };

    if (existingIdx >= 0) {
      rows[existingIdx] = newRow;
    } else {
      rows.push(newRow);
    }

    reconcileRelationships(rows, person);
    saveRows(rows);

    res.status(201).json({ ok: true, row: newRow, total: rows.length });
  });

  // PATCH or PUT /api/people/:id - Update a family member
  const updateHandler: express.RequestHandler = (req, res) => {
    const id = String(req.params.id || '').trim();
    const body = req.body || {};
    const incomingData = body.data || body;

    const rows = loadRows();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) {
      res.status(404).json({ error: `Member ${id} not found` });
      return;
    }

    const updatedPerson: FamilyMember = {
      ...rows[idx].data,
      ...incomingData,
      id,
      spouses: Array.isArray(incomingData.spouses)
        ? incomingData.spouses
        : rows[idx].data.spouses || [],
      children: Array.isArray(incomingData.children)
        ? incomingData.children
        : rows[idx].data.children || [],
    };

    const now = new Date().toISOString();
    rows[idx] = {
      id,
      data: updatedPerson,
      updated_at: now,
      updated_by: body.updated_by || 'family_archivist',
    };

    reconcileRelationships(rows, updatedPerson);
    saveRows(rows);

    res.json({ ok: true, row: rows[idx], total: rows.length });
  };

  app.patch('/api/people/:id', updateHandler);
  app.put('/api/people/:id', updateHandler);

  // DELETE /api/people/:id - Remove a family member and clean up references
  app.delete('/api/people/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    const rows = loadRows();
    const exists = rows.some((r) => r.id === id);
    if (!exists) {
      res.status(404).json({ error: `Member ${id} not found` });
      return;
    }

    const now = new Date().toISOString();
    const remaining = rows
      .filter((r) => r.id !== id)
      .map((row) => {
        const p = { ...row.data };
        let changed = false;
        if (p.fatherId === id) {
          p.fatherId = null;
          changed = true;
        }
        if (p.motherId === id) {
          p.motherId = null;
          changed = true;
        }
        if (Array.isArray(p.children) && p.children.includes(id)) {
          p.children = p.children.filter((cid) => cid !== id);
          changed = true;
        }
        if (Array.isArray(p.spouses) && p.spouses.some((s) => s.id === id)) {
          p.spouses = p.spouses.filter((s) => s.id !== id);
          changed = true;
        }
        return {
          ...row,
          data: p,
          updated_at: changed ? now : row.updated_at,
        };
      });

    saveRows(remaining);
    res.json({ ok: true, deletedId: id, total: remaining.length });
  });

  // POST /api/people/bulk - Import JSON dataset or Reset to Seed
  app.post('/api/people/bulk', (req, res) => {
    const { action, people } = req.body || {};
    const now = new Date().toISOString();

    if (action === 'reset') {
      const seedRows: D1Row[] = SEED_PEOPLE.map((person) => ({
        id: person.id,
        data: person,
        updated_at: now,
        updated_by: 'system_reset',
      }));
      saveRows(seedRows);
      res.json({ ok: true, total: seedRows.length, people: seedRows });
      return;
    }

    if (!Array.isArray(people)) {
      res.status(400).json({ error: 'Invalid people array in payload' });
      return;
    }

    const importedRows: D1Row[] = people
      .filter((item) => item && (item.name || (item.data && item.data.name)))
      .map((item) => {
        const person: FamilyMember = item.data ? { ...item.data, id: item.id || item.data.id } : item;
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
          updated_by: 'json_import',
        };
      });

    saveRows(importedRows);
    res.json({ ok: true, total: importedRows.length, people: importedRows });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ammar Heritage D1 Server running on http://localhost:${PORT}`);
  });
}

startServer();
