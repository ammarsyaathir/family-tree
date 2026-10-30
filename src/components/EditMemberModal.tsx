import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Camera,
  Trash2,
  Check,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import {
  FamilyMember,
  BranchType,
  GenderType,
  DEFAULT_HOUSEHOLDS,
} from '../types/family';
import {
  getCleanInitials,
  dobToIsoDate,
  isoDateToDisplayDob,
  cropImageToSquareDataUrl,
} from '../utils/familyUtils';

interface EditMemberModalProps {
  isOpen: boolean;
  isCreating: boolean;
  initialPerson: Partial<FamilyMember> | null;
  allPeople: FamilyMember[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (personData: Partial<FamilyMember>, isCreating: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const DEFAULT_CITIES = [
  'Bandar Saujana Putra, Selangor',
  'Seremban, Negeri Sembilan',
  'Rembau, Negeri Sembilan',
  'Shah Alam, Selangor',
  'Kuala Lumpur',
  'Putrajaya',
  'Kajang, Selangor',
];

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
  isOpen,
  isCreating,
  initialPerson,
  allPeople,
  isSaving,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<GenderType>('male');
  const [isoDob, setIsoDob] = useState('');
  const [dobDisplay, setDobDisplay] = useState('');
  const [age, setAge] = useState<number>(20);
  const [generation, setGeneration] = useState<number>(3);
  const [branch, setBranch] = useState<BranchType>('immediate');
  const [familyUnit, setFamilyUnit] = useState('core_ammar');
  const [familyLabel, setFamilyLabel] = useState('Keluarga Asas Ammar');
  const [city, setCity] = useState('Bandar Saujana Putra, Selangor');
  const [profession, setProfession] = useState('');
  const [bio, setBio] = useState('');
  const [fatherId, setFatherId] = useState<string>('');
  const [motherId, setMotherId] = useState<string>('');
  const [spouseIds, setSpouseIds] = useState<string[]>([]);
  const [childIds, setChildIds] = useState<string[]>([]);
  const [isInLaw, setIsInLaw] = useState(false);
  const [avatar, setAvatar] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedSpouseToAdd, setSelectedSpouseToAdd] = useState('');
  const [selectedChildToAdd, setSelectedChildToAdd] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const households = useMemo(() => {
    const map = new Map<string, { id: string; label: string; branch: BranchType }>();
    DEFAULT_HOUSEHOLDS.forEach((h) => map.set(h.id, h));
    allPeople.forEach((p) => {
      if (p.familyUnit && !map.has(p.familyUnit)) {
        map.set(p.familyUnit, {
          id: p.familyUnit,
          label: p.familyLabel || p.familyUnit,
          branch: p.branch || 'immediate',
        });
      }
    });
    return Array.from(map.values());
  }, [allPeople]);

  useEffect(() => {
    if (!isOpen || !initialPerson) return;
    setName(initialPerson.name || '');
    setNickname(initialPerson.nickname || '');
    setGender(initialPerson.gender || 'male');
    const convertedIso = dobToIsoDate(initialPerson.dob);
    setIsoDob(convertedIso);
    setDobDisplay(initialPerson.dob || '');
    setAge(typeof initialPerson.age === 'number' ? initialPerson.age : 20);
    setGeneration(initialPerson.generation || 3);
    setBranch(initialPerson.branch || 'immediate');
    const uId = initialPerson.familyUnit || 'core_ammar';
    setFamilyUnit(uId);
    const matchedHousehold = households.find((h) => h.id === uId);
    setFamilyLabel(
      initialPerson.familyLabel || matchedHousehold?.label || 'Keluarga Asas Ammar'
    );
    setCity(initialPerson.city || 'Bandar Saujana Putra, Selangor');
    setProfession(initialPerson.profession || '');
    setBio(initialPerson.bio || '');
    setFatherId(initialPerson.fatherId || '');
    setMotherId(initialPerson.motherId || '');
    setSpouseIds((initialPerson.spouses || []).map((s) => s.id).filter(Boolean));
    setChildIds((initialPerson.children || []).filter(Boolean));
    setIsInLaw(Boolean(initialPerson.isInLaw));
    setAvatar(initialPerson.avatar || '');
    setConfirmDelete(false);
    setFormError(null);
    setSelectedSpouseToAdd('');
    setSelectedChildToAdd('');
  }, [isOpen, initialPerson, households]);

  if (!isOpen || !initialPerson) return null;

  const handleDobPickerChange = (newIso: string) => {
    setIsoDob(newIso);
    if (!newIso) {
      setDobDisplay('');
      return;
    }
    const { formattedDob, age: computedAge } = isoDateToDisplayDob(newIso);
    setDobDisplay(formattedDob);
    setAge(computedAge);
  };

  const handleHouseholdSelect = (uId: string) => {
    setFamilyUnit(uId);
    const found = households.find((h) => h.id === uId);
    if (found) {
      setFamilyLabel(found.label);
      setBranch(found.branch);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await cropImageToSquareDataUrl(file);
      setAvatar(dataUrl);
      setFormError(null);
    } catch (_) {
      setFormError('Could not process this image format. Please choose a JPG, PNG, or WebP file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter the family member’s full name.');
      return;
    }

    const payload: Partial<FamilyMember> = {
      ...initialPerson,
      name: name.trim(),
      nickname: nickname.trim() || name.trim().split(' ')[0],
      gender,
      dob: dobDisplay.trim(),
      age: Number(age) || 0,
      generation: Number(generation) || 3,
      branch,
      familyUnit: familyUnit.trim() || 'core_ammar',
      familyLabel: familyLabel.trim() || 'Keluarga',
      city: city.trim() || 'Malaysia',
      profession: profession.trim() || 'Family Member',
      bio: bio.trim(),
      fatherId: fatherId || null,
      motherId: motherId || null,
      spouses: spouseIds.map((id) => ({ id, status: 'married' })),
      children: childIds,
      isInLaw,
      avatar,
    };

    await onSave(payload, isCreating);
  };

  const otherPeople = allPeople
    .filter((p) => p.id !== initialPerson.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const maleCandidates = otherPeople.filter((p) => p.gender === 'male');
  const femaleCandidates = otherPeople.filter((p) => p.gender === 'female');

  const initials = getCleanInitials({ name: name || 'Member', nickname });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Sticky Modal Header */}
        <div className="px-5 py-4 bg-[#FBF9F5] border-b border-[#E5DEC9] flex items-center justify-between gap-4 shrink-0">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#14362B]">
              {isCreating ? 'New Archival Record' : 'Update Archival Record'}
            </span>
            <h3
              id="edit-modal-title"
              className="font-serif-display text-xl sm:text-2xl font-bold text-[#1C1917]"
            >
              {isCreating ? 'Add Family Member' : `Edit Profile: ${initialPerson.name}`}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#14362B] text-[#57534E] hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {formError && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Top Identity Strip: Avatar Photo + Full Name + Nickname + Gender */}
          <div className="p-4 rounded-2xl bg-[#FBF9F5] border border-[#E5DEC9] flex flex-col sm:flex-row items-center gap-5">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative group w-24 h-24 rounded-2xl border-2 border-[#D6CEBE] hover:border-[#14362B] bg-white flex items-center justify-center overflow-hidden shadow-2xs transition-all"
                title="Click to upload profile picture"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name || 'Avatar'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-serif-display text-2xl font-bold text-[#14362B]">
                    {initials}
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 h-7 bg-black/65 text-white text-[10px] font-medium flex items-center justify-center gap-1">
                  <Camera className="w-3 h-3" />
                  <span>Photo</span>
                </span>
              </button>

              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar('')}
                  className="text-[11px] text-[#9A3412] hover:underline font-medium inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            {/* Name, Nickname, Gender */}
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-7">
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Muhammad Ammar Syaathir Bin Abd Rahim"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                  Known As / Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Ammar / Along / Maksu"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                  Gender
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['male', 'female'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-colors ${
                        gender === g
                          ? 'bg-[#14362B] text-white border-[#14362B]'
                          : 'bg-white text-[#57534E] border-[#E5DEC9] hover:bg-[#F4EFE6]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={isoDob}
                  onChange={(e) => handleDobPickerChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-num bg-white border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                  Age (Years)
                </label>
                <input
                  type="number"
                  min={0}
                  max={130}
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 text-xs font-mono-num font-semibold bg-white border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
                />
              </div>
            </div>
          </div>

          {/* Lineage, Generation, Household & Vocation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                Generation Tier
              </label>
              <select
                value={generation}
                onChange={(e) => setGeneration(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2.5 text-xs font-medium bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
              >
                <option value={1}>Gen 1: Grandparents</option>
                <option value={2}>Gen 2: Parents / Uncles / Aunts</option>
                <option value={3}>Gen 3: Ammar / Siblings / Cousins</option>
                <option value={4}>Gen 4: Nieces / Nephews</option>
                <option value={5}>Gen 5: Grand-Nieces / Nephews</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                Lineage Branch
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value as BranchType)}
                className="w-full px-3 py-2.5 text-xs font-medium bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
              >
                <option value="immediate">Immediate Family</option>
                <option value="paternal">Paternal (Dad&apos;s Side)</option>
                <option value="maternal">Maternal (Mom&apos;s Side)</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                Household Unit
              </label>
              <select
                value={households.some((h) => h.id === familyUnit) ? familyUnit : '__custom__'}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setFamilyUnit(`unit_${Date.now().toString(36).slice(-4)}`);
                    setFamilyLabel('Keluarga Baru');
                  } else {
                    handleHouseholdSelect(e.target.value);
                  }
                }}
                className="w-full px-3 py-2.5 text-xs font-medium bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
              >
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
                <option value="__custom__">+ Create New Household...</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                Household Display Name
              </label>
              <input
                type="text"
                value={familyLabel}
                onChange={(e) => setFamilyLabel(e.target.value)}
                placeholder="e.g. Keluarga Asas Ammar"
                className="w-full px-3 py-2.5 text-xs bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                Residence City / State
              </label>
              <input
                type="text"
                list="malaysia-cities-list"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bandar Saujana Putra, Selangor"
                className="w-full px-3.5 py-2.5 text-xs bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
              />
              <datalist id="malaysia-cities-list">
                {DEFAULT_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                Profession / Vocation / Role
              </label>
              <input
                type="text"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="e.g. Software Engineer / University Student"
                className="w-full px-3.5 py-2.5 text-xs bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <label className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] cursor-pointer text-xs font-medium text-[#1C1917]">
                <input
                  type="checkbox"
                  checked={isInLaw}
                  onChange={(e) => setIsInLaw(e.target.checked)}
                  className="rounded accent-[#14362B]"
                />
                <span>In-Law</span>
              </label>
            </div>
          </div>

          {/* Family Relationships Section: Father, Mother, Spouses, Children */}
          <div className="p-4 rounded-2xl bg-[#FBF9F5] border border-[#E5DEC9] space-y-4">
            <div className="text-xs font-semibold text-[#14362B] uppercase tracking-wider">
              Genealogical Links (Auto-syncs Tree &amp; Relatives)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Father */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                  Father (Ayah)
                </label>
                <select
                  value={fatherId}
                  onChange={(e) => setFatherId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
                >
                  <option value="">— No Father Linked —</option>
                  {maleCandidates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.nickname || `Gen ${m.generation}`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mother */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                  Mother (Ibu)
                </label>
                <select
                  value={motherId}
                  onChange={(e) => setMotherId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
                >
                  <option value="">— No Mother Linked —</option>
                  {femaleCandidates.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.nickname || `Gen ${f.generation}`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Spouses */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                  Spouse(s)
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedSpouseToAdd}
                    onChange={(e) => setSelectedSpouseToAdd(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
                  >
                    <option value="">Select relative to link as spouse...</option>
                    {otherPeople
                      .filter((p) => !spouseIds.includes(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.nickname || p.id})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSpouseToAdd && !spouseIds.includes(selectedSpouseToAdd)) {
                        setSpouseIds((prev) => [...prev, selectedSpouseToAdd]);
                        setSelectedSpouseToAdd('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-[#14362B] text-white text-xs font-semibold hover:bg-[#0D261E] inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Link</span>
                  </button>
                </div>

                {spouseIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {spouseIds.map((sid) => {
                      const sp = allPeople.find((p) => p.id === sid);
                      return (
                        <span
                          key={sid}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E5DEC9] text-xs text-[#1C1917]"
                        >
                          <span>{sp ? sp.name : sid}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSpouseIds((prev) => prev.filter((item) => item !== sid))
                            }
                            className="text-[#9A3412] hover:text-red-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Children */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
                  Children ({childIds.length})
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedChildToAdd}
                    onChange={(e) => setSelectedChildToAdd(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
                  >
                    <option value="">Select relative to link as child...</option>
                    {otherPeople
                      .filter((p) => !childIds.includes(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.nickname || p.id})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedChildToAdd && !childIds.includes(selectedChildToAdd)) {
                        setChildIds((prev) => [...prev, selectedChildToAdd]);
                        setSelectedChildToAdd('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-[#14362B] text-white text-xs font-semibold hover:bg-[#0D261E] inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Link</span>
                  </button>
                </div>

                {childIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {childIds.map((cid) => {
                      const ch = allPeople.find((p) => p.id === cid);
                      return (
                        <span
                          key={cid}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E5DEC9] text-xs text-[#1C1917]"
                        >
                          <span>{ch ? ch.name : cid}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setChildIds((prev) => prev.filter((item) => item !== cid))
                            }
                            className="text-[#9A3412] hover:text-red-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Biography */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#57534E] mb-1">
              Biography &amp; Heritage Notes
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Record family memories, milestones, or biographical notes..."
              className="w-full px-3.5 py-2.5 text-xs bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#14362B]"
            />
          </div>

          {/* Sticky Footer inside Form */}
          <div className="pt-4 border-t border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3">
            {!isCreating && initialPerson.id ? (
              confirmDelete ? (
                <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-semibold text-[#991B1B]">
                    Confirm permanent removal?
                  </span>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => onDelete(initialPerson.id!)}
                    className="px-3 py-1 rounded-lg bg-[#991B1B] text-white text-xs font-semibold hover:bg-red-800"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E5DEC9] text-xs font-medium text-[#57534E]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#991B1B] text-[#991B1B] hover:text-white text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Member</span>
                </button>
              )
            ) : (
              <div className="text-xs text-[#78716C]">
                New member will be immediately added to the D1 database, JSON archive, and visual tree.
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#F4EFE6] text-xs font-semibold text-[#57534E] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#14362B] hover:bg-[#0D261E] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : isCreating ? 'Add Family Member' : 'Save Profile'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
