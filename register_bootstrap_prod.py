#!/usr/bin/env python3
"""
Register bootstrap templates to production database.
Simplified version for direct database access.
"""

import asyncio
import json
import sys
from pathlib import Path
from server.config import Settings
from server.utils.surreal_client import SurrealDBClient

# Bootstrap directory in production pod
BOOTSTRAP_DIR = Path("/opt/metabob-proto/activities/bootstrap")

# Default org/project for bootstrap templates
BOOTSTRAP_ORG = "metabob-system"
BOOTSTRAP_PROJECT = "bootstrap"


async def register_templates():
    """Register all bootstrap templates to database."""
    print("=" * 70)
    print("Bootstrap Template Registration (Production)")
    print("=" * 70)
    print()

    # Connect to database
    config = Settings()
    db = SurrealDBClient(config)
    await db.connect()
    print(f"✓ Connected to: {config.SURREAL_URL}")
    print(f"  Namespace: {config.SURREAL_NAMESPACE}")
    print(f"  Database: {config.SURREAL_DATABASE}")
    print()

    # Find templates (exclude .bak files)
    template_files = sorted(
        [f for f in BOOTSTRAP_DIR.glob("*.json") if not f.name.endswith(".bak")]
    )
    print(f"Found {len(template_files)} bootstrap templates")
    print()

    success_count = 0
    skip_count = 0
    fail_count = 0

    for i, template_file in enumerate(template_files, 1):
        try:
            print(f"[{i}/{len(template_files)}] {template_file.name}")

            # Load template JSON
            with open(template_file, "r") as f:
                template = json.load(f)

            # Extract key fields
            variant_id = template.get("variant_id", "")
            activity_id = template.get("activity_id", "")
            variant_name = template.get("variant_name", "v1")
            description = template.get("description", "")
            tasks = template.get("tasks", template.get("task_steps", []))

            if not variant_id or not activity_id:
                print(f"  ✗ Missing variant_id or activity_id")
                fail_count += 1
                continue

            # Determine category
            if activity_id.startswith("feature"):
                category = "feature"
            elif activity_id.startswith("bug") or activity_id.startswith("fix"):
                category = "bugfix"
            elif activity_id.startswith("refactor") or activity_id.startswith("safe"):
                category = "refactor"
            else:
                category = "infrastructure"

            # Check if activity already exists
            check_activity = await db.query(
                f"SELECT * FROM activities WHERE activity_id = '{activity_id}' LIMIT 1"
            )

            activity_exists = check_activity and len(check_activity) > 0

            if not activity_exists:
                # Create activity record
                activity_name = activity_id.replace("-", " ").title()
                activity_data = {
                    "activity_id": activity_id,
                    "name": activity_name,
                    "description": description,
                    "category": category,
                    "tags": ["bootstrap", category],
                    "org_id": BOOTSTRAP_ORG,
                    "project_id": BOOTSTRAP_PROJECT,
                    "primary_language": "python",
                    "framework": None,
                    "tech_stack": ["opencode"],
                    "intent_keywords": [activity_id.replace("-", " ")],
                    "intent_patterns": [],
                    "source": "bootstrap",
                    "is_composed": False,
                    "composed_activity_ids": [],
                    "execution_count": 0,
                    "success_rate": 0.0,
                    "avg_duration_ms": 0,
                    "avg_cost": 0.0,
                    "avg_tokens": {},
                    "status": "active",
                }

                await db.query(
                    "CREATE activities CONTENT $data", {"data": activity_data}
                )
                print(f"  ✓ Created activity: {activity_name}")
            else:
                print(f"  → Activity exists: {activity_id}")

            # Check if variant already exists
            check_variant = await db.query(
                f"SELECT * FROM activity_variants WHERE variant_id = '{variant_id}' LIMIT 1"
            )

            if check_variant and len(check_variant) > 0:
                print(f"  ⚠ Variant already exists: {variant_id}")
                skip_count += 1
                continue

            # Create variant record
            variant_data = {
                "variant_id": variant_id,
                "activity_id": activity_id,
                "variant_name": variant_name,
                "version": template.get("version", 1),
                "description": description,
                "task_steps": tasks,
                "variables": template.get("variables", {}),
                "context_requirements": template.get("context_requirements", {}),
                "prompt_strategy": template.get("prompt_strategy", "guided"),
                "context_budget_tokens": template.get("context_budget_tokens", 25000),
                "expected_duration_ms": template.get("expected_duration_ms", 300000),
                "expected_cost": template.get("expected_cost", 0.5),
                "expected_quality_score": template.get("expected_quality_score", 0.8),
                "status": "active",
            }

            await db.query(
                "CREATE activity_variants CONTENT $data", {"data": variant_data}
            )
            print(f"  ✓ Created variant: {variant_name} ({len(tasks)} tasks)")
            success_count += 1

        except Exception as e:
            print(f"  ✗ Error: {e}")
            fail_count += 1

        print()

    await db.disconnect()

    # Summary
    print("=" * 70)
    print("Registration Summary")
    print("=" * 70)
    print(f"Total templates: {len(template_files)}")
    print(f"✓ Successfully registered: {success_count}")
    print(f"⚠ Skipped (already exist): {skip_count}")
    print(f"✗ Failed: {fail_count}")
    print()

    if fail_count == 0:
        print("✅ Bootstrap registration complete!")
        return 0
    else:
        print("⚠️ Some templates failed to register")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(register_templates()))
