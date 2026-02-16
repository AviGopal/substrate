#!/usr/bin/env python3
"""
Test to isolate TaskTool hang issue.
Creates a minimal activity with 1 task that delegates to subagent.
"""

import asyncio
import sys
import json
from datetime import datetime, timedelta

# Add metabob-cli to path
sys.path.insert(0, "repos/metabob-cli/src")

from metabob_cli.core.config_manager import ConfigManager
from metabob_cli.core.file_state import FileStateManager
from metabob_cli.mcp.activity_manager import ActivityManager


async def test_single_task_delegation():
    """Test TaskTool with minimal 1-task template."""

    # 1. Load config and session
    config_mgr = ConfigManager()
    config = await config_mgr.get_config()
    base_url = config.get("base_url", "http://localhost:8080")

    # Force reload fresh token
    state_mgr = FileStateManager()
    await state_mgr.reload_state(force=True)
    state = await state_mgr.load_state()
    session_token = state.get("session_metadata", {}).get("session_token")

    if not session_token:
        print("❌ No session token found. Run: python3 scripts/create_session_state.py")
        return False

    print(f"✅ Loaded session token: {session_token[:20]}...")

    # 2. Get activity manager
    manager = ActivityManager(base_url=base_url, session_token=session_token)

    # 3. Search for demo template (known to have 2 tasks - works!)
    print("\n🔍 Searching for demo template...")
    activities = await manager.search_activities(query="demo")

    if not activities:
        print("❌ No demo template found")
        return False

    demo_template = activities[0]
    print(
        f"✅ Found: {demo_template['name']} ({demo_template['category']}-{demo_template['id'][:8]})"
    )
    print(f"   Tasks: {demo_template.get('task_count', 0)}")

    # 4. Start execution with TIMEOUT
    print(f"\n⏱️  Starting execution with 30-second timeout...")
    start_time = datetime.now()

    exec_id = await manager.start_execution(
        activity_id=f"{demo_template['category']}-{demo_template['id']}",
        variables={"test_message": "Hello from isolation test"},
        session_id="test_isolation_" + datetime.now().isoformat(),
    )

    print(f"✅ Execution started: {exec_id}")

    # 5. Poll for completion with timeout
    timeout_seconds = 30
    poll_interval = 2
    elapsed = 0

    while elapsed < timeout_seconds:
        await asyncio.sleep(poll_interval)
        elapsed = (datetime.now() - start_time).total_seconds()

        # Check status
        status = await manager.get_execution_status(exec_id)
        print(f"   [{elapsed:.0f}s] Status: {status.get('status', 'unknown')}")

        if status.get("completed"):
            duration = status.get("duration", 0)
            task_count = len(status.get("tasks", []))
            print(f"\n✅ COMPLETED in {duration / 1000:.1f}s")
            print(f"   Tasks executed: {task_count}")
            return True

    # Timeout reached
    print(f"\n❌ TIMEOUT after {timeout_seconds}s")
    print(f"   Execution hung - confirms TaskTool delegation issue")
    return False


if __name__ == "__main__":
    print("=" * 60)
    print("TaskTool Isolation Test")
    print("=" * 60)

    success = asyncio.run(test_single_task_delegation())
    sys.exit(0 if success else 1)
