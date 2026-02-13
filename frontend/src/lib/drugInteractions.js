/**
 * ═══════════════════════════════════════════════════════════
 * MEDGUARD — Drug Interactions Engine
 * ═══════════════════════════════════════════════════════════
 *
 * Client-side drug interaction checking with built-in database
 * of common Indian-market drug pairs + OpenFDA API fallback.
 *
 * Ported from the legacy risk_engine.js backend logic.
 */

import { safeFetch } from './safeAsync';

// ─── Built-In Interaction Database ──────────────────────
// Common drug-drug interactions (Indian market focus)
// Format: "drugA_lowercase+drugB_lowercase" (sorted alphabetically)
const KNOWN_INTERACTIONS = {
    // NSAIDs conflicts
    'aspirin+ibuprofen': {
        level: 'red', type: 'interaction',
        message: 'Aspirin + Ibuprofen: Ibuprofen can block aspirin\'s heart-protective effects and increase bleeding risk.',
        advice: 'Avoid using together. Consult your doctor for alternatives.'
    },
    'diclofenac+ibuprofen': {
        level: 'red', type: 'interaction',
        message: 'Two NSAIDs together greatly increase risk of stomach ulcers and kidney damage.',
        advice: 'Never take two NSAIDs at the same time.'
    },
    'aspirin+diclofenac': {
        level: 'red', type: 'interaction',
        message: 'Both are blood thinners. Taking together greatly increases bleeding risk.',
        advice: 'Avoid combination. Consult doctor.'
    },
    'ibuprofen+naproxen': {
        level: 'red', type: 'interaction',
        message: 'Dual NSAID: doubles the risk of stomach bleeding and kidney problems.',
        advice: 'Use only one NSAID at a time.'
    },

    // Cardiovascular
    'amlodipine+simvastatin': {
        level: 'yellow', type: 'interaction',
        message: 'Amlodipine increases simvastatin levels, raising risk of muscle damage (rhabdomyolysis).',
        advice: 'Simvastatin dose should not exceed 20mg when combined with Amlodipine.'
    },
    'atenolol+verapamil': {
        level: 'red', type: 'interaction',
        message: 'Both slow heart rate. Together can cause dangerously slow heartbeat or heart block.',
        advice: 'Avoid combination. Contact cardiologist.'
    },
    'digoxin+amiodarone': {
        level: 'red', type: 'interaction',
        message: 'Amiodarone increases digoxin levels to toxic range.',
        advice: 'If used together, digoxin dose must be halved. Monitor closely.'
    },
    'enalapril+potassium': {
        level: 'yellow', type: 'interaction',
        message: 'ACE inhibitors retain potassium. Extra potassium can cause dangerous hyperkalemia.',
        advice: 'Avoid potassium supplements unless prescribed with monitoring.'
    },
    'lisinopril+potassium': {
        level: 'yellow', type: 'interaction',
        message: 'ACE inhibitors retain potassium. Extra potassium can cause dangerous hyperkalemia.',
        advice: 'Avoid potassium supplements unless prescribed with monitoring.'
    },

    // Diabetes
    'glimepiride+insulin': {
        level: 'yellow', type: 'interaction',
        message: 'Both lower blood sugar. Together may cause dangerous hypoglycemia.',
        advice: 'Monitor blood sugar frequently. Watch for dizziness, sweating, confusion.'
    },
    'metformin+alcohol': {
        level: 'red', type: 'interaction',
        message: 'Metformin + Alcohol: Risk of life-threatening lactic acidosis.',
        advice: 'Avoid alcohol completely while on Metformin.'
    },

    // Antibiotics
    'amoxicillin+methotrexate': {
        level: 'red', type: 'interaction',
        message: 'Amoxicillin reduces methotrexate excretion, causing toxic accumulation.',
        advice: 'Use alternative antibiotic or monitor methotrexate levels closely.'
    },
    'azithromycin+amiodarone': {
        level: 'red', type: 'interaction',
        message: 'Both prolong QT interval. Together can cause fatal heart arrhythmia.',
        advice: 'Avoid combination. Use an alternative antibiotic.'
    },
    'ciprofloxacin+theophylline': {
        level: 'red', type: 'interaction',
        message: 'Ciprofloxacin dramatically increases theophylline levels → seizures and cardiac arrhythmia.',
        advice: 'Avoid combination or reduce theophylline dose by 50%.'
    },
    'metronidazole+alcohol': {
        level: 'red', type: 'interaction',
        message: 'Causes severe nausea, vomiting, flushing, and headache (disulfiram reaction).',
        advice: 'Absolutely no alcohol while on Metronidazole and for 48h after.'
    },

    // Blood Thinners
    'warfarin+aspirin': {
        level: 'red', type: 'interaction',
        message: 'Both thin blood. Together greatly increases risk of serious bleeding.',
        advice: 'Use only under strict medical supervision with regular INR monitoring.'
    },
    'warfarin+ibuprofen': {
        level: 'red', type: 'interaction',
        message: 'Ibuprofen increases warfarin\'s blood-thinning effect. Risk of internal bleeding.',
        advice: 'Use Paracetamol instead of Ibuprofen for pain while on Warfarin.'
    },
    'clopidogrel+omeprazole': {
        level: 'yellow', type: 'interaction',
        message: 'Omeprazole reduces clopidogrel effectiveness, increasing risk of heart attack/stroke.',
        advice: 'Use Pantoprazole instead of Omeprazole if you need an acid blocker.'
    },

    // CNS / Pain
    'tramadol+ssri': {
        level: 'red', type: 'interaction',
        message: 'Risk of serotonin syndrome — potentially fatal overload of serotonin.',
        advice: 'Avoid combination. Symptoms: confusion, rapid heart rate, high fever.'
    },
    'alprazolam+alcohol': {
        level: 'red', type: 'interaction',
        message: 'Both depress breathing. Together can cause respiratory failure and death.',
        advice: 'Never mix benzodiazepines with alcohol.'
    },

    // GI / Acid
    'antacid+ciprofloxacin': {
        level: 'yellow', type: 'interaction',
        message: 'Antacids block ciprofloxacin absorption, making the antibiotic ineffective.',
        advice: 'Take ciprofloxacin 2 hours before or 6 hours after antacids.'
    },

    // Thyroid
    'levothyroxine+calcium': {
        level: 'yellow', type: 'interaction',
        message: 'Calcium supplements block levothyroxine absorption.',
        advice: 'Take levothyroxine at least 4 hours before calcium supplements.'
    },
    'levothyroxine+iron': {
        level: 'yellow', type: 'interaction',
        message: 'Iron supplements block levothyroxine absorption.',
        advice: 'Take levothyroxine at least 4 hours before iron supplements.'
    },
};

// ─── ADR Database (Common Side Effects) ─────────────────
const KNOWN_ADRS = {
    'ibuprofen': [
        { symptom: 'Stomach Pain / Acidity', severity: 'medium', frequency: 'common' },
        { symptom: 'Nausea', severity: 'low', frequency: 'common' },
        { symptom: 'Dizziness', severity: 'medium', frequency: 'uncommon' },
        { symptom: 'Kidney issues (long-term)', severity: 'high', frequency: 'rare' },
    ],
    'metformin': [
        { symptom: 'Stomach upset / Diarrhea', severity: 'medium', frequency: 'very common' },
        { symptom: 'Metallic taste', severity: 'low', frequency: 'common' },
        { symptom: 'Vitamin B12 deficiency (long-term)', severity: 'medium', frequency: 'uncommon' },
        { symptom: 'Lactic Acidosis', severity: 'high', frequency: 'very rare - emergency' },
    ],
    'amoxicillin': [
        { symptom: 'Skin Rash / Itching', severity: 'medium', frequency: 'common' },
        { symptom: 'Diarrhea', severity: 'low', frequency: 'common' },
        { symptom: 'Swelling of Face/Lips (allergic)', severity: 'high', frequency: 'rare - emergency' },
    ],
    'lisinopril': [
        { symptom: 'Dry Cough (Persistent)', severity: 'medium', frequency: 'very common' },
        { symptom: 'Dizziness', severity: 'medium', frequency: 'common' },
        { symptom: 'Swelling of Face/Lips (angioedema)', severity: 'high', frequency: 'rare - emergency' },
        { symptom: 'High potassium', severity: 'high', frequency: 'uncommon' },
    ],
    'atorvastatin': [
        { symptom: 'Muscle Pain / Weakness', severity: 'medium', frequency: 'common' },
        { symptom: 'Liver enzyme elevation', severity: 'medium', frequency: 'uncommon' },
        { symptom: 'Rhabdomyolysis', severity: 'high', frequency: 'very rare - emergency' },
    ],
    'amlodipine': [
        { symptom: 'Swollen ankles', severity: 'low', frequency: 'very common' },
        { symptom: 'Dizziness', severity: 'medium', frequency: 'common' },
        { symptom: 'Flushing / Headache', severity: 'low', frequency: 'common' },
    ],
    'omeprazole': [
        { symptom: 'Headache', severity: 'low', frequency: 'common' },
        { symptom: 'Magnesium deficiency (long-term)', severity: 'medium', frequency: 'uncommon' },
        { symptom: 'Bone fracture risk (long-term)', severity: 'high', frequency: 'rare' },
    ],
    'azithromycin': [
        { symptom: 'Nausea / Diarrhea', severity: 'low', frequency: 'common' },
        { symptom: 'Stomach Pain', severity: 'medium', frequency: 'common' },
        { symptom: 'QT prolongation (heart)', severity: 'high', frequency: 'rare' },
    ],
    'ciprofloxacin': [
        { symptom: 'Tendon pain / rupture', severity: 'high', frequency: 'uncommon' },
        { symptom: 'Nausea', severity: 'low', frequency: 'common' },
        { symptom: 'Dizziness / Confusion', severity: 'medium', frequency: 'uncommon' },
        { symptom: 'Nerve damage (peripheral neuropathy)', severity: 'high', frequency: 'rare' },
    ],
    'paracetamol': [
        { symptom: 'Liver damage (overdose)', severity: 'high', frequency: 'dose-dependent' },
        { symptom: 'Skin Rash (allergic)', severity: 'medium', frequency: 'rare' },
    ],
    'aspirin': [
        { symptom: 'Stomach bleeding', severity: 'high', frequency: 'uncommon' },
        { symptom: 'Stomach Pain / Acidity', severity: 'medium', frequency: 'common' },
        { symptom: 'Tinnitus (ear ringing)', severity: 'medium', frequency: 'uncommon' },
    ],
    'cetirizine': [
        { symptom: 'Drowsiness', severity: 'low', frequency: 'common' },
        { symptom: 'Dry mouth', severity: 'low', frequency: 'common' },
    ],
    'pantoprazole': [
        { symptom: 'Headache', severity: 'low', frequency: 'common' },
        { symptom: 'Vitamin B12 / Magnesium deficiency (long-term)', severity: 'medium', frequency: 'uncommon' },
    ],
    'losartan': [
        { symptom: 'Dizziness', severity: 'medium', frequency: 'common' },
        { symptom: 'High potassium', severity: 'high', frequency: 'uncommon' },
    ],
    'glimepiride': [
        { symptom: 'Low blood sugar (hypoglycemia)', severity: 'high', frequency: 'common' },
        { symptom: 'Weight gain', severity: 'low', frequency: 'common' },
    ],
    'clopidogrel': [
        { symptom: 'Bleeding / Bruising', severity: 'medium', frequency: 'common' },
        { symptom: 'Stomach upset', severity: 'low', frequency: 'common' },
    ],
};

// ─── Antibiotic List (for AMR checks) ───────────────────
const ANTIBIOTICS = new Set([
    'amoxicillin', 'azithromycin', 'ciprofloxacin', 'metronidazole',
    'doxycycline', 'cephalexin', 'levofloxacin', 'clindamycin',
    'trimethoprim', 'nitrofurantoin', 'augmentin', 'amoxiclav',
    'cefixime', 'ceftriaxone', 'ofloxacin', 'norfloxacin',
    'gentamicin', 'linezolid', 'vancomycin', 'meropenem',
    'colistin', 'rifampicin', 'isoniazid', 'ethambutol',
]);

// ─── Helper: Normalize drug name ────────────────────────
function normalize(name) {
    return (name || '')
        .toLowerCase()
        .trim()
        .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical notes
        .replace(/\d+\s*mg/gi, '')     // Remove dosage
        .replace(/\d+\s*ml/gi, '')
        .trim();
}

function makeKey(a, b) {
    const sorted = [normalize(a), normalize(b)].sort();
    return sorted.join('+');
}

// ═══════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════

/**
 * Check all pairwise drug-drug interactions for a list of medicines.
 * Checks built-in database first, then OpenFDA for unknown pairs.
 * 
 * @param {string[]} medicineNames - Array of medicine names
 * @returns {Promise<Object[]>} Array of interaction flags
 */
export async function checkAllInteractions(medicineNames) {
    const names = medicineNames.map(normalize).filter(Boolean);
    const flags = [];
    const checkedPairs = new Set();

    // 1. Local database check (instant)
    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const key = makeKey(names[i], names[j]);
            if (checkedPairs.has(key)) continue;
            checkedPairs.add(key);

            if (KNOWN_INTERACTIONS[key]) {
                flags.push({
                    ...KNOWN_INTERACTIONS[key],
                    drugA: medicineNames[i],
                    drugB: medicineNames[j],
                });
            }
        }
    }

    // 2. OpenFDA fallback for remaining pairs (skipif already found locally)
    for (let i = 0; i < names.length; i++) {
        const fdaInteractions = await getOpenFdaInteractions(names[i]);
        if (!fdaInteractions) continue;

        for (let j = 0; j < names.length; j++) {
            if (i === j) continue;
            const key = makeKey(names[i], names[j]);
            if (checkedPairs.has(key)) continue;

            // Check if other drug is mentioned in this drug's interaction text
            if (fdaInteractions.toLowerCase().includes(names[j])) {
                checkedPairs.add(key);
                flags.push({
                    level: 'yellow',
                    type: 'interaction_fda',
                    drugA: medicineNames[i],
                    drugB: medicineNames[j],
                    message: `Potential interaction found between ${medicineNames[i]} and ${medicineNames[j]}. Consult your doctor.`,
                    advice: 'This was flagged by FDA drug label data. Please verify with your physician.',
                });
            }
        }
    }

    return flags;
}

/**
 * Get known adverse reactions for a medicine.
 * Optionally cross-reference with user-reported symptoms.
 * 
 * @param {string} medicineName
 * @param {string[]} userSymptomLabels - User's reported symptom labels
 * @returns {{ adrs: Object[], matchedSymptoms: Object[] }}
 */
export function getAdverseReactions(medicineName, userSymptomLabels = []) {
    const name = normalize(medicineName);
    const adrs = KNOWN_ADRS[name] || [];

    const matchedSymptoms = [];
    for (const adr of adrs) {
        for (const userSym of userSymptomLabels) {
            if (
                adr.symptom.toLowerCase().includes(userSym.toLowerCase()) ||
                userSym.toLowerCase().includes(adr.symptom.toLowerCase().split('/')[0].trim())
            ) {
                matchedSymptoms.push({
                    medicine: medicineName,
                    symptom: adr.symptom,
                    severity: adr.severity,
                    frequency: adr.frequency,
                    message: `Your symptom "${userSym}" matches a known side effect of ${medicineName}.`,
                });
            }
        }
    }

    return { adrs, matchedSymptoms };
}

/**
 * Check if a medicine is an antibiotic (for AMR monitoring).
 */
export function isAntibiotic(medicineName) {
    return ANTIBIOTICS.has(normalize(medicineName));
}

/**
 * Get AMR risk information for an antibiotic.
 */
export function getAmrRisk(medicineName, missedDoses = 0) {
    const name = normalize(medicineName);
    if (!ANTIBIOTICS.has(name)) {
        return { isAntibiotic: false, riskLevel: 'green', flags: [] };
    }

    const flags = [];
    let riskLevel = 'green';

    // Base antibiotic warning
    flags.push({
        type: 'amr_base',
        level: 'yellow',
        message: `${medicineName} is an antibiotic. Complete your full course to prevent antimicrobial resistance.`,
    });
    riskLevel = 'yellow';

    // Missed dose escalation
    if (missedDoses >= 3) {
        flags.push({
            type: 'amr_critical',
            level: 'red',
            message: `⚠️ CRITICAL: You have missed ${missedDoses} doses of ${medicineName}. Stopping antibiotics early creates drug-resistant bacteria. Contact your doctor IMMEDIATELY.`,
        });
        riskLevel = 'red';
    } else if (missedDoses >= 1) {
        flags.push({
            type: 'amr_warning',
            level: 'yellow',
            message: `You missed ${missedDoses} dose(s) of ${medicineName}. Try to take it as soon as possible. Do NOT double up.`,
        });
    }

    return { isAntibiotic: true, riskLevel, flags };
}

// ─── OpenFDA API Helpers ────────────────────────────────

async function getOpenFdaInteractions(drugName) {
    const { data } = await safeFetch(
        `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`,
        { timeout: 8000, retries: 0, label: 'openfda-label' }
    );

    if (!data?.results?.[0]) return null;
    const label = data.results[0];
    return label.drug_interactions?.[0] || null;
}

/**
 * Get adverse events from OpenFDA for a drug (supplementary data).
 */
export async function getOpenFdaAdverseEvents(drugName) {
    const { data } = await safeFetch(
        `https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=3`,
        { timeout: 8000, retries: 0, label: 'openfda-events' }
    );

    if (!data?.results) return [];
    return data.results.map(r => ({
        reactions: r.patient?.reaction?.map(rx => rx.reactionmeddrapt) || [],
        serious: r.serious === '1',
    }));
}
