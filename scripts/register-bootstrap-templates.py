#!/usr/bin/env python3
"""
Register bootstrap activity templates from metabob-proto to the backend.

This script:
1. Reads bootstrap templates from repos/metabob-proto/activities/bootstrap/
2. Converts them to the V2 API schema format
3. Registers them to the backend API
4. Creates an API key if needed and stores session info
"""

import json
import os
import sys
from pathlib import Path
import httpx
from typing import Dict, Any, List

# Configuration
API_URL = os.environ.get("METABOB_API_URL", "http://localhost:8080")
API_KEY = os.environ.get(
    "METABOB_API_KEY", "mb_nH7j21NRXWRaqWyHq4ntSuwiRxARrhFnsR2J7i7vb-E"
)
PROJECT_ID = os.environ.get("METABOB_PROJECT_ID", "exp-repo-dev")

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
BOOTSTRAP_DIR = PROJECT_ROOT / "repos/metabob-proto/activities/bootstrap"

# Category mapping from activity_id prefix to API category
CATEGORY_MAP = {
    "feature": "FEATURE",
    "bug": "BUGFIX",
    "refactor": "REFACTOR",
    "activity": "INFRASTRUCTURE",
    "code": "INFRASTRUCTURE",
    "boredom": "INFRASTRUCTURE",
    "jiggle": "REFACTOR",
}


def map_category(activity_id: str, variant_id: str) -> str:
    """Map activity_id or variant_id to category."""
    for prefix, category in CATEGORY_MAP.items():
        if activity_id.startswith(prefix) or variant_id.startswith(prefix):
            return category
    return "INFRASTRUCTURE"


def convert_bootstrap_to_v2(template: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert bootstrap template format to V2 API format.

    Bootstrap format has:
    - variant_id, activity_id, variant_name, description
    - task_steps (list of task dicts)
    - variables (dict)
    - prompt_strategy, context_budget_tokens, etc.

    V2 API expects:
    - name, category, description
    - tasks (list of task dicts - just rename task_steps)
    - All other fields stay the same
    """
    # Extract activity info
    variant_id = template.get("variant_id", "")
    activity_id = template.get("activity_id", "")
    variant_name = template.get("variant_name", "v1")
    description = template.get("description", "")

    # Generate name from activity_id
    name = activity_id.replace("-", " ").title()
    if variant_name and variant_name != "v1-baseline":
        name = f"{name} ({variant_name})"

    # Determine category
    category = map_category(activity_id, variant_id)

    # Build V2 template
    # Note: After migration, templates now have 'tasks' instead of 'task_steps'
    # Try 'tasks' first (migrated templates), fallback to 'task_steps' (unmigrated)
    tasks = template.get("tasks", template.get("task_steps", []))

    v2_template = {
        "variant_id": variant_id,
        "activity_id": activity_id,
        "variant_name": variant_name,
        "name": name,  # REQUIRED
        "category": category,  # REQUIRED
        "description": description,
        "version": template.get("version", 1),
        "task_steps": tasks,  # API expects 'task_steps' not 'tasks'
        # "variables": {},  # Omit for now - causes validation errors
        "prompt_strategy": template.get("prompt_strategy", "guided"),
        "context_budget_tokens": template.get("context_budget_tokens", 25000),
        "expected_duration_ms": template.get("expected_duration_ms", 300000),
        "expected_cost": template.get("expected_cost", 0.5),
        "expected_quality_score": template.get("expected_quality_score", 0.8),
        "status": template.get("status", "active"),
    }

    return v2_template


def create_session(api_key: str, project_id: str) -> Dict[str, str]:
    """Create a session and return session info."""
    print(f"Creating session for project: {project_id}")

    headers = {"x-api-key": api_key, "Content-Type": "application/json"}
    payload = {"project_id": project_id}

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(f"{API_URL}/v2/session", json=payload, headers=headers)

        if resp.status_code != 200:
            print(f"✗ Session creation failed: {resp.status_code}")
            print(f"  Response: {resp.text}")
            sys.exit(1)

        data = resp.json()
        session_id = data["session_id"]
        session_token = data["metadata"]["session_token"]

        print(f"✓ Session created: {session_id}")
        return {"session_id": session_id, "session_token": session_token}


def register_template(template: Dict[str, Any], session_info: Dict[str, str]) -> bool:
    """Register a single template."""
    name = template.get("name", "Unknown")
    variant_id = template.get("variant_id", "unknown")
    tasks = template.get("tasks", [])

    print(f"\nRegistering: {name} ({variant_id})")
    print(f"  Category: {template.get('category')}")
    print(f"  Tasks: {len(tasks)}")
    print(f"  First task ID: {tasks[0]['id'] if tasks else 'N/A'}")

    headers = {
        "x-api-key": API_KEY,
        "Authorization": f"Bearer {session_info['session_token']}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(
            f"{API_URL}/v2/activities/templates",
            json=template,
            headers=headers,
        )

        # 200 or 201 are both success codes
        if resp.status_code in [200, 201]:
            data = resp.json()
            print(f"✓ Registered successfully (HTTP {resp.status_code})")
            print(f"  Variant ID: {data.get('variant_id', 'N/A')}")
            return True
        elif resp.status_code == 500:
            # Check if it's a duplicate
            if "already exists" in resp.text.lower():
                print(f"⚠ Template already exists (skipping)")
                return True
            print(f"✗ Registration failed: {resp.status_code}")
            print(f"  Response: {resp.text[:200]}")
            return False
        else:
            print(f"✗ Registration failed: {resp.status_code}")
            try:
                error_data = resp.json()
                print(f"  Error: {json.dumps(error_data, indent=2)[:300]}")
            except:
                print(f"  Response: {resp.text[:200]}")
            return False


def main():
    """Main registration workflow."""
    print("=" * 60)
    print("Bootstrap Activity Template Registration")
    print("=" * 60)
    print(f"\nAPI URL: {API_URL}")
    print(f"Project ID: {PROJECT_ID}")
    print(f"Bootstrap Dir: {BOOTSTRAP_DIR}")
    print()

    # Check bootstrap directory
    if not BOOTSTRAP_DIR.exists():
        print(f"✗ Bootstrap directory not found: {BOOTSTRAP_DIR}")
        sys.exit(1)

    # Find all bootstrap templates
    template_files = list(BOOTSTRAP_DIR.glob("*.json"))
    print(f"Found {len(template_files)} templates")
    print()

    if not template_files:
        print("✗ No templates found!")
        sys.exit(1)

    # Create session
    session_info = create_session(API_KEY, PROJECT_ID)
    print()

    # Register each template
    success_count = 0
    fail_count = 0
    skip_count = 0

    for template_file in sorted(template_files):
        try:
            # Read bootstrap template
            with open(template_file, "r") as f:
                bootstrap_template = json.load(f)

            # Convert to V2 format
            v2_template = convert_bootstrap_to_v2(bootstrap_template)

            # Register
            if register_template(v2_template, session_info):
                success_count += 1
            else:
                fail_count += 1

        except Exception as e:
            print(f"\n✗ Error processing {template_file.name}: {e}")
            fail_count += 1

    # Summary
    print()
    print("=" * 60)
    print("Registration Summary")
    print("=" * 60)
    print(f"Total templates: {len(template_files)}")
    print(f"✓ Registered: {success_count}")
    print(f"✗ Failed: {fail_count}")
    print()

    if fail_count > 0:
        sys.exit(1)

    print("✅ All templates registered successfully!")


if __name__ == "__main__":
    main()
