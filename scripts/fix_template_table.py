#!/usr/bin/env python3
"""
Fix template registration by moving from activity_templates to activity_variants table.

The backend queries activity_variants but we registered templates in activity_templates.
This script:
1. Reads templates from activity_templates
2. Transforms them to ActivityVariant schema
3. Inserts into activity_variants table
"""

import json
import requests
import uuid
from pathlib import Path
from datetime import datetime, timezone

# Configuration
SURREAL_URL = "http://localhost:8000/sql"
SURREAL_USER = "root"
SURREAL_PASS = "root"
BOOTSTRAP_DIR = (
    Path(__file__).parent.parent / "repos/metabob-proto/activities/bootstrap"
)


def generate_variant_id(activity_id: str) -> str:
    """Generate a variant ID from activity ID."""
    # Use first 8 chars of UUID as variant suffix
    suffix = str(uuid.uuid4())[:8]
    category_prefix = activity_id.split("-")[0].upper()
    return f"{category_prefix}-{suffix}"


def transform_to_variant_schema(template_data: dict) -> dict:
    """
    Transform activity template to ActivityVariant schema.

    ActivityVariant schema (from backend):
    - variant_id: str (generated)
    - activity_id: str (from template.id)
    - variant_name: str (from template.name)
    - description: str
    - task_steps: list[dict] (from template.tasks)
    - variables: dict (from template.variables if exists)
    - status: str (default: "active")
    - content_hash: str (generated from task_steps)
    - parent_hash: Optional[str]
    - lineage: list[str]
    - evolution_type: str (default: "root")
    - expected_duration_ms: int
    - expected_cost: float
    - created_at: datetime
    - updated_at: datetime
    """
    import hashlib

    activity_id = template_data.get("id", "unknown-activity")
    variant_id = generate_variant_id(activity_id)

    # Extract task_steps from tasks
    task_steps = template_data.get("tasks", [])

    # Generate content hash from task_steps
    task_json = json.dumps(task_steps, sort_keys=True)
    content_hash = hashlib.sha256(task_json.encode()).hexdigest()

    # Build variant record with all required ActivityVariant fields
    variant = {
        "variant_id": variant_id,
        "activity_id": activity_id,
        "variant_name": template_data.get("name", "Untitled Template"),
        "version": template_data.get("version", 1),
        "description": template_data.get("description", ""),
        "task_steps": task_steps,
        "variables": template_data.get("variables", {}),
        "prompt_strategy": "guided",  # Required field
        "context_budget_tokens": 10000,  # Default from model
        "status": "active",
        "content_hash": content_hash,
        "parent_hash": None,
        "lineage": [],
        "evolution_type": "root",
        "evolution_note": "Registered from bootstrap templates",
        "expected_duration_ms": 60000,  # Default 60 seconds
        "expected_cost": 0.50,  # Default $0.50
        "expected_quality_score": 0.8,  # Default quality expectation
        # Omit created_at - SurrealDB will auto-set with proper datetime type
    }

    return variant


def register_variant(template_path: Path) -> bool:
    """Register a template as an activity variant."""
    try:
        # Load template JSON
        with open(template_path) as f:
            template_data = json.load(f)

        # Transform to variant schema
        variant = transform_to_variant_schema(template_data)

        # Prepare SurrealDB query
        variant_json = json.dumps(variant)

        sql = f"USE NS metabob DB production; CREATE activity_variants CONTENT {variant_json};"

        # Execute query
        response = requests.post(
            SURREAL_URL,
            auth=(SURREAL_USER, SURREAL_PASS),
            headers={"Content-Type": "application/surql", "Accept": "application/json"},
            data=sql,
            timeout=10,
        )

        # Check response
        if response.status_code == 200:
            result = response.json()
            if result and len(result) > 1:
                # Second element contains the CREATE result
                create_result = result[1]
                if isinstance(create_result, list) and len(create_result) > 0:
                    print(f"  Created variant: {variant['variant_id']}")
                    return True

        print(f"  Response: {response.status_code} - {response.text[:200]}")
        return False

    except Exception as e:
        print(f"  Error: {e}")
        import traceback

        traceback.print_exc()
        return False


def verify_registration():
    """Verify templates are now in activity_variants table."""
    sql = (
        "USE NS metabob DB production; SELECT count() FROM activity_variants GROUP ALL;"
    )

    response = requests.post(
        SURREAL_URL,
        auth=(SURREAL_USER, SURREAL_PASS),
        headers={"Content-Type": "application/surql", "Accept": "application/json"},
        data=sql,
        timeout=5,
    )

    if response.status_code == 200:
        result = response.json()
        if result and len(result) > 1:
            count_result = result[1]
            if isinstance(count_result, list) and len(count_result) > 0:
                count = count_result[0].get("count", 0)
                print(f"✓ Total variants in database: {count}")
                return count

    print("✗ Failed to verify registration")
    return 0


def main():
    print("=" * 70)
    print("FIX TEMPLATE TABLE - Move from activity_templates to activity_variants")
    print("=" * 70)
    print()

    # Find all template files
    templates = sorted(BOOTSTRAP_DIR.glob("*.json"))

    print(f"Found {len(templates)} templates to register\n")

    success_count = 0
    for template_path in templates:
        print(f"Registering {template_path.name}...", end=" ")
        if register_variant(template_path):
            print("✓")
            success_count += 1
        else:
            print("✗")

    print(f"\n✅ Registered {success_count}/{len(templates)} templates as variants")

    # Verify
    print("\nVerifying registration...")
    total = verify_registration()

    if total >= success_count:
        print(
            f"\n🎉 SUCCESS! Backend can now discover {total} templates via activity_variants table"
        )
    else:
        print(f"\n⚠️  Warning: Expected {success_count} but found {total} in database")


if __name__ == "__main__":
    main()
