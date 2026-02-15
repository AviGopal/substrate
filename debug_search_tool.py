#!/usr/bin/env python3
"""Debug search_activities_tool to find where results disappear"""

import asyncio
import json
import sys
from pathlib import Path

# Add repos to path
sys.path.insert(0, str(Path(__file__).parent / "repos/metabob-cli/src"))

from metabob_cli.mcp.activity_manager import ActivityManager
from metabob_cli.core.file_state import FileStateManager


async def debug_search():
    """Trace search_activities through all layers"""

    print("\n=== DEBUG: search_activities_tool ===\n")

    # Step 1: Load config and session token
    print("[1] Loading session token...")
    state_file = Path(".metabob/state")
    state_mgr = FileStateManager(state_file=state_file)
    await state_mgr.reload_state_async(force=True)
    session_token = state_mgr.get_session_token()
    print(
        f"    Token: {session_token[:20]}..." if session_token else "    Token: MISSING"
    )

    base_url = "http://localhost:8080"
    print(f"    Base URL: {base_url}")

    # Step 2: Create ActivityManager
    print("\n[2] Creating ActivityManager...")
    if not session_token:
        print("    ❌ ERROR: No session token found!")
        return []
    manager = ActivityManager(base_url, session_token)
    print("    Manager created")

    # Step 3: Call search_activities
    print("\n[3] Calling manager.search_activities()...")
    print("    Parameters:")
    print("      - query: '' (empty)")
    print("      - category: None")
    print("      - limit: 20")
    print("      - min_success_rate: 0.0")

    results = await manager.search_activities(
        query="",
        category=None,
        limit=20,
        min_success_rate=0.0,
    )

    print(f"\n[4] Results from manager.search_activities:")
    print(f"    Count: {len(results)}")

    if results:
        print("\n    Templates found:")
        for i, r in enumerate(results, 1):
            print(
                f"      {i}. {r.get('id')} - {r.get('name')} ({r.get('task_count')} tasks)"
            )
            print(f"         Category: {r.get('category')}")
            print(f"         Success rate: {r.get('success_rate')}")
    else:
        print("    ❌ EMPTY RESULTS")

    # Step 4: Format as tool output
    print("\n[5] Tool output format:")
    tool_output = {
        "status": "success",
        "count": len(results),
        "activities": results,
    }
    print(f"    Status: {tool_output['status']}")
    print(f"    Count: {tool_output['count']}")
    print(f"    Activities length: {len(tool_output['activities'])}")

    # Step 5: Check JSON serialization
    print("\n[6] JSON serialization test:")
    try:
        json_str = json.dumps(tool_output, indent=2)
        print(f"    ✅ Serialization successful ({len(json_str)} bytes)")

        # Parse back
        parsed = json.loads(json_str)
        print(f"    ✅ Deserialization successful")
        print(f"    Parsed count: {parsed['count']}")
        print(f"    Parsed activities length: {len(parsed['activities'])}")

    except Exception as e:
        print(f"    ❌ Serialization failed: {e}")

    print("\n=== END DEBUG ===\n")

    return results


if __name__ == "__main__":
    results = asyncio.run(debug_search())
    sys.exit(0 if results else 1)
