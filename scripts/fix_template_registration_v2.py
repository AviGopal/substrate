#!/usr/bin/env python3
"""
Fix template registration V2 - Properly handle task_steps array

The issue: Previous script renamed tasks->task_steps but the array wasn't properly persisted.
Root cause: JSON escaping issue or CREATE CONTENT not handling nested arrays properly.

Solution: Use SurrealDB's JSON API endpoint instead of SQL API.
"""

import json
import requests
from pathlib import Path

# Configuration
SURREAL_URL = "http://localhost:8000"
SURREAL_USER = "root"
SURREAL_PASS = "root"
SURREAL_NS = "metabob"
SURREAL_DB = "production"
BOOTSTRAP_DIR = (
    Path(__file__).parent.parent / "repos/metabob-proto/activities/bootstrap"
)


def clear_existing_variants():
    """Delete all existing variants to start fresh."""
    sql = "USE NS metabob DB production; DELETE activity_variants;"

    response = requests.post(
        f"{SURREAL_URL}/sql",
        auth=(SURREAL_USER, SURREAL_PASS),
        headers={"Content-Type": "application/surql", "Accept": "application/json"},
        data=sql,
        timeout=10,
    )

    if response.status_code == 200:
        print("✓ Cleared existing variants")
        return True
    else:
        print(f"✗ Failed to clear variants: {response.text}")
        return False


def register_variant_via_key_endpoint(template_path: Path) -> tuple[bool, str]:
    """Register a template using SurrealDB's key-based API."""
    try:
        # Load template JSON
        with open(template_path) as f:
            variant = json.load(f)

        # Transform: tasks -> task_steps
        if "tasks" in variant and "task_steps" not in variant:
            variant["task_steps"] = variant.pop("tasks")

        # Add missing required fields
        variant.setdefault("content_hash", "bootstrap")
        variant.setdefault("parent_hash", None)
        variant.setdefault("lineage", [])
        variant.setdefault("evolution_type", "root")
        variant.setdefault("evolution_note", "Bootstrap template")

        # Get variant_id for record key
        variant_id = variant.get("variant_id")
        if not variant_id:
            return False, "Missing variant_id in template"

        # Use REST API: PUT /key/{table}/{id}
        # This endpoint properly handles complex nested JSON
        url = f"{SURREAL_URL}/key/activity_variants/{variant_id}"

        response = requests.put(
            url,
            auth=(SURREAL_USER, SURREAL_PASS),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "NS": SURREAL_NS,
                "DB": SURREAL_DB,
            },
            json=variant,  # Use json= parameter for proper serialization
            timeout=10,
        )

        if response.status_code in [200, 201]:
            task_count = len(variant.get("task_steps", []))
            return True, f"{variant_id} ({task_count} tasks)"
        else:
            return False, f"HTTP {response.status_code}: {response.text[:200]}"

    except Exception as e:
        return False, str(e)


def verify_registration():
    """Verify templates are properly registered with task_steps."""
    sql = """
    USE NS metabob DB production; 
    SELECT variant_id, variant_name, array::len(task_steps) AS task_count 
    FROM activity_variants 
    ORDER BY variant_id
    LIMIT 20;
    """

    response = requests.post(
        f"{SURREAL_URL}/sql",
        auth=(SURREAL_USER, SURREAL_PASS),
        headers={"Content-Type": "application/surql", "Accept": "application/json"},
        data=sql,
        timeout=5,
    )

    if response.status_code == 200:
        result = response.json()
        if result and len(result) > 1:
            variants = result[1].get("result", [])
            return variants

    return []


def main():
    print("=" * 70)
    print("FIX TEMPLATE REGISTRATION V2 - Use REST API for proper JSON handling")
    print("=" * 70)
    print()

    # Step 1: Clear existing variants
    print("Step 1: Clearing existing variants...")
    if not clear_existing_variants():
        print("⚠️  Failed to clear, continuing anyway...")
    print()

    # Step 2: Find templates
    templates = sorted(BOOTSTRAP_DIR.glob("*.json"))
    print(f"Step 2: Found {len(templates)} templates to register\n")

    successful = []
    failed = []

    for template_path in templates:
        print(f"Registering {template_path.name}... ", end="", flush=True)
        success, result = register_variant_via_key_endpoint(template_path)

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
        for name, err in failed:
            print(f"   - {name}: {err[:100]}")
    print("=" * 70)
    print()

    # Step 3: Verify
    print("Step 3: Verifying registration with task counts...")
    variants = verify_registration()

    if variants:
        print(f"\nRegistered {len(variants)} variants:")
        for v in variants:
            task_count = v.get("task_count", 0)
            print(
                f"  - {v.get('variant_id')}: {v.get('variant_name')} ({task_count} tasks)"
            )

        # Count how many have tasks
        with_tasks = sum(1 for v in variants if v.get("task_count", 0) > 0)
        print(f"\n✓ {with_tasks}/{len(variants)} variants have task_steps")

        if with_tasks > 0:
            print("\n🎉 SUCCESS! Templates properly registered with tasks")
            print("Try: search_activities({ verbose: true })")
        else:
            print(
                "\n⚠️  WARNING: No variants have task_steps - registration may have failed"
            )
    else:
        print("❌ Verification failed - no variants found")


if __name__ == "__main__":
    main()
