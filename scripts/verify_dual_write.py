#!/usr/bin/env python3
"""Verify dual-write functionality is working."""

import sys


def main():
    print("🔍 Verifying Dual-Write Functionality\n")
    print("=" * 60)

    from server.db.surrealdb_client import get_surreal_client

    db = get_surreal_client()

    # 1. Check for test execution
    print("\n1. Checking for test execution...")
    result = db.query(
        "SELECT * FROM activity_execution WHERE variant_id = 'test-dual-write-v2-xyz789';"
    )

    if result and len(result) > 0:
        print(f"   ✅ Found {len(result)} test execution(s)")
        for record in result:
            print(f"      - execution_id: {record.get('execution_id')}")
            print(f"        success: {record.get('success')}")
            print(f"        cost: ${record.get('cost_usd')}")
            print(f"        duration: {record.get('duration_ms')}ms")
            print(
                f"        tokens: input={record.get('tokens_input')}, output={record.get('tokens_output')}"
            )
    else:
        print("   ❌ No test execution found")
        return 1

    # 2. Check total executions
    print("\n2. Checking total executions...")
    count_result = db.query("SELECT count() FROM activity_execution GROUP ALL;")
    if count_result and len(count_result) > 0:
        count = count_result[0].get("count", 0)
        print(f"   ✅ Total executions in DB: {count}")
    else:
        print("   ⚠️  Could not get count")

    # 3. Check template metrics
    print("\n3. Checking template metrics...")
    metrics_result = db.query(
        "SELECT * FROM template_metrics WHERE variant_id = 'test-dual-write-v2-xyz789';"
    )

    if metrics_result and len(metrics_result) > 0:
        print(f"   ✅ Found metrics")
        for metric in metrics_result:
            alpha = metric.get("thompson_alpha", 1)
            beta = metric.get("thompson_beta", 1)
            success_rate = alpha / (alpha + beta) * 100
            print(f"      - Success rate: {success_rate:.1f}%")
            print(f"      - Executions: {metric.get('total_selections', 0)}")
            print(f"      - Successes: {metric.get('total_successes', 0)}")
            print(f"      - Failures: {metric.get('total_failures', 0)}")
            print(f"      - Thompson: α={alpha}, β={beta}")
    else:
        print("   ❌ No metrics found")
        return 1

    # 4. Verify Redis
    print("\n4. Checking Redis cache...")
    import redis
    from server.config import settings

    config = settings()
    r = redis.from_url(config.REDIS_URI)

    redis_metrics = r.get("activity:metrics:test-dual-write-v2-xyz789")
    if redis_metrics:
        print("   ✅ Found in Redis cache")
        import json

        data = json.loads(redis_metrics)
        print(
            f"      - Thompson: α={data.get('thompson_alpha')}, β={data.get('thompson_beta')}"
        )
    else:
        print("   ❌ Not found in Redis")
        return 1

    print("\n" + "=" * 60)
    print("✅ DUAL-WRITE VERIFICATION SUCCESSFUL!")
    print("\nBoth Redis (cache) and SurrealDB (primary storage) are working!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
