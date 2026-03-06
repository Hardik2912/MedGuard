
#!/bin/bash
echo "Installing dependencies..."
cd frontend
npm install react-router-dom lucide-react clsx tailwind-merge @supabase/supabase-js
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
echo "✅ Dependencies installed!"
