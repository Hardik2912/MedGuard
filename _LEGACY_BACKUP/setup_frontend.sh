#!/bin/bash
# Setup Frontend for MED GUARD

echo "Setting up frontend..."
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
echo "Frontend setup complete!"
