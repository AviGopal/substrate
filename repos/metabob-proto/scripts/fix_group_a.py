#!/usr/bin/env python3
"""
Fix Group A bootstrap templates (proto-aligned structure, just missing fields).

Group A templates:
- feature-impl.json
- bug-fix.json
- jiggle-documentation.json

These already have correct structure, just missing:
- subagent field
- impulse_refs array
"""

import json
from pathlib import Path

# Group A: Templates with correct structure
GROUP_A_FILES = ["feature-impl.json", "bug-fix.json", "jiggle-documentation.json"]


def main():
    script_dir = Path(__file__).parent
    repo_dir = script_dir.parent
    bootstrap_dir = repo_dir / "activities" / "bootstrap"

    print("=" * 80)
    print("Fixing Group A Bootstrap Templates")
    print("=" * 80)
    print()

    for filename in GROUP_A_FILES:
        filepath = bootstrap_dir / filename

        if not filepath.exists():
            print(f"❌ {filename}: File not found")
            continue

        print(f"📄 {filename}")

        with open(filepath, "r") as f:
            data = json.load(f)

        # Determine field name (task_steps or tasks)
        if "task_steps" in data:
            field = "task_steps"
        elif "tasks" in data:
            field = "tasks"
        else:
            print(f"  ❌ No task_steps or tasks field found")
            continue

        print(f"  Field name: {field}")
        print(f"  Tasks: {len(data[field])}")

        changes = 0

        # Add missing fields to each task
        for i, task in enumerate(data[field]):
            task_id = task.get("id", f"task-{i}")

            if "subagent" not in task:
                task["subagent"] = "general"
                print(f"    Task {i + 1} ({task_id}): Added subagent = 'general'")
                changes += 1

            if "impulse_refs" not in task:
                task["impulse_refs"] = []
                print(f"    Task {i + 1} ({task_id}): Added impulse_refs = []")
                changes += 1

            if "metrics" not in task:
                task["metrics"] = {
                    "success_rate": 0.0,
                    "avg_tokens": 0,
                    "avg_duration": 0,
                    "common_failures": [],
                }
                print(f"    Task {i + 1} ({task_id}): Added metrics object")
                changes += 1

            if "impulse_refs" not in task:
                task["impulse_refs"] = []
                print(f"    Task {i + 1} ({task_id}): Added impulse_refs = []")
                changes += 1

        if changes > 0:
            # Write back with pretty formatting
            with open(filepath, "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")  # Add trailing newline

            print(f"  ✅ Fixed {changes} fields")
        else:
            print(f"  ✅ Already correct")

        print()

    print("=" * 80)
    print("✅ Group A fixes complete!")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Review changes: git diff activities/bootstrap/")
    print("  2. Validate: python scripts/fix_bootstrap_templates.py --validate-only")
    print("  3. Commit: git add activities/bootstrap/ && git commit")


if __name__ == "__main__":
    main()
