#!/bin/bash

FILE="$1"

echo "=== ANALYZING: $FILE ==="
echo ""

# Check if file exists
if [ ! -f "$FILE" ]; then
    echo "STATUS: FILE NOT FOUND"
    return
fi

# 1. Check for references in other files
echo "1. REFERENCES IN CODE:"
rg -l "$FILE" --type-not md --type-not txt 2>/dev/null | head -5 || echo "No code references found"
echo ""

# 2. Check for references in documentation
echo "2. REFERENCES IN DOCS:"
rg -l "$FILE" --type md 2>/dev/null | head -5 || echo "No doc references found"
echo ""

# 3. Check git log for recent activity
echo "3. GIT ACTIVITY (last 30 days):"
git log --since="30 days ago" --oneline -- "$FILE" 2>/dev/null | head -5 || echo "No recent activity"
echo ""

# 4. File size and age
echo "4. FILE INFO:"
ls -lh "$FILE" 2>/dev/null | awk '{print "Size: " $5 ", Modified: " $6" "$7" "$8}'
echo ""

echo "---"
echo ""
