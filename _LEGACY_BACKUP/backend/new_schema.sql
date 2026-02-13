/* =======================================================================
   PHARMACOVIGILANCE & DRUG SAFETY DATABASE
   ======================================================================= */

PRAGMA foreign_keys = ON;

/* =======================================================================
   TABLE 1: DRUG MASTER
   ======================================================================= */

CREATE TABLE drug_master (
    drug_id TEXT PRIMARY KEY,
    molecule TEXT NOT NULL,
    drug_class TEXT NOT NULL,
    common_use TEXT,
    avoid_in TEXT,
    alcohol_warning TEXT,
    source TEXT NOT NULL
);


/* =======================================================================
   TABLE 2: ADR MASTER
   ======================================================================= */

CREATE TABLE adr_master (
    adr_id TEXT PRIMARY KEY,
    symptom_layman TEXT NOT NULL,
    medical_term TEXT,
    severity TEXT CHECK (severity IN ('mild','moderate','serious')),
    frequency TEXT CHECK (frequency IN ('common','uncommon','rare')),
    source TEXT NOT NULL
);


/* =======================================================================
   TABLE 3: DRUG–ADR MAP
   ======================================================================= */

CREATE TABLE drug_adr_map (
    drug_id TEXT NOT NULL,
    adr_id TEXT NOT NULL,
    level TEXT CHECK (level IN ('green','yellow','red')),
    advice TEXT,
    source TEXT NOT NULL,
    PRIMARY KEY (drug_id, adr_id),
    FOREIGN KEY (drug_id) REFERENCES drug_master(drug_id),
    FOREIGN KEY (adr_id) REFERENCES adr_master(adr_id)
);


/* =======================================================================
   TABLE 4: DRUG–DRUG INTERACTIONS
   ======================================================================= */

CREATE TABLE drug_interaction_master (
    interaction_id TEXT PRIMARY KEY,
    drug_a TEXT NOT NULL,
    drug_b TEXT NOT NULL,
    mechanism TEXT,
    clinical_effect TEXT,
    severity TEXT CHECK (severity IN ('mild','moderate','serious')),
    source TEXT NOT NULL
);


/* =======================================================================
   TABLE 5: DRUG CLASS INTERACTION RULES
   ======================================================================= */

CREATE TABLE drug_class_interaction_rules (
    rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    drug_class_a TEXT NOT NULL,
    drug_class_b TEXT NOT NULL,
    risk_level TEXT CHECK (risk_level IN ('green','yellow','red')),
    message TEXT,
    source TEXT NOT NULL
);


/* =======================================================================
   TABLE 6: FOOD & ALCOHOL INTERACTIONS
   ======================================================================= */

CREATE TABLE food_alcohol_interactions (
    interaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    drug TEXT NOT NULL,
    trigger TEXT NOT NULL,
    risk_level TEXT CHECK (risk_level IN ('green','yellow','red')),
    message TEXT,
    source TEXT NOT NULL
);


/* =======================================================================
   TABLE 7: ANTIBIOTIC MISUSE RULES
   ======================================================================= */

CREATE TABLE antibiotic_misuse_rules (
    rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    condition TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    level TEXT CHECK (level IN ('green','yellow','red')),
    source TEXT NOT NULL
);


/* =======================================================================
   TABLE 8: AMR RISK MASTER
   ======================================================================= */

CREATE TABLE amr_risk_master (
    drug TEXT PRIMARY KEY,
    who_aware_category TEXT CHECK (who_aware_category IN ('Access','Watch','Reserve')),
    amr_risk TEXT CHECK (amr_risk IN ('low','medium','high')),
    common_misuse TEXT,
    source TEXT NOT NULL
);


/* =======================================================================
   TABLE 9: REGULATORY METADATA
   ======================================================================= */

CREATE TABLE regulatory_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    statement TEXT NOT NULL,
    source TEXT
);

/* =======================================================================
   APP-SPECIFIC TABLE: USER MEDICINE TIMELINE
   ======================================================================= */

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


/* =======================================================================
   APP-SPECIFIC TABLE: USER PROFILE
   ======================================================================= */

CREATE TABLE IF NOT EXISTS user_profile (
    user_id TEXT PRIMARY KEY,
    name TEXT,
    gender TEXT,
    age INTEGER,
    weight_kg REAL,
    height_cm REAL,
    diet TEXT,
    occupation TEXT,
    existing_conditions TEXT,
    step_counter_enabled INTEGER DEFAULT 0,
    last_synced_steps INTEGER DEFAULT 0
);


/* =======================================================================
   INSERT TEST DATA
   ======================================================================= */


/* DRUG MASTER TEST DATA */

INSERT INTO drug_master VALUES
('D001','Paracetamol','Analgesic','Pain and fever','Severe liver disease','Avoid alcohol','DailyMed;MedlinePlus'),
('D002','Ibuprofen','NSAID','Pain and inflammation','Peptic ulcer disease','Avoid alcohol','DailyMed;FDA'),
('D003','Diclofenac','NSAID','Pain and arthritis','GI bleeding history','Avoid alcohol','DailyMed;EMA'),
('D004','Amoxicillin','Antibiotic (Penicillin)','Bacterial infections','Penicillin allergy','None','DailyMed;WHO'),
('D005','Amoxiclav','Antibiotic (Penicillin + inhibitor)','Respiratory infections','Liver disease','None','DailyMed;FDA'),
('D006','Azithromycin','Antibiotic (Macrolide)','Respiratory infections','QT prolongation','None','DailyMed;EMA'),
('D007','Metronidazole','Antibiotic (Nitroimidazole)','Anaerobic infections','Liver disease','Severe reaction','DailyMed;MedlinePlus'),
('D008','Ciprofloxacin','Antibiotic (Fluoroquinolone)','UTI & GI infections','Tendon disorders','None','DailyMed;FDA'),
('D009','Metformin','Antidiabetic','Type 2 diabetes','Severe renal disease','Avoid alcohol','DailyMed'),
('D010','Amlodipine','Antihypertensive','High blood pressure','Severe hypotension','Safe','DailyMed');


/* ADR MASTER TEST DATA */

INSERT INTO adr_master VALUES
('A001','Nausea','Nausea','mild','common','DailyMed'),
('A002','Vomiting','Emesis','moderate','common','DailyMed'),
('A003','Stomach pain','Abdominal pain','moderate','common','DailyMed'),
('A004','Diarrhea','Diarrhea','mild','common','DailyMed'),
('A005','Skin rash','Cutaneous rash','moderate','common','DailyMed'),
('A006','Black stool','Melena','serious','rare','DailyMed;FDA'),
('A007','Yellow eyes','Jaundice','serious','rare','DailyMed;EMA'),
('A008','Breathlessness','Dyspnea','serious','rare','DailyMed'),
('A009','Dizziness','Vertigo','mild','common','MedlinePlus'),
('A010','Low blood sugar','Hypoglycemia','moderate','uncommon','DailyMed');


/* DRUG–ADR MAP TEST DATA */

INSERT INTO drug_adr_map VALUES
('D001','A001','green','Usually mild and temporary','DailyMed'),
('D002','A003','yellow','Take with food and monitor','DailyMed'),
('D003','A006','red','Stop drug and seek urgent care','DailyMed;FDA'),
('D004','A005','red','Possible allergy – seek care','DailyMed'),
('D005','A004','yellow','Maintain hydration','DailyMed'),
('D006','A009','yellow','Sit or lie down if needed','MedlinePlus'),
('D007','A002','red','Avoid alcohol and seek care','DailyMed'),
('D008','A008','red','Medical emergency','DailyMed'),
('D009','A010','yellow','Monitor blood sugar','DailyMed'),
('D010','A009','green','Usually self-limiting','DailyMed');


/* DRUG–DRUG INTERACTIONS TEST DATA */

INSERT INTO drug_interaction_master VALUES
('I001','Ibuprofen','Prednisolone','Additive GI toxicity','GI bleeding risk','serious','DailyMed'),
('I002','Warfarin','Metronidazole','CYP2C9 inhibition','Increased bleeding','serious','DailyMed;EMA'),
('I003','Azithromycin','Amiodarone','QT prolongation','Arrhythmia risk','serious','DailyMed'),
('I004','Metformin','Cimetidine','Reduced renal clearance','Lactic acidosis risk','moderate','DailyMed'),
('I005','Ciprofloxacin','Theophylline','CYP inhibition','Theophylline toxicity','moderate','DailyMed');


/* DRUG CLASS INTERACTION RULES TEST DATA */

INSERT INTO drug_class_interaction_rules
(drug_class_a, drug_class_b, risk_level, message, source) VALUES
('NSAID','Corticosteroid','red','High risk of GI bleeding','DailyMed'),
('Fluoroquinolone','Antiarrhythmic','red','QT prolongation risk','EMA'),
('ACE inhibitor','Potassium supplement','yellow','Monitor potassium','FDA'),
('NSAID','Anticoagulant','red','Increased bleeding risk','DailyMed'),
('SSRI','NSAID','yellow','Possible GI bleeding','FAERS');


/* FOOD & ALCOHOL INTERACTIONS TEST DATA */

INSERT INTO food_alcohol_interactions
(drug, trigger, risk_level, message, source) VALUES
('Metronidazole','Alcohol','red','Severe nausea and vomiting','DailyMed;MedlinePlus'),
('Warfarin','Vitamin K rich food','yellow','Reduced anticoagulant effect','MedlinePlus'),
('Doxycycline','Dairy','yellow','Reduced absorption','DailyMed'),
('Paracetamol','Alcohol','red','Increased liver toxicity','DailyMed'),
('Ciprofloxacin','Caffeine','yellow','Increased nervousness','MedlinePlus');


/* ANTIBIOTIC MISUSE RULES TEST DATA */

INSERT INTO antibiotic_misuse_rules
(condition, recommendation, level, source) VALUES
('Common cold <5 days','Antibiotics not recommended','red','ICMR'),
('Sore throat without fever','Likely viral infection','yellow','WHO'),
('Mild diarrhea','Avoid self-medication','red','ICMR'),
('High fever >3 days','Doctor consultation required','green','ICMR'),
('Uncomplicated UTI symptoms','Medical evaluation needed','yellow','WHO');


/* AMR RISK MASTER TEST DATA */

INSERT INTO amr_risk_master VALUES
('Amoxicillin','Access','medium','Used for viral infections','WHO;ICMR'),
('Amoxiclav','Watch','high','Overused as first-line','WHO;ICMR'),
('Azithromycin','Watch','high','Used in common cold','WHO'),
('Ciprofloxacin','Watch','high','Empirical diarrhea use','ICMR'),
('Ceftriaxone','Watch','high','Hospital overuse','WHO'),
('Meropenem','Reserve','high','Last-resort misuse','WHO'),
('Colistin','Reserve','high','Critical care misuse','WHO');


/* REGULATORY METADATA TEST DATA */

INSERT INTO regulatory_metadata
(statement, source) VALUES
('This database is built exclusively from official free regulatory sources and is for educational use only.',
'FDA;WHO;EMA;CDSCO;ICMR'),
('This system does not provide diagnosis, treatment, or prescription advice.',
'General Disclaimer');


/* =======================================================================
   APP-SPECIFIC TABLE: BRAND MAPPING (For OCR)
   ======================================================================= */

CREATE TABLE IF NOT EXISTS brand_mapping (
    brand_name TEXT PRIMARY KEY,
    drug_id TEXT NOT NULL,
    manufacturer TEXT,
    FOREIGN KEY (drug_id) REFERENCES drug_master(drug_id)
);

/* BRAND MAPPING TEST DATA */
INSERT INTO brand_mapping VALUES ('Crocin','D001','GSK');
INSERT INTO brand_mapping VALUES ('Dolo 650','D001','Micro Labs');
INSERT INTO brand_mapping VALUES ('Calpol','D001','GSK');
INSERT INTO brand_mapping VALUES ('Brufen','D002','Abbott');
INSERT INTO brand_mapping VALUES ('Ibugesic','D002','Cipla');
INSERT INTO brand_mapping VALUES ('Voveran','D003','Novartis');
INSERT INTO brand_mapping VALUES ('Mox 500','D004','Ranbaxy');
INSERT INTO brand_mapping VALUES ('Novamox','D004','Cipla');
INSERT INTO brand_mapping VALUES ('Augmentin','D005','GSK');
INSERT INTO brand_mapping VALUES ('Clavam','D005','Alkem');
INSERT INTO brand_mapping VALUES ('Azithral','D006','Alembic');
INSERT INTO brand_mapping VALUES ('Azee','D006','Cipla');
INSERT INTO brand_mapping VALUES ('Flagyl','D007','Abbott');
INSERT INTO brand_mapping VALUES ('Metrogyl','D007','JB Chemicals');
INSERT INTO brand_mapping VALUES ('Ciplox','D008','Cipla');
INSERT INTO brand_mapping VALUES ('Cifran','D008','Ranbaxy');
INSERT INTO brand_mapping VALUES ('Glycomet','D009','USV');
INSERT INTO brand_mapping VALUES ('Amlong','D010','Micro Labs');

