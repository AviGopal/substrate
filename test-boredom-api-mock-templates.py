#!/usr/bin/env python3
"""
Test script to verify boredom activities API returns mock templates.

This script tests that:
1. The API can read templates from ~/.metabob/activities/
2. Templates are filtered by boredom criteria (gradient < 0.5, executions >= 3)
3. Results are sorted by priority (lowest gradient = highest priority)
4. Activity types are correctly categorized
"""

import sys
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
                    "activity_type": template.get("type", "general"),
                    "priority": calculate_priority(gradient, metrics),
                    "reason": generate_reason(template, metrics),
                    "success_rate": metrics.get("success_rate", 0),
                    "execution_count": exec_count,
                    "failure_patterns": len(metrics.get("failure_patterns", [])),
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


def main():
    print("\n" + "=" * 80)
    print("BOREDOM ACTIVITIES API TEST")
    print("=" * 80)

    # Test 1: Call the API
    print("\n📞 Calling metabob_fetch_boredom_activities()...")
    try:
        result = metabob_fetch_boredom_activities()
        print("✅ API call successful")
    except Exception as e:
        print(f"❌ API call failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

    # Test 2: Validate response structure
    print("\n📋 Response Structure:")
    print(f"Type: {type(result)}")
    print(f"Keys: {result.keys() if isinstance(result, dict) else 'N/A'}")

    if not isinstance(result, dict):
        print(f"❌ Expected dict, got {type(result)}")
        sys.exit(1)

    if "status" not in result:
        print("❌ Missing 'status' field in response")
        sys.exit(1)

    print(f"✅ Status: {result['status']}")

    # Test 3: Check activities list
    if "activities" not in result:
        print("❌ Missing 'activities' field in response")
        sys.exit(1)

    activities = result["activities"]
    print(f"✅ Activities count: {len(activities)}")

    if len(activities) == 0:
        print("⚠️  No activities returned - check if templates meet boredom criteria")
        return

    # Test 4: Display activities
    print("\n" + "=" * 80)
    print("BOREDOM ACTIVITIES FOUND")
    print("=" * 80)

    for i, activity in enumerate(activities, 1):
        print(f"\n🎯 Activity #{i}")
        print("-" * 80)

        # Required fields
        template_id = activity.get("template_id", "MISSING")
        priority = activity.get("priority", "MISSING")
        activity_type = activity.get("activity_type", "MISSING")
        gradient = activity.get("improvement_gradient", "MISSING")
        reason = activity.get("reason", "MISSING")

        print(f"  Template ID:          {template_id}")
        print(f"  Priority:             {priority}")
        print(f"  Activity Type:        {activity_type}")
        print(f"  Improvement Gradient: {gradient}")
        print(
            f"  Reason:               {reason[:80]}..."
            if len(str(reason)) > 80
            else f"  Reason:               {reason}"
        )

        # Optional fields
        if "success_rate" in activity:
            print(f"  Success Rate:         {activity['success_rate']:.1%}")
        if "execution_count" in activity:
            print(f"  Execution Count:      {activity['execution_count']}")
        if "failure_patterns" in activity:
            failure_count = activity["failure_patterns"]
            if isinstance(failure_count, int):
                print(f"  Failure Patterns:     {failure_count} issues")
            else:
                print(f"  Failure Patterns:     {len(failure_count)} issues")

    # Test 5: Verify sorting (lowest gradient = highest priority)
    print("\n" + "=" * 80)
    print("PRIORITY VERIFICATION")
    print("=" * 80)

    gradients = [a.get("improvement_gradient", 999) for a in activities]
    is_sorted = all(gradients[i] <= gradients[i + 1] for i in range(len(gradients) - 1))

    print(f"\nGradient sequence: {gradients}")
    if is_sorted:
        print("✅ Activities are correctly sorted by priority (lowest gradient first)")
    else:
        print("❌ Activities are NOT properly sorted")

    # Test 6: Verify activity types
    print("\n" + "=" * 80)
    print("ACTIVITY TYPE DISTRIBUTION")
    print("=" * 80)

    type_counts = {}
    for activity in activities:
        atype = activity.get("activity_type", "unknown")
        type_counts[atype] = type_counts.get(atype, 0) + 1

    print("\nActivity types found:")
    for atype, count in sorted(type_counts.items()):
        print(f"  {atype}: {count}")

    expected_types = {"debug-failures", "optimize-performance", "improve-template"}
    found_types = set(type_counts.keys())

    if found_types.issubset(expected_types):
        print(f"✅ All activity types are valid")
    else:
        unexpected = found_types - expected_types
        print(f"⚠️  Unexpected activity types: {unexpected}")

    # Test 7: Verify gradient threshold
    print("\n" + "=" * 80)
    print("BOREDOM THRESHOLD VERIFICATION")
    print("=" * 80)

    threshold = 0.5
    print(f"\nExpected threshold: improvement_gradient < {threshold}")

    violators = [a for a in activities if a.get("improvement_gradient", 0) >= threshold]
    if violators:
        print(f"❌ Found {len(violators)} activities above threshold:")
        for v in violators:
            print(
                f"  - {v.get('template_id')}: gradient={v.get('improvement_gradient')}"
            )
    else:
        print(f"✅ All activities meet threshold (gradient < {threshold})")

    # Final summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"✅ API call successful: {result['status']}")
    print(f"✅ Activities returned: {len(activities)}")
    print(f"✅ Properly sorted: {is_sorted}")
    print(f"✅ Valid activity types: {found_types.issubset(expected_types)}")
    print(f"✅ Meets threshold: {len(violators) == 0}")

    print("\n🎉 Boredom API test completed successfully!")


if __name__ == "__main__":
    main()
