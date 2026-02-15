#!/usr/bin/env python3
"""
Register templates via backend's CREATE API endpoint.

This uses the same path as OpenCode would use to create templates,
ensuring proper validation and storage.
"""

import json
import requests
from pathlib import Path

# Configuration
BACKEND_URL = "http://localhost:8080"
BOOTSTRAP_DIR = (
    Path(__file__).parent.parent / "repos/metabob-proto/activities/bootstrap"
)


def get_session_token():
    """Get session token from state file."""
    state_file = Path(__file__).parent.parent / ".metabob/state"
    with open(state_file) as f:
        state = json.load(f)
    return state["session_metadata"]["session_token"]


def clear_existing_variants():
    """Delete existing test variants."""
    import requests

    sql = "USE NS metabob DB production; DELETE activity_variants WHERE variant_id LIKE 'UNKNOWN-%';"

    response = requests.post(
        "http://localhost:8000/sql",
        auth=("root", "root"),
        headers={"Content-Type": "application/surql", "Accept": "application/json"},
        data=sql,
        timeout=10,
    )

    if response.status_code == 200:
        print("✓ Cleared test variants (UNKNOWN-*)")
    return response.status_code == 200


def register_template_via_api(
    template_path: Path, session_token: str
) -> tuple[bool, str]:
    """Register template using backend's POST /v2/activities/templates endpoint."""
    try:
        # Load template
        with open(template_path) as f:
            template = json.load(f)

        # Extract fields needed for API
        request_data = {
            "name": template.get("name", template.get("variant_name", "Unnamed")),
            "description": template.get("description", ""),
            "category": template.get("category", "feature"),
            "variables": template.get("variables", {}),
            "context_requirements": template.get(
                "contextRequirements", template.get("context_requirements", [])
            ),
            "task_steps": template.get("tasks", template.get("task_steps", [])),
            "parent_id": template.get("parent_id"),
        }

        # Validate we have task_steps
        if not request_data["task_steps"]:
            return False, "No tasks/task_steps in template"

        # Call backend API
        response = requests.post(
            f"{BACKEND_URL}/v2/activities/templates",
            headers={
                "Authorization": f"Bearer {session_token}",
                "Content-Type": "application/json",
            },
            json=request_data,
            timeout=30,
        )

        if response.status_code in [200, 201]:
            data = response.json()
            variant_id = data.get("variant_id", "unknown")
            task_count = len(request_data["task_steps"])
            return True, f"{variant_id} ({task_count} tasks)"
        else:
            return False, f"HTTP {response.status_code}: {response.text[:200]}"

    except Exception as e:
        return False, str(e)


def verify_templates(session_token: str):
    """Verify templates are discoverable via API."""
    response = requests.get(
        f"{BACKEND_URL}/v2/activities/templates?limit=30",
        headers={"Authorization": f"Bearer {session_token}"},
        timeout=10,
    )

    if response.status_code == 200:
        data = response.json()
        templates = data.get("templates", [])
        return templates
    return []


def main():
    print("=" * 70)
    print("REGISTER TEMPLATES VIA BACKEND API")
    print("=" * 70)
    print()

    # Get session token
    print("Loading session token...")
    try:
        session_token = get_session_token()
        print(f"✓ Session token loaded: {session_token[:30]}...")
    except Exception as e:
        print(f"❌ Failed to load session token: {e}")
        return
    print()

    # Clear test variants
    print("Clearing previous test variants...")
    clear_existing_variants()
    print()

    # Find templates
    templates = sorted(BOOTSTRAP_DIR.glob("*.json"))
    print(f"Found {len(templates)} templates to register\n")

    successful = []
    failed = []

    for template_path in templates:
        print(f"Registering {template_path.name}... ", end="", flush=True)
        success, result = register_template_via_api(template_path, session_token)

        if success:
            print(f"✓ {result}")
            successful.append(template_path.name)
        else:
            print(f"✗ {result}")
            failed.append((template_path.name, result))

    print()
    print("=" * 70)
    print(f"✅ SUCCESS: {len(successful)}/{len(templates)} templates registered")
    if failed:
        print(f"❌ FAILED: {len(failed)} templates")
        for name, err in failed:
            print(f"   - {name}: {err[:80]}")
    print("=" * 70)
    print()

    # Verify
    print("Verifying via backend API...")
    templates = verify_templates(session_token)

    if templates:
        print(f"\n✓ Found {len(templates)} templates:")
        for t in templates[:10]:
            task_count = len(t.get("task_steps", []))
            print(
                f"  - {t.get('variant_id')}: {t.get('variant_name')} ({task_count} tasks)"
            )

        if len(templates) > 10:
            print(f"  ... and {len(templates) - 10} more")

        # Count with tasks
        with_tasks = sum(1 for t in templates if len(t.get("task_steps", [])) > 0)
        print(f"\n✓ {with_tasks}/{len(templates)} templates have task_steps")

        if with_tasks >= len(successful):
            print("\n🎉 SUCCESS! Templates properly registered")
            print("\nYou can now use: search_activities({ verbose: true })")
        else:
            print("\n⚠️  Some templates missing task_steps")
    else:
        print("❌ No templates found via API")


if __name__ == "__main__":
    main()
