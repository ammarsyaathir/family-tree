import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserPlus,
  Download,
  Database,
  CheckCircle2,
  Info,
  AlertCircle,
  Menu,
  X,
} from 'lucide-react';
import { FamilyMember } from './types/family';
import { SEED_PEOPLE } from './data/seedPeople';
import { getRelationToAmmar } from './utils/familyUtils';
import { FamilyTreeCanvas } from './components/FamilyTreeCanvas';
import { MemberDirectory, DirectoryFilters } from './components/MemberDirectory';
import { HeritageStats } from './components/HeritageStats';
import { PersonProfileModal } from './components/PersonProfileModal';
import { EditMemberModal } from './components/EditMemberModal';
import { CloudflareD1Modal } from './components/CloudflareD1Modal';

interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'info' | 'warn';
}

const DEFAULT_FILTERS: DirectoryFilters = {
  search: '',
  familyUnit: 'all',
  branch: 'all',
  generation: 'all',
  gender: 'all',
  city: 'all',
  cohort: null,
  sortBy: 'default',
};

export default function App() {
  const [people, setPeople] = useState<FamilyMember[]>(SEED_PEOPLE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'tree' | 'directory' | 'stats'>('tree');
  const [treeLineage, setTreeLineage] = useState<'pedigree' | 'paternal' | 'maternal' | 'both'>(
    'pedigree'
  );
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DirectoryFilters>(DEFAULT_FILTERS);

  // Modals State
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<Partial<FamilyMember> | null>(null);
  const [isCreatingMember, setIsCreatingMember] = useState<boolean>(false);
  const [isSavingMember, setIsSavingMember] = useState<boolean>(false);
  const [isD1StudioOpen, setIsD1StudioOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (title: string, description: string, type: ToastMessage['type'] = 'success') => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { id, title, description, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2800);
    },
    []
  );

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch('/api/people', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('API request failed');
      const payload = await res.json();
      const rows = Array.isArray(payload) ? payload : payload.people || [];
      const mapped: FamilyMember[] = rows
        .filter((row: any) => row && (row.data || row.name))
        .map((row: any) => {
          const base = row.data ? row.data : row;
          return {
            ...base,
            id: row.id || base.id,
            _updatedAt: row.updated_at,
            _updatedBy: row.updated_by,
          };
        });
      if (mapped.length > 0) {
        setPeople(mapped);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Falling back to static JSON / seed dataset:', err);
    }

    try {
      const fallbackRes = await fetch('/data/people.json');
      if (fallbackRes.ok) {
        const json = await fallbackRes.json();
        if (Array.isArray(json.people) && json.people.length > 0) {
          setPeople(json.people);
        }
      }
    } catch (_) {
      // Seed people already loaded in state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  // Derived active person for Profile Modal (always reflects latest edits/photos!)
  const selectedPerson = useMemo(
    () => (selectedPersonId ? people.find((p) => p.id === selectedPersonId) || null : null),
    [people, selectedPersonId]
  );

  // Live Hero Metrics (dynamically updates whenever members are added, edited, or deleted!)
  const heroMetrics = useMemo(() => {
    const totalMembers = people.length;
    const households = new Set(people.map((p) => p.familyUnit || 'core_ammar')).size;
    const generations = new Set(people.map((p) => p.generation || 3)).size;
    const customPhotos = people.filter((p) => Boolean(p.avatar)).length;
    return { totalMembers, households, generations, customPhotos };
  }, [people]);

  const handleOpenCreateModal = (defaults?: Partial<FamilyMember>) => {
    const generatedId = `member_${Date.now().toString(36)}`;
    setIsCreatingMember(true);
    setEditingPerson({
      id: generatedId,
      name: '',
      age: 20,
      dob: '',
      gender: 'male',
      generation: 3,
      branch: 'immediate',
      familyUnit: 'core_ammar',
      familyLabel: 'Keluarga Asas Ammar',
      city: 'Bandar Saujana Putra',
      bio: '',
      fatherId: null,
      motherId: null,
      spouses: [],
      children: [],
      isInLaw: false,
      avatar: '',
      ...defaults,
    });
  };

  const handleAddChildToParent = (parent: FamilyMember) => {
    const spouseId = parent.spouses?.[0]?.id || null;
    const fatherId = parent.gender === 'male' ? parent.id : spouseId;
    const motherId = parent.gender === 'female' ? parent.id : spouseId;

    setSelectedPersonId(null);
    handleOpenCreateModal({
      generation: (parent.generation || 2) + 1,
      branch: parent.branch,
      familyUnit: parent.familyUnit || 'core_ammar',
      familyLabel: parent.familyLabel || 'Keluarga',
      city: parent.city ? parent.city.split(',')[0].trim() : 'Bandar Saujana Putra',
      fatherId,
      motherId,
      age: 1,
    });
  };

  const handleSaveMember = async (
    personData: Partial<FamilyMember>,
    creating: boolean,
    options?: { silent?: boolean }
  ): Promise<string | void> => {
    const silent = Boolean(options?.silent);
    if (!silent) setIsSavingMember(true);
    try {
      const cleanData = { ...personData };
      delete cleanData.nickname;
      delete cleanData.profession;
      delete cleanData._updatedAt;
      delete cleanData._updatedBy;

      const resolvedId =
        cleanData.id && cleanData.id !== 'undefined'
          ? String(cleanData.id)
          : `member_${Date.now().toString(36)}`;

      if (creating) {
        const fullMember: FamilyMember = {
          ...(cleanData as FamilyMember),
          id: resolvedId,
        };
        const res = await fetch('/api/people', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: resolvedId,
            data: fullMember,
            updated_by: 'archivist',
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        await fetchPeople();
        if (!silent) {
          setEditingPerson(null);
          setIsCreatingMember(false);
          showToast(
            'Member Added',
            `${fullMember.name} saved to the archive.`,
            'success'
          );
        } else {
          setEditingPerson((prev) => (prev ? { ...prev, id: resolvedId } : prev));
          setIsCreatingMember(false);
        }
        return resolvedId;
      } else {
        const res = await fetch(`/api/people/${encodeURIComponent(resolvedId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: resolvedId,
            data: { ...cleanData, id: resolvedId },
            updated_by: 'archivist',
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        await fetchPeople();
        if (!silent) {
          setEditingPerson(null);
          showToast(
            'Profile Saved',
            `Changes to ${personData.name} saved to Cloudflare D1 & JSON archive.`,
            'success'
          );
        }
        return resolvedId;
      }
    } catch (err: any) {
      console.error('Save error:', err);
      if (!silent) {
        showToast('Save Error', err.message || 'Could not save member.', 'warn');
      }
      throw err;
    } finally {
      if (!silent) setIsSavingMember(false);
    }
  };

  const handleQuickAvatarUpdate = async (
    person: FamilyMember,
    avatarDataUrl: string
  ) => {
    try {
      const updated: FamilyMember = { ...person, avatar: avatarDataUrl };
      delete updated.nickname;
      delete updated.profession;
      delete updated._updatedAt;
      delete updated._updatedBy;

      const res = await fetch(`/api/people/${encodeURIComponent(person.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: updated,
          updated_by: 'photo_uploader',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchPeople();
      showToast(
        avatarDataUrl ? 'Portrait Updated' : 'Portrait Removed',
        avatarDataUrl
          ? `New square portrait saved for ${person.name}.`
          : `Portrait cleared for ${person.name}.`,
        'success'
      );
    } catch (err: any) {
      showToast('Photo Update Failed', err.message || 'Could not update photo.', 'warn');
    }
  };

  const handleDeleteMember = async (id: string) => {
    const target = people.find((p) => p.id === id);
    if (!target) return;
    setIsSavingMember(true);
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchPeople();
      setEditingPerson(null);
      if (selectedPersonId === id) setSelectedPersonId(null);
      showToast(
        'Member Removed',
        `${target.name} removed (Total now: ${Math.max(0, people.length - 1)} members).`,
        'info'
      );
    } catch (err: any) {
      showToast('Delete Failed', err.message || 'Could not delete member.', 'warn');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleLocateInTree = (person: FamilyMember) => {
    if (person.branch === 'maternal') {
      setTreeLineage('maternal');
    } else if (person.branch === 'paternal') {
      setTreeLineage('paternal');
    } else {
      setTreeLineage('pedigree');
    }
    setSpotlightId(person.id);
    setActiveTab('tree');
    showToast(
      'Located on Family Tree',
      `Highlighting ${person.name} in the ${person.branch} lineage tree.`,
      'info'
    );
  };

  const handleCopySummary = async (p: FamilyMember) => {
    const rel = getRelationToAmmar(p, people);
    const cityOnly = p.city ? p.city.split(',')[0].trim() : 'Bandar Saujana Putra';
    const summary = `${p.name}\nRelation to Ammar: ${rel.text}\nGeneration: Gen ${p.generation} · ${p.branch.toUpperCase()} Lineage\nAge: ${p.age} yrs (DOB: ${p.dob || 'Unrecorded'})\nCity: ${cityOnly}`;
    try {
      await navigator.clipboard.writeText(summary);
      showToast('Copied to Clipboard', `Summary for ${p.name} copied.`, 'success');
    } catch (_) {
      showToast('Profile Summary', `${p.name} · ${rel.text}`, 'info');
    }
  };

  const handleExportJson = () => {
    const cleanPeople = people.map((p) => {
      const copy = { ...p, city: p.city ? p.city.split(',')[0].trim() : 'Bandar Saujana Putra' };
      delete copy.nickname;
      delete copy.profession;
      delete copy._updatedAt;
      delete copy._updatedBy;
      return copy;
    });

    const dataset = {
      title: 'Ammar Syaathir Family Heritage Tree (Updated)',
      meta: {
        course: 'ITT588 - Front-End Technology (Lab Work 4)',
        student: 'Muhammad Ammar Syaathir Bin Abd Rahim',
        studentId: '2025179251',
        group: 'CS2666B',
        exportedAt: new Date().toISOString(),
        totalMembers: cleanPeople.length,
      },
      people: cleanPeople,
    };

    const blob = new Blob([JSON.stringify(dataset, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'people.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(
      'JSON Archive Exported',
      `Downloaded people.json with ${cleanPeople.length} family profiles.`,
      'info'
    );
  };

  const handleImportJson = async (importedList: any[]) => {
    const res = await fetch('/api/people/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ people: importedList }),
    });
    if (!res.ok) throw new Error(await res.text());
    await fetchPeople();
    showToast(
      'JSON Archive Imported',
      `Database updated with ${importedList.length} family profiles.`,
      'success'
    );
  };

  const handleResetToSeed = async () => {
    const res = await fetch('/api/people/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    if (!res.ok) throw new Error(await res.text());
    await fetchPeople();
    showToast(
      'Archive Restored',
      'Restored original 64 documented family members.',
      'info'
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#FBF9F5]/95 backdrop-blur-md border-b border-[#E5DEC9]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('tree');
            }}
            className="font-serif-display text-xl sm:text-2xl font-bold tracking-tight text-[#14362B] whitespace-nowrap shrink-0"
          >
            Ammar Syaathir Heritage
          </a>

          {/* Zone 2: 4 Single-line Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E]"
            aria-label="Primary Navigation"
          >
            <button
              type="button"
              onClick={() => setActiveTab('tree')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'tree'
                  ? 'border-[#14362B] text-[#14362B] font-semibold'
                  : 'border-transparent hover:text-[#1C1917]'
              }`}
            >
              Family Tree
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'directory'
                  ? 'border-[#14362B] text-[#14362B] font-semibold'
                  : 'border-transparent hover:text-[#1C1917]'
              }`}
            >
              Directory ({people.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'stats'
                  ? 'border-[#14362B] text-[#14362B] font-semibold'
                  : 'border-transparent hover:text-[#1C1917]'
              }`}
            >
              Heritage Stats
            </button>
            <button
              type="button"
              onClick={() => setIsD1StudioOpen(true)}
              className="py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 border-transparent hover:text-[#1C1917]"
            >
              D1 &amp; JSON Studio
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action + Mobile Menu Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#14362B] hover:bg-[#0D261E] rounded-xl transition-colors whitespace-nowrap shrink-0 shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-xl border border-[#E5DEC9] bg-white text-[#1C1917]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E5DEC9] bg-[#FBF9F5] px-4 py-3 flex flex-wrap gap-2">
            {(
              [
                { id: 'tree', label: 'Family Tree' },
                { id: 'directory', label: `Directory (${people.length})` },
                { id: 'stats', label: 'Heritage Stats' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#14362B] text-white'
                    : 'bg-white border border-[#E5DEC9] text-[#57534E]'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setIsD1StudioOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full py-2 px-3 rounded-xl bg-white border border-[#E5DEC9] text-xs font-semibold text-[#14362B]"
            >
              Cloudflare D1 &amp; JSON Studio
            </button>
          </div>
        )}
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Archival Exhibition Hero Banner */}
        <section className="rounded-3xl bg-[#14362B] text-[#FBF9F5] p-6 sm:p-10 shadow-md border border-[#1E4D3E]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8 space-y-3">
              <div className="text-xs uppercase tracking-widest text-[#D6CEBE] font-medium">
                Generational Lineage &amp; Living Family Archive · Cloudflare D1 Edition
              </div>
              <h1 className="font-serif-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.12] max-w-2xl">
                Every generation carries a living story.
              </h1>
              <p className="text-sm sm:text-base text-[#E5DEC9] max-w-2xl leading-relaxed">
                Explore, edit, and expand our family connections across{' '}
                <strong className="font-mono-num text-white">{heroMetrics.generations}</strong>{' '}
                generations and{' '}
                <strong className="font-mono-num text-white">{heroMetrics.households}</strong>{' '}
                households. Add or remove members, customize individual portraits, and synchronize directly with Cloudflare D1 and JSON storage.
              </p>

              {/* Quick Utility Actions inside Hero */}
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#B47B2B] hover:bg-[#9A631A] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Family Member</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export people.json</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsD1StudioOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>D1 Database &amp; Import</span>
                </button>
              </div>
            </div>

            {/* Right Column: Live Dynamic Counters & Academic Attribution */}
            <div className="lg:col-span-4 flex flex-col justify-between gap-4 p-5 rounded-2xl bg-white/8 border border-white/15 backdrop-blur-xs">
              <div className="grid grid-cols-3 gap-3 pb-4 border-b border-white/15">
                <div>
                  <div className="font-mono-num text-2xl sm:text-3xl font-bold text-[#F5D98F]">
                    {heroMetrics.totalMembers}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[#D6CEBE] mt-0.5">
                    Members
                  </div>
                </div>
                <div>
                  <div className="font-mono-num text-2xl sm:text-3xl font-bold text-[#F5D98F]">
                    {heroMetrics.households}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[#D6CEBE] mt-0.5">
                    Households
                  </div>
                </div>
                <div>
                  <div className="font-mono-num text-2xl sm:text-3xl font-bold text-[#F5D98F]">
                    {heroMetrics.generations}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[#D6CEBE] mt-0.5">
                    Generations
                  </div>
                </div>
              </div>

              <div className="text-xs text-[#E5DEC9] space-y-0.5">
                <div className="text-[10px] uppercase tracking-widest text-[#F5D98F] font-semibold">
                  Academic Project · ITT588 Lab Work 4
                </div>
                <div className="font-semibold text-white text-sm">
                  Muhammad Ammar Syaathir Bin Abd Rahim
                </div>
                <div className="font-mono-num text-[11px] text-[#D6CEBE]">
                  Student ID: 2025179251 · Group: CS2666B
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Active Workspace Pane */}
        {isLoading ? (
          <div className="bg-white border border-[#E5DEC9] rounded-2xl p-12 text-center text-sm text-[#57534E]">
            Loading family heritage archive...
          </div>
        ) : activeTab === 'tree' ? (
          <FamilyTreeCanvas
            people={people}
            lineage={treeLineage}
            onChangeLineage={setTreeLineage}
            spotlightId={spotlightId}
            onClearSpotlight={() => setSpotlightId(null)}
            onSelectPerson={(person) => setSelectedPersonId(person.id)}
            onEditPerson={(person) => {
              setIsCreatingMember(false);
              setEditingPerson(person);
            }}
            onAddChildToParent={handleAddChildToParent}
          />
        ) : activeTab === 'directory' ? (
          <MemberDirectory
            people={people}
            filters={filters}
            onChangeFilters={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onResetFilters={() => setFilters(DEFAULT_FILTERS)}
            onSelectPerson={(person) => setSelectedPersonId(person.id)}
            onEditPerson={(person) => {
              setIsCreatingMember(false);
              setEditingPerson(person);
            }}
            onLocateInTree={handleLocateInTree}
            onCopySummary={handleCopySummary}
            onQuickAvatarUpdate={handleQuickAvatarUpdate}
            onAddMemberToHousehold={(familyUnit, familyLabel, branch) =>
              handleOpenCreateModal({
                familyUnit,
                familyLabel,
                branch,
                generation: 3,
              })
            }
          />
        ) : (
          <HeritageStats
            people={people}
            onFilterAndNavigate={(filterPatch) => {
              setFilters({ ...DEFAULT_FILTERS, ...filterPatch });
              setActiveTab('directory');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectPerson={(person) => setSelectedPersonId(person.id)}
          />
        )}
      </main>

      {/* Interactive Person Profile Modal */}
      <PersonProfileModal
        person={selectedPerson}
        allPeople={people}
        onClose={() => setSelectedPersonId(null)}
        onSelectPerson={(person) => setSelectedPersonId(person.id)}
        onEditPerson={(person) => {
          setIsCreatingMember(false);
          setEditingPerson(person);
        }}
        onLocateInTree={handleLocateInTree}
        onCopySummary={handleCopySummary}
        onAddChildToParent={handleAddChildToParent}
        onQuickAvatarUpdate={handleQuickAvatarUpdate}
      />

      {/* Add / Edit Member Modal */}
      <EditMemberModal
        isOpen={Boolean(editingPerson)}
        isCreating={isCreatingMember}
        initialPerson={editingPerson}
        allPeople={people}
        isSaving={isSavingMember}
        onClose={() => {
          setEditingPerson(null);
          setIsCreatingMember(false);
        }}
        onSave={handleSaveMember}
        onDelete={handleDeleteMember}
      />

      {/* Cloudflare D1 & JSON Studio Modal */}
      <CloudflareD1Modal
        isOpen={isD1StudioOpen}
        people={people}
        onClose={() => setIsD1StudioOpen(false)}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onResetToSeed={handleResetToSeed}
      />

      {/* Toast Notification Stack */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#E5DEC9] shadow-lg"
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#14362B] shrink-0 mt-0.5" />
            ) : t.type === 'warn' ? (
              <AlertCircle className="w-5 h-5 text-[#9A3412] shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-[#1E4E5F] shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[#1C1917]">{t.title}</div>
              <div className="text-xs text-[#57534E] mt-0.5">{t.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quiet Archival Footer */}
      <footer className="border-t border-[#E5DEC9] bg-[#F4EFE6]/60 mt-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[#57534E]">
          <span>
            © 2026 Muhammad Ammar Syaathir Bin Abd Rahim (2025179251 · CS2666B) · ITT588 Lab Work 4
          </span>
          <span>
            Faculty of Computer &amp; Mathematical Sciences, UiTM · Lecturer: Sir Shahadan Saad
          </span>
        </div>
      </footer>
    </div>
  );
}
