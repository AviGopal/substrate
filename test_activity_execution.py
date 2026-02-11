#!/usr/bin/env python3
"""
Test Activity Execution with Session Inspection

This script:
1. Creates an execution session
2. Records the template being used
3. Executes tasks via the activity manager
4. Captures tool usage and conversation flow
"""

import asyncio
import json
import httpx
from datetime import datetime

SESSION_TOKEN = "c2Vzc2lvbnM6ZXhwLXJlcG86ZXhwLXJlcG8tZGV2OjQxMmQ2ZjI2LTdmOWYtNDk2Ni05M2E4LTUwMDAyNzRmOTM4Mg=="
BASE_URL = "http://localhost:8080"
TEMPLATE_ID = "feature-7ac86b9b"


async def get_template(client: httpx.AsyncClient, template_id: str):
    """Fetch template details"""
    print(f"\n{'=' * 60}")
    print(f"Step 1: Fetching Template '{template_id}'")
    print(f"{'=' * 60}")

    response = await client.get(
        f"{BASE_URL}/v2/activities/templates/{template_id}",
        headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
    )

    if response.status_code == 200:
        template = response.json()
        print(f"✓ Template retrieved: {template.get('variant_name')}")
        print(f"  Description: {template.get('description')}")
        print(f"  Tasks: {len(template.get('task_steps', []))}")

        # Print task details
        for idx, task in enumerate(template.get("task_steps", []), 1):
            print(f"\n  Task {idx}: {task.get('id')}")
            print(f"    Description: {task.get('description')}")
            print(f"    Subagent: {task.get('subagent')}")
            print(f"    Dependencies: {task.get('dependencies', [])}")

        return template
    else:
        print(f"✗ Failed to fetch template: {response.status_code}")
        print(f"  Response: {response.text}")
        return None


async def start_execution(client: httpx.AsyncClient, template_id: str, variables: dict):
    """Start activity execution and get execution_id"""
    print(f"\n{'=' * 60}")
    print(f"Step 2: Starting Activity Execution")
    print(f"{'=' * 60}")

    request_data = {
        "template_id": template_id,
        "variables": variables,
        "context": {"reason": "Test v2 activity execution with tool inspection"},
    }

    print(f"Variables:")
    for key, value in variables.items():
        print(f"  {key}: {value}")

    response = await client.post(
        f"{BASE_URL}/v2/activities/executions",
        headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
        json=request_data,
    )

    if response.status_code in [200, 201]:
        execution = response.json()
        execution_id = execution.get("execution_id")
        print(f"\n✓ Execution started: {execution_id}")
        print(f"  Status: {execution.get('status')}")
        print(f"  Created: {execution.get('created_at')}")
        return execution_id
    else:
        print(f"\n✗ Failed to start execution: {response.status_code}")
        print(f"  Response: {response.text}")
        return None


async def get_execution_status(client: httpx.AsyncClient, execution_id: str):
    """Get current execution status"""
    response = await client.get(
        f"{BASE_URL}/v2/activities/executions/{execution_id}",
        headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
    )

    if response.status_code == 200:
        return response.json()
    return None


async def record_task_step(
    client: httpx.AsyncClient, execution_id: str, step_data: dict
):
    """Record a task step execution"""
    print(f"\n{'=' * 60}")
    print(f"Step 3: Recording Task Step")
    print(f"{'=' * 60}")
    print(f"Task: {step_data.get('step_id')}")

    response = await client.post(
        f"{BASE_URL}/v2/activities/executions/{execution_id}/steps",
        headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
        json=step_data,
    )

    if response.status_code in [200, 201]:
        print(f"✓ Step recorded successfully")
        return response.json()
    else:
        print(f"✗ Failed to record step: {response.status_code}")
        print(f"  Response: {response.text}")
        return None


async def complete_execution(
    client: httpx.AsyncClient, execution_id: str, result_data: dict
):
    """Complete the execution and record results"""
    print(f"\n{'=' * 60}")
    print(f"Step 4: Completing Execution")
    print(f"{'=' * 60}")

    response = await client.post(
        f"{BASE_URL}/v2/activities/executions/{execution_id}/complete",
        headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
        json=result_data,
    )

    if response.status_code in [200, 201]:
        result = response.json()
        print(f"✓ Execution completed")
        print(f"  Success: {result.get('success')}")
        print(f"  Duration: {result.get('duration_ms')}ms")
        return result
    else:
        print(f"✗ Failed to complete execution: {response.status_code}")
        print(f"  Response: {response.text}")
        return None


async def inspect_session_data(client: httpx.AsyncClient, execution_id: str):
    """Inspect session data and tool usage"""
    print(f"\n{'=' * 60}")
    print(f"Step 5: Inspecting Session Data")
    print(f"{'=' * 60}")

    # Get execution details
    execution = await get_execution_status(client, execution_id)

    if execution:
        print(f"\nExecution Details:")
        print(f"  ID: {execution.get('execution_id')}")
        print(f"  Template: {execution.get('template_id')}")
        print(f"  Status: {execution.get('status')}")
        print(f"  Variables: {json.dumps(execution.get('variables', {}), indent=4)}")

        # Print step results
        steps = execution.get("step_results", [])
        if steps:
            print(f"\n  Step Results:")
            for step in steps:
                print(f"    - {step.get('step_id')}: {step.get('status')}")
                if step.get("output"):
                    print(f"      Output: {step.get('output')[:100]}...")

    return execution


async def main():
    """Main test flow"""
    print("\n" + "=" * 60)
    print("V2 Activity Execution Test with Session Inspection")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Get template
        template = await get_template(client, TEMPLATE_ID)
        if not template:
            print("\n✗ Failed to fetch template. Exiting.")
            return

        # Step 2: Start execution
        variables = {"feature_name": "User Profile API"}

        execution_id = await start_execution(client, TEMPLATE_ID, variables)
        if not execution_id:
            print("\n✗ Failed to start execution. Exiting.")
            return

        # Step 3: Simulate task execution
        # In real scenario, this would be done by the activity executor
        # For now, we'll record some mock steps to demonstrate the flow

        print(f"\n{'=' * 60}")
        print(f"Step 3: Simulating Task Execution")
        print(f"{'=' * 60}")
        print("(In production, tasks would be executed by subagents)")
        print("(For this test, we're demonstrating the recording flow)")

        # Record first task
        step1_data = {
            "execution_id": execution_id,
            "step_id": "implement-feature",
            "status": "completed",
            "duration_ms": 5000,
            "tokens": 1500,
            "output": "Implemented User Profile API with GET /api/users/:id endpoint",
        }
        await record_task_step(client, execution_id, step1_data)

        # Record second task
        step2_data = {
            "execution_id": execution_id,
            "step_id": "test-feature",
            "status": "completed",
            "duration_ms": 3000,
            "tokens": 800,
            "output": "Created 5 test cases for User Profile API, all passing",
        }
        await record_task_step(client, execution_id, step2_data)

        # Step 4: Complete execution
        result_data = {
            "execution_id": execution_id,
            "success": True,
            "duration_ms": 8000,
            "cost": 0.05,
            "tokens": 2300,
            "outcome": "Successfully implemented and tested User Profile API",
            "step_results": [step1_data, step2_data],
        }
        await complete_execution(client, execution_id, result_data)

        # Step 5: Inspect final session data
        final_data = await inspect_session_data(client, execution_id)

        print(f"\n{'=' * 60}")
        print(f"Summary: Activity Execution Complete")
        print(f"{'=' * 60}")
        print(f"✓ Template used: {template.get('variant_name')}")
        print(f"✓ Tasks executed: 2")
        print(f"✓ Total tokens: 2300")
        print(f"✓ Total duration: 8000ms")
        print(f"✓ Status: Success")

        # Save detailed results
        results = {
            "timestamp": datetime.now().isoformat(),
            "execution_id": execution_id,
            "template": {
                "id": template.get("variant_id"),
                "name": template.get("variant_name"),
                "description": template.get("description"),
            },
            "variables": variables,
            "steps": [step1_data, step2_data],
            "result": result_data,
            "final_state": final_data,
        }

        with open(
            "/home/avi/documents/work/exp-repo/metabob-devbob/activity_execution_results.json",
            "w",
        ) as f:
            json.dump(results, f, indent=2)

        print(f"\n✓ Detailed results saved to: activity_execution_results.json")


if __name__ == "__main__":
    asyncio.run(main())
