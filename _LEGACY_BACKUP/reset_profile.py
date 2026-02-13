
import sqlite3
import os

# Use absolute path
DB_PATH = "/Users/hardikverma/Desktop/MED GUARD/backend/medguard_new.db"

def reset_profile():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("DELETE FROM user_profile")
        conn.commit()
        print("✅ User profile CLEARED.")
        print("✅ Please REFRESH the app page now.")
    except Exception as e:
        print(f"❌ Error clearing profile: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    reset_profile()
