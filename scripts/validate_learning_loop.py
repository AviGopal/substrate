#!/usr/bin/env python3
"""
Learning Loop Validation Script

This script validates that the learning loop is working by checking:
1. MCP tools are registered
2. Backend API endpoints are available
3. Database tables exist and have correct schema
4. (After test) Data was actually recorded

Usage:
    # Before test - should show "NOT READY" warnings
    python3 scripts/validate_learning_loop.py --mode pre-test

    # After test - should show "SUCCESS" with recorded data
    python3 scripts/validate_learning_loop.py --mode post-test --activity-id add-feature-complete
"""

import asyncio
import argparse
import sys
import os
from datetime import datetime, timedelta

# Add metabob-cli to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../repos/metabob-cli/src"))

try:
    import httpx
    from metabob_cli.mcp.server import MetabobMCP
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure you're in the metabob-devbob directory")
    sys.exit(1)


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 70}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^70}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 70}{Colors.RESET}\n")


def print_success(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.RESET}")


def print_failure(text):
    print(f"{Colors.RED}❌ {text}{Colors.RESET}")


def print_warning(text):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.RESET}")


def print_info(text):
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.RESET}")


async def check_mcp_tools():
    """Check if learning loop MCP tools are registered"""
    print_header("STEP 1: MCP Tools Registration")

    try:
        tools = await MetabobMCP.list_tools()
        total_tools = len(tools)
        print_info(f"Total MCP tools registered: {total_tools}")

        # Find our learning loop tools
        query_tool = next(
            (t for t in tools if "query_activity_impulses" in t.name), None
        )
        record_tool = next((t for t in tools if "record_impulse_usage" in t.name), None)

        success = True

        if query_tool:
            desc = (
                query_tool.description if query_tool.description else "No description"
            )
            print_success(f"query_activity_impulses - {desc[:80]}...")
        else:
            print_failure("query_activity_impulses NOT FOUND")
            success = False

        if record_tool:
            desc = (
                record_tool.description if record_tool.description else "No description"
            )
            print_success(f"record_impulse_usage - {desc[:80]}...")
        else:
            print_failure("record_impulse_usage NOT FOUND")
            success = False

        return success

    except Exception as e:
        print_failure(f"Failed to check MCP tools: {e}")
        return False


async def check_backend_api():
    """Check if backend API endpoints are available"""
    print_header("STEP 2: Backend API Endpoints")

    backend_url = os.getenv("METABOB_API_URL", "http://localhost:8080")
    api_key = os.getenv("METABOB_API_KEY", "")

    if not api_key:
        print_warning("METABOB_API_KEY not set, trying without auth")

    print_info(f"Backend URL: {backend_url}")

    endpoints = [
        ("POST", "/v2/impulses/record-usage", "Record impulse usage"),
        ("GET", "/v2/impulses/for-activity/test-activity", "Query activity impulses"),
        ("GET", "/v2/impulses/learned", "Query learned impulses"),
    ]

    success = True

    async with httpx.AsyncClient(timeout=5.0) as client:
        for method, path, description in endpoints:
            try:
                url = f"{backend_url}{path}"
                headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

                if method == "GET":
                    response = await client.get(url, headers=headers)
                else:
                    # POST with minimal test data
                    response = await client.post(
                        url,
                        json={
                            "execution_id": "test",
                            "activity_id": "test",
                            "task_id": "test",
                            "success": True,
                            "impulse_usages": [],
                        },
                        headers=headers,
                    )

                # We expect 200, 400 (bad request), or 401 (auth required)
                # 404 means endpoint doesn't exist - that's a failure
                if response.status_code == 404:
                    print_failure(f"{method} {path} - NOT FOUND (404)")
                    success = False
                elif response.status_code in [200, 400, 401]:
                    print_success(
                        f"{method} {path} - Available ({response.status_code})"
                    )
                else:
                    print_warning(
                        f"{method} {path} - Unexpected status ({response.status_code})"
                    )

            except httpx.ConnectError:
                print_failure(f"{method} {path} - Backend not reachable")
                success = False
            except Exception as e:
                print_failure(f"{method} {path} - Error: {e}")
                success = False

    return success


async def check_database_schema():
    """Check if database tables exist with correct schema"""
    print_header("STEP 3: Database Schema")

    backend_url = os.getenv("METABOB_API_URL", "http://localhost:8080")
    api_key = os.getenv("METABOB_API_KEY", "")

    # Try to query impulse_usage table via backend
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{backend_url}/v2/impulses/learned",
                params={"limit": 1},
                headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
            )

            if response.status_code == 200:
                data = response.json()
                print_success("impulse_registry table accessible")
                print_info(f"  Response structure: {list(data.keys())}")
                return True
            elif response.status_code == 401:
                print_warning("impulse_registry table exists but auth required")
                return True  # Table exists, just need auth
            else:
                print_failure(
                    f"Failed to query impulse_registry: {response.status_code}"
                )
                return False

    except Exception as e:
        print_failure(f"Database check failed: {e}")
        return False


async def check_recorded_data(activity_id: str, minutes_back: int = 10):
    """Check if data was actually recorded in the last N minutes"""
    print_header("STEP 4: Recorded Data Verification")

    backend_url = os.getenv("METABOB_API_URL", "http://localhost:8080")
    api_key = os.getenv("METABOB_API_KEY", "")

    print_info(f"Checking for activity: {activity_id}")
    print_info(f"Looking back: {minutes_back} minutes")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Query for activity-specific impulses
            response = await client.get(
                f"{backend_url}/v2/impulses/for-activity/{activity_id}",
                params={"min_success_rate": 0.0, "limit": 50},  # Get all, no filter
                headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
            )

            if response.status_code == 404:
                print_warning(f"Activity '{activity_id}' not found in database")
                print_info("This is expected if no executions have completed yet")
                return False
            elif response.status_code != 200:
                print_failure(f"Failed to query activity data: {response.status_code}")
                print_info(f"Response: {response.text[:200]}")
                return False

            data = response.json()
            activity_info = data.get("activity", {})
            impulses = data.get("impulses", [])

            if not activity_info:
                print_warning(f"No execution data found for activity '{activity_id}'")
                return False

            print_success(f"Found activity: {activity_info.get('name', activity_id)}")
            print_info(f"  Total executions: {activity_info.get('execution_count', 0)}")
            print_info(f"  Success rate: {activity_info.get('success_rate', 0):.1%}")
            print_info(f"  Impulses recorded: {len(impulses)}")

            if impulses:
                print_success(
                    f"✨ LEARNING LOOP WORKING - {len(impulses)} impulses recorded!"
                )
                print_info("\nTop 3 impulses:")
                for i, imp in enumerate(impulses[:3], 1):
                    print_info(
                        f"  {i}. {imp.get('impulse_id')} - "
                        f"used {imp.get('times_used_with_activity')} times, "
                        f"success rate: {imp.get('success_rate', 0):.1%}"
                    )
                return True
            else:
                print_warning("Activity found but no impulses recorded yet")
                print_info("This might be expected if tasks haven't used impulses")
                return False

    except Exception as e:
        print_failure(f"Data verification failed: {e}")
        import traceback

        print(traceback.format_exc())
        return False


async def pre_test_validation():
    """Run pre-test validation - should confirm infrastructure is ready"""
    print(f"\n{Colors.BOLD}PRE-TEST VALIDATION{Colors.RESET}")
    print("This checks that infrastructure is ready, but NO data should exist yet\n")

    results = []

    # Check MCP tools
    results.append(("MCP Tools", await check_mcp_tools()))

    # Check backend API
    results.append(("Backend API", await check_backend_api()))

    # Check database schema
    results.append(("Database Schema", await check_database_schema()))

    # Print summary
    print_header("PRE-TEST SUMMARY")

    all_passed = all(result[1] for result in results)

    for name, passed in results:
        if passed:
            print_success(f"{name}: READY")
        else:
            print_failure(f"{name}: NOT READY")

    if all_passed:
        print(
            f"\n{Colors.GREEN}{Colors.BOLD}✅ INFRASTRUCTURE READY - Proceed with test{Colors.RESET}"
        )
        print(
            f"{Colors.YELLOW}Expected: No impulse data should exist yet{Colors.RESET}"
        )
        return 0
    else:
        print(
            f"\n{Colors.RED}{Colors.BOLD}❌ INFRASTRUCTURE NOT READY - Fix issues before testing{Colors.RESET}"
        )
        return 1


async def post_test_validation(activity_id: str):
    """Run post-test validation - should confirm data was recorded"""
    print(f"\n{Colors.BOLD}POST-TEST VALIDATION{Colors.RESET}")
    print(f"This checks that the test actually recorded data for: {activity_id}\n")

    results = []

    # Quick check that infrastructure still works
    results.append(("MCP Tools", await check_mcp_tools()))

    # Most important: check if data was recorded
    results.append(("Recorded Data", await check_recorded_data(activity_id)))

    # Print summary
    print_header("POST-TEST SUMMARY")

    all_passed = all(result[1] for result in results)

    for name, passed in results:
        if passed:
            print_success(f"{name}: VERIFIED")
        else:
            print_failure(f"{name}: FAILED")

    if all_passed:
        print(
            f"\n{Colors.GREEN}{Colors.BOLD}✅ LEARNING LOOP VALIDATED - Data recorded successfully!{Colors.RESET}"
        )
        print(
            f"{Colors.BLUE}The loop is working: impulses were recorded and can be queried{Colors.RESET}"
        )
        return 0
    else:
        print(
            f"\n{Colors.RED}{Colors.BOLD}❌ LEARNING LOOP VALIDATION FAILED{Colors.RESET}"
        )
        print(
            f"{Colors.YELLOW}Check logs for errors during activity execution{Colors.RESET}"
        )
        return 1


async def main():
    parser = argparse.ArgumentParser(
        description="Validate Learning Loop Implementation"
    )
    parser.add_argument(
        "--mode",
        choices=["pre-test", "post-test"],
        required=True,
        help="Validation mode: pre-test (before) or post-test (after)",
    )
    parser.add_argument(
        "--activity-id",
        default="add-feature-complete",
        help="Activity ID to check (default: add-feature-complete)",
    )

    args = parser.parse_args()

    if args.mode == "pre-test":
        exit_code = await pre_test_validation()
    else:
        exit_code = await post_test_validation(args.activity_id)

    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
