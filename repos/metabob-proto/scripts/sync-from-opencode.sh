#!/bin/bash
# Sync templates from metabob-opencode to metabob-proto
#
# Usage: bash scripts/sync-from-opencode.sh [template-name]
#   If template-name provided, sync only that template
#   If no argument, sync all templates

set -e

OPENCODE_DIR="../metabob-opencode/packages/opencode/templates/built-in"
PROTO_DIR="activities/templates"

# Check if opencode dir exists
if [ ! -d "$OPENCODE_DIR" ]; then
  echo "Error: opencode templates directory not found: $OPENCODE_DIR"
  exit 1
fi

# Templates to sync (if no specific template requested)
TEMPLATES=(
  "create-activity-template.json"
  "fix-bug-with-impulses.json"
  "cleanup-docs-tests.json"
  "git-revision-management.json"
  "manage-session-memory.json"
)

echo "Syncing templates from metabob-opencode to metabob-proto..."
echo ""

SYNCED=0
SKIPPED=0

# If specific template provided, sync only that one
if [ -n "$1" ]; then
  TEMPLATES=("$1")
fi

for template in "${TEMPLATES[@]}"; do
  SRC="$OPENCODE_DIR/$template"
  DEST="$PROTO_DIR/$template"
  
  if [ -f "$SRC" ]; then
    # Get versions
    SRC_VERSION=$(jq -r '.version // 1' "$SRC" 2>/dev/null || echo "unknown")
    
    if [ -f "$DEST" ]; then
      DEST_VERSION=$(jq -r '.version // 1' "$DEST" 2>/dev/null || echo "unknown")
      
      # Only copy if source is newer
      if [ "$SRC_VERSION" != "unknown" ] && [ "$DEST_VERSION" != "unknown" ]; then
        if [ "$SRC_VERSION" -le "$DEST_VERSION" ]; then
          echo "Skipping: $template (v$SRC_VERSION <= v$DEST_VERSION)"
          SKIPPED=$((SKIPPED + 1))
          continue
        fi
      fi
    fi
    
    echo "Syncing: $template (v$SRC_VERSION)"
    cp "$SRC" "$DEST"
    SYNCED=$((SYNCED + 1))
    
    # Verify copy
    if diff -q "$SRC" "$DEST" >/dev/null; then
      echo "  ✓ Copy verified"
    else
      echo "  ✗ Copy verification failed!"
      exit 1
    fi
  else
    echo "Warning: $template not found in opencode"
  fi
done

echo ""
echo "Sync complete:"
echo "  Synced: $SYNCED templates"
echo "  Skipped: $SKIPPED templates (already up-to-date)"
echo ""

if [ $SYNCED -gt 0 ]; then
  echo "⚠️  Action required: Run 'python scripts/seed_activities.py' to update database"
else
  echo "No updates needed - all templates up-to-date"
fi
