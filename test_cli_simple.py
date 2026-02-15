#!/usr/bin/env python3
"""Check if the MCP server process is keeping execution state"""

import os

# Read session state
state_file = os.path.expanduser("~/.metabob/state")
if os.path.exists(state_file):
    with open(state_file) as f:
        content = f.read()
        print("Session state exists")
        if "session_token" in content:
            print("  ✓ Has session_token")
else:
    print("✗ No session state file")

print("\nThe issue: MCP server is stateless - each call creates a new ActivityManager")
print("  - start_execution creates execution in manager._executions")
print("  - get_next_step is called by a DIFFERENT manager instance")
print("  - Second manager doesn't have the execution, so creates it from scratch")
print("  - _check_completion is never called because state isn't preserved")
print("\nThis is an architectural issue in the MCP server design!")
