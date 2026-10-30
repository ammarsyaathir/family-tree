-- ============================================================================
-- PostgreSQL / Supabase family_members JSONB Schema & Clean Seed Data
-- Total Family Members: 68
-- ============================================================================

-- 1. Table Creation
CREATE TABLE IF NOT EXISTS public.family_members (
    id VARCHAR(50) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_by VARCHAR(60) DEFAULT 'System',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Trigger Function for Updated Timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON public.family_members;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.family_members
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- 3. Row Level Security (RLS) Policies for Public Web Access
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'family_members' AND policyname = 'Allow public read access'
    ) THEN
        CREATE POLICY "Allow public read access"
        ON public.family_members FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'family_members' AND policyname = 'Allow public write access'
    ) THEN
        CREATE POLICY "Allow public write access"
        ON public.family_members FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Clean Insert / Upsert Family Records
INSERT INTO public.family_members (id, data) VALUES
('p_isa', '{"name":"Md Isa","gender":"male","dob":"1942-03-15","familyLabel":"Grandfather","isInLaw":false,"avatar":null,"generation":1,"city":"Rembau","fatherId":null,"motherId":null,"spouses":[{"id":"p_zaharah","status":"married"}],"children":["d_paklong","d_pakngah","d_dad","d_makteh","d_aciknora","d_maksulaili"]}'::jsonb),
('p_zaharah', '{"name":"Zaharah","gender":"female","dob":"1946-07-22","familyLabel":"Grandmother","isInLaw":false,"avatar":null,"generation":1,"city":"Rembau","fatherId":null,"motherId":null,"spouses":[{"id":"p_isa","status":"married"}],"children":["d_paklong","d_pakngah","d_dad","d_makteh","d_aciknora","d_maksulaili"]}'::jsonb),
('m_zain', '{"name":"Mohamad Zain","gender":"male","dob":"1938-01-01","familyLabel":"Grandfather","isInLaw":false,"avatar":null,"generation":1,"city":"Seremban","fatherId":null,"motherId":null,"spouses":[{"id":"m_noraini","status":"married"}],"children":["m_zainal","m_azhar","m_shafrah","m_mazri","m_yusma"]}'::jsonb),
('m_noraini', '{"name":"Noraini Nordin","gender":"female","dob":"1942-01-01","familyLabel":"Grandmother","isInLaw":false,"avatar":null,"generation":1,"city":"Seremban","fatherId":null,"motherId":null,"spouses":[{"id":"m_zain","status":"married"}],"children":["m_zainal","m_azhar","m_shafrah","m_mazri","m_yusma"]}'::jsonb),
('d_dad', '{"name":"Abd Rahim","gender":"male","dob":"1971-06-10","familyLabel":"Father","isInLaw":false,"avatar":null,"generation":2,"city":"Bandar Saujana Putra","fatherId":"p_isa","motherId":"p_zaharah","spouses":[{"id":"m_shafrah","status":"married"}],"children":["c_asyraf","c_aliah","c_aqilah","c_adilah","c_ammar"]}'::jsonb),
('m_shafrah', '{"name":"Shafrah","gender":"female","dob":"1973-09-18","familyLabel":"Mother","isInLaw":false,"avatar":null,"generation":2,"city":"Bandar Saujana Putra","fatherId":"m_zain","motherId":"m_noraini","spouses":[{"id":"d_dad","status":"married"}],"children":["c_asyraf","c_aliah","c_aqilah","c_adilah","c_ammar"]}'::jsonb),
('c_ammar', '{"name":"Ammar","gender":"male","dob":"1998-04-15","familyLabel":"ME","isInLaw":false,"avatar":null,"generation":3,"city":"Bandar Saujana Putra","fatherId":"d_dad","motherId":"m_shafrah","spouses":[],"children":[]}'::jsonb),
('c_asyraf', '{"name":"Asyraf","gender":"male","dob":"1996-02-20","familyLabel":"Brother","isInLaw":false,"avatar":null,"generation":3,"city":"Shah Alam","fatherId":"d_dad","motherId":"m_shafrah","spouses":[{"id":"c_esyha","status":"married"}],"children":["g4_saarah","g4_amira","g4_aisy","g4_ayesha","g4_aira","g4_ayaan"]}'::jsonb),
('c_esyha', '{"name":"Esyha","gender":"female","dob":"1999-11-08","familyLabel":"Sister-in-Law","isInLaw":true,"avatar":null,"generation":3,"city":"Shah Alam","fatherId":null,"motherId":null,"spouses":[{"id":"c_asyraf","status":"married"}],"children":["g4_saarah","g4_amira","g4_aisy","g4_ayesha","g4_aira","g4_ayaan"]}'::jsonb),
('c_aliah', '{"name":"Alyah","gender":"female","dob":"2000-08-12","familyLabel":"Sister","isInLaw":false,"avatar":null,"generation":3,"city":"Bandar Saujana Putra","fatherId":"d_dad","motherId":"m_shafrah","spouses":[],"children":[]}'::jsonb),
('c_aqilah', '{"name":"Aqilah","gender":"female","dob":"2002-04-30","familyLabel":"Sister","isInLaw":false,"avatar":null,"generation":3,"city":"Bandar Saujana Putra","fatherId":"d_dad","motherId":"m_shafrah","spouses":[],"children":[]}'::jsonb),
('c_adilah', '{"name":"Adilah","gender":"female","dob":"2004-01-15","familyLabel":"Sister","isInLaw":false,"avatar":null,"generation":3,"city":"Bandar Saujana Putra","fatherId":"d_dad","motherId":"m_shafrah","spouses":[],"children":[]}'::jsonb),
('g4_saarah', '{"name":"Saarah","gender":"female","dob":"2017-07-12","familyLabel":"Niece","isInLaw":false,"avatar":null,"generation":4,"city":"Shah Alam","fatherId":"c_asyraf","motherId":"c_esyha","spouses":[],"children":[]}'::jsonb),
('g4_amira', '{"name":"Amira","gender":"female","dob":"2019-05-15","familyLabel":"Niece","isInLaw":false,"avatar":null,"generation":4,"city":"Shah Alam","fatherId":"c_asyraf","motherId":"c_esyha","spouses":[],"children":[]}'::jsonb),
('g4_aisy', '{"name":"Aisy","gender":"female","dob":"2021-06-18","familyLabel":"Niece","isInLaw":false,"avatar":null,"generation":4,"city":"Shah Alam","fatherId":"c_asyraf","motherId":"c_esyha","spouses":[],"children":[]}'::jsonb),
('g4_ayesha', '{"name":"Ayesha","gender":"female","dob":"2022-01-30","familyLabel":"Niece","isInLaw":false,"avatar":null,"generation":4,"city":"Shah Alam","fatherId":"c_asyraf","motherId":"c_esyha","spouses":[],"children":[]}'::jsonb),
('g4_aira', '{"name":"Aira","gender":"female","dob":"2023-08-20","familyLabel":"Niece","isInLaw":false,"avatar":null,"generation":4,"city":"Shah Alam","fatherId":"c_asyraf","motherId":"c_esyha","spouses":[],"children":[]}'::jsonb),
('g4_ayaan', '{"name":"Aayaan","gender":"male","dob":"2024-01-01","familyLabel":"Nephew","isInLaw":false,"avatar":null,"generation":4,"city":"Shah Alam","fatherId":"c_asyraf","motherId":"c_esyha","spouses":[],"children":[]}'::jsonb),
('d_paklong', '{"name":"Nordin","gender":"male","dob":"1961-01-01","familyLabel":"Uncle","isInLaw":false,"avatar":null,"generation":2,"city":"Seremban","fatherId":"p_isa","motherId":"p_zaharah","spouses":[{"id":"d_paklong_w","status":"married"}],"children":["d_pl_c1","d_pl_c2","d_pl_c3","d_pl_c4"]}'::jsonb),
('d_paklong_w', '{"name":"Manisan","gender":"female","dob":"1964-01-01","familyLabel":"Aunt","isInLaw":true,"avatar":null,"generation":2,"city":"Seremban","fatherId":null,"motherId":null,"spouses":[{"id":"d_paklong","status":"married"}],"children":["d_pl_c1","d_pl_c2","d_pl_c3","d_pl_c4"]}'::jsonb),
('d_pl_c1', '{"name":"Faris","gender":"male","dob":"1994-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"d_paklong","motherId":"d_paklong_w","spouses":[],"children":[]}'::jsonb),
('d_pl_c2', '{"name":"Nadia","gender":"female","dob":"1996-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Kuala Lumpur","fatherId":"d_paklong","motherId":"d_paklong_w","spouses":[],"children":[]}'::jsonb),
('d_pl_c3', '{"name":"Fahmi","gender":"male","dob":"1998-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"d_paklong","motherId":"d_paklong_w","spouses":[],"children":[]}'::jsonb),
('d_pl_c4', '{"name":"Najwa","gender":"female","dob":"2000-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"d_paklong","motherId":"d_paklong_w","spouses":[],"children":[]}'::jsonb),
('d_pakngah', '{"name":"Kamaruddin","gender":"male","dob":"1959-01-01","familyLabel":"Uncle","isInLaw":false,"avatar":null,"generation":2,"city":"Kajang","fatherId":"p_isa","motherId":"p_zaharah","spouses":[{"id":"d_pakngah_w","status":"married"}],"children":["d_pn_c1","d_pn_c2","d_pn_c3","d_pn_c4"]}'::jsonb),
('d_pakngah_w', '{"name":"Kama","gender":"female","dob":"1962-01-01","familyLabel":"Aunt","isInLaw":true,"avatar":null,"generation":2,"city":"Kajang","fatherId":null,"motherId":null,"spouses":[{"id":"d_pakngah","status":"married"}],"children":["d_pn_c1","d_pn_c2","d_pn_c3","d_pn_c4"]}'::jsonb),
('d_pn_c1', '{"name":"Danial","gender":"male","dob":"1992-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Kajang","fatherId":"d_pakngah","motherId":"d_pakngah_w","spouses":[],"children":[]}'::jsonb),
('d_pn_c2', '{"name":"Dania","gender":"female","dob":"1994-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Putrajaya","fatherId":"d_pakngah","motherId":"d_pakngah_w","spouses":[],"children":[]}'::jsonb),
('d_pn_c3', '{"name":"Darwisy","gender":"male","dob":"1996-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Kajang","fatherId":"d_pakngah","motherId":"d_pakngah_w","spouses":[],"children":[]}'::jsonb),
('d_pn_c4', '{"name":"Dayana","gender":"female","dob":"1998-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Kajang","fatherId":"d_pakngah","motherId":"d_pakngah_w","spouses":[],"children":[]}'::jsonb),
('d_makteh', '{"name":"Normala","gender":"female","dob":"1966-01-01","familyLabel":"Aunt","isInLaw":false,"avatar":null,"generation":2,"city":"Rembau","fatherId":"p_isa","motherId":"p_zaharah","spouses":[],"children":["d_mt_ika","d_mt_miza","d_mt_ain","d_mt_mirul"]}'::jsonb),
('d_mt_ika', '{"name":"Ika","gender":"female","dob":"1996-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":null,"motherId":"d_makteh","spouses":[],"children":[]}'::jsonb),
('d_mt_miza', '{"name":"Miza","gender":"female","dob":"1998-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Rembau","fatherId":null,"motherId":"d_makteh","spouses":[],"children":[]}'::jsonb),
('d_mt_ain', '{"name":"Ain","gender":"female","dob":"2000-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Rembau","fatherId":null,"motherId":"d_makteh","spouses":[],"children":[]}'::jsonb),
('d_mt_mirul', '{"name":"Mirul","gender":"male","dob":"2002-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Rembau","fatherId":null,"motherId":"d_makteh","spouses":[],"children":[]}'::jsonb),
('d_aciknora', '{"name":"Nora","gender":"female","dob":"1969-01-01","familyLabel":"Aunt","isInLaw":false,"avatar":null,"generation":2,"city":"Putrajaya","fatherId":"p_isa","motherId":"p_zaharah","spouses":[{"id":"d_izzan","status":"married"}],"children":[]}'::jsonb),
('d_izzan', '{"name":"Izzan","gender":"male","dob":"1971-01-01","familyLabel":"Uncle","isInLaw":true,"avatar":null,"generation":2,"city":"Putrajaya","fatherId":null,"motherId":null,"spouses":[{"id":"d_aciknora","status":"married"}],"children":[]}'::jsonb),
('d_maksulaili', '{"name":"Laili","gender":"female","dob":"1972-01-01","familyLabel":"Aunt","isInLaw":false,"avatar":null,"generation":2,"city":"Seremban","fatherId":"p_isa","motherId":"p_zaharah","spouses":[{"id":"d_azman","status":"married"}],"children":["d_ms_c1","d_ms_c2","d_ms_c3","d_ms_c4","d_ms_c5","d_ms_c6","d_ms_c7"]}'::jsonb),
('d_azman', '{"name":"Azman","gender":"male","dob":"1970-01-01","familyLabel":"Uncle","isInLaw":true,"avatar":null,"generation":2,"city":"Seremban","fatherId":null,"motherId":null,"spouses":[{"id":"d_maksulaili","status":"married"}],"children":["d_ms_c1","d_ms_c2","d_ms_c3","d_ms_c4","d_ms_c5","d_ms_c6","d_ms_c7"]}'::jsonb),
('d_ms_c1', '{"name":"Haziq","gender":"male","dob":"2000-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"d_azman","motherId":"d_maksulaili","spouses":[],"children":[]}'::jsonb),
('d_ms_c2', '{"name":"Haziqah","gender":"female","dob":"2002-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"d_azman","motherId":"d_maksulaili","spouses":[],"children":[]}'::jsonb),
('d_ms_c3', '{"name":"Harith","gender":"male","dob":"2004-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"d_azman","motherId":"d_maksulaili","spouses":[],"children":[]}'::jsonb),
('d_ms_c4', '{"name":"Hannah","gender":"female","dob":"2006-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"d_azman","motherId":"d_maksulaili","spouses":[],"children":[]}'::jsonb),
('d_ms_c5', '{"name":"Haikal","gender":"male","dob":"2008-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"d_azman","motherId":"d_maksulaili","spouses":[],"children":[]}'::jsonb),
('d_ms_c6', '{"name":"Humaira","gender":"female","dob":"2010-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"d_azman","motherId":"d_maksulaili","spouses":[],"children":[]}'::jsonb),
('d_ms_c7', '{"name":"Hadif","gender":"male","dob":"2012-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"d_azman","motherId":"d_maksulaili","spouses":[],"children":[]}'::jsonb),
('m_zainal', '{"name":"Zainal","gender":"male","dob":"1964-01-01","familyLabel":"Uncle","isInLaw":false,"avatar":null,"generation":2,"city":"Kuala Lumpur","fatherId":"m_zain","motherId":"m_noraini","spouses":[{"id":"m_nolina","status":"married"}],"children":["m_zn_amelia","m_zn_alysaa","m_zn_alany","m_zn_hilman"]}'::jsonb),
('m_nolina', '{"name":"Nolina","gender":"female","dob":"1967-01-01","familyLabel":"Aunt","isInLaw":true,"avatar":null,"generation":2,"city":"Kuala Lumpur","fatherId":null,"motherId":null,"spouses":[{"id":"m_zainal","status":"married"}],"children":["m_zn_amelia","m_zn_alysaa","m_zn_alany","m_zn_hilman"]}'::jsonb),
('m_zn_amelia', '{"name":"Amelia Maisarah","gender":"female","dob":"1996-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Kuala Lumpur","fatherId":"m_zainal","motherId":"m_nolina","spouses":[],"children":[]}'::jsonb),
('m_zn_alysaa', '{"name":"Alysaa Sabrina","gender":"female","dob":"1999-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Kuala Lumpur","fatherId":"m_zainal","motherId":"m_nolina","spouses":[],"children":[]}'::jsonb),
('m_zn_alany', '{"name":"Alany Sabrina","gender":"female","dob":"2001-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Kuala Lumpur","fatherId":"m_zainal","motherId":"m_nolina","spouses":[],"children":[]}'::jsonb),
('m_zn_hilman', '{"name":"Hilman","gender":"male","dob":"2003-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Kuala Lumpur","fatherId":"m_zainal","motherId":"m_nolina","spouses":[],"children":[]}'::jsonb),
('m_azhar', '{"name":"Azhar","gender":"male","dob":"1966-01-01","familyLabel":"Uncle","isInLaw":false,"avatar":null,"generation":2,"city":"Shah Alam","fatherId":"m_zain","motherId":"m_noraini","spouses":[{"id":"m_norita","status":"married"}],"children":["m_az_hairie","m_az_syalina"]}'::jsonb),
('m_norita', '{"name":"Norita","gender":"female","dob":"1969-01-01","familyLabel":"Aunt","isInLaw":true,"avatar":null,"generation":2,"city":"Shah Alam","fatherId":null,"motherId":null,"spouses":[{"id":"m_azhar","status":"married"}],"children":["m_az_hairie","m_az_syalina"]}'::jsonb),
('m_az_hairie', '{"name":"Hairie Danial","gender":"male","dob":"1996-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Shah Alam","fatherId":"m_azhar","motherId":"m_norita","spouses":[],"children":[]}'::jsonb),
('m_az_syalina', '{"name":"Syalina Diana","gender":"female","dob":"1999-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Shah Alam","fatherId":"m_azhar","motherId":"m_norita","spouses":[],"children":[]}'::jsonb),
('m_mazri', '{"name":"Mazri","gender":"male","dob":"1972-01-01","familyLabel":"Uncle","isInLaw":false,"avatar":null,"generation":2,"city":"Seremban","fatherId":"m_zain","motherId":"m_noraini","spouses":[{"id":"m_mazri_s","status":"married"}],"children":["m_mz_izzat","m_mz_izzudin","m_mz_aiman","m_mz_airin","m_mz_aisyah"]}'::jsonb),
('m_mazri_s', '{"name":"Nordin","gender":"female","dob":"1975-01-01","familyLabel":"Aunt","isInLaw":true,"avatar":null,"generation":2,"city":"Seremban","fatherId":null,"motherId":null,"spouses":[{"id":"m_mazri","status":"married"}],"children":["m_mz_izzat","m_mz_izzudin","m_mz_aiman","m_mz_airin","m_mz_aisyah"]}'::jsonb),
('m_mz_izzat', '{"name":"Izzat Nazrin","gender":"male","dob":"1996-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"m_mazri","motherId":"m_mazri_s","spouses":[],"children":[]}'::jsonb),
('m_mz_izzudin', '{"name":"Izzudin Nazrin","gender":"male","dob":"1998-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"m_mazri","motherId":"m_mazri_s","spouses":[],"children":[]}'::jsonb),
('m_mz_aiman', '{"name":"Aiman Nazrin","gender":"male","dob":"2001-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"m_mazri","motherId":"m_mazri_s","spouses":[],"children":[]}'::jsonb),
('m_mz_airin', '{"name":"Airin Natasha","gender":"female","dob":"2004-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"m_mazri","motherId":"m_mazri_s","spouses":[],"children":[]}'::jsonb),
('m_mz_aisyah', '{"name":"Aisyah Qistina","gender":"female","dob":"2007-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Seremban","fatherId":"m_mazri","motherId":"m_mazri_s","spouses":[],"children":[]}'::jsonb),
('m_yusma', '{"name":"Yusma","gender":"female","dob":"1975-01-01","familyLabel":"Aunt","isInLaw":false,"avatar":null,"generation":2,"city":"Putrajaya","fatherId":"m_zain","motherId":"m_noraini","spouses":[{"id":"m_hamzah","status":"married"}],"children":["m_ym_hafizah","m_ym_hidayah","m_ym_izzah"]}'::jsonb),
('m_hamzah', '{"name":"Hamzah","gender":"male","dob":"1973-01-01","familyLabel":"Uncle","isInLaw":true,"avatar":null,"generation":2,"city":"Putrajaya","fatherId":null,"motherId":null,"spouses":[{"id":"m_yusma","status":"married"}],"children":["m_ym_hafizah","m_ym_hidayah","m_ym_izzah"]}'::jsonb),
('m_ym_hafizah', '{"name":"Nurul Hafizah","gender":"female","dob":"2000-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Putrajaya","fatherId":"m_hamzah","motherId":"m_yusma","spouses":[],"children":[]}'::jsonb),
('m_ym_hidayah', '{"name":"Nurul Hidayah","gender":"female","dob":"2003-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Putrajaya","fatherId":"m_hamzah","motherId":"m_yusma","spouses":[],"children":[]}'::jsonb),
('m_ym_izzah', '{"name":"Nurul Izzah","gender":"female","dob":"2007-01-01","familyLabel":"Cousin","isInLaw":false,"avatar":null,"generation":3,"city":"Putrajaya","fatherId":"m_hamzah","motherId":"m_yusma","spouses":[],"children":[]}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET data = EXCLUDED.data,
    updated_at = timezone('utc'::text, now()),
    updated_by = 'System';