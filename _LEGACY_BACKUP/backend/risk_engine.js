/**
 * ════════════════════════════════════════════════════════════
 * MEDGUARD — Risk Engine (JavaScript / Node.js)
 * ════════════════════════════════════════════════════════════
 *
 * Rule-based RED / YELLOW / GREEN risk assessment engine.
 *
 * SAFETY: This engine provides EDUCATIONAL risk awareness only.
 *         It does NOT diagnose, prescribe, or modify doses.
 *
 * Schema: medguard_full.sql
 * Tables used:
 *   drug_master, adr_master, drug_adr_map,
 *   drug_interaction_master, food_alcohol_interactions,
 *   antibiotic_misuse_rules, amr_risk_master,
 *   source_master, user_medicine_timeline
 */

const Database = require("better-sqlite3");
const path = require("path");

// ─── Database Setup ──────────────────────────────────────

const DB_PATH = path.join(__dirname, "medguard.db");

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  return db;
}

// ─── Constants ───────────────────────────────────────────

const DISCLAIMER =
  "⚕️ DISCLAIMER: This is educational risk information only. " +
  "It does NOT constitute medical advice, diagnosis, or treatment. " +
  "Always consult a qualified healthcare professional before making " +
  "any medication decisions.";

const RISK_PRIORITY = { red: 3, yellow: 2, green: 1 };

// ─── Helper ──────────────────────────────────────────────

function higherRisk(current, incoming) {
  return (RISK_PRIORITY[incoming] || 0) > (RISK_PRIORITY[current] || 0)
    ? incoming
    : current;
}

// ═══════════════════════════════════════════════════════════
// 1. check_risk()
// ═══════════════════════════════════════════════════════════

/**
 * Run full risk assessment for a list of drug IDs.
 *
 * @param {Object} opts
 * @param {string[]} opts.drugIds       – e.g. ["D1","D3"]
 * @param {number}   [opts.userAge]     – age ≥65 triggers elderly caution
 * @param {boolean}  [opts.alcohol]     – user reports alcohol use
 * @param {Object}   [opts.missedDoses] – { "D2": 3 } missed counts per drug
 * @returns {{ riskLevel, flags, sources, disclaimer }}
 */
function checkRisk({ drugIds = [], userAge = null, alcohol = false, missedDoses = {} } = {}) {
  const db = getDb();
  const flags = [];
  const sources = new Set();
  let overall = "green";

  try {
    for (const drugId of drugIds) {
      // ADR risks
      flags.push(..._checkAdrRisk(db, drugId));

      // Alcohol interactions
      if (alcohol) {
        flags.push(..._checkAlcoholRisk(db, drugId));
      }

      // Elderly cautions
      if (userAge && userAge >= 65) {
        flags.push(..._checkElderlyCaution(db, drugId));
      }

      // AMR / missed doses
      if (missedDoses[drugId] !== undefined) {
        flags.push(..._checkAmrRisk(db, drugId, missedDoses[drugId]));
      }
    }

    // Drug-drug interactions (pairwise)
    if (drugIds.length >= 2) {
      flags.push(...checkInteractions(drugIds, db));
    }

    // Determine overall level
    for (const f of flags) {
      overall = higherRisk(overall, f.level);
      if (f.sources) f.sources.forEach((s) => sources.add(s));
    }

    return {
      riskLevel: overall,
      flags,
      sources: [...sources],
      disclaimer: DISCLAIMER,
    };
  } finally {
    db.close();
  }
}

// ═══════════════════════════════════════════════════════════
// 2. checkInteractions()
// ═══════════════════════════════════════════════════════════

/**
 * Check all pairwise drug-drug interactions.
 *
 * @param {string[]} drugIds
 * @param {Database} [externalDb] – optional, reuses connection
 * @returns {Object[]} array of interaction flags
 */
function checkInteractions(drugIds, externalDb = null) {
  const db = externalDb || getDb();
  const flags = [];
  const checked = new Set();

  try {
    const stmt = db.prepare(`
      SELECT * FROM drug_interaction_master
      WHERE (drug_a = ? AND drug_b = ?)
         OR (drug_a = ? AND drug_b = ?)
    `);

    for (let i = 0; i < drugIds.length; i++) {
      for (let j = i + 1; j < drugIds.length; j++) {
        const pair = [drugIds[i], drugIds[j]].sort().join("|");
        if (checked.has(pair)) continue;
        checked.add(pair);

        const rows = stmt.all(drugIds[i], drugIds[j], drugIds[j], drugIds[i]);
        for (const row of rows) {
          flags.push({
            type: "interaction",
            level: row.severity,
            drugA: row.drug_a,
            drugB: row.drug_b,
            mechanism: row.mechanism,
            message: row.message,
            sources: [row.source],
          });
        }
      }
    }

    return flags;
  } finally {
    if (!externalDb) db.close();
  }
}

// ═══════════════════════════════════════════════════════════
// 3. amrMonitor()
// ═══════════════════════════════════════════════════════════

/**
 * Standalone AMR monitoring for an antibiotic.
 *
 * @param {string} drugId
 * @param {number} [missedDoses=0]
 * @returns {{ drug, isAntibiotic, whoAwareCategory, riskLevel, missedDoses, flags, disclaimer }}
 */
function amrMonitor(drugId, missedDoses = 0) {
  const db = getDb();

  try {
    const drug = db.prepare("SELECT * FROM drug_master WHERE drug_id = ?").get(drugId);

    if (!drug) {
      return { error: `Drug ${drugId} not found`, disclaimer: DISCLAIMER };
    }

    if (!drug.is_antibiotic) {
      return {
        riskLevel: "green",
        drug: drug.molecule,
        isAntibiotic: false,
        message: `${drug.molecule} is not an antibiotic — no AMR monitoring needed.`,
        disclaimer: DISCLAIMER,
      };
    }

    const flags = _checkAmrRisk(db, drugId, missedDoses);
    let overall = "green";
    for (const f of flags) {
      overall = higherRisk(overall, f.level);
    }

    return {
      drug: drug.molecule,
      isAntibiotic: true,
      whoAwareCategory: drug.who_aware || "Unknown",
      riskLevel: overall,
      missedDoses,
      flags,
      disclaimer: DISCLAIMER,
    };
  } finally {
    db.close();
  }
}

// ═══════════════════════════════════════════════════════════
// 4. explainRisk()
// ═══════════════════════════════════════════════════════════

/**
 * Get comprehensive explainable risk profile for a drug.
 * All claims cite evidence sources.
 *
 * @param {string} drugId
 * @returns {Object} full risk profile with sources
 */
function explainRisk(drugId) {
  const db = getDb();

  try {
    const drug = db.prepare("SELECT * FROM drug_master WHERE drug_id = ?").get(drugId);
    if (!drug) {
      return { error: `Drug ${drugId} not found`, disclaimer: DISCLAIMER };
    }

    // ADRs (ordered by severity: red → yellow → green)
    const adrs = db
      .prepare(
        `SELECT am.symptom_layman, am.severity, am.frequency,
                dam.level, dam.advice, dam.source
         FROM drug_adr_map dam
         JOIN adr_master am ON dam.adr_id = am.adr_id
         WHERE dam.drug_id = ?
         ORDER BY CASE dam.level
             WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 ELSE 3
         END`
      )
      .all(drugId);

    // Food/alcohol interactions
    const foodInteractions = db
      .prepare(
        `SELECT trigger_item, risk_level, message, source
         FROM food_alcohol_interactions
         WHERE drug_id = ?`
      )
      .all(drugId);

    // Evidence citations
    const evidence = db
      .prepare(
        `SELECT em.claim, sm.name AS source_name, sm.authority, sm.url
         FROM evidence_map em
         JOIN source_master sm ON em.source_id = sm.source_id
         WHERE em.entity_id = ?`
      )
      .all(drugId);

    // Brand names
    const brands = db
      .prepare("SELECT brand_name, manufacturer FROM brand_mapping WHERE drug_id = ?")
      .all(drugId);

    return {
      drugId,
      molecule: drug.molecule,
      drugClass: drug.drug_class,
      commonUse: drug.common_use,
      isAntibiotic: Boolean(drug.is_antibiotic),
      whoAwareCategory: drug.who_aware,
      knownBrands: brands.map((b) => ({
        name: b.brand_name,
        manufacturer: b.manufacturer,
      })),
      adverseReactions: adrs.map((a) => ({
        symptom: a.symptom_layman,
        severity: a.severity,
        frequency: a.frequency,
        riskLevel: a.level,
        advice: a.advice,
        source: a.source,
      })),
      foodAlcoholInteractions: foodInteractions.map((fi) => ({
        trigger: fi.trigger_item,
        riskLevel: fi.risk_level,
        message: fi.message,
        source: fi.source,
      })),
      elderlyCaution: drug.elderly_caution,
      alcoholWarning: drug.alcohol_warning,
      evidence: evidence.map((e) => ({
        claim: e.claim,
        sourceName: e.source_name,
        authority: e.authority,
        url: e.url,
      })),
      disclaimer: DISCLAIMER,
    };
  } finally {
    db.close();
  }
}

// ═══════════════════════════════════════════════════════════
// 5. addMedicine()
// ═══════════════════════════════════════════════════════════

/**
 * Add a confirmed medicine to user timeline.
 *
 * @param {Object} opts
 * @param {string} opts.drugId
 * @param {string} [opts.userId="default"]
 * @param {string} [opts.startDate]  – ISO date string
 * @returns {{ success, timelineId, drug, disclaimer }}
 */
function addMedicine({ drugId, userId = "default", startDate = null } = {}) {
  const db = getDb();

  try {
    const drug = db.prepare("SELECT * FROM drug_master WHERE drug_id = ?").get(drugId);
    if (!drug) {
      return { error: `Drug ${drugId} not found in database`, disclaimer: DISCLAIMER };
    }

    const date = startDate || new Date().toISOString().split("T")[0];

    const result = db
      .prepare(
        `INSERT INTO user_medicine_timeline (user_id, drug_id, start_date, confirmed)
         VALUES (?, ?, ?, 1)`
      )
      .run(userId, drugId, date);

    return {
      success: true,
      timelineId: result.lastInsertRowid,
      drug: drug.molecule,
      drugId,
      startDate: date,
      disclaimer: DISCLAIMER,
    };
  } finally {
    db.close();
  }
}

// ═══════════════════════════════════════════════════════════
// Internal: ADR Risk Check
// ═══════════════════════════════════════════════════════════

function _checkAdrRisk(db, drugId) {
  const flags = [];
  const rows = db
    .prepare(
      `SELECT dam.level, dam.advice, dam.source,
              am.symptom_layman, am.severity, am.emergency,
              dm.molecule
       FROM drug_adr_map dam
       JOIN adr_master am ON dam.adr_id = am.adr_id
       JOIN drug_master dm ON dam.drug_id = dm.drug_id
       WHERE dam.drug_id = ?`
    )
    .all(drugId);

  for (const row of rows) {
    flags.push({
      type: "adr",
      level: row.level,
      drug: row.molecule,
      symptom: row.symptom_layman,
      severity: row.severity,
      advice: row.advice,
      isEmergency: Boolean(row.emergency),
      sources: [row.source],
    });
  }
  return flags;
}

// ═══════════════════════════════════════════════════════════
// Internal: Alcohol Risk Check
// ═══════════════════════════════════════════════════════════

function _checkAlcoholRisk(db, drugId) {
  const flags = [];
  const rows = db
    .prepare(
      `SELECT fai.risk_level, fai.message, fai.source, fai.trigger_item,
              dm.molecule
       FROM food_alcohol_interactions fai
       JOIN drug_master dm ON fai.drug_id = dm.drug_id
       WHERE fai.drug_id = ? AND fai.trigger_item = 'alcohol'`
    )
    .all(drugId);

  for (const row of rows) {
    flags.push({
      type: "alcohol",
      level: row.risk_level,
      drug: row.molecule,
      trigger: row.trigger_item,
      message: row.message,
      sources: [row.source],
    });
  }
  return flags;
}

// ═══════════════════════════════════════════════════════════
// Internal: Elderly Caution Check
// ═══════════════════════════════════════════════════════════

function _checkElderlyCaution(db, drugId) {
  const flags = [];
  const row = db
    .prepare(
      `SELECT drug_id, molecule, elderly_caution, source
       FROM drug_master
       WHERE drug_id = ? AND elderly_caution IS NOT NULL AND elderly_caution != ''`
    )
    .get(drugId);

  if (row) {
    const caution = (row.elderly_caution || "").toLowerCase();
    if (caution && !["na", "none", "generally safe"].includes(caution)) {
      flags.push({
        type: "elderly",
        level: "yellow",
        drug: row.molecule,
        message: row.elderly_caution,
        sources: [row.source],
      });
    }
  }
  return flags;
}

// ═══════════════════════════════════════════════════════════
// Internal: AMR / Missed Dose Check
// ═══════════════════════════════════════════════════════════

function _checkAmrRisk(db, drugId, missedDoses) {
  const flags = [];

  // AMR risk level from amr_risk_master
  const amrRow = db.prepare("SELECT * FROM amr_risk_master WHERE drug_id = ?").get(drugId);

  if (amrRow) {
    if (amrRow.amr_risk === "high") {
      flags.push({
        type: "amr",
        level: "red",
        drug: drugId,
        message: amrRow.stewardship_message,
        awareCategory: amrRow.aware_category,
        sources: [amrRow.source],
      });
    } else if (amrRow.amr_risk === "medium") {
      flags.push({
        type: "amr",
        level: "yellow",
        drug: drugId,
        message: amrRow.stewardship_message,
        awareCategory: amrRow.aware_category,
        sources: [amrRow.source],
      });
    }
  }

  // Missed dose rules
  if (missedDoses >= 2) {
    const rules = db
      .prepare("SELECT * FROM antibiotic_misuse_rules WHERE condition = 'missed_doses >= 2'")
      .all();
    for (const rule of rules) {
      flags.push({
        type: "missed_doses",
        level: "red",
        drug: drugId,
        missed: missedDoses,
        message: rule.message,
        sources: [rule.source],
      });
    }
  } else if (missedDoses === 1) {
    const rules = db
      .prepare("SELECT * FROM antibiotic_misuse_rules WHERE condition = 'missed_doses == 1'")
      .all();
    for (const rule of rules) {
      flags.push({
        type: "missed_doses",
        level: "yellow",
        drug: drugId,
        missed: missedDoses,
        message: rule.message,
        sources: [rule.source],
      });
    }
  }

  return flags;
}

// ═══════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════

module.exports = {
  checkRisk,
  checkInteractions,
  amrMonitor,
  explainRisk,
  addMedicine,
  DISCLAIMER,
  getDb,
};

// ═══════════════════════════════════════════════════════════
// Quick Demo (run: node risk_engine.js)
// ═══════════════════════════════════════════════════════════

if (require.main === module) {
  console.log("═".repeat(60));
  console.log("MEDGUARD Risk Engine — Demo");
  console.log("═".repeat(60));

  // Test 1: Ibuprofen + Paracetamol, alcohol, elderly
  console.log("\n🔍 Test 1: Ibuprofen (D3) + Paracetamol (D1), alcohol=true, age=70");
  const r1 = checkRisk({
    drugIds: ["D3", "D1"],
    userAge: 70,
    alcohol: true,
  });
  console.log(`   Risk Level: ${r1.riskLevel.toUpperCase()}`);
  console.log(`   Flags: ${r1.flags.length}`);
  r1.flags.forEach((f) => {
    console.log(`     [${f.level.toUpperCase()}] ${f.type}: ${f.message || f.advice || f.symptom}`);
  });

  // Test 2: Azithromycin AMR with missed doses
  console.log("\n🔍 Test 2: Azithromycin (D4) AMR monitor, 3 missed doses");
  const r2 = amrMonitor("D4", 3);
  console.log(`   Risk Level: ${r2.riskLevel.toUpperCase()}`);
  console.log(`   WHO AWaRe: ${r2.whoAwareCategory}`);

  // Test 3: Explain Ciprofloxacin
  console.log("\n🔍 Test 3: Explain risk — Ciprofloxacin (D10)");
  const r3 = explainRisk("D10");
  console.log(`   Molecule: ${r3.molecule}`);
  console.log(`   ADRs: ${r3.adverseReactions.length}`);
  console.log(`   Evidence: ${r3.evidence.length}`);

  // Test 4: Dual NSAID interaction
  console.log("\n🔍 Test 4: Interaction check — Ibuprofen + Diclofenac");
  const r4 = checkInteractions(["D3", "D14"]);
  r4.forEach((f) => {
    console.log(`   [${f.level.toUpperCase()}] ${f.mechanism}: ${f.message}`);
  });

  console.log(`\n${DISCLAIMER}\n`);
}
