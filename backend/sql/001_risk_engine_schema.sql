-- MedGuard Risk Engine schema
-- Run in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Canonical medication dictionary (editable, auditable)
CREATE TABLE IF NOT EXISTS drug_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT UNIQUE NOT NULL,
  rxnorm_cui TEXT,
  atc_code TEXT,
  is_antibiotic BOOLEAN DEFAULT FALSE,
  aliases TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pairwise interaction knowledge base
CREATE TABLE IF NOT EXISTS drug_interactions_kb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a TEXT NOT NULL,
  drug_b TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('yellow', 'red')),
  message TEXT NOT NULL,
  advice TEXT NOT NULL,
  evidence_level TEXT DEFAULT 'moderate',
  source TEXT DEFAULT 'curated',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (drug_a, drug_b)
);

-- ADR knowledge base
CREATE TABLE IF NOT EXISTS adverse_reactions_kb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name TEXT NOT NULL,
  symptom_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('yellow', 'red')),
  message TEXT NOT NULL,
  source TEXT DEFAULT 'curated',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (drug_name, symptom_id)
);

-- Audit table for each risk check request
CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('green', 'yellow', 'red')),
  total_flags INTEGER DEFAULT 0,
  red_flags INTEGER DEFAULT 0,
  yellow_flags INTEGER DEFAULT 0,
  request_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Flattened flags for explainability
CREATE TABLE IF NOT EXISTS risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES risk_assessments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('yellow', 'red')),
  drug_a TEXT,
  drug_b TEXT,
  symptom_id TEXT,
  message TEXT NOT NULL,
  advice TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional normalization ledger
CREATE TABLE IF NOT EXISTS medication_normalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  raw_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  rxnorm_cui TEXT,
  confidence NUMERIC(4,3) DEFAULT 0.750,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: user-owned tables
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_normalizations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'risk_assessments' AND policyname = 'Users can view own risk assessments'
  ) THEN
    CREATE POLICY "Users can view own risk assessments" ON risk_assessments
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'risk_assessments' AND policyname = 'Users can insert own risk assessments'
  ) THEN
    CREATE POLICY "Users can insert own risk assessments" ON risk_assessments
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'risk_flags' AND policyname = 'Users can view own risk flags'
  ) THEN
    CREATE POLICY "Users can view own risk flags" ON risk_flags
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'risk_flags' AND policyname = 'Users can insert own risk flags'
  ) THEN
    CREATE POLICY "Users can insert own risk flags" ON risk_flags
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'medication_normalizations' AND policyname = 'Users can view own normalizations'
  ) THEN
    CREATE POLICY "Users can view own normalizations" ON medication_normalizations
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'medication_normalizations' AND policyname = 'Users can insert own normalizations'
  ) THEN
    CREATE POLICY "Users can insert own normalizations" ON medication_normalizations
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- indexes
CREATE INDEX IF NOT EXISTS idx_risk_assessments_user_created ON risk_assessments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_flags_user_created ON risk_flags(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_normalizations_user_created ON medication_normalizations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_pair ON drug_interactions_kb(drug_a, drug_b);
CREATE INDEX IF NOT EXISTS idx_adr_drug_symptom ON adverse_reactions_kb(drug_name, symptom_id);

-- Seed minimal canonical data
INSERT INTO drug_catalog (canonical_name, rxnorm_cui, is_antibiotic, aliases) VALUES
('paracetamol', '161', FALSE, ARRAY['dolo', 'crocin', 'calpol']),
('ibuprofen', '5640', FALSE, ARRAY['brufen']),
('aspirin', '1191', FALSE, ARRAY['ecosprin', 'disprin']),
('warfarin', '11289', FALSE, ARRAY['coumadin']),
('metformin', '6809', FALSE, ARRAY['glycomet', 'glucophage']),
('azithromycin', '18631', TRUE, ARRAY['azithral']),
('amoxicillin', '723', TRUE, ARRAY['amox']),
('amoxicillin-clavulanate', '19711', TRUE, ARRAY['augmentin', 'amoxyclav']),
('cefixime', '25033', TRUE, ARRAY['zifi']),
('levofloxacin', '82122', TRUE, ARRAY[]::TEXT[]),
('pantoprazole', '40790', FALSE, ARRAY['pan']),
('omeprazole', '7646', FALSE, ARRAY[]::TEXT[])
ON CONFLICT (canonical_name) DO NOTHING;

INSERT INTO drug_interactions_kb (drug_a, drug_b, severity, message, advice, evidence_level, source) VALUES
('warfarin', 'aspirin', 'red', 'Warfarin + Aspirin can significantly increase bleeding risk.', 'Avoid unless explicitly prescribed and monitored.', 'high', 'curated'),
('warfarin', 'ibuprofen', 'red', 'Warfarin + Ibuprofen increases serious GI bleeding risk.', 'Use alternatives and consult physician.', 'high', 'curated'),
('clopidogrel', 'omeprazole', 'yellow', 'Omeprazole may reduce Clopidogrel effectiveness.', 'Consider alternate gastroprotection after clinician review.', 'moderate', 'curated'),
('aspirin', 'ibuprofen', 'yellow', 'Ibuprofen can interfere with Aspirin antiplatelet effect.', 'Time dosing carefully or use alternatives.', 'moderate', 'curated')
ON CONFLICT (drug_a, drug_b) DO NOTHING;

INSERT INTO adverse_reactions_kb (drug_name, symptom_id, severity, message, source) VALUES
('amoxicillin', 'rash', 'yellow', 'Rash may indicate antibiotic hypersensitivity.', 'curated'),
('amoxicillin', 'swelling', 'red', 'Swelling can indicate severe allergic reaction.', 'curated'),
('ibuprofen', 'gastritis', 'yellow', 'Stomach pain/acidity can occur with NSAIDs.', 'curated'),
('metformin', 'gastritis', 'yellow', 'GI upset is common with Metformin.', 'curated'),
('azithromycin', 'dizziness', 'yellow', 'Dizziness can occur with Azithromycin.', 'curated'),
('aspirin', 'bleeding', 'red', 'Aspirin may increase bleeding risk.', 'curated'),
('warfarin', 'bleeding', 'red', 'Warfarin may cause significant bleeding events.', 'curated'),
('amlodipine', 'swelling', 'yellow', 'Peripheral swelling is a common side effect of amlodipine.', 'curated'),
('atorvastatin', 'muscle_pain', 'yellow', 'Muscle pain can occur with statins; report severe symptoms.', 'curated'),
('omeprazole', 'headache', 'yellow', 'Headache is a reported side effect of omeprazole.', 'curated'),
('pantoprazole', 'headache', 'yellow', 'Headache is a reported side effect of pantoprazole.', 'curated'),
('lisinopril', 'cough', 'yellow', 'Dry cough may occur with lisinopril.', 'curated')
ON CONFLICT (drug_name, symptom_id) DO NOTHING;
