
import sqlite3
import os

# Define Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "backend", "medguard_new.db")

def fix_database():
    if not os.path.exists(DB_PATH):
        print(f"⚠️ Database not found at {DB_PATH}. It will be created on app start.")
        return

    print(f"🔧 Fixing Database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. Drop old table
        print("   Removing old user_profile table...")
        cursor.execute("DROP TABLE IF EXISTS user_profile")

        # 2. Create new table with Diet and Occupation
        print("   Creating new schema...")
        create_query = """
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
            step_counter_enabled BOOLEAN DEFAULT 0,
            last_synced_steps INTEGER DEFAULT 0
        );
        """
        cursor.execute(create_query)
        conn.commit()
        print("✅ Database successfully updated! New columns added.")

    except Exception as e:
        print(f"❌ Error updating database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    fix_database()
