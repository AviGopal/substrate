#!/usr/bin/env python3
"""
Simple Live Data Flow Test

This validates that activity execution data flows through production code:
OpenCode → MCP → Backend API → Database

Unlike previous tests that manually inserted data, this triggers REAL production code.
"""

import asyncio
import json
import sys
import uuid
import httpx
from datetime import datetime

# Colors for output
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"


def log(level, message):
    """Colored logging"""
    color = {"INFO": GREEN, "WARN": YELLOW, "ERROR": RED}.get(level, NC)
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"{color}[{timestamp}] [{level}] {message}{NC}")


async def verify_backend_running():
    """Check if backend API is accessible"""
    try:
        async with httpx.AsyncClient() as client:
            # Try root endpoint first (returns status)
            response = await client.get("http://localhost:8080/", timeout=2.0)
            if response.status_code == 200:
                log("INFO", "✓ Backend API is running")
                return True
            # Also try /api/health
            response = await client.get("http://localhost:8080/api/health", timeout=2.0)
            if response.status_code == 200:
                log("INFO", "✓ Backend API is running (via /api/health)")
                return True
    except Exception as e:
        log("ERROR", f"✗ Backend API not accessible: {e}")
        log(
            "ERROR",
            "Start with: cd repos/metabob-rpc-api && poetry run uvicorn server.main:app --reload",
        )
        return False
    return False
    return False


async def ensure_test_template():
    """Ensure test template exists in backend"""
    template_id = "test-hello-world"

    try:
        async with httpx.AsyncClient() as client:
            # Check if template exists
            response = await client.get(
                f"http://localhost:8080/v2/activities/templates"
            )
            if response.status_code == 200:
                data = response.json()
                templates = data.get("templates", [])

                for template in templates:
                    if template.get("activity_id") == template_id:
                        variant_id = template.get("variant_id")
                        log("INFO", f"✓ Test template exists: {variant_id}")
                        return variant_id

                # Template doesn't exist, create it
                log("WARN", f"Test template not found, creating: {template_id}")

                template_data = {
                    "activity_id": template_id,
                    "name": template_id,  # Backend uses 'name' to generate template_id
                    "variant_name": "Test Hello World",
                    "description": "Simple test activity for data flow validation",
                    "category": "testing",
                    "task_steps": [
                        {
                            "id": "task-1",
                            "subagent": "general",
                            "description": "Echo test message",
                            "dependencies": [],
                            "prompt": {
                                "template": "Echo: {{message}}",
                                "max_tokens": 1000,
                                "compression_strategy": "filter",
                                "variables": [
                                    {
                                        "name": "message",
                                        "type": "string",
                                        "required": True,
                                        "description": "Message to echo",
                                    }
                                ],
                            },
                            "validation": {"type": "none"},
                            "retry": {"max_attempts": 1, "strategy": "simple"},
                        }
                    ],
                    "integration": {
                        "pre_checks": [],
                        "post_checks": [],
                        "quality_gates": [],
                    },
                    "metabob": {
                        "enabled": False,
                        "learning_mode": False,
                        "target_context_tokens": 2000,
                        "annotation_strategy": "none",
                    },
                }

                response = await client.post(
                    "http://localhost:8080/v2/activities/templates",
                    json=template_data,
                    timeout=10.0,
                )

                if response.status_code in [200, 201]:
                    result = response.json()
                    variant_id = result.get("variant_id")
                    log("INFO", f"✓ Created test template: {variant_id}")
                    return variant_id
                else:
                    log("ERROR", f"✗ Failed to create template: {response.status_code}")
                    log("ERROR", response.text)
                    return None
    except Exception as e:
        log("ERROR", f"✗ Error ensuring test template: {e}")
        return None


async def test_activity_execution_flow():
    """
    Test activity execution through production code path:
    1. MCP ActivityManager.start_execution() → Backend POST /v2/activities/record/start
    2. MCP ActivityManager.get_next_step() → Backend GET /v2/activities/templates/{id}
    3. MCP ActivityManager.report_step_result() → Backend POST /v2/activities/executions/{id}/tasks
    4. MCP ActivityManager checks completion → Backend POST /v2/activities/executions
    """

    log("INFO", "=" * 60)
    log("INFO", "Live Data Flow Test - Production Code Path")
    log("INFO", "=" * 60)

    # Step 1: Verify backend
    if not await verify_backend_running():
        return False

    # Step 2: Ensure test template exists
    variant_id = await ensure_test_template()
    if not variant_id:
        return False

    # Step 3: Execute activity via production MCP code
    log("INFO", "Step 3: Executing activity via production MCP ActivityManager...")

    # Import production code
    sys.path.insert(0, "repos/metabob-cli/src")
    try:
        from metabob_cli.mcp.activity_manager import ActivityManager
    except ImportError as e:
        log("ERROR", f"✗ Failed to import MCP code: {e}")
        log("ERROR", "Make sure repos/metabob-cli is properly set up")
        return False

    trace_id = str(uuid.uuid4())[:8]
    session_id = f"test_session_{trace_id}"

    log("INFO", f"Trace ID: {trace_id}")
    log("INFO", f"Session ID: {session_id}")

    # Initialize ActivityManager (production code)
    base_url = "http://localhost:8080"
    session_token = ""  # Empty for local testing
    manager = ActivityManager(base_url=base_url, session_token=session_token)

    # 3a. Start execution (calls backend /v2/activities/record/start)
    log(
        "INFO",
        "  3a. Starting execution (MCP → Backend POST /v2/activities/record/start)...",
    )
    log("INFO", f"  Using variant_id: {variant_id}")
    start_result = await manager.start_execution(
        activity_id="test-hello-world",
        session_id=session_id,
        variables={"message": f"Live test {trace_id}"},
        cost_budget=1.0,
        variant_id=variant_id,  # Pass the actual variant_id we got from template creation
    )

    execution_id = start_result.get("execution_id")
    if not execution_id:
        log("ERROR", f"✗ Failed to start execution: {start_result}")
        return False

    log("INFO", f"  ✓ Execution started: {execution_id}")

    # 3b. Get next step (calls backend GET /v2/activities/templates/{id})
    log(
        "INFO",
        "  3b. Getting next step (MCP → Backend GET /v2/activities/templates/...)...",
    )
    step_result = await manager.get_next_step(execution_id)

    if step_result.get("error"):
        log("ERROR", f"  ✗ Failed to get next step: {step_result}")
        return False

    current_step = step_result.get("current_step", {})
    step_id = current_step.get("id", "unknown")
    log("INFO", f"  ✓ Got step: {step_id}")

    # 3c. Report step completion (calls backend POST /v2/activities/executions/{id}/tasks)
    log(
        "INFO",
        "  3c. Reporting step result (MCP → Backend POST /v2/activities/executions/{id}/tasks)...",
    )

    report_result = await manager.report_step_result(
        execution_id=execution_id,
        step_id=step_id,
        success=True,
        output=f"Test output for {trace_id}",
        cost=0.001,
        tokens=100,
    )

    if report_result.get("error"):
        log("ERROR", f"  ✗ Failed to report step result: {report_result}")
        return False

    log("INFO", f"  ✓ Step result reported")

    # 3d. Check completion (calls backend POST /v2/activities/executions)
    log(
        "INFO",
        "  3d. Checking completion (MCP → Backend POST /v2/activities/executions)...",
    )
    completion_result = await manager.get_next_step(execution_id)

    if completion_result.get("complete"):
        log("INFO", f"  ✓ Activity completed successfully")
    elif completion_result.get("failed"):
        log("WARN", f"  ⚠ Activity failed: {completion_result.get('message')}")
    else:
        log("INFO", f"  ⚠ Activity still in progress: {completion_result}")

    # Step 4: Verify data in backend
    log("INFO", "Step 4: Verifying data reached backend...")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://localhost:8080/v2/activities/templates/test-hello-world/stats",
            timeout=5.0,
        )

        if response.status_code == 200:
            stats = response.json()
            total_execs = stats.get("total_executions", 0)
            success_rate = stats.get("success_rate", 0)

            log("INFO", f"  Backend stats retrieved:")
            log("INFO", f"    Total executions: {total_execs}")
            log("INFO", f"    Success rate: {success_rate:.2%}")

            if total_execs > 0:
                log("INFO", "✓ DATA SUCCESSFULLY FLOWED THROUGH PRODUCTION CODE!")
                log("INFO", "  OpenCode → MCP → Backend API → Database ✓")
                return True
            else:
                log("ERROR", "✗ No executions recorded in backend")
                return False
        else:
            log("ERROR", f"✗ Failed to get backend stats: {response.status_code}")
            return False


async def main():
    """Run the live data flow test"""
    try:
        success = await test_activity_execution_flow()

        print()
        log("INFO", "=" * 60)
        if success:
            log("INFO", "LIVE DATA FLOW TEST: PASSED ✓")
            log("INFO", "Production code path validated: MCP → Backend → Database")
        else:
            log("ERROR", "LIVE DATA FLOW TEST: FAILED ✗")
        log("INFO", "=" * 60)

        sys.exit(0 if success else 1)
    except Exception as e:
        log("ERROR", f"Test failed with exception: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
