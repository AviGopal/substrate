#!/bin/bash
# Clean up test activity data from storage

STORAGE_DIR="$HOME/.local/share/opencode/storage/activity"
ARCHIVE_DIR="$HOME/.local/share/opencode/storage/activity-archive/test-data"

echo "Creating archive directory..."
mkdir -p "$ARCHIVE_DIR"

echo "Archiving test activities..."
cd "$STORAGE_DIR" || exit 1

# Move test template activities
moved=0
for pattern in "test-template-*" "base-template-*" "[TEST]" "[EVIDENCE_TEST]"; do
    for file in act_*.json; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            mv "$file" "$ARCHIVE_DIR/"
            ((moved++))
        fi
    done
done

echo "Archived $moved test activity files"
echo "Remaining activities: $(ls -1 $STORAGE_DIR/act_*.json 2>/dev/null | wc -l)"
echo ""
echo "Archive location: $ARCHIVE_DIR"
