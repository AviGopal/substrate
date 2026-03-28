#!/bin/bash
# Seed bootstrap templates to backend API

BACKEND_URL="http://localhost:8081"
BOOTSTRAP_DIR="repos/metabob-proto/activities/bootstrap"

echo "Seeding bootstrap templates to ${BACKEND_URL}"
echo "Source: ${BOOTSTRAP_DIR}"
echo ""

count=0
success=0
failed=0

for template_file in ${BOOTSTRAP_DIR}/*.json; do
    filename=$(basename "$template_file")
    template_id=$(jq -r '.activity_id // .name | gsub(" "; "-") | ascii_downcase' "$template_file")
    template_name=$(jq -r '.name' "$template_file")
    
    echo "[$((count+1))] Seeding: $filename"
    echo "    Template ID: $template_id"
    echo "    Name: $template_name"
    
    # POST template to API
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d @"$template_file" \
        "${BACKEND_URL}/v2/activities/templates" 2>&1)
    
    # Check if successful
    if echo "$response" | jq -e '.activity_id' > /dev/null 2>&1; then
        echo "    Status: ✅ SUCCESS"
        ((success++))
    elif echo "$response" | grep -q "already exists"; then
        echo "    Status: ⏭️  SKIPPED (already exists)"
        ((success++))
    else
        echo "    Status: ❌ FAILED"
        echo "    Error: $(echo $response | jq -r '.detail // .error // .' | head -c 100)"
        ((failed++))
    fi
    
    ((count++))
    echo ""
done

echo "========================================="
echo "Summary:"
echo "  Total: $count templates"
echo "  Success: $success"
echo "  Failed: $failed"
echo "========================================="
