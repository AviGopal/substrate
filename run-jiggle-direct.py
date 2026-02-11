#!/usr/bin/env python3
"""
Direct execution of jiggle-documentation activity workflow.

Since the activity registration has format incompatibilities, this script
manually executes the jiggle workflow by delegating each task to subagents.
"""

import json
from pathlib import Path


def main():
    """Execute jiggle-documentation activity directly"""

    print("🎯 JIGGLE DOCUMENTATION ACTIVITY - DIRECT EXECUTION")
    print("=" * 70)
    print()

    # Load the jiggle template
    template_path = (
        Path(__file__).parent
        / "repos"
        / "metabob-proto"
        / "activities"
        / "bootstrap"
        / "jiggle-documentation.json"
    )

    if not template_path.exists():
        print(f"❌ Template not found: {template_path}")
        return

    with open(template_path) as f:
        template_data = json.load(f)

    print(f"✅ Loaded template: {template_data.get('name')}")
    print(f"   Description: {template_data.get('description')}")
    print(f"   Tasks: {len(template_data.get('tasks', []))}")
    print()

    # Parse variables with defaults
    variables = {
        "scope": "entire repo",
        "recentDays": 30,
        "mediumDays": 90,
        "obsoleteDays": 180,
        "mode": "dryRun",
        "archiveInsteadOfDelete": True,
        "archivePath": ".archive/docs",
        "excludePaths": "node_modules,dist,build,.git",
    }

    print("📋 Configuration:")
    for key, value in variables.items():
        print(f"   {key}: {value}")
    print()

    # Execute each task
    print("🚀 Executing tasks...")
    print("-" * 70)

    tasks = template_data.get("tasks", [])

    for i, task in enumerate(tasks, 1):
        task_id = task.get("id", f"task-{i}")
        description = task.get("description", "No description")

        print(f"\n[Task {i}/{len(tasks)}] {task_id}")
        print(f"Description: {description}")
        print()

        # Get prompt template
        prompt_data = task.get("prompt", {})
        prompt_template = prompt_data.get("template", "")

        # Substitute variables in prompt
        prompt = prompt_template
        for var_name, var_value in variables.items():
            prompt = prompt.replace(f"{{{{{var_name}}}}}", str(var_value))

        print(f"Prompt preview (first 300 chars):")
        print(prompt[:300])
        print("...")
        print()

        # In a real execution, this would delegate to a subagent
        # For now, just show what would be executed
        print(
            f"✓ Task prepared (would execute with subagent: {task.get('subagent', 'general')})"
        )
        print()

    print("=" * 70)
    print("✅ Activity workflow prepared successfully!")
    print()
    print("Next steps:")
    print("  1. Each task would be executed by a subagent")
    print("  2. Subagents would use tools to analyze, percolate, and clean docs")
    print("  3. Reports would be generated: doc-jiggle-analysis.md, etc.")
    print("  4. In dry-run mode, no files are actually modified")
    print()
    print("To execute for real, integrate with OpenCode activity tool or MCP server")


if __name__ == "__main__":
    main()
