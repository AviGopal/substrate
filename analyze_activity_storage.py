#!/usr/bin/env python3
"""
Analyze activity storage to identify test data vs real executions
"""

import json
from pathlib import Path
from collections import defaultdict
import os

storage_dir = Path.home() / ".local/share/opencode/storage/activity"

if not storage_dir.exists():
    print(f"Storage directory not found: {storage_dir}")
    exit(1)

activities = []
for activity_file in storage_dir.glob("*.json"):
    try:
        with open(activity_file) as f:
            data = json.load(f)
            activities.append(
                {
                    "file": activity_file.name,
                    "id": data.get("id", "unknown"),
                    "templateId": data.get("templateId", "unknown"),
                    "status": data.get("status", "unknown"),
                    "title": data.get("title", ""),
                    "startedAt": data.get("startedAt", 0),
                    "duration": data.get("stats", {}).get("duration", 0),
                    "cost": data.get("stats", {}).get("cost", {}).get("total", 0),
                    "sessions": len(
                        data.get("executionEvidence", {}).get("sessionsSpawned", [])
                    ),
                    "toolCalls": len(
                        data.get("executionEvidence", {}).get("toolCalls", [])
                    ),
                }
            )
    except Exception as e:
        print(f"Error reading {activity_file.name}: {e}")

# Group by status
by_status = defaultdict(list)
for act in activities:
    by_status[act["status"]].append(act)

# Group by template
by_template = defaultdict(list)
for act in activities:
    by_template[act["templateId"]].append(act)

print("=" * 80)
print("ACTIVITY STORAGE ANALYSIS")
print("=" * 80)
print(f"\nTotal activities: {len(activities)}")
print(f"Storage location: {storage_dir}")

print("\n" + "=" * 80)
print("STATUS DISTRIBUTION")
print("=" * 80)
for status, acts in sorted(by_status.items(), key=lambda x: -len(x[1])):
    print(
        f"\n{status.upper()}: {len(acts)} activities ({len(acts) * 100 // len(activities)}%)"
    )
    for act in sorted(acts, key=lambda x: x["startedAt"], reverse=True)[:3]:
        print(f"  • {act['templateId'][:30]:30s} | {act['title'][:50]:50s}")

print("\n" + "=" * 80)
print("TEMPLATE DISTRIBUTION")
print("=" * 80)
for template, acts in sorted(by_template.items(), key=lambda x: -len(x[1])):
    status_counts = {}
    for act in acts:
        status_counts[act["status"]] = status_counts.get(act["status"], 0) + 1

    statuses = ", ".join([f"{s}={c}" for s, c in status_counts.items()])
    is_test = "test-template-" in template or "base-template-" in template
    marker = " [TEST]" if is_test else ""
    print(f"  {template[:40]:40s} | {len(acts):2d} executions | {statuses}{marker}")

print("\n" + "=" * 80)
print("TEST DATA IDENTIFICATION")
print("=" * 80)

test_patterns = ["test-template-", "base-template-", "[TEST]", "[EVIDENCE_TEST]"]
test_activities = [
    act
    for act in activities
    if any(
        pattern in act["templateId"] or pattern in act["title"]
        for pattern in test_patterns
    )
]

print(f"\nFound {len(test_activities)} test activities:")
for act in test_activities:
    print(f"  • {act['file']:40s} | {act['templateId']:30s} | {act['status']}")

print("\n" + "=" * 80)
print("EVIDENCE COLLECTION VERIFICATION")
print("=" * 80)

executed_activities = [act for act in activities if act["sessions"] > 0]
print(
    f"\nActivities with sessions spawned: {len(executed_activities)}/{len(activities)}"
)
for act in executed_activities:
    duration_sec = act["duration"] / 1000
    print(
        f"  • {act['templateId'][:30]:30s} | {act['status']:8s} | "
        f"{act['sessions']} sessions | {act['toolCalls']} tools | "
        f"{duration_sec:.1f}s | ${act['cost']:.4f}"
    )

print("\n" + "=" * 80)
print("RECOMMENDATIONS")
print("=" * 80)
print(f"""
1. Archive test activities: {len(test_activities)} files
   - Create: ~/.local/share/opencode/storage/activity-archive/test-data/
   - Move: All files with test-template-*, base-template-*, [TEST], [EVIDENCE_TEST]

2. Real executions to analyze: {len(executed_activities)} activities
   - These have actual evidence data to study
   - Can compute real success rates, costs, durations

3. Current success rate: 0/{len(activities)} (0%)
   - All activities are either 'setup' or 'failed'
   - Need to investigate template validation issues
""")
