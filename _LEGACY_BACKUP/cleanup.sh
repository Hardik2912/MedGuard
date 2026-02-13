
#!/bin/bash
mkdir -p _LEGACY_BACKUP

# Move directories
[ -d "backend" ] && mv backend _LEGACY_BACKUP/
[ -d "frontend" ] && mv frontend _LEGACY_BACKUP/

# Move specific file types
mv *.sh _LEGACY_BACKUP/ 2>/dev/null
mv *.py _LEGACY_BACKUP/ 2>/dev/null
mv *.sql _LEGACY_BACKUP/ 2>/dev/null
mv *.db _LEGACY_BACKUP/ 2>/dev/null
mv *.txt _LEGACY_BACKUP/ 2>/dev/null

echo "Legacy code moved to _LEGACY_BACKUP"
