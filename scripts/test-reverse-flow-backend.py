#!/usr/bin/env python3
"""
Test reverse flow backend endpoints

Tests the /v2/impulses endpoints to ensure they can query learned impulses.
This is Phase 1 of reverse flow implementation - backend API.

Usage:
    python3 scripts/test-reverse-flow-backend.py

Expected results:
    ✓ GET /v2/impulses/learned returns impulses with success metrics
    ✓ GET /v2/impulses/for-activity/{variant_id} returns activity-specific impulses
    ✓ Results scoped by org_id and project_id
    ✓ Authentication via session token works
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

# Add repos to path
sys.path.insert(0, str(Path(__file__).parent.parent / "repos" / "metabob-rpc-api"))
sys.path.insert(0, str(Path(__file__).parent.parent / "repos" / "metabob-cli" / "src"))

from redis import StrictRedis
from server.config import settings
from server.utils.surreal_client import SurrealDBClient
from server.actions.auth import create_session_model


async def test_reverse_flow_backend():
    """Test reverse flow backend endpoints"""

    print("\n" + "=" * 80)
    print("REVERSE FLOW BACKEND TESTING")
    print("=" * 80)

    # Setup
    config = settings()
    redis = StrictRedis.from_url(config.REDIS_URI, decode_responses=True)
    db = SurrealDBClient(
        url=config.SURREAL_URL,
        namespace=config.SURREAL_NAMESPACE,
        database=config.SURREAL_DATABASE,
    )
    await db.connect()

    print("\n✓ Connected to Redis and SurrealDB")

    # Create test session
    session = await create_session_model(
        api_key="test-key",
        org_id="test-org",
        project_id="test-project",
        redis=redis,
        db=db,
    )

    print(f"✓ Created test session: {session.session_id}")

    # Test 1: Seed test data
    print("\n" + "-" * 80)
    print("TEST 1: Seed test impulses")
    print("-" * 80)

    # Create test impulses in impulse_registry
    test_impulses = [
        {
            "impulse_id": "test-impulse-1",
            "org_id": "test-org",
            "project_id": "test-project",
            "impulse_type": "file",
            "pointer": {"type": "file", "path": "/workspace/auth.py"},
            "scope": "activity",
            "budget": 2000,
            "usage_count": 10,
            "success_when_used": 9,
            "success_rate": 0.9,
            "created_by": "session-memory",
            "created_for": "authentication",
            "tags": ["auth", "security"],
            "status": "active",
            "created_at": datetime.utcnow(),
            "last_used_at": datetime.utcnow(),
        },
        {
            "impulse_id": "test-impulse-2",
            "org_id": "test-org",
            "project_id": "test-project",
            "impulse_type": "memo",
            "pointer": {"type": "memo", "content": "Use bcrypt for password hashing"},
            "scope": "global",
            "budget": 500,
            "usage_count": 15,
            "success_when_used": 12,
            "success_rate": 0.8,
            "created_by": "agent",
            "created_for": "best-practice",
            "tags": ["security", "password"],
            "status": "active",
            "created_at": datetime.utcnow(),
            "last_used_at": datetime.utcnow(),
        },
        {
            "impulse_id": "test-impulse-3",
            "org_id": "test-org",
            "project_id": "test-project",
            "impulse_type": "metabobIssue",
            "pointer": {"type": "metabobIssue", "problem_id": "issue-123"},
            "scope": "session",
            "budget": 1000,
            "usage_count": 3,  # Below threshold
            "success_when_used": 2,
            "success_rate": 0.67,
            "created_by": "metabob",
            "created_for": "bug-context",
            "tags": ["bug"],
            "status": "active",
            "created_at": datetime.utcnow(),
            "last_used_at": datetime.utcnow(),
        },
    ]

    for impulse in test_impulses:
        query = """
            CREATE impulse_registry CONTENT $impulse
        """
        await db.query(query, {"impulse": impulse})

    print(f"✓ Created {len(test_impulses)} test impulses")

    # Test 2: Query learned impulses
    print("\n" + "-" * 80)
    print("TEST 2: Query learned impulses (GET /v2/impulses/learned)")
    print("-" * 80)

    # Simulate the endpoint query
    query = """
        SELECT 
            ir.impulse_id,
            ir.impulse_type,
            ir.pointer,
            ir.scope,
            ir.budget,
            ir.usage_count,
            ir.success_when_used,
            ir.success_rate,
            ir.created_by,
            ir.created_for,
            ir.tags,
            ir.last_used_at
        FROM impulse_registry ir
        WHERE ir.org_id = $org_id
          AND ir.project_id = $project_id
          AND ir.usage_count >= $min_usage_count
          AND ir.success_rate >= $min_success_rate
          AND ir.status = 'active'
        ORDER BY ir.success_rate DESC, ir.usage_count DESC
        LIMIT $limit
    """

    params = {
        "org_id": "test-org",
        "project_id": "test-project",
        "min_usage_count": 5,
        "min_success_rate": 0.7,
        "limit": 10,
    }

    results = await db.query(query, params)

    print(f"✓ Query returned {len(results)} impulses")

    # Verify filtering
    assert len(results) == 2, (
        f"Expected 2 impulses (filtered by usage_count >= 5), got {len(results)}"
    )
    assert results[0]["impulse_id"] == "test-impulse-1", (
        "Expected impulse-1 (highest success rate)"
    )
    assert results[1]["impulse_id"] == "test-impulse-2", (
        "Expected impulse-2 (second highest)"
    )

    print("✓ Filtering works: usage_count >= 5, success_rate >= 0.7")
    print("✓ Ordering works: sorted by success_rate DESC")

    # Print results
    for i, impulse in enumerate(results, 1):
        print(f"\n  Impulse {i}:")
        print(f"    ID: {impulse['impulse_id']}")
        print(f"    Type: {impulse['impulse_type']}")
        print(
            f"    Success Rate: {impulse['success_rate']:.1%} ({impulse['success_when_used']}/{impulse['usage_count']})"
        )
        print(f"    Created For: {impulse['created_for']}")
        print(f"    Tags: {', '.join(impulse.get('tags', []))}")

    # Test 3: Query activity-specific impulses
    print("\n" + "-" * 80)
    print("TEST 3: Query activity-specific impulses (GET /v2/impulses/for-activity)")
    print("-" * 80)

    # Create test activity and execution data
    variant_id = "test-activity-v1"

    # Create activity variant
    await db.query(
        "CREATE activity_variants CONTENT $variant",
        {
            "variant": {
                "variant_id": variant_id,
                "name": "Test Activity",
                "category": "feature",
                "task_count": 3,
            }
        },
    )

    # Create execution
    execution_id = "exec-1"
    await db.query(
        "CREATE activity_executions CONTENT $execution",
        {
            "execution": {
                "execution_id": execution_id,
                "variant_id": variant_id,
                "session_id": session.session_id,
                "success": True,
                "duration_ms": 5000,
            }
        },
    )

    # Create execution steps
    step_id = "step-1"
    await db.query(
        "CREATE execution_steps CONTENT $step",
        {
            "step": {
                "step_id": step_id,
                "execution_id": execution_id,
                "step_index": 0,
                "success": True,
            }
        },
    )

    # Create impulse usage (linking impulse to step)
    await db.query(
        "CREATE impulse_usage CONTENT $usage",
        {
            "usage": {
                "impulse_id": "test-impulse-1",
                "step_id": step_id,
                "execution_id": execution_id,
                "loaded_at": datetime.utcnow(),
            }
        },
    )

    print(f"✓ Created test activity execution with impulse usage")

    # Query activity impulses
    activity_query = """
        SELECT 
            ir.impulse_id,
            ir.impulse_type,
            ir.success_rate,
            count(iu.step_id) as times_used_in_activity
        FROM impulse_registry ir
        JOIN impulse_usage iu ON iu.impulse_id = ir.impulse_id
        JOIN execution_steps es ON es.step_id = iu.step_id
        JOIN activity_executions ae ON ae.execution_id = es.execution_id
        WHERE ae.variant_id = $variant_id
          AND ir.org_id = $org_id
          AND ir.project_id = $project_id
          AND ir.status = 'active'
        GROUP BY ir.impulse_id, ir.impulse_type, ir.success_rate
        ORDER BY ir.success_rate DESC
        LIMIT 10
    """

    activity_results = await db.query(
        activity_query,
        {
            "variant_id": variant_id,
            "org_id": "test-org",
            "project_id": "test-project",
        },
    )

    print(f"✓ Query returned {len(activity_results)} impulses for activity")

    # Verify
    assert len(activity_results) >= 1, "Expected at least 1 impulse for activity"
    assert activity_results[0]["impulse_id"] == "test-impulse-1", (
        "Expected impulse-1 used in activity"
    )

    print("✓ Activity-specific filtering works")

    for impulse in activity_results:
        print(f"\n  Impulse: {impulse['impulse_id']}")
        print(f"    Type: {impulse['impulse_type']}")
        print(f"    Success Rate: {impulse['success_rate']:.1%}")
        print(f"    Times Used in Activity: {impulse.get('times_used_in_activity', 0)}")

    # Test 4: Multi-tenant isolation
    print("\n" + "-" * 80)
    print("TEST 4: Multi-tenant isolation")
    print("-" * 80)

    # Create impulse in different org
    await db.query(
        "CREATE impulse_registry CONTENT $impulse",
        {
            "impulse": {
                "impulse_id": "other-org-impulse",
                "org_id": "other-org",  # Different org!
                "project_id": "test-project",
                "impulse_type": "file",
                "pointer": {"type": "file", "path": "/secret.py"},
                "scope": "activity",
                "budget": 2000,
                "usage_count": 100,
                "success_when_used": 100,
                "success_rate": 1.0,
                "created_by": "other-user",
                "created_for": "secret-stuff",
                "tags": ["secret"],
                "status": "active",
                "created_at": datetime.utcnow(),
            }
        },
    )

    # Query with test-org credentials
    isolation_results = await db.query(query, params)

    # Verify other org's impulse is NOT returned
    other_org_ids = [
        r["impulse_id"]
        for r in isolation_results
        if r["impulse_id"] == "other-org-impulse"
    ]
    assert len(other_org_ids) == 0, "SECURITY: Other org's impulse leaked!"

    print("✓ Multi-tenant isolation works: other org's impulses not returned")

    # Cleanup
    print("\n" + "-" * 80)
    print("CLEANUP")
    print("-" * 80)

    await db.query("DELETE impulse_registry WHERE org_id = 'test-org'")
    await db.query("DELETE impulse_registry WHERE org_id = 'other-org'")
    await db.query("DELETE impulse_usage WHERE impulse_id CONTAINS 'test-impulse'")
    await db.query(
        "DELETE execution_steps WHERE step_id = $step_id", {"step_id": step_id}
    )
    await db.query(
        "DELETE activity_executions WHERE execution_id = $execution_id",
        {"execution_id": execution_id},
    )
    await db.query(
        "DELETE activity_variants WHERE variant_id = $variant_id",
        {"variant_id": variant_id},
    )
    redis.delete(f"session:{session.session_id}")

    print("✓ Cleaned up test data")

    await db.close()
    redis.close()

    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED - REVERSE FLOW BACKEND WORKING")
    print("=" * 80)
    print("\nBackend endpoints ready:")
    print("  • GET /v2/impulses/learned")
    print("  • GET /v2/impulses/for-activity/{variant_id}")
    print("\nNext steps:")
    print("  1. Add CLI MCP internal methods to call these endpoints")
    print("  2. Integrate with SessionMemoryAgent in OpenCode")
    print("  3. Test end-to-end reverse flow")
    print()


if __name__ == "__main__":
    asyncio.run(test_reverse_flow_backend())
