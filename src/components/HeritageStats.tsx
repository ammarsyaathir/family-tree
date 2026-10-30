import React, { useMemo } from 'react';
import {
  Users,
  Layers,
  Clock,
  Home,
  Cake,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { FamilyMember, DEFAULT_HOUSEHOLDS } from '../types/family';
import { MONTHS_LIST, getShortFirstName, normalizeCityName, calculateAge } from '../utils/familyUtils';
import { DirectoryFilters } from './MemberDirectory';

interface HeritageStatsProps {
  people: FamilyMember[];
  onFilterAndNavigate: (filterPatch: Partial<DirectoryFilters>) => void;
  onSelectPerson: (person: FamilyMember) => void;
}

export const HeritageStats: React.FC<HeritageStatsProps> = ({
  people,
  onFilterAndNavigate,
  onSelectPerson,
}) => {
  const stats = useMemo(() => {
    const total = people.length || 1;
    const males = people.filter((p) => p.gender === 'male').length;
    const females = people.filter((p) => p.gender === 'female').length;
    const paternalCount = people.filter((p) => p.branch === 'paternal').length;
    const maternalCount = people.filter((p) => p.branch === 'maternal').length;
    const immediateCount = people.filter((p) => p.branch === 'immediate').length;

    const validAges = people
      .map((p) => calculateAge(p.dob) ?? p.age)
      .filter((a) => typeof a === 'number' && !isNaN(a) && a >= 0) as number[];
    const avgAge = validAges.length
      ? (validAges.reduce((a, b) => a + b, 0) / validAges.length).toFixed(1)
      : '0.0';
    const minAge = validAges.length ? Math.min(...validAges) : 0;
    const maxAge = validAges.length ? Math.max(...validAges) : 0;

    // Generations
    const genMap = new Map<number, number>();
    people.forEach((p) => {
      const g = p.generation || 3;
      genMap.set(g, (genMap.get(g) || 0) + 1);
    });
    const maxGenNumber = Math.max(4, ...Array.from(genMap.keys()));

    // Age Cohorts
    const elders = people.filter((p) => (calculateAge(p.dob) ?? p.age ?? 0) >= 60).length;
    const adults = people.filter((p) => {
      const a = calculateAge(p.dob) ?? p.age ?? 0;
      return a >= 35 && a < 60;
    }).length;
    const youth = people.filter((p) => {
      const a = calculateAge(p.dob) ?? p.age ?? 0;
      return a >= 18 && a < 35;
    }).length;
    const kids = people.filter((p) => (calculateAge(p.dob) ?? p.age ?? 0) < 18).length;

    // Households
    const unitMap = new Map<
      string,
      { id: string; label: string; branch: string; count: number; members: FamilyMember[] }
    >();
    people.forEach((p) => {
      const uId = p.familyUnit || 'core_ammar';
      const existing = unitMap.get(uId);
      if (existing) {
        existing.count++;
        existing.members.push(p);
      } else {
        const defaultLabel =
          DEFAULT_HOUSEHOLDS.find((h) => h.id === uId)?.label ||
          p.familyLabel ||
          'Keluarga';
        unitMap.set(uId, {
          id: uId,
          label: defaultLabel,
          branch: p.branch,
          count: 1,
          members: [p],
        });
      }
    });
    const households = Array.from(unitMap.values()).sort((a, b) => b.count - a.count);

    // Cities
    const cityCounts = new Map<string, number>();
    people.forEach((p) => {
      const town = normalizeCityName(p.city);
      if (town) cityCounts.set(town, (cityCounts.get(town) || 0) + 1);
    });
    const cities = Array.from(cityCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Upcoming Birthdays
    const birthdays = people
      .filter((p) => Boolean(p.dob))
      .map((p) => {
        let mIdx = 0;
        let day = 1;
        const parts = (p.dob || '').split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            mIdx = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
          } else {
            day = parseInt(parts[0], 10) || 1;
            mIdx = MONTHS_LIST.indexOf(parts[1].toUpperCase());
            if (mIdx === -1) mIdx = 0;
          }
        }
        return {
          person: p,
          mIdx,
          day,
          dateText: `${String(day).padStart(2, '0')} ${MONTHS_LIST[mIdx] || 'JAN'}`,
        };
      })
      .sort((a, b) => {
        const currentMonth = new Date().getMonth();
        const aDiff = (a.mIdx - currentMonth + 12) % 12;
        const bDiff = (b.mIdx - currentMonth + 12) % 12;
        if (aDiff !== bDiff) return aDiff - bDiff;
        return a.day - b.day;
      })
      .slice(0, 8);

    return {
      total: people.length,
      safeTotal: total,
      males,
      females,
      paternalCount,
      maternalCount,
      immediateCount,
      avgAge,
      minAge,
      maxAge,
      genMap,
      maxGenNumber,
      elders,
      adults,
      youth,
      kids,
      households,
      cities,
      birthdays,
    };
  }, [people]);

  // SVG Donut math
  const circ = 251.32;
  const patPct = stats.paternalCount / stats.safeTotal;
  const matPct = stats.maternalCount / stats.safeTotal;
  const immPct = stats.immediateCount / stats.safeTotal;

  const patDash = (patPct * circ).toFixed(1);
  const matDash = (matPct * circ).toFixed(1);
  const immDash = (immPct * circ).toFixed(1);

  const patOffset = 0;
  const matOffset = -parseFloat(patDash);
  const immOffset = -(parseFloat(patDash) + parseFloat(matDash));

  return (
    <section aria-label="Heritage Demographic Analytics" className="space-y-6">
      {/* 6 Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] text-xs mb-2">
            <span>Total Relatives</span>
            <Users className="w-4 h-4 text-[#14362B]" />
          </div>
          <div className="font-mono-num text-2xl font-bold text-[#1C1917]">{stats.total}</div>
          <div className="text-[11px] text-[#78716C] mt-0.5">Live D1 / JSON count</div>
        </div>

        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] text-xs mb-2">
            <span>Generations</span>
            <Layers className="w-4 h-4 text-[#9A3412]" />
          </div>
          <div className="font-mono-num text-2xl font-bold text-[#1C1917]">
            {stats.maxGenNumber} Tiers
          </div>
          <div className="text-[11px] text-[#78716C] mt-0.5">Ancestral lineage span</div>
        </div>

        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] text-xs mb-2">
            <span>Average Age</span>
            <Clock className="w-4 h-4 text-[#1E4E5F]" />
          </div>
          <div className="font-mono-num text-2xl font-bold text-[#1C1917]">
            {stats.avgAge} yrs
          </div>
          <div className="text-[11px] text-[#78716C] mt-0.5">Across all members</div>
        </div>

        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] text-xs mb-2">
            <span>Households</span>
            <Home className="w-4 h-4 text-[#B47B2B]" />
          </div>
          <div className="font-mono-num text-2xl font-bold text-[#1C1917]">
            {stats.households.length} Units
          </div>
          <div className="text-[11px] text-[#78716C] mt-0.5">Documented nuclear units</div>
        </div>

        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] text-xs mb-2">
            <span>Gender Balance</span>
            <Users className="w-4 h-4 text-[#57534E]" />
          </div>
          <div className="font-mono-num text-2xl font-bold text-[#1C1917]">
            {stats.males}M / {stats.females}F
          </div>
          <div className="text-[11px] text-[#78716C] mt-0.5">
            {((stats.males / stats.safeTotal) * 100).toFixed(0)}% Male ·{' '}
            {((stats.females / stats.safeTotal) * 100).toFixed(0)}% Female
          </div>
        </div>

        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#78716C] text-xs mb-2">
            <span>Age Span</span>
            <Cake className="w-4 h-4 text-[#9A3412]" />
          </div>
          <div className="font-mono-num text-2xl font-bold text-[#1C1917]">
            {stats.minAge}–{stats.maxAge}y
          </div>
          <div className="text-[11px] text-[#78716C] mt-0.5">Youngest to oldest</div>
        </div>
      </div>

      {/* Row 1: Lineage Donut + Generational Hierarchy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lineage Distribution */}
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif-display text-xl font-bold text-[#1C1917]">
                Lineage Distribution
              </h3>
              <p className="text-xs text-[#78716C]">
                Click any branch to filter members in the Directory
              </p>
            </div>
            <span className="font-mono-num text-xs text-[#57534E]">
              {stats.total} Total
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-8 my-auto py-2">
            <div className="relative shrink-0">
              <svg width="156" height="156" viewBox="0 0 100 100" className="-rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#F4EFE6"
                  strokeWidth="15"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#9A3412"
                  strokeWidth="15"
                  strokeDasharray={`${patDash} ${circ}`}
                  strokeDashoffset={patOffset}
                  className="cursor-pointer hover:opacity-85 transition-opacity"
                  onClick={() => onFilterAndNavigate({ branch: 'paternal' })}
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#1E4E5F"
                  strokeWidth="15"
                  strokeDasharray={`${matDash} ${circ}`}
                  strokeDashoffset={matOffset}
                  className="cursor-pointer hover:opacity-85 transition-opacity"
                  onClick={() => onFilterAndNavigate({ branch: 'maternal' })}
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#B47B2B"
                  strokeWidth="15"
                  strokeDasharray={`${immDash} ${circ}`}
                  strokeDashoffset={immOffset}
                  className="cursor-pointer hover:opacity-85 transition-opacity"
                  onClick={() => onFilterAndNavigate({ branch: 'immediate' })}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-mono-num text-2xl font-bold text-[#1C1917]">
                  {stats.total}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[#78716C]">
                  Relatives
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2.5">
              {[
                {
                  id: 'paternal',
                  label: "Paternal Lineage (Dad's Side)",
                  count: stats.paternalCount,
                  pct: (patPct * 100).toFixed(1),
                  color: 'bg-[#9A3412]',
                },
                {
                  id: 'maternal',
                  label: "Maternal Lineage (Mom's Side)",
                  count: stats.maternalCount,
                  pct: (matPct * 100).toFixed(1),
                  color: 'bg-[#1E4E5F]',
                },
                {
                  id: 'immediate',
                  label: 'Immediate Core (Ammar Family)',
                  count: stats.immediateCount,
                  pct: (immPct * 100).toFixed(1),
                  color: 'bg-[#B47B2B]',
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onFilterAndNavigate({ branch: item.id })}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] hover:bg-[#F4EFE6] transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-xs ${item.color} shrink-0`} />
                    <span className="text-xs font-semibold text-[#1C1917]">{item.label}</span>
                  </div>
                  <div className="font-mono-num text-xs text-[#57534E]">
                    <strong className="text-[#1C1917]">{item.count}</strong> ({item.pct}%)
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generational Hierarchy */}
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif-display text-xl font-bold text-[#1C1917]">
                Generational Hierarchy
              </h3>
              <p className="text-xs text-[#78716C]">
                Click any generation tier to inspect members in the Directory
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            {[
              {
                gen: 1,
                title: 'Generation 1 · Grandparents & Patriarchs',
                color: 'bg-[#57534E]',
              },
              {
                gen: 2,
                title: 'Generation 2 · Parents, Uncles & Aunts',
                color: 'bg-[#9A3412]',
              },
              {
                gen: 3,
                title: 'Generation 3 · Ammar, Siblings & First Cousins',
                color: 'bg-[#14362B]',
              },
              {
                gen: 4,
                title: 'Generation 4 · Next-Generation Nieces & Nephews',
                color: 'bg-[#B47B2B]',
              },
            ].map((tier) => {
              const count = stats.genMap.get(tier.gen) || 0;
              const pct = ((count / stats.safeTotal) * 100).toFixed(1);
              return (
                <button
                  key={tier.gen}
                  type="button"
                  onClick={() => onFilterAndNavigate({ generation: String(tier.gen) })}
                  className="w-full text-left p-3 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] hover:bg-[#F4EFE6] transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1C1917]">{tier.title}</span>
                    <span className="font-mono-num text-[#57534E]">
                      <strong className="text-[#1C1917]">{count}</strong> members ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#E5DEC9]/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${tier.color}`}
                      style={{ width: `${Math.max(4, parseFloat(pct))}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Age Cohort Breakdown & Geographic Footprint */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Age Cohorts */}
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-serif-display text-xl font-bold text-[#1C1917]">
              Age Cohort Distribution
            </h3>
            <p className="text-xs text-[#78716C]">
              Demographic distribution by life stage (click to filter Directory)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: 'elders',
                label: 'Seniors & Elders',
                sub: '60+ years old',
                count: stats.elders,
              },
              {
                id: 'adults',
                label: 'Established Adults',
                sub: '35 – 59 years old',
                count: stats.adults,
              },
              {
                id: 'youth',
                label: 'Young Adults',
                sub: '18 – 34 years old',
                count: stats.youth,
              },
              {
                id: 'kids',
                label: 'Children & Teens',
                sub: 'Under 18 years old',
                count: stats.kids,
              },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onFilterAndNavigate({ cohort: c.id })}
                className="p-4 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] hover:bg-[#F4EFE6] text-left transition-colors"
              >
                <div className="font-mono-num text-2xl font-bold text-[#14362B]">{c.count}</div>
                <div className="text-xs font-semibold text-[#1C1917] mt-1">{c.label}</div>
                <div className="text-[11px] text-[#78716C]">{c.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Malaysian Geographic Footprint */}
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 shadow-2xs">
          <div className="mb-4">
            <h3 className="font-serif-display text-xl font-bold text-[#1C1917]">
              Geographic Footprint
            </h3>
            <p className="text-xs text-[#78716C]">
              Documented hometowns and cities across Malaysia (click to filter)
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {stats.cities.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => onFilterAndNavigate({ city: c.name })}
                className="p-3 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] hover:bg-[#F4EFE6] text-left transition-colors flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-xs font-semibold text-[#1C1917] truncate">
                    <MapPin className="w-3 h-3 text-[#9A3412] shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="text-[11px] text-[#78716C] font-mono-num mt-0.5">
                    {c.count} {c.count === 1 ? 'member' : 'members'}
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Household Units Leaderboard */}
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 shadow-2xs">
        <div className="mb-4">
          <h3 className="font-serif-display text-xl font-bold text-[#1C1917]">
            Documented Family Households ({stats.households.length} Units)
          </h3>
          <p className="text-xs text-[#78716C]">
            Click any household card to inspect all its members in the Directory
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {stats.households.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onFilterAndNavigate({ familyUnit: u.id })}
              className="flex items-center gap-3.5 p-3.5 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] hover:bg-[#F4EFE6] transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-[#14362B] text-white font-mono-num font-bold text-sm flex items-center justify-center shrink-0">
                {u.count}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#1C1917] truncate">{u.label}</div>
                <div className="text-[11px] text-[#78716C] truncate">
                  {u.members
                    .slice(0, 2)
                    .map((m) => getShortFirstName(m.name))
                    .join(', ')}{' '}
                  &amp; family
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#78716C] shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Row 4: Upcoming Birthdays */}
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 shadow-2xs">
        <div className="mb-4">
          <h3 className="font-serif-display text-xl font-bold text-[#1C1917]">
            Upcoming Family Birthdays &amp; Milestones
          </h3>
          <p className="text-xs text-[#78716C]">
            Chronological birthday calendar across all documented generations
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.birthdays.map(({ person, dateText }) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onSelectPerson(person)}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] hover:bg-[#F4EFE6] text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[#FEF6E6] border border-[#B47B2B]/30 text-[#9A631A] flex items-center justify-center shrink-0">
                <Cake className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#1C1917] truncate uppercase tracking-wide">
                  {getShortFirstName(person.name)}
                </div>
                <div className="text-[11px] text-[#57534E] font-mono-num">
                  {dateText} · Turning {(calculateAge(person.dob) ?? person.age ?? 0) + 1} yrs
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
