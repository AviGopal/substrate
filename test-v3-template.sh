#!/bin/bash
set -e

echo "=== Testing create-activity-template-v3 ==="
echo ""

# Work directory
cd /workspace

echo "1. Validating V3 template structure..."
if jq empty create-activity-template-v3.json 2>/dev/null; then
  echo "   ✓ V3 JSON syntax valid"
else
  echo "   ✗ V3 JSON syntax invalid"
  exit 1
fi

echo ""
echo "2. Checking V3 task count..."
TASK_COUNT=$(jq '.tasks | length' create-activity-template-v3.json)
echo "   Task count: $TASK_COUNT"
if [ "$TASK_COUNT" -eq 5 ]; then
  echo "   ✓ Expected 5 tasks"
else
  echo "   ⚠ Expected 5 tasks, got $TASK_COUNT"
fi

echo ""
echo "3. Checking required context..."
jq -r '.contextRequirements[] | "   - \(.key) (required: \(.required))"' create-activity-template-v3.json

echo ""
echo "4. Task summary:"
jq -r '.tasks[] | "   - \(.id): \(.description)"' create-activity-template-v3.json

echo ""
echo "5. Creating minimal test template manually..."
cat > hello-world-test.json << 'EOF'
{
  "variant_id": "hello-world-test-v1",
  "activity_id": "hello-world-test",
  "variant_name": "v1-test",
  "version": 1,
  "description": "Minimal test template",
  "variables": {
    "message": {
      "type": "string",
      "required": true,
      "description": "Message to print"
    }
  },
  "prompt_strategy": "guided",
  "context_budget_tokens": 5000,
  "expected_duration_ms": 30000,
  "expected_cost": 0.05,
  "expected_quality_score": 0.80,
  "status": "active",
  "tasks": [
    {
      "id": "print-message",
      "subagent": "general",
      "description": "Print the hello message",
      "dependencies": [],
      "guidance": ["Print the message using bash echo"],
      "impulse_refs": [],
      "prompt": {
        "template": "Print this message: {{message}}",
        "max_tokens": 2000,
        "compression_strategy": "filter",
        "variables": ["message"]
      },
      "validation": {
        "required_files": [],
        "required_patterns": [],
        "forbidden_patterns": [],
        "commands": []
      },
      "retry": {
        "max_attempts": 2,
        "strategy": "simple",
        "fallback_prompt": "Try again"
      },
      "metrics": {
        "success_rate": 0,
        "avg_tokens": 0,
        "avg_duration": 0,
        "common_failures": []
      },
      "tools": {
        "required": ["bash"],
        "optional": [],
        "disabled": []
      }
    }
  ]
}
EOF

echo "   Created hello-world-test.json"

echo ""
echo "6. Validating test template..."
if jq empty hello-world-test.json 2>/dev/null; then
  echo "   ✓ Test template JSON syntax valid"
else
  echo "   ✗ Test template JSON syntax invalid"
  exit 1
fi

echo ""
echo "=== V3 Template Validation Complete ==="
echo ""
echo "Summary:"
echo "  V3 Template: create-activity-template-v3.json"
echo "  Tasks: $TASK_COUNT"
echo "  Status: Ready for execution testing"
echo ""
echo "Next: Execute V3 to create a template using the activity system"
