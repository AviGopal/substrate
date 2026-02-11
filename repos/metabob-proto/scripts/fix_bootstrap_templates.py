#!/usr/bin/env python3
"""
Fix bootstrap templates to be fully proto-aligned.

This script adds missing required fields to bootstrap activity templates:
1. Adds 'subagent' field to all task_steps (defaults to 'general')
2. Adds 'impulse_refs' array to all task_steps (defaults to [])
3. Ensures all required nested objects exist
4. Backs up original files before modification

Usage:
    python scripts/fix_bootstrap_templates.py
    python scripts/fix_bootstrap_templates.py --dry-run  # Preview changes
    python scripts/fix_bootstrap_templates.py --validate-only  # Just validate
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any
import argparse
from datetime import datetime
import shutil


def validate_task_step(task: Dict[str, Any], task_index: int) -> List[str]:
    """Validate a single task step against proto schema."""
    errors = []

    # Required fields
    if not task.get("id"):
        errors.append(f"Task {task_index}: Missing 'id' field")

    if not task.get("subagent"):
        errors.append(f"Task {task_index}: Missing 'subagent' field (CRITICAL)")

    if not task.get("description"):
        errors.append(f"Task {task_index}: Missing 'description' field")

    if "dependencies" not in task:
        errors.append(f"Task {task_index}: Missing 'dependencies' field")

    # Required nested objects
    if not task.get("prompt"):
        errors.append(f"Task {task_index}: Missing 'prompt' object")
    elif not isinstance(task["prompt"], dict):
        errors.append(f"Task {task_index}: 'prompt' must be object, not string")
    else:
        if not task["prompt"].get("template"):
            errors.append(f"Task {task_index}: Missing 'prompt.template' field")

    if not task.get("validation"):
        errors.append(f"Task {task_index}: Missing 'validation' object")

    if not task.get("retry"):
        errors.append(f"Task {task_index}: Missing 'retry' object")

    if not task.get("metrics"):
        errors.append(f"Task {task_index}: Missing 'metrics' object")

    # Critical for learning system
    if "impulse_refs" not in task:
        errors.append(
            f"Task {task_index}: Missing 'impulse_refs' array (CRITICAL for learning)"
        )

    return errors


def fix_task_step(task: Dict[str, Any]) -> Dict[str, Any]:
    """Add missing required fields to a task step."""
    fixed_task = task.copy()

    # Add subagent if missing (default to 'general')
    if "subagent" not in fixed_task:
        fixed_task["subagent"] = "general"
        print(f"    Added: subagent = 'general'")

    # Add impulse_refs if missing
    if "impulse_refs" not in fixed_task:
        fixed_task["impulse_refs"] = []
        print(f"    Added: impulse_refs = []")

    # Ensure dependencies exists (can be empty)
    if "dependencies" not in fixed_task:
        fixed_task["dependencies"] = []
        print(f"    Added: dependencies = []")

    # Ensure validation exists
    if "validation" not in fixed_task:
        fixed_task["validation"] = {
            "required_files": [],
            "required_patterns": [],
            "forbidden_patterns": [],
            "commands": [],
        }
        print(f"    Added: validation object")

    # Ensure retry exists
    if "retry" not in fixed_task:
        fixed_task["retry"] = {
            "max_attempts": 3,
            "strategy": "simple",
            "fallback_prompt": "",
        }
        print(f"    Added: retry object")

    # Ensure metrics exists
    if "metrics" not in fixed_task:
        fixed_task["metrics"] = {
            "success_rate": 0.0,
            "avg_tokens": 0,
            "avg_duration": 0,
            "common_failures": [],
        }
        print(f"    Added: metrics object")

    return fixed_task


def fix_template(
    template_data: Dict[str, Any], filename: str
) -> tuple[Dict[str, Any], int]:
    """Fix a complete template. Returns (fixed_template, num_fixes)."""
    fixed_template = template_data.copy()
    num_fixes = 0

    # Handle both 'task_steps' and 'tasks' field names
    task_field = "task_steps" if "task_steps" in fixed_template else "tasks"

    if task_field not in fixed_template:
        print(f"  ⚠️  No '{task_field}' field found")
        return fixed_template, 0

    tasks = fixed_template[task_field]
    fixed_tasks = []

    for i, task in enumerate(tasks):
        print(f"  Task {i + 1}: {task.get('id', 'UNKNOWN')}")

        # Validate before fixing
        errors_before = validate_task_step(task, i)
        if errors_before:
            num_fixes += len(errors_before)

        # Apply fixes
        fixed_task = fix_task_step(task)

        # Validate after fixing
        errors_after = validate_task_step(fixed_task, i)
        if errors_after:
            print(f"    ⚠️  Still has errors after fix: {errors_after}")
        else:
            print(f"    ✓ Valid")

        fixed_tasks.append(fixed_task)

    fixed_template[task_field] = fixed_tasks
    return fixed_template, num_fixes


def backup_file(filepath: Path) -> Path:
    """Create backup of file with timestamp."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = filepath.with_suffix(f".backup.{timestamp}{filepath.suffix}")
    shutil.copy2(filepath, backup_path)
    return backup_path


def main():
    parser = argparse.ArgumentParser(description="Fix bootstrap activity templates")
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview changes without writing"
    )
    parser.add_argument(
        "--validate-only", action="store_true", help="Only validate, don't fix"
    )
    parser.add_argument(
        "--no-backup", action="store_true", help="Don't create backup files"
    )
    args = parser.parse_args()

    # Find bootstrap templates
    script_dir = Path(__file__).parent
    repo_dir = script_dir.parent
    bootstrap_dir = repo_dir / "activities" / "bootstrap"

    if not bootstrap_dir.exists():
        print(f"❌ Bootstrap directory not found: {bootstrap_dir}")
        sys.exit(1)

    template_files = sorted(bootstrap_dir.glob("*.json"))

    if not template_files:
        print(f"❌ No template files found in {bootstrap_dir}")
        sys.exit(1)

    print("=" * 80)
    print("Bootstrap Template Fix Script")
    print("=" * 80)
    print(f"Found {len(template_files)} templates to process")
    print(
        f"Mode: {'VALIDATE ONLY' if args.validate_only else 'DRY RUN' if args.dry_run else 'FIX'}"
    )
    print()

    total_fixes = 0
    templates_fixed = 0
    templates_with_errors = []

    for template_file in template_files:
        print(f"\n📄 {template_file.name}")
        print("-" * 80)

        try:
            with open(template_file, "r") as f:
                template_data = json.load(f)

            # Validate or fix
            if args.validate_only:
                # Just validate
                task_field = "task_steps" if "task_steps" in template_data else "tasks"
                tasks = template_data.get(task_field, [])

                all_errors = []
                for i, task in enumerate(tasks):
                    errors = validate_task_step(task, i)
                    all_errors.extend(errors)

                if all_errors:
                    print(f"  ❌ {len(all_errors)} validation errors:")
                    for error in all_errors:
                        print(f"    - {error}")
                    templates_with_errors.append(template_file.name)
                else:
                    print(f"  ✅ Valid")

            else:
                # Fix
                fixed_template, num_fixes = fix_template(
                    template_data, template_file.name
                )

                if num_fixes > 0:
                    total_fixes += num_fixes
                    templates_fixed += 1

                    if not args.dry_run:
                        # Backup original
                        if not args.no_backup:
                            backup_path = backup_file(template_file)
                            print(f"  💾 Backup: {backup_path.name}")

                        # Write fixed template
                        with open(template_file, "w") as f:
                            json.dump(fixed_template, f, indent=2, ensure_ascii=False)
                            f.write("\n")  # Add trailing newline

                        print(f"  ✅ Fixed {num_fixes} issues")
                    else:
                        print(f"  ℹ️  Would fix {num_fixes} issues (dry-run)")
                else:
                    print(f"  ✅ No fixes needed")

        except Exception as e:
            print(f"  ❌ Error processing file: {e}")
            templates_with_errors.append(template_file.name)

    # Summary
    print()
    print("=" * 80)
    print("Summary")
    print("=" * 80)

    if args.validate_only:
        if templates_with_errors:
            print(f"❌ {len(templates_with_errors)} templates have validation errors:")
            for name in templates_with_errors:
                print(f"  - {name}")
            sys.exit(1)
        else:
            print(f"✅ All {len(template_files)} templates are valid!")
            sys.exit(0)
    else:
        print(f"Templates processed: {len(template_files)}")
        print(f"Templates fixed: {templates_fixed}")
        print(f"Total fixes applied: {total_fixes}")

        if args.dry_run:
            print()
            print("ℹ️  This was a dry-run. No files were modified.")
            print("   Run without --dry-run to apply fixes.")
        elif templates_fixed > 0:
            print()
            print("✅ Templates have been fixed!")
            print()
            print("Next steps:")
            print("  1. Review the changes: git diff activities/bootstrap/")
            print(
                "  2. Validate: python scripts/fix_bootstrap_templates.py --validate-only"
            )
            print(
                "  3. Commit: git add activities/bootstrap/ && git commit -m 'Fix bootstrap templates: add missing required fields'"
            )
        else:
            print()
            print("✅ All templates were already correct!")

        sys.exit(0)


if __name__ == "__main__":
    main()
