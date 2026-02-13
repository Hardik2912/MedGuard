
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from api import app
    print("✅ API Import Successful!")
except ImportError as e:
    print(f"❌ Import Error: {e}")
except SyntaxError as e:
    print(f"❌ Syntax Error: {e}")
except Exception as e:
    print(f"❌ Other Error: {e}")
