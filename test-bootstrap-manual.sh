#!/bin/bash
# Quick manual test of bootstrap template
# Usage: ./test-bootstrap-manual.sh

TEMPLATE_ID="create-activity-template-(ultra-minimal)-6b9f02c6"

echo "========================================="
echo "Testing Bootstrap Template"
echo "========================================="
echo ""
echo "Template: $TEMPLATE_ID"
echo ""
echo "Test Case: Create 'Add Logging Statements' template"
echo ""

# Create test prompt file
cat > /tmp/bootstrap-test-prompt.txt <<'EOF'
Use the create-activity-template-(ultra-minimal)-6b9f02c6 template with these parameters:

templateName: Add Logging Statements
templateDescription: Add comprehensive logging to functions for debugging and monitoring
category: tool
templateId: add-logging-statements

The generated template should have 3-4 tasks that:
1. Analyze target code to identify key logging points (function entry/exit, decision points, errors)
2. Add logging statements with appropriate log levels (DEBUG, INFO, WARNING, ERROR)
3. Test that logging works without breaking functionality
4. (Optional) Commit the changes

Variables needed:
- targetFile: Path to file to add logging to (required)
- functionName: Specific function to instrument (optional, default: all functions)
- logLevel: Minimum log level (optional, default: INFO)
EOF

echo "Prompt saved to: /tmp/bootstrap-test-prompt.txt"
echo ""
echo "To test, run:"
echo ""
echo "  docker exec -it devbob-clean bash"
echo "  opencode run < /tmp/bootstrap-test-prompt.txt"
echo ""
echo "Or execute automatically with:"
echo ""
echo "  docker exec -i devbob-clean sh -c 'cd /workspace && opencode run' < /tmp/bootstrap-test-prompt.txt"
echo ""
echo "Expected outcome:"
echo "  ✅ /tmp/add-logging-statements.json created"
echo "  ✅ Template registered with backend"
echo "  ✅ /tmp/add-logging-statements-SUCCESS.txt created"
echo "  ✅ Duration: < 2 minutes"
echo "  ✅ Cost: < $0.30"
echo ""
echo "To verify success:"
echo ""
echo "  docker exec devbob-clean ls -la /tmp/add-logging-statements*"
echo "  docker exec devbob-clean cat /tmp/add-logging-statements-SUCCESS.txt"
echo "  docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates | grep add-logging-statements"
echo ""
