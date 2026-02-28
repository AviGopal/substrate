#!/usr/bin/env python3
"""
Validation Harness for Pattern Extraction Service

Tests the pattern extraction service to ensure:
- File paths are correctly extracted from messages
- Components (functions, classes) are identified
- Common patterns (errors, refactoring) are detected
- Complexity indicators are calculated accurately

This is a PURE VALIDATION HARNESS - no LLM calls, just input/output verification.
"""

import sys
import json
from typing import List, Dict, Any
from pathlib import Path

# Add rpc-api to path
sys.path.insert(
    0, str(Path(__file__).parent.parent.parent / "repos" / "metabob-rpc-api")
)

from server.services.pattern_extraction_service import extract_patterns

# ============================================================================
# Test Case Definitions
# ============================================================================

TEST_CASES = [
    # Test Case 1: Basic file path extraction
    {
        "id": "validation-pattern-extraction-service-complete-case-1",
        "description": "Extract file paths from simple messages",
        "input": {
            "messages": [
                "I need to update src/auth.py and fix the login function",
                "Also check config.json for settings",
            ]
        },
        "expected": {
            "file_paths": ["config.json", "src/auth.py"],
            "components_modified": ["login"],
            "common_patterns": [],
            "complexity_indicators": {"files_touched_count": 2, "task_type": "fix"},
        },
    },
    # Test Case 2: Component extraction (functions and classes)
    {
        "id": "validation-pattern-extraction-service-complete-case-2",
        "description": "Extract component names from code references",
        "input": {
            "messages": [
                "Refactor the User class and extract_data method",
                "Also update the normalize function in utils.py",
            ]
        },
        "expected": {
            "file_paths": ["utils.py"],
            "components_modified": ["User", "extract_data", "normalize"],
            "common_patterns": ["refactor"],
            "complexity_indicators": {
                "task_type": "refactor",
                "components_modified_count": 3,
            },
        },
    },
    # Test Case 3: Error pattern detection
    {
        "id": "validation-pattern-extraction-service-complete-case-3",
        "description": "Identify error patterns and types",
        "input": {
            "messages": [
                "Fix the TypeError in database.py",
                "Handle ImportError when loading modules",
                "Also fix syntax error in parser.ts",
            ]
        },
        "expected": {
            "file_paths": ["database.py", "parser.ts"],
            "components_modified": [],
            "common_patterns": [
                "fix_bug",
                "import_error",
                "syntax_error",
                "type_error",
            ],
            "complexity_indicators": {"task_type": "fix", "files_touched_count": 2},
        },
    },
    # Test Case 4: Complexity calculation
    {
        "id": "validation-pattern-extraction-service-complete-case-4",
        "description": "Detect refactoring patterns and complexity",
        "input": {
            "messages": [
                "Add authentication feature to src/auth/login.ts, src/auth/middleware.ts, and src/routes/auth.ts",
                "Refactor existing code to support OAuth2",
                "Update tests in test/auth.test.ts",
            ]
        },
        "expected": {
            "file_paths": [
                "src/auth/login.ts",
                "src/auth/middleware.ts",
                "src/routes/auth.ts",
                "test/auth.test.ts",
            ],
            "components_modified": [],
            "common_patterns": ["add_feature", "add_test", "refactor"],
            "complexity_indicators": {
                "files_touched_count": 4,
                "task_type": "feature",
                "refactoring_depth": "moderate",
            },
        },
    },
    # Test Case 5: Edge case - empty messages
    {
        "id": "validation-pattern-extraction-service-complete-case-5",
        "description": "Handle empty input gracefully",
        "input": {"messages": []},
        "expected": {
            "file_paths": [],
            "components_modified": [],
            "common_patterns": [],
            "complexity_indicators": {
                "files_touched_count": 0,
                "estimated_lines_changed": 0,
                "task_type": "unknown",
            },
        },
    },
    # Test Case 6: False positive filtering
    {
        "id": "validation-pattern-extraction-service-complete-case-6",
        "description": "Filter out false positives",
        "input": {
            "messages": [
                "Fix bug e.g. in the User.save method",
                "Update documentation i.e. README.md",
                "The process.exit function should be avoided",
            ]
        },
        "expected": {
            "file_paths": ["README.md"],
            "components_modified": ["User.save"],
            "common_patterns": ["fix_bug", "update_docs"],
            "complexity_indicators": {"task_type": "fix"},
        },
    },
]

# ============================================================================
# Validation Logic
# ============================================================================


def arrays_equal(a: List[str], b: List[str]) -> bool:
    """Compare two arrays (order-independent)"""
    return sorted(a) == sorted(b)


def validate_complexity(actual: Dict[str, Any], expected: Dict[str, Any]) -> List[str]:
    """Validate complexity indicators (with tolerance for estimated values)"""
    errors = []

    # Check each expected field
    for key, expected_value in expected.items():
        if key not in actual:
            errors.append(f"{key} missing in actual output")
            continue

        actual_value = actual[key]

        # estimated_lines_changed allows 20% tolerance
        if key == "estimated_lines_changed":
            tolerance = max(5, int(expected_value * 0.2))
            diff = abs(actual_value - expected_value)
            if diff > tolerance:
                errors.append(
                    f"{key} outside tolerance: expected {expected_value} ±{tolerance}, got {actual_value}"
                )
        # All other fields require exact match
        elif actual_value != expected_value:
            errors.append(
                f"{key} mismatch: expected {expected_value}, got {actual_value}"
            )

    return errors


def validate_test_case(test_case: Dict[str, Any]) -> Dict[str, Any]:
    """Validate a single test case"""
    errors = []

    try:
        # Call the pattern extraction service
        result = extract_patterns(test_case["input"]["messages"])
        actual = result.model_dump()

        expected = test_case["expected"]

        # Compare file_paths
        if not arrays_equal(actual["file_paths"], expected["file_paths"]):
            errors.append(
                f"file_paths mismatch: expected {expected['file_paths']}, got {actual['file_paths']}"
            )

        # Compare components_modified
        if not arrays_equal(
            actual["components_modified"], expected["components_modified"]
        ):
            errors.append(
                f"components_modified mismatch: expected {expected['components_modified']}, got {actual['components_modified']}"
            )

        # Compare common_patterns
        if not arrays_equal(actual["common_patterns"], expected["common_patterns"]):
            errors.append(
                f"common_patterns mismatch: expected {expected['common_patterns']}, got {actual['common_patterns']}"
            )

        # Compare complexity indicators
        complexity_errors = validate_complexity(
            actual["complexity_indicators"], expected["complexity_indicators"]
        )
        errors.extend(complexity_errors)

        return {
            "pass": len(errors) == 0,
            "testCase": test_case["id"],
            "description": test_case["description"],
            "actual": actual,
            "expected": expected,
            "errors": errors,
        }

    except Exception as e:
        return {
            "pass": False,
            "testCase": test_case["id"],
            "description": test_case["description"],
            "actual": None,
            "expected": test_case["expected"],
            "errors": [f"Exception during validation: {str(e)}"],
        }


def run_validation() -> Dict[str, Any]:
    """Run all validation tests"""
    print("=" * 60)
    print("Pattern Extraction Service Validation")
    print("=" * 60)
    print()

    results = []

    for test_case in TEST_CASES:
        print(f"Running: {test_case['description']}...")
        result = validate_test_case(test_case)
        results.append(result)

        if result["pass"]:
            print(f"✓ PASS: {test_case['id']}\n")
        else:
            print(f"✗ FAIL: {test_case['id']}")
            for error in result["errors"]:
                print(f"  - {error}")
            print()

    passed = sum(1 for r in results if r["pass"])
    failed = sum(1 for r in results if not r["pass"])
    total = len(results)

    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success Rate: {(passed / total * 100):.1f}%")
    print()

    # Save results to file
    output_file = (
        Path(__file__).parent.parent
        / "test-results"
        / "validation-results-pattern-extraction-service-complete.json"
    )
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w") as f:
        json.dump(
            {"passed": passed, "failed": failed, "total": total, "results": results},
            f,
            indent=2,
        )

    print(f"Results saved to: {output_file}")

    return {"passed": passed, "failed": failed, "total": total, "results": results}


if __name__ == "__main__":
    summary = run_validation()
    sys.exit(0 if summary["failed"] == 0 else 1)
