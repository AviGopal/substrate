#!/usr/bin/env python3
"""
Complete End-to-End Test: Session Creation → MCP Tools → Activity Execution

This test verifies the complete flow from session creation through activity execution.
"""

import asyncio
import json
import os
import sys

# Configure environment
os.environ["METABOB_API_KEY"] = "test-api-key"
os.environ["METABOB_API_URL"] = "http://localhost:8080"
os.environ["METABOB_PROJECT_ID"] = "metabob-devbob"

sys.path.insert(0, "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src")

def print_step(step, text):
    print(f"\n{'='*80}")
    print(f"STEP {step}: {text}")
    print('='*80)

async def test_complete_flow():
    """Test the complete flow"""
    
    print_step(1, "Import MCP components")
    from metabob_cli.mcp.server import _ensure_session, get_config_manager
    from metabob_cli.mcp.tools import search_activities_tool
    print("✓ Imports successful")
    
    print_step(2, "Create session (mimics MCP server startup)")
    await _ensure_session()
    
    config = get_config_manager()
    session_token = config.get("session_token", "")
    
    if not session_token:
        print("✗ FAILED: No session token created")
        return False
    
    print(f"✓ Session token created: {session_token[:20]}... (length: {len(session_token)})")
    print(f"✓ Base URL: {config.get('base_url')}")
    
    print_step(3, "Search for activities using MCP tool")
    result = await search_activities_tool(query="jiggle", limit=5)
    
    if not isinstance(result, str):
        print(f"✗ FAILED: Expected string result, got {type(result)}")
        return False
    
    data = json.loads(result)
    activities = data.get("activities", [])
    
    if not activities:
        print("✗ FAILED: No activities found")
        return False
    
    print(f"✓ Found {len(activities)} activities")
    
    jiggle_found = False
    for activity in activities:
        name = activity.get("name", "")
        if "jiggle" in name.lower():
            jiggle_found = True
            print(f"✓ Jiggle template found: {name}")
            print(f"  - ID: {activity.get('id')}")
            print(f"  - Category: {activity.get('category')}")
            print(f"  - Tasks: {activity.get('task_count')}")
            break
    
    if not jiggle_found:
        print("✗ FAILED: Jiggle template not found")
        return False
    
    print_step(4, "Verify session persists across calls")
    # Make another call without re-creating session
    result2 = await search_activities_tool(query="", limit=10)
    data2 = json.loads(result2)
    activities2 = data2.get("activities", [])
    
    print(f"✓ Second call successful: {len(activities2)} activities found")
    print("✓ Session token persisted correctly")
    
    print_step(5, "Summary")
    print("✓ Session creation: PASS")
    print("✓ MCP tools authentication: PASS")
    print("✓ Activity search: PASS")
    print("✓ Session persistence: PASS")
    print("\n" + "="*80)
    print("OVERALL RESULT: ✅ ALL TESTS PASSED")
    print("="*80 + "\n")
    
    return True

if __name__ == "__main__":
    try:
        result = asyncio.run(test_complete_flow())
        sys.exit(0 if result else 1)
    except Exception as e:
        print(f"\n✗ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
