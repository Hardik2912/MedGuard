
#!/bin/bash
# MED GUARD - EASY START
echo "=================================================="
echo "   STARTING MED GUARD..."
echo "=================================================="

# Check if we are in root or frontend
if [ -d "frontend" ]; then
    cd frontend
fi

# Auto-fix blank page issue (Downgrade Router to v6 if needed)
if [ ! -f "router_fixed.lock" ]; then
    echo "[1/2] Checking Dependencies (Fixing Blank Page)..."
    npm install react-router-dom@6 --silent > /dev/null 2>&1
    touch router_fixed.lock
    echo "   ✅ Ready."
fi

# Start Dev Server
echo "[2/2] Launching App..."
echo ""
echo "👉 OPEN THIS LINK IN YOUR BROWSER:"
echo "   http://localhost:5173"
echo ""
npm run dev
