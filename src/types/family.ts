export type BranchType = 'immediate' | 'paternal' | 'maternal';
export type GenderType = 'male' | 'female';

export interface SpouseLink {
  id: string;
  status?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  nickname?: string;
  gender: GenderType;
  age: number;
  dob: string;
  generation: number; // 1, 2, 3, 4, etc.
  branch: BranchType;
  familyUnit: string;
  familyLabel: string;
  city: string;
  profession?: string;
  bio?: string;
  fatherId: string | null;
  motherId: string | null;
  spouses: SpouseLink[];
  children: string[];
  isInLaw?: boolean;
  avatar?: string;
  _updatedAt?: string;
  _updatedBy?: string | null;
}

export interface D1Row {
  id: string;
  data: FamilyMember;
  updated_at: string;
  updated_by?: string | null;
}

export interface FamilyHouseholdMeta {
  id: string;
  label: string;
  branch: BranchType;
}

export const DEFAULT_HOUSEHOLDS: FamilyHouseholdMeta[] = [
  { id: 'core_ammar', label: 'Keluarga Asas Ammar', branch: 'immediate' },
  { id: 'gp_paternal', label: 'Atok Isa & Nenek Zaharah', branch: 'paternal' },
  { id: 'pl_paklong', label: 'Keluarga Paklong', branch: 'paternal' },
  { id: 'pn_pakngah', label: 'Keluarga Pakngah', branch: 'paternal' },
  { id: 'mt_makteh', label: 'Keluarga Makteh', branch: 'paternal' },
  { id: 'an_aciknora', label: 'Keluarga Acik Nora & Izzan', branch: 'paternal' },
  { id: 'ms_maksulaili', label: 'Keluarga Maksu Laili & Azman', branch: 'paternal' },
  { id: 'gp_maternal', label: 'Atok Zain & Nenek Noraini', branch: 'maternal' },
  { id: 'zn_zainal', label: 'Keluarga Zainal & Nolina', branch: 'maternal' },
  { id: 'az_azhar', label: 'Keluarga Azhar & Norita', branch: 'maternal' },
  { id: 'mz_mazri', label: 'Keluarga Mazri & Nordin', branch: 'maternal' },
  { id: 'ym_yusma', label: 'Keluarga Yusma & Hamzah', branch: 'maternal' },
];
