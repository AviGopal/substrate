#!/usr/bin/env python3
"""
Test V2 activity execution with proper session authentication.

Flow:
1. Create session with API key → get session_token
2. Use session_token for activity operations
"""

import asyncio
import httpx
import json


async def test_v2_execution_with_session():
    """Test V2 activity execution with session authentication"""

    base_url = "http://localhost:8080"
    api_key = "mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8"

    print("=" * 80)
    print("V2 Activity Execution Test - With Session Auth")
    print("=" * 80)

    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        # Step 1: Create session
        print("\n[1] Creating session with API key...")

        session_response = await client.post(
            "/v2/session",
            headers={"X-API-Key": api_key},
            json={"project_id": "exp-repo-dev", "codebase_root": "/workspace"},
        )

        print(f"    Status: {session_response.status_code}")

        if session_response.status_code != 200:
            print(f"    ✗ Failed to create session")
            print(f"    Response: {session_response.text}")
            return

        session_data = session_response.json()

        # session_token is in metadata
        metadata = session_data.get("metadata", {})
        session_token = metadata.get("session_token")
        session_id = session_data.get("session_id")

        print(f"    ✓ Session created!")
        print(f"    session_id: {session_id}")
        if session_token:
            print(f"    session_token: {session_token[:20]}...")
        else:
            print(f"    ⚠ No session_token in response!")

        # Step 2: Search for templates (using session token)
        print("\n[2] Searching for templates...")

        templates_response = await client.get(
            "/v2/activities/templates",
            headers={"Authorization": f"Bearer {session_token}"},
            params={"limit": 10},
        )

        print(f"    Status: {templates_response.status_code}")

        if templates_response.status_code == 200:
            templates_data = templates_response.json()
            templates = templates_data.get("templates", [])
            print(f"    ✓ Found {len(templates)} templates")

            if templates:
                for i, t in enumerate(templates[:3], 1):
                    print(
                        f"    {i}. {t.get('name')} (id: {t.get('variant_id', t.get('id'))})"
                    )
        else:
            print(f"    ✗ Failed: {templates_response.text}")
            return

        # Step 3: Get specific template
        template_id = "feature-780ea2ce"
        print(f"\n[3] Getting template {template_id}...")

        template_response = await client.get(
            f"/v2/activities/templates/{template_id}",
            headers={"Authorization": f"Bearer {session_token}"},
        )

        print(f"    Status: {template_response.status_code}")

        if template_response.status_code == 200:
            template = template_response.json()
            print(f"    ✓ Got template!")
            print(f"    name: {template.get('name')}")
            print(f"    variant_id: {template.get('variant_id')}")

            # Check if it has tasks
            tasks = template.get("tasks", [])
            task_steps = template.get("task_steps", [])

            if tasks:
                print(f"    tasks: {len(tasks)} task(s)")
                if tasks:
                    print(f"    first task: {tasks[0].get('description')}")
                    print(f"    subagent: {tasks[0].get('subagent')}")
            elif task_steps:
                print(f"    task_steps: {len(task_steps)} step(s)")
                if task_steps:
                    print(f"    first step: {task_steps[0].get('description')}")
                    print(f"    subagent: {task_steps[0].get('subagent')}")
        else:
            print(f"    ✗ Failed: {template_response.text}")
            return

        # Step 4: Start execution
        print(f"\n[4] Starting execution...")

        start_response = await client.post(
            "/v2/activities/record/start",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "template_id": template_id,
                "variables": {"name": "DevBob"},
                "session_id": session_id,
                "execution_id": "exec_test_manual_001",
            },
        )

        print(f"    Status: {start_response.status_code}")

        if start_response.status_code in [200, 201]:
            start_data = start_response.json()
            print(f"    ✓ Execution recorded!")
            print(f"    Response: {json.dumps(start_data, indent=2)}")
        else:
            print(f"    ✗ Failed: {start_response.text}")
            return

        print("\n" + "=" * 80)
        print("SUCCESS - V2 API Works with Session Auth!")
        print("=" * 80)

        # Now test with activity_manager using this session_token
        print("\n" + "=" * 80)
        print("Testing with ActivityManager...")
        print("=" * 80)

        import sys

        sys.path.insert(0, "./repos/metabob-cli/src")
        from metabob_cli.mcp.activity_manager import ActivityManager

        manager = ActivityManager(base_url=base_url, session_token=session_token)

        print("\n[5] Using ActivityManager.start_execution...")

        exec_result = await manager.start_execution(
            activity_id=template_id,
            session_id=session_id,
            variables={"name": "DevBob"},
            cost_budget=1.0,
        )

        print(f"    execution_id: {exec_result.get('execution_id')}")
        print(f"    status: {exec_result.get('status')}")
        print(f"    message: {exec_result.get('message')}")

        execution_id = exec_result.get("execution_id", "")
        if not execution_id:
            print(f"    ✗ No execution_id!")
            return

        print(f"\n[6] Using ActivityManager.get_next_step...")

        step_result = await manager.get_next_step(execution_id)

        if "error" in step_result:
            print(f"    ✗ Error: {step_result['error']}")
        elif step_result.get("complete"):
            print(f"    Already complete? {step_result}")
        else:
            print(f"    ✓ Got step!")
            print(
                f"    step_index: {step_result.get('step_index')}/{step_result.get('total_steps')}"
            )
            current_step = step_result.get("current_step", {})
            print(f"    description: {current_step.get('description')}")
            print(f"    step_id: {current_step.get('step_id')}")

        print("\n" + "=" * 80)
        print("COMPLETE SUCCESS - End-to-End V2 Flow Works!")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(test_v2_execution_with_session())
