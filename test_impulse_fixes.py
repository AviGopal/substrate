#!/usr/bin/env python3
"""
Test script for impulse data quality fixes.

Tests the improvements made to activity_manager.py:
1. _generate_impulse_id() - No more "unknown" IDs
2. _estimate_impulse_tokens() - No more zero tokens
3. Database stores proper impulse metadata

Expected Results:
- Before: 60% "unknown" IDs, 60% zero tokens
- After: <10% "unknown" IDs, <10% zero tokens
"""

import asyncio
import sys
import json
from pathlib import Path

# Add metabob-cli to path
sys.path.insert(0, str(Path(__file__).parent / "repos" / "metabob-cli" / "src"))

from metabob_cli.mcp.activity_manager import ActivityManager


async def test_impulse_id_generation():
    """Test that impulse IDs are generated correctly."""
    print("\n" + "=" * 80)
    print("TEST 1: Impulse ID Generation")
    print("=" * 80)

    # Create manager and access private methods via instance
    manager = ActivityManager(base_url="http://localhost:8080", session_token="test")

    # Access private method (Python allows this for testing)
    generate_impulse_id = getattr(manager, "_generate_impulse_id")

    test_cases = [
        {
            "name": "Explicit ID",
            "impulse": {
                "id": "my-explicit-id",
                "pointer": {"type": "memo", "content": "test"},
            },
            "expected_pattern": "my-explicit-id",
        },
        {
            "name": "File pointer (no ID)",
            "impulse": {
                "pointer": {
                    "type": "file",
                    "path": "/test/file.py",
                    "content": "def foo(): pass",
                }
            },
            "expected_pattern": "file-",
        },
        {
            "name": "Memo pointer (no ID)",
            "impulse": {"pointer": {"type": "memo", "content": "This is a test memo"}},
            "expected_pattern": "memo-",
        },
        {
            "name": "Component pointer (no ID)",
            "impulse": {
                "pointer": {
                    "type": "component",
                    "name": "TestClass",
                    "code": "class TestClass: pass",
                }
            },
            "expected_pattern": "component-",
        },
        {
            "name": "Bash output (no ID)",
            "impulse": {
                "pointer": {
                    "type": "bashOutput",
                    "command": "ls -la",
                    "output": "total 42\n...",
                }
            },
            "expected_pattern": "bash-",
        },
        {
            "name": "Commit pointer (no ID)",
            "impulse": {
                "pointer": {
                    "type": "commit",
                    "sha": "abc123def456",
                    "message": "feat: test",
                }
            },
            "expected_pattern": "commit-abc123de",
        },
    ]

    results = {"pass": 0, "fail": 0}

    for test in test_cases:
        impulse_id = generate_impulse_id(test["impulse"])
        passed = impulse_id.startswith(test["expected_pattern"])
        status = "✅ PASS" if passed else "❌ FAIL"

        print(f"\n{status} | {test['name']}")
        print(f"  Generated ID: {impulse_id}")
        print(f"  Expected pattern: {test['expected_pattern']}*")

        if passed:
            results["pass"] += 1
        else:
            results["fail"] += 1

    print(f"\n{'=' * 80}")
    print(f"Results: {results['pass']}/{len(test_cases)} passed")
    print(f"{'=' * 80}")

    return results["fail"] == 0


async def test_impulse_token_estimation():
    """Test that token counts are estimated correctly."""
    print("\n" + "=" * 80)
    print("TEST 2: Token Estimation")
    print("=" * 80)

    manager = ActivityManager(base_url="http://localhost:8080", session_token="test")

    test_cases = [
        {
            "name": "Explicit tokens",
            "impulse": {
                "tokens_loaded": 500,
                "pointer": {"type": "memo", "content": "short"},
            },
            "expected": 500,
        },
        {
            "name": "File with content (estimate)",
            "impulse": {
                "pointer": {"type": "file", "path": "/test.py", "content": "x" * 400}
            },  # 400 chars = ~100 tokens
            "expected_min": 90,
            "expected_max": 110,
        },
        {
            "name": "Memo with content (estimate)",
            "impulse": {
                "pointer": {"type": "memo", "content": "Hello world! " * 50}
            },  # ~650 chars = ~162 tokens
            "expected_min": 150,
            "expected_max": 175,
        },
        {
            "name": "Empty content (edge case)",
            "impulse": {"pointer": {"type": "memo", "content": ""}},
            "expected": 0,
        },
        {
            "name": "Component with code",
            "impulse": {
                "pointer": {
                    "type": "component",
                    "name": "Test",
                    "code": "class Test:\n    pass\n" * 10,
                }
            },  # ~200 chars = ~50 tokens
            "expected_min": 40,
            "expected_max": 60,
        },
    ]

    results = {"pass": 0, "fail": 0}

    for test in test_cases:
        tokens = manager._estimate_impulse_tokens(test["impulse"])

        if "expected" in test:
            passed = tokens == test["expected"]
        else:
            passed = test["expected_min"] <= tokens <= test["expected_max"]

        status = "✅ PASS" if passed else "❌ FAIL"

        print(f"\n{status} | {test['name']}")
        print(f"  Estimated tokens: {tokens}")
        if "expected" in test:
            print(f"  Expected: {test['expected']}")
        else:
            print(f"  Expected range: {test['expected_min']}-{test['expected_max']}")

        if passed:
            results["pass"] += 1
        else:
            results["fail"] += 1

    print(f"\n{'=' * 80}")
    print(f"Results: {results['pass']}/{len(test_cases)} passed")
    print(f"{'=' * 80}")

    return results["fail"] == 0


async def test_database_improvement():
    """Query database and compare before/after metrics."""
    print("\n" + "=" * 80)
    print("TEST 3: Database Improvement Check")
    print("=" * 80)

    print("\n📊 Historical Baseline (from previous analysis):")
    print("  - Total records: 40")
    print("  - Unknown IDs: 24/40 (60%)")
    print("  - Zero tokens: 24/40 (60%)")
    print("  - Effectiveness: 40/40 (100% - not useful)")

    print("\n🔍 Current database state:")
    query = """
    import json
import sys

try:
    from surrealdb import Surreal

    async def query_db():
        async with Surreal("ws://localhost:8000/rpc") as db:
            await db.signin({"user": "root", "pass": "root"})
            await db.use("metabob", "production")
            
            # Get recent impulse_effectiveness records
            result = await db.query("SELECT * FROM impulse_effectiveness ORDER BY created_at DESC LIMIT 50;")
            records = result[0]["result"] if result and result[0]["status"] == "OK" else []
            
            # Analyze data quality
            total = len(records)
            unknown_ids = sum(1 for r in records if r.get("impulse_id") == "unknown")
            zero_tokens = sum(1 for r in records if r.get("tokens_used", 0) == 0)
            all_useful = sum(1 for r in records if r.get("was_useful") is True)
            
            print(json.dumps({
                "total": total,
                "unknown_ids": unknown_ids,
                "unknown_pct": round(unknown_ids / total * 100, 1) if total > 0 else 0,
                "zero_tokens": zero_tokens,
                "zero_tokens_pct": round(zero_tokens / total * 100, 1) if total > 0 else 0,
                "all_useful": all_useful,
                "all_useful_pct": round(all_useful / total * 100, 1) if total > 0 else 0
            }, indent=2))
    
    import asyncio
    asyncio.run(query_db())
    
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
"""

    import subprocess

    try:
        result = subprocess.run(
            ["docker", "exec", "metabob-rpc-api-server-dev-1", "python3", "-c", query],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode == 0:
            data = json.loads(result.stdout)
            print(f"  ✅ Query successful")
            print(f"  - Total records: {data['total']}")
            print(
                f"  - Unknown IDs: {data['unknown_ids']}/{data['total']} ({data['unknown_pct']}%)"
            )
            print(
                f"  - Zero tokens: {data['zero_tokens']}/{data['total']} ({data['zero_tokens_pct']}%)"
            )
            print(
                f"  - All useful: {data['all_useful']}/{data['total']} ({data['all_useful_pct']}%)"
            )

            print(f"\n📈 Improvement Metrics:")
            baseline_unknown = 60.0
            baseline_zero = 60.0
            improvement_unknown = baseline_unknown - data["unknown_pct"]
            improvement_zero = baseline_zero - data["zero_tokens_pct"]

            print(f"  - Unknown IDs: {improvement_unknown:+.1f}% improvement")
            print(f"  - Zero tokens: {improvement_zero:+.1f}% improvement")

            # Success criteria: <10% unknown IDs and zero tokens
            success = data["unknown_pct"] < 10.0 and data["zero_tokens_pct"] < 10.0

            if success:
                print(f"\n✅ SUCCESS: Data quality improved significantly!")
            else:
                print(
                    f"\n⚠️  NEEDS MORE DATA: Run test activity to generate new records with fixes"
                )

            return success
        else:
            print(f"  ❌ Query failed: {result.stderr}")
            return False

    except subprocess.TimeoutExpired:
        print(f"  ❌ Query timeout")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


async def main():
    """Run all tests."""
    print("\n" + "=" * 80)
    print("IMPULSE DATA QUALITY FIXES - VALIDATION TEST")
    print("=" * 80)
    print("\nThis test validates the fixes made to activity_manager.py:")
    print("  1. _generate_impulse_id() - No more 'unknown' IDs")
    print("  2. _estimate_impulse_tokens() - No more zero tokens")
    print("  3. Database stores proper impulse metadata")

    results = []

    # Test 1: ID generation
    results.append(await test_impulse_id_generation())

    # Test 2: Token estimation
    results.append(await test_impulse_token_estimation())

    # Test 3: Database improvement (may need new data)
    results.append(await test_database_improvement())

    # Summary
    print("\n" + "=" * 80)
    print("FINAL RESULTS")
    print("=" * 80)
    passed = sum(results)
    total = len(results)
    print(f"\n{passed}/{total} test suites passed")

    if passed == total:
        print("\n✅ ALL TESTS PASSED - Fixes are working correctly!")
    elif passed >= 2:
        print(
            "\n⚠️  MOSTLY PASSING - May need to run activity to generate new DB records"
        )
    else:
        print("\n❌ TESTS FAILED - Review implementation")

    print("\n" + "=" * 80)

    return passed == total


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
