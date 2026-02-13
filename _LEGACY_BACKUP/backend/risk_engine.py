"""
MEDGUARD — Risk Engine
Rule-based RED / YELLOW / GREEN risk assessment.

SAFETY: This engine provides EDUCATIONAL risk awareness only.
It does NOT diagnose, prescribe, or modify doses.
"""

from db import query

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────
DISCLAIMER = (
    "⚕️ DISCLAIMER: This is educational risk information only. "
    "It does NOT constitute medical advice, diagnosis, or treatment. "
    "Always consult a qualified healthcare professional before making "
    "any medication decisions."
)

RISK_PRIORITY = {"red": 3, "yellow": 2, "green": 1}


# ──────────────────────────────────────────────
# Core Risk Assessment
# ──────────────────────────────────────────────

# ──────────────────────────────────────────────
# Clinical Synthesis (The "Doctor-like" Logic)
# ──────────────────────────────────────────────

def generate_clinical_summary(flags, overall_level):
    """
    Synthesizes a cohesive, professional clinical narrative from raw risk flags.
    Mimics a doctor's thought process by prioritizing and grouping issues.
    """
    if not flags:
        return "No significant pharmacological risks detected based on current data matches."

    summary_parts = []
    
    # 1. CRITICIAL / RED FLAGS (Immediate Attention)
    red_flags = [f for f in flags if f["level"] == "red"]
    if red_flags:
        part = "**CRITICAL ATTENTION REQUIRED:**"
        unique_issues = set()
        for f in red_flags:
            if f["type"] == "interaction":
                unique_issues.add(f"Concurrent use of {f['drug_a']} and {f['drug_b']} ({f.get('message', 'Serious Interaction')}).")
            elif f["type"] == "alcohol":
                unique_issues.add(f"Strictly avoid alcohol with {f['drug']} ({f.get('message')}).")
            elif f["type"] == "amr":
                unique_issues.add(f"Antibiotic Stewardship: {f.get('message')}.")
            else:
                unique_issues.add(f"{f['drug']}: {f.get('message') or f.get('advice') or f.get('symptom')}.")
        
        for issue in unique_issues:
            part += f"\n• {issue}"
        summary_parts.append(part)

    # 2. WARNING / YELLOW FLAGS (Management)
    yellow_flags = [f for f in flags if f["level"] == "yellow"]
    if yellow_flags:
        part = "**Clinical Management Notes:**"
        # Group by drug to sound more natural
        drug_notes = {}
        for f in yellow_flags:
            d = f.get("drug") or f.get("drug_a") # fallback for interaction
            if d not in drug_notes: drug_notes[d] = []
            
            msg = f.get('message') or f.get('advice') or f.get('symptom')
            if msg and msg not in drug_notes[d]:
                drug_notes[d].append(msg)

        for drug, notes in drug_notes.items():
            combined = "; ".join(notes)
            part += f"\n• {drug}: {combined}."
        summary_parts.append(part)

    # 3. CONCLUDING REMARK
    if overall_level == "red":
        summary_parts.append("\n**Recommendation:** Review prescription safety immediately with the prescribing physician.")
    elif overall_level == "yellow":
        summary_parts.append("\n**Recommendation:** Proceed with caution and monitor for specified symptoms.")

    return "\n".join(summary_parts)


def check_risk(drug_ids, user_age=None, report_alcohol=False, missed_doses_map=None):
    """
    Run full risk assessment for a list of drug IDs.

    Args:
        drug_ids: list of drug_id strings (e.g. ['D001','D003'])
        user_age: optional int, age of user (>=65 triggers elderly caution)
        report_alcohol: bool, whether user reports alcohol consumption
        missed_doses_map: dict {drug_id: int} of missed doses per antibiotic

    Returns:
        dict with risk_level, flags, sources, disclaimer, AND clinical_analysis
    """
    if missed_doses_map is None:
        missed_doses_map = {}

    flags = []
    sources = set()
    overall_level = "green"

    # Resolve IDs to Molecules first (for report quality)
    # Actually, the helpers do query internally. 

    for drug_id in drug_ids:
        # ── ADR Risk ──
        adr_flags = _check_adr_risk(drug_id)
        flags.extend(adr_flags)

        # ── Alcohol Interactions ──
        if report_alcohol:
            alc_flags = _check_alcohol_risk(drug_id)
            flags.extend(alc_flags)

        # ── Elderly Caution ──
        if user_age and user_age >= 65:
            elderly_flags = _check_elderly_caution(drug_id)
            flags.extend(elderly_flags)

        # ── AMR / Missed Doses ──
        if drug_id in missed_doses_map:
            amr_flags = _check_amr_risk(drug_id, missed_doses_map[drug_id])
            flags.extend(amr_flags)

    # ── Drug-Drug Interactions ──
    if len(drug_ids) >= 2:
        interaction_flags = check_interactions(drug_ids)
        flags.extend(interaction_flags)

    # ── Determine overall risk level ──
    for f in flags:
        if RISK_PRIORITY.get(f["level"], 0) > RISK_PRIORITY.get(overall_level, 0):
            overall_level = f["level"]
        sources.update(f.get("sources", []))
    
    # ── Generate Synthesis ──
    clinical_analysis = generate_clinical_summary(flags, overall_level)

    return {
        "risk_level": overall_level,
        "flags": flags,
        "clinical_analysis": clinical_analysis, # NEW FIELD
        "sources": list(sources),
        "disclaimer": DISCLAIMER,
    }



# ──────────────────────────────────────────────
# ADR Risk Check
# ──────────────────────────────────────────────

def _check_adr_risk(drug_id):
    """Check known ADRs for a drug."""
    flags = []
    # New Schema: drug_adr_map (drug_id, adr_id, level, advice, source)
    # adr_master (adr_id, symptom_layman, severity, ...)
    rows = query("""
        SELECT dam.level, dam.advice, dam.source,
               am.symptom_layman, am.severity,
               dm.molecule
        FROM drug_adr_map dam
        JOIN adr_master am ON dam.adr_id = am.adr_id
        JOIN drug_master dm ON dam.drug_id = dm.drug_id
        WHERE dam.drug_id = ?
    """, (drug_id,))

    for row in rows:
        flags.append({
            "type": "adr",
            "level": row["level"],
            "drug": row["molecule"],
            "symptom": row["symptom_layman"],
            "severity": row["severity"],
            "advice": row["advice"],
            "is_emergency": (row["severity"] == 'serious'), # mapped from string
            "sources": [row["source"]],
        })
    return flags


# ──────────────────────────────────────────────
# Drug-Drug Interaction Check
# ──────────────────────────────────────────────

def check_interactions(drug_ids):
    """Check all pairwise drug-drug interactions."""
    flags = []
    checked = set()

    for i, d_a in enumerate(drug_ids):
        for d_b in drug_ids[i + 1:]:
            pair = tuple(sorted([d_a, d_b]))
            if pair in checked:
                continue
            checked.add(pair)

            # New schema has interaction_id, drug_a, drug_b, mechanism, clinical_effect, severity, source
            # Note: drug_a/drug_b in DB are NAMES (e.g. 'Ibuprofen'), not IDs?
            # Let's check the Schema... The schema says "drug_a TEXT NOT NULL".
            # The inserts use NAMES like 'Ibuprofen'.
            # So we first need to get the MOLECULE names for the IDs.
            
            mol_a_row = query("SELECT molecule FROM drug_master WHERE drug_id = ?", (d_a,))
            mol_b_row = query("SELECT molecule FROM drug_master WHERE drug_id = ?", (d_b,))
            
            if not mol_a_row or not mol_b_row:
                continue
                
            mol_a = mol_a_row[0]["molecule"]
            mol_b = mol_b_row[0]["molecule"]

            rows = query("""
                SELECT * FROM drug_interaction_master
                WHERE (drug_a = ? AND drug_b = ?)
                   OR (drug_a = ? AND drug_b = ?)
            """, (mol_a, mol_b, mol_b, mol_a))

            for row in rows:
                # Map severity 'serious' -> 'red', 'moderate' -> 'yellow'
                level = "green"
                if row["severity"] == "serious":
                    level = "red"
                elif row["severity"] == "moderate":
                    level = "yellow"

                flags.append({
                    "type": "interaction",
                    "level": level,
                    "drug_a": row["drug_a"],
                    "drug_b": row["drug_b"],
                    "mechanism": row["mechanism"],
                    "message": row["clinical_effect"], # Use clinical_effect as message
                    "sources": [row["source"]],
                })
    return flags


# ──────────────────────────────────────────────
# Alcohol Interaction Check
# ──────────────────────────────────────────────

def _check_alcohol_risk(drug_id):
    """Check food/alcohol interactions for a drug."""
    flags = []
    
    # Need molecule name? No, schema says 'drug TEXT NOT NULL'. 
    # Inserts use 'Metronidazole'. So yes, we need molecule name.
    mol_row = query("SELECT molecule FROM drug_master WHERE drug_id = ?", (drug_id,))
    if not mol_row:
        return []
    molecule = mol_row[0]["molecule"]

    rows = query("""
        SELECT risk_level, message, source, trigger
        FROM food_alcohol_interactions
        WHERE drug = ? AND trigger = 'Alcohol'
    """, (molecule,))

    for row in rows:
        flags.append({
            "type": "alcohol",
            "level": row["risk_level"],
            "drug": molecule,
            "trigger": row["trigger"],
            "message": row["message"],
            "sources": [row["source"]],
        })
    return flags


# ──────────────────────────────────────────────
# Elderly Caution Check
# ──────────────────────────────────────────────

def _check_elderly_caution(drug_id):
    """Check elderly-specific cautions using 'avoid_in' column."""
    flags = []
    # New schema: avoid_in
    rows = query("""
        SELECT drug_id, molecule, avoid_in, source
        FROM drug_master
        WHERE drug_id = ?
    """, (drug_id,))

    for row in rows:
        avoid = row["avoid_in"]
        if avoid and ("elderly" in avoid.lower() or "avoid" in avoid.lower() or "severe" in avoid.lower()):
             # If exact 'elderly' isn't mentioned, we still flag severe warnings for seniors as caution
            flags.append({
                "type": "elderly",
                "level": "yellow",
                "drug": row["molecule"],
                "message": f"Caution: {avoid}",
                "sources": [row["source"]],
            })
    return flags


# ──────────────────────────────────────────────
# AMR / Missed Dose Check
# ──────────────────────────────────────────────

def _check_amr_risk(drug_id, missed_doses):
    """Check AMR risk and antibiotic adherence."""
    flags = []
    
    # Get molecule name for AMR lookup
    mol_row = query("SELECT molecule FROM drug_master WHERE drug_id = ?", (drug_id,))
    if not mol_row:
        return []
    molecule = mol_row[0]["molecule"]

    # Check AMR risk level (amr_risk_master uses molecule name as PK)
    amr_rows = query("""
        SELECT * FROM amr_risk_master WHERE drug = ?
    """, (molecule,))

    for row in amr_rows:
        if row["amr_risk"] == "high":
            flags.append({
                "type": "amr",
                "level": "red",
                "drug": molecule,
                "message": f"High AMR Risk ({row['who_aware_category']}): {row['common_misuse'] or 'Avoid overuse'}",
                "aware_category": row["who_aware_category"],
                "sources": [row["source"]],
            })
        elif row["amr_risk"] == "medium":
            flags.append({
                "type": "amr",
                "level": "yellow",
                "drug": molecule,
                "message": f"AMR Risk ({row['who_aware_category']}): {row['common_misuse'] or 'Complete full course'}",
                "aware_category": row["who_aware_category"],
                "sources": [row["source"]],
            })

    # Check missed doses against rules
    # Note: antibiotic_misuse_rules table schema changed slightly? 
    # condition, recommendation, level, source
    if missed_doses >= 2:
        # Just hardcode the matching logic to the known rules for simplicity in prototype
        rules = query("SELECT * FROM antibiotic_misuse_rules WHERE level='red'")
        # Try to find a generic missed dose rule or default
        msg = "Missing doses increases resistance risk. Please complete your course."
        if rules:
            msg = rules[0]["recommendation"] # simplistic pick

        flags.append({
            "type": "missed_doses",
            "level": "red",
            "drug": molecule,
            "missed": missed_doses,
            "message": msg,
            "sources": ["ICMR"],
        })

    return flags


# ──────────────────────────────────────────────
# AMR Monitor (standalone)
# ──────────────────────────────────────────────

def amr_monitor(drug_id, missed_doses=0):
    """
    Standalone AMR monitoring for an antibiotic.
    """
    drug_info = query("SELECT * FROM drug_master WHERE drug_id = ?", (drug_id,))
    if not drug_info:
        return {"error": f"Drug {drug_id} not found", "disclaimer": DISCLAIMER}

    drug = drug_info[0]
    
    # Detect antibiotic status from drug_class string
    is_antibiotic = "antibiotic" in drug["drug_class"].lower()

    if not is_antibiotic:
        return {
            "risk_level": "green",
            "message": f"{drug['molecule']} is not an antibiotic — no AMR monitoring needed.",
            "disclaimer": DISCLAIMER,
        }

    flags = _check_amr_risk(drug_id, missed_doses)
    overall = "green"
    for f in flags:
        if RISK_PRIORITY.get(f["level"], 0) > RISK_PRIORITY.get(overall, 0):
            overall = f["level"]

    return {
        "drug": drug["molecule"],
        "is_antibiotic": True,
        "who_aware_category": "See Flags", # simplified
        "risk_level": overall,
        "missed_doses": missed_doses,
        "flags": flags,
        "disclaimer": DISCLAIMER,
    }


# ──────────────────────────────────────────────
# Explain Risk (with source citations)
# ──────────────────────────────────────────────

def explain_risk(drug_id):
    """
    Get comprehensive explainable risk profile for a drug.
    """
    drug_info = query("SELECT * FROM drug_master WHERE drug_id = ?", (drug_id,))
    if not drug_info:
        return {"error": f"Drug {drug_id} not found", "disclaimer": DISCLAIMER}

    drug = drug_info[0]
    molecule = drug["molecule"]

    # Get all ADRs
    adrs = query("""
        SELECT am.symptom_layman, am.severity, am.frequency,
               dam.level, dam.advice, dam.source
        FROM drug_adr_map dam
        JOIN adr_master am ON dam.adr_id = am.adr_id
        WHERE dam.drug_id = ?
        ORDER BY CASE dam.level
            WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 ELSE 3
        END
    """, (drug_id,))

    # Get food/alcohol interactions
    food_interactions = query("""
        SELECT trigger, risk_level, message, source
        FROM food_alcohol_interactions
        WHERE drug = ?
    """, (molecule,))

    # Get evidence citations (Legacy: evidence_map replaced by source columns in tables)
    # We can perform a dynamic collection or just output sources from queries above.
    # For now, simplistic approach:
    
    return {
        "drug_id": drug_id,
        "molecule": drug["molecule"],
        "class": drug["drug_class"],
        "common_use": drug["common_use"],
        "is_antibiotic": "antibiotic" in drug["drug_class"].lower(),
        "avoid_in": drug.get("avoid_in"),
        "adverse_reactions": [
            {
                "symptom": a["symptom_layman"],
                "severity": a["severity"],
                "frequency": a["frequency"],
                "risk_level": a["level"],
                "advice": a["advice"],
                "source": a["source"],
            }
            for a in adrs
        ],
        "food_alcohol_interactions": [
            {
                "trigger": fi["trigger"],
                "risk_level": fi["risk_level"],
                "message": fi["message"],
                "source": fi["source"],
            }
            for fi in food_interactions
        ],
        "alcohol_warning": drug.get("alcohol_warning"),
        "disclaimer": DISCLAIMER,
    }



# ──────────────────────────────────────────────
# Behavioral Pattern Analysis (Longitudinal)
# ──────────────────────────────────────────────

def analyze_user_behavior(user_id="default"):
    """
    Analyze user's medicine timeline for behavioral patterns.
    Returns a list of behavioral insights/warnings.
    """
    insights = []
    
    # Get user's active/recent timeline
    rows = query("""
        SELECT t.drug_id, t.start_date, t.missed_doses, 
               dm.molecule, dm.drug_class, dm.common_use
        FROM user_medicine_timeline t
        JOIN drug_master dm ON t.drug_id = dm.drug_id
        WHERE t.user_id = ?
    """, (user_id,))

    if not rows:
        return [{
            "type": "info",
            "title": "No History",
            "message": "Start adding medicines to track your daily health patterns.",
            "level": "green"
        }]

    # 1. Polypharmacy Check
    active_med_count = len(rows)
    if active_med_count >= 5:
        insights.append({
            "type": "behavior",
            "title": "High Pill Burden",
            "message": f"You are managing {active_med_count} medicines daily. Consider using a pill organizer to avoid errors.",
            "level": "yellow"
        })

    # 2. Adherence Check
    missed_antibiotics = []
    frequent_misses = []

    for row in rows:
        is_antibiotic = "antibiotic" in row["drug_class"].lower()
        missed = row["missed_doses"]
        
        if is_antibiotic and missed > 0:
            missed_antibiotics.append(row["molecule"])
        elif missed >= 3:
            frequent_misses.append(row["molecule"])

    if missed_antibiotics:
        insights.append({
            "type": "critical",
            "title": "Antibiotic Resistance Risk",
            "message": f"You missed doses of {', '.join(missed_antibiotics)}. Inconsistent antibiotic use causes superbugs (AMR). Please complete the course exactly.",
            "level": "red"
        })

    if frequent_misses:
        insights.append({
            "type": "behavior",
            "title": "Adherence Gaps",
            "message": f"Frequent misses detected for: {', '.join(frequent_misses)}. Set a daily alarm or reminders.",
            "level": "yellow"
        })

    # 3. Success Affirmation
    if not missed_antibiotics and not frequent_misses and active_med_count > 0:
        insights.append({
            "type": "success",
            "title": "Great Adherence!",
            "message": "You are taking your medicines consistently. This significantly improves treatment outcomes.",
            "level": "green"
        })

    return insights


# ──────────────────────────────────────────────
# Quick Demo
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import json

    print("=" * 60)
    print("MEDGUARD Risk Engine — Demo")
    print("=" * 60)

    # Test 1: Risk check for Ibuprofen + Paracetamol with alcohol
    print("\n🔍 Test 1: Ibuprofen + Paracetamol, alcohol=True, age=70")
    result = check_risk(
        drug_ids=["D03", "D01"],
        user_age=70,
        report_alcohol=True,
    )
    print(f"  Risk Level: {result['risk_level'].upper()}")
    print(f"  Flags: {len(result['flags'])}")
    for f in result["flags"]:
        print(f"    [{f['level'].upper()}] {f['type']}: {f.get('message', f.get('advice', f.get('symptom', '')))}")

    # Test 2: AMR monitor for Azithromycin with 3 missed doses
    print("\n🔍 Test 2: Azithromycin AMR monitor, 3 missed doses")
    result = amr_monitor("D04", missed_doses=3)
    print(f"  Risk Level: {result['risk_level'].upper()}")
    print(f"  WHO AWaRe: {result.get('who_aware_category')}")

    # Test 3: Explain risk for Ciprofloxacin
    print("\n🔍 Test 3: Explain risk — Ciprofloxacin")
    result = explain_risk("D10")
    print(f"  Molecule: {result['molecule']}")
    print(f"  ADRs: {len(result['adverse_reactions'])}")
    print(f"  Evidence citations: {len(result['evidence'])}")

    print(f"\n{DISCLAIMER}")
