
import sqlite3
import os

# Define Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "backend", "medguard_new.db")

def update_schema():
    if not os.path.exists(DB_PATH):
        print(f"⚠️ Database not found at {DB_PATH}.")
        return

    print(f"🔧 Updating Database Schema at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. Check if 'symptoms' column exists in user_medicine_timeline
        cursor.execute("PRAGMA table_info(user_medicine_timeline)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'symptoms' not in columns:
            print("   Adding 'symptoms' column to user_medicine_timeline...")
            cursor.execute("ALTER TABLE user_medicine_timeline ADD COLUMN symptoms TEXT")
            print("   ✅ Column 'symptoms' added.")
        else:
            print("   ℹ️ Column 'symptoms' already exists.")

        # 2. Check if 'end_date' exists (it should, but verifying)
        if 'end_date' not in columns:
             print("   Adding 'end_date' column...")
             cursor.execute("ALTER TABLE user_medicine_timeline ADD COLUMN end_date TEXT")
             print("   ✅ Column 'end_date' added.")

        conn.commit()
        print("✅ Database schema update complete.")

    except Exception as e:
        print(f"❌ Error updating database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    update_schema()
