#!/bin/bash
echo "=================================================="
echo "   MED GUARD - FIX & RESET TOOL"
echo "=================================================="

# 1. Kill Stale Processes
echo "[1/3] Stopping old servers..."
# Kill process on port 5050 (Backend)
PID_BACKEND=$(lsof -t -i:5050)
if [ -n "$PID_BACKEND" ]; then
    echo "   Killing old Backend (PID $PID_BACKEND)..."
    kill -9 $PID_BACKEND
else
    echo "   No backend running."
fi

# Kill process on port 5173 (Frontend)
PID_FRONTEND=$(lsof -t -i:5173)
if [ -n "$PID_FRONTEND" ]; then
    echo "   Killing old Frontend (PID $PID_FRONTEND)..."
    kill -9 $PID_FRONTEND
else
    echo "   No frontend running."
fi

# 2. Reset Database (Force Clean)
echo ""
echo "[2/3] Resetting Database..."
rm -f "backend/medguard_new.db"
rm -f "backend/medguard.db" # Remove legacy just in case
rm -f "backend/medguard_new.db.bak"
echo "   ✅ Database files removed."

# 3. Restart App
echo ""
echo "[3/3] Restarting App..."
echo "   Calling start_app.sh..."
sh start_app.sh
