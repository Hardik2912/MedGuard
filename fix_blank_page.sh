
#!/bin/bash
echo "Fixing dependencies..."
cd frontend
npm uninstall react-router-dom
npm install react-router-dom@6
echo "✅ Fixed! Router downgraded to stable version."
