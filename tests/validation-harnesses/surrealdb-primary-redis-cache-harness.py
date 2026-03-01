#!/usr/bin/env python3
"""
Validation Harness: surrealdb-primary-redis-cache

This harness validates that:
1. Write path: SurrealDB is written FIRST, then Redis cache is updated
2. Read path: Redis checked first, SurrealDB fallback, then Redis populated
3. Cache invalidation: Redis cache is updated after SurrealDB writes
4. Failure handling: SurrealDB write failure prevents Redis write

Strategy:
- Instrument record_execution_result with execution order tracking
- Verify SurrealDB write happens before Redis write
- Verify cache-aside pattern in list_templates and get_template_by_id
- Check that cache failure is non-fatal

Test Cases:
1. Write path validation (record_execution_result)
2. Read path validation with cache hit (list_templates)
3. Read path validation with cache miss (list_templates)
4. Cache population after SurrealDB read
5. SurrealDB write failure aborts Redis write
"""

import sys
import json
import time
from typing import Dict, Any, List, Tuple
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock, call
from contextlib import contextmanager

# Test case definitions
TEST_CASES = [
    {
        "id": "validation-surrealdb-primary-redis-cache-case-1",
        "name": "Write Path: SurrealDB First, Then Redis Cache",
        "description": "Verify record_execution_result writes to SurrealDB before Redis",
        "input": {
            "variant_id": "test-template-v1",
            "success": True,
            "cost": 0.05,
            "duration_ms": 1500,
            "tokens": {"input": 100, "output": 50, "cache": 0},
        },
        "expectedBehavior": {
            "writeOrder": [
                "SurrealDB.insert_execution",
                "SurrealDB.update_metrics",
                "SurrealDB.get_metrics",
                "Redis.set",
            ],
            "redisWriteAfterSurrealDB": True,
            "cacheFailureNonFatal": True,
        },
    },
    {
        "id": "validation-surrealdb-primary-redis-cache-case-2",
        "name": "Read Path: Cache Hit (Redis Only)",
        "description": "Verify list_templates uses Redis cache when available",
        "input": {"cache_populated": True},
        "expectedBehavior": {
            "readOrder": ["Redis.get"],
            "surrealDBNotCalled": True,
            "cacheHit": True,
        },
    },
    {
        "id": "validation-surrealdb-primary-redis-cache-case-3",
        "name": "Read Path: Cache Miss (SurrealDB Fallback)",
        "description": "Verify list_templates falls back to SurrealDB on cache miss",
        "input": {"cache_populated": False},
        "expectedBehavior": {
            "readOrder": ["Redis.get", "SurrealDB.list_all_templates", "Redis.set"],
            "cacheMiss": True,
            "cachePopulated": True,
        },
    },
    {
        "id": "validation-surrealdb-primary-redis-cache-case-4",
        "name": "Write Path: SurrealDB Failure Aborts Redis Write",
        "description": "Verify SurrealDB write failure prevents Redis cache update",
        "input": {
            "variant_id": "test-template-v1",
            "success": True,
            "cost": 0.05,
            "duration_ms": 1500,
            "tokens": {"input": 100, "output": 50, "cache": 0},
            "surrealdb_fail": True,
        },
        "expectedBehavior": {
            "surrealDBWriteAttempted": True,
            "redisWriteNotAttempted": True,
            "exceptionRaised": True,
        },
    },
    {
        "id": "validation-surrealdb-primary-redis-cache-case-5",
        "name": "Write Path: Redis Cache Failure is Non-Fatal",
        "description": "Verify Redis cache failure after SurrealDB success is logged but doesn't fail",
        "input": {
            "variant_id": "test-template-v1",
            "success": True,
            "cost": 0.05,
            "duration_ms": 1500,
            "tokens": {"input": 100, "output": 50, "cache": 0},
            "redis_fail": True,
        },
        "expectedBehavior": {
            "surrealDBWriteSucceeded": True,
            "redisWriteAttempted": True,
            "redisWriteFailed": True,
            "exceptionNotRaised": True,
        },
    },
]


class ExecutionOrderTracker:
    """Track execution order of database operations"""

    def __init__(self):
        self.operations = []
        self.start_time = time.time()

    def record(self, operation: str):
        """Record an operation with timestamp"""
        elapsed = time.time() - self.start_time
        self.operations.append({"operation": operation, "timestamp": elapsed})

    def get_order(self) -> List[str]:
        """Get operations in order"""
        return [op["operation"] for op in self.operations]

    def verify_order(self, expected_order: List[str]) -> bool:
        """Verify operations occurred in expected order"""
        actual = self.get_order()
        # Check if expected operations appear in order (may have other operations in between)
        expected_idx = 0
        for op in actual:
            if (
                expected_idx < len(expected_order)
                and op == expected_order[expected_idx]
            ):
                expected_idx += 1
        return expected_idx == len(expected_order)


def run_test_case_1(test_case: Dict[str, Any]) -> Dict[str, Any]:
    """Test Case 1: Write Path - SurrealDB First, Then Redis Cache"""
    tracker = ExecutionOrderTracker()

    # Mock dependencies
    mock_redis = MagicMock()
    mock_insert_execution = MagicMock()
    mock_update_metrics = MagicMock()
    mock_get_metrics = MagicMock(
        return_value={
            "total_executions": 10,
            "total_successes": 8,
            "total_failures": 2,
            "avg_cost_usd": 0.05,
            "avg_duration_ms": 1500.0,
        }
    )

    # Track operations
    def track_insert_execution(*args, **kwargs):
        tracker.record("SurrealDB.insert_execution")
        return mock_insert_execution(*args, **kwargs)

    def track_update_metrics(*args, **kwargs):
        tracker.record("SurrealDB.update_metrics")
        return mock_update_metrics(*args, **kwargs)

    def track_get_metrics(*args, **kwargs):
        tracker.record("SurrealDB.get_metrics")
        return mock_get_metrics(*args, **kwargs)

    def track_redis_set(*args, **kwargs):
        tracker.record("Redis.set")
        return mock_redis.set(*args, **kwargs)

    # Patch the actual functions
    with (
        patch(
            "server.db.operations.activity_execution.insert_execution",
            side_effect=track_insert_execution,
        ),
        patch(
            "server.db.operations.template_metrics.update_metrics_after_execution",
            side_effect=track_update_metrics,
        ),
        patch(
            "server.db.operations.template_metrics.get_metrics",
            side_effect=track_get_metrics,
        ),
    ):
        mock_redis.set = track_redis_set

        try:
            # Import after patching
            from server.actions.activity import record_execution_result

            # Execute
            result = record_execution_result(mock_redis, test_case["input"])

            # Verify execution order
            actual_order = tracker.get_order()
            expected_order = test_case["expectedBehavior"]["writeOrder"]

            order_correct = tracker.verify_order(expected_order)

            # Verify SurrealDB write happened before Redis write
            redis_set_idx = None
            surrealdb_insert_idx = None
            for idx, op in enumerate(actual_order):
                if op == "Redis.set":
                    redis_set_idx = idx
                if op == "SurrealDB.insert_execution":
                    surrealdb_insert_idx = idx

            surrealdb_first = (
                surrealdb_insert_idx is not None
                and redis_set_idx is not None
                and surrealdb_insert_idx < redis_set_idx
            )

            return {
                "pass": order_correct and surrealdb_first,
                "actual": {
                    "executionOrder": actual_order,
                    "surrealDBFirst": surrealdb_first,
                },
                "expected": test_case["expectedBehavior"],
                "details": {
                    "orderCorrect": order_correct,
                    "surrealDBBeforeRedis": surrealdb_first,
                },
            }

        except Exception as e:
            return {
                "pass": False,
                "actual": {"error": str(e)},
                "expected": test_case["expectedBehavior"],
                "details": {"exception": str(e)},
            }


def run_test_case_4(test_case: Dict[str, Any]) -> Dict[str, Any]:
    """Test Case 4: SurrealDB Failure Aborts Redis Write"""
    tracker = ExecutionOrderTracker()

    # Mock dependencies
    mock_redis = MagicMock()

    # Track operations
    def track_insert_execution(*args, **kwargs):
        tracker.record("SurrealDB.insert_execution")
        raise Exception("SurrealDB write failed (simulated)")

    def track_redis_set(*args, **kwargs):
        tracker.record("Redis.set")
        return None

    # Patch the actual functions
    with patch(
        "server.db.operations.activity_execution.insert_execution",
        side_effect=track_insert_execution,
    ):
        mock_redis.set = track_redis_set

        try:
            # Import after patching
            from server.actions.activity import record_execution_result

            # Execute - should raise exception
            result = record_execution_result(mock_redis, test_case["input"])

            # Should not reach here
            return {
                "pass": False,
                "actual": {
                    "exceptionRaised": False,
                    "executionOrder": tracker.get_order(),
                },
                "expected": test_case["expectedBehavior"],
                "details": {"error": "Expected exception was not raised"},
            }

        except Exception as e:
            # Expected exception
            actual_order = tracker.get_order()
            redis_called = "Redis.set" in actual_order
            surrealdb_called = "SurrealDB.insert_execution" in actual_order

            # Success if SurrealDB was called but Redis was NOT called
            return {
                "pass": surrealdb_called and not redis_called,
                "actual": {
                    "exceptionRaised": True,
                    "surrealDBWriteAttempted": surrealdb_called,
                    "redisWriteNotAttempted": not redis_called,
                    "executionOrder": actual_order,
                },
                "expected": test_case["expectedBehavior"],
                "details": {
                    "exceptionMessage": str(e),
                    "redisCorrectlySkipped": not redis_called,
                },
            }


def run_test_case_5(test_case: Dict[str, Any]) -> Dict[str, Any]:
    """Test Case 5: Redis Cache Failure is Non-Fatal"""
    tracker = ExecutionOrderTracker()

    # Mock dependencies
    mock_redis = MagicMock()
    mock_insert_execution = MagicMock()
    mock_update_metrics = MagicMock()
    mock_get_metrics = MagicMock(
        return_value={
            "total_executions": 10,
            "total_successes": 8,
            "total_failures": 2,
            "avg_cost_usd": 0.05,
            "avg_duration_ms": 1500.0,
        }
    )

    # Track operations
    def track_insert_execution(*args, **kwargs):
        tracker.record("SurrealDB.insert_execution")
        return mock_insert_execution(*args, **kwargs)

    def track_update_metrics(*args, **kwargs):
        tracker.record("SurrealDB.update_metrics")
        return mock_update_metrics(*args, **kwargs)

    def track_get_metrics(*args, **kwargs):
        tracker.record("SurrealDB.get_metrics")
        return mock_get_metrics(*args, **kwargs)

    def track_redis_set(*args, **kwargs):
        tracker.record("Redis.set")
        raise Exception("Redis write failed (simulated)")

    # Patch the actual functions
    with (
        patch(
            "server.db.operations.activity_execution.insert_execution",
            side_effect=track_insert_execution,
        ),
        patch(
            "server.db.operations.template_metrics.update_metrics_after_execution",
            side_effect=track_update_metrics,
        ),
        patch(
            "server.db.operations.template_metrics.get_metrics",
            side_effect=track_get_metrics,
        ),
    ):
        mock_redis.set = track_redis_set

        try:
            # Import after patching
            from server.actions.activity import record_execution_result

            # Execute - should NOT raise exception (Redis failure is non-fatal)
            result = record_execution_result(mock_redis, test_case["input"])

            actual_order = tracker.get_order()
            surrealdb_called = "SurrealDB.insert_execution" in actual_order
            redis_called = "Redis.set" in actual_order

            # Success if both were called (Redis failure is non-fatal)
            return {
                "pass": surrealdb_called and redis_called,
                "actual": {
                    "exceptionNotRaised": True,
                    "surrealDBWriteSucceeded": surrealdb_called,
                    "redisWriteAttempted": redis_called,
                    "redisWriteFailed": True,
                    "executionOrder": actual_order,
                },
                "expected": test_case["expectedBehavior"],
                "details": {"redisCacheFailureNonFatal": True},
            }

        except Exception as e:
            # Should not reach here - Redis failure should be non-fatal
            return {
                "pass": False,
                "actual": {
                    "exceptionRaised": True,
                    "error": str(e),
                    "executionOrder": tracker.get_order(),
                },
                "expected": test_case["expectedBehavior"],
                "details": {"error": "Redis cache failure should be non-fatal"},
            }


def run_validation(test_case_id: str = None) -> Dict[str, Any]:
    """
    Run validation harness for surrealdb-primary-redis-cache specification.

    Args:
        test_case_id: Specific test case ID to run (or None to run all)

    Returns:
        {
            "specificationName": "surrealdb-primary-redis-cache",
            "timestamp": "2024-02-28T...",
            "results": [
                {
                    "testCaseId": "...",
                    "testCaseName": "...",
                    "pass": True/False,
                    "actual": {...},
                    "expected": {...},
                    "details": {...}
                }
            ],
            "summary": {
                "total": 5,
                "passed": 4,
                "failed": 1,
                "passRate": "80%"
            }
        }
    """

    results = []

    # Filter test cases
    test_cases_to_run = TEST_CASES
    if test_case_id:
        test_cases_to_run = [tc for tc in TEST_CASES if tc["id"] == test_case_id]

    # Run each test case
    for test_case in test_cases_to_run:
        print(f"\n{'=' * 80}")
        print(f"Running: {test_case['name']}")
        print(f"Description: {test_case['description']}")
        print(f"{'=' * 80}")

        try:
            # Route to appropriate test runner
            if test_case["id"] == "validation-surrealdb-primary-redis-cache-case-1":
                result = run_test_case_1(test_case)
            elif test_case["id"] == "validation-surrealdb-primary-redis-cache-case-4":
                result = run_test_case_4(test_case)
            elif test_case["id"] == "validation-surrealdb-primary-redis-cache-case-5":
                result = run_test_case_5(test_case)
            else:
                # Placeholder for other test cases
                result = {
                    "pass": None,
                    "actual": {"status": "NOT_IMPLEMENTED"},
                    "expected": test_case["expectedBehavior"],
                    "details": {"message": "Test case not yet implemented"},
                }

            result["testCaseId"] = test_case["id"]
            result["testCaseName"] = test_case["name"]
            results.append(result)

            # Print result
            status = (
                "✅ PASS"
                if result["pass"]
                else "❌ FAIL"
                if result["pass"] is False
                else "⚠️  SKIPPED"
            )
            print(f"\nResult: {status}")
            print(f"Details: {json.dumps(result['details'], indent=2)}")

        except Exception as e:
            results.append(
                {
                    "testCaseId": test_case["id"],
                    "testCaseName": test_case["name"],
                    "pass": False,
                    "actual": {"error": str(e)},
                    "expected": test_case["expectedBehavior"],
                    "details": {"exception": str(e)},
                }
            )
            print(f"\n❌ FAIL: Unexpected exception: {e}")

    # Calculate summary
    total = len(results)
    passed = sum(1 for r in results if r["pass"] is True)
    failed = sum(1 for r in results if r["pass"] is False)
    skipped = sum(1 for r in results if r["pass"] is None)
    pass_rate = f"{(passed / total * 100):.1f}%" if total > 0 else "0%"

    return {
        "specificationName": "surrealdb-primary-redis-cache",
        "timestamp": datetime.utcnow().isoformat(),
        "results": results,
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "passRate": pass_rate,
        },
    }


if __name__ == "__main__":
    # Run validation
    test_case_id = sys.argv[1] if len(sys.argv) > 1 else None

    result = run_validation(test_case_id)

    print("\n" + "=" * 80)
    print("VALIDATION SUMMARY")
    print("=" * 80)
    print(json.dumps(result["summary"], indent=2))

    # Exit with appropriate code
    sys.exit(0 if result["summary"]["failed"] == 0 else 1)
