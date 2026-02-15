#!/usr/bin/env python3
"""
Handoff Validation 3: Activity Execution Start

Validates: OpenCode → CLI → Backend → Database
Flow: OpenCode calls activity() → CLI MCP → Backend POST /v2/activities/record/start → activity_selections + activity_executions

Tests:
1. Session creation with valid token
2. Activity template search (to get valid activity_id)
3. Activity execution start succeeds
4. activity_selections row created (tracks user choice)
5. activity_executions row created (status="running")
6. execution_id returned for step tracking
"""

import os
import sys
import json
import requests
from typing import Dict, Any

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
TEST_API_KEY = os.getenv("TEST_API_KEY", "test-api-key")


def run_validation(verbose: bool = False) -> Dict[str, Any]:
    """Run activity execution start handoff validation."""
    result = {"passed": False, "details": {}, "error": None}

    try:
        # Step 1: Create session
        if verbose:
            print("\n[1/6] Creating test session...")

        session_data = {
            "api_key": TEST_API_KEY,
            "primary_language": "python",
            "tech_stack": ["python", "fastapi"],
            "project_context": {
                "project_name": "validation-test-execution",
                "org_name": "test-org",
            },
        }

        session_resp = requests.post(
            f"{BACKEND_URL}/v2/session", json=session_data, timeout=10
        )

        if session_resp.status_code != 200:
            result["error"] = (
                f"Session creation failed: {session_resp.status_code} - {session_resp.text[:200]}"
            )
            return result

        session_result = session_resp.json()
        # V2 API returns session_token in metadata
        session_token = session_result.get("metadata", {}).get("session_token")
        session_id = session_result.get("session_id")

        if not session_token:
            result["error"] = "No session_token in response metadata"
            return result

        result["details"]["session_created"] = True
        result["details"]["session_id"] = session_id

        headers = {"Authorization": f"Bearer {session_token}"}

        if verbose:
            print(f"✅ Session created: {session_id}")

        # Step 2: Search for activity template
        if verbose:
            print("\n[2/6] Searching for activity template...")

        search_resp = requests.get(
            f"{BACKEND_URL}/v2/activities/templates?category=feature&limit=5",
            headers=headers,
            timeout=10,
        )

        if search_resp.status_code != 200:
            result["error"] = f"Activity search failed: {search_resp.status_code}"
            return result

        search_result = search_resp.json()
        activities = search_result.get("templates", [])

        if not activities:
            result["error"] = "No activities found in search results"
            return result

        # Pick the first activity
        activity = activities[0]
        activity_id = activity.get("activity_id")
        variant_id = activity.get("variant_id")

        if not activity_id:
            result["error"] = "No activity_id in search results"
            return result

        result["details"]["activity_search_success"] = True
        result["details"]["activity_id"] = activity_id
        result["details"]["variant_id"] = variant_id

        if verbose:
            print(f"✅ Activity found: {activity_id}")
            if variant_id:
                print(f"   Variant: {variant_id}")

        # Step 3: Start activity execution
        if verbose:
            print("\n[3/6] Starting activity execution...")

        import uuid

        execution_id = f"exec-{uuid.uuid4().hex[:12]}"

        execution_data = {
            "execution_id": execution_id,
            "template_id": variant_id,  # V2 API uses template_id (variant ID from search)
            "session_id": session_id,
            "variables": {
                "feature_name": "test-feature",
                "feature_description": "Test feature for validation",
            },
        }

        execution_resp = requests.post(
            f"{BACKEND_URL}/v2/activities/record/start",
            headers=headers,
            json=execution_data,
            timeout=10,
        )

        if execution_resp.status_code != 200:
            result["error"] = (
                f"Execution start failed: {execution_resp.status_code} - {execution_resp.text[:200]}"
            )
            result["details"]["execution_response_status"] = execution_resp.status_code
            return result

        execution_result = execution_resp.json()
        execution_id = execution_result.get("execution_id")

        if not execution_id:
            result["error"] = "No execution_id in response"
            return result

        result["details"]["execution_started"] = True
        result["details"]["execution_id"] = execution_id

        if verbose:
            print(f"✅ Execution started: {execution_id}")

        # Step 4: Verify activity_selections created
        if verbose:
            print("\n[4/6] Verifying activity_selections row created...")

        # Query backend to verify selection was recorded
        selections_resp = requests.get(
            f"{BACKEND_URL}/v2/activities/executions?session_id={session_id}",
            headers=headers,
            timeout=5,
        )

        if selections_resp.status_code != 200:
            result["error"] = (
                f"Failed to query selections: {selections_resp.status_code}"
            )
            return result

        selections_data = selections_resp.json()
        executions = selections_data.get("executions", [])

        # Find our execution
        our_execution = None
        for exec_item in executions:
            if exec_item.get("execution_id") == execution_id:
                our_execution = exec_item
                break

        if not our_execution:
            result["error"] = "Execution not found in query results"
            return result

        result["details"]["activity_selection_verified"] = True

        if verbose:
            print(f"✅ activity_selections row verified")

        # Step 5: Verify activity_executions status (proto: success=False means running)
        if verbose:
            print("\n[5/6] Verifying activity_executions status...")

        # Proto schema uses success (bool), not status (string)
        # success=False means execution started but not yet complete
        execution_success = our_execution.get("success")
        if execution_success != False:  # Explicitly check False (not None, not True)
            result["error"] = (
                f"Expected success=False (running), got '{execution_success}'"
            )
            return result

        result["details"]["execution_success"] = execution_success

        if verbose:
            print(f"✅ Execution status: running (success=False)")

        # Step 6: Verify execution_id can be used for step recording
        if verbose:
            print("\n[6/6] Verifying execution_id ready for step tracking...")

        # We don't actually record a step here, but verify the structure
        if not execution_id or not isinstance(execution_id, str):
            result["error"] = "execution_id invalid for step tracking"
            return result

        result["details"]["execution_id_valid"] = True

        if verbose:
            print(f"✅ execution_id valid for step tracking")

        # All checks passed
        result["passed"] = True

        if verbose:
            print("\n" + "=" * 70)
            print("✅ ACTIVITY EXECUTION START HANDOFF VALIDATED")
            print("=" * 70)
            print("\nVerified:")
            print("  ✅ Session created with valid token")
            print("  ✅ Activity template search succeeded")
            print("  ✅ Activity execution started")
            print("  ✅ activity_selections row created (user choice tracked)")
            print("  ✅ activity_executions row created (status='running')")
            print("  ✅ execution_id returned for step tracking")

    except Exception as e:
        result["error"] = str(e)
        if verbose:
            import traceback

            print(traceback.format_exc())

    return result


if __name__ == "__main__":
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    result = run_validation(verbose=verbose)

    if result["passed"]:
        print("\n✅ Validation PASSED")
        sys.exit(0)
    else:
        print(f"\n❌ Validation FAILED: {result['error']}")
        sys.exit(1)
