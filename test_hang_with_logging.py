#!/usr/bin/env python3
"""
Test activity execution with enhanced logging to identify hang point.
"""

import sys
import json
import asyncio
from datetime import datetime

sys.path.insert(0, "repos/metabob-cli/src")

from metabob_cli.mcp.activity_manager import ActivityManager


async def test_3_task_with_timeout():
    """Execute 3-task template with 60s timeout."""

    # Load config and state
    with open(".metabob/config.json") as f:
        config = json.load(f)
    with open(".metabob/state") as f:
        state = json.load(f)

    manager = ActivityManager(
        base_url=config["base_url"],
        session_token=state["session_metadata"]["session_token"],
    )

    print("=" * 70)
    print("Activity Execution Test - 3 Tasks with Enhanced Logging")
    print("=" * 70)
    print()
    print("Template: feature-fdb6afae (Add REST Endpoint V2 - 3 tasks)")
    print("Timeout: 60 seconds")
    print()
    print("Watch for:")
    print("  🔵 = TaskTool about to call SessionPrompt.prompt()")
    print("  🟢 = TaskTool call returned successfully")
    print("  🔴 = Session busy, request queued (THIS IS THE BUG!)")
    print()
    print("Expected: First task completes, second task HANGS at 🔵")
    print()

    # Start execution
    print("[1] Starting execution...")
    exec_result = await manager.start_execution(
        activity_id="feature-fdb6afae",
        variables={
            "method": "GET",
            "path": "/api/test-endpoint",
            "description": "Test endpoint for debugging",
        },
        session_id=f"test_hang_{datetime.now().isoformat()}",
    )
    exec_id = (
        exec_result.get("execution_id")
        if isinstance(exec_result, dict)
        else exec_result
    )
    print(f"    ✅ Execution started: {exec_id}")
    print()

    # Poll with timeout
    print("[2] Monitoring execution (60s timeout)...")
    start = datetime.now()
    last_task = -1

    try:
        for i in range(30):  # 30 x 2s = 60s
            await asyncio.sleep(2)
            elapsed = (datetime.now() - start).total_seconds()

            status = await manager.get_execution_state(exec_id)
            current_task = status.get("current_task_index", 0)
            total_tasks = status.get("total_tasks", 3)
            state_status = status.get("status", "unknown")

            if current_task != last_task:
                print(
                    f"    [{elapsed:.0f}s] Task {current_task + 1}/{total_tasks} - {state_status}"
                )
                last_task = current_task

            if status.get("completed"):
                print()
                print("✅ EXECUTION COMPLETED")
                return True

        print()
        print("❌ TIMEOUT REACHED - Execution hung!")
        print()
        print("Expected behavior:")
        print("  - Task 1 should complete (~10-30s)")
        print("  - Task 2 starts but HANGS at 🔵 (TaskTool call)")
        print("  - Logs should show 🔴 if child session incorrectly marked busy")
        print()
        return False

    except KeyboardInterrupt:
        print()
        print("⚠️  Test interrupted by user")
        return False


if __name__ == "__main__":
    print()
    print("Starting test in 3 seconds...")
    print("(Check activity-debug.log in another terminal for detailed logs)")
    print()
    import time

    time.sleep(3)

    success = asyncio.run(test_3_task_with_timeout())
    sys.exit(0 if success else 1)
