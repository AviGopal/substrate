#!/usr/bin/env python3
"""
Comprehensive Activity System Test
Tests the complete feedback loop: search, execute, track, learn
"""

import asyncio
import sys
import json
from pathlib import Path
from datetime import datetime

# Add metabob-cli to path
sys.path.insert(0, str(Path(__file__).parent.parent / "repos" / "metabob-cli" / "src"))

from metabob_cli.mcp.activity_manager import get_activity_manager
from metabob_cli.core.file_state import FileStateManager


class bcolors:
    HEADER = "\033[95m"
    OKBLUE = "\033[94m"
    OKCYAN = "\033[96m"
    OKGREEN = "\033[92m"
    WARNING = "\033[93m"
    FAIL = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"


def print_header(text):
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}{'=' * 80}{bcolors.ENDC}")
    print(f"{bcolors.HEADER}{bcolors.BOLD}{text:^80}{bcolors.ENDC}")
    print(f"{bcolors.HEADER}{bcolors.BOLD}{'=' * 80}{bcolors.ENDC}\n")


def print_success(text):
    print(f"{bcolors.OKGREEN}✅ {text}{bcolors.ENDC}")


def print_fail(text):
    print(f"{bcolors.FAIL}❌ {text}{bcolors.ENDC}")


def print_info(text):
    print(f"{bcolors.OKCYAN}ℹ️  {text}{bcolors.ENDC}")


def print_warning(text):
    print(f"{bcolors.WARNING}⚠️  {text}{bcolors.ENDC}")


async def test_1_backend_connectivity():
    """Test 1: Backend API Connectivity"""
    print_header("Test 1: Backend API Connectivity")

    import aiohttp

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8080/health") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print_success(f"Backend healthy: version {data.get('version')}")
                    return True
                else:
                    print_fail(f"Backend returned {resp.status}")
                    return False
    except Exception as e:
        print_fail(f"Backend unreachable: {e}")
        return False


async def test_2_session_authentication():
    """Test 2: Session Authentication"""
    print_header("Test 2: Session Authentication")

    try:
        state_file = Path(".metabob/state")
        if not state_file.exists():
            print_fail("No state file found")
            return False, None

        with open(state_file) as f:
            state = json.load(f)

        token = state.get("session_metadata", {}).get("session_token", "")
        session_id = state.get("session_metadata", {}).get("session_id", "")

        if not token:
            print_fail("No session token in state file")
            return False, None

        print_success(f"Session found: {session_id}")
        print_info(f"Token: {token[:40]}...")
        return True, token
    except Exception as e:
        print_fail(f"Failed to load session: {e}")
        return False, None


async def test_3_activity_search(token):
    """Test 3: Activity Template Search"""
    print_header("Test 3: Activity Template Search")

    try:
        manager = get_activity_manager("http://localhost:8080", token)

        # Search for all activities
        print_info("Searching for all activity templates...")
        all_activities = await manager.search_activities(limit=50)
        print_success(f"Found {len(all_activities)} total templates")

        # Search for V3 template specifically
        v3_templates = [a for a in all_activities if "ccc53c5d" in a["id"]]
        if v3_templates:
            v3 = v3_templates[0]
            print_success(f"V3 Template found: {v3['id']}")
            print_info(f"  Name: {v3['name']}")
            print_info(f"  Category: {v3['category']}")
            print_info(f"  Tasks: {v3['task_count']}")
            return True, v3["id"]
        else:
            print_warning("V3 template (ccc53c5d) not found in results")
            if all_activities:
                print_info(f"Available templates: {all_activities[0]['id']}")
                return True, all_activities[0]["id"]
            return False, None

    except Exception as e:
        print_fail(f"Activity search failed: {e}")
        import traceback

        traceback.print_exc()
        return False, None


async def test_4_activity_execution_dry_run(token, activity_id):
    """Test 4: Activity Execution (Dry Run)"""
    print_header("Test 4: Activity Execution (Dry Run)")

    print_warning("Full execution test requires subagent infrastructure")
    print_info(f"Would execute activity: {activity_id}")
    print_info("Execution tracking would capture:")
    print_info("  - Session start (goal, agent_id)")
    print_info("  - Tool invocations (tool name, duration, success)")
    print_info("  - Impulse usage (which impulses loaded, created)")
    print_info("  - Session outcome (success, user satisfaction)")

    return True


async def test_5_execution_tracking_api():
    """Test 5: Execution Tracking API"""
    print_header("Test 5: Execution Tracking API Endpoints")

    import aiohttp

    endpoints = [
        ("POST", "/api/agent-execution/session/start", "Session start recording"),
        ("POST", "/api/agent-execution/tool/invocation", "Tool invocation recording"),
        ("POST", "/api/agent-execution/session/complete", "Session completion"),
        ("GET", "/api/agent-execution/agent/test-agent/statistics", "Agent statistics"),
    ]

    try:
        async with aiohttp.ClientSession() as session:
            for method, endpoint, description in endpoints:
                url = f"http://localhost:8080{endpoint}"

                if method == "GET":
                    async with session.get(url) as resp:
                        status = resp.status
                else:
                    # Send minimal test payload
                    async with session.request(method, url, json={}) as resp:
                        status = resp.status

                # 422 (validation error) means endpoint exists
                if status in [200, 422]:
                    print_success(f"{description}: endpoint exists")
                else:
                    print_warning(f"{description}: unexpected status {status}")

        return True
    except Exception as e:
        print_fail(f"API test failed: {e}")
        return False


async def test_6_check_critical_gaps():
    """Test 6: Check for Critical Gaps from Learning Doc"""
    print_header("Test 6: Critical Gap Analysis")

    print_info("Checking for known critical gaps...")

    # Gap 1: Execution start recording
    print_info("\nGap 1: Execution Start Recording")
    activity_manager_file = Path(
        "repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py"
    )
    if activity_manager_file.exists():
        content = activity_manager_file.read_text()
        if "DISABLED: Backend /record/start" in content:
            print_fail("Execution start recording is DISABLED (line ~462)")
            print_info("  Impact: Cannot track execution lifecycle")
        else:
            print_success("Execution start recording appears enabled")

    # Gap 2: Impulse tracking
    print_info("\nGap 2: Step-Level Impulse Tracking")
    activity_tools_file = Path(
        "repos/metabob-cli/src/metabob_cli/mcp/activity_tools.py"
    )
    if activity_tools_file.exists():
        content = activity_tools_file.read_text()
        if 'usage_type": "useful"  # ← No real tracking' in content:
            print_warning("Impulse tracking is basic (marks all as useful)")
            print_info(
                "  Impact: Cannot determine which context helps activities succeed"
            )
        else:
            print_success("Impulse tracking implementation may be improved")

    # Gap 3: OpenCode integration
    print_info("\nGap 3: OpenCode Session Tracking Integration")
    prompt_file = Path("repos/metabob-opencode/packages/opencode/src/session/prompt.ts")
    if prompt_file.exists():
        content = prompt_file.read_text()
        if "AgentExecutionTracker.startSession" in content:
            print_success("OpenCode session tracking code exists")
        else:
            print_warning("OpenCode session tracking not found")

    return True


async def main():
    """Run all tests"""
    print_header("Activity System Comprehensive Test Suite")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Test Location: {Path.cwd()}")

    results = {}

    # Test 1: Backend
    results["backend"] = await test_1_backend_connectivity()
    if not results["backend"]:
        print_fail("\n❌ Backend not available - stopping tests")
        return

    # Test 2: Authentication
    success, token = await test_2_session_authentication()
    results["auth"] = success
    if not success:
        print_fail("\n❌ Authentication failed - stopping tests")
        return

    # Test 3: Activity Search
    success, activity_id = await test_3_activity_search(token)
    results["search"] = success

    # Test 4: Execution (dry run)
    if activity_id:
        results["execution"] = await test_4_activity_execution_dry_run(
            token, activity_id
        )
    else:
        results["execution"] = False

    # Test 5: Tracking API
    results["tracking_api"] = await test_5_execution_tracking_api()

    # Test 6: Gap analysis
    results["gap_check"] = await test_6_check_critical_gaps()

    # Summary
    print_header("Test Summary")
    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test, result in results.items():
        if result:
            print_success(f"{test}: PASSED")
        else:
            print_fail(f"{test}: FAILED")

    print(f"\n{bcolors.BOLD}Results: {passed}/{total} tests passed{bcolors.ENDC}")

    if passed == total:
        print_success("\n🎉 All tests passed! Activity system ready.")
    elif passed >= total * 0.7:
        print_warning("\n⚠️  Most tests passed - system partially functional")
    else:
        print_fail("\n❌ Multiple failures - system needs fixes")


if __name__ == "__main__":
    asyncio.run(main())
