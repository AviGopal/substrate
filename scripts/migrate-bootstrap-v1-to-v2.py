#!/usr/bin/env python3
"""
Migrate bootstrap templates from V1 to V2 schema.

This script handles two groups of templates:
- Group A: Already V2-compliant tasks, only need task_steps → tasks rename
- Group B: V1 tasks with step_id/title, need full transformation

Usage:
    python3 scripts/migrate-bootstrap-v1-to-v2.py [--dry-run]
"""

import json
import sys
import shutil
from pathlib import Path
from typing import Dict, Any, List

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
BOOTSTRAP_DIR = PROJECT_ROOT / "repos/metabob-proto/activities/bootstrap"


def detect_group(template: Dict[str, Any]) -> str:
    """
    Detect if template is Group A (v2 tasks) or Group B (v1 tasks).

    Group A: Tasks already have 'id' and 'subagent' fields (V2 format)
    Group B: Tasks have 'step_id' and 'title' fields (V1 format)
    """
    if "task_steps" not in template:
        return "A"  # No tasks (e.g., jiggle-documentation)

    tasks = template["task_steps"]
    if not tasks:
        return "A"  # Empty tasks

    first_task = tasks[0]

    # Group A has 'id' field and 'subagent', Group B has 'step_id' and 'title'
    if "id" in first_task and "subagent" in first_task:
        return "A"
    elif "step_id" in first_task or "title" in first_task:
        return "B"

    # Default to B for safety
    return "B"


def migrate_group_a(template: Dict[str, Any]) -> Dict[str, Any]:
    """
    Group A migration: Simple rename task_steps → tasks.

    These templates already have V2 task structure with all required fields.
    """
    if "task_steps" in template:
        template["tasks"] = template.pop("task_steps")
    return template


def migrate_v1_task_to_v2(v1_task: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert V1 task format to V2 format.

    V1 format:
        {
          "step_id": "...",
          "title": "...",
          "description": "...",
          "guidance": [...],
          "tools": [...]
        }

    V2 format:
        {
          "id": "...",
          "subagent": "general",
          "description": "...",
          "dependencies": [],
          "guidance": [...],
          "impulse_refs": [],
          "prompt": {...},
          "validation": {...},
          "retry": {...},
          "metrics": {...},
          "tools": {...}
        }
    """
    # Merge title and description
    description = v1_task.get("description", "")
    title = v1_task.get("title", "")

    # Prefer description, but use title if description is empty
    if not description and title:
        full_description = title
    elif description and title and title not in description:
        full_description = f"{title}: {description}"
    else:
        full_description = description or title or "No description"

    # Map tools from array to object
    tools_list = v1_task.get("tools", [])
    tools = {
        "required": tools_list if tools_list else [],
        "optional": [],
        "disabled": [],
    }

    # Build V2 task
    v2_task = {
        "id": v1_task.get("step_id", "unknown"),
        "subagent": "general",  # Default subagent
        "description": full_description,
        "dependencies": v1_task.get("dependencies", []),
        "guidance": v1_task.get("guidance", []),
        "impulse_refs": [],
        "prompt": {
            "template": full_description,
            "max_tokens": 8000,
            "compression_strategy": "filter",
            "variables": [],
        },
        "validation": {
            "required_files": [],
            "required_patterns": [],
            "forbidden_patterns": [],
            "commands": [],
        },
        "retry": {"max_attempts": 3, "strategy": "simple", "fallback_prompt": ""},
        "metrics": {
            "success_rate": 0,
            "avg_tokens": 0,
            "avg_duration": 0,
            "common_failures": [],
        },
        "tools": tools,
    }

    return v2_task


def migrate_group_b(template: Dict[str, Any]) -> Dict[str, Any]:
    """
    Group B migration: Full transformation of V1 tasks to V2 + rename.

    Converts each task from V1 format to V2 format, then renames the parent key.
    """
    if "task_steps" in template:
        v1_tasks = template.pop("task_steps")
        template["tasks"] = [migrate_v1_task_to_v2(task) for task in v1_tasks]
    return template


def migrate_template(file_path: Path, dry_run: bool = False) -> bool:
    """
    Migrate a single template file.

    Args:
        file_path: Path to the template JSON file
        dry_run: If True, don't write changes

    Returns:
        True if migration succeeded, False otherwise
    """
    print(f"\n{'=' * 60}")
    print(f"Processing: {file_path.name}")

    try:
        # Read template
        with open(file_path, "r", encoding="utf-8") as f:
            template = json.load(f)

        # Detect group
        group = detect_group(template)
        task_count = len(template.get("task_steps", []))
        print(f"Group: {group} | Tasks: {task_count}")

        # Show migration type
        if group == "A":
            if task_count == 0:
                print("Migration: No tasks, only rename parent key if present")
            else:
                print("Migration: task_steps → tasks (simple rename, tasks already V2)")
        else:  # Group B
            print("Migration: Full V1 → V2 task transformation + rename")

        # Backup original (unless dry run)
        if not dry_run:
            backup_path = file_path.with_suffix(".json.backup")
            shutil.copy(file_path, backup_path)
            print(f"Backup: {backup_path.name}")
        else:
            print("Backup: [DRY RUN - skipped]")

        # Migrate
        if group == "A":
            migrated = migrate_group_a(template)
        else:  # Group B
            migrated = migrate_group_b(template)

        # Write back (unless dry run)
        if not dry_run:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(migrated, f, indent=2, ensure_ascii=False)
                f.write("\n")  # Add trailing newline
            print(f"✓ Migrated: {file_path.name}")
        else:
            print(f"✓ Would migrate: {file_path.name} [DRY RUN]")

            # Show a preview of changes
            if "tasks" in migrated:
                first_task = migrated["tasks"][0] if migrated["tasks"] else None
                if first_task:
                    print(
                        f"  Preview - First task keys: {', '.join(first_task.keys())}"
                    )

        return True

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()
        return False


def main():
    """Migrate all bootstrap templates."""
    # Check for --dry-run flag
    dry_run = "--dry-run" in sys.argv

    print("=" * 60)
    print("Bootstrap Template V1 → V2 Migration")
    if dry_run:
        print("[DRY RUN MODE - No files will be modified]")
    print("=" * 60)

    # Check bootstrap directory
    if not BOOTSTRAP_DIR.exists():
        print(f"\n✗ Bootstrap directory not found: {BOOTSTRAP_DIR}")
        sys.exit(1)

    # Find all JSON files
    template_files = sorted(BOOTSTRAP_DIR.glob("*.json"))

    # Exclude backup files
    template_files = [f for f in template_files if not f.name.endswith(".backup")]

    print(f"\nFound {len(template_files)} templates")
    print(f"Location: {BOOTSTRAP_DIR}")

    # Migrate each template
    success = 0
    failed = []

    for file_path in template_files:
        if migrate_template(file_path, dry_run=dry_run):
            success += 1
        else:
            failed.append(file_path.name)

    # Summary
    print(f"\n{'=' * 60}")
    print("Migration Summary")
    print("=" * 60)
    print(f"Total templates: {len(template_files)}")
    print(f"✓ Succeeded: {success}")

    if failed:
        print(f"✗ Failed: {len(failed)}")
        print(f"  Files: {', '.join(failed)}")

    if dry_run:
        print("\n[DRY RUN COMPLETE - No files were modified]")
        print("Run without --dry-run to apply changes")
    else:
        print(f"\n✓ Migration complete!")
        print(f"  Backup files created: *.json.backup")
        print(f"  To revert: restore from backup files")

    print("=" * 60)

    # Exit code
    sys.exit(0 if len(failed) == 0 else 1)


if __name__ == "__main__":
    main()
