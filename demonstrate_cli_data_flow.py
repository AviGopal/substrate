#!/usr/bin/env python3
"""
Demonstrate how metabob-cli generates data that appears in the dashboard.

This script simulates the CLI's interaction with the RPC API, showing how each
CLI command generates specific data that flows through:
  CLI → RPC API → SurrealDB → Dashboard

Dashboard Panels and Their Data Sources:
1. Activity History: Created by CLI executing activity templates
2. Template Usage: Created by CLI searching/listing templates
3. Optimization Metrics: Created by RPC API tracking template performance
4. Cost Tracking: Aggregated from activity execution costs
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration (matching CLI's .opencode/opencode.json)
API_URL = "http://metabob-rpc-api:8080"
API_KEY = "mb_devbob_test_simple_2026_v2"


def demonstrate_activity_execution():
    """
    Simulates: metabob-cli activity execute --template add-feature-complete

    This generates:
    - Activity execution record in activity_executions table
    - Session data in sessions table
    - Updates template usage statistics
    - Cost tracking data

    Dashboard panels affected:
    - Activity History: Shows the execution with status, duration, cost
    - Cost Tracking: Aggregates execution costs
    - Template Usage: Updates template execution counts
    """
    print("\n" + "=" * 80)
    print("DEMONSTRATION 1: CLI Activity Execution")
    print("Command: metabob-cli activity execute --template add-feature-complete")
    print("=" * 80)

    # Step 1: Create session (CLI does this on startup)
    session_id = f"sess_{uuid.uuid4().hex[:16]}"
    session_payload = {
        "session_id": session_id,
        "project_id": "proj_test_001",
        "org_id": "org_test_001",
        "user_id": "user_test_001",
        "metadata": {"cli_version": "0.24.0", "command": "activity execute"},
    }

    print(f"\n1. CLI creates session: {session_id}")
    print(f"   → POST {API_URL}/api/sessions")
    print(f"   → Data: {json.dumps(session_payload, indent=2)}")

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
        print(f"   ← Response: {resp.status_code}")
        if resp.status_code >= 400:
            print(f"   ← Error: {resp.text[:200]}")
    except Exception as e:
        print(f"   ← Exception: {e}")

    # Step 2: Execute activity and track execution
    execution_id = f"exec_{uuid.uuid4().hex[:16]}"
    activity_payload = {
        "execution_id": execution_id,
        "session_id": session_id,
        "template_id": "add-feature-complete",
        "template_name": "Add Feature Complete",
        "status": "completed",
        "duration_ms": 38500,
        "cost_usd": 0.0145,
        "token_usage": {"input": 13200, "output": 3100, "cache": 8200},
        "tasks_completed": 5,
        "tasks_failed": 0,
        "metadata": {
            "feature_name": "User Profile Management",
            "files_modified": ["src/user_profile.ts", "tests/user_profile.test.ts"],
            "cli_generated": True,
        },
    }

    print(f"\n2. CLI tracks activity execution: {execution_id}")
    print(f"   → POST {API_URL}/api/activities/track")
    print(f"   → Template: {activity_payload['template_name']}")
    print(f"   → Duration: {activity_payload['duration_ms']}ms")
    print(f"   → Cost: ${activity_payload['cost_usd']}")
    print(f"   → Status: {activity_payload['status']}")

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
        print(f"   ← Response: {resp.status_code}")
        if resp.status_code == 200:
            print(f"   ✓ Data written to SurrealDB!")
            print(f"   ✓ Dashboard Activity History will show this execution")
            print(
                f"   ✓ Dashboard Cost Tracking will include ${activity_payload['cost_usd']}"
            )
        else:
            print(f"   ← Error: {resp.text[:200]}")
    except Exception as e:
        print(f"   ← Exception: {e}")

    return execution_id


def demonstrate_template_search():
    """
    Simulates: metabob-cli activity search --query "feature"

    This generates:
    - Template search/usage logs
    - Template access statistics

    Dashboard panels affected:
    - Template Usage: Shows which templates are being searched/used
    - Optimization Metrics: Tracks template popularity
    """
    print("\n" + "=" * 80)
    print("DEMONSTRATION 2: CLI Template Search")
    print("Command: metabob-cli activity search --query feature")
    print("=" * 80)

    print(f"\n1. CLI searches for templates")
    print(f"   → GET {API_URL}/api/templates?query=feature&category=all")

    try:
        resp = requests.get(
            f"{API_URL}/api/templates",
            headers={"Authorization": f"Bearer {API_KEY}"},
            params={"query": "feature", "category": "all"},
            timeout=10,
        )
        print(f"   ← Response: {resp.status_code}")
        if resp.status_code == 200:
            templates = resp.json().get("templates", [])
            print(f"   ✓ Found {len(templates)} templates")
            for t in templates[:3]:
                print(
                    f"     - {t.get('name')}: {t.get('success_rate', 0) * 100:.1f}% success"
                )
            print(f"   ✓ Dashboard Template Usage will show search activity")
        else:
            print(f"   ← Error: {resp.text[:200]}")
    except Exception as e:
        print(f"   ← Exception: {e}")


def demonstrate_template_listing():
    """
    Simulates: metabob-cli activity list

    This generates:
    - Template list requests
    - Template metadata retrieval

    Dashboard panels affected:
    - Template Usage: Shows template access patterns
    """
    print("\n" + "=" * 80)
    print("DEMONSTRATION 3: CLI Template Listing")
    print("Command: metabob-cli activity list")
    print("=" * 80)

    print(f"\n1. CLI lists all available templates")
    print(f"   → GET {API_URL}/api/templates")

    try:
        resp = requests.get(
            f"{API_URL}/api/templates",
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=10,
        )
        print(f"   ← Response: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            templates = data.get("templates", [])
            print(f"   ✓ Retrieved {len(templates)} templates")
            print(f"   ✓ Dashboard will show these in Template Usage panel")
            for t in templates[:5]:
                print(
                    f"     - {t.get('template_id')}: {t.get('total_executions', 0)} executions"
                )
        else:
            print(f"   ← Error: {resp.text[:200]}")
    except Exception as e:
        print(f"   ← Exception: {e}")


def verify_dashboard_data():
    """
    Verify the data that was written to SurrealDB is available for dashboard display.
    This simulates what the dashboard queries when loading panels.
    """
    print("\n" + "=" * 80)
    print("VERIFICATION: Data Available for Dashboard Display")
    print("=" * 80)

    # Verify activity executions (for Activity History panel)
    print("\n1. Activity History Panel Data:")
    print(f"   → GET {API_URL}/api/organizations/org_test_001/activities")

    try:
        resp = requests.get(
            f"{API_URL}/api/organizations/org_test_001/activities",
            headers={"Authorization": f"Bearer {API_KEY}"},
            params={"limit": 10},
            timeout=10,
        )
        print(f"   ← Response: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            activities = data.get("activities", [])
            print(f"   ✓ Found {len(activities)} activity executions")
            total_cost = sum(a.get("cost_usd", 0) for a in activities)
            print(f"   ✓ Total cost: ${total_cost:.4f}")
            for a in activities[:3]:
                print(
                    f"     - {a.get('template_name')}: {a.get('status')} (${a.get('cost_usd')})"
                )
        else:
            print(f"   ← Error: {resp.text[:200]}")
    except Exception as e:
        print(f"   ← Exception: {e}")

    # Verify template usage (for Template Usage panel)
    print("\n2. Template Usage Panel Data:")
    print(f"   → GET {API_URL}/api/templates")

    try:
        resp = requests.get(
            f"{API_URL}/api/templates",
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=10,
        )
        print(f"   ← Response: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            templates = data.get("templates", [])
            print(f"   ✓ Found {len(templates)} templates")
            for t in templates[:3]:
                success_rate = (
                    (t.get("success_count", 0) / t.get("total_executions", 1) * 100)
                    if t.get("total_executions", 0) > 0
                    else 0
                )
                print(f"     - {t.get('name')}: {success_rate:.1f}% success rate")
        else:
            print(f"   ← Error: {resp.text[:200]}")
    except Exception as e:
        print(f"   ← Exception: {e}")

    # Verify optimization metrics (for Optimization Metrics panel)
    print("\n3. Optimization Metrics Panel Data:")
    print(f"   → GET {API_URL}/api/organizations/org_test_001/optimizations")

    try:
        resp = requests.get(
            f"{API_URL}/api/organizations/org_test_001/optimizations",
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=10,
        )
        print(f"   ← Response: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            optimizations = data.get("optimizations", [])
            print(f"   ✓ Found {len(optimizations)} optimization records")
            for opt in optimizations[:3]:
                print(
                    f"     - {opt.get('template_id')}: {opt.get('success_rate', 0) * 100:.1f}% (α={opt.get('metadata', {}).get('alpha')}, β={opt.get('metadata', {}).get('beta')})"
                )
        else:
            print(f"   ← Error: {resp.text[:200]}")
    except Exception as e:
        print(f"   ← Exception: {e}")


def main():
    print("\n" + "=" * 80)
    print("METABOB CLI → RPC API → SURREALDB → DASHBOARD DATA FLOW DEMONSTRATION")
    print("=" * 80)
    print("\nThis demonstrates how each CLI command generates data that flows through")
    print("the system and appears in the dashboard panels.")
    print("\nAPI Configuration:")
    print(f"  API URL: {API_URL}")
    print(f"  API Key: {API_KEY}")
    print(f"  Organization: org_test_001")

    # Run demonstrations
    exec_id = demonstrate_activity_execution()
    demonstrate_template_search()
    demonstrate_template_listing()
    verify_dashboard_data()

    print("\n" + "=" * 80)
    print("SUMMARY: CLI-Generated Data Flow")
    print("=" * 80)
    print("""
Dashboard Panel          | CLI Command                          | RPC API Endpoint
------------------------|--------------------------------------|----------------------------------
Activity History        | activity execute <template>          | POST /api/activities/track
Template Usage          | activity list                        | GET /api/templates
Template Usage          | activity search <query>              | GET /api/templates?query=...
Optimization Metrics    | (automatic tracking by RPC API)      | GET /api/organizations/.../optimizations
Cost Tracking          | (aggregated from executions)         | GET /api/organizations/.../activities
Session Management      | (automatic on CLI startup)           | POST /api/sessions

Data Flow Path:
  1. User runs CLI command (e.g., metabob-cli activity execute)
  2. CLI authenticates with API key (mb_devbob_test_simple_2026_v2)
  3. RPC API validates API key → gets org_id (org_test_001)
  4. RPC API writes data to SurrealDB with org_id for isolation
  5. Dashboard queries RPC API with user's auth token
  6. RPC API filters data by user's organization
  7. Dashboard displays organization-specific data

✓ All data is filtered by organization (multi-tenancy)
✓ No direct database writes from CLI (architecture enforced)
✓ API key ensures organization-level isolation
    """)
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
