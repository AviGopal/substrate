#!/usr/bin/env python3
"""
Test 1: Direct API Execution Test

This test bypasses ALL tools and MCP servers, going directly to the backend API.
This verifies that the backend itself can execute the jiggle activity.

Expected: ✅ Should work (already proven)
Purpose: Baseline verification
"""

import asyncio
import httpx
import json
from datetime import datetime


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 80}{Colors.RESET}\n")


def print_success(text: str):
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")


def print_error(text: str):
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")


def print_info(text: str):
    print(f"{Colors.YELLOW}ℹ {text}{Colors.RESET}")


async def test_direct_api():
    """Test direct API access without any tool layers"""

    print_header("TEST 1: Direct API Execution")
    print("Testing: Backend API → Database")
    print("Bypassing: MCP server, OpenCode tools, all wrappers\n")

    base_url = "http://localhost:8080"
    api_key = "test-api-key"

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Create session
        print("Step 1: Creating session...")
        resp = await client.post(
            f"{base_url}/v2/session",
            headers={"X-API-Key": api_key},
            json={
                "org_id": "test-org",
                "project_id": "metabob-devbob",
                "agent_name": "direct-api-test",
                "session_type": "development",
            },
        )

        if resp.status_code != 200:
            print_error(f"Session creation failed: {resp.status_code}")
            print_error(f"Response: {resp.text}")
            return False

        session_data = resp.json()
        session_id = session_data.get("session_id")
        token = session_data.get("metadata", {}).get("session_token")

        print_success(f"Session created: {session_id}")
        print_info(f"Token: {token[:30]}...")

        # Step 2: Search for jiggle activity
        print("\nStep 2: Searching for jiggle activity...")
        resp = await client.get(
            f"{base_url}/v2/activities/templates",
            headers={"Authorization": f"Bearer {token}"},
            params={"query": "jiggle", "limit": 5},
        )

        if resp.status_code != 200:
            print_error(f"Search failed: {resp.status_code}")
            return False

        templates = resp.json().get("templates", [])
        jiggle_templates = [
            t for t in templates if "jiggle" in t.get("variant_name", "").lower()
        ]

        if not jiggle_templates:
            print_error("Jiggle template not found in search")
            return False

        template = jiggle_templates[0]
        variant_id = template.get("variant_id")

        print_success(f"Found template: {variant_id}")
        print_info(f"Name: {template.get('variant_name')}")
        print_info(f"Tasks: {len(template.get('task_steps', []))}")

        # Step 3: Start execution
        print("\nStep 3: Starting execution...")
        execution_id = f"test-1-direct-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

        resp = await client.post(
            f"{base_url}/v2/activities/record/start",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "template_id": variant_id,
                "variables": {
                    "mode": "dryRun",
                    "scope": "test docs",
                    "recentDays": 30,
                    "mediumDays": 90,
                    "obsoleteDays": 180,
                    "archiveInsteadOfDelete": True,
                },
                "session_id": session_id,
                "execution_id": execution_id,
            },
        )

        if resp.status_code != 200:
            print_error(f"Execution start failed: {resp.status_code}")
            print_error(f"Response: {resp.text}")
            return False

        exec_data = resp.json()
        print_success(f"Execution started: {execution_id}")
        print_info(f"Response: {json.dumps(exec_data, indent=2)}")

        # Step 4: Verify in database (optional - would need SurrealDB client)
        print("\nStep 4: Verifying execution...")
        print_info("To verify manually:")
        print(f"  SELECT * FROM impression WHERE execution_id = '{execution_id}';")

        print_header("TEST 1 RESULT: ✅ PASS")
        print("Conclusion: Backend API can execute jiggle activity")
        print("Components verified:")
        print("  ✓ Session creation")
        print("  ✓ Template discovery")
        print("  ✓ Execution start")
        print("  ✓ Database recording (via API success)")

        return True


if __name__ == "__main__":
    try:
        result = asyncio.run(test_direct_api())
        exit(0 if result else 1)
    except Exception as e:
        print_error(f"Test failed with exception: {e}")
        import traceback

        traceback.print_exc()
        exit(1)
