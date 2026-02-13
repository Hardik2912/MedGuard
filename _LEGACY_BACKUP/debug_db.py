
import sqlite3
import json
import os

DB_PATH = "backend/medguard_new.db"

def test_insert():
    print(f"Testing DB connection at: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("❌ Database file not found!")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 1. Check Table Info
        cursor.execute("PRAGMA table_info(user_profile)")
        columns = cursor.fetchall()
        print("\nTable Structure (user_profile):")
        for col in columns:
            print(f" - {col[1]} ({col[2]})")

        if not columns:
            print("❌ Table 'user_profile' does NOT exist!")
            return

        # 2. Try Insert (Simulating api.py)
        # Data
        user_id = "test_user"
        name = "Test User"
        gender = "Male"
        age = 30
        weight = 70
        height = 170
        diet = "Veg"
        occupation = "Student"
        conditions = ["None"]
        step_counter = False
        steps = 0

        sql = """
            INSERT OR REPLACE INTO user_profile 
            (user_id, name, gender, age, weight_kg, height_cm, diet, occupation, existing_conditions, step_counter_enabled, last_synced_steps)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        params = (
            user_id, name, gender, age, weight, height, diet, occupation, 
            json.dumps(conditions), step_counter, steps
        )
        
        print("\nAttempting INSERT...")
        cursor.execute(sql, params)
        conn.commit()
        print("✅ INSERT SUCCESSFUL!")
        
        conn.close()

    except Exception as e:
        print(f"\n❌ INSERT FAILED WITH ERROR:\n{str(e)}")

if __name__ == "__main__":
    test_insert()
