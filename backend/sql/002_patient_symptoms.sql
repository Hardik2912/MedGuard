CREATE TABLE IF NOT EXISTS patient_symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symptom_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, symptom_id)
);

ALTER TABLE patient_symptoms ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'patient_symptoms' AND policyname = 'Users can view own patient symptoms'
  ) THEN
    CREATE POLICY "Users can view own patient symptoms" ON patient_symptoms
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'patient_symptoms' AND policyname = 'Users can insert own patient symptoms'
  ) THEN
    CREATE POLICY "Users can insert own patient symptoms" ON patient_symptoms
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'patient_symptoms' AND policyname = 'Users can delete own patient symptoms'
  ) THEN
    CREATE POLICY "Users can delete own patient symptoms" ON patient_symptoms
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patient_symptoms_user_time ON patient_symptoms(user_id, timestamp DESC);
