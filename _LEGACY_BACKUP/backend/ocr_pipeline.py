"""
MEDGUARD — OCR Normalization Pipeline

Pipeline: image → OCR text → medicine extraction → fuzzy match → user confirmation → storage

SAFETY: Mandatory user confirmation before any OCR result is stored.
"""

import re
from rapidfuzz import fuzz, process
from db import query, execute


# ──────────────────────────────────────────────
# Step 1: Extract text from image (OCR)
# ──────────────────────────────────────────────

def extract_text_from_image(image_path):
    """
    Extract text from a prescription/medicine image using Tesseract OCR.
    Returns raw OCR text string.
    """
    try:
        from PIL import Image
        import pytesseract
        img = Image.open(image_path)
        raw_text = pytesseract.image_to_string(img, lang="eng")
        return raw_text.strip()
    except ImportError:
        print("⚠️ Module not found. Using Mock OCR.")
        return _mock_ocr(image_path)
    except Exception as e:
        print(f"⚠️ OCR Failed: {e}. Using Mock OCR for Prototype.")
        return _mock_ocr(image_path)


def _mock_ocr(image_path):
    """Fallback mock OCR for testing without Tesseract installed."""
    return (
        "Tab. Paracetamol 500mg\n"
        "Tab. Amoxiclav 625\n"
        "Tab. Azithromycin 500\n"
        "Tab. Ibuprofen 400"
    )


# ──────────────────────────────────────────────
# Step 2: Extract medicine names from OCR text
# ──────────────────────────────────────────────

def extract_medicine_names(ocr_text):
    """
    Parse OCR text to extract potential medicine names.
    Handles common Indian prescription formats.
    """
    medicines = []
    lines = ocr_text.split("\n")

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Remove common prefixes
        cleaned = re.sub(
            r'^(Tab\.?|Cap\.?|Syp\.?|Inj\.?|Susp\.?|Oint\.?)\s*',
            '', line, flags=re.IGNORECASE
        )

        # Try to extract the brand/molecule name (first meaningful word group)
        # Match patterns like "Dolo 650" or "Azithral 500" or "Pan-D"
        match = re.match(r'([A-Za-z][A-Za-z0-9\-]+(?:\s+\d+)?)', cleaned)
        if match:
            name = match.group(1).strip()
            # Also try to extract molecule from parentheses
            mol_match = re.search(r'\(([A-Za-z]+)', line)
            molecule = mol_match.group(1) if mol_match else None
            medicines.append({
                "raw_text": line,
                "extracted_name": name,
                "extracted_molecule": molecule,
            })

    return medicines


# ──────────────────────────────────────────────
# Step 3: Fuzzy match against drug_master
# ──────────────────────────────────────────────

def fuzzy_match_drugs(extracted_names, threshold=60):
    """
    Match extracted medicine names against drug_master and brand_mapping
    using fuzzy string matching.

    Returns list of candidates with confidence scores.
    NO results are stored until user confirms.
    """
    # Load all known drugs and brands
    drugs = query("SELECT drug_id, molecule FROM drug_master")
    brands = query("SELECT brand_name, drug_id FROM brand_mapping")

    drug_names = {d["molecule"]: d["drug_id"] for d in drugs}
    brand_names = {b["brand_name"]: b["drug_id"] for b in brands}

    all_names = {}
    all_names.update(drug_names)
    all_names.update(brand_names)

    name_list = list(all_names.keys())
    results = []

    for med in extracted_names:
        candidates = []

        # Try molecule match first
        if med["extracted_molecule"]:
            mol_matches = process.extract(
                med["extracted_molecule"], name_list,
                scorer=fuzz.WRatio, limit=3
            )
            for match_name, score, _ in mol_matches:
                if score >= threshold:
                    candidates.append({
                        "matched_name": match_name,
                        "drug_id": all_names[match_name],
                        "confidence": round(score, 1),
                        "match_type": "molecule",
                    })

        # Try brand name match
        brand_matches = process.extract(
            med["extracted_name"], name_list,
            scorer=fuzz.WRatio, limit=3
        )
        for match_name, score, _ in brand_matches:
            if score >= threshold:
                # Avoid duplicates
                if not any(c["matched_name"] == match_name for c in candidates):
                    candidates.append({
                        "matched_name": match_name,
                        "drug_id": all_names[match_name],
                        "confidence": round(score, 1),
                        "match_type": "brand",
                    })

        # Sort by confidence
        candidates.sort(key=lambda x: x["confidence"], reverse=True)

        results.append({
            "raw_text": med["raw_text"],
            "extracted_name": med["extracted_name"],
            "candidates": candidates,
            "requires_confirmation": True,  # ALWAYS
        })

    return results


# ──────────────────────────────────────────────
# Step 4: Store confirmed medicines
# ──────────────────────────────────────────────

def store_confirmed_medicine(drug_id, user_id="default", start_date=None):
    """
    Store a USER-CONFIRMED medicine in the timeline.
    This should ONLY be called after explicit user confirmation.
    """
    from datetime import date, datetime, timedelta
    if start_date is None:
        start_date = date.today().isoformat()

    # Calculate default end date (Assessment: 5 days for antibiotics, 30 for others)
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    
    # Check if antibiotic (simple check from DB)
    is_antibiotic = False
    drug_info = query("SELECT drug_class FROM drug_master WHERE drug_id = ?", (drug_id,))
    if drug_info and 'antibiotic' in drug_info[0]['drug_class'].lower():
        is_antibiotic = True
        
    duration = 5 if is_antibiotic else 10 # Default duration
    end_date = (start_dt + timedelta(days=duration)).strftime("%Y-%m-%d")

    print(f"[DEBUG] Attempting to store medicine: user={user_id}, drug={drug_id}, date={start_date}")
    try:
        row_id = execute(
            """INSERT INTO user_medicine_timeline (user_id, drug_id, start_date, end_date, confirmed, symptoms, taken_doses, missed_doses)
               VALUES (?, ?, ?, ?, 1, NULL, 0, 0)""",
            (user_id, drug_id, start_date, end_date),
        )
        print(f"[DEBUG] Successfully stored at row {row_id}")
        return {"stored": True, "timeline_id": row_id, "drug_id": drug_id, "start_date": start_date, "end_date": end_date}
    except Exception as e:
        print(f"[ERROR] Failed to store medicine: {e}")
        return {"stored": False, "error": str(e)}


# ──────────────────────────────────────────────
# Full Pipeline (returns candidates, NOT auto-stored)
# ──────────────────────────────────────────────

def process_prescription_image(image_path):
    """
    Full OCR pipeline: image → text → extract → fuzzy match → candidates.

    ⚠️  Results are NOT stored until user confirms each medicine.
    Returns candidate matches for user review.
    """
    # Step 1: OCR
    raw_text = extract_text_from_image(image_path)
    if raw_text.startswith("[OCR_ERROR]"):
        return {"error": raw_text, "step": "ocr"}

    # Step 2: Extract names
    extracted = extract_medicine_names(raw_text)
    if not extracted:
        return {
            "raw_text": raw_text,
            "candidates": [],
            "message": "No medicine names could be extracted from the image.",
        }

    # Step 3: Fuzzy match
    matches = fuzzy_match_drugs(extracted)

    return {
        "raw_text": raw_text,
        "extracted_count": len(extracted),
        "candidates": matches,
        "message": "⚠️ Please review and confirm each medicine before proceeding.",
        "requires_user_confirmation": True,
    }


# ──────────────────────────────────────────────
# Demo
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import json

    print("=" * 60)
    print("MEDGUARD OCR Pipeline — Demo (Mock OCR)")
    print("=" * 60)

    result = process_prescription_image("demo_prescription.jpg")
    print(f"\nRaw OCR Text:\n{result['raw_text']}")
    print(f"\nExtracted: {result['extracted_count']} medicines")

    for i, candidate in enumerate(result["candidates"], 1):
        print(f"\n  Medicine {i}: {candidate['extracted_name']}")
        for c in candidate["candidates"][:2]:
            print(f"    → {c['matched_name']} ({c['drug_id']}) "
                  f"confidence={c['confidence']}% [{c['match_type']}]")

    print(f"\n⚠️  {result['message']}")
