import React, { useRef, useState } from 'react';
import {
  X,
  Camera,
  Trash2,
  Crosshair,
  PenSquare,
  Copy,
  UserPlus,
  ChevronRight,
  Calendar,
  MapPin,
  GitBranch,
  Heart,
  Users,
} from 'lucide-react';
import { FamilyMember } from '../types/family';
import {
  getCleanInitials,
  getRelationToAmmar,
  getGenealogySnippet,
  cropImageToSquareDataUrl,
  normalizeCityName,
  getShortFirstName,
} from '../utils/familyUtils';

interface PersonProfileModalProps {
  person: FamilyMember | null;
  allPeople: FamilyMember[];
  onClose: () => void;
  onSelectPerson: (person: FamilyMember) => void;
  onEditPerson: (person: FamilyMember) => void;
  onLocateInTree: (person: FamilyMember) => void;
  onCopySummary: (person: FamilyMember) => void;
  onAddChildToParent: (parent: FamilyMember) => void;
  onQuickAvatarUpdate: (person: FamilyMember, avatarDataUrl: string) => Promise<void>;
}

export const PersonProfileModal: React.FC<PersonProfileModalProps> = ({
  person,
  allPeople,
  onClose,
  onSelectPerson,
  onEditPerson,
  onLocateInTree,
  onCopySummary,
  onAddChildToParent,
  onQuickAvatarUpdate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!person) return null;

  const byId = new Map<string, FamilyMember>(allPeople.map((p) => [p.id, p]));
  const father = person.fatherId ? byId.get(person.fatherId) : undefined;
  const mother = person.motherId ? byId.get(person.motherId) : undefined;

  const spouses = (person.spouses || [])
    .map((s) => ({
      status: s.status || 'Married',
      member: byId.get(s.id),
    }))
    .filter((s): s is { status: string; member: FamilyMember } => Boolean(s.member));

  const children = allPeople
    .filter(
      (c) =>
        c.id !== person.id &&
        (c.fatherId === person.id ||
          c.motherId === person.id ||
          (person.children || []).includes(c.id))
    )
    .sort((a, b) => (b.age || 0) - (a.age || 0));

  const siblings = allPeople
    .filter(
      (s) =>
        s.id !== person.id &&
        ((person.fatherId && s.fatherId === person.fatherId) ||
          (person.motherId && s.motherId === person.motherId))
    )
    .sort((a, b) => (b.age || 0) - (a.age || 0));

  const initials = getCleanInitials(person);
  const rel = getRelationToAmmar(person, allPeople);
  const genealogy = getGenealogySnippet(person, allPeople);
  const isMe = person.id === 'c_ammar';
  const cityOnly = normalizeCityName(person.city);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const dataUrl = await cropImageToSquareDataUrl(file);
      await onQuickAvatarUpdate(person, dataUrl);
    } catch (err) {
      console.error('Avatar upload error:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploading(true);
    try {
      await onQuickAvatarUpdate(person, '');
    } finally {
      setIsUploading(false);
    }
  };

  const renderRelativeCard = (relMember: FamilyMember, relationshipTag: string) => {
    const relInitials = getCleanInitials(relMember);
    return (
      <button
        key={relMember.id}
        type="button"
        onClick={() => onSelectPerson(relMember)}
        className="flex items-center gap-3 p-3 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] hover:bg-[#F4EFE6] hover:border-[#14362B]/40 transition-all text-left w-full group"
      >
        <div
          className={`w-11 h-11 rounded-lg border flex items-center justify-center overflow-hidden shrink-0 font-serif-display font-bold text-sm ${
            relMember.gender === 'male'
              ? 'bg-[#EBF3F9] text-[#1E4E5F] border-[#1E4E5F]/20'
              : 'bg-[#F9EFEF] text-[#9A3412] border-[#9A3412]/20'
          }`}
        >
          {relMember.avatar ? (
            <img
              src={relMember.avatar}
              alt={relMember.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{relInitials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-[#78716C] font-semibold">
            {relationshipTag}
          </div>
          <div className="text-xs font-semibold text-[#1C1917] truncate group-hover:text-[#14362B]">
            {relMember.name}
          </div>
          <div className="text-[11px] text-[#57534E] font-mono-num">
            Gen {relMember.generation} · {relMember.age} yrs
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#78716C] group-hover:translate-x-0.5 transition-transform shrink-0" />
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-[#E5DEC9] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Sticky Top Header */}
        <div className="px-5 py-4 bg-[#FBF9F5] border-b border-[#E5DEC9] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#14362B]">
            <span>Archival Member Dossier</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-[#78716C]">ID: {person.id}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#14362B] text-[#57534E] hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close profile modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1">
          {/* Identity Banner */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-5 rounded-2xl bg-[#FBF9F5] border border-[#E5DEC9]">
            {/* Square-rounded Avatar with Direct Photo Upload */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative group">
                <div
                  className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 flex items-center justify-center overflow-hidden shadow-xs font-serif-display text-3xl font-bold ${
                    isMe
                      ? 'bg-[#FEF6E6] text-[#9A631A] border-[#B47B2B]'
                      : person.gender === 'male'
                      ? 'bg-[#EBF3F9] text-[#1E4E5F] border-[#1E4E5F]/25'
                      : 'bg-[#F9EFEF] text-[#9A3412] border-[#9A3412]/25'
                  }`}
                >
                  {person.avatar ? (
                    <img
                      src={person.avatar}
                      alt={person.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14362B] hover:bg-[#0D261E] text-white text-[11px] font-semibold transition-colors shadow-2xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>
                    {isUploading ? 'Saving...' : person.avatar ? 'Change Photo' : 'Upload Photo'}
                  </span>
                </button>

                {person.avatar && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="mt-1 w-full inline-flex items-center justify-center gap-1 text-[11px] text-[#9A3412] hover:underline font-medium"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove photo</span>
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
            </div>

            {/* Primary Details */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-[#57534E]">
                <span className="font-semibold text-[#14362B]">{rel.text}</span>
              </div>

              <h2
                id="profile-modal-title"
                className="mt-1 font-serif-display text-2xl sm:text-3xl font-bold text-[#1C1917] leading-tight"
              >
                {person.name}
              </h2>

              <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-[#78716C] font-mono-num">
                <span>Generation {person.generation}</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize font-sans">{person.branch} Lineage</span>
                <span aria-hidden="true">·</span>
                <span>{person.age} years old</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize font-sans">{person.gender}</span>
              </div>

              {person.bio && (
                <p className="mt-3 text-sm text-[#44403C] leading-relaxed italic">
                  &ldquo;{person.bio}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Vital Metrics Strip (Date of Birth & Age + City) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-[#E5DEC9] bg-white">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#78716C] font-semibold">
                <Calendar className="w-3.5 h-3.5 text-[#14362B]" />
                <span>Date of Birth &amp; Age</span>
              </div>
              <div className="mt-1.5 font-mono-num text-sm font-bold text-[#1C1917]">
                {person.dob || 'Date unrecorded'}
              </div>
              <div className="text-xs text-[#57534E] font-mono-num mt-0.5">
                {person.age} years old
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[#E5DEC9] bg-white">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#78716C] font-semibold">
                <MapPin className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>City</span>
              </div>
              <div className="mt-1.5 text-sm font-bold text-[#1C1917] truncate">
                {cityOnly}
              </div>
              <div className="text-xs text-[#57534E] mt-0.5">Documented city</div>
            </div>
          </div>

          {/* Lineage Summary Formula */}
          <div className="p-4 rounded-xl bg-[#F4EFE6]/70 border border-[#E5DEC9] flex items-center gap-3 text-xs">
            <GitBranch className="w-4 h-4 text-[#14362B] shrink-0" />
            <div>
              <span className="font-semibold text-[#1C1917]">Genealogical Summary: </span>
              <span className="text-[#44403C]">{genealogy}</span>
            </div>
          </div>

          {/* Interactive Kinship Network */}
          <div className="space-y-5">
            {/* Parents */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-[#78716C] font-semibold mb-2.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#14362B]" />
                <span>Parents</span>
              </h3>
              {father || mother ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {father && renderRelativeCard(father, 'Father')}
                  {mother && renderRelativeCard(mother, 'Mother')}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] text-xs text-[#57534E]">
                  Foundational Ancestor / Patriarch or Matriarch (Parents not recorded in archive)
                </div>
              )}
            </div>

            {/* Spouses */}
            {spouses.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-[#78716C] font-semibold mb-2.5 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Spouse / Life Partner</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {spouses.map((s) => renderRelativeCard(s.member, `Spouse (${s.status})`))}
                </div>
              </div>
            )}

            {/* Children */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs uppercase tracking-wider text-[#78716C] font-semibold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#B47B2B]" />
                  <span>Children ({children.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onAddChildToParent(person)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#14362B] hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Child to {getShortFirstName(person.name)}</span>
                </button>
              </div>
              {children.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {children.map((c) =>
                    renderRelativeCard(c, c.gender === 'male' ? 'Son' : 'Daughter')
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-[#E5DEC9] bg-[#FBF9F5] text-xs text-[#78716C]">
                  No children recorded for this member yet.
                </div>
              )}
            </div>

            {/* Siblings */}
            {siblings.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-[#78716C] font-semibold mb-2.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#1E4E5F]" />
                  <span>Siblings ({siblings.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {siblings.map((sib) =>
                    renderRelativeCard(sib, sib.gender === 'male' ? 'Brother' : 'Sister')
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="px-5 py-4 bg-[#FBF9F5] border-t border-[#E5DEC9] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLocateInTree(person);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4EFE6] hover:bg-[#B47B2B] text-[#1C1917] hover:text-white text-xs font-semibold transition-colors"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Locate in Tree</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onEditPerson(person);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14362B] hover:bg-[#0D261E] text-white text-xs font-semibold transition-colors"
            >
              <PenSquare className="w-3.5 h-3.5" />
              <span>Edit Profile &amp; Photo</span>
            </button>

            <button
              type="button"
              onClick={() => onCopySummary(person)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#F4EFE6] text-[#1C1917] text-xs font-semibold transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Summary</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E5DEC9] bg-white hover:bg-[#F4EFE6] text-xs font-semibold text-[#57534E] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
