#!/usr/bin/env python3
"""
Manual MCP Activity Execution Test

This script manually walks through each step of executing an activity via MCP:
1. Search for activities
2. Get activity details
3. Start activity execution
4. Get next step
5. Report step results
6. Complete execution

This simulates what metabob-opencode's activity tool does internally.
"""

import asyncio
import json
import sys
from datetime import datetime

import httpx

# Configuration
API_BASE_URL = "http://localhost:8080"
# The raw API key (not hashed) - backend will hash it for validation
API_KEY = "test-api-key"  # From test data setup (hashes to 4c806362...)


# ANSI Colors
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    MAGENTA = "\033[95m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 80}{Colors.RESET}\n")


def print_step(step_num: int, text: str):
    print(f"{Colors.BOLD}{Colors.CYAN}Step {step_num}: {text}{Colors.RESET}")


def print_success(text: str):
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")


def print_error(text: str):
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")


def print_info(text: str):
    print(f"{Colors.YELLOW}ℹ {text}{Colors.RESET}")


def print_data(label: str, data: dict):
    print(f"{Colors.MAGENTA}{label}:{Colors.RESET}")
    print(json.dumps(data, indent=2))


async def create_session() -> tuple[str, str]:
    """Step 0: Create authenticated session"""
    print_step(0, "Create Session (POST /v2/session)")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{API_BASE_URL}/v2/session",
            headers={
                "X-API-Key": API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "org_id": "test-org",
                "project_id": "metabob-devbob",
                "agent_name": "manual-test-agent",
                "session_type": "development",
            },
        )

        if response.status_code != 200:
            print_error(f"Failed to create session: {response.status_code}")
            print_error(f"Response: {response.text}")
            sys.exit(1)

        data = response.json()
        session_id = data.get("session_id")

        # Handle both proto format and simple format
        if "metadata" in data and "session_token" in data["metadata"]:
            session_token = data["metadata"]["session_token"]
        elif "session_token" in data:
            session_token = data["session_token"]
        else:
            print_error("No session_token in response")
            sys.exit(1)

        print_success(f"Session created: {session_id}")
        print_info(f"Token: {session_token[:30]}...")

        return session_id, session_token


async def search_activities(session_token: str) -> list:
    """Step 1: Search for activities"""
    print_step(1, "Search Activities (GET /v2/activities/templates)")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{API_BASE_URL}/v2/activities/templates",
            headers={"Authorization": f"Bearer {session_token}"},
            params={
                "query": "feature",
                "limit": 5,
            },
        )

        if response.status_code != 200:
            print_error(f"Failed to search activities: {response.status_code}")
            print_error(f"Response: {response.text}")
            sys.exit(1)

        data = response.json()
        templates = data.get("templates", [])

        print_success(f"Found {len(templates)} activities")

        if templates:
            print_info("Available activities:")
            for i, template in enumerate(templates[:5], 1):
                variant_id = template.get("variant_id", "N/A")
                variant_name = template.get("variant_name", "N/A")
                activity_id = template.get("activity_id", "N/A")
                print(f"  {i}. {variant_name} ({activity_id})")
                print(f"     ID: {variant_id}")

        return templates


async def get_activity_details(session_token: str, variant_id: str) -> dict:
    """Step 2: Get activity details"""
    print_step(2, f"Get Activity Details (GET /v2/activities/templates/{variant_id})")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{API_BASE_URL}/v2/activities/templates/{variant_id}",
            headers={"Authorization": f"Bearer {session_token}"},
        )

        if response.status_code != 200:
            print_error(f"Failed to get activity: {response.status_code}")
            print_error(f"Response: {response.text}")
            sys.exit(1)

        activity = response.json()

        print_success(f"Activity: {activity.get('variant_name')}")
        print_info(f"Category: {activity.get('activity_id')}")
        print_info(f"Tasks: {len(activity.get('task_steps', []))}")
        print_info(f"Variables: {list(activity.get('variables', {}).keys())}")

        # Show task steps
        task_steps = activity.get("task_steps", [])
        if task_steps:
            print_info("Task steps:")
            for step in task_steps[:3]:  # Show first 3
                print(
                    f"  - Step {step.get('order')}: {step.get('type')} (${step.get('cost_budget', 0):.2f})"
                )

        return activity


async def start_execution(
    session_token: str, session_id: str, variant_id: str, variables: dict
) -> tuple[str, str]:
    """Step 3: Start activity execution"""
    print_step(3, "Start Execution (POST /v2/activities/record/start)")

    execution_id = f"manual-test-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{API_BASE_URL}/v2/activities/record/start",
            headers={
                "Authorization": f"Bearer {session_token}",
                "Content-Type": "application/json",
            },
            json={
                "template_id": variant_id,
                "variables": variables,
                "session_id": session_id,
                "execution_id": execution_id,
            },
        )

        if response.status_code != 200:
            print_error(f"Failed to start execution: {response.status_code}")
            print_error(f"Response: {response.text}")
            sys.exit(1)

        data = response.json()
        impression_id = data.get("impression_id", "N/A")

        print_success(f"Execution started: {execution_id}")
        print_info(f"Impression ID: {impression_id}")

        return execution_id, impression_id


async def record_step(
    session_token: str, execution_id: str, step_order: int, success: bool = True
):
    """Step 4: Record step completion"""
    print_step(4, f"Record Step {step_order} (POST /v2/activities/record/step)")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{API_BASE_URL}/v2/activities/record/step",
            headers={
                "Authorization": f"Bearer {session_token}",
                "Content-Type": "application/json",
            },
            json={
                "execution_id": execution_id,
                "step_order": step_order,
                "success": success,
                "duration_ms": 2500.0,
                "cost": 0.05,
                "tokens": 1200,
                "output": f"Step {step_order} completed successfully"
                if success
                else f"Step {step_order} failed",
            },
        )

        if response.status_code != 200:
            print_error(f"Failed to record step: {response.status_code}")
            print_error(f"Response: {response.text}")
            sys.exit(1)

        print_success(f"Step {step_order} recorded")


async def complete_execution(
    session_token: str, execution_id: str, success: bool = True
):
    """Step 5: Complete execution"""
    print_step(5, "Complete Execution (POST /v2/activities/record/complete)")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{API_BASE_URL}/v2/activities/record/complete",
            headers={
                "Authorization": f"Bearer {session_token}",
                "Content-Type": "application/json",
            },
            json={
                "execution_id": execution_id,
                "success": success,
                "duration_ms": 8000.0,
                "cost": 0.15,
                "tokens": 3500,
                "step_results": [],
                "outcome": "success" if success else "failure",
                "notes": "Manual test execution completed",
            },
        )

        if response.status_code != 200:
            print_error(f"Failed to complete execution: {response.status_code}")
            print_error(f"Response: {response.text}")
            sys.exit(1)

        data = response.json()
        conversion_id = data.get("conversion_id", "N/A")

        print_success(f"Execution completed")
        print_info(f"Conversion ID: {conversion_id}")


async def main():
    """Main test flow"""
    print_header("Manual MCP Activity Execution Test")

    print(
        f"{Colors.BOLD}This test simulates what metabob-opencode does when executing an activity{Colors.RESET}"
    )
    print(f"We'll walk through each MCP communication step manually.\n")

    try:
        # Step 0: Create session
        session_id, session_token = await create_session()

        # Step 1: Search for activities
        templates = await search_activities(session_token)

        if not templates:
            print_error("No activities found")
            return

        # Use first template
        selected = templates[0]
        variant_id = selected.get("variant_id")

        # Step 2: Get activity details
        activity = await get_activity_details(session_token, variant_id)

        # Step 3: Start execution
        variables = {"feature_name": "test feature from manual script"}
        execution_id, impression_id = await start_execution(
            session_token, session_id, variant_id, variables
        )

        # Step 4: Record steps (simulate 3 steps)
        num_steps = min(3, len(activity.get("task_steps", [])))
        for step_num in range(1, num_steps + 1):
            await record_step(session_token, execution_id, step_num, success=True)
            await asyncio.sleep(0.5)  # Small delay between steps

        # Step 5: Complete execution
        await complete_execution(session_token, execution_id, success=True)

        print_header("Test Complete!")
        print_success("All MCP communications successful")
        print_info("You can verify in SurrealDB:")
        print(f"  SELECT * FROM impression WHERE execution_id = '{execution_id}';")
        print(f"  SELECT * FROM conversion WHERE execution_id = '{execution_id}';")

    except KeyboardInterrupt:
        print_error("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Test failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
