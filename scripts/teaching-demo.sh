#!/usr/bin/env bash
#
# MiniBob Teaching Demo
# Demonstrates the complete teaching workflow:
# 1. Improvise a new task
# 2. Extract template from execution
# 3. Use template again
# 4. Provide feedback
# 5. Observe Thompson Sampling improvement
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
MINIBOB_DIR="$WORKSPACE_ROOT/repos/minibob"
BACKEND_URL="${ACTIVITY_API_ENDPOINT:-https://activity.metabob.com}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "  MiniBob Teaching Workflow Demo"
echo "=========================================="
echo ""

cd "$MINIBOB_DIR"

# Function to wait for user
wait_for_user() {
    echo ""
    echo -e "${YELLOW}Press Enter to continue...${NC}"
    read -r
}

# Step 1: Check initial state
echo -e "${BLUE}Step 1: Check Initial Thompson Sampling State${NC}"
echo "Running: minibob doctor health --deep"
echo ""
bun run index.ts doctor health --deep --json 2>&1 | grep -v '^\[' > /tmp/health-before.json
INITIAL_TEMPLATES=$(jq -r '.checks[] | select(.name == "Template Registry") | .message' /tmp/health-before.json | grep -oP '\d+')
echo "✓ Current template count: $INITIAL_TEMPLATES"
echo ""
wait_for_user

# Step 2: Improvise a new task
echo -e "${BLUE}Step 2: Improvise a New Task (No Template Exists)${NC}"
echo "Goal: Write 'Hello from teaching demo' to demo-output.txt"
echo ""
echo "Running: minibob --single \"write 'Hello from teaching demo' to demo-output.txt\""
echo ""

# Create a simple goal that will succeed
bun run index.ts --single "write the text 'Hello from teaching demo' to a file named demo-output.txt" -q 2>&1 | tee /tmp/demo-execution.log

# Extract execution ID
if grep -q "execution_id" /tmp/demo-execution.log; then
    EXEC_ID=$(grep "execution_id" /tmp/demo-execution.log | head -1 | grep -oP 'exec_\w+')
    echo ""
    echo -e "${GREEN}✓ Execution completed: $EXEC_ID${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠ Could not extract execution ID from output${NC}"
    echo "Continuing with demonstration using hypothetical ID..."
    EXEC_ID="exec_demo_12345"
fi

# Verify file was created
if [ -f "demo-output.txt" ]; then
    echo "✓ File created: demo-output.txt"
    echo "  Content: $(cat demo-output.txt)"
    rm -f demo-output.txt
fi

echo ""
wait_for_user

# Step 3: Extract template from execution
echo -e "${BLUE}Step 3: Extract Template from Successful Execution (Ribosome)${NC}"
echo "Using execution: $EXEC_ID"
echo ""
echo "Command: minibob doctor tutor --from-execution $EXEC_ID \\"
echo "           --name \"Write Demo Message to File\" \\"
echo "           --tags \"file-operations,demo\""
echo ""

# Note: This will only work if the execution exists in the database
# For demo purposes, we'll show the command structure
echo "Note: Template extraction requires the execution to be stored in the database."
echo "In a real scenario, the ribosome would:"
echo "  1. Retrieve execution trace from database"
echo "  2. Extract tool calls and sequences"
echo "  3. Generate task structure"
echo "  4. Create validation rules"
echo "  5. Submit template to registry"
echo ""

# Instead, let's create a simple template manually for demonstration
cat > /tmp/demo-template.json <<'EOF'
{
  "id": "activity:write-demo-message",
  "name": "Write Demo Message to File",
  "description": "Writes a demo message to a specified file",
  "category": "tool",
  "tasks": [
    {
      "id": "write-message",
      "description": "Write the demo message to file",
      "prompt": {
        "template": "Write the text '{{message}}' to a file named {{filename}}. Use the write tool.",
        "variables": ["message", "filename"]
      },
      "validation": {
        "requiredFiles": ["{{filename}}"]
      },
      "retry": {
        "maxAttempts": 2,
        "strategy": "simple"
      }
    }
  ],
  "variables": [
    {
      "name": "message",
      "type": "string",
      "required": true,
      "description": "The message to write"
    },
    {
      "name": "filename",
      "type": "string",
      "required": true,
      "description": "The filename to write to"
    }
  ]
}
EOF

echo "Created demonstration template: /tmp/demo-template.json"
echo ""
wait_for_user

# Step 4: Validate and submit template
echo -e "${BLUE}Step 4: Validate and Submit Template${NC}"
echo ""
echo "Validating template..."
bun run index.ts doctor check /tmp/demo-template.json --verbose

echo ""
echo "Submitting to registry..."
bun run index.ts doctor tutor /tmp/demo-template.json --scope org

echo ""
echo -e "${GREEN}✓ Template submitted to organization registry${NC}"
echo ""
wait_for_user

# Step 5: Check updated state
echo -e "${BLUE}Step 5: Verify Template in Registry${NC}"
echo ""
echo "Searching for the template..."
bun run index.ts doctor surface "demo" 2>&1 | head -30

echo ""
wait_for_user

# Step 6: Check Thompson Sampling state
echo -e "${BLUE}Step 6: Check Thompson Sampling State${NC}"
echo ""
echo "Running: minibob doctor health --deep --verbose"
echo ""
bun run index.ts doctor health --deep --verbose 2>&1 | grep -A 5 "Template Registry"

echo ""
wait_for_user

# Step 7: Demonstrate feedback mechanism
echo -e "${BLUE}Step 7: Feedback Mechanism Demonstration${NC}"
echo ""
echo "In the REPL, you would provide feedback like this:"
echo ""
echo -e "${GREEN}  > minibob${NC}"
echo -e "${GREEN}  minibob> write demo message to output.txt${NC}"
echo "  [activity executes]"
echo -e "${GREEN}  minibob> /cheer!! Excellent - exactly what was needed${NC}"
echo "  ✓ Cheered: activity:write-demo-message"
echo "    Updated metrics: α=2.5, β=0"
echo ""
echo "This would:"
echo "  1. Increase Thompson Sampling alpha (successes)"
echo "  2. Increase selection probability for future similar goals"
echo "  3. Log the feedback reason for learning"
echo "  4. Potentially boost adjacent activities in the composition"
echo ""
wait_for_user

# Step 8: Show feedback API
echo -e "${BLUE}Step 8: Programmatic Feedback (API)${NC}"
echo ""
echo "You can also provide feedback via the API:"
echo ""
echo "curl -X POST \"$BACKEND_URL/v2/activities/feedback\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: ApiKey \$METABOB_API_KEY\" \\"
echo "  -d '{"
echo "    \"activity_id\": \"$EXEC_ID\","
echo "    \"direction\": \"positive\","
echo "    \"intensity\": 2,"
echo "    \"reason\": \"Perfect execution for demo\""
echo "  }'"
echo ""
wait_for_user

# Step 9: Show variant creation
echo -e "${BLUE}Step 9: Variant Creation (Trailblazing)${NC}"
echo ""
echo "When a template fails, MiniBob can create variants:"
echo ""
echo "  1. Template fails execution"
echo "  2. User provides /chide feedback"
echo "  3. System creates variant with modifications:"
echo "     - Different prompt phrasing"
echo "     - Adjusted retry strategy"
echo "     - Modified validation rules"
echo "  4. Variant enters Thompson Sampling pool"
echo "  5. Future selections may choose variant"
echo ""
echo "Example:"
echo "  > /chide! Wrong approach - file permissions issue"
echo "  [System creates: activity:write-demo-message:v2]"
echo "  [v2 includes permission checking]"
echo ""
wait_for_user

# Step 10: Final state comparison
echo -e "${BLUE}Step 10: Final State Comparison${NC}"
echo ""
bun run index.ts doctor health --deep --json 2>&1 | grep -v '^\[' > /tmp/health-after.json
FINAL_TEMPLATES=$(jq -r '.checks[] | select(.name == "Template Registry") | .message' /tmp/health-after.json | grep -oP '\d+')

echo "Initial template count: $INITIAL_TEMPLATES"
echo "Final template count:   $FINAL_TEMPLATES"
echo "Templates added:        $((FINAL_TEMPLATES - INITIAL_TEMPLATES))"
echo ""

# Cleanup
rm -f /tmp/demo-template.json
rm -f /tmp/demo-execution.log
rm -f /tmp/health-before.json
rm -f /tmp/health-after.json
rm -f demo-output.txt

echo ""
echo "=========================================="
echo "  Demo Complete!"
echo "=========================================="
echo ""
echo "What you learned:"
echo "  ✓ How to improvise new tasks"
echo "  ✓ How to extract templates from executions (ribosome)"
echo "  ✓ How to validate and submit templates"
echo "  ✓ How to provide feedback (/cheer, /chide)"
echo "  ✓ How Thompson Sampling learns from feedback"
echo "  ✓ How variants are created when templates fail"
echo ""
echo "Next steps:"
echo "  1. Try the REPL: bun run index.ts"
echo "  2. Run a real task: minibob --single \"your task\""
echo "  3. Provide feedback: /cheer or /chide"
echo "  4. Extract your own templates: doctor tutor --from-execution <id>"
echo ""
echo "Resources:"
echo "  - Full guide: TEACHING_AND_FEEDBACK_GUIDE.md"
echo "  - Quick reference: QUICK_REFERENCE_TEACHING.md"
echo "  - Diagnostics: MINIBOB_DIAGNOSTIC_TOOLS_SUMMARY.md"
echo ""
