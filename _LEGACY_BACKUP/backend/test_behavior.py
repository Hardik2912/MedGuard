
from db import init_db, execute, query
from risk_engine import analyze_user_behavior
import os

# Initialize DB (if needed)
if not os.path.exists("backend/medguard_new.db"):
    init_db("backend/medguard_new.db")

print("🔹 Seeding Test Data for Behavior Analysis...")
# Clear timeline
execute("DELETE FROM user_medicine_timeline")

# Scenario: Patient started Azithromycin 5 days ago, missed 2 doses.
# Drug D012 = Azithromycin (from comprehensive_data.sql)
execute("""
    INSERT INTO user_medicine_timeline (user_id, drug_id, start_date, missed_doses, confirmed) 
    VALUES ('test_user', 'D012', date('now', '-5 days'), 2, 1)
""")

# Scenario: Patient taking Paracetamol (D001) with adherence
execute("""
    INSERT INTO user_medicine_timeline (user_id, drug_id, start_date, missed_doses, confirmed) 
    VALUES ('test_user', 'D001', date('now', '-2 days'), 0, 1)
""")

print("🔹 Running Behavioral Analysis...")
insights = analyze_user_behavior("test_user")

print(f"\nFound {len(insights)} insights:")
for i in insights:
    print(f"[{i['level'].upper()}] {i['title']}: {i['message']}")
