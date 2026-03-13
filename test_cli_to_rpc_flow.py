#!/usr/bin/env python3
"""
Test script to simulate metabob-cli → RPC API → SurrealDB flow.
This demonstrates the actual data flow without requiring CLI binary.
"""

import requests
import json
import uuid
from datetime import datetime

API_URL = "http://metabob-rpc-api:8080"
API_KEY = "mb_devbob_test_simple_2026_v2"


def test_activity_tracking():
    """
    Simulate what metabob-cli does when tracking activity execution.
    This would be called by the CLI after executing an activity template.
    """

    print("=" * 60)
    print("TEST: CLI → RPC API → SurrealDB Data Flow")
    print("=" * 60)

    # Step 1: Create a session (like CLI would do at startup)
    session_id = f"sess_{uuid.uuid4().hex[:16]}"
    project_id = "proj_test_001"  # Existing project from seed data

    session_payload = {
        "session_id": session_id,
        "project_id": project_id,
        "org_id": "org_test_001",  # This would come from API key validation
        "user_id": "user_test_001",
        "metadata": {"cli_version": "0.24.0", "source": "test_script"},
    }

    print(f"\n1. Creating session via RPC API...")
    print(f"   Session ID: {session_id}")

    try:
        resp = requests.post(
            f"{API_URL}/api/sessions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json=session_payload,
            timeout=10,
        )
        print(f"   Status: {resp.status_code}")
        if resp.status_code >= 400:
            print(f"   Error: {resp.text[:200]}")
            print("\n   Trying alternative endpoint...")
            # Try without /api prefix
            resp = requests.post(
                f"{API_URL}/sessions",
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
                json=session_payload,
                timeout=10,
            )
            print(f"   Status: {resp.status_code}")
    except Exception as e:
        print(f"   Exception: {e}")
        return False

    # Step 2: Track activity execution (like CLI does after running a template)
    execution_id = f"exec_{uuid.uuid4().hex[:16]}"
    activity_payload = {
        "execution_id": execution_id,
        "session_id": session_id,
        "template_id": "add-feature-complete",
        "template_name": "Add Feature Complete",
        "status": "completed",
        "duration_ms": 42500,
        "cost_usd": 0.0115,
        "token_usage": {"input": 11200, "output": 2800, "cache": 7500},
        "tasks_completed": 5,
        "tasks_failed": 0,
        "metadata": {
            "feature_name": "Payment Integration",
            "files_modified": ["src/payment.ts", "tests/payment.test.ts"],
            "source": "cli_test",
        },
    }

    print(f"\n2. Tracking activity execution via RPC API...")
    print(f"   Execution ID: {execution_id}")
    print(f"   Template: {activity_payload['template_name']}")

    try:
        resp = requests.post(
            f"{API_URL}/api/activities/track",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json=activity_payload,
            timeout=10,
        )
        print(f"   Status: {resp.status_code}")
        if resp.status_code >= 400:
            print(f"   Error: {resp.text[:200]}")
    except Exception as e:
        print(f"   Exception: {e}")

    # Step 3: Verify data was written to SurrealDB
    print(f"\n3. Verifying data in SurrealDB...")

    try:
        # Query SurrealDB directly to see if RPC API wrote the data
        db_resp = requests.post(
            "http://surrealdb:8000/sql",
            headers={
                "Surreal-NS": "metabob",
                "Surreal-DB": "metabob",
                "Authorization": "Basic cm9vdDpyb290",
                "Accept": "application/json",
            },
            data=f'SELECT * FROM activity_executions WHERE execution_id = "{execution_id}";',
            timeout=5,
        )

        results = db_resp.json()
        if results and results[0]["status"] == "OK":
            executions = results[0]["result"]
            if executions:
                print(f"   ✓ Found execution in database!")
                print(f"   Template: {executions[0]['template_name']}")
                print(f"   Status: {executions[0]['status']}")
                print(f"   Cost: ${executions[0]['cost_usd']}")
                return True
            else:
                print(f"   ✗ Execution not found in database")
                print(f"   This means RPC API didn't write to DB")
        else:
            print(f"   Database query failed: {results}")

    except Exception as e:
        print(f"   Exception querying database: {e}")

    # Step 4: Check all existing executions for our org
    print(f"\n4. Listing all executions for org_test_001...")

    try:
        db_resp = requests.post(
            "http://surrealdb:8000/sql",
            headers={
                "Surreal-NS": "metabob",
                "Surreal-DB": "metabob",
                "Authorization": "Basic cm9vdDpyb290",
                "Accept": "application/json",
            },
            data='SELECT template_name, status, cost_usd, created_at FROM activity_executions WHERE org_id = "org_test_001" ORDER BY created_at DESC LIMIT 10;',
            timeout=5,
        )

        results = db_resp.json()
        if results and results[0]["status"] == "OK":
            executions = results[0]["result"]
            print(f"   Found {len(executions)} total executions:")
            for ex in executions:
                print(
                    f"     - {ex['template_name']}: {ex['status']} (${ex['cost_usd']})"
                )

    except Exception as e:
        print(f"   Exception: {e}")

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

    return False


if __name__ == "__main__":
    test_activity_tracking()
