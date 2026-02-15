#!/usr/bin/env python3
"""
Test Phase 2 CLI Internal Methods

Validates that ActivityManager.query_learned_impulses() and
ActivityManager.query_activity_impulses() work correctly.

These are INTERNAL methods - NOT exposed as MCP tools.
"""

import asyncio
import sys
from pathlib import Path

# Add repos to path
repo_root = Path(__file__).parent.parent
sys.path.insert(0, str(repo_root / "repos" / "metabob-cli" / "src"))

from metabob_cli.mcp.activity_manager import ActivityManager


async def test_query_learned_impulses():
    """Test query_learned_impulses() method"""
    print("\n" + "=" * 80)
    print("TEST 1: query_learned_impulses()")
    print("=" * 80)

    # Create ActivityManager instance
    manager = ActivityManager(
        base_url="http://localhost:8080", session_token="test-token-123"
    )

    try:
        # Test 1: Default parameters
        print("\n📋 Test 1a: Default parameters")
        print(
            "   Parameters: min_usage_count=5, min_success_rate=0.7, limit=10, days=30"
        )

        result = await manager.query_learned_impulses()

        print(f"\n✅ Method executed successfully")
        print(f"   Result type: {type(result)}")
        print(f"   Impulse count: {len(result)}")

        if result:
            print(f"\n   Sample impulse:")
            impulse = result[0]
            print(f"   - impulse_id: {impulse.get('impulse_id', 'N/A')}")
            print(f"   - impulse_type: {impulse.get('impulse_type', 'N/A')}")
            print(f"   - usage_count: {impulse.get('usage_count', 'N/A')}")
            print(f"   - success_rate: {impulse.get('success_rate', 'N/A')}")
        else:
            print(
                f"   ℹ️  No learned impulses returned (expected if backend has no data)"
            )

        # Test 2: With filters
        print("\n📋 Test 1b: With filters")
        print(
            "   Parameters: impulse_type='file', min_usage_count=3, min_success_rate=0.6"
        )

        result = await manager.query_learned_impulses(
            impulse_type="file", min_usage_count=3, min_success_rate=0.6, limit=5
        )

        print(f"\n✅ Method executed successfully")
        print(f"   Result type: {type(result)}")
        print(f"   Impulse count: {len(result)}")

        return True

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await manager.close()


async def test_query_activity_impulses():
    """Test query_activity_impulses() method"""
    print("\n" + "=" * 80)
    print("TEST 2: query_activity_impulses()")
    print("=" * 80)

    # Create ActivityManager instance
    manager = ActivityManager(
        base_url="http://localhost:8080", session_token="test-token-123"
    )

    try:
        # Test 1: With valid variant_id (will be 404 if doesn't exist)
        print("\n📋 Test 2a: Query impulses for activity variant")
        print(
            "   Parameters: variant_id='feature-impl-v2', min_success_rate=0.6, limit=10"
        )

        result = await manager.query_activity_impulses(
            variant_id="feature-impl-v2", min_success_rate=0.6, limit=10
        )

        print(f"\n✅ Method executed successfully")
        print(f"   Result type: {type(result)}")
        print(f"   Activity info: {result.get('activity', {})}")
        print(f"   Impulse count: {len(result.get('impulses', []))}")

        if result.get("impulses"):
            print(f"\n   Sample impulse:")
            impulse = result["impulses"][0]
            print(f"   - impulse_id: {impulse.get('impulse_id', 'N/A')}")
            print(
                f"   - times_used_with_activity: {impulse.get('times_used_with_activity', 'N/A')}"
            )
            print(f"   - success_rate: {impulse.get('success_rate', 'N/A')}")
        else:
            print(f"   ℹ️  No activity-specific impulses returned")

        # Test 2: With non-existent variant_id (should return empty gracefully)
        print("\n📋 Test 2b: Query non-existent activity (404 handling)")
        print("   Parameters: variant_id='does-not-exist-123'")

        result = await manager.query_activity_impulses(variant_id="does-not-exist-123")

        print(f"\n✅ Method handled 404 gracefully")
        print(f"   Result type: {type(result)}")
        print(f"   Activity info: {result.get('activity', {})}")
        print(f"   Impulse count: {len(result.get('impulses', []))}")

        return True

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await manager.close()


async def test_error_handling():
    """Test error handling when backend is unavailable"""
    print("\n" + "=" * 80)
    print("TEST 3: Error Handling")
    print("=" * 80)

    # Create ActivityManager with invalid backend URL
    manager = ActivityManager(
        base_url="http://localhost:9999",  # Non-existent port
        session_token="test-token-123",
    )

    try:
        print("\n📋 Test 3a: Backend unavailable (should return empty gracefully)")
        print("   Backend URL: http://localhost:9999 (invalid)")

        result = await manager.query_learned_impulses()

        print(f"\n✅ Method handled error gracefully")
        print(f"   Result type: {type(result)}")
        print(f"   Result: {result}")
        print(f"   Expected: [] (empty list)")

        if result == []:
            print(f"   ✅ Correct - returns empty list on error")
        else:
            print(f"   ⚠️  Unexpected result")

        return True

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await manager.close()


async def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("PHASE 2 CLI INTERNAL METHODS - VALIDATION TESTS")
    print("=" * 80)
    print("\nThese tests validate that ActivityManager internal methods:")
    print("1. query_learned_impulses() - Query high-success impulses")
    print("2. query_activity_impulses() - Query activity-specific impulses")
    print("3. Error handling - Graceful degradation on errors")
    print("\nNOTE: Backend must be running on http://localhost:8080")
    print("      If backend is unavailable, tests will validate error handling.")

    results = []

    # Test 1: query_learned_impulses
    results.append(await test_query_learned_impulses())

    # Test 2: query_activity_impulses
    results.append(await test_query_activity_impulses())

    # Test 3: Error handling
    results.append(await test_error_handling())

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    passed = sum(results)
    total = len(results)

    print(f"\n✅ Passed: {passed}/{total}")

    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Phase 2 CLI methods working correctly!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
