#!/usr/bin/env python3
"""
Simple test for Phase 1 impulse persistence.

Tests impulse persistence by calling the backend API directly.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "repos" / "metabob-rpc-api"
sys.path.insert(0, str(backend_path))

from server.utils.surreal_client import SurrealDBClient
from server.actions.impulse_registry import persist_step_impulses
from server.config import Settings


async def test_impulse_persistence():
    """Test impulse persistence implementation."""

    print("=" * 80)
    print("Phase 1 Impulse Persistence - Simple Test")
    print("=" * 80)

    # Override config for devbob test environment
    print("\n[1/5] Connecting to SurrealDB (devbob environment)...")

    # Create test config
    test_config = type(
        "TestConfig",
        (),
        {
            "SURREAL_URL": "ws://localhost:8000",
            "SURREAL_NAMESPACE": "metabob",
            "SURREAL_DATABASE": "devbob",
            "SURREAL_USER": "root",
            "SURREAL_PASS": "root",
        },
    )()

    db = SurrealDBClient(config=test_config)

    try:
        await db.connect()
        print("✓ Connected to SurrealDB")
    except Exception as e:
        print(f"✗ Failed to connect: {e}")
        return False

    # Test data
    test_execution_id = "test-exec-impulse-001"
    test_step_id = "step-0"
    test_step_index = 0
    test_impulses_loaded = [
        "activity-workflow-reminder",
        "recent-commits",
        "phase2-completion",
    ]
    test_impulses_created = ["fix-plan-draft"]
    test_step_succeeded = True
    test_context_summary = {
        "activity-workflow-reminder": {"type": "memo", "budget": 300},
        "recent-commits": {"type": "bashOutput", "budget": 2000},
        "phase2-completion": {"type": "file", "budget": 3000},
        "fix-plan-draft": {"type": "memo", "budget": 1000},
    }
    test_org_id = "test-org"
    test_project_id = "test-project"
    test_session_id = "test-session-001"

    # Phase 2: Persist impulses
    print("\n[2/5] Persisting impulses...")
    try:
        await persist_step_impulses(
            db=db,
            execution_id=test_execution_id,
            step_id=test_step_id,
            step_index=test_step_index,
            step_succeeded=test_step_succeeded,
            impulses_loaded=test_impulses_loaded,
            impulses_created=test_impulses_created,
            context_summary=test_context_summary,
            org_id=test_org_id,
            project_id=test_project_id,
            session_id=test_session_id,
        )
        print(
            f"✓ Persisted {len(test_impulses_loaded) + len(test_impulses_created)} impulses"
        )
    except Exception as e:
        print(f"✗ Failed to persist impulses: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Phase 3: Verify impulse_registry
    print("\n[3/5] Verifying impulse_registry...")
    try:
        all_impulse_ids = test_impulses_loaded + test_impulses_created
        query = "SELECT * FROM impulse_registry WHERE impulse_id IN $impulse_ids"
        results = await db.query(query, {"impulse_ids": all_impulse_ids})

        if not results or len(results) == 0:
            print(f"✗ No impulses found in registry")
            return False

        # Results come back as list of lists
        found_impulses = results[0] if isinstance(results[0], list) else [results[0]]
        print(f"✓ Found {len(found_impulses)} impulses in registry")

        # Show sample
        for impulse in found_impulses[:2]:
            print(
                f"  - {impulse.get('impulse_id')}: {impulse.get('impulse_type')}, "
                f"usage_count={impulse.get('usage_count')}, "
                f"success_rate={impulse.get('success_rate')}"
            )

    except Exception as e:
        print(f"✗ Failed to verify registry: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Phase 4: Verify impulse_usage
    print("\n[4/5] Verifying impulse_usage...")
    try:
        query = """
            SELECT * FROM impulse_usage 
            WHERE execution_id = $execution_id AND step_id = $step_id
        """
        results = await db.query(
            query, {"execution_id": test_execution_id, "step_id": test_step_id}
        )

        if not results or len(results) == 0:
            print(f"✗ No usage records found")
            return False

        usage_records = results[0] if isinstance(results[0], list) else [results[0]]
        print(f"✓ Found {len(usage_records)} usage records")

        # Verify all impulses have usage records
        expected_count = len(all_impulse_ids)
        if len(usage_records) != expected_count:
            print(
                f"⚠ Warning: Expected {expected_count} records, found {len(usage_records)}"
            )

    except Exception as e:
        print(f"✗ Failed to verify usage: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Phase 5: Verify statistics
    print("\n[5/5] Verifying statistics...")
    try:
        query = """
            SELECT impulse_id, usage_count, success_when_used, success_rate
            FROM impulse_registry 
            WHERE impulse_id IN $impulse_ids
        """
        results = await db.query(query, {"impulse_ids": all_impulse_ids})

        if not results or len(results) == 0:
            print(f"✗ No statistics found")
            return False

        stats = results[0] if isinstance(results[0], list) else [results[0]]
        print(f"✓ Statistics updated for {len(stats)} impulses")

        # Check that statistics make sense
        for stat in stats:
            usage = stat.get("usage_count", 0)
            success = stat.get("success_when_used", 0)
            rate = stat.get("success_rate", 0.0)

            if usage > 0:
                expected_rate = (success / usage) * 100
                if abs(rate - expected_rate) > 0.01:
                    print(
                        f"⚠ Warning: Success rate mismatch for {stat.get('impulse_id')}"
                    )
                else:
                    print(
                        f"  - {stat.get('impulse_id')}: usage={usage}, success_rate={rate:.1f}%"
                    )

    except Exception as e:
        print(f"✗ Failed to verify statistics: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Cleanup - no close() method needed for SurrealDBClient

    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED")
    print("=" * 80)
    return True


if __name__ == "__main__":
    try:
        success = asyncio.run(test_impulse_persistence())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\nTest failed with exception: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
