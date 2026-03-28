#!/usr/bin/env python3
"""
Batch register converted templates to backend v2 API

Usage:
    python register_templates_batch.py <templates_dir> <session_token_file> [base_url]

Example:
    python register_templates_batch.py .converted-templates .session_token_working.txt https://ide.metabob.com
"""

import json
import sys
import time
from pathlib import Path
import requests


def register_template(
    template: dict, session_token: str, base_url: str = "http://localhost:8765"
) -> tuple[bool, str]:
    """Register a single template to backend

    Returns: (success, message)
    """

    url = f"{base_url}/v2/activities/templates"
    headers = {
        "Authorization": f"Bearer {session_token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(url, json=template, headers=headers, timeout=10)

        if response.status_code == 201:
            result = response.json()
            template_id = result.get("template_id", "unknown")
            return True, f"Registered as {template_id}"
        elif response.status_code == 409:
            return False, "Already exists (conflict)"
        else:
            error_msg = response.json().get("detail", response.text)
            return False, f"HTTP {response.status_code}: {error_msg}"

    except requests.exceptions.RequestException as e:
        return False, f"Network error: {e}"
    except Exception as e:
        return False, f"Error: {e}"


def main():
    if len(sys.argv) < 3 or len(sys.argv) > 4:
        print(
            "Usage: python register_templates_batch.py <templates_dir> <session_token_file> [base_url]"
        )
        sys.exit(1)

    templates_dir = Path(sys.argv[1])
    session_token_file = Path(sys.argv[2])
    base_url = sys.argv[3] if len(sys.argv) == 4 else "http://localhost:8765"

    if not templates_dir.exists():
        print(f"Error: Templates directory not found: {templates_dir}")
        sys.exit(1)

    if not session_token_file.exists():
        print(f"Error: Session token file not found: {session_token_file}")
        sys.exit(1)

    # Load session token
    session_token = session_token_file.read_text().strip()

    print(f"Using backend: {base_url}")

    # Priority order: Meta-templates first, then common templates
    priority_templates = [
        "activity-debug.json",
        "activity-evolve.json",
        "create-activity-template-v3.json",
        "debug-activity-self-contained.json",
        "evolve-activity-self-contained.json",
        "bug-fix.json",
        "feature-impl.json",
        "refactor.json",
        "add-rest-endpoint.json",
    ]

    # Get all template files
    all_templates = list(templates_dir.glob("*.json"))

    # Sort by priority
    priority_set = set(priority_templates)
    priority_files = [
        templates_dir / name
        for name in priority_templates
        if (templates_dir / name).exists()
    ]
    other_files = [f for f in all_templates if f.name not in priority_set]

    ordered_files = priority_files + sorted(other_files)

    print(f"Found {len(ordered_files)} templates to register")
    print(f"Priority templates: {len(priority_files)}")
    print(f"Other templates: {len(other_files)}\n")

    # Register templates
    success_count = 0
    conflict_count = 0
    failed_count = 0

    for template_file in ordered_files:
        try:
            print(f"Registering {template_file.name}...", end=" ")

            # Load template
            with open(template_file, "r") as f:
                template = json.load(f)

            # Register
            success, message = register_template(template, session_token, base_url)

            if success:
                print(f"✓ {message}")
                success_count += 1
            elif "conflict" in message.lower() or "exists" in message.lower():
                print(f"⊘ {message}")
                conflict_count += 1
            else:
                print(f"✗ {message}")
                failed_count += 1

            # Rate limiting
            time.sleep(0.2)

        except Exception as e:
            print(f"✗ Error: {e}")
            failed_count += 1

    print(f"\nRegistration complete:")
    print(f"  ✓ Success: {success_count}")
    print(f"  ⊘ Already exists: {conflict_count}")
    print(f"  ✗ Failed: {failed_count}")
    print(f"  Total: {len(ordered_files)}")


if __name__ == "__main__":
    main()
