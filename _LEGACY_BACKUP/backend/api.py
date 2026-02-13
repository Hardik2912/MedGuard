"""
MEDGUARD — REST API Layer
Flask-based API for medication safety backend.

SAFETY: All responses include mandatory disclaimer.
This system provides EDUCATIONAL information only.
"""

from flask import Flask, request, jsonify
from datetime import date
import os
import sys
import json
import sqlite3
from flask_cors import CORS

# Ensure backend directory is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import init_db, query, execute, table_stats, DB_PATH
from risk_engine import check_risk, check_interactions, amr_monitor, explain_risk, analyze_user_behavior, DISCLAIMER
from ai_advisor import get_ai_advice
from ocr_pipeline import process_prescription_image, store_confirmed_medicine

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Helper: Initialize DB if missing
if not os.path.exists(DB_PATH):
    print(f"[MEDGUARD] Database {DB_PATH} not found. Initializing...")
    init_db()
else:
    # Optional: Check if we need to reload data? 
    # For now, just print path
    print(f"[MEDGUARD] Using Database: {DB_PATH}")


# ──────────────────────────────────────────────
# Schema Migration (Auto-Update)
# ──────────────────────────────────────────────

def update_schema_on_startup():
    """Ensure new columns exist in the database."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check user_medicine_timeline columns
        cursor.execute("PRAGMA table_info(user_medicine_timeline)")
        columns = [info[1] for info in cursor.fetchall()]
        
        updates = []
        if 'symptoms' not in columns:
            cursor.execute("ALTER TABLE user_medicine_timeline ADD COLUMN symptoms TEXT")
            updates.append("symptoms")
        if 'end_date' not in columns:
            cursor.execute("ALTER TABLE user_medicine_timeline ADD COLUMN end_date TEXT")
            updates.append("end_date")
        if 'taken_doses' not in columns:
            cursor.execute("ALTER TABLE user_medicine_timeline ADD COLUMN taken_doses INTEGER DEFAULT 0")
            updates.append("taken_doses")

        # Check if user_profile table exists, if not create it (Safety Net)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_profile'")
        if not cursor.fetchone():
            cursor.execute("""
                CREATE TABLE user_profile (
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
                )
            """)
            updates.append("CREATED_TABLE_user_profile")
            
        if updates:
            conn.commit()
            print(f"[MEDGUARD] Schema updated! Added columns: {', '.join(updates)}")
        else:
            print("[MEDGUARD] Schema is up to date.")
            
        conn.close()
    except Exception as e:
        print(f"[MEDGUARD] Schema update failed: {e}")

# ──────────────────────────────────────────────
# Startup: Initialize DB if needed
# ──────────────────────────────────────────────

@app.before_request
def ensure_db():
    """Ensure database exists on first request."""
    if not os.path.exists(DB_PATH):
        init_db()
        update_schema_on_startup() # Ensure schema is latest

# ──────────────────────────────────────────────
# Health Check
# ──────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Health check with database stats."""
    try:
        stats = table_stats()
        return jsonify({
            "status": "healthy",
            "database": "medguard.db",
            "tables": stats,
            "disclaimer": DISCLAIMER,
        })
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


# ──────────────────────────────────────────────
# POST /medicine — Add medicine to timeline
# ──────────────────────────────────────────────

@app.route("/medicine", methods=["POST"])
def add_medicine():
    """
    Add a confirmed medicine to user timeline.
    
    Body: { "drug_id": "D01", "user_id": "default", "start_date": "2025-01-15" }
    """
    data = request.get_json(force=True)
    drug_id = data.get("drug_id")
    user_id = data.get("user_id", "default")
    start_date = data.get("start_date", date.today().isoformat())
    
    # Calculate default end date (Assessment: 5 days for antibiotics, 30 for others)
    from datetime import datetime, timedelta
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    
    # Check if antibiotic (simple check)
    is_antibiotic = False
    drug_info = query("SELECT drug_class FROM drug_master WHERE drug_id = ?", (drug_id,))
    if drug_info and 'antibiotic' in drug_info[0]['drug_class'].lower():
        is_antibiotic = True
        
    duration = 5 if is_antibiotic else 10 # Default duration
    end_date = (start_dt + timedelta(days=duration)).strftime("%Y-%m-%d")

    if not drug_id:
        return jsonify({"error": "drug_id is required"}), 400

    # Validate drug exists
    drug = query("SELECT * FROM drug_master WHERE drug_id = ?", (drug_id,))
    if not drug:
        return jsonify({"error": f"Drug {drug_id} not found in database"}), 404

    row_id = execute(
        """INSERT INTO user_medicine_timeline (user_id, drug_id, start_date, end_date, confirmed, symptoms, taken_doses, missed_doses)
           VALUES (?, ?, ?, ?, 1, NULL, 0, 0)""",
        (user_id, drug_id, start_date, end_date),
    )

    return jsonify({
        "success": True,
        "timeline_id": row_id,
        "drug": drug[0]["molecule"],
        "drug_id": drug_id,
        "start_date": start_date,
        "end_date": end_date,
        "disclaimer": DISCLAIMER,
    })


# ──────────────────────────────────────────────
# POST /medicine/log — Log adherence (Taken/Missed)
# ──────────────────────────────────────────────

@app.route("/medicine/log", methods=["POST"])
def log_adherence():
    """
    Log a dose as taken or missed.
    Body: { "timeline_id": 1, "status": "taken" | "missed" }
    """
    data = request.get_json(force=True)
    timeline_id = data.get("timeline_id")
    status = data.get("status") # 'taken' or 'missed'
    
    if not timeline_id or status not in ['taken', 'missed']:
        return jsonify({"error": "Invalid parameters"}), 400
        
    col = "taken_doses" if status == "taken" else "missed_doses"
    
    execute(f"UPDATE user_medicine_timeline SET {col} = {col} + 1 WHERE id = ?", (timeline_id,))
    
    return jsonify({"success": True, "message": f"Dose marked as {status}"})


# ──────────────────────────────────────────────
# POST /medicine/symptoms — Report post-course symptoms
# ──────────────────────────────────────────────

@app.route("/medicine/symptoms", methods=["POST"])
def report_symptoms():
    """
    Save symptoms for a completed course.
    Body: { "timeline_id": 1, "symptoms": "Headache, Nausea" }
    """
    data = request.get_json(force=True)
    timeline_id = data.get("timeline_id")
    symptoms = data.get("symptoms")
    
    if not timeline_id or not symptoms:
        return jsonify({"error": "Missing parameters"}), 400
        
    execute("UPDATE user_medicine_timeline SET symptoms = ? WHERE id = ?", (symptoms, timeline_id))
    
    return jsonify({"success": True, "message": "Symptoms recorded"})


# ──────────────────────────────────────────────
# POST /risk — Run risk assessment
# ──────────────────────────────────────────────

@app.route("/risk", methods=["POST"])
def risk():
    """
    Run full risk assessment for a list of drugs.

    Body: {
        "drug_ids": ["D01", "D03"],
        "user_age": 70,
        "report_alcohol": true,
        "missed_doses": {"D02": 2}
    }
    """
    data = request.get_json(force=True)
    drug_ids = data.get("drug_ids", [])
    user_age = data.get("user_age")
    report_alcohol = data.get("report_alcohol", False)
    missed_doses = data.get("missed_doses", {})

    if not drug_ids:
        return jsonify({"error": "drug_ids list is required"}), 400

    result = check_risk(
        drug_ids=drug_ids,
        user_age=user_age,
        report_alcohol=report_alcohol,
        missed_doses_map=missed_doses,
    )

    return jsonify(result)


# ──────────────────────────────────────────────
# POST /interactions — Check drug interactions
# ──────────────────────────────────────────────

@app.route("/interactions", methods=["POST"])
def interactions():
    """
    Check drug-drug interactions for a list of drugs.

    Body: { "drug_ids": ["D03", "D14"] }
    """
    data = request.get_json(force=True)
    drug_ids = data.get("drug_ids", [])

    if len(drug_ids) < 2:
        return jsonify({
            "error": "At least 2 drug_ids are required to check interactions",
        }), 400

    flags = check_interactions(drug_ids)

    # Also check food/alcohol for each
    food_flags = []
    for drug_id in drug_ids:
        food_rows = query("""
            SELECT fai.*, dm.molecule
            FROM food_alcohol_interactions fai
            JOIN drug_master dm ON fai.drug_id = dm.drug_id
            WHERE fai.drug_id = ?
        """, (drug_id,))
        for row in food_rows:
            food_flags.append({
                "type": "food_alcohol",
                "drug": row["molecule"],
                "trigger": row["trigger_item"],
                "risk_level": row["risk_level"],
                "message": row["message"],
                "source": row["source"],
            })

    return jsonify({
        "drug_drug_interactions": flags,
        "food_alcohol_interactions": food_flags,
        "disclaimer": DISCLAIMER,
    })


# ──────────────────────────────────────────────
# POST /amr — AMR monitoring
# ──────────────────────────────────────────────

@app.route("/amr", methods=["POST"])
def amr():
    """
    Check AMR risk and adherence for an antibiotic.

    Body: { "drug_id": "D04", "missed_doses": 3 }
    """
    data = request.get_json(force=True)
    drug_id = data.get("drug_id")
    missed_doses = data.get("missed_doses", 0)

    if not drug_id:
        return jsonify({"error": "drug_id is required"}), 400

    result = amr_monitor(drug_id, missed_doses=missed_doses)
    return jsonify(result)


# ──────────────────────────────────────────────
# POST /explain — Explain risk with sources
# ──────────────────────────────────────────────

@app.route("/explain", methods=["POST"])
def explain():
    """
    Get full explainable risk profile for a drug.

    Body: { "drug_id": "D10" }
    """
    data = request.get_json(force=True)
    drug_id = data.get("drug_id")

    if not drug_id:
        return jsonify({"error": "drug_id is required"}), 400

    result = explain_risk(drug_id)
    return jsonify(result)


# ──────────────────────────────────────────────
# POST /ocr — Process prescription image
# ──────────────────────────────────────────────

@app.route("/ocr", methods=["POST"])
def ocr():
    """
    Process a prescription image through OCR pipeline.
    Accepts multipart/form-data with 'file' key.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Ensure uploads directory exists
    upload_folder = os.path.join(os.path.dirname(__file__), 'uploads')
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)

    # Save file
    file_path = os.path.join(upload_folder, file.filename)
    file.save(file_path)

    # Process
    result = process_prescription_image(file_path)
    
    # Optional: Clean up file after processing if desired, or keep for debugging
    # os.remove(file_path) 

    return jsonify(result)


# ──────────────────────────────────────────────
# POST /ocr/confirm — Confirm OCR result
# ──────────────────────────────────────────────

@app.route("/ocr/confirm", methods=["POST"])
def ocr_confirm():
    """
    Confirm and store a medicine from OCR results.

    Body: { "drug_id": "D01", "user_id": "default" }
    """
    data = request.get_json(force=True)
    drug_id = data.get("drug_id")
    user_id = data.get("user_id", "default")

    if not drug_id:
        return jsonify({"error": "drug_id is required"}), 400

    result = store_confirmed_medicine(drug_id, user_id=user_id)
    return jsonify({
        **result,
        "message": "Medicine confirmed and added to timeline.",
        "disclaimer": DISCLAIMER,
    })


# ──────────────────────────────────────────────
# GET /drugs — List all drugs (utility)
# ──────────────────────────────────────────────

@app.route("/drugs", methods=["GET"])
def list_drugs():
    """List all drugs in the database."""
    drugs = query("""
        SELECT dm.*, GROUP_CONCAT(bm.brand_name, ', ') as brands
        FROM drug_master dm
        LEFT JOIN brand_mapping bm ON dm.drug_id = bm.drug_id
        GROUP BY dm.drug_id
    """)
    return jsonify({"drugs": drugs, "count": len(drugs), "disclaimer": DISCLAIMER})


# ──────────────────────────────────────────────
# GET /analysis/behavior — Longitudinal Analysis
# ──────────────────────────────────────────────

@app.route("/analysis/behavior", methods=["GET"])
def get_behavior_analysis():
    """Get longitudinal behavioral analysis for the user."""
    user_id = request.args.get('user_id', 'default')
    
    # Analyze patterns
    insights = analyze_user_behavior(user_id)
    
    return jsonify({
        "user_id": user_id,
        "insights": insights,
        "disclaimer": DISCLAIMER
    })


# ──────────────────────────────────────────────
# POST /ai/advice — AI Persona Response
# ──────────────────────────────────────────────

@app.route("/ai/advice", methods=["POST"])
def get_ai_advice_endpoint():
    """
    Get 'AI'-generated advice based on user context.
    Aggregates data from DB + Risk Engine to build the Context JSON,
    then passes it to `ai_advisor` to generate the Persona Response.
    
    Body: { "user_id": "default", "user_age": 72, "mode": "senior" }
    """
    data = request.get_json(force=True)
    user_id = data.get("user_id", "default")
    user_age = data.get("user_age", 40)
    mode = data.get("mode", "adult")
    
    # 1. Fetch User's Active Medicines
    timeline_rows = query("""
        SELECT drug_id, missed_doses FROM user_medicine_timeline 
        WHERE user_id = ? AND confirmed = 1
    """, (user_id,))
    
    drug_ids = [row["drug_id"] for row in timeline_rows]
    missed_map = {row["drug_id"]: row["missed_doses"] for row in timeline_rows}
    total_missed = sum(row["missed_doses"] for row in timeline_rows)

    # 2. Run Risk Engine
    risk_result = check_risk(drug_ids, user_age=user_age, missed_doses_map=missed_map)
    
    # 3. Detect Risk Types
    risk_types = set()
    for f in risk_result["flags"]:
        if f["level"] in ["red", "yellow"]:
            if f["type"] == "interaction": risk_types.add("Interaction")
            elif f["type"] == "amr": risk_types.add("AMR")
            elif f["type"] == "alcohol": risk_types.add("ADR") # Alcohol falls under ADR/Interaction
            elif f["type"] == "behavior": risk_types.add("Behavior")
    
    # 4. Build Context for AI
    # Fetch detailed profile
    profile_row = query("SELECT * FROM user_profile WHERE user_id = ?", (user_id,))
    user_context = {}
    if profile_row:
        user_context = profile_row[0]

    ai_context = {
        "user_mode": mode,
        "user_profile": {
            "age": user_age,
            "diet": user_context.get("diet", "Unknown"),
            "occupation": user_context.get("occupation", "Unknown"),
            "weight": user_context.get("weight_kg"),
        },
        "current_risk_level": risk_result["risk_level"],
        "risk_types": list(risk_types),
        "medications": drug_ids, # simplified
        "adherence_summary": {
            "missed_doses_last_3_days": total_missed
        },
        "symptom_summary": [] # Placeholder for now
    }
    
    # 5. Get Advice
    advice = get_ai_advice(ai_context)
    
    return jsonify(advice)


# ──────────────────────────────────────────────
# POST /user/profile — Create/Update Profile
# ──────────────────────────────────────────────

@app.route("/user/profile", methods=["POST"])
def update_profile():
    """
    Create or update user profile from Onboarding.
    Body: { "user_id": "default", "name": "...", "gender": "...", "diet": "...", "occupation": "..." }
    """
    data = request.get_json(force=True)
    user_id = data.get("user_id", "default")
    
    try:
        # Upsert logic (SQLite doesn't have native UPSERT in older versions, so we try insert or replace)
        execute("""
            INSERT OR REPLACE INTO user_profile 
            (user_id, name, gender, age, weight_kg, height_cm, diet, occupation, existing_conditions, step_counter_enabled, last_synced_steps)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            data.get("name"),
            data.get("gender"),
            data.get("age"),
            data.get("weight"),
            data.get("height"),
            data.get("diet"),
            data.get("occupation"),
            json.dumps(data.get("conditions", [])), # Store as JSON string
            data.get("step_counter_enabled", False),
            data.get("steps", 0)
        ))
        return jsonify({"success": True, "message": "Profile updated"})
    except Exception as e:
        print(f"[ERROR] Failed to save profile: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/user/profile", methods=["GET"])
def get_profile():
    """Get user profile to check if onboarding is needed."""
    user_id = request.args.get("user_id", "default")
    row = query("SELECT * FROM user_profile WHERE user_id = ?", (user_id,))
    
    if not row:
        return jsonify({"exists": False})
    
    profile = dict(row[0]) # Convert Row to dict
    # Parse conditions back to list
    try:
        profile["existing_conditions"] = json.loads(profile["existing_conditions"])
    except:
        profile["existing_conditions"] = []

    return jsonify({"exists": True, "profile": profile})


# ──────────────────────────────────────────────
# POST /device/sync — Simulate Watch Sync
# ──────────────────────────────────────────────

@app.route("/device/sync", methods=["POST"])
def device_sync():
    """
    Simulate connecting to a smart watch/step counter.
    Returns mock vitals.
    """
    import random
    
    # Simulate a delay for "Scanning..."
    # (Frontend handles the delay visually)
    
    mock_steps = random.randint(3000, 12000)
    mock_hr = random.randint(65, 85)
    
    # Update profile with latest steps
    user_id = request.json.get("user_id", "default")
    execute("UPDATE user_profile SET last_synced_steps = ?, step_counter_enabled = 1 WHERE user_id = ?", 
            (mock_steps, user_id))
    
    return jsonify({
        "success": True,
        "device": "HealthWatch Series 7",
        "vitals": {
            "steps": mock_steps,
            "heart_rate": mock_hr,
            "calories": int(mock_steps * 0.04)
        }
    })


# ──────────────────────────────────────────────
# GET /drugs/<drug_id> — Get single drug info
# ──────────────────────────────────────────────

@app.route("/drugs/<drug_id>", methods=["GET"])
def get_drug(drug_id):
    """Get detailed info for a single drug."""
    result = explain_risk(drug_id)
    return jsonify(result)


# ──────────────────────────────────────────────
# GET /timeline — Get user medicine timeline
# ──────────────────────────────────────────────

@app.route("/timeline", methods=["GET"])
def get_timeline():
    """
    Get all medicines for a user.
    Query: ?user_id=default
    """
    user_id = request.args.get("user_id", "default")
    
    timeline = query("""
        SELECT umt.*, dm.molecule, dm.drug_class, 
               CASE WHEN lower(dm.drug_class) LIKE '%antibiotic%' THEN 1 ELSE 0 END as is_antibiotic,
               dm.common_use
        FROM user_medicine_timeline umt
        JOIN drug_master dm ON umt.drug_id = dm.drug_id
        WHERE umt.user_id = ?
        ORDER BY umt.start_date DESC
    """, (user_id,))
    
    return jsonify({
        "timeline": timeline,
        "count": len(timeline),
        "disclaimer": DISCLAIMER
    })


# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    # Initialize DB on startup
    if not os.path.exists(DB_PATH):
        print("[MEDGUARD] Initializing database...")
        init_db()
    
    # Run Schema Update
    update_schema_on_startup()

    print("[MEDGUARD] Starting API server...")
    print("[MEDGUARD] Endpoints:")
    print("  GET  /health          — Health check")
    print("  GET  /drugs           — List all drugs")
    print("  GET  /drugs/<id>      — Get drug details")
    print("  POST /medicine        — Add medicine to timeline")
    print("  POST /risk            — Risk assessment")
    print("  POST /interactions    — Check interactions")
    print("  POST /amr             — AMR monitoring")
    print("  POST /explain         — Explain risk with sources")
    print("  POST /ocr             — Process prescription image")
    print("  POST /ocr/confirm     — Confirm OCR medicine")
    print(f"\n{DISCLAIMER}\n")

    app.run(host="0.0.0.0", port=5050, debug=True)
