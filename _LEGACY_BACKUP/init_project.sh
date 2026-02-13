
#!/bin/bash
echo "🚀 MED GUARD RESTART: Initializing..."

# 1. Cleanup Legacy
echo "[1/4] Archiving Legacy Code..."
mkdir -p _LEGACY_BACKUP
mv backend _LEGACY_BACKUP/ 2>/dev/null
mv frontend _LEGACY_BACKUP/ 2>/dev/null
mv *.sh _LEGACY_BACKUP/ 2>/dev/null
mv *.py _LEGACY_BACKUP/ 2>/dev/null
mv *.sql _LEGACY_BACKUP/ 2>/dev/null
mv *.db _LEGACY_BACKUP/ 2>/dev/null
mv *.txt _LEGACY_BACKUP/ 2>/dev/null
mv .gitignore _LEGACY_BACKUP/ 2>/dev/null
echo "✅ Legacy code moved to _LEGACY_BACKUP"

# 2. Init Vite Project (in current directory)
echo "[2/4] Creating Vite React Project..."
# We use 'frontend' folder logic or root? 
# Let's use current directory '.' if empty, but we just moved stuff.
# npm create vite@latest needs empty dir.
# Hack: create in 'app' then move content out?
# Or just accept 'frontend' folder as standard.
# User wants "Restart from scratch".
# Let's creating a 'frontend' folder again is safest.
npm create vite@latest frontend -- --template react
cd frontend

# 3. Install Dependencies
echo "[3/4] Installing Dependencies..."
npm install
npm install react-router-dom @supabase/supabase-js lucide-react clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4. Success
echo "✅ Project Initialized in 'frontend' folder."
echo "👉 Next: Update src/App.jsx and start coding."
echo "👉 To run: cd frontend && npm run dev"
