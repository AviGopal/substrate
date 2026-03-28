#!/usr/bin/env python3
"""
Validation Runner: Complete MCP Data Flow for Activity and Impulse System

Tests all MCP tools for proper registration and basic functionality.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add metabob-cli to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "repos" / "metabob-cli"))

try:
    from metabob_cli.mcp import activity_template_tools
except ImportError as e:
    print(f"Error importing MCP tools: {e}")
    print("Make sure metabob-cli is in the correct location")
    sys.exit(1)


class ValidationRunner:
    """Runs validation tests for MCP data flow"""

    def __init__(self):
        self.results = []
        self.required_tools = [
            "metabob_post_activity_result",
            "metabob_create_activity_variant",
            "metabob_recommend_activities",
            "metabob_recommend_impulses",
            "metabob_fetch_boredom_activities",
        ]

    def test_tool_registration(self):
        """Test 1: Verify all required MCP tools are registered"""
        print("\n[TEST 1] Tool Registration Check")
        print("=" * 60)

        available_tools = []
        for tool_name in self.required_tools:
            if hasattr(activity_template_tools, tool_name):
                available_tools.append(tool_name)
                print(f"  ✓ {tool_name}")
            else:
                print(f"  ✗ {tool_name} - NOT FOUND")

        passed = len(available_tools) == len(self.required_tools)
        self.results.append(
            {
                "test": "Tool Registration",
                "passed": passed,
                "expected": len(self.required_tools),
                "actual": len(available_tools),
                "details": {
                    "required": self.required_tools,
                    "available": available_tools,
                },
            }
        )

        return passed

    async def test_post_activity_result(self):
        """Test 2: Test metabob_post_activity_result with sample data"""
        print("\n[TEST 2] metabob_post_activity_result")
        print("=" * 60)

        try:
            result = await activity_template_tools.metabob_post_activity_result(
                activity_id="test-validation-001",
                result={
                    "success": True,
                    "duration": 30000,
                    "cost": 0.015,
                    "tokens": {
                        "input": 3000,
                        "output": 1500,
                        "cache": 500,
                    },
                },
            )

            # Check response structure
            has_status = "status" in result
            is_success_or_error = result.get("status") in ["success", "error"]

            if result.get("status") == "success":
                print(f"  ✓ Tool executed successfully")
                print(f"    Response: {json.dumps(result, indent=2)}")
                passed = True
            else:
                print(f"  ⚠ Tool returned error (expected if backend not running)")
                print(f"    Error: {result.get('error', 'Unknown error')}")
                passed = False  # Expected to fail if backend not running

            self.results.append(
                {
                    "test": "metabob_post_activity_result",
                    "passed": passed,
                    "expected": {"status": "success"},
                    "actual": result,
                    "details": {
                        "has_proper_structure": has_status and is_success_or_error,
                        "note": "May fail if backend not running - this is expected",
                    },
                }
            )

            return passed

        except Exception as e:
            print(f"  ✗ Tool execution failed: {e}")
            self.results.append(
                {
                    "test": "metabob_post_activity_result",
                    "passed": False,
                    "expected": {"status": "success"},
                    "actual": str(e),
                    "error": str(e),
                }
            )
            return False

    async def test_create_activity_variant(self):
        """Test 3: Test metabob_create_activity_variant"""
        print("\n[TEST 3] metabob_create_activity_variant")
        print("=" * 60)

        try:
            result = await activity_template_tools.metabob_create_activity_variant(
                base_template_id="test-base-001",
                variant_definition={"tasks": []},
                metadata={
                    "name": "test-variant",
                    "description": "Validation test variant",
                    "reason_for_creation": "Automated validation",
                },
            )

            has_status = "status" in result

            if result.get("status") == "success":
                print(f"  ✓ Tool executed successfully")
                print(f"    Variant ID: {result.get('variant_id', 'N/A')}")
                passed = True
            else:
                print(f"  ⚠ Tool returned error (expected if backend not running)")
                print(f"    Error: {result.get('error', 'Unknown error')}")
                passed = False

            self.results.append(
                {
                    "test": "metabob_create_activity_variant",
                    "passed": passed,
                    "expected": {"status": "success", "variant_id": "<string>"},
                    "actual": result,
                    "details": {
                        "has_proper_structure": has_status,
                        "note": "May fail if backend endpoint not implemented",
                    },
                }
            )

            return passed

        except Exception as e:
            print(f"  ✗ Tool execution failed: {e}")
            self.results.append(
                {
                    "test": "metabob_create_activity_variant",
                    "passed": False,
                    "expected": {"status": "success"},
                    "actual": str(e),
                    "error": str(e),
                }
            )
            return False

    async def test_recommend_activities(self):
        """Test 4: Test metabob_recommend_activities"""
        print("\n[TEST 4] metabob_recommend_activities")
        print("=" * 60)

        try:
            result = await activity_template_tools.metabob_recommend_activities(
                task_description="Implement user authentication",
                category="feature",
                loaded_impulses=["imp-001"],
                limit=5,
            )

            has_status = "status" in result
            has_recommendations = "recommendations" in result

            if result.get("status") == "success":
                print(f"  ✓ Tool executed successfully")
                print(f"    Recommendations: {len(result.get('recommendations', []))}")
                passed = True
            else:
                print(f"  ⚠ Tool returned error (expected if backend not running)")
                print(f"    Error: {result.get('error', 'Unknown error')}")
                passed = False

            self.results.append(
                {
                    "test": "metabob_recommend_activities",
                    "passed": passed,
                    "expected": {"status": "success", "recommendations": []},
                    "actual": result,
                    "details": {
                        "has_proper_structure": has_status and has_recommendations,
                        "note": "May fail if backend ML service not implemented",
                    },
                }
            )

            return passed

        except Exception as e:
            print(f"  ✗ Tool execution failed: {e}")
            self.results.append(
                {
                    "test": "metabob_recommend_activities",
                    "passed": False,
                    "expected": {"status": "success"},
                    "actual": str(e),
                    "error": str(e),
                }
            )
            return False

    async def test_recommend_impulses(self):
        """Test 5: Test metabob_recommend_impulses"""
        print("\n[TEST 5] metabob_recommend_impulses")
        print("=" * 60)

        try:
            result = await activity_template_tools.metabob_recommend_impulses(
                activity_id="add-authentication",
                task_description="Adding JWT authentication",
                limit=10,
            )

            has_status = "status" in result
            has_recommendations = "recommendations" in result

            if result.get("status") == "success":
                print(f"  ✓ Tool executed successfully")
                print(
                    f"    Impulse Recommendations: {len(result.get('recommendations', []))}"
                )
                passed = True
            else:
                print(f"  ⚠ Tool returned error (expected if backend not running)")
                print(f"    Error: {result.get('error', 'Unknown error')}")
                passed = False

            self.results.append(
                {
                    "test": "metabob_recommend_impulses",
                    "passed": passed,
                    "expected": {"status": "success", "recommendations": []},
                    "actual": result,
                    "details": {
                        "has_proper_structure": has_status and has_recommendations,
                        "note": "May fail if backend endpoint not implemented",
                    },
                }
            )

            return passed

        except Exception as e:
            print(f"  ✗ Tool execution failed: {e}")
            self.results.append(
                {
                    "test": "metabob_recommend_impulses",
                    "passed": False,
                    "expected": {"status": "success"},
                    "actual": str(e),
                    "error": str(e),
                }
            )
            return False

    async def test_fetch_boredom_activities(self):
        """Test 6: Test metabob_fetch_boredom_activities"""
        print("\n[TEST 6] metabob_fetch_boredom_activities")
        print("=" * 60)

        try:
            result = await activity_template_tools.metabob_fetch_boredom_activities(
                priority_threshold=0.5, max_activities=5
            )

            has_status = "status" in result
            has_activities = "activities" in result

            if result.get("status") == "success":
                print(f"  ✓ Tool executed successfully")
                print(f"    Boredom Activities: {len(result.get('activities', []))}")
                passed = True
            else:
                print(f"  ⚠ Tool returned error (expected if backend not running)")
                print(f"    Error: {result.get('error', 'Unknown error')}")
                passed = False

            self.results.append(
                {
                    "test": "metabob_fetch_boredom_activities",
                    "passed": passed,
                    "expected": {"status": "success", "activities": []},
                    "actual": result,
                    "details": {
                        "has_proper_structure": has_status and has_activities,
                        "note": "May fail if backend not running",
                    },
                }
            )

            return passed

        except Exception as e:
            print(f"  ✗ Tool execution failed: {e}")
            self.results.append(
                {
                    "test": "metabob_fetch_boredom_activities",
                    "passed": False,
                    "expected": {"status": "success"},
                    "actual": str(e),
                    "error": str(e),
                }
            )
            return False

    async def run_all_tests(self):
        """Run all validation tests"""
        print("\n" + "=" * 60)
        print("VALIDATION: Complete MCP Data Flow for Activity and Impulse System")
        print("=" * 60)

        # Test 1: Tool Registration (synchronous)
        registration_passed = self.test_tool_registration()

        # Tests 2-6: Tool Execution (asynchronous)
        if registration_passed:
            await self.test_post_activity_result()
            await self.test_create_activity_variant()
            await self.test_recommend_activities()
            await self.test_recommend_impulses()
            await self.test_fetch_boredom_activities()
        else:
            print("\n⚠ Skipping execution tests due to registration failures")

        # Summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)

        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["passed"])
        failed_tests = total_tests - passed_tests

        print(f"Total Tests:  {total_tests}")
        print(f"Passed:       {passed_tests} ({100 * passed_tests / total_tests:.1f}%)")
        print(f"Failed:       {failed_tests} ({100 * failed_tests / total_tests:.1f}%)")

        if failed_tests == 0:
            print("\n✓ ALL TESTS PASSED")
            overall_status = "PASS"
        else:
            print(f"\n✗ {failed_tests} TESTS FAILED")
            overall_status = "FAIL"

        # Write results to file
        output = {
            "specification": "Complete MCP Data Flow for Activity and Impulse System",
            "timestamp": "2026-03-08",
            "overall_status": overall_status,
            "summary": {
                "total": total_tests,
                "passed": passed_tests,
                "failed": failed_tests,
            },
            "results": self.results,
        }

        output_path = (
            Path(__file__).parent.parent.parent
            / "validation-results"
            / "complete-mcp-data-flow.json"
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(output, indent=2))

        print(f"\nResults written to: {output_path}")

        return output


if __name__ == "__main__":
    runner = ValidationRunner()
    output = asyncio.run(runner.run_all_tests())

    # Exit with code 0 if all passed, 1 if any failed
    sys.exit(0 if output["overall_status"] == "PASS" else 1)
