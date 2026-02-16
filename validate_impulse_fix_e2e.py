#!/usr/bin/env python3
"""
End-to-End Impulse Data Quality Validation

This script validates the impulse overwriting bug fix by:
1. Starting a new activity execution with impulses
2. Monitoring impulse data DURING execution (before cleanup)
3. Validating impulse preservation at completion

Validates fix in activity_manager.py lines 1505-1507
"""

import asyncio
import json
import sys
from metabob_cli.mcp.activity_manager import get_activity_manager
from metabob_cli.core.file_state import FileStateManager

# ANSI colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")


def error(msg):
    print(f"{RED}✗ {msg}{RESET}")


def info(msg):
    print(f"{BLUE}ℹ {msg}{RESET}")


def warning(msg):
    print(f"{YELLOW}⚠ {msg}{RESET}")


async def validate_impulse_fix():
    """Run end-to-end validation of impulse preservation"""

    print("\n" + "=" * 70)
    print("IMPULSE FIX VALIDATION - END-TO-END TEST")
    print("=" * 70)

    # Load configuration
    info("Loading configuration...")
    with open(".metabob/config.json", "r") as f:
        config = json.load(f)

    with open(".metabob/state", "r") as f:
        state_data = json.load(f)
        session_token = state_data.get("session_metadata", {}).get("session_token")

    if not session_token:
        error("No session token found. Run: python3 scripts/create_session_state.py")
        return False

    base_url = config.get("base_url", "http://localhost:8080")
    success(f"Configuration loaded (backend: {base_url})")

    # Create activity manager
    manager = get_activity_manager(base_url, session_token)

    # Search for minimal test activity
    info("Searching for test activity...")
    activities = await manager.search_activities(query="testing")

    test_activity = None
    for act in activities:
        if act["id"] == "testing-7f7ebb40":
            test_activity = act
            break

    if not test_activity:
        warning("Test activity not found, using first available activity")
        if activities:
            test_activity = activities[0]
        else:
            error("No activities available!")
            return False

    success(f"Found activity: {test_activity['name']} (ID: {test_activity['id']})")

    # Create test impulse
    test_impulse = {
        "id": "validation-impulse-001",
        "type": "memo",
        "content": "Test impulse for validation",
        "budget": 500,
        "used": 0,
    }

    info(f"Creating test execution with impulse: {test_impulse['id']}")

    # Start execution
    result = await manager.start_execution(
        activity_id=test_activity["id"],
        variables={},
        session_id=f"validation-session-{test_activity['id']}",
        impulses=[test_impulse],
    )

    if not result or result.get("status") != "success":
        error(f"Failed to start execution: {result}")
        return False

    exec_id = result.get("execution_id")
    if not exec_id:
        error(f"No execution_id in result: {result}")
        return False

    success(f"Execution started: {exec_id}")

    # Monitor execution (check impulse data DURING execution)
    info("Monitoring impulse data during execution...")

    # Give execution a moment to start
    await asyncio.sleep(1)

    # Get execution object from manager's internal cache
    execution = manager._executions.get(exec_id)

    if not execution:
        error(f"Execution {exec_id} not found in manager cache")
        return False

    # Validate impulse data BEFORE any potential overwriting
    print("\n" + "-" * 70)
    print("IMPULSE DATA VALIDATION (PRE-COMPLETION)")
    print("-" * 70)

    impulses_before = execution.impulses_used
    print(f"Number of impulses: {len(impulses_before)}")

    if len(impulses_before) == 0:
        warning("No impulses found in execution object")
        info("This could mean:")
        info("  1. Activity doesn't use impulses")
        info("  2. Impulse not properly set during start_execution")
        print()
    else:
        for i, imp in enumerate(impulses_before, 1):
            print(f"\nImpulse {i}:")
            print(f"  ID: {imp.get('id', 'MISSING_ID')}")
            print(f"  Type: {imp.get('type', 'MISSING_TYPE')}")
            print(f"  Tokens: {imp.get('tokens_used', 0)}")
            content_hash = imp.get("content_hash", "MISSING")
            if content_hash != "MISSING":
                print(f"  Content hash: {content_hash[:16]}...")
            else:
                print(f"  Content hash: {RED}MISSING{RESET}")
            print(f"  Was useful: {imp.get('was_useful', 'NOT_SET')}")

    # Wait for execution to complete
    info("\nWaiting for execution to complete...")

    max_wait = 30  # seconds
    waited = 0
    while waited < max_wait:
        if execution.state.value in ["completed", "failed"]:
            break
        await asyncio.sleep(1)
        waited += 1

    if waited >= max_wait:
        warning(f"Execution still running after {max_wait}s")
        return False

    success(f"Execution completed with status: {execution.state.value}")

    # Validate impulse data AFTER completion
    print("\n" + "-" * 70)
    print("IMPULSE DATA VALIDATION (POST-COMPLETION)")
    print("-" * 70)

    impulses_after = execution.impulses_used
    print(f"Number of impulses: {len(impulses_after)}")

    # Validate the fix worked
    validation_passed = True

    if len(impulses_before) > 0 and len(impulses_after) == 0:
        error("FAIL: Impulses were overwritten with empty list!")
        error("This indicates the fix in lines 1505-1507 is not working")
        validation_passed = False
    elif len(impulses_after) > 0:
        success("PASS: Impulses preserved after completion")

        # Check data quality
        for i, imp in enumerate(impulses_after, 1):
            print(f"\nImpulse {i} (after completion):")
            imp_id = imp.get("id", "")

            # Check ID quality
            if imp_id.startswith("unknown-"):
                warning(f"  ID: {imp_id} (auto-generated, not from original)")
            elif imp_id == test_impulse.get("id"):
                success(f"  ID: {imp_id} (preserved from start_execution)")
            else:
                info(f"  ID: {imp_id}")

            # Check tokens
            tokens = imp.get("tokens_used", 0)
            if tokens > 0:
                success(f"  Tokens: {tokens}")
            else:
                warning(f"  Tokens: {tokens} (may be expected for unused impulse)")

            # Check content hash
            content_hash = imp.get("content_hash", "")
            if content_hash:
                success(f"  Content hash: {content_hash[:16]}...")
            else:
                warning(f"  Content hash: MISSING")

            # Check was_useful flag
            was_useful = imp.get("was_useful")
            if was_useful is not None:
                success(f"  Was useful: {was_useful}")
            else:
                warning(f"  Was useful: NOT SET")
    else:
        info("No impulses before or after (activity may not use impulses)")

    # Summary
    print("\n" + "=" * 70)
    print("VALIDATION SUMMARY")
    print("=" * 70)

    if validation_passed:
        success("VALIDATION PASSED: Impulse fix is working correctly!")
        success("Impulses were preserved through execution completion")
        return True
    else:
        error("VALIDATION FAILED: Impulse data was overwritten")
        error("The fix in lines 1505-1507 may need adjustment")
        return False


if __name__ == "__main__":
    try:
        result = asyncio.run(validate_impulse_fix())
        sys.exit(0 if result else 1)
    except Exception as e:
        error(f"Validation failed with exception: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
