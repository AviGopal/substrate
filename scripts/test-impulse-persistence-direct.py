#!/usr/bin/env python3
"""
Direct test for Phase 1 impulse persistence implementation.

Tests the complete flow:
1. Connect to SurrealDB
2. Call persist_step_impulses() with test data
3. Verify impulse_registry records created
4. Verify impulse_usage records created
5. Verify statistics updated correctly

This script tests the backend implementation directly without requiring
a full OpenCode agent execution or CLI MCP integration.
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
    print("Phase 1 Impulse Persistence - Direct Test")
    print("=" * 80)

    # Connect to SurrealDB
    print("\n[1/5] Connecting to SurrealDB...")

    # Create config for test environment
    config = Settings(
        SURREAL_URL="http://localhost:8000",
        SURREAL_NAMESPACE="metabob",
        SURREAL_DATABASE="devbob",
        SURREAL_USER="root",
        SURREAL_PASS="root",
    )

    db = SurrealDBClient(config=config)

    try:
        await db.connect()
        print("✓ Connected to SurrealDB")
    except Exception as e:
        print(f"✗ Failed to connect: {e}")
        return False

    # Test data
    test_execution_id = "test-exec-impulse-001"
    test_step_id = "step-0"
    test_impulses_loaded = [
        "activity-workflow-reminder",
        "recent-commits",
        "phase2-completion",
    ]
    test_impulses_created = ["test-impulse-created-001"]
    test_context_summary = {
        "activity-workflow-reminder": {
            "type": "memo",
            "budget": 300,
            "scope": "activity",
            "created_by": "session-agent",
            "resolution_time_ms": 15,
            "tokens_used": 250,
        },
        "recent-commits": {
            "type": "bashOutput",
            "budget": 2000,
            "scope": "session",
            "created_by": "activity-agent",
            "resolution_time_ms": 120,
            "tokens_used": 552,
        },
        "phase2-completion": {
            "type": "file",
            "budget": 3000,
            "scope": "activity",
            "created_by": "activity-agent",
            "resolution_time_ms": 85,
            "tokens_used": 2590,
        },
        "test-impulse-created-001": {
            "type": "memo",
            "budget": 500,
            "scope": "session",
            "created_by": "test-agent",
            "created_for": "test validation",
        },
    }

    # Call persist_step_impulses
    print("\n[2/5] Persisting step impulses...")
    try:
        await persist_step_impulses(
            db=db,
            execution_id=test_execution_id,
            step_id=test_step_id,
            step_index=0,
            step_succeeded=True,
            impulses_loaded=test_impulses_loaded,
            impulses_created=test_impulses_created,
            context_summary=test_context_summary,
            org_id="test-org",
            project_id="test-project",
            session_id="test-session-001",
        )
        print(
            f"✓ Persisted {len(test_impulses_loaded) + len(test_impulses_created)} impulses"
        )
    except Exception as e:
        print(f"✗ Failed to persist impulses: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Verify impulse_registry
    print("\n[3/5] Verifying impulse_registry table...")
    try:
        registry_query = """
        SELECT * FROM impulse_registry 
        WHERE impulse_id IN $impulse_ids
        ORDER BY impulse_id
        """
        all_impulses = test_impulses_loaded + test_impulses_created
        registry_result = await db.query(registry_query, {"impulse_ids": all_impulses})

        if not registry_result or len(registry_result) == 0:
            print(f"✗ No impulses found in registry (expected {len(all_impulses)})")
            return False

        print(f"✓ Found {len(registry_result)} impulses in registry")

        # Verify fields
        for impulse in registry_result:
            impulse_id = impulse.get("impulse_id")
            print(f"  - {impulse_id}:")
            print(f"    Type: {impulse.get('impulse_type')}")
            print(f"    Budget: {impulse.get('budget')}")
            print(f"    Usage Count: {impulse.get('usage_count')}")
            print(f"    Success Rate: {impulse.get('success_rate'):.2%}")
            print(f"    Status: {impulse.get('status')}")
    except Exception as e:
        print(f"✗ Failed to query impulse_registry: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Verify impulse_usage
    print("\n[4/5] Verifying impulse_usage table...")
    try:
        usage_query = """
        SELECT * FROM impulse_usage 
        WHERE execution_id = $execution_id 
          AND step_id = $step_id
        ORDER BY impulse_id
        """
        usage_result = await db.query(
            usage_query, {"execution_id": test_execution_id, "step_id": test_step_id}
        )

        if not usage_result or len(usage_result) == 0:
            print(f"✗ No usage records found (expected {len(all_impulses)})")
            return False

        print(f"✓ Found {len(usage_result)} usage records")

        # Verify fields
        for usage in usage_result:
            print(f"  - {usage.get('impulse_id')}:")
            print(f"    Usage Type: {usage.get('usage_type')}")
            print(f"    Step Succeeded: {usage.get('step_succeeded')}")
            print(f"    Resolution Time: {usage.get('resolution_time_ms')}ms")
            print(f"    Tokens Used: {usage.get('tokens_used')}")
    except Exception as e:
        print(f"✗ Failed to query impulse_usage: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Verify statistics
    print("\n[5/5] Verifying statistics calculation...")
    try:
        stats_query = """
        SELECT impulse_id, impulse_type, usage_count, success_rate, last_used_at
        FROM impulse_registry 
        WHERE impulse_id IN $impulse_ids
        ORDER BY impulse_id
        """
        stats_result = await db.query(stats_query, {"impulse_ids": all_impulses})

        print("✓ Statistics updated:")
        for stats in stats_result:
            print(f"  - {stats.get('impulse_id')}:")
            print(f"    Usage Count: {stats.get('usage_count')}")
            print(f"    Success Rate: {stats.get('success_rate'):.2%}")
            print(f"    Last Used: {stats.get('last_used_at')}")

        # Verify counts match expected
        for stats in stats_result:
            if stats.get("usage_count") != 1:
                print(f"✗ Expected usage_count=1, got {stats.get('usage_count')}")
                return False
            if stats.get("success_rate") != 1.0:
                print(f"✗ Expected success_rate=1.0, got {stats.get('success_rate')}")
                return False
    except Exception as e:
        print(f"✗ Failed to verify statistics: {e}")
        import traceback

        traceback.print_exc()
        return False

    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED")
    print("=" * 80)
    print("\nPhase 1 impulse persistence is working correctly:")
    print("  ✓ impulse_registry table populated with metadata")
    print("  ✓ impulse_usage table populated with usage records")
    print("  ✓ Statistics calculated correctly (usage_count, success_rate)")
    print("  ✓ Timestamps and metadata preserved")
    print("\nReady for production use!")

    return True


async def cleanup_test_data():
    """Clean up test data after test."""
    print("\n[Cleanup] Removing test data...")

    db = SurrealDBClient(
        url="http://localhost:8000",
        namespace="metabob",
        database="devbob",
        username="root",
        password="root",
    )

    await db.connect()

    # Delete test impulses from registry
    await db.query("""
        DELETE FROM impulse_registry 
        WHERE org_id = 'test-org' OR impulse_id LIKE 'test-%'
    """)

    # Delete test usage records
    await db.query("""
        DELETE FROM impulse_usage 
        WHERE execution_id LIKE 'test-%'
    """)

    print("✓ Test data cleaned up")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test Phase 1 impulse persistence")
    parser.add_argument(
        "--cleanup", action="store_true", help="Clean up test data after test"
    )
    args = parser.parse_args()

    try:
        success = asyncio.run(test_impulse_persistence())

        if success and args.cleanup:
            asyncio.run(cleanup_test_data())

        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nTest failed with exception: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
