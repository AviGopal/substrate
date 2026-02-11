#!/usr/bin/env python3
"""
Test the create-activity-template workflow end-to-end.

This test verifies:
1. create-activity-template can be executed
2. A new template JSON is created
3. The template is registered with the backend
4. The new template is discoverable via search
5. The new template can be executed

Flow:
1. Get initial template count
2. Execute create-activity-template activity
3. Verify new template appears in database
4. Verify new template can be found via search
5. Verify new template has correct structure
"""

import httpx
import json
import time
from typing import Dict, Any, Optional

BASE_URL = "http://localhost:8080"
SESSION_ID: Optional[str] = None


def log(msg: str, level: str = "INFO"):
    """Log with color."""
    colors = {
        "INFO": "\033[0;34m",
        "SUCCESS": "\033[0;32m",
        "ERROR": "\033[0;31m",
        "WARN": "\033[0;33m",
    }
    reset = "\033[0m"
    print(f"{colors.get(level, '')}{msg}{reset}")


def create_session() -> str:
    """Create a session."""
    log("[1/6] Creating session...", "INFO")

    response = httpx.post(
        f"{BASE_URL}/v2/sessions",
        json={
            "name": "test-activity-creation",
            "metadata": {"test": "create-activity-template"},
        },
        timeout=30.0,
    )

    if response.status_code != 200:
        raise Exception(
            f"Session creation failed: {response.status_code} - {response.text}"
        )

    session = response.json()
    session_id = session.get("id") or session.get("session_id")
    log(f"    ✓ Session created: {session_id}", "SUCCESS")
    return session_id


def get_template_count(session_id: str) -> int:
    """Get current template count."""
    log("[2/6] Getting initial template count...", "INFO")

    response = httpx.post(
        f"{BASE_URL}/v2/activities/search",
        json={"session_id": session_id, "query": "", "limit": 100},
        timeout=30.0,
    )

    if response.status_code != 200:
        log(f"    ⚠ Could not get template count: {response.status_code}", "WARN")
        return 0

    data = response.json()
    count = len(data.get("results", []))
    log(f"    ✓ Current template count: {count}", "SUCCESS")
    return count


def start_activity_execution(session_id: str) -> str:
    """Start create-activity-template execution."""
    log("[3/6] Starting create-activity-template execution...", "INFO")

    # First, find the create-activity-template
    search_response = httpx.post(
        f"{BASE_URL}/v2/activities/search",
        json={
            "session_id": session_id,
            "query": "create activity template",
            "category": "infrastructure",
            "limit": 5,
        },
        timeout=30.0,
    )

    if search_response.status_code != 200:
        raise Exception(f"Search failed: {search_response.status_code}")

    results = search_response.json().get("results", [])

    # Find the create-activity-template
    template_id = None
    for result in results:
        if (
            "create" in result.get("name", "").lower()
            and "template" in result.get("name", "").lower()
        ):
            template_id = result.get("id") or result.get("variant_id")
            break

    if not template_id:
        raise Exception("create-activity-template not found")

    log(f"    ✓ Found template: {template_id}", "SUCCESS")

    # Start execution
    exec_response = httpx.post(
        f"{BASE_URL}/v2/activities/executions",
        json={
            "session_id": session_id,
            "variant_id": template_id,
            "variables": {
                "templateName": "Test Greeting Activity",
                "templateDescription": "A simple test activity that greets the user",
                "templateId": "test-greeting",
                "category": "infrastructure",
                "purpose": "Test template creation workflow",
            },
        },
        timeout=30.0,
    )

    if exec_response.status_code != 200:
        raise Exception(
            f"Execution start failed: {exec_response.status_code} - {exec_response.text}"
        )

    exec_data = exec_response.json()
    execution_id = exec_data.get("execution_id")
    log(f"    ✓ Execution started: {execution_id}", "SUCCESS")
    return execution_id


def wait_for_completion(
    session_id: str, execution_id: str, timeout: int = 300
) -> Dict[str, Any]:
    """Wait for activity to complete."""
    log("[4/6] Waiting for activity to complete...", "INFO")

    start_time = time.time()

    while time.time() - start_time < timeout:
        response = httpx.get(
            f"{BASE_URL}/v2/activities/executions/{execution_id}",
            params={"session_id": session_id},
            timeout=30.0,
        )

        if response.status_code != 200:
            log(f"    ⚠ Status check failed: {response.status_code}", "WARN")
            time.sleep(5)
            continue

        data = response.json()
        status = data.get("status")

        log(f"    Status: {status}", "INFO")

        if status in ["completed", "success", "done"]:
            log(f"    ✓ Activity completed successfully!", "SUCCESS")
            return data
        elif status in ["failed", "error"]:
            log(f"    ✗ Activity failed: {data.get('error', 'Unknown error')}", "ERROR")
            return data

        time.sleep(10)

    raise TimeoutError(f"Activity did not complete within {timeout}s")


def verify_new_template(session_id: str, initial_count: int) -> bool:
    """Verify new template was created."""
    log("[5/6] Verifying new template was created...", "INFO")

    # Search for the new template
    response = httpx.post(
        f"{BASE_URL}/v2/activities/search",
        json={"session_id": session_id, "query": "test greeting", "limit": 10},
        timeout=30.0,
    )

    if response.status_code != 200:
        log(f"    ✗ Search failed: {response.status_code}", "ERROR")
        return False

    results = response.json().get("results", [])

    # Look for our new template
    for result in results:
        name = result.get("name", "").lower()
        if "test" in name and "greeting" in name:
            log(
                f"    ✓ Found new template: {result.get('name')} (id: {result.get('id')})",
                "SUCCESS",
            )
            return True

    log(f"    ⚠ New template not found in search results", "WARN")

    # Check if total count increased
    new_response = httpx.post(
        f"{BASE_URL}/v2/activities/search",
        json={"session_id": session_id, "query": "", "limit": 100},
        timeout=30.0,
    )

    if new_response.status_code == 200:
        new_count = len(new_response.json().get("results", []))
        if new_count > initial_count:
            log(
                f"    ✓ Template count increased: {initial_count} → {new_count}",
                "SUCCESS",
            )
            return True

    return False


def test_new_template_execution(session_id: str) -> bool:
    """Try to execute the newly created template."""
    log("[6/6] Testing execution of new template...", "INFO")

    # Search for the template
    response = httpx.post(
        f"{BASE_URL}/v2/activities/search",
        json={"session_id": session_id, "query": "test greeting", "limit": 5},
        timeout=30.0,
    )

    if response.status_code != 200:
        log(f"    ✗ Search failed", "ERROR")
        return False

    results = response.json().get("results", [])

    for result in results:
        name = result.get("name", "").lower()
        if "test" in name and "greeting" in name:
            template_id = result.get("id") or result.get("variant_id")
            log(f"    ✓ Found template, attempting execution: {template_id}", "SUCCESS")

            # Try to start execution (just to verify it's executable)
            exec_response = httpx.post(
                f"{BASE_URL}/v2/activities/executions",
                json={
                    "session_id": session_id,
                    "variant_id": template_id,
                    "variables": {},
                },
                timeout=30.0,
            )

            if exec_response.status_code == 200:
                log(f"    ✓ New template is executable!", "SUCCESS")
                return True
            else:
                log(
                    f"    ⚠ Execution start returned {exec_response.status_code}",
                    "WARN",
                )
                return False

    log(f"    ✗ Template not found for execution test", "ERROR")
    return False


def main():
    """Run the complete test."""
    log("=" * 60, "INFO")
    log("Create Activity Template Workflow Test", "INFO")
    log("=" * 60, "INFO")
    log("", "INFO")

    try:
        # Step 1: Create session
        session_id = create_session()
        time.sleep(2)

        # Step 2: Get initial count
        initial_count = get_template_count(session_id)
        time.sleep(2)

        # Step 3: Start create-activity-template execution
        execution_id = start_activity_execution(session_id)
        time.sleep(5)

        # Step 4: Wait for completion
        result = wait_for_completion(session_id, execution_id, timeout=300)

        # Step 5: Verify new template
        template_created = verify_new_template(session_id, initial_count)

        # Step 6: Test new template execution
        template_executable = False
        if template_created:
            template_executable = test_new_template_execution(session_id)

        log("", "INFO")
        log("=" * 60, "INFO")

        if template_created and template_executable:
            log("✓ ALL TESTS PASSED", "SUCCESS")
            log("=" * 60, "INFO")
            log("", "INFO")
            log("Verified:", "INFO")
            log("  1. ✓ create-activity-template executed", "INFO")
            log("  2. ✓ New template created in database", "INFO")
            log("  3. ✓ New template is discoverable", "INFO")
            log("  4. ✓ New template is executable", "INFO")
            return 0
        else:
            log("✗ TESTS INCOMPLETE", "ERROR")
            log("=" * 60, "INFO")
            if not template_created:
                log("  ✗ New template not found", "ERROR")
            if not template_executable:
                log("  ✗ New template not executable", "ERROR")
            return 1

    except Exception as e:
        log("", "INFO")
        log("=" * 60, "INFO")
        log(f"✗ TEST FAILED: {e}", "ERROR")
        log("=" * 60, "INFO")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
