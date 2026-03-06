-- ═══════════════════════════════════════════════════════════
-- MEDGUARD — SQL Migrations for AI Brain
-- Run these in Supabase SQL Editor (supabase.com → SQL)
-- ═══════════════════════════════════════════════════════════

-- 1. ADHERENCE LOG TABLE
-- Tracks daily adherence for streak calculation and pattern analysis
CREATE TABLE IF NOT EXISTS adherence_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    all_taken BOOLEAN DEFAULT false,
    total_meds INTEGER DEFAULT 0,
    taken_meds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, date) -- One entry per user per day
);

-- RLS for adherence_log
ALTER TABLE adherence_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own adherence" ON adherence_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own adherence" ON adherence_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own adherence" ON adherence_log
    FOR UPDATE USING (auth.uid() = user_id);


-- 2. SYMPTOMS TABLE
-- Stores user-reported symptoms (replaces localStorage)
CREATE TABLE IF NOT EXISTS symptoms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    symptom_id TEXT NOT NULL,  -- e.g., 'rash', 'gastritis', 'fever_pers'
    reported_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, symptom_id) -- Prevent duplicates
);

-- RLS for symptoms
ALTER TABLE symptoms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own symptoms" ON symptoms
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own symptoms" ON symptoms
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own symptoms" ON symptoms
    FOR DELETE USING (auth.uid() = user_id);


-- 3. BRAIN LOG TABLE
-- Records Brain decisions for history and doctor reports
CREATE TABLE IF NOT EXISTS brain_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,         -- 'alert', 'decision', 'insight'
    level TEXT DEFAULT 'green', -- 'red', 'yellow', 'green'
    title TEXT,
    message TEXT,
    data JSONB DEFAULT '{}',   -- Flexible payload for any extra info
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for brain_log
ALTER TABLE brain_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brain logs" ON brain_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brain logs" ON brain_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 4. INDEX for common queries
CREATE INDEX IF NOT EXISTS idx_adherence_user_date ON adherence_log(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_symptoms_user ON symptoms(user_id);
CREATE INDEX IF NOT EXISTS idx_brain_log_user ON brain_log(user_id, created_at DESC);
