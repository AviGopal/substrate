#!/usr/bin/env python3
"""
Complete end-to-end test of impulse tracking with execution completion.

This test properly completes an execution to verify impulses are tracked
when the execution finishes (not just at start).
"""

import sys
import json
import asyncio
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "repos" / "metabob-cli" / "src"))

from metabob_cli.mcp.activity_manager import get_activity_manager


async def main():
    print("=" * 70)
    print("Impulse Tracking E2E Test (With Completion)")
    print("=" * 70)

    # Load config
    print("\n[1/7] Loading configuration...")
    with open(".metabob/config.json") as f:
        config = json.load(f)
    with open(".metabob/state") as f:
        state = json.load(f)

    base_url = config["base_url"]
    session_token = state["session_metadata"]["session_token"]
    session_id = state["session_metadata"]["session_id"]
    print(f"   ✓ Base URL: {base_url}")
    print(f"   ✓ Session ID: {session_id[:30]}...")

    # Create manager
    print("\n[2/7] Initializing activity manager...")
    manager = get_activity_manager(base_url=base_url, session_token=session_token)
    print(f"   ✓ Manager ready")

    # Search for a simple activity (prefer infrastructure/code-analysis)
    print("\n[3/7] Searching for simple test activity...")
    activities = await manager.search_activities(limit=20)
    if not activities:
        print("   ✗ No activities found")
        return False

    # Find the simplest activity (fewest tasks, infrastructure/bugfix preferred)
    activity = None
    for act in activities:
        category = act.get("category", "").lower()
        task_count = act.get("task_count", 999)
        if category in ["infrastructure", "bugfix", "refactor"] and task_count <= 3:
            activity = act
            break

    if not activity:
        # Fallback to first activity
        activity = activities[0]

    activity_id = activity.get("id")
    if not activity_id:
        print("   ✗ Activity ID not found")
        return False

    activity_name = activity.get("name", "Unknown")
    task_count = activity.get("task_count", 0)
    print(f"   ✓ Found {len(activities)} activities")
    print(f"   ✓ Selected: {activity_id}")
    print(f"   ✓ Name: {activity_name}")
    print(f"   ✓ Tasks: {task_count}")

    # Create test impulses
    print("\n[4/7] Creating test impulses...")
    test_impulses = [
        {
            "id": "test-memo-impulse",
            "type": "memo",
            "pointer": {
                "type": "memo",
                "content": "Test impulse for tracking verification",
            },
            "tokens_loaded": 50,
            "tokens_budget": 1000,
            "loaded_at": datetime.utcnow().isoformat() + "Z",
        },
        {
            "id": "test-file-impulse",
            "type": "file",
            "pointer": {"type": "file", "path": "/test/verification.py"},
            "tokens_loaded": 150,
            "tokens_budget": 2000,
            "loaded_at": datetime.utcnow().isoformat() + "Z",
        },
    ]
    print(f"   ✓ Created {len(test_impulses)} test impulses")
    for imp in test_impulses:
        print(f"      - {imp['id']} ({imp['type']}, {imp['tokens_loaded']} tokens)")

    # Start execution with impulses
    print("\n[5/7] Starting execution with impulses...")
    execution_id: str | None = None  # Initialize before try block
    try:
        result = await manager.start_execution(
            activity_id=activity_id,
            session_id=session_id,
            variables={"test_mode": "true", "skip_validation": "true"},
            cost_budget=2.0,
            impulses=test_impulses,  # Pass impulses here
        )

        execution_id = result.get("execution_id")
        print(f"   ✓ Execution started: {execution_id}")
        print(f"   ✓ Impulses attached: {len(test_impulses)}")

        # Verify impulses are stored in execution object
        if execution_id:
            execution = manager._executions.get(execution_id)
            if execution and execution.impulses_used:
                print(
                    f"   ✓ Impulses in execution object: {len(execution.impulses_used)}"
                )
            else:
                print(f"   ⚠️  Impulses not found in execution object")
        else:
            print(f"   ⚠️  No execution ID returned")

    except Exception as e:
        print(f"   ✗ Start execution failed: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Complete the execution (this is where impulses get persisted)
    print("\n[6/7] Completing execution...")
    try:
        if not execution_id:
            print(f"   ✗ No execution ID available")
            return False

        # Get execution object
        execution = manager._executions.get(execution_id)
        if not execution:
            print(f"   ✗ Execution object not found")
            return False

        # Directly call private _record_outcome method (this is a test)
        # In real usage, execution completes via get_next_step/report_step_result flow
        await manager._record_outcome(execution, success=True)
        print(f"   ✓ Execution completed successfully")
        print(f"   ✓ Impulse data sent to backend")

    except Exception as e:
        print(f"   ✗ Complete execution failed: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Wait for backend to process
    print("\n[7/7] Verifying impulse tracking in database...")
    await asyncio.sleep(2)

    try:
        import httpx

        async with httpx.AsyncClient() as client:
            surql = f"""
            USE NS metabob DB production;
            SELECT 
                execution_id,
                array::len(impulses_used) AS impulse_count,
                impulses_used,
                completed_at
            FROM activity_executions 
            WHERE execution_id = '{execution_id}'
            """

            response = await client.post(
                "http://localhost:8000/sql",
                content=surql,
                auth=("root", "root"),
                headers={
                    "Content-Type": "application/surql",
                    "Accept": "application/json",
                },
            )

            if response.status_code == 200:
                results = response.json()
                # SurrealDB returns array of results (USE + SELECT)
                if len(results) > 1 and results[1].get("result"):
                    data = results[1]["result"]
                    if data and len(data) > 0:
                        exec_data = data[0]
                        impulse_count = exec_data.get("impulse_count", 0)
                        impulses_data = exec_data.get("impulses_used", [])
                        completed_at = exec_data.get("completed_at")

                        print(f"   ✓ Found execution record")
                        print(f"   ✓ Completion time: {completed_at}")
                        print(f"   ✓ Impulses tracked: {impulse_count}")

                        if impulse_count == len(test_impulses):
                            print(f"\n{'=' * 70}")
                            print("✅ SUCCESS: Impulse Tracking E2E Verified!")
                            print(f"{'=' * 70}")
                            print(f"\n   • Impulses sent: {len(test_impulses)}")
                            print(f"   • Impulses tracked: {impulse_count}")
                            print(f"   • Data integrity: ✓")
                            print(f"   • Completion flow: ✓")

                            # Show impulse details
                            if impulses_data:
                                print(f"\n   Tracked impulse data:")
                                for imp in impulses_data:
                                    imp_id = imp.get("impulse_id", "unknown")
                                    tokens = imp.get("tokens_used", 0)
                                    content_hash = imp.get("content_hash", "none")[:8]
                                    print(f"      - {imp_id}")
                                    print(f"        Tokens: {tokens}")
                                    print(f"        Hash: {content_hash}...")

                            return True
                        else:
                            print(f"\n{'=' * 70}")
                            print(
                                f"⚠️  PARTIAL SUCCESS: Execution completed but impulse count mismatch"
                            )
                            print(f"{'=' * 70}")
                            print(f"\n   Expected: {len(test_impulses)} impulses")
                            print(f"   Found: {impulse_count} impulses")
                            print(f"\n   This may indicate:")
                            print(f"   - Impulse data not properly transformed")
                            print(f"   - Backend filtering impulses")
                            print(f"   - Data serialization issue")
                            return False
                    else:
                        print(f"   ✗ No execution record found in database")
                        print(f"   ℹ️  This may mean completion didn't persist")
                        return False
                else:
                    print(f"   ✗ Unexpected database response format")
                    print(f"   Response: {results}")
                    return False
            else:
                print(f"   ✗ Database query failed: HTTP {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                return False

    except Exception as e:
        print(f"   ✗ Verification failed: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest cancelled")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nTest failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
