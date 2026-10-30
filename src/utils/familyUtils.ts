import { FamilyMember } from '../types/family';

export const MONTHS_LIST = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export const CITY_OPTIONS = [
  'Bandar Saujana Putra',
  'Seremban',
  'Rembau',
  'Shah Alam',
  'Kuala Lumpur',
  'Putrajaya',
  'Kajang',
  'Petaling Jaya',
  'Subang Jaya',
  'Cyberjaya',
  'Melaka',
  'Johor Bahru',
  'Ipoh',
  'Kuantan',
];

export function normalizeCityName(rawCity?: string): string {
  if (!rawCity) return 'Bandar Saujana Putra';
  const cityOnly = rawCity.split(',')[0].trim();
  return cityOnly || 'Bandar Saujana Putra';
}

export function calculateAge(dob?: string): number {
  if (!dob) return 0;
  const trimmed = dob.trim();
  let birthDate: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    birthDate = new Date(y, m - 1, d);
  } else if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(trimmed)) {
    const [dayStr, monthStr, yearStr] = trimmed.split('-');
    const mIdx = MONTHS_LIST.indexOf(monthStr.toUpperCase());
    birthDate = new Date(Number(yearStr), mIdx >= 0 ? mIdx : 0, Number(dayStr));
  } else {
    birthDate = new Date(trimmed);
  }

  if (isNaN(birthDate.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const mDiff = now.getMonth() - birthDate.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export function getShortFirstName(fullName?: string): string {
  if (!fullName) return 'Member';
  // Strip patronymics (Bin / Binti) and father's name
  const stripped = fullName.split(/\s+(?:Bin|Binti)\s+/i)[0].trim();
  // Strip honorific prefixes (Haji, Hajah)
  const cleaned = stripped.replace(/^(?:Haji|Hajah)\s+/i, '').trim();
  return cleaned || fullName;
}

export function getCleanInitials(person: Partial<FamilyMember>): string {
  const raw = (person.name || 'M').trim();
  const beforePatronymic = raw.split(/\s+(?:Bin|Binti)\s+/i)[0].trim();
  const cleaned =
    beforePatronymic.replace(/^(Haji|Hajah|Muhammad|Nur|Nurul|Mohd|Siti)\s+/i, '').trim() ||
    beforePatronymic ||
    raw;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'FM';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function getRelationToAmmar(
  p: FamilyMember,
  _allPeople: FamilyMember[]
): { text: string; roleCode: string } {
  if (p.id === 'c_ammar') {
    return { text: 'Archivist / Me', roleCode: 'me' };
  }
  if (p.id === 'd_dad') {
    return { text: 'Father', roleCode: 'parent' };
  }
  if (p.id === 'm_shafrah') {
    return { text: 'Mother', roleCode: 'parent' };
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
      text: p.gender === 'male' ? 'Grandfather' : 'Grandmother',
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
      father ? getShortFirstName(father.name) : null,
      mother ? getShortFirstName(mother.name) : null,
    ]
      .filter(Boolean)
      .join(' & ');
    parts.push(`Child of ${pNames}`);
  }
  if (spouses.length > 0) {
    const sNames = spouses.map((s) => getShortFirstName(s.name)).join(' & ');
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
  if (!isoDate) {
    return { formattedDob: '', age: 0 };
  }
  const cleanIso = dobToIsoDate(isoDate) || isoDate;
  return { formattedDob: cleanIso, age: calculateAge(cleanIso) };
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
    const clean = { ...p, city: normalizeCityName(p.city) };
    delete clean.nickname;
    delete clean.profession;
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

export function generatePostgresJsonbSql(people: FamilyMember[]): string {
  const lines: string[] = [
    '-- ============================================================================',
    '-- PostgreSQL / Supabase family_members JSONB Schema & Clean Seed Data',
    `-- Total Family Members: ${people.length}`,
    '-- ============================================================================',
    '',
    '-- 1. Table Creation',
    'CREATE TABLE IF NOT EXISTS public.family_members (',
    '    id VARCHAR(50) PRIMARY KEY,',
    '    data JSONB NOT NULL,',
    '    updated_by VARCHAR(60) DEFAULT \'System\',',
    '    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone(\'utc\'::text, now()),',
    '    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone(\'utc\'::text, now())',
    ');',
    '',
    '-- 2. Trigger Function for Updated Timestamps',
    'CREATE OR REPLACE FUNCTION trigger_set_timestamp()',
    'RETURNS TRIGGER AS $$',
    'BEGIN',
    '  NEW.updated_at = NOW();',
    '  RETURN NEW;',
    'END;',
    '$$ LANGUAGE plpgsql;',
    '',
    'DROP TRIGGER IF EXISTS set_timestamp ON public.family_members;',
    '',
    'CREATE TRIGGER set_timestamp',
    'BEFORE UPDATE ON public.family_members',
    'FOR EACH ROW',
    'EXECUTE FUNCTION trigger_set_timestamp();',
    '',
    '-- 3. Row Level Security (RLS) Policies for Public Web Access',
    'ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;',
    '',
    'DO $$',
    'BEGIN',
    '    IF NOT EXISTS (',
    '        SELECT 1 FROM pg_policies',
    '        WHERE tablename = \'family_members\' AND policyname = \'Allow public read access\'',
    '    ) THEN',
    '        CREATE POLICY "Allow public read access"',
    '        ON public.family_members FOR SELECT USING (true);',
    '    END IF;',
    '',
    '    IF NOT EXISTS (',
    '        SELECT 1 FROM pg_policies',
    '        WHERE tablename = \'family_members\' AND policyname = \'Allow public write access\'',
    '    ) THEN',
    '        CREATE POLICY "Allow public write access"',
    '        ON public.family_members FOR ALL USING (true) WITH CHECK (true);',
    '    END IF;',
    'END $$;',
    '',
    '-- 4. Clean Insert / Upsert Family Records',
    'INSERT INTO public.family_members (id, data) VALUES',
  ];

  const valueRows = people.map((p, idx) => {
    // Standard clean data payload
    const dataObj = {
      name: p.name,
      gender: p.gender,
      dob: p.dob,
      familyLabel: p.familyLabel,
      isInLaw: Boolean(p.isInLaw),
      avatar: p.avatar || null,
      generation: p.generation,
      city: normalizeCityName(p.city),
      fatherId: p.fatherId || null,
      motherId: p.motherId || null,
      spouses: p.spouses || [],
      children: p.children || [],
    };
    const jsonStr = JSON.stringify(dataObj).replace(/'/g, "''");
    const isLast = idx === people.length - 1;
    return `('${p.id}', '${jsonStr}'::jsonb)${isLast ? '' : ','}`;
  });

  lines.push(...valueRows);
  lines.push(
    'ON CONFLICT (id) DO UPDATE',
    'SET data = EXCLUDED.data,',
    "    updated_at = timezone('utc'::text, now()),",
    "    updated_by = 'System';"
  );

  return lines.join('\n');
}
