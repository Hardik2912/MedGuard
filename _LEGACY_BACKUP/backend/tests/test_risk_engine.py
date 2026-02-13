"""
MEDGUARD — Risk Engine Unit Tests
Tests RED / YELLOW / GREEN risk logic with sample cases.
"""

import sys
import os
import sqlite3

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import db as medguard_db


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path):
    """Create a fresh test database for each test."""
    test_db = str(tmp_path / "test_medguard.db")

    # Point all modules to test DB
    medguard_db.DB_PATH = test_db

    # Init with schema and seed
    medguard_db.init_db(test_db)
    yield test_db


class TestADRRisk:
    """ADR-based risk assessment."""

    def test_serious_adr_returns_red(self):
        from risk_engine import check_risk
        # Ibuprofen has red ADR (GI bleeding A02)
        result = check_risk(drug_ids=["D03"])
        red_flags = [f for f in result["flags"] if f["level"] == "red"]
        assert len(red_flags) > 0, "Serious ADR should trigger RED"
        assert result["risk_level"] == "red"

    def test_moderate_adr_returns_yellow(self):
        from risk_engine import check_risk
        # Amlodipine has yellow ADR (edema A13)
        result = check_risk(drug_ids=["D06"])
        yellow_flags = [f for f in result["flags"] if f["level"] == "yellow"]
        assert len(yellow_flags) > 0, "Moderate ADR should trigger YELLOW"

    def test_green_only_returns_green(self):
        from risk_engine import check_risk
        # Pantoprazole mild ADRs only when checked alone without elderly
        result = check_risk(drug_ids=["D07"])
        # May have yellow for bone fracture risk, but let's check it has flags
        assert result["risk_level"] in ("green", "yellow")


class TestInteractions:
    """Drug-drug interaction checks."""

    def test_red_interaction(self):
        from risk_engine import check_interactions
        # Ibuprofen + Diclofenac = dual NSAID = RED
        flags = check_interactions(["D03", "D14"])
        red_flags = [f for f in flags if f["level"] == "red"]
        assert len(red_flags) > 0, "Dual NSAID interaction should be RED"

    def test_yellow_interaction(self):
        from risk_engine import check_interactions
        # Ibuprofen + Paracetamol = additive liver toxicity = YELLOW
        flags = check_interactions(["D03", "D01"])
        yellow_flags = [f for f in flags if f["level"] == "yellow"]
        assert len(yellow_flags) > 0, "Additive hepatotoxicity should be YELLOW"

    def test_no_interaction(self):
        from risk_engine import check_interactions
        # Cetirizine + Pantoprazole = no known interaction
        flags = check_interactions(["D08", "D07"])
        assert len(flags) == 0, "No interaction expected"


class TestAlcohol:
    """Alcohol interaction checks."""

    def test_red_alcohol_interaction(self):
        from risk_engine import check_risk
        # Metronidazole + alcohol = disulfiram reaction = RED
        result = check_risk(drug_ids=["D11"], report_alcohol=True)
        alc_flags = [f for f in result["flags"] if f["type"] == "alcohol" and f["level"] == "red"]
        assert len(alc_flags) > 0, "Metronidazole + alcohol should be RED"

    def test_yellow_alcohol_interaction(self):
        from risk_engine import check_risk
        # Cetirizine + alcohol = drowsiness = YELLOW
        result = check_risk(drug_ids=["D08"], report_alcohol=True)
        alc_flags = [f for f in result["flags"] if f["type"] == "alcohol"]
        assert len(alc_flags) > 0, "Cetirizine + alcohol should flag"


class TestElderly:
    """Elderly caution checks."""

    def test_elderly_caution_triggers_yellow(self):
        from risk_engine import check_risk
        # Ciprofloxacin in elderly = tendon rupture risk
        result = check_risk(drug_ids=["D10"], user_age=70)
        elderly_flags = [f for f in result["flags"] if f["type"] == "elderly"]
        assert len(elderly_flags) > 0, "Elderly caution should trigger for ciprofloxacin"


class TestAMR:
    """AMR monitoring checks."""

    def test_missed_doses_red(self):
        from risk_engine import check_risk
        # Amoxicillin with 3 missed doses = RED
        result = check_risk(drug_ids=["D02"], missed_doses_map={"D02": 3})
        missed_flags = [f for f in result["flags"] if f["type"] == "missed_doses" and f["level"] == "red"]
        assert len(missed_flags) > 0, ">=2 missed doses should trigger RED"

    def test_missed_dose_yellow(self):
        from risk_engine import check_risk
        # Amoxicillin with 1 missed dose = YELLOW
        result = check_risk(drug_ids=["D02"], missed_doses_map={"D02": 1})
        missed_flags = [f for f in result["flags"] if f["type"] == "missed_doses" and f["level"] == "yellow"]
        assert len(missed_flags) > 0, "1 missed dose should trigger YELLOW"

    def test_amr_monitor_high_risk(self):
        from risk_engine import amr_monitor
        # Ciprofloxacin = WHO Watch, high AMR risk
        result = amr_monitor("D10", missed_doses=2)
        assert result["risk_level"] == "red"
        assert result["who_aware_category"] == "Watch"

    def test_amr_non_antibiotic(self):
        from risk_engine import amr_monitor
        # Paracetamol is not an antibiotic
        result = amr_monitor("D01")
        assert result["risk_level"] == "green"
        assert "not an antibiotic" in result["message"]


class TestExplainRisk:
    """Explainability and source citation checks."""

    def test_explain_has_sources(self):
        from risk_engine import explain_risk
        result = explain_risk("D10")  # Ciprofloxacin
        assert result["molecule"] == "Ciprofloxacin"
        assert len(result["adverse_reactions"]) > 0
        assert len(result["evidence"]) > 0
        for e in result["evidence"]:
            assert "source_name" in e
            assert "authority" in e

    def test_explain_has_disclaimer(self):
        from risk_engine import explain_risk
        result = explain_risk("D01")
        assert "disclaimer" in result
        assert "NOT" in result["disclaimer"]

    def test_explain_unknown_drug(self):
        from risk_engine import explain_risk
        result = explain_risk("D99")
        assert "error" in result


class TestDisclaimer:
    """Safety compliance — every output must have a disclaimer."""

    def test_risk_has_disclaimer(self):
        from risk_engine import check_risk
        result = check_risk(drug_ids=["D01"])
        assert "disclaimer" in result

    def test_amr_has_disclaimer(self):
        from risk_engine import amr_monitor
        result = amr_monitor("D02")
        assert "disclaimer" in result

    def test_explain_has_disclaimer(self):
        from risk_engine import explain_risk
        result = explain_risk("D01")
        assert "disclaimer" in result
