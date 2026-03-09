#!/usr/bin/env python3
"""
Unified Output Validator - Deterministic Container Testing Framework

This module provides a single, deterministic validation framework that:
1. Loads expected outputs from impulses (not hardcoded values)
2. Executes test commands (HTTP, kubectl, bash, Python scripts)
3. Parses actual outputs (JSON, text, exit codes)
4. Compares outputs using deterministic assertions (===, !==, >, <, .includes(), regex.test())
5. Returns structured results with exact diffs

ZERO LLM DEPENDENCY - All validations are boolean assertions on actual data.

Usage:
    python unified-output-validator.py --test-suite <suite_name> --expected-impulse <impulse_id>
    python unified-output-validator.py --test <test_name> --expected <expected.json>
"""

import argparse
import json
import subprocess
import sys
import re
import os
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, asdict
from pathlib import Path
import requests
from datetime import datetime


@dataclass
class TestResult:
    """Structured test result with deterministic pass/fail"""

    test_name: str
    passed: bool
    expected: Any
    actual: Any
    diff: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()


@dataclass
class ValidationSummary:
    """Aggregated validation results"""

    total_tests: int
    passed: int
    failed: int
    test_results: List[TestResult]
    duration_ms: float
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.utcnow().isoformat()


class ImpulseLoader:
    """Load expected outputs from impulse files"""

    def __init__(self, impulse_dir: Optional[str] = None):
        self.impulse_dir = impulse_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "impulses"
        )

    def load_expected_output(self, impulse_id: str) -> Dict[str, Any]:
        """Load expected output from impulse file"""
        impulse_path = Path(self.impulse_dir) / f"{impulse_id}.json"

        if not impulse_path.exists():
            raise FileNotFoundError(f"Impulse not found: {impulse_path}")

        with open(impulse_path, "r") as f:
            impulse_data = json.load(f)

        # Extract expected output from impulse pointer
        if "pointer" in impulse_data and "definition" in impulse_data["pointer"]:
            return impulse_data["pointer"]["definition"]
        elif "pointer" in impulse_data and "content" in impulse_data["pointer"]:
            return impulse_data["pointer"]["content"]
        else:
            return impulse_data


class CommandExecutor:
    """Execute test commands and capture outputs"""

    @staticmethod
    def execute_bash(command: str, timeout: int = 30) -> Dict[str, Any]:
        """Execute bash command and return structured output"""
        try:
            result = subprocess.run(
                command, shell=True, capture_output=True, text=True, timeout=timeout
            )
            return {
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                "exit_code": result.returncode,
                "success": result.returncode == 0,
            }
        except subprocess.TimeoutExpired:
            return {
                "stdout": "",
                "stderr": f"Command timed out after {timeout}s",
                "exit_code": -1,
                "success": False,
                "error": "timeout",
            }
        except Exception as e:
            return {
                "stdout": "",
                "stderr": str(e),
                "exit_code": -1,
                "success": False,
                "error": str(e),
            }

    @staticmethod
    def execute_http(
        url: str,
        method: str = "GET",
        data: Any = None,
        headers: Dict[str, str] = None,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """Execute HTTP request and return structured output"""
        try:
            response = requests.request(
                method=method,
                url=url,
                json=data,
                headers=headers or {},
                timeout=timeout,
            )

            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = response.text

            return {
                "status_code": response.status_code,
                "response": response_data,
                "headers": dict(response.headers),
                "success": 200 <= response.status_code < 300,
            }
        except Exception as e:
            return {
                "status_code": 0,
                "response": None,
                "headers": {},
                "success": False,
                "error": str(e),
            }

    @staticmethod
    def execute_kubectl(
        args: str, namespace: str = "metabob", timeout: int = 30
    ) -> Dict[str, Any]:
        """Execute kubectl command and return structured output"""
        command = f"kubectl -n {namespace} {args}"
        return CommandExecutor.execute_bash(command, timeout)


class OutputComparator:
    """Deterministic output comparison - NO LLM DEPENDENCY"""

    @staticmethod
    def compare(
        expected: Any, actual: Any, comparison_type: str = "equals"
    ) -> TestResult:
        """
        Deterministic comparison using boolean assertions

        comparison_type:
            - equals: actual === expected
            - not_equals: actual !== expected
            - greater_than: actual > expected
            - less_than: actual < expected
            - contains: expected in actual (for strings/lists)
            - regex: re.match(expected, actual)
            - status_code: actual.status_code === expected
            - json_schema: validate JSON structure
        """

        passed = False
        diff = None
        error = None

        try:
            if comparison_type == "equals":
                passed = expected == actual
                if not passed:
                    diff = {"expected": expected, "actual": actual}

            elif comparison_type == "not_equals":
                passed = expected != actual
                if not passed:
                    diff = {"expected": f"!= {expected}", "actual": actual}

            elif comparison_type == "greater_than":
                passed = actual > expected
                if not passed:
                    diff = {"expected": f"> {expected}", "actual": actual}

            elif comparison_type == "less_than":
                passed = actual < expected
                if not passed:
                    diff = {"expected": f"< {expected}", "actual": actual}

            elif comparison_type == "contains":
                if isinstance(actual, str):
                    passed = expected in actual
                elif isinstance(actual, list):
                    passed = expected in actual
                else:
                    passed = False
                    error = f"Cannot check 'contains' on type {type(actual)}"

                if not passed and not error:
                    diff = {"expected": f"contains '{expected}'", "actual": actual}

            elif comparison_type == "regex":
                if isinstance(actual, str):
                    passed = bool(re.match(expected, actual))
                else:
                    passed = False
                    error = f"Regex comparison requires string, got {type(actual)}"

                if not passed and not error:
                    diff = {"expected": f"matches /{expected}/", "actual": actual}

            elif comparison_type == "status_code":
                actual_code = (
                    actual.get("status_code") if isinstance(actual, dict) else actual
                )
                passed = actual_code == expected
                if not passed:
                    diff = {"expected_status": expected, "actual_status": actual_code}

            elif comparison_type == "json_schema":
                # Validate JSON structure (keys present, types match)
                if not isinstance(expected, dict) or not isinstance(actual, dict):
                    passed = False
                    error = "JSON schema validation requires dict objects"
                else:
                    passed, diff = OutputComparator._validate_json_schema(
                        expected, actual
                    )

            else:
                passed = False
                error = f"Unknown comparison_type: {comparison_type}"

        except Exception as e:
            passed = False
            error = str(e)

        return TestResult(
            test_name="comparison",
            passed=passed,
            expected=expected,
            actual=actual,
            diff=diff,
            error=error,
        )

    @staticmethod
    def _validate_json_schema(schema: Dict[str, Any], data: Dict[str, Any]) -> tuple:
        """Validate JSON structure matches schema"""
        missing_keys = []
        type_mismatches = []

        for key, expected_type in schema.items():
            if key not in data:
                missing_keys.append(key)
            elif isinstance(expected_type, type):
                if not isinstance(data[key], expected_type):
                    type_mismatches.append(
                        {
                            "key": key,
                            "expected_type": expected_type.__name__,
                            "actual_type": type(data[key]).__name__,
                        }
                    )

        passed = len(missing_keys) == 0 and len(type_mismatches) == 0
        diff = (
            None
            if passed
            else {"missing_keys": missing_keys, "type_mismatches": type_mismatches}
        )

        return passed, diff


class UnifiedOutputValidator:
    """Main validator orchestrating all components"""

    def __init__(self, impulse_dir: Optional[str] = None):
        self.impulse_loader = ImpulseLoader(impulse_dir)
        self.executor = CommandExecutor()
        self.comparator = OutputComparator()

    def validate_test(
        self, test_definition: Dict[str, Any], expected_output: Dict[str, Any]
    ) -> TestResult:
        """
        Validate a single test

        test_definition:
            {
                "name": "GET /v2/activities/templates",
                "type": "http",  # or "bash", "kubectl", "python"
                "command": "curl http://api.metabob.local/v2/activities/templates",
                "url": "http://api.metabob.local/v2/activities/templates",
                "method": "GET",
                "timeout": 30
            }

        expected_output:
            {
                "status_code": 200,
                "response": {"templates": [...]},
                "assertions": [
                    {"field": "status_code", "comparison": "equals", "value": 200},
                    {"field": "response.templates.length", "comparison": "greater_than", "value": 0}
                ]
            }
        """

        test_name = test_definition.get("name", "unnamed_test")
        test_type = test_definition.get("type", "bash")

        # Execute test command
        if test_type == "http":
            url = test_definition.get("url")
            if not url:
                return TestResult(
                    test_name=test_name,
                    passed=False,
                    expected=expected_output,
                    actual=None,
                    error="Missing 'url' in test definition",
                )
            headers = test_definition.get("headers")
            actual_output = self.executor.execute_http(
                url=url,
                method=test_definition.get("method", "GET"),
                data=test_definition.get("data"),
                headers=headers if headers is not None else {},
                timeout=test_definition.get("timeout", 30),
            )
        elif test_type == "kubectl":
            args = test_definition.get("args")
            if not args:
                return TestResult(
                    test_name=test_name,
                    passed=False,
                    expected=expected_output,
                    actual=None,
                    error="Missing 'args' in test definition",
                )
            actual_output = self.executor.execute_kubectl(
                args=args,
                namespace=test_definition.get("namespace", "metabob"),
                timeout=test_definition.get("timeout", 30),
            )
        elif test_type == "bash":
            command = test_definition.get("command")
            if not command:
                return TestResult(
                    test_name=test_name,
                    passed=False,
                    expected=expected_output,
                    actual=None,
                    error="Missing 'command' in test definition",
                )
            actual_output = self.executor.execute_bash(
                command=command, timeout=test_definition.get("timeout", 30)
            )
        else:
            return TestResult(
                test_name=test_name,
                passed=False,
                expected=expected_output,
                actual=None,
                error=f"Unknown test type: {test_type}",
            )

        # Run assertions
        assertions = expected_output.get("assertions", [])
        if not assertions:
            # Simple equality comparison if no assertions defined
            result = self.comparator.compare(expected_output, actual_output, "equals")
            result.test_name = test_name
            return result

        # Run all assertions
        assertion_results = []
        for assertion in assertions:
            field = assertion.get("field")
            comparison = assertion.get("comparison", "equals")
            expected_value = assertion.get("value")

            # Extract field value from actual output
            actual_value = self._get_nested_value(actual_output, field)

            # Compare
            result = self.comparator.compare(expected_value, actual_value, comparison)
            assertion_results.append(result.passed)

        # Aggregate assertion results
        all_passed = all(assertion_results)

        return TestResult(
            test_name=test_name,
            passed=all_passed,
            expected=expected_output,
            actual=actual_output,
            diff=None
            if all_passed
            else {
                "failed_assertions": [
                    assertions[i]
                    for i, passed in enumerate(assertion_results)
                    if not passed
                ]
            },
        )

    def validate_test_suite(
        self, test_suite_name: str, expected_impulse_id: str
    ) -> ValidationSummary:
        """
        Validate a complete test suite

        Loads test definitions and expected outputs from impulses,
        executes all tests, aggregates results
        """

        start_time = datetime.utcnow()

        # Load expected outputs from impulse
        expected_data = self.impulse_loader.load_expected_output(expected_impulse_id)

        # Load test suite definition
        test_suite_impulse_id = f"test-suite-{test_suite_name}"
        test_suite_data = self.impulse_loader.load_expected_output(
            test_suite_impulse_id
        )

        tests = test_suite_data.get("tests", [])

        # Execute all tests
        test_results = []
        for test_def in tests:
            test_name = test_def.get("name")
            expected_output = expected_data.get(test_name, {})

            result = self.validate_test(test_def, expected_output)
            test_results.append(result)

        # Calculate duration
        duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

        # Aggregate results
        passed_count = sum(1 for r in test_results if r.passed)
        failed_count = len(test_results) - passed_count

        return ValidationSummary(
            total_tests=len(test_results),
            passed=passed_count,
            failed=failed_count,
            test_results=test_results,
            duration_ms=duration_ms,
        )

    @staticmethod
    def _get_nested_value(data: Dict[str, Any], field_path: str) -> Any:
        """Get nested value from dict using dot notation (e.g., 'response.templates.length')"""
        parts = field_path.split(".")
        value = data

        for part in parts:
            if part == "length" and isinstance(value, list):
                return len(value)
            elif isinstance(value, dict):
                value = value.get(part)
            else:
                return None

        return value


def main():
    parser = argparse.ArgumentParser(description="Unified Output Validator")
    parser.add_argument("--test-suite", help="Test suite name")
    parser.add_argument("--expected-impulse", help="Expected output impulse ID")
    parser.add_argument("--test", help="Single test name")
    parser.add_argument("--expected", help="Expected output JSON file")
    parser.add_argument("--output", help="Output file for results (JSON)", default=None)

    args = parser.parse_args()

    validator = UnifiedOutputValidator()

    if args.test_suite and args.expected_impulse:
        # Validate entire test suite
        summary = validator.validate_test_suite(args.test_suite, args.expected_impulse)

        # Output results
        result_json = json.dumps(asdict(summary), indent=2, default=str)

        if args.output:
            with open(args.output, "w") as f:
                f.write(result_json)

        print(result_json)

        # Exit code based on results
        sys.exit(0 if summary.failed == 0 else 1)

    elif args.test and args.expected:
        # Validate single test
        with open(args.expected, "r") as f:
            expected_data = json.load(f)

        # Test definition from expected data
        test_def = expected_data.get("test_definition", {})
        expected_output = expected_data.get("expected_output", {})

        result = validator.validate_test(test_def, expected_output)

        result_json = json.dumps(asdict(result), indent=2, default=str)

        if args.output:
            with open(args.output, "w") as f:
                f.write(result_json)

        print(result_json)

        sys.exit(0 if result.passed else 1)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
