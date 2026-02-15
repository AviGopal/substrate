#!/usr/bin/env python3
"""
End-to-end verification of impulse tracking system.

This script:
1. Executes an activity with test impulses
2. Verifies impulses are tracked in the database
3. Tests the learning loop APIs

Prerequisites:
- Backend running on localhost:8080
- At least one activity template registered
- Valid session token in .metabob/state

Usage:
    python3 verify_impulse_tracking_e2e.py
"""

import sys
import json
import asyncio
import httpx
from datetime import datetime
from pathlib import Path

# Add CLI to path
sys.path.insert(0, str(Path(__file__).parent / "repos" / "metabob-cli" / "src"))

from metabob_cli.mcp.activity_manager import get_activity_manager, ActivityExecution


def load_config():
    """Load configuration and state."""
    config_file = Path(".metabob/config.json")
    state_file = Path(".metabob/state")

    if not config_file.exists():
        raise FileNotFoundError(f"Config file not found: {config_file}")
    if not state_file.exists():
        raise FileNotFoundError(f"State file not found: {state_file}")

    with open(config_file) as f:
        config = json.load(f)
    with open(state_file) as f:
        state = json.load(f)

    return config, state


async def verify_impulse_tracking():
    """Main verification function."""

    print("=" * 70)
    print("End-to-End Impulse Tracking Verification")
    print("=" * 70)

    # Load config
    print("\n[1/6] Loading configuration...")
    try:
        config, state = load_config()
        base_url = config["base_url"]
        session_token = state["session_metadata"]["session_token"]
        print(f"   ✓ Base URL: {base_url}")
        print(f"   ✓ Session token loaded")
    except Exception as e:
        print(f"   ✗ Failed to load config: {e}")
        return False

    # Create manager
    print("\n[2/6] Initializing activity manager...")
    try:
        manager = get_activity_manager(base_url=base_url, session_token=session_token)
        print(f"   ✓ Activity manager ready")
    except Exception as e:
        print(f"   ✗ Failed to create manager: {e}")
        return False

    # Check for templates
    print("\n[3/6] Searching for activity templates...")
    try:
        activities = await manager.search_activities(limit=5)
        if not activities:
            print(f"   ✗ No templates found in backend")
            print(f"   → Run: python3 scripts/bootstrap_activities.py")
            return False

        activity = activities[0]
        activity_id = activity.get("id")
        activity_name = activity.get("name", "Unknown")
        print(f"   ✓ Found {len(activities)} template(s)")
        print(f"   ✓ Using: {activity_id} ({activity_name})")
    except Exception as e:
        print(f"   ✗ Failed to search templates: {e}")
        return False

    # Create test impulses
    print("\n[4/6] Creating test impulses...")
    test_impulses = [
        {
            "id": "e2e-test-impulse-memo",
            "type": "memo",
            "pointer": {
                "type": "memo",
                "content": "End-to-end impulse tracking verification test",
            },
            "tokens_loaded": 25,
            "tokens_budget": 500,
            "loaded_at": datetime.utcnow().isoformat() + "Z",
        },
        {
            "id": "e2e-test-impulse-file",
            "type": "file",
            "pointer": {"type": "file", "path": "/test/verify_impulse_tracking_e2e.py"},
            "tokens_loaded": 150,
            "tokens_budget": 1000,
            "loaded_at": datetime.utcnow().isoformat() + "Z",
        },
    ]
    print(f"   ✓ Created {len(test_impulses)} test impulses")
    for imp in test_impulses:
        print(f"      - {imp['id']} ({imp['type']}, {imp['tokens_loaded']} tokens)")

    # Start execution with impulses
    print("\n[5/6] Executing activity with impulses...")
    try:
        # Create execution with impulses
        execution_id = await manager.start_execution(
            activity_id=activity_id,
            variables={"test_mode": "true", "impulse_tracking_verification": "true"},
            session_id=state["session_metadata"]["session_id"],
            impulses_used=test_impulses,  # Pass impulses here
        )
        print(f"   ✓ Execution started: {execution_id}")
        print(f"   ✓ Impulses sent: {len(test_impulses)}")

        # Wait for execution to be recorded
        await asyncio.sleep(2)

    except Exception as e:
        print(f"   ✗ Failed to start execution: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Verify in database
    print("\n[6/6] Verifying impulses in database...")
    try:
        async with httpx.AsyncClient() as client:
            # Query SurrealDB for the execution
            surql_query = f"""
            SELECT 
                execution_id,
                activity_id,
                impulses_used,
                array::len(impulses_used) AS impulse_count
            FROM activity_executions 
            WHERE execution_id = '{execution_id}'
            """

            response = await client.post(
                f"{base_url.replace(':8080', ':8000')}/sql",
                json=surql_query,
                auth=("root", "root"),
                headers={"Accept": "application/json"},
            )

            if response.status_code != 200:
                print(f"   ✗ Database query failed: HTTP {response.status_code}")
                print(f"   Response: {response.text}")
                return False

            result = response.json()

            # Parse SurrealDB response format
            if not result or "result" not in result or not result["result"]:
                print(f"   ✗ No execution record found in database")
                print(f"   Raw response: {json.dumps(result, indent=2)}")
                return False

            execution_data = result["result"][0]
            impulses_count = execution_data.get("impulse_count", 0)
            impulses_data = execution_data.get("impulses_used", [])

            print(f"   ✓ Database query successful")
            print(f"   ✓ Execution record found: {execution_id}")
            print(f"   ✓ Impulses tracked in DB: {impulses_count}")

            # Verify impulse count matches
            if impulses_count != len(test_impulses):
                print(f"\n   ⚠️  WARNING: Impulse count mismatch!")
                print(f"      Expected: {len(test_impulses)}")
                print(f"      Found: {impulses_count}")
                print(f"\n   This suggests the fix may not be working correctly.")
                return False

            # Verify impulse data integrity
            if not impulses_data or len(impulses_data) == 0:
                print(f"\n   ⚠️  WARNING: Impulse data is empty!")
                print(f"      impulses_used field exists but contains no data")
                return False

            # Verify impulse IDs match
            tracked_ids = [imp.get("id") for imp in impulses_data]
            expected_ids = [imp["id"] for imp in test_impulses]

            print(f"\n   Impulse data verification:")
            print(f"      Expected IDs: {expected_ids}")
            print(f"      Tracked IDs:  {tracked_ids}")

            if set(tracked_ids) != set(expected_ids):
                print(f"\n   ⚠️  WARNING: Impulse IDs don't match!")
                return False

            print(f"\n   ✓ Data integrity verified")

    except Exception as e:
        print(f"   ✗ Database verification failed: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Success!
    print("\n" + "=" * 70)
    print("✅ SUCCESS: End-to-End Impulse Tracking Verified!")
    print("=" * 70)
    print(f"\nResults:")
    print(f"   • Test impulses sent: {len(test_impulses)}")
    print(f"   • Impulses tracked in DB: {impulses_count}")
    print(f"   • Data integrity: ✓")
    print(f"   • Fix working correctly: ✓")
    print(f"\nNext steps:")
    print(f"   • Learning loop will now have impulse data to analyze")
    print(f"   • SessionMemoryAgent can query proven impulses")
    print(f"   • Activity optimization can begin")

    return True


async def test_learning_apis(base_url: str):
    """Test the learning loop APIs (optional)."""
    print("\n" + "=" * 70)
    print("Testing Learning Loop APIs")
    print("=" * 70)

    try:
        async with httpx.AsyncClient() as client:
            # Test 1: Query learned impulses
            print("\n[1/2] Testing GET /v2/impulses/learned...")
            response = await client.get(
                f"{base_url}/v2/impulses/learned",
                params={"min_success_rate": 0.5, "limit": 10},
            )

            if response.status_code == 200:
                learned = response.json()
                print(
                    f"   ✓ API responded: {len(learned.get('impulses', []))} learned impulses"
                )
            else:
                print(f"   ⚠️  API returned: HTTP {response.status_code}")

            # Test 2: Query impulses for activity
            print("\n[2/2] Testing GET /v2/impulses/for-activity/<id>...")
            response = await client.get(
                f"{base_url}/v2/impulses/for-activity/test-activity"
            )

            if response.status_code == 200:
                activity_impulses = response.json()
                print(
                    f"   ✓ API responded: {len(activity_impulses.get('impulses', []))} activity-specific impulses"
                )
            else:
                print(f"   ⚠️  API returned: HTTP {response.status_code}")

        print("\n✓ Learning APIs are accessible")

    except Exception as e:
        print(f"\n⚠️  Learning API tests skipped: {e}")


def main():
    """Main entry point."""
    try:
        # Run verification
        success = asyncio.run(verify_impulse_tracking())

        if success:
            # Optionally test learning APIs
            config, _ = load_config()
            asyncio.run(test_learning_apis(config["base_url"]))

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print("\n\nVerification cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ Verification failed with error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
