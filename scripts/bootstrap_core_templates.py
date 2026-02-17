#!/usr/bin/env python3
"""
Bootstrap script to seed database with core activity templates.

This enables cold-start initialization of an empty database with the
minimal set of templates needed for self-improvement.
"""

import json
import sys
import requests
from pathlib import Path
from typing import Dict, List, Any

BASE_URL = "http://localhost:8080"
TOKEN = None

# Core templates in bootstrap order
CORE_TEMPLATES = [
    # Self-hosting capability first
    "activity-create-v2.json",
    # Core functionality templates
    "feature-impl.json",
    "bug-fix.json",
    "refactor.json",
    # Specialized templates
    "add-rest-endpoint.json",
]


def get_token() -> str:
    """Get session token from .metabob/state file."""
    state_path = Path(".metabob/state")
    if not state_path.exists():
        print("❌ No .metabob/state file found")
        print("Run: python3 scripts/create_session_state.py")
        sys.exit(1)

    with open(state_path, "r") as f:
        state = json.load(f)

    # Try to get token from session_metadata (new format)
    token = state.get("session_metadata", {}).get("session_token")

    # Fall back to old format if needed
    if not token:
        token = state.get("token")

    if not token:
        print("❌ No session_token in state file")
        print(f"State file structure: {list(state.keys())}")
        sys.exit(1)

    return token


def convert_old_variable_format(variables: Dict[str, Any]) -> Dict[str, Any]:
    """Convert old simple string variables to TemplateVariable schema.

    Old format: {"var_name": ""}
    New format: {"var_name": {"type": "string", "required": true, "description": "..."}}
    """
    converted = {}

    for var_name, var_value in variables.items():
        # If already in new format (has 'type' key), keep as-is
        if isinstance(var_value, dict) and "type" in var_value:
            converted[var_name] = var_value
        else:
            # Convert simple string to TemplateVariable schema
            # Infer type from value
            if isinstance(var_value, bool):
                var_type = "boolean"
            elif isinstance(var_value, int) or isinstance(var_value, float):
                var_type = "number"
            elif isinstance(var_value, dict):
                var_type = "object"
            elif isinstance(var_value, list):
                var_type = "array"
            else:
                var_type = "string"

            # Generate description from variable name
            description = var_name.replace("_", " ").capitalize()

            converted[var_name] = {
                "type": var_type,
                "required": True,  # Assume required for old templates
                "description": description,
            }

    return converted


def convert_old_schema_to_new(template: Dict[str, Any]) -> Dict[str, Any]:
    """Convert old 'tasks' schema to new 'task_steps' schema and old variable format."""

    # Convert old variable format if present
    if "variables" in template and isinstance(template["variables"], dict):
        old_vars = template["variables"]
        # Check if any variable is in old format (simple string/value)
        needs_conversion = any(
            not (isinstance(v, dict) and "type" in v) for v in old_vars.values()
        )

        if needs_conversion:
            print("  🔄 Converting old variable format to TemplateVariable schema...")
            template["variables"] = convert_old_variable_format(old_vars)
            print(f"  ✓ Converted {len(template['variables'])} variables")

    # If already has task_steps, return (after variable conversion)
    if "task_steps" in template:
        return template

    # If has old 'tasks' field, convert it
    if "tasks" not in template:
        print("  ⚠️  Template has neither 'tasks' nor 'task_steps' field")
        return template

    print("  🔄 Converting old 'tasks' schema to 'task_steps'...")

    task_steps = []
    for task in template["tasks"]:
        # Convert old task format to new ProtoTaskStep format
        task_step = {
            "id": task.get("id", f"task-{len(task_steps)}"),
            "subagent": task.get("subagent", "general"),
            "description": task.get("description", ""),
            "dependencies": task.get("dependencies", []),
            "prompt": task.get(
                "prompt",
                {"template": "", "max_tokens": 8000, "compression_strategy": "filter"},
            ),
            "validation": task.get("validation", {}),
            "retry": task.get(
                "retry",
                {"max_attempts": 3, "strategy": "simple", "fallback_prompt": ""},
            ),
            "metrics": task.get(
                "metrics",
                {
                    "success_rate": 0,
                    "avg_tokens": 0,
                    "avg_duration": 0,
                    "common_failures": [],
                },
            ),
            "impulse_refs": task.get("impulse_refs", []),
            "guidance": task.get("guidance", []),
            "expected_actions": task.get("expected_actions", []),
        }
        task_steps.append(task_step)

    # Replace tasks with task_steps
    template["task_steps"] = task_steps
    del template["tasks"]

    print(f"  ✓ Converted {len(task_steps)} tasks to task_steps")

    return template


def upload_template(template_path: Path, token: str) -> Dict[str, Any]:
    """Upload template to backend API."""

    print(f"\n{'=' * 60}")
    print(f"Uploading: {template_path.name}")
    print(f"{'=' * 60}")

    with open(template_path, "r") as f:
        template = json.load(f)

    # Convert old schema if needed
    template = convert_old_schema_to_new(template)

    # Show context_requirements info
    context_reqs = template.get("context_requirements", [])
    if context_reqs:
        print(f"  Context Requirements: {len(context_reqs)}")
        for cr in context_reqs:
            req = "REQUIRED" if cr.get("required") else "optional"
            print(f"    - {cr['key']}: {req}")
    else:
        print("  ⚠️  No context_requirements")

    # Prepare request data (convert to API schema format)
    request_data = {
        "name": template.get("variant_name", template.get("name", template_path.stem)),
        "description": template.get("description", ""),
        "category": template.get("activity_id", "other"),
        "variables": template.get("variables", {}),
        "context_requirements": template.get("context_requirements", []),
        "task_steps": template.get("task_steps", []),
        "parent_id": template.get("parent_id"),
    }

    # Upload
    url = f"{BASE_URL}/v2/activities/templates"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    try:
        response = requests.post(url, headers=headers, json=request_data, timeout=30)

        if response.status_code == 201:
            result = response.json()
            template_id = result.get("id", result.get("variant_id"))
            print(f"✅ Uploaded successfully: {template_id}")
            return {"status": "success", "id": template_id, "name": template_path.name}
        else:
            print(f"❌ Upload failed: {response.status_code}")
            print(f"   Error: {response.text[:200]}")
            return {
                "status": "error",
                "name": template_path.name,
                "error": response.text[:200],
            }

    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return {"status": "error", "name": template_path.name, "error": str(e)}


def main():
    print("=" * 60)
    print("BOOTSTRAP CORE ACTIVITY TEMPLATES")
    print("=" * 60)
    print()

    # Get token
    print("1. Getting session token...")
    token = get_token()
    print("   ✓ Token loaded")

    # Check backend
    print("\n2. Checking backend...")
    try:
        response = requests.get(
            f"{BASE_URL}/v2/activities/templates",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if response.status_code == 200:
            existing_count = len(response.json().get("templates", []))
            print(f"   ✓ Backend reachable ({existing_count} existing templates)")
        else:
            print(f"   ⚠️  Backend returned {response.status_code}")
    except Exception as e:
        print(f"   ❌ Backend not reachable: {e}")
        sys.exit(1)

    # Upload templates
    print("\n3. Uploading core templates...")
    bootstrap_dir = Path("repos/metabob-proto/activities/bootstrap")

    results = []
    for template_name in CORE_TEMPLATES:
        template_path = bootstrap_dir / template_name
        if not template_path.exists():
            print(f"⚠️  Not found: {template_name}")
            results.append({"status": "not_found", "name": template_name})
            continue

        result = upload_template(template_path, token)
        results.append(result)

    # Summary
    print(f"\n{'=' * 60}")
    print("BOOTSTRAP SUMMARY")
    print(f"{'=' * 60}")

    success = [r for r in results if r["status"] == "success"]
    errors = [r for r in results if r["status"] == "error"]
    not_found = [r for r in results if r["status"] == "not_found"]

    print(f"✅ Uploaded: {len(success)}")
    if success:
        for r in success:
            print(f"   - {r['name']} → {r['id']}")

    if errors:
        print(f"\n❌ Errors: {len(errors)}")
        for r in errors:
            print(f"   - {r['name']}: {r.get('error', 'Unknown error')[:80]}")

    if not_found:
        print(f"\n⚠️  Not Found: {len(not_found)}")
        for r in not_found:
            print(f"   - {r['name']}")

    # Final status
    print()
    if len(success) == len(CORE_TEMPLATES):
        print("✨ BOOTSTRAP COMPLETE - All core templates uploaded!")
        return 0
    else:
        print(
            f"⚠️  BOOTSTRAP PARTIAL - {len(success)}/{len(CORE_TEMPLATES)} templates uploaded"
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
