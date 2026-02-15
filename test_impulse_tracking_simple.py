#!/usr/bin/env python3
"""
Simple end-to-end test of impulse tracking.
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
    print("Impulse Tracking End-to-End Test")
    print("=" * 70)

    # Load config
    print("\n[1/5] Loading configuration...")
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
    print("\n[2/5] Initializing activity manager...")
    manager = get_activity_manager(base_url=base_url, session_token=session_token)
    print(f"   ✓ Manager ready")

    # Search for activities
    print("\n[3/5] Searching for activities...")
    activities = await manager.search_activities(limit=5)
    if not activities:
        print("   ✗ No activities found")
        return False

    activity = activities[0]
    activity_id = activity.get("id")
    if not activity_id:
        print("   ✗ Activity ID not found")
        return False
    activity_name = activity.get("name", "Unknown")
    print(f"   ✓ Found {len(activities)} activities")
    print(f"   ✓ Using: {activity_id} - {activity_name}")

    # Create test impulses
    print("\n[4/5] Creating test impulses...")
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
    print("\n[5/5] Starting execution with impulses...")
    try:
        result = await manager.start_execution(
            activity_id=activity_id,
            session_id=session_id,
            variables={"test_mode": "true"},
            cost_budget=1.0,
            impulses=test_impulses,  # Pass impulses here
        )

        execution_id = result.get("execution_id")
        print(f"   ✓ Execution started: {execution_id}")
        print(f"   ✓ Impulses sent: {len(test_impulses)}")

        # Wait for backend to process
        await asyncio.sleep(2)

        # Query database to verify
        print("\n[Verification] Checking database...")
        import httpx

        async with httpx.AsyncClient() as client:
            surql = f"""
            USE NS metabob DB production;
            SELECT 
                execution_id,
                array::len(impulses_used) AS impulse_count,
                impulses_used
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

                        print(f"   ✓ Found execution record")
                        print(f"   ✓ Impulses tracked: {impulse_count}")

                        if impulse_count == len(test_impulses):
                            print(f"\n{'=' * 70}")
                            print("✅ SUCCESS: Impulse Tracking Verified!")
                            print(f"{'=' * 70}")
                            print(f"\n   • Impulses sent: {len(test_impulses)}")
                            print(f"   • Impulses tracked: {impulse_count}")
                            print(f"   • Data integrity: ✓")

                            # Show impulse IDs
                            if impulses_data:
                                print(f"\n   Tracked impulse IDs:")
                                for imp in impulses_data:
                                    imp_id = imp.get("id", "unknown")
                                    imp_type = imp.get("type", "unknown")
                                    print(f"      - {imp_id} ({imp_type})")

                            return True
                        else:
                            print(f"\n   ⚠️  Impulse count mismatch:")
                            print(f"      Expected: {len(test_impulses)}")
                            print(f"      Found: {impulse_count}")
                            return False
                    else:
                        print(f"   ✗ No execution record found")
                        return False
                else:
                    print(f"   ✗ Unexpected database response")
                    return False
            else:
                print(f"   ✗ Database query failed: HTTP {response.status_code}")
                return False

    except Exception as e:
        print(f"   ✗ Execution failed: {e}")
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
