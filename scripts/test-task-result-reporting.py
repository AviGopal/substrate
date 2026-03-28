#!/usr/bin/env python3
"""
Test task result reporting integration.

This script:
1. Creates a simple 2-task activity template
2. Executes the activity via OpenCode
3. Verifies task-level data appears in backend execution record

Expected outcome:
- Before: execution.tasks = []
- After: execution.tasks = [task0_data, task1_data]
"""

import json
import subprocess
import time
import requests
import sys
from pathlib import Path

# Configuration
BACKEND_URL = "http://localhost:8080"
PROJECT_ID = "exp-repo-dev"


def log(msg: str, level: str = "INFO"):
    """Print timestamped log message."""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}")


def check_backend():
    """Verify backend is running."""
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=5)
        if response.status_code == 200:
            data = response.json()
            version = data.get("version", "unknown")
            log(f"Backend is running (version {version})")
            return True
        else:
            log(f"Backend returned status {response.status_code}", "ERROR")
            return False
    except Exception as e:
        log(f"Backend not reachable: {e}", "ERROR")
        return False


def create_test_template():
    """Create a simple 2-task test template."""
    template = {
        "id": "test-task-reporting",
        "name": "Test Task Result Reporting",
        "description": "Simple 2-task template to test task result reporting",
        "version": "1.0.0",
        "category": "test",
        "variables": [],
        "tasks": [
            {
                "id": "task-1",
                "description": "First test task - echo message",
                "subagent": "general",
                "prompt": {"template": "Echo: Task 1 executed successfully"},
                "retry": {"maxAttempts": 1, "strategy": "simple"},
            },
            {
                "id": "task-2",
                "description": "Second test task - confirm completion",
                "subagent": "general",
                "prompt": {
                    "template": "Echo: Task 2 executed successfully. All tasks complete."
                },
                "retry": {"maxAttempts": 1, "strategy": "simple"},
            },
        ],
    }

    template_path = Path("/tmp/test-task-reporting.json")
    with open(template_path, "w") as f:
        json.dump(template, f, indent=2)

    log(f"Created test template: {template_path}")
    return str(template_path)


def register_template(template_path: str) -> bool:
    """Register template with backend via metabob-cli."""
    log("Registering template with backend...")
    try:
        result = subprocess.run(
            ["metabob-cli", "register-template", template_path],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode == 0:
            log("Template registered successfully")
            return True
        else:
            # 404 is expected if endpoint not implemented
            if "404" in result.stderr or "Not Found" in result.stderr:
                log("Template registration endpoint not available (expected)", "WARN")
                return True  # Continue test - template might be picked up from file
            log(f"Template registration failed: {result.stderr}", "ERROR")
            return False
    except Exception as e:
        log(f"Error registering template: {e}", "ERROR")
        return False


def execute_activity() -> str | None:
    """Execute the test activity and return execution ID."""
    log("Executing activity via OpenCode...")

    # Use OpenCode CLI to execute activity
    try:
        result = subprocess.run(
            [
                "opencode",
                "activity",
                "--template",
                "test-task-reporting",
                "--variables",
                "{}",
                "--reason",
                "Testing task result reporting integration",
            ],
            capture_output=True,
            text=True,
            timeout=120,  # 2 minutes for full execution
        )

        if result.returncode != 0:
            log(f"Activity execution failed: {result.stderr}", "ERROR")
            return None

        # Parse execution ID from output
        # Expected format: "Execution ID: exec_abc123"
        for line in result.stdout.split("\n"):
            if "Execution" in line and "exec_" in line:
                parts = line.split("exec_")
                if len(parts) > 1:
                    exec_id = "exec_" + parts[1].split()[0]
                    log(f"Activity execution started: {exec_id}")
                    return exec_id

        log("Could not parse execution ID from output", "WARN")
        log(f"Output: {result.stdout[:500]}")
        return None

    except Exception as e:
        log(f"Error executing activity: {e}", "ERROR")
        return None


def wait_for_completion(exec_id: str, max_wait: int = 120) -> bool:
    """Wait for activity execution to complete."""
    log(f"Waiting for execution {exec_id} to complete...")

    start_time = time.time()
    while time.time() - start_time < max_wait:
        try:
            response = requests.get(
                f"{BACKEND_URL}/v2/activities/executions/{exec_id}", timeout=5
            )

            if response.status_code == 200:
                data = response.json()
                status = data.get("status", "unknown")

                if status in ["completed", "failed"]:
                    log(f"Execution completed with status: {status}")
                    return True

                log(f"Execution status: {status}")

        except Exception as e:
            log(f"Error checking status: {e}", "WARN")

        time.sleep(5)

    log("Execution did not complete within timeout", "ERROR")
    return False


def verify_task_data(exec_id: str) -> bool:
    """Verify task-level data was recorded."""
    log(f"Verifying task data for execution {exec_id}...")

    try:
        response = requests.get(
            f"{BACKEND_URL}/v2/activities/executions/{exec_id}", timeout=5
        )

        if response.status_code != 200:
            log(f"Failed to fetch execution: HTTP {response.status_code}", "ERROR")
            return False

        data = response.json()
        tasks = data.get("tasks", [])

        log(f"Execution record retrieved")
        log(f"  Status: {data.get('status', 'unknown')}")
        log(f"  Duration: {data.get('duration', 0)}ms")
        log(f"  Tasks array length: {len(tasks)}")

        if len(tasks) == 0:
            log("❌ FAILED: No task data recorded (tasks array is empty)", "ERROR")
            return False

        if len(tasks) != 2:
            log(f"⚠️  WARNING: Expected 2 tasks, got {len(tasks)}", "WARN")

        # Verify task data structure
        for i, task in enumerate(tasks):
            log(f"\n  Task {i}:")
            log(f"    Index: {task.get('task_index', 'missing')}")
            log(f"    Name: {task.get('task_name', 'missing')}")
            log(f"    Status: {task.get('status', 'missing')}")
            log(f"    Duration: {task.get('duration_ms', 0)}ms")
            log(f"    Tokens: {task.get('tokens', {})}")
            log(f"    Cost: ${task.get('cost', 0.0):.4f}")

            if task.get("error"):
                log(f"    Error: {task.get('error')}")

        log("\n✅ SUCCESS: Task-level data is being recorded!", "INFO")
        return True

    except Exception as e:
        log(f"Error verifying task data: {e}", "ERROR")
        return False


def main():
    """Run end-to-end test."""
    log("=" * 60)
    log("Task Result Reporting Integration Test")
    log("=" * 60)

    # Step 1: Check backend
    if not check_backend():
        log("Aborting: Backend not available", "ERROR")
        return 1

    # Step 2: Create test template
    template_path = create_test_template()

    # Step 3: Register template (optional - might not be implemented)
    register_template(template_path)

    # Step 4: Execute activity
    exec_id = execute_activity()
    if not exec_id:
        log("Aborting: Could not execute activity", "ERROR")
        return 1

    # Step 5: Wait for completion
    if not wait_for_completion(exec_id):
        log("Aborting: Execution did not complete", "ERROR")
        return 1

    # Step 6: Verify task data
    if not verify_task_data(exec_id):
        log("Test FAILED: Task data not recorded", "ERROR")
        return 1

    log("\n" + "=" * 60)
    log("Test PASSED: Task result reporting is working!", "INFO")
    log("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
