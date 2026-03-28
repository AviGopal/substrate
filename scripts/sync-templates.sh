#!/bin/bash
# Sync Local Templates to Backend API

API_URL="${METABOB_API_URL:-http://api.metabob.local:8080}"
API_KEY="${METABOB_API_KEY:-mb_devbob_test_simple_2026_v2}"
STORAGE_PATH="$HOME/.local/share/opencode/storage/activity-template"

echo "🔄 Template Sync: Local Storage → Backend API"
echo "   Storage: $STORAGE_PATH"
echo "   Backend: $API_URL"
echo ""

# Check backend
echo "Step 1: Checking backend connectivity..."
response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $API_KEY" "$API_URL/v2/activities/templates")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" != "200" ]; then
  echo "❌ Backend check failed (HTTP $http_code)"
  echo "   Response: $body"
  exit 1
fi

template_count=$(echo "$body" | jq -r '.templates | length')
echo "✅ Backend connected: $template_count templates exist"
echo ""

# Load and register templates
echo "Step 2: Registering templates from local storage..."
success=0
failed=0

for file in "$STORAGE_PATH"/*.json; do
  if [ ! -f "$file" ]; then
    continue
  fi
  
  template_id=$(jq -r '.id' "$file")
  template_name=$(jq -r '.name' "$file")
  
  # POST template to backend
  response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$file" \
    "$API_URL/v2/activities/templates")
  
  http_code=$(echo "$response" | tail -n1)
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "  ✅ Registered: $template_id"
    ((success++))
  elif [ "$http_code" = "409" ]; then
    echo "  ℹ️  Already exists: $template_id"
    ((success++))
  else
    echo "  ❌ Failed: $template_id (HTTP $http_code)"
    ((failed++))
  fi
done

echo ""
echo "═══════════════════════════════════════"
echo "  Sync Complete"
echo "═══════════════════════════════════════"
echo "  ✅ Registered: $success"
echo "  ❌ Failed: $failed"
echo "═══════════════════════════════════════"

if [ $failed -gt 0 ]; then
  exit 1
else
  echo ""
  echo "✅ All templates synced successfully!"
  exit 0
fi
