#!/usr/bin/env python3
"""
Simple test of activity-create-v2 template in sterile environment.
Uses Python SDK to directly test the template without full ACP setup.
"""

import json
import sys
from pathlib import Path


def main():
    print("=" * 60)
    print("Activity Template Sterile Environment Test")
    print("=" * 60)
    print()

    # 1. Verify template exists
    template_path = Path(
        "repos/metabob-proto/activities/bootstrap/activity-create-v2.json"
    )
    print(f"1. Checking template: {template_path}")

    if not template_path.exists():
        print(f"   ❌ Template not found at {template_path}")
        return 1

    print("   ✅ Template file exists")

    # 2. Load and validate JSON
    print()
    print("2. Validating template JSON...")
    try:
        with open(template_path) as f:
            template = json.load(f)
        print("   ✅ Valid JSON")
    except json.JSONDecodeError as e:
        print(f"   ❌ Invalid JSON: {e}")
        return 1

    # 3. Check template structure
    print()
    print("3. Analyzing template structure...")

    required_fields = [
        "variant_id",
        "activity_id",
        "variant_name",
        "version",
        "description",
        "variables",
        "task_steps",
    ]

    missing_fields = [f for f in required_fields if f not in template]
    if missing_fields:
        print(f"   ❌ Missing required fields: {missing_fields}")
        return 1

    print(f"   ✅ All required fields present")
    print(f"   📊 Template ID: {template['variant_id']}")
    print(f"   📊 Version: {template['version']}")
    print(f"   📊 Steps: {len(template['task_steps'])}")

    # 4. Analyze steps for source code dependencies
    print()
    print("4. Checking for source code dependencies...")

    steps = template["task_steps"]
    source_code_dependencies = []

    for i, step in enumerate(steps, 1):
        step_id = step.get("id", f"step-{i}")
        prompt_template = step.get("prompt", {}).get("template", "")
        tools_required = step.get("tools", {}).get("required", [])

        # Check if step tries to read source files
        suspicious_patterns = [
            "read source",
            "analyze code",
            "scan repository",
            "git log",
            "git diff",
        ]

        has_suspicious_pattern = any(
            pattern in prompt_template.lower() for pattern in suspicious_patterns
        )

        # Check if step requires file reading tools inappropriately
        inappropriate_reads = "read" in tools_required and step_id not in [
            "define-scope",
            "design-steps",
            "create-template",
            "create-summary",
        ]

        if has_suspicious_pattern or inappropriate_reads:
            source_code_dependencies.append(
                {
                    "step": step_id,
                    "issue": "Potential source code dependency",
                    "tools": tools_required,
                    "prompt_excerpt": prompt_template[:100],
                }
            )

    if source_code_dependencies:
        print(f"   ⚠️  Found {len(source_code_dependencies)} potential dependencies:")
        for dep in source_code_dependencies:
            print(f"      - {dep['step']}: {dep['issue']}")
    else:
        print("   ✅ No source code dependencies detected")

    # 5. Check variables
    print()
    print("5. Analyzing required variables...")

    variables = template.get("variables", {})
    required_vars = [
        name
        for name, spec in variables.items()
        if isinstance(spec, dict) and spec.get("required", False)
    ]
    optional_vars = [
        name
        for name, spec in variables.items()
        if isinstance(spec, dict) and not spec.get("required", False)
    ]

    print(f"   Required variables: {len(required_vars)}")
    for var in required_vars:
        desc = variables[var].get("description", "No description")
        print(f"      - {var}: {desc}")

    print(f"   Optional variables: {len(optional_vars)}")
    for var in optional_vars:
        desc = variables[var].get("description", "No description")
        print(f"      - {var}: {desc}")

    # 6. Check new functionality usage
    print()
    print("6. Validating use of new functionality...")

    uses_register_tool = False
    uses_activity_tool = False
    uses_hooks = False

    for step in steps:
        tools_required = step.get("tools", {}).get("required", [])
        if "register_activity_template" in tools_required:
            uses_register_tool = True
            print(f"   ✅ Step '{step['id']}' uses register_activity_template")
        if "activity" in tools_required:
            uses_activity_tool = True
            print(f"   ✅ Step '{step['id']}' uses activity tool")

    if template.get("hooks"):
        uses_hooks = True
        hooks = template["hooks"]
        print(f"   ✅ Template uses hooks:")
        if "preActivity" in hooks:
            print(f"      - preActivity: {list(hooks['preActivity'].keys())}")
        if "postActivity" in hooks:
            print(f"      - postActivity: {list(hooks['postActivity'].keys())}")
        if "onError" in hooks:
            print(f"      - onError: {list(hooks['onError'].keys())}")

    if not uses_register_tool:
        print("   ⚠️  Template doesn't use register_activity_template tool")
    if not uses_activity_tool:
        print("   ⚠️  Template doesn't use activity tool for testing")
    if not uses_hooks:
        print("   ⚠️  Template doesn't define hooks")

    # 7. Sterile environment readiness summary
    print()
    print("=" * 60)
    print("STERILE ENVIRONMENT READINESS ASSESSMENT")
    print("=" * 60)

    criteria = {
        "Valid JSON structure": True,
        "Required fields present": len(missing_fields) == 0,
        "No source code dependencies": len(source_code_dependencies) == 0,
        "Variables are user-provided": len(required_vars) > 0,
        "Uses register_activity_template": uses_register_tool,
        "Uses activity tool": uses_activity_tool,
        "Uses hooks": uses_hooks,
    }

    passed = sum(1 for v in criteria.values() if v)
    total = len(criteria)

    for criterion, status in criteria.items():
        icon = "✅" if status else "❌"
        print(f"{icon} {criterion}")

    print()
    print(f"Score: {passed}/{total} criteria met")

    if passed == total:
        print()
        print("✅ Template is READY for sterile environment deployment")
        print()
        print("Next steps:")
        print("  1. Package with metabob-proto")
        print("  2. Test in devbob container")
        print("  3. Validate with real execution")
        return 0
    else:
        print()
        print("⚠️  Template needs improvements before sterile deployment")
        print()
        print("Required fixes:")
        for criterion, status in criteria.items():
            if not status:
                print(f"  - {criterion}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
