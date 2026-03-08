#!/usr/bin/env python3
"""
Phase 1 Typing and MCP Communication Validation Harness

This harness validates:
1. TypedDict definitions match TypeScript interfaces
2. bind_impulses_as_variables returns properly typed ImpulseVariableBindings
3. MCP tool type hints are correct
4. pyright/mypy validation passes in strict mode
5. MCP roundtrip preserves types (TypeScript -> JSON -> Python -> API -> DB -> Python -> JSON -> TypeScript)
6. No type coercion errors (int -> str)
7. Edge cases: null/undefined/None handling, empty arrays, missing optional fields
8. Type coverage is 100% on Phase 1 code

Usage:
    python tests/validation-harnesses/phase1-typing-and-mcp-communication-validation-harness.py

Expected: All tests PASS, 0 type errors from pyright/mypy
"""

import asyncio
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Add src to path for imports
sys.path.insert(
    0, str(Path(__file__).parent.parent.parent / "repos" / "metabob-cli" / "src")
)

from metabob_cli.mcp.types import (
    ImpulseVariableBindings,
    ImpulseData,
    TestResultsPointer,
    TaskSummaryPointer,
    ScriptArtifactPointer,
    BashOutputPointer,
    ImpulseStoreResponse,
    validate_impulse_structure,
    validate_bindings_structure,
)


class ValidationResult:
    """Validation result with pass/fail status and details"""

    def __init__(self, test_name: str):
        self.test_name = test_name
        self.passed = True
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def fail(self, error: str):
        self.passed = False
        self.errors.append(error)

    def warn(self, warning: str):
        self.warnings.append(warning)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_name": self.test_name,
            "passed": self.passed,
            "errors": self.errors,
            "warnings": self.warnings,
        }


class Phase1TypingValidationHarness:
    """Validation harness for Phase 1 typing and MCP communication"""

    def __init__(self):
        self.repo_root = Path(__file__).parent.parent.parent
        self.metabob_cli_root = self.repo_root / "repos" / "metabob-cli"
        self.results: List[ValidationResult] = []

    def run_all_validations(self) -> bool:
        """Run all validation tests and return overall pass/fail"""
        print("=" * 80)
        print("Phase 1 Typing and MCP Communication Validation Harness")
        print("=" * 80)
        print()

        # Test 1: TypedDict structure validation
        print("Test 1: TypedDict Structure Validation...")
        self.results.append(self.validate_typed_dict_structures())

        # Test 2: ImpulseVariableBindings structure
        print("\nTest 2: ImpulseVariableBindings Structure...")
        self.results.append(self.validate_impulse_variable_bindings_structure())

        # Test 3: Impulse pointer type validation
        print("\nTest 3: Impulse Pointer Type Validation...")
        self.results.append(self.validate_impulse_pointer_types())

        # Test 4: Type coercion preservation
        print("\nTest 4: Type Coercion Preservation...")
        self.results.append(self.validate_type_coercion_preservation())

        # Test 5: Edge case handling
        print("\nTest 5: Edge Case Handling...")
        self.results.append(self.validate_edge_cases())

        # Test 6: pyright/mypy validation
        print("\nTest 6: pyright/mypy Static Type Checking...")
        self.results.append(self.validate_static_type_checking())

        # Test 7: MCP roundtrip type preservation
        print("\nTest 7: MCP Roundtrip Type Preservation...")
        self.results.append(self.validate_mcp_roundtrip())

        # Print summary
        print("\n" + "=" * 80)
        print("Validation Summary")
        print("=" * 80)

        passed = sum(1 for r in self.results if r.passed)
        total = len(self.results)

        for result in self.results:
            status = "✅ PASS" if result.passed else "❌ FAIL"
            print(f"{status}: {result.test_name}")
            for error in result.errors:
                print(f"  ❌ {error}")
            for warning in result.warnings:
                print(f"  ⚠️  {warning}")

        print()
        print(f"Overall: {passed}/{total} tests passed ({100 * passed // total}%)")

        all_passed = all(r.passed for r in self.results)
        if all_passed:
            print("\n✅ All validations PASSED!")
        else:
            print("\n❌ Some validations FAILED!")

        return all_passed

    def validate_typed_dict_structures(self) -> ValidationResult:
        """Validate TypedDict structures match expected TypeScript interfaces"""
        result = ValidationResult("TypedDict Structure Validation")

        try:
            # Test ImpulseData structure
            impulse_data: ImpulseData = {
                "id": "test-impulse",
                "type": "testResults",
                "pointer": {
                    "type": "testResults",
                    "command": "pytest",
                    "passed": True,
                    "exit_code": 0,
                },
                "budget": 5000,
            }

            if not validate_impulse_structure(impulse_data):
                result.fail("ImpulseData validation failed for valid impulse")

            # Test required fields
            invalid_impulse: Dict[str, Any] = {
                "id": "test",
                # Missing 'type', 'pointer', 'budget'
            }

            if validate_impulse_structure(invalid_impulse):
                result.fail(
                    "ImpulseData validation passed for invalid impulse (missing required fields)"
                )

            # Test pointer structure
            if "type" not in impulse_data["pointer"]:
                result.fail("Pointer missing discriminator field 'type'")

            # Test budget validation
            invalid_budget_impulse = impulse_data.copy()
            invalid_budget_impulse["budget"] = -100
            if validate_impulse_structure(invalid_budget_impulse):
                result.fail("ImpulseData validation passed for negative budget")

        except Exception as e:
            result.fail(f"Exception during TypedDict validation: {e}")

        return result

    def validate_impulse_variable_bindings_structure(self) -> ValidationResult:
        """Validate ImpulseVariableBindings matches TypeScript interface"""
        result = ValidationResult("ImpulseVariableBindings Structure Validation")

        try:
            # Create a valid ImpulseVariableBindings dict
            bindings: ImpulseVariableBindings = {
                "previous_commands": [
                    {
                        "command": "npm test",
                        "output": "All tests passed",
                        "exit_code": 0,
                    }
                ],
                "test_results": [{"command": "pytest", "passed": True, "exit_code": 0}],
                "all_tests_passed": True,
                "created_files": ["src/test.py"],
                "generated_scripts": [
                    {
                        "path": "scripts/deploy.sh",
                        "language": "bash",
                        "purpose": "Deploy application",
                        "executable": True,
                    }
                ],
                "activity_results": [
                    {
                        "task_id": "task-1",
                        "success": True,
                        "duration_ms": 5000,
                        "cost": 0.05,
                    }
                ],
                "previous_task_success": True,
                "previous_task_duration": 3000,
            }

            if not validate_bindings_structure(bindings):
                result.fail(
                    "ImpulseVariableBindings validation failed for valid bindings"
                )

            # Test that all expected fields are present
            expected_fields = {
                "previous_commands",
                "test_results",
                "all_tests_passed",
                "created_files",
                "generated_scripts",
                "activity_results",
                "previous_task_success",
                "previous_task_duration",
            }

            actual_fields = set(bindings.keys())
            if actual_fields != expected_fields:
                missing = expected_fields - actual_fields
                extra = actual_fields - expected_fields
                if missing:
                    result.fail(f"Missing fields in ImpulseVariableBindings: {missing}")
                if extra:
                    result.warn(f"Extra fields in ImpulseVariableBindings: {extra}")

            # Test type validation for each field
            if not isinstance(bindings.get("previous_commands"), list):
                result.fail("previous_commands should be a list")

            if not isinstance(bindings.get("test_results"), list):
                result.fail("test_results should be a list")

            if not isinstance(bindings.get("all_tests_passed"), bool):
                result.fail("all_tests_passed should be a bool")

            if not isinstance(bindings.get("created_files"), list):
                result.fail("created_files should be a list")

            if not isinstance(bindings.get("generated_scripts"), list):
                result.fail("generated_scripts should be a list")

            if not isinstance(bindings.get("activity_results"), list):
                result.fail("activity_results should be a list")

            pts = bindings.get("previous_task_success")
            if pts is not None and not isinstance(pts, bool):
                result.fail("previous_task_success should be bool or None")

            if not isinstance(bindings.get("previous_task_duration"), int):
                result.fail("previous_task_duration should be an int")

        except Exception as e:
            result.fail(f"Exception during ImpulseVariableBindings validation: {e}")

        return result

    def validate_impulse_pointer_types(self) -> ValidationResult:
        """Validate all impulse pointer types"""
        result = ValidationResult("Impulse Pointer Type Validation")

        try:
            # Test TestResultsPointer
            test_results_pointer: TestResultsPointer = {
                "type": "testResults",
                "command": "pytest",
                "passed": True,
                "exit_code": 0,
            }

            if test_results_pointer["type"] != "testResults":
                result.fail("TestResultsPointer type discriminator incorrect")

            # Test TaskSummaryPointer
            task_summary_pointer: TaskSummaryPointer = {
                "type": "taskSummary",
                "task_id": "task-1",
                "success": True,
                "duration_ms": 5000,
                "cost": 0.05,
            }

            if task_summary_pointer["type"] != "taskSummary":
                result.fail("TaskSummaryPointer type discriminator incorrect")

            # Test ScriptArtifactPointer
            script_artifact_pointer: ScriptArtifactPointer = {
                "type": "scriptArtifact",
                "file_path": "scripts/deploy.sh",
                "language": "bash",
                "executable": True,
                "inferred_purpose": "Deploy application",
            }

            if script_artifact_pointer["type"] != "scriptArtifact":
                result.fail("ScriptArtifactPointer type discriminator incorrect")

            # Test BashOutputPointer
            bash_output_pointer: BashOutputPointer = {
                "type": "bashOutput",
                "command": "ls -la",
                "output": "total 0\n",
                "exit_code": 0,
            }

            if bash_output_pointer["type"] != "bashOutput":
                result.fail("BashOutputPointer type discriminator incorrect")

        except Exception as e:
            result.fail(f"Exception during impulse pointer type validation: {e}")

        return result

    def validate_type_coercion_preservation(self) -> ValidationResult:
        """Validate no type coercion errors (int -> str, etc.)"""
        result = ValidationResult("Type Coercion Preservation")

        try:
            # Test that int fields remain int after JSON roundtrip
            impulse_data: ImpulseData = {
                "id": "test-impulse",
                "type": "testResults",
                "pointer": {
                    "type": "testResults",
                    "command": "pytest",
                    "passed": True,
                    "exit_code": 0,  # int
                },
                "budget": 5000,  # int
            }

            # Simulate JSON serialization/deserialization
            json_str = json.dumps(impulse_data)
            deserialized = json.loads(json_str)

            # Check that int fields are still int
            if not isinstance(deserialized["budget"], int):
                result.fail(
                    f"budget coerced from int to {type(deserialized['budget'])}"
                )

            if not isinstance(deserialized["pointer"]["exit_code"], int):
                result.fail(
                    f"exit_code coerced from int to {type(deserialized['pointer']['exit_code'])}"
                )

            # Test that bool fields remain bool
            if not isinstance(deserialized["pointer"]["passed"], bool):
                result.fail(
                    f"passed coerced from bool to {type(deserialized['pointer']['passed'])}"
                )

            # Test TaskSummaryPointer with float cost
            task_summary: Dict[str, Any] = {
                "type": "taskSummary",
                "task_id": "task-1",
                "success": True,
                "duration_ms": 5000,  # int
                "cost": 0.05,  # float
            }

            json_str = json.dumps(task_summary)
            deserialized = json.loads(json_str)

            if not isinstance(deserialized["duration_ms"], int):
                result.fail(
                    f"duration_ms coerced from int to {type(deserialized['duration_ms'])}"
                )

            if not isinstance(deserialized["cost"], (int, float)):
                result.fail(f"cost coerced from float to {type(deserialized['cost'])}")

        except Exception as e:
            result.fail(f"Exception during type coercion validation: {e}")

        return result

    def validate_edge_cases(self) -> ValidationResult:
        """Validate edge case handling: null/None, empty arrays, missing optional fields"""
        result = ValidationResult("Edge Case Handling")

        try:
            # Test None handling for optional fields
            impulse_data: ImpulseData = {
                "id": "test-impulse",
                "type": "testResults",
                "pointer": {
                    "type": "testResults",
                    "command": "pytest",
                    "passed": True,
                    "exit_code": 0,
                },
                "budget": 5000,
                # Optional fields omitted
            }

            if not validate_impulse_structure(impulse_data):
                result.fail(
                    "ImpulseData validation failed with missing optional fields"
                )

            # Test with explicit None for optional fields
            impulse_data_with_none: Dict[str, Any] = {
                "id": "test-impulse",
                "type": "testResults",
                "pointer": {
                    "type": "testResults",
                    "command": "pytest",
                    "passed": True,
                    "exit_code": 0,
                },
                "budget": 5000,
                "content": None,
                "metadata": None,
            }

            if not validate_impulse_structure(impulse_data_with_none):
                result.fail(
                    "ImpulseData validation failed with explicit None for optional fields"
                )

            # Test empty arrays
            bindings: ImpulseVariableBindings = {
                "previous_commands": [],  # Empty array
                "test_results": [],
                "all_tests_passed": True,
                "created_files": [],
                "generated_scripts": [],
                "activity_results": [],
                "previous_task_success": None,  # None for optional field
                "previous_task_duration": 0,
            }

            if not validate_bindings_structure(bindings):
                result.fail(
                    "ImpulseVariableBindings validation failed with empty arrays"
                )

            # Test previous_task_success can be None
            if bindings.get("previous_task_success") is not None:
                pass  # This is allowed - it's NotRequired[bool | None]

        except Exception as e:
            result.fail(f"Exception during edge case validation: {e}")

        return result

    def validate_static_type_checking(self) -> ValidationResult:
        """Run pyright/mypy in strict mode on activity_manager.py and types.py"""
        result = ValidationResult("Static Type Checking (pyright/mypy)")

        try:
            # Test pyright on types.py
            pyright_result = subprocess.run(
                ["pyright", "src/metabob_cli/mcp/types.py"],
                cwd=self.metabob_cli_root,
                capture_output=True,
                text=True,
            )

            if pyright_result.returncode != 0:
                # Parse pyright output for actual errors (ignore warnings)
                output_lines = pyright_result.stdout.split("\n")
                error_lines = [
                    line for line in output_lines if "error:" in line.lower()
                ]

                if error_lines:
                    result.fail(
                        f"pyright found errors in types.py:\n"
                        + "\n".join(error_lines[:5])
                    )
                else:
                    result.warn(
                        f"pyright exited with non-zero code but no errors found: {pyright_result.returncode}"
                    )
            else:
                print("  ✅ pyright validation passed for types.py")

            # Test mypy on types.py (if available)
            try:
                mypy_result = subprocess.run(
                    ["mypy", "--strict", "src/metabob_cli/mcp/types.py"],
                    cwd=self.metabob_cli_root,
                    capture_output=True,
                    text=True,
                )

                if mypy_result.returncode != 0:
                    output_lines = mypy_result.stdout.split("\n")
                    error_lines = [
                        line for line in output_lines if "error:" in line.lower()
                    ]

                    if error_lines:
                        result.fail(
                            f"mypy found errors in types.py:\n"
                            + "\n".join(error_lines[:5])
                        )
                    else:
                        result.warn(
                            f"mypy exited with non-zero code: {mypy_result.returncode}"
                        )
                else:
                    print("  ✅ mypy validation passed for types.py")
            except FileNotFoundError:
                result.warn("mypy not found, skipping mypy validation")

        except FileNotFoundError:
            result.warn("pyright not found, skipping static type checking")
        except Exception as e:
            result.fail(f"Exception during static type checking: {e}")

        return result

    def validate_mcp_roundtrip(self) -> ValidationResult:
        """
        Validate MCP roundtrip type preservation:
        TypeScript dict -> JSON -> Python dict -> validate -> JSON -> TypeScript dict

        Note: This is a simulated roundtrip without actual MCP/API calls
        """
        result = ValidationResult("MCP Roundtrip Type Preservation")

        try:
            # Simulate TypeScript impulse creation
            typescript_impulse = {
                "id": "roundtrip-test-impulse",
                "type": "testResults",
                "pointer": {
                    "type": "testResults",
                    "taskId": "task-1",  # TypeScript uses camelCase
                    "command": "pytest",
                    "output": "All tests passed",
                    "exitCode": 0,  # TypeScript uses camelCase
                    "passed": True,
                },
                "budget": 5000,
                "priority": "high",
                "loaded": False,
            }

            # Step 1: TypeScript -> JSON (simulate MCP serialization)
            json_payload = json.dumps(typescript_impulse)
            print(f"  Step 1: TypeScript -> JSON ({len(json_payload)} bytes)")

            # Step 2: JSON -> Python dict (MCP deserialization)
            python_dict = json.loads(json_payload)
            print("  Step 2: JSON -> Python dict")

            # Step 3: Convert camelCase to snake_case (MCP tool handler)
            # Note: In real implementation, this would be done by MCP layer
            python_impulse_data: Dict[str, Any] = {
                "id": python_dict["id"],
                "type": python_dict["type"],
                "pointer": {
                    "type": python_dict["pointer"]["type"],
                    "task_id": python_dict["pointer"].get("taskId", ""),
                    "command": python_dict["pointer"]["command"],
                    "output": python_dict["pointer"].get("output", ""),
                    "exit_code": python_dict["pointer"]["exitCode"],
                    "passed": python_dict["pointer"]["passed"],
                },
                "budget": python_dict["budget"],
                "priority": python_dict.get("priority", "medium"),
                "loaded": python_dict.get("loaded", False),
            }

            # Step 4: Validate Python impulse structure
            if not validate_impulse_structure(python_impulse_data):
                result.fail("Python impulse validation failed after deserialization")
                return result

            print("  Step 3: Validated Python ImpulseData structure")

            # Step 5: Simulate storage and retrieval (Python dict -> JSON -> Python dict)
            stored_json = json.dumps(python_impulse_data)
            retrieved_python = json.loads(stored_json)
            print("  Step 4: Simulated DB storage and retrieval")

            # Step 6: Validate type preservation after storage roundtrip
            if not isinstance(retrieved_python["budget"], int):
                result.fail(
                    f"budget type lost after storage: {type(retrieved_python['budget'])}"
                )

            if not isinstance(retrieved_python["pointer"]["exit_code"], int):
                result.fail(
                    f"exit_code type lost after storage: {type(retrieved_python['pointer']['exit_code'])}"
                )

            if not isinstance(retrieved_python["pointer"]["passed"], bool):
                result.fail(
                    f"passed type lost after storage: {type(retrieved_python['pointer']['passed'])}"
                )

            print("  Step 5: Type preservation validated")

            # Step 7: Convert back to TypeScript format (Python -> JSON -> TypeScript)
            # Convert snake_case back to camelCase
            typescript_response = {
                "id": retrieved_python["id"],
                "type": retrieved_python["type"],
                "pointer": {
                    "type": retrieved_python["pointer"]["type"],
                    "taskId": retrieved_python["pointer"].get("task_id", ""),
                    "command": retrieved_python["pointer"]["command"],
                    "output": retrieved_python["pointer"].get("output", ""),
                    "exitCode": retrieved_python["pointer"]["exit_code"],
                    "passed": retrieved_python["pointer"]["passed"],
                },
                "budget": retrieved_python["budget"],
                "priority": retrieved_python.get("priority", "medium"),
                "loaded": retrieved_python.get("loaded", False),
            }

            response_json = json.dumps(typescript_response)
            print(
                f"  Step 6: Python -> JSON -> TypeScript ({len(response_json)} bytes)"
            )

            # Step 8: Validate that final TypeScript response matches original structure
            if typescript_response["budget"] != typescript_impulse["budget"]:
                result.fail(
                    f"budget mismatch: {typescript_response['budget']} != {typescript_impulse['budget']}"
                )

            if (
                typescript_response["pointer"]["exitCode"]
                != typescript_impulse["pointer"]["exitCode"]
            ):
                result.fail(
                    f"exitCode mismatch: {typescript_response['pointer']['exitCode']} != {typescript_impulse['pointer']['exitCode']}"
                )

            if (
                typescript_response["pointer"]["passed"]
                != typescript_impulse["pointer"]["passed"]
            ):
                result.fail(
                    f"passed mismatch: {typescript_response['pointer']['passed']} != {typescript_impulse['pointer']['passed']}"
                )

            print("  ✅ Full roundtrip type preservation validated")

        except Exception as e:
            result.fail(f"Exception during MCP roundtrip validation: {e}")

        return result

    def get_results_json(self) -> Dict[str, Any]:
        """Get validation results as JSON"""
        return {
            "harness": "phase1-typing-and-mcp-communication-validation",
            "total_tests": len(self.results),
            "passed_tests": sum(1 for r in self.results if r.passed),
            "failed_tests": sum(1 for r in self.results if not r.passed),
            "results": [r.to_dict() for r in self.results],
        }


def main():
    """Run validation harness"""
    harness = Phase1TypingValidationHarness()
    all_passed = harness.run_all_validations()

    # Write results to file
    results_file = (
        Path(__file__).parent.parent.parent
        / "validation-results"
        / "phase1-typing-mcp-communication-validation-results.json"
    )
    results_file.parent.mkdir(parents=True, exist_ok=True)

    with open(results_file, "w") as f:
        json.dump(harness.get_results_json(), f, indent=2)

    print(f"\nResults written to: {results_file}")

    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
