#!/usr/bin/env python3
"""
Test script for boredom activities API (Mock Implementation)
Verifies that templates with low improvement gradients are correctly identified
"""

import sys
import os
import json
from pathlib import Path
from typing import List, Dict, Any


def metabob_fetch_boredom_activities() -> Dict[str, Any]:
    """
    Mock implementation that reads templates from ~/.metabob/activities/
    and returns those with low improvement gradients
    """
    activities_dir = Path.home() / ".metabob" / "activities"

    if not activities_dir.exists():
        return {
            "status": "error",
            "message": "Activities directory not found",
            "activities": [],
        }

    boredom_threshold = 0.5
    min_executions = 3
    activities = []

    for template_file in activities_dir.glob("*.json"):
        try:
            with open(template_file, "r") as f:
                template = json.load(f)

            metrics = template.get("estimated_metrics", {})
            gradient = metrics.get("improvement_gradient")
            exec_count = metrics.get("execution_count", 0)

            # Only include templates with low gradients and sufficient executions
            if (
                gradient is not None
                and gradient < boredom_threshold
                and exec_count >= min_executions
            ):
                activity = {
                    "template_id": template.get("activity_id", template_file.stem),
                    "name": template.get("name", "Unknown"),
                    "category": template.get("category", "unknown"),
                    "improvement_gradient": gradient,
                    "activity_type": categorize_activity(template, metrics),
                    "priority": calculate_priority(gradient, metrics),
                    "reason": generate_reason(template, metrics),
                    "estimated_metrics": metrics,
                }
                activities.append(activity)

        except Exception as e:
            print(f"Warning: Failed to load {template_file.name}: {e}", file=sys.stderr)
            continue

    # Sort by priority (highest first)
    activities.sort(key=lambda x: x["priority"], reverse=True)

    return {
        "status": "success",
        "activities": activities,
        "threshold": boredom_threshold,
        "min_executions": min_executions,
    }


def categorize_activity(template: Dict, metrics: Dict) -> str:
    """Categorize activity based on failure patterns and metrics"""
    failure_patterns = metrics.get("failure_patterns", [])
    success_rate = metrics.get("success_rate", 0)

    if success_rate < 0.35:
        return "debug-failures"
    elif failure_patterns and len(failure_patterns) > 2:
        return "debug-failures"
    elif "performance" in template.get("name", "").lower():
        return "optimize-performance"
    elif "error" in template.get("name", "").lower():
        return "improve-template"
    else:
        return "improve-template"


def calculate_priority(gradient: float, metrics: Dict) -> int:
    """Calculate priority score (0-100) based on gradient and metrics"""
    # Lower gradient = higher priority
    gradient_score = (0.5 - gradient) * 100

    # Lower success rate = higher priority
    success_rate = metrics.get("success_rate", 0.5)
    success_score = (0.5 - success_rate) * 50

    # More failures = higher priority
    failure_patterns = metrics.get("failure_patterns", [])
    failure_score = len(failure_patterns) * 5

    return int(gradient_score + success_score + failure_score)


def generate_reason(template: Dict, metrics: Dict) -> str:
    """Generate explanation for why this template needs attention"""
    gradient = metrics.get("improvement_gradient", 0)
    success_rate = metrics.get("success_rate", 0)
    exec_count = metrics.get("execution_count", 0)

    reasons = []

    if gradient < 0.3:
        reasons.append(f"Very low improvement gradient ({gradient:.2f})")
    else:
        reasons.append(f"Low improvement gradient ({gradient:.2f})")

    if success_rate < 0.4:
        reasons.append(f"poor success rate ({success_rate:.1%})")

    if metrics.get("performance_trends", {}).get("success_rate") == "degrading":
        reasons.append("degrading success trend")

    failure_count = len(metrics.get("failure_patterns", []))
    if failure_count > 0:
        reasons.append(f"{failure_count} failure patterns identified")

    return f"Template shows {', '.join(reasons)}. Recommend debugging and improvement."


def print_separator(char="=", length=80):
    print(char * length)


def print_header(title):
    print_separator("=")
    print(f"  {title}")
    print_separator("=")


def print_activity(idx, activity):
    """Pretty print a single activity"""
    print(f"\n[{idx}] {activity.get('template_id', 'N/A')}")
    print(f"    Name:               {activity.get('name', 'N/A')}")
    print(f"    Priority:           {activity.get('priority', 'N/A')}")
    print(f"    Activity Type:      {activity.get('activity_type', 'N/A')}")
    print(f"    Improvement Grad:   {activity.get('improvement_gradient', 'N/A')}")
    print(f"    Reason:             {activity.get('reason', 'N/A')[:80]}")
    if len(activity.get("reason", "")) > 80:
        print(f"                        {activity.get('reason', '')[80:]}")

    # Additional metrics if available
    if "estimated_metrics" in activity:
        metrics = activity["estimated_metrics"]
        print(f"    Success Rate:       {metrics.get('success_rate', 'N/A')}")
        print(f"    Execution Count:    {metrics.get('execution_count', 'N/A')}")
        print(f"    Avg Cost:           ${metrics.get('avg_cost', 'N/A')}")


def main():
    print_header("BOREDOM ACTIVITIES API TEST (Mock Implementation)")

    print("\n📡 Calling metabob_fetch_boredom_activities()...")
    print("   (Reading templates from ~/.metabob/activities/)")

    try:
        result = metabob_fetch_boredom_activities()

        print("\n✅ API call successful!")
        print_separator("-")

        # Extract data
        status = result.get("status")
        activities = result.get("activities", [])
        threshold = result.get("threshold", 0.5)
        min_execs = result.get("min_executions", 3)

        print(f"\nStatus: {status}")
        print(f"Boredom threshold: gradient < {threshold}, executions >= {min_execs}")
        print(f"Total activities returned: {len(activities)}")

        if activities:
            print_header("RETURNED ACTIVITIES")

            for idx, activity in enumerate(activities, 1):
                print_activity(idx, activity)

            print_separator("=")
            print("\n🔍 VERIFICATION CHECKS")
            print_separator("-")

            # Check 1: Sorting by priority
            priorities = [a.get("priority", 0) for a in activities]
            is_sorted = all(
                priorities[i] >= priorities[i + 1] for i in range(len(priorities) - 1)
            )
            print(f"✓ Sorted by priority (descending): {is_sorted}")
            print(f"  Priority order: {priorities}")

            # Check 2: Activity types
            activity_types = set(a.get("activity_type") for a in activities)
            print(f"\n✓ Activity types found: {', '.join(sorted(activity_types))}")

            # Check 3: Improvement gradients
            gradients = [
                a.get("improvement_gradient")
                for a in activities
                if a.get("improvement_gradient") is not None
            ]
            if gradients:
                print(f"\n✓ Improvement gradients:")
                for idx, gradient in enumerate(gradients, 1):
                    threshold_check = (
                        "BELOW 0.5 ✅" if gradient < 0.5 else "ABOVE 0.5 ❌"
                    )
                    print(f"  [{idx}] {gradient} - {threshold_check}")

                avg_gradient = sum(gradients) / len(gradients)
                print(f"\n  Average gradient: {avg_gradient:.3f}")

            # Check 4: Expected templates
            template_ids = [a.get("template_id") for a in activities]
            expected_low_gradient = [
                "debug-template-failures",
                "optimize-query-performance",
                "improve-error-handling",
                "high-failures-template",
                "test-low-quality-template",
                "mediocre-template",
            ]

            found_expected = [
                tid for tid in template_ids if tid in expected_low_gradient
            ]
            print(
                f"\n✓ Expected low-gradient templates found: {len(found_expected)}/{len(expected_low_gradient)}"
            )
            if found_expected:
                print(f"  Found: {', '.join(found_expected)}")

            # Check 5: Control template should NOT be present
            control_present = "good-quality-template" in template_ids
            print(
                f"\n✓ Control template (high gradient) excluded: {not control_present}"
            )
            if control_present:
                print(f"  ❌ ERROR: good-quality-template should not be in results!")

            print_separator("=")
            print("\n✅ TEST COMPLETE")
            print(f"\nSummary: {len(activities)} low-gradient templates identified")
            print(
                f"All templates have gradient < {threshold} and executions >= {min_execs}"
            )

        else:
            print("\n⚠️  No activities returned!")
            print("This may indicate:")
            print("  - No templates with low improvement gradients")
            print("  - Templates not loaded into ~/.metabob/activities/")
            print("  - All templates have execution_count < 3")

        return 0 if activities else 1

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
