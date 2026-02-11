#!/usr/bin/env python3
"""
Test search_activities via OpenCode's activity tool integration.

This tests the full path:
1. OpenCode reads .metabob/config.json and .metabob/state
2. OpenCode calls MCP search_activities tool
3. MCP tool reads session token from FileStateManager
4. ActivityManager queries backend with session token
5. Results returned
"""

import json
import subprocess
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
STATE_FILE = PROJECT_DIR / ".metabob" / "state"
CONFIG_FILE = PROJECT_DIR / ".metabob" / "config.json"


def check_prerequisites():
    """Check that config and state files exist."""
    print("=" * 60)
    print("Checking Prerequisites")
    print("=" * 60)

    if not CONFIG_FILE.exists():
        print(f"❌ Config file not found: {CONFIG_FILE}")
        return False

    if not STATE_FILE.exists():
        print(f"❌ State file not found: {STATE_FILE}")
        print("   Run: python3 scripts/create_session_state.py")
        return False

    # Read and validate config
    with open(CONFIG_FILE) as f:
        config = json.load(f)

    print(f"✅ Config file: {CONFIG_FILE}")
    print(f"   base_url: {config.get('base_url')}")
    print(f"   api_key: {config.get('api_key', '')[:20]}...")

    # Read and validate state
    with open(STATE_FILE) as f:
        state = json.load(f)

    print(f"✅ State file: {STATE_FILE}")
    print(f"   session_token: {state.get('session_token', '')[:30]}...")
    print(f"   project_id: {state.get('project_id')}")

    return True


def test_search_via_python_direct():
    """Test ActivityManager directly (Python path)."""
    print("\n" + "=" * 60)
    print("Test 1: Direct Python ActivityManager")
    print("=" * 60)

    try:
        sys.path.insert(0, str(PROJECT_DIR / "repos/metabob-cli/src"))
        from metabob_cli.mcp.activity_manager import ActivityManager

        # Read session token from state
        with open(STATE_FILE) as f:
            state = json.load(f)
        session_token = state.get("session_token", "")

        # Read base_url from config
        with open(CONFIG_FILE) as f:
            config = json.load(f)
        base_url = config.get("base_url", "http://localhost:8080")

        print(f"Creating ActivityManager...")
        print(f"  base_url: {base_url}")
        print(f"  session_token: {session_token[:30]}...")

        manager = ActivityManager(base_url=base_url, session_token=session_token)

        # Test search
        import asyncio

        async def search():
            results = await manager.search_activities(category="feature", limit=5)
            return results

        results = asyncio.run(search())

        print(f"✅ Found {len(results)} activities")
        for activity in results[:3]:
            task_count = len(activity.get("tasks", []))
            print(
                f"   - {activity.get('id')}: {activity.get('name', 'unnamed')} ({task_count} tasks)"
            )

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_search_via_mcp_tool():
    """Test search_activities via MCP tool (bypassing OpenCode)."""
    print("\n" + "=" * 60)
    print("Test 2: MCP Tool (metabob-cli direct)")
    print("=" * 60)

    print("⚠️  This test requires MCP server running")
    print("   Skip for now - would need to start MCP server process")
    return None


def test_search_via_opencode():
    """Test search via OpenCode activity tool (end-to-end)."""
    print("\n" + "=" * 60)
    print("Test 3: OpenCode search_activities Tool")
    print("=" * 60)

    print("⚠️  This test would require OpenCode running in activity mode")
    print("   Skip for now - this is what we're building toward")
    return None


def main():
    print("Testing search_activities Integration")
    print()

    # Check prerequisites
    if not check_prerequisites():
        print("\n❌ Prerequisites not met")
        sys.exit(1)

    # Run tests
    test1_pass = test_search_via_python_direct()
    test2_result = test_search_via_mcp_tool()
    test3_result = test_search_via_opencode()

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"Test 1 (Direct Python): {'✅ PASS' if test1_pass else '❌ FAIL'}")
    print(
        f"Test 2 (MCP Tool):      {'⚠️  SKIP' if test2_result is None else ('✅ PASS' if test2_result else '❌ FAIL')}"
    )
    print(
        f"Test 3 (OpenCode):      {'⚠️  SKIP' if test3_result is None else ('✅ PASS' if test3_result else '❌ FAIL')}"
    )

    if test1_pass:
        print("\n✨ Direct Python path works! Ready for OpenCode integration.")
        print("\nNext steps:")
        print("1. Test search_activities from OpenCode CLI")
        print("2. Verify OpenCode can find and execute activity-create template")
        print("3. Create hello-world template using activity-create")
    else:
        print("\n❌ Direct Python test failed - fix before proceeding")
        sys.exit(1)


if __name__ == "__main__":
    main()
