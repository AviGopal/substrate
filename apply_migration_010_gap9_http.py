#!/usr/bin/env python3
"""Apply migration 010: Add multi-tenant scoping fields (GAP-9) via HTTP"""

import requests
import json
import sys

# SurrealDB HTTP endpoint
SURREAL_URL = "http://localhost:8000"
USERNAME = "root"
PASSWORD = "changeme"
NAMESPACE = "metabob"
DATABASE = "learning_loop"


def execute_query(query: str, description: str):
    """Execute a SurrealDB query via HTTP"""
    try:
        # SurrealDB v2.0+ uses /sql endpoint with specific headers
        headers = {
            "Accept": "application/json",
            "NS": NAMESPACE,
            "DB": DATABASE,
        }

        response = requests.post(
            f"{SURREAL_URL}/sql",
            auth=(USERNAME, PASSWORD),
            headers=headers,
            data=query,
            timeout=30,
        )

        if response.status_code == 200:
            result = response.json()
            print(f"   ✓ {description}")
            return True, result
        else:
            print(f"   ⚠ {description} - Status {response.status_code}")
            print(f"      Response: {response.text}")
            return False, response.text

    except Exception as e:
        print(f"   ❌ {description} - Error: {e}")
        return False, str(e)


def main():
    print("\n=== Applying Migration 010: Multi-Tenant Scoping (GAP-9) ===\n")

    # Step 1: Test connection
    print("1. Testing connection...")
    success, result = execute_query("INFO FOR DB;", "Connection test")
    if not success:
        print("\n❌ Connection failed. Make sure SurrealDB is running and accessible.")
        print(f"   URL: {SURREAL_URL}")
        print(f"   Namespace: {NAMESPACE}")
        print(f"   Database: {DATABASE}")
        sys.exit(1)

    # Step 2: Add fields to activity_executions
    print("\n2. Adding org_id to activity_executions...")
    execute_query(
        "DEFINE FIELD org_id ON activity_executions TYPE option<string>;",
        "Define org_id field",
    )

    print("\n3. Adding project_id to activity_executions...")
    execute_query(
        "DEFINE FIELD project_id ON activity_executions TYPE option<string>;",
        "Define project_id field",
    )

    # Step 3: Add fields to activity_template
    print("\n4. Adding scope to activity_template...")
    execute_query(
        "DEFINE FIELD scope ON activity_template TYPE option<string>;",
        "Define scope field",
    )

    print("\n5. Adding org_id to activity_template...")
    execute_query(
        "DEFINE FIELD org_id ON activity_template TYPE option<string>;",
        "Define org_id field",
    )

    print("\n6. Adding project_id to activity_template...")
    execute_query(
        "DEFINE FIELD project_id ON activity_template TYPE option<string>;",
        "Define project_id field",
    )

    # Step 4: Create indexes
    print("\n7. Creating index on activity_executions.org_id...")
    execute_query(
        "DEFINE INDEX org_id_idx ON activity_executions FIELDS org_id;",
        "Create org_id index",
    )

    print("\n8. Creating index on activity_template.org_id...")
    execute_query(
        "DEFINE INDEX template_org_id_idx ON activity_template FIELDS org_id;",
        "Create template_org_id index",
    )

    # Step 5: Verify
    print("\n9. Verifying activity_executions schema...")
    success, result = execute_query("INFO FOR TABLE activity_executions;", "Table info")
    if success:
        print(f"      Schema: {json.dumps(result, indent=2)[:500]}...")

    print("\n10. Verifying activity_template schema...")
    success, result = execute_query("INFO FOR TABLE activity_template;", "Table info")
    if success:
        print(f"      Schema: {json.dumps(result, indent=2)[:500]}...")

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


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Migration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Migration failed with unexpected error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
