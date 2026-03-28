#!/bin/bash
# Static validation: Check if all 8 lifecycle log statements exist in source code

echo "=== Activity Lifecycle Logging - Static Validation ==="
echo ""

OPENCODE_SRC="repos/metabob-opencode/packages/opencode/src"

declare -A PATTERNS
PATTERNS[activity_start]="tool/activity.ts:Activity.*starting"
PATTERNS[memory_init]="session/memory-agent.ts:Memory agent initializing"
PATTERNS[memory_complete]="session/memory-agent.ts:Memory agent gathered.*impulses"
PATTERNS[task_start]="tool/activity.ts:Task starting:"
PATTERNS[task_complete]="tool/activity.ts:Task completed:"
PATTERNS[storage_write]="storage/storage.ts:storage write confirmed"
PATTERNS[git_commit]="session/activity-git.ts:Git commit created:"
PATTERNS[activity_complete]="session/activity.ts:Activity completed:"

PASS_COUNT=0
FAIL_COUNT=0

echo "Checking source code for lifecycle log statements..."
echo ""

for name in "${!PATTERNS[@]}"; do
  IFS=':' read -r file search_pattern <<< "${PATTERNS[$name]}"
  search_file="$OPENCODE_SRC/$file"
  
  if [ ! -f "$search_file" ]; then
    echo "❌ $name: File not found: $search_file"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi
  
  # Search for pattern in file
  if grep -q "$search_pattern" "$search_file"; then
    line_num=$(grep -n "$search_pattern" "$search_file" | head -1 | cut -d: -f1)
    echo "✅ $name: Found at $file:$line_num"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "❌ $name: Pattern '$search_pattern' not found in $search_file"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
echo "=== Static Validation Results ==="
echo "Passed: $PASS_COUNT/8"
echo "Failed: $FAIL_COUNT/8"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "✅ PASS: All 8 lifecycle log statements exist in source code"
  exit 0
else
  echo "❌ FAIL: $FAIL_COUNT lifecycle log statements missing"
  exit 1
fi
