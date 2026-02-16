#!/usr/bin/env python3
"""
Test Phase 1 (Tier 1) Task Result Integration

Validates that:
1. Backend endpoint accepts task results
2. CLI tool can send task results
3. Tasks array is populated in execution record
"""

import asyncio
import httpx
from pathlib import Path
from metabob_cli.core.file_state import FileStateManager


async def test_task_result_integration():
    print("=" * 80)
    print("Phase 1 (Tier 1): Task Result Integration Test")
    print("=" * 80)
    print()

    # 1. Load session token
    print("[1/4] Loading session token...")
    state_file = Path(".metabob/state")
    state_mgr = FileStateManager(state_file=state_file)
    await state_mgr.reload_state_async(force=True)
    token = state_mgr.get_session_token()

    if not token:
        print("❌ No session token found. Run authentication first.")
        return

    print(f"✓ Token loaded: {token[:50]}...")
    print()

    # 2. Create test execution
    print("[2/4] Creating test execution...")
    base_url = "http://localhost:8080"
    headers = {"Authorization": f"Bearer {token}"}

    execution_id = "test_exec_phase1_tier1"

    async with httpx.AsyncClient(
        base_url=base_url, headers=headers, timeout=10.0
    ) as client:
        # Start execution
        start_payload = {
            "execution_id": execution_id,
            "template_id": "test-activity",
            "session_id": state_mgr.session_id or "test-session",
            "variables": {"test": "value"},
        }

        response = await client.post("/v2/activities/record/start", json=start_payload)
        if response.status_code != 200:
            print(f"❌ Failed to start execution: {response.status_code}")
            print(response.text)
            return

        print(f"✓ Execution created: {execution_id}")
        print()

        # 3. Report task results
        print("[3/4] Reporting task results...")

        tasks_to_report = [
            {
                "execution_id": execution_id,
                "task_index": 0,
                "task_name": "Parse requirements",
                "status": "success",
                "duration_ms": 5500.0,
                "tokens": {"input": 1200, "output": 450, "cache": 0, "total": 1650},
                "cost": 0.00015,
                "error": None,
                "tool_calls": ["read", "grep"],
            },
            {
                "execution_id": execution_id,
                "task_index": 1,
                "task_name": "Implement feature",
                "status": "success",
                "duration_ms": 12300.0,
                "tokens": {"input": 2500, "output": 890, "cache": 0, "total": 3390},
                "cost": 0.00032,
                "error": None,
                "tool_calls": ["edit", "write", "bash"],
            },
            {
                "execution_id": execution_id,
                "task_index": 2,
                "task_name": "Run tests",
                "status": "failed",
                "duration_ms": 3200.0,
                "tokens": {"input": 800, "output": 200, "cache": 0, "total": 1000},
                "cost": 0.00008,
                "error": "Test suite failed: 2 tests failed in test_feature.py",
                "tool_calls": ["bash"],
            },
        ]

        for task in tasks_to_report:
            response = await client.post(
                f"/v2/activities/executions/{execution_id}/tasks", json=task
            )

            if response.status_code != 200:
                print(
                    f"❌ Failed to report task {task['task_index']}: {response.status_code}"
                )
                print(response.text)
                return

            result = response.json()
            status_emoji = "✓" if task["status"] == "success" else "❌"
            print(
                f"{status_emoji} Task {task['task_index']}: {task['task_name']} "
                f"({task['status']}, {task['duration_ms']}ms, ${task['cost']:.6f})"
            )

        print()

        # 4. Verify tasks array is populated
        print("[4/4] Verifying tasks array...")

        # Query execution record
        response = await client.get("/v2/activities/executions")

        if response.status_code != 200:
            print(f"❌ Failed to get executions: {response.status_code}")
            print(response.text)
            return

        executions = response.json().get("executions", [])
        test_execution = next(
            (e for e in executions if e.get("execution_id") == execution_id), None
        )

        if not test_execution:
            print(f"❌ Test execution not found: {execution_id}")
            return

        tasks = test_execution.get("tasks", [])
        print(f"✓ Found execution with {len(tasks)} tasks recorded")
        print()

        if len(tasks) != 3:
            print(f"⚠️  Expected 3 tasks, got {len(tasks)}")
            return

        # Display task details
        print("Task Details:")
        print("-" * 80)
        for task in tasks:
            status_emoji = "✓" if task["status"] == "success" else "❌"
            print(
                f"{status_emoji} [{task['task_index']}] {task['task_name']}: "
                f"{task['status']} ({task['duration_ms']}ms, ${task.get('cost', 0):.6f})"
            )
            if task.get("error"):
                print(f"   Error: {task['error']}")
            if task.get("tool_calls"):
                print(f"   Tools: {', '.join(task['tool_calls'])}")

        print("-" * 80)
        print()

        # Summary
        total_duration = sum(t["duration_ms"] for t in tasks)
        total_cost = sum(t.get("cost", 0) for t in tasks)
        total_tokens = sum(t.get("tokens", {}).get("total", 0) for t in tasks)
        success_count = sum(1 for t in tasks if t["status"] == "success")

        print("Summary:")
        print(
            f"  Tasks: {len(tasks)} total, {success_count} succeeded, {len(tasks) - success_count} failed"
        )
        print(f"  Duration: {total_duration}ms ({total_duration / 1000:.1f}s)")
        print(f"  Cost: ${total_cost:.6f}")
        print(f"  Tokens: {total_tokens}")
        print()

        print("=" * 80)
        print("✅ Phase 1 (Tier 1) Integration Test: PASSED")
        print("=" * 80)
        print()
        print(
            "Next Step: Modify OpenCode's prompts-runner.ts to call metabob_report_task_result()"
        )


if __name__ == "__main__":
    asyncio.run(test_task_result_integration())
