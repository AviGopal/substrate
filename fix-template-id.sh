#!/bin/bash
# Fix manage-session-memory template ID in local storage

TEMPLATE_PATH="$HOME/.local/share/opencode/storage/activity-template/manage-session-memory.json"

if [ ! -f "$TEMPLATE_PATH" ]; then
  echo "❌ Template not found at $TEMPLATE_PATH"
  exit 1
fi

echo "Fixing template ID..."
cat "$TEMPLATE_PATH" | jq '.id = "manage-session-memory"' > /tmp/template-fixed.json
mv /tmp/template-fixed.json "$TEMPLATE_PATH"

echo "✅ Template ID fixed"
cat "$TEMPLATE_PATH" | jq '{id, name, version, tasks: .tasks | length}'
