#!/bin/bash
# MED GUARD - AUTO SETUP & RUN
# This script will install everything you need and start the app.

echo "=================================================="
echo "   MED GUARD - AUTOMATIC STARTUP"
echo "=================================================="

# 1. SET WORKING DIRECTORY
# Ensure we are in the script's directory so relative paths work
cd "$(dirname "$0")" || { echo "❌ Failed to change directory"; exit 1; }

# 2. CHECK TOOLS
echo "[1/4] Checking tools..."

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    echo "   ✅ Python found."
else
    echo "   ❌ ERROR: Python 3 is not installed!"
    echo "   Please download it from https://www.python.org/downloads/"
    exit 1
fi

# Check Node.js
if command -v npm &> /dev/null; then
    NPM_CMD="npm"
    echo "   ✅ Node.js found."
else
    echo "   ❌ ERROR: Node.js (npm) is not installed!"
    echo "   Please download it from https://nodejs.org/"
    exit 1
fi

# 2. SETUP BACKEND
echo ""
echo "[2/4] Setting up Backend..."
cd backend || { echo "❌ Cannot find 'backend' folder!"; exit 1; }

# Install Python requirements if needed
if [ -f "requirements.txt" ]; then
    echo "   Installing Python libraries (this might take a minute)..."
    $PYTHON_CMD -m pip install -r requirements.txt > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "   ✅ Libraries installed."
    else
        echo "   ⚠️ Warning: Could not install some Python libraries."
    fi
fi

# Start Backend
echo "   Starting Backend Server..."
$PYTHON_CMD api.py > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   ✅ Backend running (PID: $BACKEND_PID)"
cd ..

# 3. SETUP FRONTEND
echo ""
echo "[3/4] Setting up Frontend..."
cd frontend || { echo "❌ Cannot find 'frontend' folder!"; exit 1; }

# Install Node modules if missing
if [ ! -d "node_modules" ]; then
    echo "   Installing Frontend dependencies (this will take 1-2 minutes)..."
    echo "   Please wait..."
    $NPM_CMD install > /dev/null 2>&1
    echo "   ✅ Dependencies installed."
fi

# 4. LAUNCH
echo ""
echo "[4/4] Launching App..."
echo "=================================================="
echo "   OPENING BROWSER..."
echo "   Apps are running!"
echo "   Press CTRL+C to close everything."
echo "=================================================="

# Trap Ctrl+C to kill backend
trap "kill $BACKEND_PID; exit" INT

$NPM_CMD run dev
