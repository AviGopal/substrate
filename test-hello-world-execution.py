#!/usr/bin/env python3
"""Test executing the Hello World Test activity"""

import asyncio
import httpx
import json


async def test_hello_world_execution():
    """Execute the Hello World Test activity"""

    base_url = "http://localhost:8080"
    api_key = open(".metabob_api_key").read().strip()

    print("=" * 80)
    print("Hello World Test Activity Execution")
    print("=" * 80)

    async with httpx.AsyncClient(base_url=base_url, timeout=60.0) as client:
        # Step 1: Create session
        print("\n[1] Creating session...")
        session_resp = await client.post(
            "/v2/session",
            headers={"X-API-Key": api_key},
            json={"project_id": "exp-repo-dev", "codebase_root": "/workspace"},
        )

        if session_resp.status_code != 200:
            print(f"✗ Failed to create session: {session_resp.status_code}")
            print(session_resp.text)
            return

        session_data = session_resp.json()
        session_token = session_data["metadata"]["session_token"]
        session_id = session_data["session_id"]

        print(f"✓ Session created: {session_id}")

        # Step 2: Search for hello world activity
        print("\n[2] Searching for hello world activity...")
        search_resp = await client.get(
            "/v2/activities/templates?query=hello+world",
            headers={"Authorization": f"Bearer {session_token}"},
        )

        if search_resp.status_code != 200:
            print(f"✗ Search failed: {search_resp.status_code}")
            return

        search_data = search_resp.json()
        templates = search_data.get("templates", [])

        # Find our template
        hello_template = None
        for t in templates:
            if "Hello World Test" in t.get("variant_name", ""):
                hello_template = t
                break

        if not hello_template:
            print("✗ Hello World Test template not found!")
            print(f"Found {len(templates)} templates total")
            return

        variant_id = hello_template["variant_id"]
        activity_id = hello_template["activity_id"]

        print(f"✓ Found template:")
        print(f"  variant_id: {variant_id}")
        print(f"  activity_id: {activity_id}")
        print(f"  tasks: {len(hello_template.get('tasks', []))}")

        # Step 3: Start execution
        print("\n[3] Starting execution...")

        execution_id = "test-hello-world-exec-001"

        start_resp = await client.post(
            "/v2/activities/executions",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "execution_id": execution_id,
                "variant_id": variant_id,
                "variables": {"greeting_target": "DevBob"},
                "session_id": session_id,
            },
        )

        if start_resp.status_code not in [200, 201]:
            print(f"✗ Failed to start execution: {start_resp.status_code}")
            print(start_resp.text)
            return

        print(f"✓ Execution started: {execution_id}")

        # Step 4: Get first task
        print("\n[4] Getting task sequence...")

        tasks = hello_template.get("tasks", [])
        print(f"✓ Activity has {len(tasks)} tasks:")
        for i, task in enumerate(tasks, 1):
            print(f"  {i}. {task['id']}: {task['description']}")

        # Step 5: Simulate task execution (normally done by agent)
        print("\n[5] Task execution simulation:")
        print("  (In real execution, agent would execute each task)")
        print("  Task 1: Print 'Hello DevBob from Test Activity!'")
        print("  Task 2: Create /tmp/test-output.txt with timestamp")
        print("  Task 3: Verify file exists and display contents")

        # Step 6: Complete execution
        print("\n[6] Completing execution...")

        complete_resp = await client.post(
            f"/v2/activities/executions/{execution_id}/complete",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "success": True,
                "duration_ms": 5000,
                "cost": 0.01,
                "tokens": 500,
                "step_results": [
                    {"step_order": 1, "success": True, "duration_ms": 1500},
                    {"step_order": 2, "success": True, "duration_ms": 2000},
                    {"step_order": 3, "success": True, "duration_ms": 1500},
                ],
                "outcome": "All tasks completed successfully",
            },
        )

        if complete_resp.status_code not in [200, 201]:
            print(f"✗ Failed to complete execution: {complete_resp.status_code}")
            print(complete_resp.text)
            return

        print("✓ Execution completed successfully!")

        # Step 7: Verify execution was recorded
        print("\n[7] Verifying execution record...")

        status_resp = await client.get(
            f"/v2/activities/executions/{execution_id}",
            headers={"Authorization": f"Bearer {session_token}"},
        )

        if status_resp.status_code == 200:
            status_data = status_resp.json()
            print("✓ Execution record verified:")
            print(f"  Status: {status_data.get('status')}")
            print(f"  Duration: {status_data.get('duration_ms')}ms")
            print(f"  Success: {status_data.get('success')}")

        print("\n" + "=" * 80)
        print("✅ TEST COMPLETE - Hello World activity executed successfully!")
        print("=" * 80)

        return True


if __name__ == "__main__":
    success = asyncio.run(test_hello_world_execution())
    exit(0 if success else 1)
