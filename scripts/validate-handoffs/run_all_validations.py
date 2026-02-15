#!/usr/bin/env python3
"""
Master Test Runner: Data Handoff Validation

Runs all 12 handoff validation tests and generates a comprehensive report.

Usage:
    python run_all_validations.py [--verbose] [--stop-on-failure]
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, List, Any


# Test result tracking
class TestResult:
    def __init__(self, test_name: str):
        self.test_name = test_name
        self.passed = False
        self.duration_ms = 0
        self.error: str | None = None
        self.details = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_name": self.test_name,
            "passed": self.passed,
            "duration_ms": self.duration_ms,
            "error": self.error,
            "details": self.details,
        }


class ValidationSuite:
    def __init__(self, verbose: bool = False, stop_on_failure: bool = False):
        self.verbose = verbose
        self.stop_on_failure = stop_on_failure
        self.results: List[TestResult] = []
        self.start_time = time.time()

    def run_test(self, test_module: str) -> TestResult:
        """Run a single validation test module."""
        test_name = test_module.replace("_", " ").title()
        result = TestResult(test_name)

        print(f"\n{'=' * 70}")
        print(f"Running: {test_name}")
        print(f"{'=' * 70}")

        start = time.time()

        try:
            # Import and run test
            module = __import__(test_module, fromlist=["run_validation"])
            if hasattr(module, "run_validation"):
                test_result = module.run_validation(verbose=self.verbose)
                result.passed = test_result.get("passed", False)
                result.details = test_result.get("details", {})
                result.error = test_result.get("error")
            else:
                result.error = f"Module {test_module} missing run_validation() function"
        except Exception as e:
            result.error = str(e)
            if self.verbose:
                import traceback

                print(traceback.format_exc())

        result.duration_ms = int((time.time() - start) * 1000)

        # Print result
        status = "✅ PASSED" if result.passed else "❌ FAILED"
        print(f"\n{status} ({result.duration_ms}ms)")
        if result.error:
            print(f"Error: {result.error}")

        self.results.append(result)

        if not result.passed and self.stop_on_failure:
            print("\n⚠️  Stopping due to failure (--stop-on-failure)")
            sys.exit(1)

        return result

    def generate_report(self) -> str:
        """Generate markdown validation report."""
        total_duration = int((time.time() - self.start_time) * 1000)
        passed_count = sum(1 for r in self.results if r.passed)
        total_count = len(self.results)
        pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0

        report = []
        report.append("# Data Handoff Validation Report")
        report.append("")
        report.append(f"**Generated**: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**Duration**: {total_duration}ms")
        report.append(f"**Pass Rate**: {pass_rate:.1f}% ({passed_count}/{total_count})")
        report.append("")

        if pass_rate == 100:
            report.append("## ✅ ALL TESTS PASSED")
        else:
            report.append(f"## ⚠️  {total_count - passed_count} TESTS FAILED")

        report.append("")
        report.append("---")
        report.append("")
        report.append("## Test Results")
        report.append("")
        report.append("| # | Test | Status | Duration | Details |")
        report.append("|---|------|--------|----------|---------|")

        for i, result in enumerate(self.results, 1):
            status = "✅ PASS" if result.passed else "❌ FAIL"
            error_summary = result.error[:50] if result.error else "-"
            report.append(
                f"| {i} | {result.test_name} | {status} | {result.duration_ms}ms | {error_summary} |"
            )

        report.append("")
        report.append("---")
        report.append("")
        report.append("## Detailed Results")
        report.append("")

        for i, result in enumerate(self.results, 1):
            report.append(f"### {i}. {result.test_name}")
            report.append("")
            report.append(
                f"**Status**: {'✅ PASSED' if result.passed else '❌ FAILED'}"
            )
            report.append(f"**Duration**: {result.duration_ms}ms")
            report.append("")

            if result.error:
                report.append("**Error**:")
                report.append("```")
                report.append(result.error)
                report.append("```")
                report.append("")

            if result.details:
                report.append("**Details**:")
                report.append("```json")
                report.append(json.dumps(result.details, indent=2))
                report.append("```")
                report.append("")

        report.append("---")
        report.append("")
        report.append("## Summary")
        report.append("")
        report.append(f"- **Total Tests**: {total_count}")
        report.append(f"- **Passed**: {passed_count}")
        report.append(f"- **Failed**: {total_count - passed_count}")
        report.append(f"- **Pass Rate**: {pass_rate:.1f}%")
        report.append(f"- **Total Duration**: {total_duration}ms")
        report.append("")

        if pass_rate == 100:
            report.append("✅ **All data handoffs validated successfully!**")
        else:
            report.append(
                "⚠️  **Some handoffs failed validation. Review failures above.**"
            )

        return "\n".join(report)

    def save_report(self, output_path: Path):
        """Save report to file."""
        report = self.generate_report()
        output_path.write_text(report)
        print(f"\n📄 Report saved: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Run data handoff validation tests")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument(
        "--stop-on-failure", "-s", action="store_true", help="Stop on first failure"
    )
    parser.add_argument(
        "--output", "-o", default="validation_report.md", help="Output report path"
    )
    parser.add_argument(
        "--test", "-t", help="Run specific test only (e.g., '01_session_creation')"
    )
    args = parser.parse_args()

    suite = ValidationSuite(verbose=args.verbose, stop_on_failure=args.stop_on_failure)

    # Test modules in order
    tests = [
        "01_session_creation",
        "02_activity_search",
        "03_activity_execution_start",
        "04_activity_step_recording",
        "05_activity_execution_complete",
        "06_component_annotation",
        "07_template_creation",
        "08_template_loading",
        "09_session_token_refresh",
        "10_priority_issues",
        "11_change_impact_analysis",
        "12_deletion_safety_assessment",
    ]

    if args.test:
        # Run specific test
        tests = [args.test]

    print("=" * 70)
    print("DATA HANDOFF VALIDATION SUITE")
    print("=" * 70)
    print(f"Tests to run: {len(tests)}")
    print(f"Verbose: {args.verbose}")
    print(f"Stop on failure: {args.stop_on_failure}")
    print("=" * 70)

    # Run all tests
    for test in tests:
        suite.run_test(test)

    # Generate and save report
    output_path = Path(args.output)
    suite.save_report(output_path)

    # Print summary
    print("\n" + "=" * 70)
    print("VALIDATION COMPLETE")
    print("=" * 70)

    passed = sum(1 for r in suite.results if r.passed)
    total = len(suite.results)
    print(f"Results: {passed}/{total} passed ({passed / total * 100:.1f}%)")

    if passed == total:
        print("✅ All handoffs validated successfully!")
        return 0
    else:
        print(f"❌ {total - passed} handoff(s) failed validation")
        return 1


if __name__ == "__main__":
    sys.exit(main())
