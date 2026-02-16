#!/usr/bin/env python3
"""
End-to-end test for impulse data quality fix.
Tests that impulses passed to start_execution are preserved through completion.
"""

import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "repos/metabob-cli/src"))

from metabob_cli.mcp.activity_manager import get_activity_manager


def load_session():
    """Load session token from .metabob/state file."""
    state_file = Path(__file__).parent / ".metabob" / "state"

    if not state_file.exists():
        print("❌ No state file found")
        print("Run: python3 scripts/create_session_state.py")
        return None, None

    with open(state_file) as f:
        state = json.load(f)

    metadata = state.get("session_metadata", {})
    return metadata.get("session_token"), metadata.get("session_id")


async def query_impulse_effectiveness(exec_id: str):
    """Query backend for impulse effectiveness records."""
    import httpx

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"http://localhost:8080/v2/activities/learning/effectiveness/{exec_id}",
                timeout=10,
            )
            if resp.status_code == 200:
                return resp.json()
            else:
                print(f"   Query failed: {resp.status_code} - {resp.text}")
                return None
    except Exception as e:
        print(f"   Query error: {e}")
        return None


async def main():
    print("=" * 70)
    print("Impulse Data Quality - End-to-End Test")
    print("=" * 70)

    # Load session
    print("\n[1/6] Loading session...")
    session_token, session_id = load_session()
    if not session_token or not session_id:
        return False
    print(f"✅ Session: {session_id[:50]}...")

    # Create manager
    print("\n[2/6] Creating activity manager...")
    manager = get_activity_manager("http://localhost:8080", session_token)
    print("✅ Manager created")

    # Find simple activity (prefer 1-2 task activities)
    print("\n[3/6] Finding simple activity...")
    activities = await manager.search_activities(query="", limit=20)
    if not activities:
        print("❌ No activities found")
        return False

    # Sort by task count (prefer minimal tasks)
    activities.sort(key=lambda x: x.get("task_count", 999))
    selected = activities[0]

    print(f"✅ Selected: {selected['name']}")
    print(f"   Activity ID: {selected['id']}")
    print(f"   Tasks: {selected.get('task_count', 0)}")

    # Create test impulses with unique IDs
    print("\n[4/6] Creating test impulses...")
    test_impulses = [
        {
            "id": f"test-file-{int(time.time())}",
            "type": "file",
            "pointer": {"type": "file", "path": "test_impulse_e2e.py"},
            "content": "# Test file impulse content\nThis is a test file for impulse tracking.",
            "budget": 500,
            "tokens_used": 250,  # Pre-set tokens used
            "priority": "high",
        },
        {
            "id": f"test-memo-{int(time.time())}",
            "type": "memo",
            "pointer": {"type": "memo", "content": "Test memo for validation"},
            "content": "## Test Memo\n\nThis memo tests impulse preservation through activity execution.",
            "budget": 300,
            "tokens_used": 150,  # Pre-set tokens used
            "priority": "medium",
        },
    ]

    print(f"✅ Created {len(test_impulses)} test impulses:")
    for imp in test_impulses:
        print(f"   - {imp['id']} ({imp['type']}, {imp.get('tokens_used', 0)} tokens)")

    # Execute with test impulses
    print("\n[5/6] Starting execution with test impulses...")
    try:
        result = await manager.start_execution(
            activity_id=selected["id"],
            variables={},
            session_id=str(session_id),
            impulses=test_impulses,
        )

        exec_id = result.get("execution_id")
        print(f"✅ Execution started: {exec_id}")

        # Wait for execution to complete
        print("\n   Waiting for execution to complete...")
        print("   (Checking status every 5 seconds)")

        max_wait = 300  # 5 minutes max
        elapsed = 0
        completed = False

        while elapsed < max_wait:
            await asyncio.sleep(5)
            elapsed += 5

            # Check if execution is in local cache and completed
            if exec_id in manager._executions:
                exec_obj = manager._executions[exec_id]
                state = exec_obj.state
                print(f"   [{elapsed}s] State: {state}")

                if state in ["COMPLETED", "FAILED", "CANCELLED"]:
                    completed = True
                    print(f"\n✅ Execution finished: {state}")
                    break
            else:
                print(f"   [{elapsed}s] Execution not in cache yet...")

        if not completed:
            print(f"\n⚠️  Execution did not complete within {max_wait}s")
            print("   Proceeding to check database anyway...")

        # Query database for impulse effectiveness records
        print("\n[6/6] Querying impulse effectiveness records...")
        effectiveness_data = await query_impulse_effectiveness(exec_id or "")

        if effectiveness_data:
            impulses = effectiveness_data.get("impulses", [])
            print(f"\n✅ Found {len(impulses)} impulse records in database")

            # Analyze quality
            proper_ids = sum(
                1
                for imp in impulses
                if not imp.get("impulse_id", "").startswith("unknown-")
            )
            non_zero_tokens = sum(
                1 for imp in impulses if imp.get("total_tokens", 0) > 0
            )

            print("\n" + "=" * 70)
            print("DATA QUALITY ANALYSIS")
            print("=" * 70)
            print(f"Total impulses: {len(impulses)}")
            print(
                f"Proper IDs: {proper_ids}/{len(impulses)} ({100 * proper_ids / len(impulses) if impulses else 0:.1f}%)"
            )
            print(
                f"Non-zero tokens: {non_zero_tokens}/{len(impulses)} ({100 * non_zero_tokens / len(impulses) if impulses else 0:.1f}%)"
            )

            print("\nImpulse Details:")
            for imp in impulses:
                print(f"  - ID: {imp.get('impulse_id', 'N/A')}")
                print(f"    Tokens: {imp.get('total_tokens', 0)}")
                print(f"    Type: {imp.get('impulse_type', 'N/A')}")
                print()

            # Success criteria
            id_quality = (proper_ids / len(impulses) * 100) if impulses else 0
            token_quality = (non_zero_tokens / len(impulses) * 100) if impulses else 0

            print("=" * 70)
            if id_quality >= 90 and token_quality >= 90:
                print("✅ TEST PASSED - Data quality meets requirements (>90%)")
                return True
            else:
                print("❌ TEST FAILED - Data quality below requirements")
                print(f"   ID quality: {id_quality:.1f}% (need >90%)")
                print(f"   Token quality: {token_quality:.1f}% (need >90%)")
                return False
        else:
            print("⚠️  No impulse effectiveness data found in database")
            print("   This could mean:")
            print("   - Execution hasn't completed yet")
            print("   - Impulses weren't recorded (bug)")
            print("   - Backend API endpoint doesn't exist")
            return False

    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
