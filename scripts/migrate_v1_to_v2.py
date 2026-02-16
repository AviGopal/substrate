#!/usr/bin/env python3
"""Migrate V1 templates to V2 format (rename task_steps → tasks)

This script migrates the remaining V1 templates to V2 format by renaming
the parent key from 'task_steps' to 'tasks'. All task structures are already
V2-compliant, so this is just a cosmetic key rename.

Author: Metabob DevBob
Date: February 16, 2026
"""

import json
from pathlib import Path
from typing import Dict, Any

# Configuration
BOOTSTRAP_DIR = Path("repos/metabob-proto/activities/bootstrap")
V1_TEMPLATES = [
    "activity-create-v2.json",
    "add-rest-endpoint.json",
    "fix-security-bug.json",
    "safe-refactor.json",
]


def migrate_template(file_path: Path) -> bool:
    """Migrate single template file

    Args:
        file_path: Path to template JSON file

    Returns:
        True if migration successful, False otherwise
    """
    print(f"\n{'=' * 60}")
    print(f"Migrating: {file_path.name}")
    print("=" * 60)

    try:
        # Read template
        template_text = file_path.read_text()
        template = json.loads(template_text)

        # Check if migration needed
        if "task_steps" not in template:
            if "tasks" in template:
                print(f"⏭️  Already V2 (has 'tasks' key)")
                return True
            else:
                print(f"⚠️  No tasks or task_steps found")
                return False

        # Verify task structure is V2-compliant
        tasks = template["task_steps"]
        if not tasks:
            print(f"⚠️  Empty task_steps array")
            return False

        first_task = tasks[0]
        required_keys = {"id", "subagent", "description"}
        v2_keys = {"prompt", "validation", "retry", "metrics"}

        if not required_keys.issubset(first_task.keys()):
            print(
                f"❌ Task structure missing required keys: {required_keys - first_task.keys()}"
            )
            return False

        if not v2_keys.intersection(first_task.keys()):
            print(f"⚠️  Task structure may not be V2-compliant (missing V2 fields)")
            # Continue anyway, as we want to migrate

        print(f"✓ Task structure verified ({len(first_task.keys())} keys)")
        print(f"✓ {len(tasks)} tasks found")

        # Create backup
        backup_path = file_path.with_suffix(".json.bak")
        backup_path.write_text(template_text)
        print(f"💾 Backup created: {backup_path.name}")

        # Migrate: rename key
        template["tasks"] = template.pop("task_steps")

        # Write back with proper formatting
        migrated_json = json.dumps(template, indent=2, ensure_ascii=False)
        file_path.write_text(migrated_json + "\n")

        print(f"✅ Migration complete: {len(template['tasks'])} tasks")
        print(f"   Key renamed: task_steps → tasks")

        return True

    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}")
        return False
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False


def verify_all_v2(bootstrap_dir: Path) -> Dict[str, int]:
    """Verify all templates after migration

    Args:
        bootstrap_dir: Path to bootstrap directory

    Returns:
        Dict with counts: {v2: N, v1: N, unknown: N}
    """
    counts = {"v2": 0, "v1": 0, "unknown": 0}

    print(f"\n{'=' * 60}")
    print("VERIFICATION: Checking all templates")
    print("=" * 60)

    for template_file in sorted(bootstrap_dir.glob("*.json")):
        # Skip backup files
        if template_file.suffix == ".bak" or template_file.name.endswith(".json.bak"):
            continue

        try:
            template = json.loads(template_file.read_text())

            if "tasks" in template:
                schema = "V2"
                counts["v2"] += 1
                status = "✅"
            elif "task_steps" in template:
                schema = "V1"
                counts["v1"] += 1
                status = "🔧"
            else:
                schema = "UNKNOWN"
                counts["unknown"] += 1
                status = "❓"

            task_count = len(template.get("tasks", template.get("task_steps", [])))
            print(f"{status} {schema:8} | {task_count} tasks | {template_file.name}")

        except Exception as e:
            print(f"❌ ERROR    | {template_file.name}: {e}")
            counts["unknown"] += 1

    return counts


def main():
    """Main migration procedure"""
    print("=" * 60)
    print("TEMPLATE SCHEMA MIGRATION: V1 → V2")
    print("=" * 60)
    print(f"Directory: {BOOTSTRAP_DIR}")
    print(f"Templates to migrate: {len(V1_TEMPLATES)}")
    print()

    # Check directory exists
    if not BOOTSTRAP_DIR.exists():
        print(f"❌ Directory not found: {BOOTSTRAP_DIR}")
        print(f"   Current working directory: {Path.cwd()}")
        print(f"   Please run from metabob-devbob root directory")
        return 1

    # Migrate each template
    results = []
    for template_name in V1_TEMPLATES:
        file_path = BOOTSTRAP_DIR / template_name

        if not file_path.exists():
            print(f"\n⚠️  {template_name}: File not found")
            results.append(False)
            continue

        success = migrate_template(file_path)
        results.append(success)

    # Summary
    print(f"\n{'=' * 60}")
    print("MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Templates processed: {len(results)}")
    print(f"Successful: {sum(results)}")
    print(f"Failed: {len(results) - sum(results)}")

    # Verify all templates
    counts = verify_all_v2(BOOTSTRAP_DIR)

    print(f"\n{'=' * 60}")
    print("FINAL STATE")
    print("=" * 60)
    print(f"V2 templates: {counts['v2']}")
    print(f"V1 templates: {counts['v1']}")
    print(f"Unknown: {counts['unknown']}")

    # Success check
    if counts["v1"] == 0:
        print(f"\n✨ SUCCESS: All templates migrated to V2!")
        print()
        print("Next steps:")
        print(
            "1. Verify JSON: jq '.tasks | length' repos/metabob-proto/activities/bootstrap/*.json"
        )
        print("2. Test upload: python3 scripts/bootstrap_core_templates.py")
        print("3. Commit: git add repos/metabob-proto/activities/bootstrap/*.json")
        print(
            "4. Commit: git commit -m 'migrate: rename task_steps → tasks for V2 compatibility'"
        )
        return 0
    else:
        print(f"\n⚠️  WARNING: {counts['v1']} templates still in V1 format")
        print("Review output above for errors")
        return 1


if __name__ == "__main__":
    exit(main())
