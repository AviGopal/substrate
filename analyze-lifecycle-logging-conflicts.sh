#!/bin/bash
# Analyze conflicts with Activity Lifecycle Logging Specification

echo "=== Conflict Analysis: Activity Lifecycle Logging Specification ==="
echo ""

# Components touched by this specification
declare -a SPEC_FILES=(
  "activity.ts"
  "memory-agent.ts"
  "storage.ts"
  "activity-git.ts"
)

echo "Key files affected by Activity Lifecycle Logging:"
for file in "${SPEC_FILES[@]}"; do
  echo "  - $file"
done
echo ""

# Search for other validation results that reference the same files
echo "Checking for overlapping specifications..."
echo ""

OVERLAPS=0
for result_file in impulses/validation-results-*.json; do
  if [ "$result_file" = "impulses/validation-results-activity-lifecycle-logging.json" ]; then
    continue
  fi
  
  spec_name=$(basename "$result_file" .json | sed 's/validation-results-//')
  
  # Check if this validation result references any of our files
  for our_file in "${SPEC_FILES[@]}"; do
    if grep -q "$our_file" "$result_file" 2>/dev/null; then
      echo "⚠️  Overlap with: $spec_name"
      echo "   Shared file: $our_file"
      # Show what the overlap is about
      echo "   Context: $(grep -A 2 "$our_file" "$result_file" | head -3)"
      echo ""
      OVERLAPS=$((OVERLAPS + 1))
      break
    fi
  done
done

echo ""
if [ $OVERLAPS -eq 0 ]; then
  echo "✅ No overlapping specifications found"
else
  echo "⚠️  Found $OVERLAPS potentially overlapping specifications"
fi
