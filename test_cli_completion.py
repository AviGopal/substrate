#!/usr/bin/env python3
"""Test script to verify CLI completion logic"""

import asyncio
import sys

sys.path.insert(0, "repos/metabob-cli/src")

from metabob_cli.mcp.activity_manager import get_activity_manager
from metabob_cli.core.file_state import FileStateManager


async def test_completion():
    # Get session token
    state_mgr = FileStateManager()
    state_mgr.reload_state(force=True)
    session_token = state_mgr.get_session_token()

    if not session_token:
        print("ERROR: No session token found")
        return

    base_url = "http://localhost:8080"
    manager = get_activity_manager(base_url, session_token)

    # Check the last execution
    execution_id = "exec_d13697dfc6fd"

    if execution_id in manager._executions:
        execution = manager._executions[execution_id]
        print(f"✓ Execution found in manager")
        print(f"  current_step_index: {execution.current_step_index}")
        print(f"  state: {execution.state}")
        print(f"  impulses_used: {len(execution.impulses_used)} impulses")
    else:
        print(f"✗ Execution {execution_id} not in manager._executions")
        print(f"  Available executions: {list(manager._executions.keys())}")

        # Try to get the activity template to check task count
        try:
            template = await manager.get_activity("demo-315bfaf1")
            tasks = template.get("tasks", [])
            print(f"\n  Template has {len(tasks)} tasks:")
            for i, task in enumerate(tasks):
                print(f"    {i}: {task.get('id')} - {task.get('description', '')[:50]}")
        except Exception as e:
            print(f"  ERROR getting template: {e}")


if __name__ == "__main__":
    asyncio.run(test_completion())
