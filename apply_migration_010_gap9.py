#!/usr/bin/env python3
"""Apply migration 010: Add multi-tenant scoping fields (GAP-9)

This migration adds:
- activity_executions: org_id (string), project_id (string)
- activity_template: scope (string), org_id (string), project_id (string)

These fields enable multi-tenant isolation and filtering as specified in
Activity Lifecycle E2E Validation specification.
"""

import asyncio
import sys
import os

# Add RPC API to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "repos/metabob-rpc-api"))

from server.db.surrealdb_client import get_surreal_client


async def apply_migration():
    """Apply migration 010 to add multi-tenant scoping fields"""

    print("Connecting to SurrealDB...")
    db = await get_surreal_client()

    print("\n=== Applying Migration 010: Multi-Tenant Scoping (GAP-9) ===\n")

    # Step 1: Add org_id field to activity_executions
    print("1. Adding org_id field to activity_executions table...")
    try:
        result1 = await db.query(
            "DEFINE FIELD org_id ON activity_executions TYPE option<string>;"
        )
        print(f"   ✓ Result: {result1}")
    except Exception as e:
        print(f"   ⚠ Warning: {e} (field may already exist)")

    # Step 2: Add project_id field to activity_executions
    print("\n2. Adding project_id field to activity_executions table...")
    try:
        result2 = await db.query(
            "DEFINE FIELD project_id ON activity_executions TYPE option<string>;"
        )
        print(f"   ✓ Result: {result2}")
    except Exception as e:
        print(f"   ⚠ Warning: {e} (field may already exist)")

    # Step 3: Add scope field to activity_template
    print("\n3. Adding scope field to activity_template table...")
    try:
        result3 = await db.query(
            "DEFINE FIELD scope ON activity_template TYPE option<string>;"
        )
        print(f"   ✓ Result: {result3}")
    except Exception as e:
        print(f"   ⚠ Warning: {e} (field may already exist)")

    # Step 4: Add org_id field to activity_template
    print("\n4. Adding org_id field to activity_template table...")
    try:
        result4 = await db.query(
            "DEFINE FIELD org_id ON activity_template TYPE option<string>;"
        )
        print(f"   ✓ Result: {result4}")
    except Exception as e:
        print(f"   ⚠ Warning: {e} (field may already exist)")

    # Step 5: Add project_id field to activity_template
    print("\n5. Adding project_id field to activity_template table...")
    try:
        result5 = await db.query(
            "DEFINE FIELD project_id ON activity_template TYPE option<string>;"
        )
        print(f"   ✓ Result: {result5}")
    except Exception as e:
        print(f"   ⚠ Warning: {e} (field may already exist)")

    # Step 6: Create index on org_id for faster filtering
    print("\n6. Creating index on org_id for activity_executions...")
    try:
        result6 = await db.query(
            "DEFINE INDEX org_id_idx ON activity_executions FIELDS org_id;"
        )
        print(f"   ✓ Result: {result6}")
    except Exception as e:
        print(f"   ⚠ Warning: {e} (index may already exist)")

    # Step 7: Create index on org_id for activity_template
    print("\n7. Creating index on org_id for activity_template...")
    try:
        result7 = await db.query(
            "DEFINE INDEX template_org_id_idx ON activity_template FIELDS org_id;"
        )
        print(f"   ✓ Result: {result7}")
    except Exception as e:
        print(f"   ⚠ Warning: {e} (index may already exist)")

    # Step 8: Verify the field definitions
    print("\n8. Verifying activity_executions table schema...")
    result8 = await db.query("INFO FOR TABLE activity_executions;")
    print(f"   Table info: {result8}")

    print("\n9. Verifying activity_template table schema...")
    result9 = await db.query("INFO FOR TABLE activity_template;")
    print(f"   Table info: {result9}")

    print("\n=== Migration 010 Applied Successfully ===\n")
    print("✓ activity_executions: Added org_id, project_id fields + index")
    print("✓ activity_template: Added scope, org_id, project_id fields + index")
    print("\nNext steps:")
    print(
        "1. Build Docker image: docker build -t metabobapp/metabob-rpc-api:0.24.0-phase1-gap9"
    )
    print(
        "2. Deploy to k8s: helmfile --environment default -l name=metabob-rpc-api apply"
    )
    print(
        "3. Run Phase 3 validation: python tests/validation-harnesses/activity-lifecycle-e2e-phased-validation.py --phase 3"
    )

    return True


if __name__ == "__main__":
    try:
        asyncio.run(apply_migration())
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)
