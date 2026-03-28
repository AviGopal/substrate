#!/bin/bash
# Validate boredom test templates

echo "=== Template Validation ==="
echo ""

template_count=0
valid_count=0
gradient_test_count=0

for file in test-boredom-templates/*.json; do
    if [[ ! -f "$file" || "$file" == *"README"* ]]; then
        continue
    fi
    
    template_count=$((template_count + 1))
    template_name=$(basename "$file")
    
    echo "Validating: $template_name"
    
    # Check JSON validity
    if ! jq empty "$file" 2>/dev/null; then
        echo "  ❌ Invalid JSON"
        continue
    fi
    
    # Check required fields
    activity_id=$(jq -r '.activity_id // empty' "$file")
    name=$(jq -r '.name // empty' "$file")
    category=$(jq -r '.category // empty' "$file")
    exec_count=$(jq -r '.estimated_metrics.execution_count // empty' "$file")
    gradient=$(jq -r '.estimated_metrics.improvement_gradient // empty' "$file")
    
    if [[ -z "$activity_id" || -z "$name" || -z "$category" || -z "$exec_count" || -z "$gradient" ]]; then
        echo "  ❌ Missing required fields"
        continue
    fi
    
    echo "  ✅ Valid JSON structure"
    echo "     Activity ID: $activity_id"
    echo "     Category: $category"
    echo "     Executions: $exec_count"
    echo "     Gradient: $gradient"
    
    # Check if execution count >= 3 (required for gradient calculation)
    if (( $(echo "$exec_count >= 3" | bc -l) )); then
        echo "     ✅ Execution count sufficient for gradient"
    else
        echo "     ⚠️  Execution count < 3 (gradient may not be calculated)"
    fi
    
    # Check if gradient is in low/medium range (< 0.5) for boredom detection
    if (( $(echo "$gradient < 0.5" | bc -l) )); then
        echo "     ✅ Gradient < 0.5 (should trigger boredom detection)"
        gradient_test_count=$((gradient_test_count + 1))
    else
        echo "     ⚠️  Gradient >= 0.5 (may not trigger boredom)"
    fi
    
    valid_count=$((valid_count + 1))
    echo ""
done

echo "=== Summary ==="
echo "Total templates: $template_count"
echo "Valid templates: $valid_count"
echo "Templates with gradient < 0.5: $gradient_test_count"
echo ""

if [[ $valid_count -eq $template_count && $gradient_test_count -ge 2 ]]; then
    echo "✅ All templates valid and ready for boredom testing"
    exit 0
else
    echo "⚠️  Some templates may need adjustment"
    exit 1
fi
