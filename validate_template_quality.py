#!/usr/bin/env python3
"""
Template Quality Validator

Automated quality assessment for activity templates created by create-activity-template.

Usage:
    python3 validate_template_quality.py <template.json>
    python3 validate_template_quality.py db-migration-safe.json

Quality Checks:
    - Schema validation (JSON structure)
    - Task count (optimal: 3-5, acceptable: 2-7)
    - Prompt comprehensiveness (>1000 chars per task)
    - Validation coverage (>2 patterns per task avg)
    - Retry configuration (all tasks)
    - Variable definitions (reasonable count)
    - File size (indicates comprehensiveness)
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple


class TemplateQualityValidator:
    """Validates quality of activity templates"""

    # Quality thresholds
    MIN_PROMPT_LENGTH = 1000
    OPTIMAL_TASK_COUNT = (3, 5)
    ACCEPTABLE_TASK_COUNT = (2, 7)
    MIN_AVG_VALIDATION_PATTERNS = 2
    MIN_FILE_SIZE_KB = 20
    OPTIMAL_FILE_SIZE_KB = (30, 100)

    def __init__(self, template_path: str):
        self.path = Path(template_path)
        self.template: Dict[str, Any] = {}
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.passed_checks: List[str] = []

    def load_template(self) -> bool:
        """Load and parse JSON template"""
        try:
            with open(self.path, "r") as f:
                self.template = json.load(f)
            self.passed_checks.append(f"✓ Valid JSON structure")
            return True
        except json.JSONDecodeError as e:
            self.errors.append(f"✗ Invalid JSON: {e}")
            return False
        except FileNotFoundError:
            self.errors.append(f"✗ File not found: {self.path}")
            return False

    def validate_schema(self) -> bool:
        """Validate required fields"""
        required_fields = ["id", "name", "description", "category", "tasks"]
        missing = [f for f in required_fields if f not in self.template]

        if missing:
            self.errors.append(f"✗ Missing required fields: {', '.join(missing)}")
            return False

        self.passed_checks.append("✓ All required fields present")
        return True

    def validate_tasks(self) -> Tuple[bool, Dict[str, Any]]:
        """Validate task structure and quality"""
        tasks = self.template.get("tasks", [])
        task_count = len(tasks)

        metrics = {
            "count": task_count,
            "prompt_lengths": [],
            "validation_patterns": [],
            "has_retry": [],
            "agents": [],
        }

        # Task count
        if task_count == 0:
            self.errors.append("✗ No tasks defined")
            return False, metrics

        if self.OPTIMAL_TASK_COUNT[0] <= task_count <= self.OPTIMAL_TASK_COUNT[1]:
            self.passed_checks.append(f"✓ Optimal task count: {task_count}")
        elif (
            self.ACCEPTABLE_TASK_COUNT[0] <= task_count <= self.ACCEPTABLE_TASK_COUNT[1]
        ):
            self.warnings.append(
                f"⚠ Task count {task_count} (acceptable but not optimal)"
            )
        else:
            self.errors.append(f"✗ Task count {task_count} out of range (2-7)")

        # Analyze each task
        for i, task in enumerate(tasks):
            task_id = task.get("id", f"task-{i}")

            # Check required task fields
            required_task_fields = [
                "id",
                "subagent",
                "description",
                "prompt",
                "validation",
                "retry",
            ]
            missing_task_fields = [f for f in required_task_fields if f not in task]

            if missing_task_fields:
                self.errors.append(
                    f"✗ Task {task_id} missing: {', '.join(missing_task_fields)}"
                )
                continue

            # Prompt length
            prompt_template = task.get("prompt", {}).get("template", "")
            prompt_len = len(prompt_template)
            metrics["prompt_lengths"].append(prompt_len)

            if prompt_len < self.MIN_PROMPT_LENGTH:
                self.warnings.append(
                    f"⚠ Task {task_id} prompt too short: {prompt_len} chars"
                )

            # Validation patterns
            validation = task.get("validation", {})
            patterns = validation.get("requiredPatterns", [])
            metrics["validation_patterns"].append(len(patterns))

            # Retry config
            has_retry = task.get("retry") is not None
            metrics["has_retry"].append(has_retry)

            # Agent
            agent = task.get("subagent", "unknown")
            metrics["agents"].append(agent)

        # Check all tasks have prompts > min length
        if all(l >= self.MIN_PROMPT_LENGTH for l in metrics["prompt_lengths"]):
            self.passed_checks.append(
                f"✓ All prompts comprehensive (>{self.MIN_PROMPT_LENGTH} chars)"
            )

        # Check all tasks have validation
        avg_patterns = (
            sum(metrics["validation_patterns"]) / len(metrics["validation_patterns"])
            if metrics["validation_patterns"]
            else 0
        )
        if avg_patterns >= self.MIN_AVG_VALIDATION_PATTERNS:
            self.passed_checks.append(
                f"✓ Strong validation coverage (avg {avg_patterns:.1f} patterns/task)"
            )
        else:
            self.warnings.append(
                f"⚠ Weak validation coverage (avg {avg_patterns:.1f} patterns/task)"
            )

        # Check all tasks have retry
        if all(metrics["has_retry"]):
            self.passed_checks.append("✓ All tasks have retry configuration")
        else:
            self.errors.append("✗ Some tasks missing retry configuration")

        return True, metrics

    def validate_variables(self) -> bool:
        """Validate variable definitions"""
        # Check template-level variables
        template_vars = self.template.get("variables", [])

        # Check task-level variables
        task_vars = []
        for task in self.template.get("tasks", []):
            prompt = task.get("prompt", {})
            task_vars.extend(prompt.get("variables", []))

        total_vars = len(template_vars) + len(task_vars)

        if total_vars == 0:
            self.warnings.append(
                "⚠ No variables defined (template may not be reusable)"
            )
        elif total_vars > 10:
            self.warnings.append(
                f"⚠ Many variables ({total_vars}) - may be complex to use"
            )
        else:
            self.passed_checks.append(f"✓ Reasonable variable count: {total_vars}")

        return True

    def validate_file_size(self) -> bool:
        """Validate file size as proxy for comprehensiveness"""
        size_kb = self.path.stat().st_size / 1024

        if size_kb < self.MIN_FILE_SIZE_KB:
            self.warnings.append(
                f"⚠ Small file size: {size_kb:.1f}KB (may lack detail)"
            )
        elif self.OPTIMAL_FILE_SIZE_KB[0] <= size_kb <= self.OPTIMAL_FILE_SIZE_KB[1]:
            self.passed_checks.append(f"✓ Optimal file size: {size_kb:.1f}KB")
        elif size_kb > self.OPTIMAL_FILE_SIZE_KB[1]:
            self.warnings.append(
                f"⚠ Large file size: {size_kb:.1f}KB (may be too complex)"
            )
        else:
            self.passed_checks.append(f"✓ Acceptable file size: {size_kb:.1f}KB")

        return True

    def calculate_score(self, task_metrics: Dict[str, Any]) -> int:
        """Calculate overall quality score (0-100)"""
        score = 100

        # Deduct for errors
        score -= len(self.errors) * 20

        # Deduct for warnings
        score -= len(self.warnings) * 5

        # Bonus for passed checks
        score += len(self.passed_checks) * 2

        # Cap at 100
        return min(max(score, 0), 100)

    def print_report(self, task_metrics: Dict[str, Any]):
        """Print comprehensive quality report"""
        print("=" * 70)
        print(f"Template Quality Report: {self.path.name}")
        print("=" * 70)
        print()

        # Basic info
        print("📄 Template Information:")
        print(f"  Name: {self.template.get('name', 'N/A')}")
        print(f"  Category: {self.template.get('category', 'N/A')}")
        print(f"  Description: {self.template.get('description', 'N/A')[:80]}...")
        print()

        # Metrics
        print("📊 Metrics:")
        print(f"  File size: {self.path.stat().st_size / 1024:.1f} KB")
        print(f"  Task count: {task_metrics['count']}")
        print(f"  Total lines: {sum(1 for _ in open(self.path))}")
        print()

        # Task details
        if task_metrics["prompt_lengths"]:
            print("📝 Task Prompt Lengths:")
            for i, length in enumerate(task_metrics["prompt_lengths"], 1):
                status = "✓" if length >= self.MIN_PROMPT_LENGTH else "⚠"
                print(f"  {status} Task {i}: {length:,} chars")
            print(
                f"  Average: {sum(task_metrics['prompt_lengths']) / len(task_metrics['prompt_lengths']):,.0f} chars"
            )
            print()

        if task_metrics["validation_patterns"]:
            print("✅ Validation Coverage:")
            total_patterns = sum(task_metrics["validation_patterns"])
            avg_patterns = total_patterns / len(task_metrics["validation_patterns"])
            print(f"  Total patterns: {total_patterns}")
            print(f"  Average per task: {avg_patterns:.1f}")
            print()

        # Agent diversity
        if task_metrics["agents"]:
            unique_agents = set(task_metrics["agents"])
            print("🤖 Agent Assignments:")
            for agent in unique_agents:
                count = task_metrics["agents"].count(agent)
                print(f"  {agent}: {count} task(s)")
            print()

        # Quality checks
        if self.passed_checks:
            print("✅ Passed Checks:")
            for check in self.passed_checks:
                print(f"  {check}")
            print()

        if self.warnings:
            print("⚠️  Warnings:")
            for warning in self.warnings:
                print(f"  {warning}")
            print()

        if self.errors:
            print("❌ Errors:")
            for error in self.errors:
                print(f"  {error}")
            print()

        # Overall score
        score = self.calculate_score(task_metrics)
        print("=" * 70)
        print(f"Overall Quality Score: {score}/100")

        if score >= 90:
            grade = "A+ (Excellent)"
            verdict = "✅ PASS - Production Ready"
        elif score >= 80:
            grade = "A (Very Good)"
            verdict = "✅ PASS - Minor improvements recommended"
        elif score >= 70:
            grade = "B (Good)"
            verdict = "⚠️  CONDITIONAL PASS - Address warnings"
        elif score >= 60:
            grade = "C (Acceptable)"
            verdict = "⚠️  CONDITIONAL PASS - Significant improvements needed"
        else:
            grade = "F (Poor)"
            verdict = "❌ FAIL - Major issues found"

        print(f"Grade: {grade}")
        print(f"Verdict: {verdict}")
        print("=" * 70)

        return score >= 70  # Pass threshold

    def validate(self) -> bool:
        """Run all validation checks"""
        if not self.load_template():
            return False

        if not self.validate_schema():
            return False

        success, task_metrics = self.validate_tasks()
        if not success:
            task_metrics = {
                "count": 0,
                "prompt_lengths": [],
                "validation_patterns": [],
                "has_retry": [],
                "agents": [],
            }

        self.validate_variables()
        self.validate_file_size()

        return self.print_report(task_metrics)


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 validate_template_quality.py <template.json>")
        sys.exit(1)

    template_path = sys.argv[1]
    validator = TemplateQualityValidator(template_path)

    passed = validator.validate()
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
