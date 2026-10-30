import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  RotateCcw,
  LayoutGrid,
  Home,
  Table as TableIcon,
  Crosshair,
  PenSquare,
  IdCard,
  Copy,
  Camera,
  ChevronDown,
  ChevronUp,
  UserPlus,
  X,
} from 'lucide-react';
import { FamilyMember, DEFAULT_HOUSEHOLDS } from '../types/family';
import {
  getCleanInitials,
  getRelationToAmmar,
  getGenealogySnippet,
  cropImageToSquareDataUrl,
  CITY_OPTIONS,
  normalizeCityName,
  getShortFirstName,
  calculateAge,
} from '../utils/familyUtils';

export interface DirectoryFilters {
  search: string;
  familyUnit: string;
  branch: string;
  generation: string;
  gender: string;
  city: string;
  cohort: string | null;
  sortBy: 'default' | 'age-desc' | 'age-asc' | 'name-asc' | 'family';
}

interface MemberDirectoryProps {
  people: FamilyMember[];
  filters: DirectoryFilters;
  onChangeFilters: (next: Partial<DirectoryFilters>) => void;
  onResetFilters: () => void;
  onSelectPerson: (person: FamilyMember) => void;
  onEditPerson: (person: FamilyMember) => void;
  onLocateInTree: (person: FamilyMember) => void;
  onCopySummary: (person: FamilyMember) => void;
  onQuickAvatarUpdate: (person: FamilyMember, avatarDataUrl: string) => Promise<void>;
  onAddMemberToHousehold: (
    familyUnit: string,
    familyLabel: string,
    branch: FamilyMember['branch']
  ) => void;
}

export const MemberDirectory: React.FC<MemberDirectoryProps> = ({
  people,
  filters,
  onChangeFilters,
  onResetFilters,
  onSelectPerson,
  onEditPerson,
  onLocateInTree,
  onCopySummary,
  onQuickAvatarUpdate,
  onAddMemberToHousehold,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'grouped' | 'table'>('grouped');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [uploadingForPerson, setUploadingForPerson] = useState<FamilyMember | null>(null);
  const quickFileInputRef = useRef<HTMLInputElement>(null);

  const householdOptions = useMemo(() => {
    const map = new Map<string, string>();
    DEFAULT_HOUSEHOLDS.forEach((h) => map.set(h.id, h.label));
    people.forEach((p) => {
      if (p.familyUnit && !map.has(p.familyUnit)) {
        map.set(p.familyUnit, p.familyLabel || p.familyUnit);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [people]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>(CITY_OPTIONS);
    people.forEach((p) => {
      if (p.city) {
        const town = normalizeCityName(p.city);
        if (town) set.add(town);
      }
    });
    return Array.from(set).sort();
  }, [people]);

  const generationOptions = useMemo(() => {
    const set = new Set<number>([1, 2, 3, 4]);
    people.forEach((p) => {
      if (typeof p.generation === 'number') set.add(p.generation);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [people]);

  const filteredPeople = useMemo(() => {
    const q = filters.search.toLowerCase().trim();
    const list = people.filter((p) => {
      const cityClean = normalizeCityName(p.city).toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        cityClean.includes(q) ||
        (p.bio && p.bio.toLowerCase().includes(q));

      const matchUnit = filters.familyUnit === 'all' || p.familyUnit === filters.familyUnit;
      const matchBranch = filters.branch === 'all' || p.branch === filters.branch;
      const matchGen =
        filters.generation === 'all' || String(p.generation) === String(filters.generation);
      const matchGender = filters.gender === 'all' || p.gender === filters.gender;
      const matchCity =
        filters.city === 'all' ||
        cityClean === filters.city.toLowerCase();

      const personAge = calculateAge(p.dob) || p.age || 0;
      const matchCohort =
        !filters.cohort ||
        (filters.cohort === 'elders'
          ? personAge >= 60
          : filters.cohort === 'adults'
          ? personAge >= 35 && personAge < 60
          : filters.cohort === 'youth'
          ? personAge >= 18 && personAge < 35
          : filters.cohort === 'kids'
          ? personAge < 18
          : true);

      return (
        matchSearch &&
        matchUnit &&
        matchBranch &&
        matchGen &&
        matchGender &&
        matchCity &&
        matchCohort
      );
    });

    if (filters.sortBy === 'age-desc') {
      list.sort((a, b) => (calculateAge(b.dob) || b.age || 0) - (calculateAge(a.dob) || a.age || 0));
    } else if (filters.sortBy === 'age-asc') {
      list.sort((a, b) => (calculateAge(a.dob) || a.age || 0) - (calculateAge(b.dob) || b.age || 0));
    } else if (filters.sortBy === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (filters.sortBy === 'family') {
      list.sort((a, b) => (a.familyUnit || '').localeCompare(b.familyUnit || ''));
    } else {
      list.sort((a, b) => {
        if (a.generation !== b.generation) return a.generation - b.generation;
        return (calculateAge(b.dob) || b.age || 0) - (calculateAge(a.dob) || a.age || 0);
      });
    }

    return list;
  }, [people, filters]);

  const groupedHouseholds = useMemo(() => {
    const map = new Map<
      string,
      { id: string; label: string; branch: FamilyMember['branch']; members: FamilyMember[] }
    >();
    filteredPeople.forEach((p) => {
      const unitId = p.familyUnit || 'core_ammar';
      const existing = map.get(unitId);
      if (existing) {
        existing.members.push(p);
      } else {
        const defaultLabel =
          DEFAULT_HOUSEHOLDS.find((h) => h.id === unitId)?.label ||
          p.familyLabel ||
          'Keluarga';
        map.set(unitId, {
          id: unitId,
          label: defaultLabel,
          branch: p.branch || 'immediate',
          members: [p],
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.members.length - a.members.length);
  }, [filteredPeople]);

  const triggerQuickPhotoSelect = (person: FamilyMember, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadingForPerson(person);
    if (quickFileInputRef.current) {
      quickFileInputRef.current.value = '';
      quickFileInputRef.current.click();
    }
  };

  const handleQuickFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingForPerson) return;
    try {
      const dataUrl = await cropImageToSquareDataUrl(file);
      await onQuickAvatarUpdate(uploadingForPerson, dataUrl);
    } catch (err) {
      console.error('Quick avatar upload failed:', err);
    } finally {
      setUploadingForPerson(null);
      e.target.value = '';
    }
  };

  const renderMemberCard = (p: FamilyMember) => {
    const isMe = p.id === 'c_ammar';
    const initials = getCleanInitials(p);
    const rel = getRelationToAmmar(p, people);
    const genealogy = getGenealogySnippet(p, people);
    const cityOnly = normalizeCityName(p.city);

    return (
      <article
        key={p.id}
        onClick={() => onSelectPerson(p)}
        className={`group flex flex-col justify-between rounded-2xl border p-5 transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
          isMe
            ? 'bg-[#FFFDF9] border-[#B47B2B]'
            : 'bg-white border-[#E5DEC9] hover:border-[#14362B]/50'
        }`}
      >
        <div>
          {/* Top quiet kicker line: Relation & Branch */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#78716C] mb-3.5 pb-2.5 border-b border-[#F2ECE1]">
            <span className="font-semibold text-[#14362B]">{rel.text}</span>
            <span className="font-mono-num">
              Gen {p.generation} · <span className="capitalize font-sans">{p.branch}</span>
            </span>
          </div>

          {/* Identity Row with Interactive Avatar Photo Upload */}
          <div className="flex items-start gap-3.5">
            <div className="relative shrink-0">
              <div
                className={`w-16 h-16 rounded-xl border flex items-center justify-center overflow-hidden font-serif-display text-xl font-bold ${
                  isMe
                    ? 'bg-[#FEF6E6] text-[#9A631A] border-[#B47B2B]'
                    : p.gender === 'male'
                    ? 'bg-[#EBF3F9] text-[#1E4E5F] border-[#1E4E5F]/20'
                    : 'bg-[#F9EFEF] text-[#9A3412] border-[#9A3412]/20'
                }`}
              >
                {p.avatar ? (
                  <img
                    src={p.avatar}
                    alt={p.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>

              {/* Direct 1-Click Change Avatar Button */}
              <button
                type="button"
                onClick={(e) => triggerQuickPhotoSelect(p, e)}
                title={`Change profile photo for ${p.name}`}
                aria-label={`Change profile photo for ${p.name}`}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-[#14362B] text-white border-2 border-white flex items-center justify-center shadow-xs hover:bg-[#9A3412] transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className="font-serif-display text-lg font-bold text-[#1C1917] leading-snug uppercase tracking-wide truncate"
                title={p.name}
              >
                {getShortFirstName(p.name)}
              </h3>

              {/* Unboxed Static Metadata with Middle Dot Separators */}
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#78716C]">
                <span className="capitalize">{p.gender}</span>
                <span aria-hidden="true">·</span>
                <span>{cityOnly}</span>
              </div>
            </div>
          </div>

          {/* Vital Records Grid (Age & Birth + City) */}
          <dl className="mt-4 pt-3 border-t border-[#F2ECE1] grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[#78716C]">Age &amp; Birth</dt>
              <dd className="mt-0.5 font-mono-num font-medium text-[#1C1917] truncate">
                {calculateAge(p.dob) || p.age} yrs · {p.dob || 'Unrecorded'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[#78716C]">City</dt>
              <dd className="mt-0.5 font-medium text-[#1C1917] truncate" title={cityOnly}>
                {cityOnly}
              </dd>
            </div>
          </dl>

          {/* Genealogy Line */}
          <div
            className="mt-3 pt-2.5 border-t border-[#F2ECE1] text-[11px] text-[#57534E] truncate"
            title={genealogy}
          >
            {genealogy}
          </div>

          {p.bio && (
            <p className="mt-2 text-xs text-[#78716C] italic line-clamp-2" title={p.bio}>
              &ldquo;{p.bio.replace(/\s*\(\s*\d+\s*years?\s*old\s*\)/i, '')}&rdquo;
            </p>
          )}
        </div>

        {/* Interactive Action Footer */}
        <div className="mt-4 pt-3 border-t border-[#E5DEC9] flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLocateInTree(p);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[#F4EFE6] hover:bg-[#B47B2B] text-[#57534E] hover:text-white text-xs font-medium transition-colors whitespace-nowrap"
            title="Spotlight on Family Tree"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Tree</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditPerson(p);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-[#E5DEC9] bg-white hover:bg-[#14362B] text-[#1C1917] hover:text-white text-xs font-medium transition-colors whitespace-nowrap"
            title="Edit Profile & Relationships"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPerson(p);
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[#14362B] hover:bg-[#0D261E] text-white text-xs font-medium transition-colors whitespace-nowrap"
            title="Open Full Interactive Profile"
          >
            <IdCard className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopySummary(p);
            }}
            className="p-2 rounded-lg border border-[#E5DEC9] bg-white hover:bg-[#F4EFE6] text-[#57534E] hover:text-[#1C1917] transition-colors"
            title="Copy Profile Summary"
            aria-label="Copy profile summary"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </article>
    );
  };

  const activeFilterChips: { key: keyof DirectoryFilters; label: string }[] = [];
  if (filters.familyUnit !== 'all') {
    const h = householdOptions.find((item) => item.id === filters.familyUnit);
    activeFilterChips.push({
      key: 'familyUnit',
      label: `Unit: ${h?.label || filters.familyUnit}`,
    });
  }
  if (filters.branch !== 'all') {
    activeFilterChips.push({ key: 'branch', label: `Branch: ${filters.branch}` });
  }
  if (filters.generation !== 'all') {
    activeFilterChips.push({ key: 'generation', label: `Gen ${filters.generation}` });
  }
  if (filters.gender !== 'all') {
    activeFilterChips.push({ key: 'gender', label: `Gender: ${filters.gender}` });
  }
  if (filters.city !== 'all') {
    activeFilterChips.push({ key: 'city', label: `City: ${filters.city}` });
  }
  if (filters.cohort) {
    activeFilterChips.push({ key: 'cohort', label: `Age Group: ${filters.cohort}` });
  }
  if (filters.search.trim()) {
    activeFilterChips.push({ key: 'search', label: `"${filters.search.trim()}"` });
  }

  return (
    <section aria-label="Family Member Directory" className="space-y-4">
      <input
        ref={quickFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleQuickFileChange}
      />

      {/* Filter & Search Bar */}
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChangeFilters({ search: e.target.value })}
            placeholder="Search relatives by full name or city..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#14362B]"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          <select
            value={filters.familyUnit}
            onChange={(e) => onChangeFilters({ familyUnit: e.target.value })}
            aria-label="Filter by household unit"
            className="col-span-2 sm:col-span-1 lg:col-span-2 px-3 py-2 text-xs font-medium bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
          >
            <option value="all">Every Household Unit ({householdOptions.length})</option>
            {householdOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>

          <select
            value={filters.branch}
            onChange={(e) => onChangeFilters({ branch: e.target.value })}
            aria-label="Filter by lineage branch"
            className="px-3 py-2 text-xs font-medium bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
          >
            <option value="all">Every Branch</option>
            <option value="immediate">Immediate Core</option>
            <option value="paternal">Paternal (Dad)</option>
            <option value="maternal">Maternal (Mom)</option>
          </select>

          <select
            value={filters.generation}
            onChange={(e) => onChangeFilters({ generation: e.target.value })}
            aria-label="Filter by generation"
            className="px-3 py-2 text-xs font-medium bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
          >
            <option value="all">Every Generation</option>
            {generationOptions.map((g) => (
              <option key={g} value={String(g)}>
                Generation {g}
              </option>
            ))}
          </select>

          <select
            value={filters.gender}
            onChange={(e) => onChangeFilters({ gender: e.target.value })}
            aria-label="Filter by gender"
            className="px-3 py-2 text-xs font-medium bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
          >
            <option value="all">Every Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <select
            value={filters.city}
            onChange={(e) => onChangeFilters({ city: e.target.value })}
            aria-label="Filter by city"
            className="px-3 py-2 text-xs font-medium bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
          >
            <option value="all">Every City ({cityOptions.length})</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
            <select
              value={filters.sortBy}
              onChange={(e) =>
                onChangeFilters({
                  sortBy: e.target.value as DirectoryFilters['sortBy'],
                })
              }
              aria-label="Sort directory"
              className="flex-1 px-3 py-2 text-xs font-medium bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
            >
              <option value="default">Sort: Generation</option>
              <option value="age-desc">Age: Oldest First</option>
              <option value="age-asc">Age: Youngest First</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="family">Sort: Household</option>
            </select>

            <button
              type="button"
              onClick={onResetFilters}
              className="px-3 py-2 rounded-xl border border-[#E5DEC9] bg-[#F4EFE6] hover:bg-[#14362B] text-[#1C1917] hover:text-white text-xs font-medium transition-colors inline-flex items-center gap-1 whitespace-nowrap"
              title="Reset all directory filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Counter & Layout Switcher Bar */}
      <div className="bg-white border border-[#E5DEC9] rounded-2xl px-4 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
          <span>Showing</span>
          <strong className="font-mono-num text-base font-bold text-[#14362B]">
            {filteredPeople.length}
          </strong>
          <span>of</span>
          <strong className="font-mono-num text-sm font-semibold text-[#1C1917]">
            {people.length}
          </strong>
          <span>documented family members</span>

          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                if (chip.key === 'search') onChangeFilters({ search: '' });
                else if (chip.key === 'cohort') onChangeFilters({ cohort: null });
                else onChangeFilters({ [chip.key]: 'all' });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F4EFE6] hover:bg-[#E5DEC9] text-[#1C1917] text-[11px] font-medium transition-colors"
            >
              <span>{chip.label}</span>
              <X className="w-3 h-3 text-[#78716C]" />
            </button>
          ))}
        </div>

        {/* View Mode Segmented Controls */}
        <div
          className="flex items-center gap-1 p-1 bg-[#F4EFE6] rounded-xl w-full sm:w-auto"
          role="group"
          aria-label="Directory layout mode"
        >
          {(
            [
              { id: 'grid', label: 'Cards', icon: LayoutGrid },
              { id: 'grouped', label: 'By Household', icon: Home },
              { id: 'table', label: 'Table', icon: TableIcon },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setViewMode(item.id)}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  viewMode === item.id
                    ? 'bg-white text-[#14362B] shadow-2xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {filteredPeople.length === 0 ? (
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-12 text-center space-y-3">
          <p className="font-serif-display text-2xl font-bold text-[#1C1917]">
            No Matching Family Records
          </p>
          <p className="text-sm text-[#57534E] max-w-md mx-auto">
            No documented relatives match your active search or filter criteria. Reset the filters to browse all {people.length} individuals.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#14362B] text-white text-xs font-semibold hover:bg-[#0D261E] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* 1. CARDS GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPeople.map((p) => renderMemberCard(p))}
        </div>
      ) : viewMode === 'grouped' ? (
        /* 2. GROUPED BY HOUSEHOLD VIEW */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 text-xs text-[#57534E]">
            <span>
              Showing <strong className="font-mono-num">{groupedHouseholds.length}</strong>{' '}
              {groupedHouseholds.length === 1 ? 'household' : 'households'}. Click any household header to expand or collapse.
            </span>
            <button
              type="button"
              onClick={() => {
                const allCollapsed = groupedHouseholds.every((g) => collapsedGroups[g.id]);
                if (allCollapsed) {
                  setCollapsedGroups({});
                } else {
                  const next: Record<string, boolean> = {};
                  groupedHouseholds.forEach((g) => {
                    next[g.id] = true;
                  });
                  setCollapsedGroups(next);
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-[#E5DEC9] bg-white hover:bg-[#F4EFE6] text-xs font-medium text-[#1C1917] transition-colors"
            >
              {groupedHouseholds.every((g) => collapsedGroups[g.id])
                ? 'Expand All Households'
                : 'Collapse All Households'}
            </button>
          </div>

          {groupedHouseholds.map((group) => {
            const isCollapsed = Boolean(collapsedGroups[group.id]);
            const heads =
              group.members
                .filter((m) => m.generation <= 2)
                .slice(0, 2)
                .map((m) => getShortFirstName(m.name))
                .join(' & ') ||
              getShortFirstName(group.members[0]?.name) ||
              'Family Head';

            const gens = group.members.map((m) => m.generation).filter(Boolean);
            const minGen = Math.min(...gens);
            const maxGen = Math.max(...gens);
            const genSpan =
              gens.length > 0
                ? minGen === maxGen
                  ? `Gen ${minGen}`
                  : `Gen ${minGen}–${maxGen}`
                : '';

            return (
              <div
                key={group.id}
                className="bg-white border border-[#E5DEC9] rounded-2xl overflow-hidden shadow-2xs"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setCollapsedGroups((prev) => ({
                      ...prev,
                      [group.id]: !prev[group.id],
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [group.id]: !prev[group.id],
                      }));
                    }
                  }}
                  className="px-5 py-4 bg-[#F4EFE6]/60 hover:bg-[#F4EFE6] transition-colors flex flex-wrap items-center justify-between gap-3 cursor-pointer border-b border-[#E5DEC9]/70"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif-display text-xl font-bold text-[#1C1917]">
                        {group.label}
                      </h3>
                      <span className="text-xs text-[#78716C]">
                        · Heads: <strong className="text-[#1C1917]">{heads}</strong>
                      </span>
                    </div>
                    <div className="text-xs text-[#57534E] font-mono-num">
                      {genSpan} · {group.members.length}{' '}
                      {group.members.length === 1 ? 'documented member' : 'documented members'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddMemberToHousehold(group.id, group.label, group.branch);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#14362B] text-[#14362B] hover:text-white border border-[#E5DEC9] text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add to Household</span>
                    </button>

                    <span className="w-8 h-8 rounded-lg bg-white border border-[#E5DEC9] flex items-center justify-center text-[#57534E]">
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronUp className="w-4 h-4" />
                      )}
                    </span>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-[#FBF9F5]/50">
                    {group.members.map((p) => renderMemberCard(p))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* 3. TABLE VIEW */
        <div className="bg-white border border-[#E5DEC9] rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[75vh]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F4EFE6] text-[#57534E] border-b border-[#E5DEC9] uppercase tracking-wider text-[11px] font-semibold sticky top-0 z-10">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4 min-w-[230px]">Full Name</th>
                  <th className="py-3.5 px-4 min-w-[160px]">Relation to Ammar</th>
                  <th className="py-3.5 px-4 min-w-[130px]">Gen &amp; Branch</th>
                  <th className="py-3.5 px-4 min-w-[130px]">Age &amp; DOB</th>
                  <th className="py-3.5 px-4 min-w-[150px]">City</th>
                  <th className="py-3.5 px-4 text-right min-w-[160px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE1]">
                {filteredPeople.map((p, idx) => {
                  const initials = getCleanInitials(p);
                  const rel = getRelationToAmmar(p, people);
                  const isMe = p.id === 'c_ammar';
                  const cityOnly = normalizeCityName(p.city);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectPerson(p)}
                      className={`hover:bg-[#F4EFE6]/50 transition-colors cursor-pointer ${
                        isMe ? 'bg-[#FEF6E6]/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono-num text-[#78716C]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div
                              className={`w-10 h-10 rounded-lg border flex items-center justify-center overflow-hidden font-serif-display font-bold text-sm ${
                                p.gender === 'male'
                                  ? 'bg-[#EBF3F9] text-[#1E4E5F] border-[#1E4E5F]/20'
                                  : 'bg-[#F9EFEF] text-[#9A3412] border-[#9A3412]/20'
                              }`}
                            >
                              {p.avatar ? (
                                <img
                                  src={p.avatar}
                                  alt={p.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{initials}</span>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="font-serif-display font-bold text-sm text-[#1C1917] uppercase tracking-wide truncate">
                              {getShortFirstName(p.name)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#14362B] font-medium">{rel.text}</td>
                      <td className="py-3 px-4 text-[#57534E] font-mono-num">
                        Gen {p.generation} · <span className="capitalize font-sans">{p.branch}</span>
                      </td>
                      <td className="py-3 px-4 font-mono-num">
                        <span className="font-semibold text-[#1C1917]">{calculateAge(p.dob) || p.age} yrs</span>
                        <span className="block text-[11px] text-[#78716C]">{p.dob || '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-[#44403C]">{cityOnly}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => triggerQuickPhotoSelect(p, e)}
                            className="p-1.5 rounded-lg border border-[#E5DEC9] bg-white hover:bg-[#14362B] text-[#57534E] hover:text-white transition-colors"
                            title="Upload Profile Photo"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLocateInTree(p);
                            }}
                            className="p-1.5 rounded-lg border border-[#E5DEC9] bg-white hover:bg-[#B47B2B] text-[#57534E] hover:text-white transition-colors"
                            title="Locate in Tree"
                          >
                            <Crosshair className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditPerson(p);
                            }}
                            className="p-1.5 rounded-lg border border-[#E5DEC9] bg-white hover:bg-[#14362B] text-[#57534E] hover:text-white transition-colors"
                            title="Edit Profile"
                          >
                            <PenSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPerson(p);
                            }}
                            className="p-1.5 rounded-lg bg-[#14362B] hover:bg-[#0D261E] text-white transition-colors"
                            title="View Full Profile"
                          >
                            <IdCard className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
