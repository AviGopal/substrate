#!/usr/bin/env python3
"""
End-to-end test for impulse data quality fixes.

Tests the complete flow:
1. Create activity execution with impulses
2. Verify impulses flow through activity_manager
3. Check database for properly formatted impulse data
4. Validate improvements vs baseline
"""

import asyncio
import sys
import os
import json
import httpx
from datetime import datetime

sys.path.insert(0, "repos/metabob-cli/src")

from metabob_cli.mcp.activity_manager import get_activity_manager
from metabob_cli.core.file_state import FileStateManager

# Test configuration
BACKEND_URL = "http://localhost:8080"
TEST_ACTIVITY_ID = "testing-7f7ebb40"  # From session memory
SESSION_ID = "test-impulse-flow-e2e"

# Create test impulses with realistic structure
TEST_IMPULSES = [
    {
        "id": "test-file-impulse-1",
        "type": "file",
        "pointer": {
            "type": "file",
            "filePath": "/test/example.py",
            "offset": 0,
            "limit": 100,
        },
        "content": "def example_function():\n    return 'test'\n",
        "tokens": 20,
        "budget": 1000,
        "truncated": False,
    },
    {
        "id": "test-memo-impulse-2",
        "type": "memo",
        "pointer": {
            "type": "memo",
            "content": "Test requirement: implement error handling",
        },
        "content": "Test requirement: implement error handling",
        "tokens": 15,
        "budget": 500,
        "truncated": False,
    },
    {
        "id": "test-component-impulse-3",
        "type": "component",
        "pointer": {
            "type": "component",
            "filePath": "/test/handler.py",
            "componentName": "ErrorHandler",
            "componentType": "class",
        },
        "content": "class ErrorHandler:\n    def handle_error(self, error):\n        pass\n",
        "tokens": 30,
        "budget": 2000,
        "truncated": False,
    },
]


async def setup_session():
    """Create a valid session token for testing."""
    print("📋 Setting up session authentication...")

    # Use the existing session state creation
    result = os.system("python3 scripts/create_session_state.py > /dev/null 2>&1")
    if result != 0:
        print("❌ Failed to run create_session_state.py")
        return None

    # Read token directly from state file
    try:
        import json

        with open(".metabob/state", "r") as f:
            state = json.load(f)
        session_token = state.get("session_metadata", {}).get("session_token")
    except Exception as e:
        print(f"❌ Failed to read session token: {e}")
        return None

    if not session_token:
        print("❌ No session token in state file")
        return None

    print(f"✅ Session token created: {session_token[:20]}...")
    return session_token


async def execute_activity_with_impulses(session_token):
    """Execute test activity with impulses."""
    print("\n🚀 Starting activity execution with impulses...")

    manager = get_activity_manager(BACKEND_URL, session_token)

    # Start execution with impulses parameter
    try:
        result = await manager.start_execution(
            activity_id=TEST_ACTIVITY_ID,
            session_id=SESSION_ID,
            variables={
                "test_name": "impulse-flow-test",
                "test_description": "Validate impulse data quality fixes",
            },
            cost_budget=1.0,
            impulses=TEST_IMPULSES,  # ⭐ Pass impulses here
        )

        execution_id = result.get("execution_id")
        print(f"✅ Execution started: {execution_id}")
        return execution_id

    except Exception as e:
        print(f"❌ Execution failed: {e}")
        import traceback

        traceback.print_exc()
        return None


async def wait_for_completion(manager, execution_id, timeout=30):
    """Wait for activity execution to complete."""
    print(f"\n⏳ Waiting for execution {execution_id} to complete...")

    import time

    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            status = await manager.get_execution_status(execution_id)
            state = status.get("state", "unknown")

            if state in ["COMPLETED", "FAILED"]:
                print(f"✅ Execution {state.lower()}")
                return state

            await asyncio.sleep(2)

        except Exception as e:
            print(f"⚠️ Status check error: {e}")
            await asyncio.sleep(2)

    print(f"⏰ Timeout after {timeout}s")
    return "TIMEOUT"


async def query_impulse_effectiveness(execution_id):
    """Query the impulse_effectiveness table for our test execution."""
    print(f"\n🔍 Querying impulse_effectiveness for execution {execution_id}...")

    query = f"""
    SELECT 
        impulse_id,
        total_tokens,
        times_used,
        last_used,
        success_rate
    FROM impulse_effectiveness
    WHERE activity_executions CONTAINS '{execution_id}'
    LIMIT 10;
    """

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:8000/sql",
                auth=("root", "root"),
                headers={"NS": "metabob", "DB": "devbob"},
                data=query,
            )

            if response.status_code == 200:
                results = response.json()

                # SurrealDB returns array of result objects
                if results and len(results) > 0:
                    result_data = results[0].get("result", [])
                    print(f"✅ Found {len(result_data)} impulse records")
                    return result_data
                else:
                    print("⚠️ No results returned")
                    return []
            else:
                print(f"❌ Query failed: {response.status_code} - {response.text}")
                return []

    except Exception as e:
        print(f"❌ Query error: {e}")
        import traceback

        traceback.print_exc()
        return []


def validate_impulse_quality(records):
    """Validate the quality of impulse data."""
    print("\n📊 Validating impulse data quality...")

    if not records:
        print("❌ No records to validate")
        return False

    validation_results = {
        "total_records": len(records),
        "proper_ids": 0,
        "non_zero_tokens": 0,
        "has_metadata": 0,
        "issues": [],
    }

    for record in records:
        impulse_id = record.get("impulse_id", "")
        total_tokens = record.get("total_tokens", 0)

        # Check ID format (should be like "file-abc12345" not "unknown")
        if impulse_id and impulse_id != "unknown" and "-" in impulse_id:
            validation_results["proper_ids"] += 1
        else:
            validation_results["issues"].append(f"Bad ID: {impulse_id}")

        # Check token estimation
        if total_tokens > 0:
            validation_results["non_zero_tokens"] += 1
        else:
            validation_results["issues"].append(f"Zero tokens for {impulse_id}")

        # Check metadata presence
        if record.get("times_used") and record.get("last_used"):
            validation_results["has_metadata"] += 1

    # Calculate percentages
    total = validation_results["total_records"]
    proper_id_pct = (validation_results["proper_ids"] / total) * 100 if total > 0 else 0
    token_pct = (
        (validation_results["non_zero_tokens"] / total) * 100 if total > 0 else 0
    )

    print(f"\n📈 Quality Metrics:")
    print(f"  Total records: {total}")
    print(
        f"  Proper IDs: {validation_results['proper_ids']}/{total} ({proper_id_pct:.1f}%)"
    )
    print(
        f"  Non-zero tokens: {validation_results['non_zero_tokens']}/{total} ({token_pct:.1f}%)"
    )
    print(f"  Has metadata: {validation_results['has_metadata']}/{total}")

    if validation_results["issues"]:
        print(f"\n⚠️ Issues found ({len(validation_results['issues'])}):")
        for issue in validation_results["issues"][:5]:  # Show first 5
            print(f"  - {issue}")

    # Success criteria: >90% proper IDs and tokens
    success = proper_id_pct >= 90 and token_pct >= 90

    if success:
        print(f"\n✅ VALIDATION PASSED - Data quality meets targets!")
    else:
        print(f"\n❌ VALIDATION FAILED - Data quality below 90% target")
        print(f"   Expected: >90% proper IDs and >90% non-zero tokens")
        print(
            f"   Got: {proper_id_pct:.1f}% proper IDs, {token_pct:.1f}% non-zero tokens"
        )

    return success


async def main():
    """Run the end-to-end test."""
    print("=" * 70)
    print("🧪 Impulse Data Quality - End-to-End Test")
    print("=" * 70)

    # Step 1: Setup
    session_token = await setup_session()
    if not session_token:
        print("\n❌ Setup failed - cannot continue")
        return False

    # Step 2: Execute activity with impulses
    manager = get_activity_manager(BACKEND_URL, session_token)
    execution_id = await execute_activity_with_impulses(session_token)
    if not execution_id:
        print("\n❌ Execution failed - cannot continue")
        return False

    # Step 3: Wait for completion (or timeout)
    state = await wait_for_completion(manager, execution_id, timeout=60)

    # Step 4: Query database
    records = await query_impulse_effectiveness(execution_id)

    # Step 5: Validate data quality
    if not records:
        print("\n⚠️ WARNING: No impulse records found in database")
        print("This could mean:")
        print("  1. Activity completed before impulses were captured")
        print("  2. Impulses weren't passed through the execution flow")
        print("  3. Database write failed")

        print("\n🔍 Debugging: Check if execution exists in database...")
        query = f"SELECT * FROM activity_execution WHERE id = '{execution_id}';"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:8000/sql",
                auth=("root", "root"),
                headers={"NS": "metabob", "DB": "devbob"},
                data=query,
            )
            if response.status_code == 200:
                results = response.json()
                if results and results[0].get("result"):
                    print("✅ Execution record exists")
                else:
                    print("❌ Execution record NOT found")

        return False

    success = validate_impulse_quality(records)

    # Summary
    print("\n" + "=" * 70)
    if success:
        print("✅ TEST PASSED - Impulse data quality fixes are working!")
    else:
        print("❌ TEST FAILED - Impulse data quality issues remain")
    print("=" * 70)

    return success


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
