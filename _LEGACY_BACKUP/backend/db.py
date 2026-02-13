"""
MEDGUARD — Database Helper
SQLite connection manager with parameterized queries.
"""

import sqlite3
import os

# Note: schema structure is in new_schema.sql, but we load DATA from comprehensive_data.sql
# Ideally we should concat them or load both. 
# Let's assume comprehensive_data.sql ONLY has INSERTS and DELETEs, not CREATE TABLEs.
# So we need to:
# 1. Load Schema (new_schema.sql) - wait, new_schema.sql HAS inserts at the bottom.
# We should probably Create a CLEAN schema file first?
# Or we can just load new_schema.sql (which creates tables) and then load comprehensive_data.sql (which deletes old data and inserts new).


# Define Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "medguard_new.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "new_schema.sql")
DATA_PATH = os.path.join(BASE_DIR, "comprehensive_data.sql")



def get_connection(db_path=None):
    """Get a connection with foreign keys enabled."""
    conn = sqlite3.connect(db_path or DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path=None):
    """Initialize database from NEW schema file (includes data)."""
    conn = get_connection(db_path)
    try:
        with open(SCHEMA_PATH, "r") as f:
            conn.executescript(f.read())
        
        # Load comprehensive data on top
        if os.path.exists(DATA_PATH):
            with open(DATA_PATH, "r") as f:
                conn.executescript(f.read())
            print("[MEDGUARD] Comprehensive Data loaded.")
            
        conn.commit()
        print("[MEDGUARD] Database initialized successfully.")
    except sqlite3.IntegrityError as e:
        print(f"[MEDGUARD] Seed data may already exist: {e}")
    finally:
        conn.close()


def query(sql, params=(), db_path=None):
    """Execute a read query and return list of dicts."""
    conn = get_connection(db_path)
    try:
        rows = conn.execute(sql, params).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def execute(sql, params=(), db_path=None):
    """Execute a write query and return lastrowid."""
    conn = get_connection(db_path)
    try:
        cursor = conn.execute(sql, params)
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def table_stats(db_path=None):
    """Return row counts for all tables — for verification."""
    conn = get_connection(db_path)
    try:
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
        stats = {}
        for t in tables:
            name = t["name"]
            count = conn.execute(f"SELECT COUNT(*) as c FROM [{name}]").fetchone()["c"]
            stats[name] = count
        return stats
    finally:
        conn.close()


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("[MEDGUARD] Creating new database...")
        init_db()
    else:
        print("[MEDGUARD] Database already exists.")

    print("\n[MEDGUARD] Table statistics:")
    for table, count in table_stats().items():
        print(f"  {table}: {count} rows")
