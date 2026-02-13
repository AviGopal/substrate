#!/bin/bash

# Test script to trigger activity execution while observing MCP logs
# This will show us which tool is actually being called

echo "=== Starting Activity Execution Test with Debug Logging ==="
echo ""
echo "This test will:"
echo "1. Trigger an activity execution"  
echo "2. Show debug logs from both OpenCode and metabob-cli"
echo "3. Reveal which MCP tool is actually being called"
echo ""
echo "Look for lines starting with '!!!' in the output"
echo ""
echo "Press Ctrl+C to stop watching logs"
echo ""

# Note: This is just a marker script
# The actual test needs to be run from within the OpenCode session
# because we can't easily trigger the activity tool from outside

echo "To run the test:"
echo "1. Make sure OpenCode is running with the updated code"
echo "2. From OpenCode session, call:"
echo "   activity({"
echo "     activityId: 'infrastructure-51aee5c8',"
echo "     variables: {name: 'Test'},"
echo "     reason: 'Debug test'"
echo "   })"
echo ""
echo "3. Watch the OpenCode terminal for !!! debug lines"
echo ""
echo "Expected output if get_activity_template is called:"
echo "  !!! OPENCODE: Calling MCP tool \"get_activity_template\" ..."
echo "  !!! GET_ACTIVITY_TEMPLATE_TOOL CALLED !!! ..."
echo ""
echo "If create_activity_template is called instead:"
echo "  !!! OPENCODE: Calling MCP tool \"create_activity_template\" ..."
echo "  !!! CREATE_ACTIVITY_TEMPLATE_TOOL CALLED !!! ..."
