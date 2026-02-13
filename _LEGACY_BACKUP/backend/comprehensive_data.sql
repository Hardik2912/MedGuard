
/* =======================================================================
   MED GUARD: COMPREHENSIVE MEDICAL KNOWLEDGE BASE
   Sources: FDA DailyMed, WHO AWaRe, ICMR Guidelines, MedlinePlus
   ======================================================================= */

/* 1. Clear existing data to avoid conflicts */
DELETE FROM drug_master;
DELETE FROM adr_master;
DELETE FROM drug_adr_map;
DELETE FROM drug_interaction_master;
DELETE FROM drug_class_interaction_rules;
DELETE FROM food_alcohol_interactions;
DELETE FROM antibiotic_misuse_rules;
DELETE FROM amr_risk_master;
DELETE FROM brand_mapping;

/* =======================================================================
   2. DRUG MASTER (Top ~40 Common Drugs in India/Global)
   ======================================================================= */
/* IDs: D001-D999 */

/* Pain & Inflammation */
INSERT INTO drug_master VALUES ('D001','Paracetamol','Analgesic','Fever, Mild Pain','Severe Liver Disease','Avoid alcohol (>3 drinks)','DailyMed');
INSERT INTO drug_master VALUES ('D002','Ibuprofen','NSAID','Pain, Inflammation','Peptic Ulcer, Kidney Disease','Avoid alcohol','FDA');
INSERT INTO drug_master VALUES ('D003','Diclofenac','NSAID','Arthritis, Severe Pain','Heart Disease, GI Bleeding','Avoid alcohol','EMA');
INSERT INTO drug_master VALUES ('D004','Aceclofenac','NSAID','Arthritis, Spondylitis','GI Bleeding, Kidney Failure','Avoid alcohol','CDSCO');
INSERT INTO drug_master VALUES ('D005','Tramadol','Opioid Analgesic','Severe Pain','History of Addiction, Respiratory issues','Strictly Avoid Alcohol','FDA');
INSERT INTO drug_master VALUES ('D006','Aspirin','NSAID / Antiplatelet','Pain, Heart Attack Prevention','Bleeding disorders, Peptic Ulcer','Avoid alcohol','FDA');

/* Antibiotics (Critical for AMR) */
INSERT INTO drug_master VALUES ('D010','Amoxicillin','Antibiotic (Penicillin)','Bacterial Safety Net','Penicillin Allergy','None','WHO');
INSERT INTO drug_master VALUES ('D011','Amoxiclav','Antibiotic (Penicillin+Inhibitor)','Respiratory/Skin Infections','Liver History (Jaundice)','None','FDA');
INSERT INTO drug_master VALUES ('D012','Azithromycin','Antibiotic (Macrolide)','Throat/Chest Infections','Heart Rhythm Issues (QT)','None','DailyMed');
INSERT INTO drug_master VALUES ('D013','Ciprofloxacin','Antibiotic (Fluoroquinolone)','UTI, Typhoid','Tendon issues, Myasthenia Gravis','None','FDA BBW');
INSERT INTO drug_master VALUES ('D014','Ofloxacin','Antibiotic (Fluoroquinolone)','Typhoid, Chest Infections','Epilepsy, Tendon issues','None','CDSCO');
INSERT INTO drug_master VALUES ('D015','Levofloxacin','Antibiotic (Fluoroquinolone)','Severe Pneumonia','History of Seizures','None','FDA');
INSERT INTO drug_master VALUES ('D016','Cefixime','Antibiotic (Cephalosporin)','Typhoid, UTI, RTI','Cephalosporin Allergy','None','WHO');
INSERT INTO drug_master VALUES ('D017','Doxycycline','Antibiotic (Tetracycline)','Acne, Chest Infections','Pregnancy, Children <8y','None','FDA');
INSERT INTO drug_master VALUES ('D018','Metronidazole','Antibiotic (Nitroimidazole)','Gut Infections, Dental','Liver Disease','NO ALCOHOL (Severe Reaction)','DailyMed');

/* Gastric / Acid Reflux */
INSERT INTO drug_master VALUES ('D020','Pantoprazole','PPI','Acidity, GERD','Long term bone fracture risk','Safe','FDA');
INSERT INTO drug_master VALUES ('D021','Omeprazole','PPI','Acidity, Ulcers','Liver impairment','Safe','FDA');
INSERT INTO drug_master VALUES ('D022','Ranitidine','H2 Blocker','Gastritis','Porphyria','Safe','CDSCO');
INSERT INTO drug_master VALUES ('D023','Domperidone','Prokinetic','Nausea, Vomiting','Heart Rhythm (QT)','Safe','EMA');

/* Diabetes */
INSERT INTO drug_master VALUES ('D030','Metformin','Antidiabetic (Biguanide)','Type 2 Diabetes','Kidney Failure (eGFR<30)','Avoid heavy alcohol','FDA');
INSERT INTO drug_master VALUES ('D031','Glimepiride','Antidiabetic (Sulfonylurea)','Type 2 Diabetes','Sulfa Allergy, Ketoacidosis','Avoid alcohol','DailyMed');
INSERT INTO drug_master VALUES ('D032','Vildagliptin','Antidiabetic (DPP4)','Type 2 Diabetes','Liver Impairment','Safe','EMA');

/* Hypertension / Heart */
INSERT INTO drug_master VALUES ('D040','Amlodipine','Antihypertensive (CCB)','High BP','Severe Low BP','Safe','FDA');
INSERT INTO drug_master VALUES ('D041','Telmisartan','Antihypertensive (ARB)','High BP','Pregnancy','Safe','FDA');
INSERT INTO drug_master VALUES ('D042','Losartan','Antihypertensive (ARB)','High BP','Pregnancy','Safe','FDA');
INSERT INTO drug_master VALUES ('D043','Atenolol','Beta Blocker','Angina, Hypertension','Asthma, Slow Heart Rate','Safe','FDA');
INSERT INTO drug_master VALUES ('D044','Atorvastatin','Statin','High Cholesterol','Active Liver Disease','Avoid excessive alcohol','FDA');

/* Allergy / Cold */
INSERT INTO drug_master VALUES ('D050','Cetirizine','Antihistamine','Allergy, Runny Nose','Kidney Failure','Avoid alcohol (drowsiness)','MedlinePlus');
INSERT INTO drug_master VALUES ('D051','Levocetirizine','Antihistamine','Allergy','Severe Kidney Failure','Avoid alcohol','FDA');
INSERT INTO drug_master VALUES ('D052','Chlorpheniramine','Antihistamine','Cold, Cough','Glaucoma, BPH','Avoid alcohol','MedlinePlus');
INSERT INTO drug_master VALUES ('D053','Phenylephrine','Decongestant','Blocked Nose','High BP, Heart Disease','Safe','FDA');

/* =======================================================================
   3. BRAND MAPPING (India Context)
   ======================================================================= */
/* Map common brands to Drug IDs */
INSERT INTO brand_mapping VALUES ('Dolo 650','D001','Micro Labs');
INSERT INTO brand_mapping VALUES ('Calpol','D001','GSK');
INSERT INTO brand_mapping VALUES ('Crocin','D001','GSK');
INSERT INTO brand_mapping VALUES ('Combiflam','D002','Sanofi'); /* Ibuprofen+Para */
INSERT INTO brand_mapping VALUES ('Brufen','D002','Abbott');
INSERT INTO brand_mapping VALUES ('Voveran','D003','Novartis');
INSERT INTO brand_mapping VALUES ('Zerodol','D004','Ipca');
INSERT INTO brand_mapping VALUES ('Ultracet','D005','Janssen');

INSERT INTO brand_mapping VALUES ('Augmentin','D011','GSK');
INSERT INTO brand_mapping VALUES ('Clavam','D011','Alkem');
INSERT INTO brand_mapping VALUES ('Mox','D010','Ranbaxy');
INSERT INTO brand_mapping VALUES ('Azithral','D012','Alembic');
INSERT INTO brand_mapping VALUES ('Azee','D012','Cipla');
INSERT INTO brand_mapping VALUES ('Ciplox','D013','Cipla');
INSERT INTO brand_mapping VALUES ('Zanocin','D014','Sun Pharma');
INSERT INTO brand_mapping VALUES ('Levoflox','D015','Cipla');
INSERT INTO brand_mapping VALUES ('Taxim-O','D016','Alkem');
INSERT INTO brand_mapping VALUES ('Flagyl','D018','Abbott');

INSERT INTO brand_mapping VALUES ('Pan 40','D020','Alkem');
INSERT INTO brand_mapping VALUES ('Pan D','D020','Alkem'); /* Often Panto+Domperidone, mapped to Panto for safety base */
INSERT INTO brand_mapping VALUES ('Omez','D021','Dr Reddys');
INSERT INTO brand_mapping VALUES ('Rantac','D022','JB Chemicals');

INSERT INTO brand_mapping VALUES ('Glycomet','D030','USV');
INSERT INTO brand_mapping VALUES ('Amaryl','D031','Sanofi');
INSERT INTO brand_mapping VALUES ('Galvus','D032','Novartis');

INSERT INTO brand_mapping VALUES ('Amlong','D040','Micro Labs');
INSERT INTO brand_mapping VALUES ('Telma','D041','Glenmark');
INSERT INTO brand_mapping VALUES ('Losar','D042','Unichem');
INSERT INTO brand_mapping VALUES ('Atorva','D044','Zydus');

INSERT INTO brand_mapping VALUES ('Cetzine','D050','GSK');
INSERT INTO brand_mapping VALUES ('Levocet','D051','Hetero');
INSERT INTO brand_mapping VALUES ('Sinarest','D001','Centaur'); /* Para+CPM+Phenyl */


/* =======================================================================
   4. ADR MASTER & MAPPING
   ======================================================================= */
/* Symptom Codes */
INSERT INTO adr_master VALUES ('A001','Nausea/Vomiting','Nausea','mild','common','DailyMed');
INSERT INTO adr_master VALUES ('A002','Diarrhea','Diarrhea','mild','common','DailyMed');
INSERT INTO adr_master VALUES ('A003','Dizziness/Drowsiness','Somnolence','mild','common','MedlinePlus');
INSERT INTO adr_master VALUES ('A004','Stomach Pain/Acidity','Dyspepsia','moderate','common','DailyMed');
INSERT INTO adr_master VALUES ('A005','Skin Rash','Rash','moderate','uncommon','FDA');
INSERT INTO adr_master VALUES ('A006','Liver Toxicity','Hepatotoxicity','serious','rare','FDA');
INSERT INTO adr_master VALUES ('A007','Kidney Damage','Nephrotoxicity','serious','rare','FDA');
INSERT INTO adr_master VALUES ('A008','Tendon Rupture','Tendinopathy','serious','rare','FDA BBW');
INSERT INTO adr_master VALUES ('A009','Severe Allergy','Anaphylaxis','serious','rare','FDA');
INSERT INTO adr_master VALUES ('A010','Irregular Heartbeat','QT Prolongation','serious','rare','FDA');

/* Specific Maps (Examples) */
INSERT INTO drug_adr_map VALUES ('D001','A006','red','Risk high if overdose (>4g/day) or mixing with alcohol','FDA');
INSERT INTO drug_adr_map VALUES ('D002','A004','yellow','Take with food to avoid stomach upset','DailyMed');
INSERT INTO drug_adr_map VALUES ('D011','A002','yellow','Probiotics may help; stay hydrated','DailyMed');
INSERT INTO drug_adr_map VALUES ('D013','A008','red','Stop immediately if heel/joint pain occurs','FDA Black Box');
INSERT INTO drug_adr_map VALUES ('D012','A010','red','Caution in heart patients','FDA');
INSERT INTO drug_adr_map VALUES ('D050','A003','green','Avoid driving if drowsy','MedlinePlus');
INSERT INTO drug_adr_map VALUES ('D030','A002','yellow','Common in first 2 weeks, usually settles','DailyMed');


/* =======================================================================
   5. DRUG INTERACTIONS
   ======================================================================= */
INSERT INTO drug_interaction_master VALUES ('I001','Ibuprofen','Aspirin','Reduced heart protection','Possible loss of aspirin heart benefit','moderate','FDA');
INSERT INTO drug_interaction_master VALUES ('I002','Atorvastatin','Azithromycin','Increased muscle risk','Risk of myopathy','moderate','FDA');
INSERT INTO drug_interaction_master VALUES ('I003','Metformin','Topiramate','Acidosis risk','Increased risk of lactic acidosis','moderate','FDA');
INSERT INTO drug_interaction_master VALUES ('I004','Amlodipine','Simvastatin','Increased statin levels','Limit Simvastatin dose to 20mg','serious','FDA');
INSERT INTO drug_interaction_master VALUES ('I009','Amoxiclav','Methotrexate','Toxic accumulation','Inhibits renal tubular secretion of methotrexate','serious','EMA');

/* Class Rules */
INSERT INTO drug_class_interaction_rules (drug_class_a, drug_class_b, risk_level, message, source) VALUES 
('NSAID','NSAID','red','Double dosing risk: Increased bleeding/ulcer risk','DailyMed');
INSERT INTO drug_class_interaction_rules (drug_class_a, drug_class_b, risk_level, message, source) VALUES 
('NSAID','Steroid','red','High risk of GI Bleeding/Ulcers','FDA');
INSERT INTO drug_class_interaction_rules (drug_class_a, drug_class_b, risk_level, message, source) VALUES 
('Antibiotic (Fluoroquinolone)','Antacid','yellow','Absorption blocked: Space by 2-4 hours','DailyMed');


/* =======================================================================
   6. FOOD & ALCOHOL
   ======================================================================= */
INSERT INTO food_alcohol_interactions (drug, trigger, risk_level, message, source) VALUES 
('Metronidazole','Alcohol','red','Disulfiram-like reaction (Severe vomiting, flushing)','FDA');
INSERT INTO food_alcohol_interactions (drug, trigger, risk_level, message, source) VALUES 
('Paracetamol','Alcohol','red','Increased risk of liver damage','FDA');
INSERT INTO food_alcohol_interactions (drug, trigger, risk_level, message, source) VALUES 
('Metformin','Alcohol','yellow','Increased risk of lactic acidosis','FDA');
INSERT INTO food_alcohol_interactions (drug, trigger, risk_level, message, source) VALUES 
('Atorvastatin','Grapefruit','yellow','Increased levels of drug in blood','FDA');
INSERT INTO food_alcohol_interactions (drug, trigger, risk_level, message, source) VALUES 
('Doxycycline','Dairy','yellow','Calcium binds drug; effectiveness reduced','DailyMed');


/* =======================================================================
   7. AMR & ANTIBIOTIC RULES (WHO AWaRe & ICMR)
   ======================================================================= */
/* Access (Green) */
INSERT INTO amr_risk_master VALUES ('Amoxicillin','Access','low','Safe first-line choice for most infections','WHO AWaRe');
INSERT INTO amr_risk_master VALUES ('Metronidazole','Access','low','Standard for anaerobic infections','WHO AWaRe');
INSERT INTO amr_risk_master VALUES ('Doxycycline','Access','low','First line for specific infections','WHO AWaRe');

/* Watch (Yellow - High Priority) */
INSERT INTO amr_risk_master VALUES ('Amoxiclav','Watch','medium','Reserve for resistant infections; overuse drives resistance','WHO AWaRe');
INSERT INTO amr_risk_master VALUES ('Azithromycin','Watch','high','High misuse potential; Long half-life drives resistance','WHO AWaRe');
INSERT INTO amr_risk_master VALUES ('Ciprofloxacin','Watch','high','Avoid in uncomplicated UTI; High resistance rates in India','ICMR 2024');
INSERT INTO amr_risk_master VALUES ('Ofloxacin','Watch','high','High resistance; Use only if sensitivity proven','ICMR');
INSERT INTO amr_risk_master VALUES ('Levofloxacin','Watch','high','Reserve for severe respiratory infections','WHO AWaRe');
INSERT INTO amr_risk_master VALUES ('Cefixime','Watch','medium','Oral 3rd gen Ceph; Overused in viral fevers','ICMR');

/* Rules */
INSERT INTO antibiotic_misuse_rules (condition, recommendation, level, source) VALUES 
('Common Cold / Flu','Antibiotics DO NOT kill viruses. Symptomatic relief only.','red','CDC/ICMR');
INSERT INTO antibiotic_misuse_rules (condition, recommendation, level, source) VALUES 
('Missed Doses','Skipping doses allows stronger bacteria to survive and mutate.','red','WHO');
INSERT INTO antibiotic_misuse_rules (condition, recommendation, level, source) VALUES 
('Leftover Meds','Never share or use leftover antibiotics.','red','WHO');
