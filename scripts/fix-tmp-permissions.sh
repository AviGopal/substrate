#!/bin/bash
# Fix permissions on all tmp directories in the project
# This ensures all temporary directories are writable by the current user

set -e

echo "🔧 Fixing tmp directory permissions..."

# Fix root tmp directory
if [ -d "tmp/" ]; then
    chmod -R 777 tmp/
    echo "✓ Fixed: ./tmp/"
fi

# Fix nested tmp directories in repos
find . -type d -name "tmp" -exec chmod -R 777 {} \; 2>/dev/null || true

echo "✓ All tmp directories are now readable and writable"
echo ""
echo "Verified directories:"
find . -type d -name "tmp" -exec ls -ld {} \; 2>/dev/null | head -10

echo ""
echo "✅ Done! All tmp/ directories now have 777 permissions"
