#!/usr/bin/env python3
"""
Test if we can call the activity tool from Python to simulate what OpenCode does
"""
import sys

# This simulates what would happen if OpenCode tried to use the activity tool
print("Testing activity tool invocation...")

# In OpenCode, you would use:
# activity({
#   activityId: "refactor-251a3ca8", 
#   variables: {mode: "dryRun"},
#   reason: "Test jiggle"
# })

# But we can't directly call that from here. 
# The question is: does THIS OpenCode session have access to the activity tool?

print("\nTo test if OpenCode can run it:")
print("1. This session should have the 'activity' tool available")
print("2. The tool should be able to discover 'refactor-251a3ca8'")
print("3. The tool should be able to execute it")

print("\nActivity details:")
print("  ID: refactor-251a3ca8")
print("  Name: Jiggle Documentation")
print("  Tasks: 4")
print("  Status: Registered and verified via v2 API")

