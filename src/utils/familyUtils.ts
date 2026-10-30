import { FamilyMember } from '../types/family';

export const MONTHS_LIST = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export function getCleanInitials(person: Partial<FamilyMember>): string {
  const raw = (person.nickname || person.name || 'M').trim();
  const cleaned = raw.replace(/^(Haji|Hajah|Muhammad|Nur|Nurul|Mohd|Siti)\s+/i, '').trim() || raw;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'FM';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function getRelationToAmmar(
  p: FamilyMember,
  allPeople: FamilyMember[]
): { text: string; roleCode: string } {
  if (p.id === 'c_ammar') {
    return { text: 'Archivist / Me', roleCode: 'me' };
  }
  if (p.id === 'd_dad') {
    return { text: 'Father (Ayah)', roleCode: 'parent' };
  }
  if (p.id === 'm_shafrah') {
    return { text: 'Mother (Ibu)', roleCode: 'parent' };
  }
  if (p.fatherId === 'd_dad' || p.motherId === 'm_shafrah') {
    if (p.id === 'c_asyraf') return { text: 'Eldest Brother', roleCode: 'sibling' };
    return {
      text: p.gender === 'male' ? 'Brother' : 'Sister',
      roleCode: 'sibling',
    };
  }
  if (p.id === 'c_esyha' || (p.generation === 3 && p.branch === 'immediate' && p.isInLaw)) {
    return {
      text: p.gender === 'male' ? 'Brother-in-Law' : 'Sister-in-Law',
      roleCode: 'inlaw',
    };
  }
  if (p.generation === 4 && p.branch === 'immediate') {
    return {
      text: p.gender === 'male' ? 'Nephew (Gen 4)' : 'Niece (Gen 4)',
      roleCode: 'niece',
    };
  }
  if (p.generation === 1) {
    return {
      text: p.gender === 'male' ? 'Grandfather (Atok)' : 'Grandmother (Nenek)',
      roleCode: 'grandparent',
    };
  }
  if (p.generation === 2) {
    const side = p.branch === 'paternal' ? 'Paternal' : p.branch === 'maternal' ? 'Maternal' : 'Family';
    const role = p.gender === 'male' ? 'Uncle' : 'Aunt';
    return {
      text: p.isInLaw ? `${side} ${role} (In-Law)` : `${side} ${role}`,
      roleCode: 'auntuncle',
    };
  }
  if (p.generation === 3) {
    if (p.isInLaw) {
      return { text: 'Cousin-in-Law', roleCode: 'inlaw' };
    }
    const side = p.branch === 'paternal' ? "Dad's Side" : p.branch === 'maternal' ? "Mom's Side" : 'Immediate';
    return {
      text: `1st Cousin (${side})`,
      roleCode: 'cousin',
    };
  }
  if (p.generation >= 4) {
    return {
      text: p.gender === 'male' ? `Grand-Nephew (Gen ${p.generation})` : `Grand-Niece (Gen ${p.generation})`,
      roleCode: 'niece',
    };
  }
  return { text: `Gen ${p.generation} Relative`, roleCode: 'default' };
}

export function getGenealogySnippet(p: FamilyMember, allPeople: FamilyMember[]): string {
  const byId = new Map(allPeople.map((item) => [item.id, item]));
  const father = p.fatherId ? byId.get(p.fatherId) : null;
  const mother = p.motherId ? byId.get(p.motherId) : null;
  const spouses = (p.spouses || [])
    .map((s) => byId.get(s.id))
    .filter((item): item is FamilyMember => Boolean(item));
  const children = allPeople.filter(
    (item) =>
      item.fatherId === p.id ||
      item.motherId === p.id ||
      (p.children || []).includes(item.id)
  );

  const parts: string[] = [];
  if (father || mother) {
    const pNames = [
      father?.nickname || father?.name?.split(' ')[0],
      mother?.nickname || mother?.name?.split(' ')[0],
    ]
      .filter(Boolean)
      .join(' & ');
    parts.push(`Child of ${pNames}`);
  }
  if (spouses.length > 0) {
    const sNames = spouses.map((s) => s.nickname || s.name.split(' ')[0]).join(' & ');
    parts.push(`Spouse: ${sNames}`);
  }
  if (children.length > 0) {
    parts.push(`${children.length} ${children.length === 1 ? 'Child' : 'Children'}`);
  }
  if (parts.length === 0) {
    return p.bio || `Documented Generation ${p.generation} Member`;
  }
  return parts.join(' · ');
}

export function dobToIsoDate(dob?: string): string {
  if (!dob) return '';
  const trimmed = dob.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthIdx = MONTHS_LIST.indexOf(parts[1].toUpperCase());
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && monthIdx >= 0 && !isNaN(year)) {
      return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

export function isoDateToDisplayDob(isoDate: string): { formattedDob: string; age: number } {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return { formattedDob: '', age: 0 };
  }
  const [yStr, mStr, dStr] = isoDate.split('-');
  const year = parseInt(yStr, 10);
  const mIdx = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);
  const monthCode = MONTHS_LIST[mIdx] || 'JAN';
  const formattedDob = `${String(day).padStart(2, '0')}-${monthCode}-${year}`;

  const now = new Date();
  let age = now.getFullYear() - year;
  const mDiff = now.getMonth() - mIdx;
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < day)) {
    age--;
  }
  if (age < 0) age = 0;

  return { formattedDob, age };
}

export async function cropImageToSquareDataUrl(file: File, size = 480): Promise<string> {
  const loadImg = (): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Unsupported image format'));
      };
      img.src = url;
    });

  const img = await loadImg();
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const side = Math.min(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);

  let quality = 0.85;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (out.length > 210000 && quality > 0.4) {
    quality -= 0.1;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  return out;
}

/**
 * Dynamically finds all children of a primary person (and their spouses) from the live dataset.
 * Ensures newly added members immediately appear in the tree!
 */
export function getDynamicChildrenForCouple(
  primary: FamilyMember,
  spouses: FamilyMember[],
  allPeople: FamilyMember[]
): FamilyMember[] {
  const parentIds = new Set<string>([primary.id, ...spouses.map((s) => s.id)]);
  const explicitChildIds = new Set<string>([
    ...(primary.children || []),
    ...spouses.flatMap((s) => s.children || []),
  ]);

  const matched = allPeople.filter((candidate) => {
    if (parentIds.has(candidate.id)) return false;
    if (explicitChildIds.has(candidate.id)) return true;
    if (candidate.fatherId && parentIds.has(candidate.fatherId)) return true;
    if (candidate.motherId && parentIds.has(candidate.motherId)) return true;
    return false;
  });

  // Sort by age descending (eldest child first), fallback to name
  return matched.sort((a, b) => (b.age || 0) - (a.age || 0));
}

export function generateCloudflareD1Sql(people: FamilyMember[]): string {
  const now = new Date().toISOString();
  const lines: string[] = [
    '-- ============================================================================',
    '-- Ammar Syaathir Family Heritage Archive · Cloudflare D1 Database Schema & Seed',
    `-- Generated at: ${now}`,
    `-- Total Documented Members: ${people.length}`,
    '-- ============================================================================',
    '',
    'CREATE TABLE IF NOT EXISTS people (',
    '  id TEXT PRIMARY KEY,',
    '  data TEXT NOT NULL,',
    '  updated_at TEXT NOT NULL,',
    '  updated_by TEXT',
    ');',
    '',
    'CREATE INDEX IF NOT EXISTS idx_people_updated_at ON people(updated_at);',
    '',
  ];

  people.forEach((p) => {
    const clean = { ...p };
    delete clean._updatedAt;
    delete clean._updatedBy;
    const jsonStr = JSON.stringify(clean).replace(/'/g, "''");
    const idStr = String(p.id).replace(/'/g, "''");
    lines.push(
      `INSERT OR REPLACE INTO people (id, data, updated_at, updated_by) VALUES ('${idStr}', '${jsonStr}', '${now}', 'd1_seed');`
    );
  });

  return lines.join('\n');
}
