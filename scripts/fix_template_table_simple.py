#!/usr/bin/env python3
"""
Fix template registration - templates already match ActivityVariant schema!

The bootstrap templates are already in ActivityVariant format.
Just need to insert them into activity_variants table (not activity_templates).
"""

import json
import requests
from pathlib import Path

# Configuration
SURREAL_URL = "http://localhost:8000/sql"
SURREAL_USER = "root"
SURREAL_PASS = "root"
BOOTSTRAP_DIR = (
    Path(__file__).parent.parent / "repos/metabob-proto/activities/bootstrap"
)


def register_variant(template_path: Path) -> tuple[bool, str]:
    """Register a template as an activity variant."""
    try:
        # Load template JSON (already in ActivityVariant format!)
        with open(template_path) as f:
            variant = json.load(f)

        # The templates already have correct schema, just need to:
        # 1. Rename "tasks" to "task_steps" (field name difference)
        if "tasks" in variant and "task_steps" not in variant:
            variant["task_steps"] = variant.pop("tasks")

        # 2. Add missing required fields if not present
        variant.setdefault("content_hash", "bootstrap")
        variant.setdefault("parent_hash", None)
        variant.setdefault("lineage", [])
        variant.setdefault("evolution_type", "root")
        variant.setdefault("evolution_note", "Bootstrap template")

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
                create_result = result[1]
                if isinstance(create_result, list) and len(create_result) > 0:
                    record = create_result[0]
                    variant_id = record.get("variant_id", "unknown")
                    return True, variant_id

        return False, f"HTTP {response.status_code}: {response.text[:100]}"

    except Exception as e:
        return False, str(e)


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
                return count

    return 0


def list_registered_variants():
    """List registered variants with their IDs."""
    sql = "USE NS metabob DB production; SELECT variant_id, activity_id, variant_name FROM activity_variants LIMIT 20;"

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
            variants = result[1]
            return variants if isinstance(variants, list) else []

    return []


def main():
    print("=" * 70)
    print("FIX TEMPLATE TABLE - Register ActivityVariants (Simple Version)")
    print("=" * 70)
    print()

    # Find all template files
    templates = sorted(BOOTSTRAP_DIR.glob("*.json"))

    print(f"Found {len(templates)} templates to register\n")

    successful = []
    failed = []

    for template_path in templates:
        print(f"Registering {template_path.name}... ", end="")
        success, result = register_variant(template_path)

        if success:
            print(f"✓ {result}")
            successful.append((template_path.name, result))
        else:
            print(f"✗ {result}")
            failed.append((template_path.name, result))

    print()
    print("=" * 70)
    print(f"✅ SUCCESS: {len(successful)}/{len(templates)} templates registered")
    if failed:
        print(f"❌ FAILED: {len(failed)} templates")
    print("=" * 70)
    print()

    # Verify
    print("Verifying registration...")
    total = verify_registration()
    print(f"✓ Total variants in database: {total}")
    print()

    # List registered
    if total > 0:
        print("Registered variants:")
        variants = list_registered_variants()
        for v in variants:
            print(
                f"  - {v.get('variant_id')}: {v.get('variant_name')} ({v.get('activity_id')})"
            )

        print()
        print(
            "🎉 SUCCESS! Backend can now discover templates via activity_variants table"
        )
        print("Try: search_activities({ verbose: true })")


if __name__ == "__main__":
    main()
