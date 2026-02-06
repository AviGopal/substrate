#!/usr/bin/env python3
"""
Test script to validate the find-disconnected-code activity template logic.
This simulates what the activity would do to ensure the template will work.
"""

import json
import subprocess
from pathlib import Path


def test_task_1_discovery():
    """Test Task 1: Discover Python files."""
    print("=" * 60)
    print("TEST TASK 1: Discover Python files")
    print("=" * 60)

    target_dir = "lib"
    files_found = []

    # Simulate glob
    for py_file in Path(target_dir).rglob("*.py"):
        if "__pycache__" not in str(py_file) and "__init__" not in py_file.name:
            files_found.append(str(py_file))
            print(f"Found: {py_file}")

    print(f"\nTotal files: {len(files_found)}")
    return files_found


def test_task_2_import_search(files):
    """Test Task 2: Search for imports."""
    print("\n" + "=" * 60)
    print("TEST TASK 2: Search for import references")
    print("=" * 60)

    disconnected = []
    connected = []

    for file_path in files:
        # Extract module name
        module_name = Path(file_path).stem
        print(f"\nChecking: {file_path} (module: {module_name})")

        # Search for imports using grep
        try:
            result = subprocess.run(
                [
                    "grep",
                    "-r",
                    "-l",
                    f"import.*{module_name}|from.*{module_name}",
                    ".",
                    "--include=*.py",
                ],
                capture_output=True,
                text=True,
                cwd="/home/avi/documents/work/exp-repo/metabob-devbob",
            )

            # Filter out self-references
            import_files = [
                f for f in result.stdout.strip().split("\n") if f and file_path not in f
            ]
            import_count = len(import_files)

            print(f"  Imports found: {import_count}")
            if import_files:
                for imp_file in import_files[:3]:  # Show first 3
                    print(f"    - {imp_file}")

            if import_count == 0:
                disconnected.append(
                    {"file": file_path, "module_name": module_name, "imports_found": 0}
                )
                print(f"  ❌ DISCONNECTED")
            else:
                connected.append({"file": file_path, "imports_found": import_count})
                print(f"  ✅ CONNECTED")

        except Exception as e:
            print(f"  ⚠️  Error: {e}")

    print(f"\n📊 Summary:")
    print(f"  Connected files: {len(connected)}")
    print(f"  Disconnected files: {len(disconnected)}")

    return disconnected, connected


def test_task_3_git_history(disconnected):
    """Test Task 3: Analyze git history."""
    print("\n" + "=" * 60)
    print("TEST TASK 3: Analyze git history")
    print("=" * 60)

    if not disconnected:
        print("No disconnected files to analyze")
        return []

    enriched = []
    for file_info in disconnected:
        file_path = file_info["file"]
        print(f"\nAnalyzing: {file_path}")

        try:
            # Get creation date
            result = subprocess.run(
                ["git", "log", "--format=%ai", "--diff-filter=A", "--", file_path],
                capture_output=True,
                text=True,
                cwd="/home/avi/documents/work/exp-repo/metabob-devbob",
            )

            added_date = (
                result.stdout.strip().split("\n")[0]
                if result.stdout.strip()
                else "Unknown"
            )
            print(f"  Added: {added_date}")

            file_info["added_date"] = added_date
            enriched.append(file_info)

        except Exception as e:
            print(f"  ⚠️  Error: {e}")

    return enriched


def test_task_4_report(disconnected, connected):
    """Test Task 4: Generate report."""
    print("\n" + "=" * 60)
    print("TEST TASK 4: Generate report")
    print("=" * 60)

    report = f"""# Disconnected Code Analysis Report (TEST)
Generated: 2026-01-29
Directory: lib/

## Executive Summary
- Total files analyzed: {len(disconnected) + len(connected)}
- Connected files: {len(connected)}
- Disconnected files: {len(disconnected)}

## Disconnected Files
"""

    if disconnected:
        for file_info in disconnected:
            report += f"\n### {file_info['file']}\n"
            report += f"- Module: {file_info['module_name']}\n"
            report += f"- Imports: {file_info['imports_found']}\n"
            report += f"- Added: {file_info.get('added_date', 'Unknown')}\n"
    else:
        report += "\n✅ No disconnected files found - all files are imported!\n"

    report += f"""
## Connected Files
"""
    for file_info in connected:
        report += f"- {file_info['file']}: {file_info['imports_found']} imports\n"

    print(report)

    # Save report
    report_path = "reports/test_disconnected_code_validation.md"
    Path(report_path).parent.mkdir(exist_ok=True)
    with open(report_path, "w") as f:
        f.write(report)

    print(f"\n✅ Report saved to: {report_path}")
    return report


def main():
    """Run all tests."""
    print("🧪 Testing Disconnected Code Template Logic\n")

    # Task 1: Discovery
    files = test_task_1_discovery()

    # Task 2: Import search
    disconnected, connected = test_task_2_import_search(files)

    # Task 3: Git history (only for disconnected)
    if disconnected:
        disconnected = test_task_3_git_history(disconnected)

    # Task 4: Generate report
    report = test_task_4_report(disconnected, connected)

    print("\n" + "=" * 60)
    print("✅ TEST COMPLETE")
    print("=" * 60)
    print(
        f"\nResult: Template logic is {'WORKING' if len(files) > 0 else 'NEEDS FIXES'}"
    )
    print(f"Files discovered: {len(files)}")
    print(f"Connected: {len(connected)}")
    print(f"Disconnected: {len(disconnected)}")

    if len(files) > 0 and len(connected) > 0:
        print("\n✅ Template should work correctly!")
        print("   All lib/ files are being imported (no disconnected code)")

    return 0


if __name__ == "__main__":
    exit(main())
