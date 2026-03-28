#!/usr/bin/env python3
"""
Cross-Vessel Type Preservation Validation Harness

Tests type preservation across TypeScript → Python MCP → FastAPI → SurrealDB boundaries.

Validates:
1. Integer preservation (42 stays int, not "42")
2. Boolean preservation (True stays bool, not "true")
3. Float preservation (3.14 stays float, not "3.14")
4. String preservation
5. Array preservation with nested types
6. Nested object preservation with mixed types

Usage:
  python tests/validation-harnesses/cross-vessel-type-preservation-harness.py

Expected: All tests PASS with exact type and value matches
"""

import asyncio
import json
import random
import string
import sys
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
import aiohttp


@dataclass
class ValidationResult:
    """Result of a single validation test"""

    test_name: str
    passed: bool
    input_data: Dict[str, Any]
    expected_output: Dict[str, Any]
    actual_output: Optional[Dict[str, Any]]
    error: Optional[str] = None
    type_mismatches: Optional[List[str]] = None
    value_mismatches: Optional[List[str]] = None

    def __post_init__(self):
        if self.type_mismatches is None:
            self.type_mismatches = []
        if self.value_mismatches is None:
            self.value_mismatches = []


class HTTPClient:
    """HTTP client for testing RPC API endpoints"""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

    async def post(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """POST request to API"""
        url = f"{self.base_url}{path}"
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=self.headers) as resp:
                try:
                    response_data = await resp.json()
                except:
                    response_data = {"error": await resp.text()}
                return {"status": resp.status, "data": response_data}

    async def get(
        self, path: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """GET request to API"""
        url = f"{self.base_url}{path}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, headers=self.headers) as resp:
                try:
                    response_data = await resp.json()
                except:
                    response_data = {"error": await resp.text()}
                return {"status": resp.status, "data": response_data}


def generate_random_string(length: int = 20) -> str:
    """Generate random alphanumeric string"""
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def generate_test_data(case_name: str) -> Dict[str, Any]:
    """Generate test data for different validation cases"""

    if case_name == "basic_types":
        return {
            "int_field": 42,
            "bool_field": True,
            "float_field": 3.14,
            "string_field": "test_string",
            "null_field": None,
        }

    elif case_name == "edge_case_numbers":
        return {
            "zero": 0,
            "negative_int": -999,
            "large_int": 2147483647,
            "negative_float": -123.456,
            "very_small_float": 0.0000001,
            "bool_false": False,
        }

    elif case_name == "arrays":
        return {
            "int_array": [1, 2, 3, 42, 100],
            "bool_array": [True, False, True],
            "float_array": [1.1, 2.2, 3.14],
            "string_array": ["foo", "bar", "baz"],
            "mixed_array": [1, "two", 3.0, True, None],
        }

    elif case_name == "nested_objects":
        return {
            "level1": {
                "int_field": 100,
                "bool_field": False,
                "level2": {
                    "float_field": 99.99,
                    "string_field": "nested",
                    "level3": {"deep_int": 777, "deep_bool": True},
                },
            }
        }

    elif case_name == "complex_structure":
        return {
            "string_field": generate_random_string(),
            "int_field": random.randint(1, 1000),
            "float_field": round(random.uniform(0.1, 100.0), 2),
            "bool_field": random.choice([True, False]),
            "list_field": [generate_random_string(5) for _ in range(3)],
            "nested_field": {
                "inner_string": generate_random_string(10),
                "inner_int": random.randint(1, 100),
                "inner_bool": random.choice([True, False]),
                "inner_array": [random.randint(1, 10) for _ in range(3)],
            },
        }

    else:
        raise ValueError(f"Unknown test case: {case_name}")


def compare_values(
    original: Any, returned: Any, path: str = ""
) -> tuple[List[str], List[str]]:
    """
    Recursively compare original and returned values.
    Returns: (type_mismatches, value_mismatches)
    """
    type_mismatches = []
    value_mismatches = []

    # Check type preservation
    if type(returned) != type(original):
        type_mismatches.append(
            f"{path}: expected type {type(original).__name__}, got {type(returned).__name__}"
        )
        return type_mismatches, value_mismatches

    # Check value equality and recurse for complex types
    if isinstance(original, dict):
        for key, orig_val in original.items():
            curr_path = f"{path}.{key}" if path else key
            if key not in returned:
                value_mismatches.append(f"{curr_path}: missing in returned data")
                continue

            t_mis, v_mis = compare_values(orig_val, returned[key], curr_path)
            type_mismatches.extend(t_mis)
            value_mismatches.extend(v_mis)

    elif isinstance(original, list):
        if len(returned) != len(original):
            value_mismatches.append(
                f"{path}: array length mismatch (expected {len(original)}, got {len(returned)})"
            )
        else:
            for i, (orig_val, ret_val) in enumerate(zip(original, returned)):
                curr_path = f"{path}[{i}]"
                t_mis, v_mis = compare_values(orig_val, ret_val, curr_path)
                type_mismatches.extend(t_mis)
                value_mismatches.extend(v_mis)

    else:
        # Scalar value comparison
        if returned != original:
            value_mismatches.append(
                f"{path}: value mismatch (expected {original}, got {returned})"
            )

    return type_mismatches, value_mismatches


async def run_validation_test(
    client: HTTPClient, test_name: str, test_case: str, org_id: str, project_id: str
) -> ValidationResult:
    """
    Run a single validation test:
    1. Generate test data
    2. POST to /v2/impulses
    3. GET the impulse back
    4. Compare field-by-field
    """

    # Generate test data
    test_data = generate_test_data(test_case)
    # Use UUID + timestamp to ensure absolute uniqueness
    timestamp = int(datetime.now().timestamp() * 1000000)
    impulse_id = f"imp_{uuid.uuid4().hex[:12]}_{timestamp}"

    # Construct request payload
    request_payload = {
        "impulse_id": impulse_id,
        "org_id": org_id,
        "project_id": project_id,
        "impulse_data": {
            "id": impulse_id,
            "type": "testResults",
            "pointer": {"type": "testResults", "data": test_data},
            "budget": 1000,
            "priority": "high",
        },
    }

    try:
        # POST impulse
        create_resp = await client.post("/v2/impulses", request_payload)

        if create_resp["status"] not in [200, 201]:
            return ValidationResult(
                test_name=test_name,
                passed=False,
                input_data=test_data,
                expected_output=test_data,
                actual_output=None,
                error=f"POST failed with status {create_resp['status']}: {create_resp['data']}",
            )

        # GET impulse back
        get_resp = await client.get(
            f"/v2/impulses/{impulse_id}", {"org_id": org_id, "project_id": project_id}
        )

        if get_resp["status"] != 200:
            return ValidationResult(
                test_name=test_name,
                passed=False,
                input_data=test_data,
                expected_output=test_data,
                actual_output=None,
                error=f"GET failed with status {get_resp['status']}: {get_resp['data']}",
            )

        # Extract returned data
        impulse_response = get_resp["data"].get("impulse_data", {})
        pointer = impulse_response.get("pointer", {})
        returned_data = pointer.get("data", {})

        # Compare field-by-field
        type_mismatches, value_mismatches = compare_values(test_data, returned_data)

        passed = len(type_mismatches) == 0 and len(value_mismatches) == 0

        return ValidationResult(
            test_name=test_name,
            passed=passed,
            input_data=test_data,
            expected_output=test_data,
            actual_output=returned_data,
            type_mismatches=type_mismatches,
            value_mismatches=value_mismatches,
        )

    except Exception as e:
        return ValidationResult(
            test_name=test_name,
            passed=False,
            input_data=test_data,
            expected_output=test_data,
            actual_output=None,
            error=f"Exception: {str(e)}",
        )


async def main():
    """Run all validation tests"""
    print("=" * 80)
    print("Cross-Vessel Type Preservation Validation Harness")
    print("=" * 80)
    print()

    # Configuration
    API_BASE_URL = "http://api.metabob.local"
    API_KEY = "test-api-key"

    print(f"Target: {API_BASE_URL}")
    print(f"API Key: {API_KEY[:10]}...")
    print()

    # Initialize client
    client = HTTPClient(API_BASE_URL, API_KEY)

    # Generate unique org/project IDs for this test run
    org_id = f"test-org-{generate_random_string(8)}"
    project_id = f"test-project-{generate_random_string(8)}"

    print(f"Test Org: {org_id}")
    print(f"Test Project: {project_id}")
    print()

    # Define test cases
    test_cases = [
        ("Case 1: Basic Types", "basic_types"),
        ("Case 2: Edge Case Numbers", "edge_case_numbers"),
        ("Case 3: Arrays", "arrays"),
        ("Case 4: Nested Objects", "nested_objects"),
        ("Case 5: Complex Random Structure", "complex_structure"),
        ("Case 6: Complex Random Structure (Iteration 2)", "complex_structure"),
        ("Case 7: Complex Random Structure (Iteration 3)", "complex_structure"),
    ]

    print("Running validation tests...")
    print("-" * 80)

    results = []
    for test_name, test_case in test_cases:
        print(f"Running: {test_name}... ", end="", flush=True)
        result = await run_validation_test(
            client, test_name, test_case, org_id, project_id
        )
        results.append(result)

        if result.passed:
            print("✅ PASS")
        else:
            print("❌ FAIL")

    print()
    print("=" * 80)
    print("DETAILED REPORTS")
    print("=" * 80)

    for result in results:
        if result.passed:
            print(f"✅ PASS | {result.test_name}")
        else:
            print(f"❌ FAIL | {result.test_name}")
            if result.error:
                print(f"  Error: {result.error}")
            if result.type_mismatches:
                print(f"  Type Mismatches:")
                for mismatch in result.type_mismatches:
                    print(f"    - {mismatch}")
            if result.value_mismatches:
                print(f"  Value Mismatches:")
                for mismatch in result.value_mismatches:
                    print(f"    - {mismatch}")
        print()

    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    passed_count = sum(1 for r in results if r.passed)
    total_count = len(results)
    pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0

    print(f"Tests Passed: {passed_count}/{total_count} ({pass_rate:.1f}%)")
    print()

    if passed_count == total_count:
        print("✅ ALL TESTS PASSED - Type preservation working correctly!")
        return 0
    else:
        print("❌ SOME TESTS FAILED - Review type conversion issues above")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
