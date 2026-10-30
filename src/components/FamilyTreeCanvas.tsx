import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Heart,
  Plus,
  Minus,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { FamilyMember, BranchType } from '../types/family';
import {
  getCleanInitials,
  getRelationToAmmar,
  getDynamicChildrenForCouple,
  getShortFirstName,
  calculateAge,
} from '../utils/familyUtils';

interface FamilyTreeCanvasProps {
  people: FamilyMember[];
  lineage: 'pedigree' | 'paternal' | 'maternal' | 'both';
  onChangeLineage: (lineage: 'pedigree' | 'paternal' | 'maternal' | 'both') => void;
  spotlightId: string | null;
  onClearSpotlight: () => void;
  onSelectPerson: (person: FamilyMember) => void;
  onEditPerson: (person: FamilyMember) => void;
  onAddChildToParent: (parent: FamilyMember) => void;
}

export const FamilyTreeCanvas: React.FC<FamilyTreeCanvasProps> = ({
  people,
  lineage,
  onChangeLineage,
  spotlightId,
  onClearSpotlight,
  onSelectPerson,
  onAddChildToParent,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(spotlightId);
  const viewportRef = useRef<HTMLDivElement>(null);

  const byId = React.useMemo(() => {
    const map = new Map<string, FamilyMember>();
    people.forEach((p) => map.set(p.id, p));
    return map;
  }, [people]);

  useEffect(() => {
    if (spotlightId) {
      setActiveHighlightId(spotlightId);
      setCollapsedBranches({});
      setTimeout(() => {
        const el = document.querySelector(`[data-tree-node-id="${spotlightId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }, 150);
    }
  }, [spotlightId, lineage]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    const term = val.trim().toLowerCase();
    if (!term) {
      setActiveHighlightId(null);
      if (spotlightId) onClearSpotlight();
      return;
    }

    const found = people.find(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.city && p.city.toLowerCase().includes(term))
    );

    if (found) {
      setActiveHighlightId(found.id);
      setCollapsedBranches({});
      setTimeout(() => {
        const el = document.querySelector(`[data-tree-node-id="${found.id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }, 100);
    }
  };

  const toggleBranch = (branchKey: string) => {
    setCollapsedBranches((prev) => ({
      ...prev,
      [branchKey]: !prev[branchKey],
    }));
  };

  const expandAll = () => setCollapsedBranches({});

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    people.forEach((p) => {
      next[`branch_${p.id}`] = true;
    });
    setCollapsedBranches(next);
  };

  const getBranchAccent = (branch: BranchType, isMe: boolean) => {
    if (isMe) return 'border-[#B47B2B] bg-[#FFFDF9] ring-2 ring-[#B47B2B]/25';
    if (branch === 'paternal') return 'border-[#9A3412]/25 hover:border-[#9A3412] bg-white';
    if (branch === 'maternal') return 'border-[#1E4E5F]/25 hover:border-[#1E4E5F] bg-white';
    return 'border-[#B47B2B]/35 hover:border-[#B47B2B] bg-white';
  };

  const getAvatarColors = (person: FamilyMember, isMe: boolean) => {
    if (isMe) return 'bg-[#FEF6E6] text-[#9A631A] border-[#B47B2B]';
    if (person.gender === 'male') return 'bg-[#EBF3F9] text-[#1E4E5F] border-[#1E4E5F]/20';
    return 'bg-[#F9EFEF] text-[#9A3412] border-[#9A3412]/20';
  };

  const renderMemberCard = (
    person: FamilyMember | undefined,
    customRoleLabel?: string,
    options?: {
      hasTopConnector?: boolean;
      hasBottomConnector?: boolean;
    }
  ) => {
    if (!person) return null;
    const isMe = person.id === 'c_ammar';
    const isSpotlight = activeHighlightId === person.id;
    const initials = getCleanInitials(person);
    const rel = getRelationToAmmar(person, people);
    const roleLabel = customRoleLabel || rel.text;

    return (
      <div
        key={person.id}
        data-tree-node-id={person.id}
        onClick={() => onSelectPerson(person)}
        className={`group relative flex flex-col items-center text-center w-[148px] p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer select-none shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${getBranchAccent(
          person.branch,
          isMe
        )} ${
          isSpotlight
            ? 'ring-3 ring-[#14362B] border-[#14362B] bg-[#F2F7F5] scale-105 z-10'
            : ''
        }`}
      >
        {/* Top Connector Anchor Pip - Physically touches the incoming parent drop line */}
        {options?.hasTopConnector && (
          <span
            className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#5C4033] border-2 border-white shadow-2xs z-20 pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Bottom Connector Anchor Pip - Physically touches the outgoing children descent line */}
        {options?.hasBottomConnector && (
          <span
            className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#5C4033] border-2 border-white shadow-2xs z-20 pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Quick Add Child button on hover */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddChildToParent(person);
          }}
          title={`Add child to ${person.name}`}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-2 right-2 w-6 h-6 rounded-md bg-[#F4EFE6] hover:bg-[#14362B] text-[#57534E] hover:text-white flex items-center justify-center transition-all text-xs z-10"
        >
          <UserPlus className="w-3.5 h-3.5" />
        </button>

        {/* Square-rounded Archival Avatar */}
        <div
          className={`relative w-16 h-16 rounded-xl border flex items-center justify-center font-semibold text-lg overflow-hidden shadow-2xs transition-transform group-hover:scale-103 ${getAvatarColors(
            person,
            isMe
          )}`}
        >
          {person.avatar ? (
            <img
              src={person.avatar}
              alt={person.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="tracking-tight font-serif-display text-xl font-bold">{initials}</span>
          )}
        </div>

        {/* Role & Name */}
        <div className="mt-2 text-[10px] font-medium text-[#78716C] tracking-wide truncate max-w-full">
          {isMe ? 'Archivist · Me' : roleLabel}
        </div>
        <div
          className="mt-0.5 text-xs font-bold text-[#1C1917] tracking-wider uppercase leading-snug truncate max-w-full"
          title={person.name}
        >
          {getShortFirstName(person.name)}
        </div>

        {/* Unboxed metadata with middle dot separator */}
        <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-[#78716C] font-mono-num">
          <span>Gen {person.generation}</span>
          <span aria-hidden="true">·</span>
          <span>{person.dob ? `${calculateAge(person.dob)}y` : (typeof person.age === 'number' ? `${person.age}y` : '—')}</span>
        </div>
      </div>
    );
  };

  /**
   * Recursive family branch renderer:
   * Given a primary person, automatically finds their spouse(s) and all children dynamically!
   * Every line physically connects to the cards without floating gaps.
   */
  const renderDynamicBranch = (
    primaryPerson: FamilyMember,
    visitedIds: Set<string>,
    depth = 0,
    customOption?: {
      excludeChildId?: string;
      highlightBox?: boolean;
      hasParentAbove?: boolean;
    }
  ): React.ReactNode => {
    if (!primaryPerson || visitedIds.has(primaryPerson.id) || depth > 6) return null;
    visitedIds.add(primaryPerson.id);

    const spouses = (primaryPerson.spouses || [])
      .map((s) => byId.get(s.id))
      .filter((s): s is FamilyMember => Boolean(s));

    spouses.forEach((s) => visitedIds.add(s.id));

    const allChildren = getDynamicChildrenForCouple(primaryPerson, spouses, people).filter(
      (c) => c.id !== customOption?.excludeChildId && !visitedIds.has(c.id)
    );

    const branchKey = `branch_${primaryPerson.id}`;
    const isCollapsed = Boolean(collapsedBranches[branchKey]);
    const isCoreCouple =
      primaryPerson.id === 'd_dad' ||
      primaryPerson.id === 'm_shafrah' ||
      customOption?.highlightBox;
    const hasParentAbove = Boolean(customOption?.hasParentAbove);
    const hasSpouse = spouses.length > 0;

    return (
      <div key={primaryPerson.id} className="flex flex-col items-center relative">
        {/* Couple or Single Parent Row - Flush zero-gap connection between cards and marriage line */}
        <div
          className={`flex items-center justify-center relative rounded-2xl ${
            isCoreCouple
              ? 'p-2 bg-[#FDFBF7] border-2 border-[#B47B2B] shadow-sm'
              : 'p-0'
          }`}
        >
          {/* Primary Person Card (Direct Blood Descendant) */}
          <div className="relative shrink-0">
            {/* Direct vertical line rising 36px from card top border up to the horizontal sibling crossbar */}
            {hasParentAbove && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-[2.5px] h-9 bg-[#5C4033] z-10 pointer-events-none" />
            )}
            {renderMemberCard(primaryPerson, undefined, {
              hasTopConnector: hasParentAbove,
              hasBottomConnector: allChildren.length > 0 && !hasSpouse,
            })}
          </div>

          {/* Continuous marriage line spanning horizontally and touching both cards flush */}
          {spouses.map((spouse) => (
            <React.Fragment key={spouse.id}>
              <div className="relative flex items-center justify-center shrink-0 w-12 h-[2.5px] bg-[#5C4033] z-10">
                <span className="w-5 h-5 rounded-full bg-white border-2 border-[#5C4033] flex items-center justify-center text-[#9A3412] shadow-2xs shrink-0 relative z-20">
                  <Heart className="w-2.5 h-2.5 fill-current" />
                </span>
                {/* Outgoing vertical line dropping from heart badge down between the couple */}
                {allChildren.length > 0 && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[2.5px] h-20 bg-[#5C4033] pointer-events-none z-10" />
                )}
              </div>
              <div className="relative shrink-0">
                {renderMemberCard(spouse, undefined, {
                  hasTopConnector: false,
                  hasBottomConnector: false,
                })}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Children Connector & Toggle */}
        {allChildren.length > 0 && (
          <>
            <div className="flex flex-col items-center relative z-10">
              {/* Vertical line connecting from bottom of card/couple directly into toggle button */}
              <div className="w-[2.5px] h-6 bg-[#5C4033]" />
              <button
                type="button"
                onClick={() => toggleBranch(branchKey)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border-2 text-[11px] font-bold transition-all shadow-xs font-mono-num whitespace-nowrap ${
                  isCollapsed
                    ? 'bg-[#F4EFE6] border-[#5C4033]/60 text-[#57534E] hover:bg-[#14362B] hover:text-white hover:border-[#14362B]'
                    : isCoreCouple
                    ? 'bg-[#FEF6E6] border-[#B47B2B] text-[#784F14] hover:bg-[#B47B2B] hover:text-white'
                    : 'bg-white border-[#5C4033] text-[#1C1917] hover:bg-[#14362B] hover:text-white'
                }`}
              >
                {isCollapsed ? (
                  <Plus className="w-3.5 h-3.5 text-[#9A3412]" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-[#14362B]" />
                )}
                <span>
                  {allChildren.length} {allChildren.length === 1 ? 'Child' : 'Children'}
                </span>
              </button>
              {/* Connector line dropping 36px directly into the horizontal sibling crossbar */}
              {!isCollapsed && <div className="w-[2.5px] h-9 bg-[#5C4033]" />}
            </div>

            {!isCollapsed && (
              <div className="tree-children-row">
                {allChildren.map((child, index) => {
                  const isFirst = index === 0;
                  const isLast = index === allChildren.length - 1;
                  const isOnly = allChildren.length === 1;

                  return (
                    <div
                      key={child.id}
                      className={`tree-child-branch ${isFirst ? 'is-first' : ''} ${isLast ? 'is-last' : ''} ${isOnly ? 'is-only' : ''}`}
                    >
                      {renderDynamicBranch(child, visitedIds, depth + 1, {
                        hasParentAbove: true,
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  /**
   * Renders any unlinked / newly added root members for a given branch so that
   * even if someone adds a new Gen 1 ancestor or standalone household, they appear on the tree!
   */
  const renderUnvisitedRoots = (visitedIds: Set<string>, filterBranch?: BranchType) => {
    const unvisitedRoots = people.filter((p) => {
      if (visitedIds.has(p.id)) return false;
      if (p.isInLaw) return false;
      if (filterBranch && p.branch !== filterBranch) return false;
      // Only pick top-most unvisited nodes (no parent or parent already visited)
      const hasUnvisitedParent =
        (p.fatherId && !visitedIds.has(p.fatherId) && byId.has(p.fatherId)) ||
        (p.motherId && !visitedIds.has(p.motherId) && byId.has(p.motherId));
      return !hasUnvisitedParent;
    });

    if (unvisitedRoots.length === 0) return null;

    return (
      <div className="mt-12 pt-8 border-t-2 border-dashed border-[#5C4033]/30 flex flex-col items-center w-max min-w-full">
        <div className="text-xs uppercase tracking-widest font-bold text-[#78716C] mb-4 px-3 py-1 bg-white border border-[#E5DEC9] rounded-full">
          Additional Documented Family Branches ({unvisitedRoots.length})
        </div>
        <div className="flex flex-row flex-nowrap justify-center gap-10">
          {unvisitedRoots.map((rootPerson) =>
            renderDynamicBranch(rootPerson, visitedIds, 0)
          )}
        </div>
      </div>
    );
  };

  const renderPedigreeView = () => {
    const visited = new Set<string>();
    const isa = byId.get('p_isa');
    const zaharah = byId.get('p_zaharah');
    const zain = byId.get('m_zain');
    const noraini = byId.get('m_noraini');
    const dad = byId.get('d_dad');
    const mom = byId.get('m_shafrah');

    if (isa) visited.add(isa.id);
    if (zaharah) visited.add(zaharah.id);
    if (zain) visited.add(zain.id);
    if (noraini) visited.add(noraini.id);

    return (
      <div className="flex flex-col items-center w-max min-w-full">
        {/* Grandparents Row (Strictly horizontal side-by-side) */}
        <div className="flex flex-row flex-nowrap justify-center gap-20 lg:gap-32 items-start">
          {/* Paternal Grandparents (Dad's Parents: Isa & Zaharah) */}
          {isa && (
            <div className="flex flex-col items-center">
              <div className="text-[11px] font-bold text-[#9A3412] uppercase tracking-wider mb-2">
                Paternal Grandparents (Dad&apos;s Side)
              </div>
              <div className="flex items-center justify-center relative">
                <div className="relative shrink-0">
                  {renderMemberCard(isa, 'Grandfather', {
                    hasTopConnector: false,
                    hasBottomConnector: true,
                  })}
                </div>
                {zaharah && (
                  <>
                    <div className="relative flex items-center justify-center shrink-0 w-12 h-[2.5px] bg-[#5C4033] z-10">
                      <span className="w-5 h-5 rounded-full bg-white border-2 border-[#5C4033] flex items-center justify-center text-[#9A3412] shadow-2xs shrink-0 relative z-20">
                        <Heart className="w-2.5 h-2.5 fill-current" />
                      </span>
                    </div>
                    <div className="relative shrink-0">
                      {renderMemberCard(zaharah, 'Grandmother', {
                        hasTopConnector: false,
                        hasBottomConnector: false,
                      })}
                    </div>
                  </>
                )}
              </div>
              {/* Direct vertical line dropping straight from Isa down toward Dad */}
              <div className="w-[2.5px] h-12 bg-[#5C4033]" />
            </div>
          )}

          {/* Maternal Grandparents (Mom's Parents: Zain & Noraini) */}
          {zain && (
            <div className="flex flex-col items-center">
              <div className="text-[11px] font-bold text-[#1E4E5F] uppercase tracking-wider mb-2">
                Maternal Grandparents (Mom&apos;s Side)
              </div>
              <div className="flex items-center justify-center relative">
                <div className="relative shrink-0">
                  {renderMemberCard(zain, 'Grandfather', {
                    hasTopConnector: false,
                    hasBottomConnector: true,
                  })}
                </div>
                {noraini && (
                  <>
                    <div className="relative flex items-center justify-center shrink-0 w-12 h-[2.5px] bg-[#5C4033] z-10">
                      <span className="w-5 h-5 rounded-full bg-white border-2 border-[#5C4033] flex items-center justify-center text-[#1E4E5F] shadow-2xs shrink-0 relative z-20">
                        <Heart className="w-2.5 h-2.5 fill-current" />
                      </span>
                    </div>
                    <div className="relative shrink-0">
                      {renderMemberCard(noraini, 'Grandmother', {
                        hasTopConnector: false,
                        hasBottomConnector: false,
                      })}
                    </div>
                  </>
                )}
              </div>
              {/* Direct vertical line dropping straight from Zain down toward Mom */}
              <div className="w-[2.5px] h-12 bg-[#5C4033]" />
            </div>
          )}
        </div>

        {/* Clear solid horizontal bridge connecting Grandparents down to Dad & Mom */}
        <div className="w-[calc(100%-148px)] max-w-2xl h-[2.5px] bg-[#5C4033]" />
        <div className="w-[2.5px] h-9 bg-[#5C4033]" />

        {/* Core Immediate Family (Dad & Mom -> 3rd Gen children: Along Asyraf, Aliah, Aqilah, Adilah, Ammar horizontally!) */}
        {dad
          ? renderDynamicBranch(dad, visited, 1, { highlightBox: true, hasParentAbove: true })
          : mom
          ? renderDynamicBranch(mom, visited, 1, { highlightBox: true, hasParentAbove: true })
          : null}

        {/* Any additional immediate family members */}
        {renderUnvisitedRoots(visited, 'immediate')}
      </div>
    );
  };

  const renderPaternalView = () => {
    const visited = new Set<string>();
    const isa = byId.get('p_isa');
    return (
      <div className="flex flex-col items-center w-max min-w-full">
        {isa && renderDynamicBranch(isa, visited, 0)}
        {renderUnvisitedRoots(visited, 'paternal')}
      </div>
    );
  };

  const renderMaternalView = () => {
    const visited = new Set<string>();
    const zain = byId.get('m_zain');
    return (
      <div className="flex flex-col items-center w-max min-w-full">
        {zain && renderDynamicBranch(zain, visited, 0)}
        {renderUnvisitedRoots(visited, 'maternal')}
      </div>
    );
  };

  const renderCombinedAllView = () => {
    const visited = new Set<string>();
    const isa = byId.get('p_isa');
    const zain = byId.get('m_zain');
    return (
      <div className="flex flex-col gap-16 items-center w-max min-w-full">
        <div className="flex flex-col items-center">
          <div className="text-xs uppercase tracking-widest font-bold text-[#9A3412] mb-3 px-4 py-1.5 rounded-full bg-[#9A3412]/10 border border-[#9A3412]/20">
            Paternal Lineage Archive (Dad&apos;s Side: Atok Isa &amp; Nenek Zaharah)
          </div>
          {isa && renderDynamicBranch(isa, visited, 0)}
        </div>

        <div className="w-full border-t-2 border-dashed border-[#5C4033]/30 pt-12 flex flex-col items-center">
          <div className="text-xs uppercase tracking-widest font-bold text-[#1E4E5F] mb-3 px-4 py-1.5 rounded-full bg-[#1E4E5F]/10 border border-[#1E4E5F]/20">
            Maternal Lineage Archive (Mom&apos;s Side: Atok Zain &amp; Nenek Noraini)
          </div>
          {zain &&
            renderDynamicBranch(zain, visited, 0, {
              excludeChildId: 'm_shafrah', // Core family already rendered in Paternal above
            })}
        </div>

        {renderUnvisitedRoots(visited)}
      </div>
    );
  };

  return (
    <section aria-label="Interactive Family Tree" className="space-y-4">
      {/* Control Toolbar */}
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Lineage Segmented Switcher */}
        <div
          className="flex flex-wrap items-center gap-1 p-1 bg-[#F4EFE6] rounded-xl w-full lg:w-auto"
          role="group"
          aria-label="Select lineage view"
        >
          {(
            [
              { id: 'pedigree', label: 'Direct Pedigree' },
              { id: 'paternal', label: "Dad's Side (Paternal)" },
              { id: 'maternal', label: "Mom's Side (Maternal)" },
              { id: 'both', label: `Complete Tree (${people.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeLineage(item.id)}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                lineage === item.id
                  ? 'bg-[#14362B] text-white shadow-2xs'
                  : 'text-[#57534E] hover:text-[#1C1917] hover:bg-white/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search & Spotlight Input */}
        <div className="relative flex-1 min-w-[210px] max-w-md">
          <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Locate any relative on the tree..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#14362B]"
          />
        </div>

        {/* Tree Expand / Collapse & Zoom Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={expandAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#F4EFE6] text-xs font-medium text-[#1C1917] transition-colors whitespace-nowrap"
            title="Expand all branches"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#14362B]" />
            <span className="hidden sm:inline">Expand</span>
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#F4EFE6] text-xs font-medium text-[#1C1917] transition-colors whitespace-nowrap"
            title="Collapse branches"
          >
            <Minimize2 className="w-3.5 h-3.5 text-[#57534E]" />
            <span className="hidden sm:inline">Collapse</span>
          </button>

          <div className="h-5 w-[1px] bg-[#E5DEC9] mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
            className="p-2 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#F4EFE6] text-[#1C1917] transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono-num font-semibold text-[#57534E] min-w-[44px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))}
            className="p-2 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#F4EFE6] text-[#1C1917] transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-2 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#F4EFE6] text-[#57534E] transition-colors"
            title="Reset zoom"
            aria-label="Reset zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Subheader Legend & Instructions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[#57534E]">
        <p className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#B47B2B] shrink-0" />
          <span>
            Click any family member to inspect their interactive profile, upload a custom portrait, or add children.
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#9A3412]" />
            Paternal (Dad&apos;s Side)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#1E4E5F]" />
            Maternal (Mom&apos;s Side)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#B47B2B]" />
            Immediate Core (Ammar)
          </span>
        </div>
      </div>

      {/* Scrollable & Zoomable Tree Viewport */}
      <div
        ref={viewportRef}
        className="archival-grid-bg border border-[#E5DEC9] rounded-2xl p-6 sm:p-10 overflow-auto min-h-[540px] max-h-[80vh] shadow-inner"
      >
        <div
          className="min-w-max mx-auto transition-transform duration-150 origin-top"
          style={{ transform: `scale(${zoom})` }}
        >
          {lineage === 'pedigree' && renderPedigreeView()}
          {lineage === 'paternal' && renderPaternalView()}
          {lineage === 'maternal' && renderMaternalView()}
          {lineage === 'both' && renderCombinedAllView()}
        </div>
      </div>
    </section>
  );
};
