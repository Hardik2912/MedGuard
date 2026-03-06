import {
  ADR_MAP,
  ANTIBIOTICS,
  DRUG_SYNONYMS,
  INTERACTIONS,
  RXNORM_LOOKUP,
  SYMPTOM_LABELS,
} from './riskKnowledge.js';

function canonicalName(rawName = '') {
  const cleaned = String(rawName).trim().toLowerCase();
  if (!cleaned) return '';

  const alphaOnly = cleaned.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!alphaOnly) return '';

  if (DRUG_SYNONYMS[alphaOnly]) return DRUG_SYNONYMS[alphaOnly];

  // match by token presence, e.g. "Paracetamol 650 mg"
  const tokens = alphaOnly.split(' ');
  for (const token of tokens) {
    if (DRUG_SYNONYMS[token]) return DRUG_SYNONYMS[token];
    if (RXNORM_LOOKUP[token]) return token;
  }

  // fallback: first token that looks like a medicine word
  return tokens[0] || alphaOnly;
}

function normalizeMedicine(raw = {}) {
  const name = String(raw?.name || 'Unknown').trim();
  const canonical = canonicalName(name);
  const rxnormCui = RXNORM_LOOKUP[canonical] || null;

  return {
    originalName: name,
    normalizedName: canonical || name.toLowerCase(),
    rxnormCui,
    dosage: String(raw?.dosage || 'N/A'),
    frequency: String(raw?.frequency || 'Once Daily'),
    type: String(raw?.type || 'other'),
    times: Array.isArray(raw?.times) && raw.times.length > 0 ? raw.times : ['08:00'],
  };
}

function interactionFlags(allMeds) {
  const flags = [];
  for (let i = 0; i < allMeds.length; i += 1) {
    for (let j = i + 1; j < allMeds.length; j += 1) {
      const a = allMeds[i].normalizedName;
      const b = allMeds[j].normalizedName;
      const match = INTERACTIONS.find((item) => {
        const [x, y] = item.pair;
        return (x === a && y === b) || (x === b && y === a);
      });

      if (!match) continue;
      flags.push({
        type: 'interaction',
        level: match.severity,
        drugA: allMeds[i].originalName,
        drugB: allMeds[j].originalName,
        message: match.message,
        advice: match.advice,
        evidence: match.evidence,
      });
    }
  }
  return flags;
}

function duplicateFlags(allMeds) {
  const seen = new Map();
  const flags = [];

  for (const med of allMeds) {
    const count = seen.get(med.normalizedName) || 0;
    seen.set(med.normalizedName, count + 1);
  }

  for (const [name, count] of seen.entries()) {
    if (count > 1) {
      flags.push({
        type: 'duplicate',
        level: 'yellow',
        message: `Possible duplicate therapy detected for ${name} (${count} entries).`,
        advice: 'Verify if this is intentional or duplicate prescription entry.',
      });
    }
  }

  return flags;
}

function adrSymptomFlags(newMeds, symptomIds = []) {
  const symptomSet = new Set((symptomIds || []).map((s) => String(s)));
  const flags = [];

  for (const med of newMeds) {
    const expected = ADR_MAP[med.normalizedName] || [];
    const matched = expected.filter((sym) => symptomSet.has(sym));
    for (const sym of matched) {
      const high = sym === 'swelling';
      flags.push({
        type: 'adr_symptom',
        level: high ? 'red' : 'yellow',
        drug: med.originalName,
        symptom: sym,
        message: `${SYMPTOM_LABELS[sym] || sym} may be linked to ${med.originalName}.`,
        advice: high
          ? 'Potential severe reaction. Seek urgent medical care.'
          : 'Monitor symptom and contact your doctor if it worsens.',
      });
    }
  }

  return flags;
}

function antibioticFlags(newMeds) {
  const flags = [];
  for (const med of newMeds) {
    if (!ANTIBIOTICS.includes(med.normalizedName)) continue;
    flags.push({
      type: 'antibiotic',
      level: 'yellow',
      drug: med.originalName,
      message: `${med.originalName} is an antibiotic. Incomplete course can increase resistance risk.`,
      advice: 'Complete the full prescribed course unless your doctor changes it.',
    });
  }
  return flags;
}

function polypharmacyFlags(allMeds) {
  const count = allMeds.length;
  if (count >= 8) {
    return [{
      type: 'polypharmacy',
      level: 'red',
      message: `High pill burden detected (${count} medicines).`,
      advice: 'Request medication reconciliation with your clinician.',
    }];
  }
  if (count >= 5) {
    return [{
      type: 'polypharmacy',
      level: 'yellow',
      message: `Moderate polypharmacy detected (${count} medicines).`,
      advice: 'Review necessity of each medicine during next consultation.',
    }];
  }
  return [];
}

function finalLevel(flags) {
  if (flags.some((f) => f.level === 'red')) return 'red';
  if (flags.some((f) => f.level === 'yellow')) return 'yellow';
  return 'green';
}

export function normalizeMedicines(medicines = []) {
  return (medicines || []).map((m) => normalizeMedicine(m));
}

export function assessMedicationRisk({
  existingMedicines = [],
  newMedicines = [],
  symptomIds = [],
} = {}) {
  const normalizedExisting = normalizeMedicines(existingMedicines);
  const normalizedNew = normalizeMedicines(newMedicines);
  const all = [...normalizedExisting, ...normalizedNew];

  const flags = [
    ...interactionFlags(all),
    ...duplicateFlags(all),
    ...adrSymptomFlags(normalizedNew, symptomIds),
    ...antibioticFlags(normalizedNew),
    ...polypharmacyFlags(all),
  ];

  return {
    level: finalLevel(flags),
    flags,
    redFlags: flags.filter((f) => f.level === 'red').length,
    yellowFlags: flags.filter((f) => f.level === 'yellow').length,
    totalFlags: flags.length,
    normalizedExisting,
    normalizedNew,
    disclaimer: 'Educational medication safety check only. Always confirm with a licensed clinician.',
  };
}
