-- ================================================
-- MEDGUARD — SQLite Schema
-- Non-diagnostic medication safety backend
-- ================================================

PRAGMA foreign_keys = ON;

--------------------------------------------------
-- 1. DRUG MASTER
--------------------------------------------------
CREATE TABLE IF NOT EXISTS drug_master (
    drug_id TEXT PRIMARY KEY,
    molecule TEXT NOT NULL,
    drug_class TEXT NOT NULL,
    is_antibiotic INTEGER DEFAULT 0,
    who_aware TEXT,
    common_use TEXT,
    alcohol_warning TEXT,
    elderly_caution TEXT,
    source TEXT NOT NULL
);

--------------------------------------------------
-- 2. ADR MASTER
--------------------------------------------------
CREATE TABLE IF NOT EXISTS adr_master (
    adr_id TEXT PRIMARY KEY,
    symptom_layman TEXT NOT NULL,
    medical_term TEXT,
    severity TEXT CHECK (severity IN ('mild','moderate','serious')),
    frequency TEXT,
    emergency INTEGER DEFAULT 0,
    source TEXT NOT NULL
);

--------------------------------------------------
-- 3. DRUG–ADR MAPPING
--------------------------------------------------
CREATE TABLE IF NOT EXISTS drug_adr_map (
    drug_id TEXT,
    adr_id TEXT,
    level TEXT CHECK (level IN ('green','yellow','red')),
    advice TEXT,
    source TEXT,
    PRIMARY KEY (drug_id, adr_id),
    FOREIGN KEY (drug_id) REFERENCES drug_master(drug_id),
    FOREIGN KEY (adr_id) REFERENCES adr_master(adr_id)
);

--------------------------------------------------
-- 4. DRUG–DRUG INTERACTIONS
--------------------------------------------------
CREATE TABLE IF NOT EXISTS drug_interaction_master (
    drug_a TEXT,
    drug_b TEXT,
    mechanism TEXT,
    severity TEXT CHECK (severity IN ('yellow','red')),
    message TEXT,
    source TEXT,
    PRIMARY KEY (drug_a, drug_b)
);

--------------------------------------------------
-- 5. FOOD & ALCOHOL INTERACTIONS
--------------------------------------------------
CREATE TABLE IF NOT EXISTS food_alcohol_interactions (
    drug_id TEXT,
    trigger_item TEXT,
    risk_level TEXT CHECK (risk_level IN ('yellow','red')),
    message TEXT,
    source TEXT,
    PRIMARY KEY (drug_id, trigger_item)
);

--------------------------------------------------
-- 6. ANTIBIOTIC MISUSE RULES
--------------------------------------------------
CREATE TABLE IF NOT EXISTS antibiotic_misuse_rules (
    rule_id TEXT PRIMARY KEY,
    condition TEXT,
    message TEXT,
    risk TEXT CHECK (risk IN ('yellow','red')),
    source TEXT
);

--------------------------------------------------
-- 7. AMR RISK MASTER
--------------------------------------------------
CREATE TABLE IF NOT EXISTS amr_risk_master (
    drug_id TEXT PRIMARY KEY,
    aware_category TEXT,
    amr_risk TEXT CHECK (amr_risk IN ('low','medium','high')),
    stewardship_message TEXT,
    source TEXT
);

--------------------------------------------------
-- 8. SOURCE MASTER
--------------------------------------------------
CREATE TABLE IF NOT EXISTS source_master (
    source_id TEXT PRIMARY KEY,
    name TEXT,
    authority TEXT,
    region TEXT,
    url TEXT
);

--------------------------------------------------
-- 9. BRAND MAPPING
--------------------------------------------------
CREATE TABLE IF NOT EXISTS brand_mapping (
    brand_name TEXT PRIMARY KEY,
    drug_id TEXT NOT NULL,
    manufacturer TEXT,
    FOREIGN KEY (drug_id) REFERENCES drug_master(drug_id)
);

--------------------------------------------------
-- 10. SEVERITY RULES (drives risk engine)
--------------------------------------------------
CREATE TABLE IF NOT EXISTS severity_rules (
    rule_id TEXT PRIMARY KEY,
    condition_type TEXT NOT NULL,
    condition_value TEXT NOT NULL,
    risk_level TEXT CHECK (risk_level IN ('green','yellow','red')) NOT NULL,
    description TEXT
);

--------------------------------------------------
-- 11. EVIDENCE MAP
--------------------------------------------------
CREATE TABLE IF NOT EXISTS evidence_map (
    evidence_id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    claim TEXT,
    FOREIGN KEY (source_id) REFERENCES source_master(source_id)
);

--------------------------------------------------
-- 12. USER MEDICINE TIMELINE
--------------------------------------------------
CREATE TABLE IF NOT EXISTS user_medicine_timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    drug_id TEXT,
    start_date TEXT,
    end_date TEXT,
    missed_doses INTEGER DEFAULT 0,
    confirmed INTEGER DEFAULT 0,
    FOREIGN KEY (drug_id) REFERENCES drug_master(drug_id)
);
