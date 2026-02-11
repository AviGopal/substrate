#!/usr/bin/env python3
"""
Test V2 activity execution by directly using the activity_manager from metabob-cli.

This bypasses OpenCode's activity tool to test if the MCP layer works correctly.
"""

import asyncio
import sys

sys.path.insert(0, "./repos/metabob-cli/src")

from metabob_cli.mcp.activity_manager import ActivityManager


async def test_execution():
    """Test activity execution end-to-end"""

    # Initialize activity manager
    base_url = "http://localhost:8080"
    session_token = ""  # Empty string instead of None

    manager = ActivityManager(base_url=base_url, session_token=session_token)

    print("=" * 80)
    print("V2 Activity Execution Test - Direct MCP")
    print("=" * 80)

    # Step 1: Start execution
    print("\n[1] Starting activity execution...")
    print(f"    activity_id: feature-780ea2ce")
    print(f"    session_id: test-session-direct-mcp")
    print(f"    variables: {{'name': 'DevBob'}}")

    try:
        result = await manager.start_execution(
            activity_id="feature-780ea2ce",
            session_id="test-session-direct-mcp",
            variables={"name": "DevBob"},
            cost_budget=1.0,
        )

        print(f"\n    ✓ Execution started!")
        print(f"    execution_id: {result.get('execution_id')}")
        print(f"    status: {result.get('status')}")
        print(f"    message: {result.get('message')}")

        execution_id = result.get("execution_id")

        # Step 2: Get next step
        print(f"\n[2] Getting first step...")

        step_result = await manager.get_next_step(execution_id)

        if "error" in step_result:
            print(f"    ✗ Error: {step_result['error']}")
            return

        if step_result.get("complete"):
            print(f"    Activity already complete? {step_result}")
            return

        print(f"    ✓ Got step!")
        print(
            f"    step_index: {step_result.get('step_index')}/{step_result.get('total_steps')}"
        )

        current_step = step_result.get("current_step", {})
        print(f"    step_id: {current_step.get('step_id')}")
        print(f"    description: {current_step.get('description')}")
        print(f"    tools: {current_step.get('tools')}")

        # Step 3: Report step result
        print(f"\n[3] Reporting step completion...")

        report_result = await manager.report_step_result(
            execution_id=execution_id,
            step_id=current_step.get("step_id"),
            success=True,
            output="Hello DevBob",
            cost=0.01,
            tokens=100,
        )

        print(f"    ✓ Step reported!")
        print(f"    next_action: {report_result.get('next_action')}")
        if report_result.get("complete"):
            print(f"    ✓ Activity completed successfully!")

        # Step 4: Get execution state
        print(f"\n[4] Getting final execution state...")

        state_result = await manager.get_execution_state(execution_id)

        print(f"    state: {state_result.get('state')}")
        print(
            f"    steps_completed: {state_result.get('steps_completed')}/{state_result.get('total_steps')}"
        )
        print(f"    total_cost: ${state_result.get('total_cost', 0):.4f}")

        print("\n" + "=" * 80)
        print("SUCCESS - V2 Activity Execution Works!")
        print("=" * 80)

    except Exception as e:
        print(f"\n    ✗ Error: {e}")
        import traceback

        traceback.print_exc()
        return


if __name__ == "__main__":
    asyncio.run(test_execution())
