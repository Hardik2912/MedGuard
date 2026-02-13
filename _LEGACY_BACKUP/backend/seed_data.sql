-- ================================================
-- MEDGUARD — Seed Data (15 Common Indian Medicines)
-- Sources: FDA DailyMed, WHO EML/AWaRe, CDSCO, ICMR, NIH
-- ================================================

PRAGMA foreign_keys = ON;

-- ==============================================
-- SOURCE MASTER
-- ==============================================
INSERT INTO source_master VALUES ('S1','FDA DailyMed','FDA','US','https://dailymed.nlm.nih.gov');
INSERT INTO source_master VALUES ('S2','WHO Essential Medicines List','WHO','Global','https://list.essentialmeds.org');
INSERT INTO source_master VALUES ('S3','ICMR AMR Guidelines','ICMR','India','https://main.icmr.nic.in');
INSERT INTO source_master VALUES ('S4','NIH MedlinePlus','NIH','US','https://medlineplus.gov');
INSERT INTO source_master VALUES ('S5','CDSCO India','CDSCO','India','https://cdsco.gov.in');
INSERT INTO source_master VALUES ('S6','WHO AWaRe Classification','WHO','Global','https://aware.essentialmeds.org');

-- ==============================================
-- DRUG MASTER (15 medicines)
-- ==============================================
INSERT INTO drug_master VALUES
('D01','Paracetamol','Analgesic/Antipyretic',0,'NA',
 'Fever and mild-to-moderate pain',
 'Avoid heavy alcohol – significantly increases liver damage risk',
 'Use lower dose in elderly; hepatic impairment risk increases',
 'DailyMed');

INSERT INTO drug_master VALUES
('D02','Amoxicillin','Penicillin Antibiotic',1,'Access',
 'Bacterial infections (ear, throat, urinary)',
 'Alcohol may increase stomach upset and reduce efficacy perception',
 'Generally safe; adjust dose if renal impairment',
 'WHO');

INSERT INTO drug_master VALUES
('D03','Ibuprofen','NSAID',0,'NA',
 'Pain, inflammation, and fever',
 'Alcohol significantly increases stomach bleeding risk',
 'High GI and renal risk in seniors; avoid prolonged use',
 'DailyMed');

INSERT INTO drug_master VALUES
('D04','Azithromycin','Macrolide Antibiotic',1,'Watch',
 'Respiratory and skin infections',
 'Limit alcohol; may worsen side effects',
 'Caution in elderly with cardiac history (QT prolongation)',
 'WHO');

INSERT INTO drug_master VALUES
('D05','Metformin','Biguanide/Antidiabetic',0,'NA',
 'Type 2 diabetes mellitus',
 'Alcohol increases lactic acidosis risk – avoid binge drinking',
 'Monitor renal function; contraindicated if eGFR < 30',
 'DailyMed');

INSERT INTO drug_master VALUES
('D06','Amlodipine','Calcium Channel Blocker',0,'NA',
 'Hypertension and angina',
 'Alcohol may enhance blood pressure lowering – dizziness risk',
 'Start at lower dose (2.5 mg) in elderly',
 'DailyMed');

INSERT INTO drug_master VALUES
('D07','Pantoprazole','Proton Pump Inhibitor',0,'NA',
 'Acid reflux and peptic ulcer',
 'No major alcohol interaction but alcohol worsens acidity',
 'Long-term use in elderly may cause magnesium deficiency and fractures',
 'DailyMed');

INSERT INTO drug_master VALUES
('D08','Cetirizine','Antihistamine',0,'NA',
 'Allergies, hay fever, urticaria',
 'Alcohol significantly increases drowsiness',
 'May cause more sedation in elderly; consider lower dose',
 'DailyMed');

INSERT INTO drug_master VALUES
('D09','Atorvastatin','Statin',0,'NA',
 'High cholesterol and cardiovascular risk reduction',
 'Heavy alcohol increases liver damage risk',
 'Monitor liver function; start conservative dose in elderly',
 'DailyMed');

INSERT INTO drug_master VALUES
('D10','Ciprofloxacin','Fluoroquinolone Antibiotic',1,'Watch',
 'Urinary, respiratory, and GI infections',
 'Alcohol may worsen CNS side effects (dizziness, confusion)',
 'High tendon rupture risk in elderly – use with extreme caution',
 'WHO');

INSERT INTO drug_master VALUES
('D11','Metronidazole','Nitroimidazole Antibiotic',1,'Access',
 'Anaerobic infections, amoebiasis, giardiasis',
 'STRICT NO ALCOHOL – causes severe disulfiram-like reaction (vomiting, flushing, tachycardia)',
 'Neurotoxicity risk increases in elderly with longer courses',
 'DailyMed');

INSERT INTO drug_master VALUES
('D12','Omeprazole','Proton Pump Inhibitor',0,'NA',
 'GERD, peptic ulcer, Zollinger-Ellison syndrome',
 'No direct interaction but alcohol worsens acid conditions',
 'Long-term use: risk of B12 deficiency, fractures in elderly',
 'DailyMed');

INSERT INTO drug_master VALUES
('D13','Losartan','ARB/Antihypertensive',0,'NA',
 'Hypertension and diabetic nephropathy',
 'Alcohol may enhance hypotension – dizziness and falls risk',
 'Monitor potassium levels; renal dose adjustment in elderly',
 'DailyMed');

INSERT INTO drug_master VALUES
('D14','Diclofenac','NSAID',0,'NA',
 'Pain, inflammation, arthritis',
 'Alcohol increases GI bleeding and ulcer risk significantly',
 'Very high GI and cardiovascular risk in elderly – prefer alternatives',
 'DailyMed');

INSERT INTO drug_master VALUES
('D15','Cefixime','Cephalosporin Antibiotic',1,'Access',
 'UTI, respiratory infections, typhoid',
 'Alcohol may cause flushing and nausea (mild disulfiram effect)',
 'Adjust dose if renal impairment; generally safe in elderly',
 'WHO');

-- ==============================================
-- BRAND MAPPING
-- ==============================================
INSERT INTO brand_mapping VALUES ('Crocin','D01','GSK');
INSERT INTO brand_mapping VALUES ('Dolo 650','D01','Micro Labs');
INSERT INTO brand_mapping VALUES ('Calpol','D01','GSK');
INSERT INTO brand_mapping VALUES ('Mox 500','D02','Ranbaxy');
INSERT INTO brand_mapping VALUES ('Amoxil','D02','GSK');
INSERT INTO brand_mapping VALUES ('Novamox','D02','Cipla');
INSERT INTO brand_mapping VALUES ('Brufen','D03','Abbott');
INSERT INTO brand_mapping VALUES ('Ibugesic','D03','Cipla');
INSERT INTO brand_mapping VALUES ('Azithral','D04','Alembic');
INSERT INTO brand_mapping VALUES ('Zithromax','D04','Pfizer');
INSERT INTO brand_mapping VALUES ('Azee','D04','Cipla');
INSERT INTO brand_mapping VALUES ('Glycomet','D05','USV');
INSERT INTO brand_mapping VALUES ('Glucophage','D05','Merck');
INSERT INTO brand_mapping VALUES ('Amlong','D06','Micro Labs');
INSERT INTO brand_mapping VALUES ('Amlip','D06','Cipla');
INSERT INTO brand_mapping VALUES ('Pan 40','D07','Alkem');
INSERT INTO brand_mapping VALUES ('Pantocid','D07','Sun Pharma');
INSERT INTO brand_mapping VALUES ('Pan-D','D07','Alkem');
INSERT INTO brand_mapping VALUES ('Cetzine','D08','GSK');
INSERT INTO brand_mapping VALUES ('Alerid','D08','Cipla');
INSERT INTO brand_mapping VALUES ('Atorva','D09','Zydus');
INSERT INTO brand_mapping VALUES ('Lipitor','D09','Pfizer');
INSERT INTO brand_mapping VALUES ('Ciplox','D10','Cipla');
INSERT INTO brand_mapping VALUES ('Cifran','D10','Ranbaxy');
INSERT INTO brand_mapping VALUES ('Flagyl','D11','Abbott');
INSERT INTO brand_mapping VALUES ('Metrogyl','D11','JB Chemicals');
INSERT INTO brand_mapping VALUES ('Omez','D12','Dr. Reddys');
INSERT INTO brand_mapping VALUES ('Prilosec','D12','AstraZeneca');
INSERT INTO brand_mapping VALUES ('Losacar','D13','Cadila');
INSERT INTO brand_mapping VALUES ('Cozaar','D13','MSD');
INSERT INTO brand_mapping VALUES ('Voveran','D14','Novartis');
INSERT INTO brand_mapping VALUES ('Diclogesic','D14','Sanofi');
INSERT INTO brand_mapping VALUES ('Taxim-O','D15','Alkem');
INSERT INTO brand_mapping VALUES ('Cefi','D15','Cipla');

-- ==============================================
-- ADR MASTER
-- ==============================================
INSERT INTO adr_master VALUES ('A01','Skin rash','Exanthema/Urticaria','moderate','common',0,'FDA');
INSERT INTO adr_master VALUES ('A02','Black or tarry stools','GI hemorrhage','serious','uncommon',1,'FDA');
INSERT INTO adr_master VALUES ('A03','Severe watery diarrhea','C. difficile colitis','serious','rare',1,'WHO');
INSERT INTO adr_master VALUES ('A04','Stomach burning or pain','Gastritis/Dyspepsia','moderate','common',0,'NIH');
INSERT INTO adr_master VALUES ('A05','Liver damage signs (yellowing skin, dark urine)','Hepatotoxicity','serious','rare',1,'FDA');
INSERT INTO adr_master VALUES ('A06','Severe allergic reaction (swelling, breathing difficulty)','Anaphylaxis','serious','rare',1,'FDA');
INSERT INTO adr_master VALUES ('A07','Dizziness or lightheadedness','Orthostatic hypotension','mild','common',0,'NIH');
INSERT INTO adr_master VALUES ('A08','Nausea and vomiting','Emesis','mild','common',0,'NIH');
INSERT INTO adr_master VALUES ('A09','Tendon pain or rupture','Tendinopathy','serious','uncommon',1,'FDA');
INSERT INTO adr_master VALUES ('A10','Numbness or tingling in hands/feet','Peripheral neuropathy','moderate','uncommon',0,'FDA');
INSERT INTO adr_master VALUES ('A11','Muscle pain or weakness','Myalgia/Rhabdomyolysis','moderate','uncommon',0,'FDA');
INSERT INTO adr_master VALUES ('A12','Drowsiness','Sedation','mild','common',0,'NIH');
INSERT INTO adr_master VALUES ('A13','Swollen ankles','Peripheral edema','mild','common',0,'NIH');
INSERT INTO adr_master VALUES ('A14','Heart rhythm changes','QT prolongation','serious','rare',1,'FDA');
INSERT INTO adr_master VALUES ('A15','Lactic acidosis (rapid breathing, muscle pain, fatigue)','Lactic acidosis','serious','rare',1,'FDA');
INSERT INTO adr_master VALUES ('A16','Metallic taste in mouth','Dysgeusia','mild','common',0,'NIH');
INSERT INTO adr_master VALUES ('A17','Bone fracture (long-term PPI use)','Osteoporotic fracture','moderate','rare',0,'FDA');
INSERT INTO adr_master VALUES ('A18','Kidney damage','Nephrotoxicity','serious','rare',1,'FDA');

-- ==============================================
-- DRUG → ADR MAPPING
-- ==============================================
-- Paracetamol
INSERT INTO drug_adr_map VALUES ('D01','A05','red','URGENT: Stop immediately if jaundice appears – possible liver damage','FDA');
INSERT INTO drug_adr_map VALUES ('D01','A01','yellow','Mild rash may occur; consult doctor if persists','FDA');
INSERT INTO drug_adr_map VALUES ('D01','A08','green','Mild nausea usually resolves – take with food','NIH');

-- Amoxicillin
INSERT INTO drug_adr_map VALUES ('D02','A01','yellow','Stop and consult if rash spreads or is accompanied by fever','FDA');
INSERT INTO drug_adr_map VALUES ('D02','A03','red','URGENT: Watery diarrhea after antibiotic may indicate C. diff – seek care','WHO');
INSERT INTO drug_adr_map VALUES ('D02','A06','red','EMERGENCY: Anaphylaxis possible with penicillin allergy – call emergency','FDA');

-- Ibuprofen
INSERT INTO drug_adr_map VALUES ('D03','A02','red','URGENT: Black stools indicate possible GI bleeding – seek immediate care','FDA');
INSERT INTO drug_adr_map VALUES ('D03','A04','yellow','Stomach irritation common; take with food, report if severe','NIH');
INSERT INTO drug_adr_map VALUES ('D03','A18','yellow','Prolonged use may affect kidneys – monitor with doctor','FDA');

-- Azithromycin
INSERT INTO drug_adr_map VALUES ('D04','A14','red','URGENT: Report heart palpitations or fainting – QT risk','FDA');
INSERT INTO drug_adr_map VALUES ('D04','A03','red','Severe diarrhea may indicate C. diff infection – seek care','WHO');
INSERT INTO drug_adr_map VALUES ('D04','A08','green','Mild nausea common – take with food','NIH');

-- Metformin
INSERT INTO drug_adr_map VALUES ('D05','A15','red','EMERGENCY: Rapid breathing + muscle pain may indicate lactic acidosis','FDA');
INSERT INTO drug_adr_map VALUES ('D05','A04','yellow','GI upset common initially – usually improves in 1-2 weeks','NIH');
INSERT INTO drug_adr_map VALUES ('D05','A16','green','Metallic taste is common and harmless – resolves over time','NIH');

-- Amlodipine
INSERT INTO drug_adr_map VALUES ('D06','A13','yellow','Ankle swelling common; report if severe or worsening','NIH');
INSERT INTO drug_adr_map VALUES ('D06','A07','yellow','Dizziness may occur – rise slowly from sitting/lying','NIH');

-- Pantoprazole
INSERT INTO drug_adr_map VALUES ('D07','A17','yellow','Long-term PPI use may weaken bones – discuss with doctor','FDA');
INSERT INTO drug_adr_map VALUES ('D07','A04','green','Mild stomach discomfort usually resolves','NIH');

-- Cetirizine
INSERT INTO drug_adr_map VALUES ('D08','A12','yellow','Drowsiness is common – avoid driving or operating machinery','NIH');

-- Atorvastatin
INSERT INTO drug_adr_map VALUES ('D09','A11','yellow','Report persistent muscle pain – rare risk of rhabdomyolysis','FDA');
INSERT INTO drug_adr_map VALUES ('D09','A05','red','URGENT: Yellowing skin or dark urine may indicate liver damage','FDA');

-- Ciprofloxacin
INSERT INTO drug_adr_map VALUES ('D10','A09','red','URGENT: Stop immediately if tendon pain – rupture risk esp. in elderly','FDA');
INSERT INTO drug_adr_map VALUES ('D10','A10','yellow','Numbness/tingling may indicate nerve damage – consult doctor','FDA');

-- Metronidazole
INSERT INTO drug_adr_map VALUES ('D11','A10','yellow','Numbness/tingling with long courses – report to doctor','FDA');
INSERT INTO drug_adr_map VALUES ('D11','A16','green','Metallic taste is common and harmless','NIH');
INSERT INTO drug_adr_map VALUES ('D11','A08','yellow','Nausea common; STRICTLY avoid alcohol (severe reaction)','DailyMed');

-- Omeprazole
INSERT INTO drug_adr_map VALUES ('D12','A17','yellow','Prolonged use may increase fracture risk – review with doctor','FDA');

-- Losartan
INSERT INTO drug_adr_map VALUES ('D13','A07','yellow','Dizziness more likely when starting – rise slowly','NIH');

-- Diclofenac
INSERT INTO drug_adr_map VALUES ('D14','A02','red','URGENT: Black stools indicate bleeding – stop and seek emergency care','FDA');
INSERT INTO drug_adr_map VALUES ('D14','A04','yellow','Stomach pain common – take with food, consider gastroprotection','NIH');
INSERT INTO drug_adr_map VALUES ('D14','A18','yellow','May affect kidneys – avoid prolonged use, especially in elderly','FDA');

-- Cefixime
INSERT INTO drug_adr_map VALUES ('D15','A03','red','Severe diarrhea post-antibiotic may indicate C. diff – seek care','WHO');
INSERT INTO drug_adr_map VALUES ('D15','A01','yellow','Rash may indicate allergy – stop if spreads','FDA');

-- ==============================================
-- DRUG–DRUG INTERACTIONS
-- ==============================================
INSERT INTO drug_interaction_master VALUES ('D03','D01','Additive hepatotoxicity at high doses','yellow',
 'Avoid high-dose combination; monitor liver function','FDA');

INSERT INTO drug_interaction_master VALUES ('D04','D03','Increased GI bleeding risk via platelet effects','red',
 'Do not combine without medical supervision','FDA');

INSERT INTO drug_interaction_master VALUES ('D03','D14','Dual NSAID – compounded GI and renal risk','red',
 'NEVER take two NSAIDs together','FDA');

INSERT INTO drug_interaction_master VALUES ('D05','D10','Ciprofloxacin may alter blood sugar levels with metformin','yellow',
 'Monitor blood glucose more frequently during co-use','FDA');

INSERT INTO drug_interaction_master VALUES ('D09','D04','Azithromycin may increase statin levels – myopathy risk','yellow',
 'Report any unusual muscle pain during co-administration','FDA');

INSERT INTO drug_interaction_master VALUES ('D06','D13','Dual antihypertensives – excessive blood pressure drop','yellow',
 'Monitor BP closely; may need dose adjustment','NIH');

INSERT INTO drug_interaction_master VALUES ('D09','D07','PPI may slightly reduce statin absorption','yellow',
 'Minor interaction – usually no dose change needed','NIH');

INSERT INTO drug_interaction_master VALUES ('D10','D11','Additive CNS and neurotoxicity risk','yellow',
 'Increased seizure risk in susceptible patients','FDA');

INSERT INTO drug_interaction_master VALUES ('D03','D13','NSAID may reduce antihypertensive effect of losartan','yellow',
 'BP may increase – monitor during co-use','FDA');

INSERT INTO drug_interaction_master VALUES ('D14','D05','Diclofenac may impair renal function, affecting metformin clearance','yellow',
 'Monitor renal function if using together','FDA');

-- ==============================================
-- FOOD & ALCOHOL INTERACTIONS
-- ==============================================
INSERT INTO food_alcohol_interactions VALUES ('D01','alcohol','red','Liver failure risk: paracetamol + alcohol is dangerous','NIH');
INSERT INTO food_alcohol_interactions VALUES ('D02','alcohol','yellow','May increase nausea and reduce perceived efficacy','WHO');
INSERT INTO food_alcohol_interactions VALUES ('D03','alcohol','red','Severely increases stomach bleeding risk','NIH');
INSERT INTO food_alcohol_interactions VALUES ('D04','alcohol','yellow','May worsen dizziness and stomach upset','WHO');
INSERT INTO food_alcohol_interactions VALUES ('D05','alcohol','red','Risk of lactic acidosis with binge drinking','FDA');
INSERT INTO food_alcohol_interactions VALUES ('D06','alcohol','yellow','Enhanced BP drop – dizziness and fall risk','NIH');
INSERT INTO food_alcohol_interactions VALUES ('D08','alcohol','yellow','Significantly increases drowsiness','NIH');
INSERT INTO food_alcohol_interactions VALUES ('D09','alcohol','yellow','Increases liver damage risk with heavy drinking','FDA');
INSERT INTO food_alcohol_interactions VALUES ('D10','alcohol','yellow','Worsens CNS side effects (dizziness, confusion)','FDA');
INSERT INTO food_alcohol_interactions VALUES ('D11','alcohol','red','STRICT: Disulfiram-like reaction – vomiting, flushing, tachycardia','DailyMed');
INSERT INTO food_alcohol_interactions VALUES ('D13','alcohol','yellow','Enhanced hypotension – dizziness and falls','NIH');
INSERT INTO food_alcohol_interactions VALUES ('D14','alcohol','red','Very high GI bleeding and ulcer risk','NIH');

-- Grapefruit interactions
INSERT INTO food_alcohol_interactions VALUES ('D06','grapefruit','yellow','Grapefruit increases amlodipine levels – excessive BP drop','FDA');
INSERT INTO food_alcohol_interactions VALUES ('D09','grapefruit','yellow','Grapefruit increases statin blood levels – myopathy risk','FDA');
INSERT INTO food_alcohol_interactions VALUES ('D13','grapefruit','yellow','May increase losartan conversion – monitor BP','FDA');

-- Dairy interactions with antibiotics
INSERT INTO food_alcohol_interactions VALUES ('D10','dairy products','yellow','Calcium in dairy reduces ciprofloxacin absorption – take 2h apart','FDA');
INSERT INTO food_alcohol_interactions VALUES ('D04','antacids','yellow','Antacids reduce azithromycin absorption – separate by 2 hours','FDA');

-- ==============================================
-- ANTIBIOTIC MISUSE RULES
-- ==============================================
INSERT INTO antibiotic_misuse_rules VALUES ('R1','missed_doses >= 2',
 'Missing 2+ antibiotic doses significantly increases resistance risk. Complete your full course.',
 'red','ICMR');
INSERT INTO antibiotic_misuse_rules VALUES ('R2','missed_doses == 1',
 'Missing 1 dose reduces treatment effectiveness. Take the missed dose as soon as remembered.',
 'yellow','ICMR');
INSERT INTO antibiotic_misuse_rules VALUES ('R3','course_duration < prescribed',
 'Stopping antibiotics early promotes resistant bacteria. Always finish the full course even if feeling better.',
 'red','WHO');
INSERT INTO antibiotic_misuse_rules VALUES ('R4','self_prescribed == true',
 'Self-prescribing antibiotics is a leading cause of antimicrobial resistance. Always consult a doctor.',
 'red','ICMR');
INSERT INTO antibiotic_misuse_rules VALUES ('R5','watch_category_without_prescription',
 'WHO Watch-category antibiotics should only be used when specifically prescribed for confirmed infections.',
 'yellow','WHO');

-- ==============================================
-- AMR RISK MASTER
-- ==============================================
INSERT INTO amr_risk_master VALUES ('D02','Access','medium','Complete full course. Amoxicillin resistance is rising in India.','WHO');
INSERT INTO amr_risk_master VALUES ('D04','Watch','high','Azithromycin is WHO Watch category – restrict use to specific indications only.','WHO');
INSERT INTO amr_risk_master VALUES ('D10','Watch','high','Ciprofloxacin resistance is critically high in India. Use only when culture-confirmed.','ICMR');
INSERT INTO amr_risk_master VALUES ('D11','Access','medium','Complete course. Metronidazole resistance in H. pylori is increasing.','WHO');
INSERT INTO amr_risk_master VALUES ('D15','Access','medium','Cefixime resistance growing in enteric fever. Complete full prescribed course.','ICMR');

-- ==============================================
-- SEVERITY RULES (drives risk engine)
-- ==============================================
INSERT INTO severity_rules VALUES ('SR01','adr_severity','serious','red','Serious ADR reported → RED alert');
INSERT INTO severity_rules VALUES ('SR02','adr_severity','moderate','yellow','Moderate ADR reported → YELLOW alert');
INSERT INTO severity_rules VALUES ('SR03','adr_severity','mild','green','Mild ADR → GREEN informational');
INSERT INTO severity_rules VALUES ('SR04','interaction_severity','red','red','Red-severity drug interaction → RED alert');
INSERT INTO severity_rules VALUES ('SR05','interaction_severity','yellow','yellow','Yellow-severity interaction → YELLOW caution');
INSERT INTO severity_rules VALUES ('SR06','missed_doses','>=2','red','2+ missed antibiotic doses → RED AMR risk');
INSERT INTO severity_rules VALUES ('SR07','missed_doses','1','yellow','1 missed dose → YELLOW caution');
INSERT INTO severity_rules VALUES ('SR08','alcohol_interaction','red','red','Red alcohol interaction → RED alert');
INSERT INTO severity_rules VALUES ('SR09','alcohol_interaction','yellow','yellow','Yellow alcohol interaction → YELLOW caution');
INSERT INTO severity_rules VALUES ('SR10','elderly_flag','has_caution','yellow','Elderly caution flagged → YELLOW alert');
INSERT INTO severity_rules VALUES ('SR11','amr_risk','high','red','High AMR risk drug → RED stewardship alert');
INSERT INTO severity_rules VALUES ('SR12','amr_risk','medium','yellow','Medium AMR risk → YELLOW awareness');

-- ==============================================
-- EVIDENCE MAP (linking claims to sources)
-- ==============================================
INSERT INTO evidence_map (entity_type, entity_id, source_id, claim)
VALUES ('drug','D01','S1','Paracetamol hepatotoxicity documented in FDA DailyMed labeling');
INSERT INTO evidence_map (entity_type, entity_id, source_id, claim)
VALUES ('drug','D02','S2','Amoxicillin listed as WHO Access category essential medicine');
INSERT INTO evidence_map (entity_type, entity_id, source_id, claim)
VALUES ('drug','D04','S6','Azithromycin classified as WHO AWaRe Watch category');
INSERT INTO evidence_map (entity_type, entity_id, source_id, claim)
VALUES ('drug','D10','S3','ICMR reports critically high ciprofloxacin resistance rates in India');
INSERT INTO evidence_map (entity_type, entity_id, source_id, claim)
VALUES ('drug','D10','S6','Ciprofloxacin classified as WHO AWaRe Watch category');
INSERT INTO evidence_map (entity_type, entity_id, source_id, claim)
VALUES ('drug','D11','S1','Metronidazole-alcohol disulfiram reaction documented in FDA labeling');
INSERT INTO evidence_map (entity_type, entity_id, source_id, claim)
VALUES ('interaction','D03_D14','S1','Dual NSAID contraindication per FDA guidelines');
INSERT INTO evidence_map (entity_type, entity_id, source_id, claim)
VALUES ('adr','A09','S1','Fluoroquinolone tendon rupture risk – FDA black box warning');
INSERT INTO evidence_map (entity_type, entity_id, source_id, claim)
VALUES ('amr','D10','S3','ICMR Treatment Guidelines for AMR classify ciprofloxacin resistance as priority concern');
INSERT INTO evidence_map (entity_type, entity_id, source_id, claim)
VALUES ('drug','D15','S3','ICMR notes rising cefixime resistance in enteric fever isolates');
