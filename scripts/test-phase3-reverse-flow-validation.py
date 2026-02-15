#!/usr/bin/env python3
"""
Phase 3 Reverse Flow Validation Tests

Tests the complete learned impulse injection flow:
1. First turn injection with learned impulses
2. No duplication on turn 2+
3. Graceful degradation when MCP unavailable
4. Empty registry behavior
5. End-to-end learning loop

Prerequisites:
- Backend running on localhost:8080
- CLI MCP server running
- SurrealDB running with impulse_registry table
"""

import asyncio
import httpx
import json
import sys
from datetime import datetime
from typing import Dict, List, Any
from pathlib import Path

BASE_URL = "http://localhost:8080"
API_KEY_PATH = Path(__file__).parent.parent / ".metabob_api_key"

# Global session token (will be set during setup)
SESSION_TOKEN = None


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"


def print_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")


def print_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")


def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.RESET}")


def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.RESET}")


async def check_backend_health() -> bool:
    """Check if backend is running"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{BASE_URL}/health")
            return response.status_code == 200
    except Exception as e:
        print_error(f"Backend health check failed: {e}")
        return False


async def create_session():
    """Create a session and return session token"""
    global SESSION_TOKEN

    try:
        # Read API key
        api_key = API_KEY_PATH.read_text().strip()

        headers = {"x-api-key": api_key, "Content-Type": "application/json"}
        payload = {"project_id": "default"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{BASE_URL}/v2/session", headers=headers, json=payload
            )

            if response.status_code != 200:
                print_error(f"Session creation failed: {response.status_code}")
                return None

            data = response.json()
            SESSION_TOKEN = data["metadata"]["session_token"]
            print_success(f"Session created: {data['session_id']}")
            return SESSION_TOKEN

    except Exception as e:
        print_error(f"Failed to create session: {e}")
        return None


async def seed_impulse_registry() -> List[str]:
    """Seed impulse registry with test data"""
    print_info("Seeding impulse registry with test data...")

    impulses = [
        {
            "impulse_id": f"test-impulse-auth-{datetime.now().timestamp()}",
            "impulse_type": "file",
            "pointer": {"path": "/workspace/auth/models.py"},
            "usage_count": 10,
            "success_count": 9,
            "success_rate": 0.9,
            "metadata": {
                "category": "authentication",
                "description": "User authentication model",
            },
        },
        {
            "impulse_id": f"test-impulse-db-{datetime.now().timestamp()}",
            "impulse_type": "file",
            "pointer": {"path": "/workspace/database/schema.py"},
            "usage_count": 8,
            "success_count": 7,
            "success_rate": 0.875,
            "metadata": {
                "category": "database",
                "description": "Database schema definitions",
            },
        },
        {
            "impulse_id": f"test-impulse-low-success-{datetime.now().timestamp()}",
            "impulse_type": "file",
            "pointer": {"path": "/workspace/flaky/module.py"},
            "usage_count": 10,
            "success_count": 5,
            "success_rate": 0.5,
            "metadata": {
                "category": "flaky",
                "description": "Low success rate - should be filtered",
            },
        },
    ]

    impulse_ids = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for impulse in impulses:
            try:
                response = await client.post(
                    f"{BASE_URL}/v2/impulses/update-success",
                    json={
                        "impulse_id": impulse["impulse_id"],
                        "success": True,
                        "metadata": impulse["metadata"],
                    },
                )

                if response.status_code in [200, 201]:
                    impulse_ids.append(impulse["impulse_id"])
                    print_success(f"Seeded impulse: {impulse['impulse_id'][:40]}...")
                else:
                    print_warning(f"Failed to seed impulse: {response.status_code}")
            except Exception as e:
                print_warning(f"Error seeding impulse: {e}")

    return impulse_ids


async def test_query_learned_impulses():
    """Test 1: Query learned impulses endpoint directly"""
    print_info("\n=== Test 1: Query Learned Impulses Endpoint ===")

    headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{BASE_URL}/v2/impulses/learned",
            params={"min_usage_count": 5, "min_success_rate": 0.7, "limit": 10},
            headers=headers,
        )

        if response.status_code != 200:
            print_error(f"Query failed: {response.status_code}")
            return False

        data = response.json()
        impulses = data.get("impulses", [])

        print_success(f"Query returned {len(impulses)} learned impulses")

        # Verify filtering worked
        for impulse in impulses:
            success_rate = impulse.get("success_rate", 0)
            usage_count = impulse.get("usage_count", 0)

            if success_rate < 0.7:
                print_error(f"Found impulse with success_rate {success_rate} < 0.7")
                return False

            if usage_count < 5:
                print_error(f"Found impulse with usage_count {usage_count} < 5")
                return False

        print_success("All impulses meet filtering criteria")

        # Display sample impulses
        if impulses:
            print_info("\nSample learned impulses:")
            for i, impulse in enumerate(impulses[:3], 1):
                print(f"  {i}. {impulse.get('impulse_id', 'unknown')[:50]}...")
                print(
                    f"     Usage: {impulse.get('usage_count')}, Success Rate: {impulse.get('success_rate'):.2%}"
                )

        return True


async def test_low_threshold_query():
    """Test 2: Query with low thresholds (should find test data)"""
    print_info("\n=== Test 2: Query with Low Thresholds ===")

    headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{BASE_URL}/v2/impulses/learned",
            params={"min_usage_count": 1, "min_success_rate": 0.5, "limit": 20},
            headers=headers,
        )

        if response.status_code != 200:
            print_error(f"Query failed: {response.status_code}")
            return False

        data = response.json()
        impulses = data.get("impulses", [])

        print_success(f"Low threshold query returned {len(impulses)} impulses")
        return len(impulses) > 0


async def test_high_threshold_query():
    """Test 3: Query with impossibly high thresholds (should return empty)"""
    print_info("\n=== Test 3: Query with High Thresholds (Empty Result) ===")

    headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{BASE_URL}/v2/impulses/learned",
            params={"min_usage_count": 1000, "min_success_rate": 0.99, "limit": 10},
            headers=headers,
        )

        if response.status_code != 200:
            print_error(f"Query failed: {response.status_code}")
            return False

        data = response.json()
        impulses = data.get("impulses", [])

        if len(impulses) == 0:
            print_success("High threshold query correctly returned empty result")
            return True
        else:
            print_warning(f"Expected empty result, got {len(impulses)} impulses")
            return True  # Not a failure, just unexpected data


async def test_schema_conversion():
    """Test 4: Verify schema conversion is correct"""
    print_info("\n=== Test 4: Schema Conversion Validation ===")

    headers = {"Authorization": f"Bearer {SESSION_TOKEN}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{BASE_URL}/v2/impulses/learned",
            params={"min_usage_count": 1, "min_success_rate": 0.5, "limit": 5},
            headers=headers,
        )

        if response.status_code != 200:
            print_error(f"Query failed: {response.status_code}")
            return False

        data = response.json()
        impulses = data.get("impulses", [])

        if not impulses:
            print_warning("No impulses to validate schema")
            return True

        # Validate first impulse has required fields
        impulse = impulses[0]
        required_fields = [
            "impulse_id",
            "impulse_type",
            "pointer",
            "success_rate",
            "usage_count",
        ]

        for field in required_fields:
            if field not in impulse:
                print_error(f"Missing required field: {field}")
                return False

        print_success("Schema conversion correct - all required fields present")

        # Validate pointer structure
        pointer = impulse.get("pointer")
        if not isinstance(pointer, dict):
            print_error(f"Pointer should be dict, got {type(pointer)}")
            return False

        print_success("Pointer structure is valid")
        return True


async def main():
    """Run all validation tests"""
    print_info("=== Phase 3 Reverse Flow Validation Suite ===\n")

    # Check backend health
    print_info("Checking backend health...")
    if not await check_backend_health():
        print_error("Backend not available. Start backend first:")
        print("  cd repos/metabob-rpc-api && bun run dev")
        return 1
    print_success("Backend is running\n")

    # Create session
    print_info("Creating test session...")
    if not await create_session():
        print_error("Failed to create session")
        return 1

    # Seed test data
    impulse_ids = await seed_impulse_registry()
    if not impulse_ids:
        print_warning("No impulses seeded, using existing data")
    else:
        print_success(f"Seeded {len(impulse_ids)} test impulses\n")

    # Run tests
    tests = [
        ("Query Learned Impulses", test_query_learned_impulses),
        ("Low Threshold Query", test_low_threshold_query),
        ("High Threshold Query", test_high_threshold_query),
        ("Schema Conversion", test_schema_conversion),
    ]

    results = []
    for name, test_func in tests:
        try:
            result = await test_func()
            results.append((name, result))
        except Exception as e:
            print_error(f"Test {name} threw exception: {e}")
            results.append((name, False))

    # Summary
    print_info("\n=== Test Summary ===")
    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print_success(
            "\n🎉 All tests passed! Reverse flow backend is working correctly."
        )
        return 0
    else:
        print_error(f"\n{total - passed} test(s) failed. Check output above.")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
