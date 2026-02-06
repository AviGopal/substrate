#!/bin/bash
# Find disconnected code - LOCAL EXECUTION (not delegated)

echo "🔍 FINDING DISCONNECTED CODE (LOCAL)"
echo "=========================================="
echo

echo "📋 Task 1: Files with 0 imports"
echo "----------------------------------------"

# Find Python files with no imports
echo "Searching repos/ for Python files..."
find repos/ -name "*.py" -type f 2>/dev/null | while read file; do
    # Skip special files
    basename=$(basename "$file")
    if [[ "$basename" == "__init__.py" ]] || \
       [[ "$basename" == "__main__.py" ]] || \
       [[ "$basename" == "setup.py" ]] || \
       [[ "$basename" == "conftest.py" ]] || \
       [[ "$basename" =~ ^test_ ]] || \
       [[ "$basename" =~ _test\.py$ ]]; then
        continue
    fi
    
    # Get base name without extension
    base=$(basename "$file" .py)
    
    # Search for imports of this file
    import_count=$(grep -r "from.*$base import\|import.*$base" repos/ --include="*.py" 2>/dev/null | grep -v "$file" | wc -l)
    
    if [ "$import_count" -eq 0 ]; then
        lines=$(wc -l < "$file")
        echo "DISCONNECTED: $file ($lines lines, 0 imports)"
    fi
done | head -20

echo
echo "📋 Task 2: Recently added files"
echo "----------------------------------------"

# Check git history for recently added files
if [ -d repos/.git ]; then
    echo "Checking git log for files added in last 30 days..."
    git log --since="30 days ago" --name-only --diff-filter=A --pretty=format: repos/ 2>/dev/null | \
        grep "\.py$" | sort -u | head -10
else
    echo "Not in git repo or no recent additions"
fi

echo
echo "📋 Task 3: Check lib/ import status"
echo "----------------------------------------"

# Check if our own lib files are imported
for file in lib/*.py; do
    if [ -f "$file" ]; then
        basename=$(basename "$file" .py)
        import_count=$(grep -r "from lib.$basename import\|from lib import.*$basename" . --include="*.py" 2>/dev/null | grep -v "^lib/" | wc -l)
        echo "$file: $import_count imports found"
    fi
done

echo
echo "✅ Analysis complete"
