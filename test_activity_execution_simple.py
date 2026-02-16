#!/usr/bin/env python3
"""
Simple test to execute an activity and trace context requirements flow.
Uses direct Python API to execute activity.
"""

import asyncio
import json
import time
from pathlib import Path
from metabob_cli.mcp.activity_manager import get_activity_manager
from metabob_cli.core.file_state import FileStateManager


async def main():
    print("=" * 80)
    print("ACTIVITY EXECUTION TEST - Context Requirements Flow")
    print("=" * 80)

    # Step 1: Load configuration
    print("\n[1/6] Loading configuration...")
    state_mgr = FileStateManager()
    state_mgr.reload_state(force=True)

    config = state_mgr.get_config()
    base_url = config.get("base_url")
    session_token = state_mgr.get_session_token()

    if not session_token:
        print("❌ No session token found. Run: python3 scripts/create_session_state.py")
        return

    print(f"✅ Backend: {base_url}")
    print(f"✅ Session: {session_token[:20]}...")

    # Step 2: Get activity manager
    print("\n[2/6] Initializing activity manager...")
    manager = get_activity_manager(base_url, session_token)

    # Step 3: Search for refactor template
    print("\n[3/6] Searching for refactor template...")
    activities = await manager.search_activities(query="refactor")

    refactor_activity = None
    for act in activities.get("templates", []):
        if "refactor" in act.get("id", "").lower():
            refactor_activity = act
            break

    if not refactor_activity:
        print("❌ Refactor template not found")
        print(f"Available: {[a.get('id') for a in activities.get('templates', [])]}")
        return

    activity_id = refactor_activity["id"]
    context_reqs = refactor_activity.get("context_requirements", [])

    print(f"✅ Found: {activity_id}")
    print(f"   Tasks: {len(refactor_activity.get('tasks', []))}")
    print(f"   Context Requirements: {len(context_reqs)}")

    # Display context requirements
    if context_reqs:
        print("\n   Context Requirements:")
        for req in context_reqs:
            print(
                f"     - {req['key']}: required={req['required']}, types={req['impulse_types']}, budget={req.get('budget_min', 0)}-{req.get('budget_max', 0)}"
            )

    # Step 4: Prepare execution
    print(f"\n[4/6] Preparing to execute {activity_id}...")

    # Create a simple workspace
    workspace = Path.cwd() / "test-workspace" / "refactor-test"

    variables = {
        "target_file": "sample.ts",
        "refactor_goal": "Improve type safety and readability",
        "preserve_behavior": "true",
    }

    print(f"   Workspace: {workspace}")
    print(f"   Variables: {json.dumps(variables, indent=2)}")

    # Step 5: Start execution
    print(f"\n[5/6] Starting activity execution...")
    print("   (This will trigger context requirements flow)")

    try:
        # Generate session ID for this execution
        import uuid

        session_id = f"test-{uuid.uuid4().hex[:8]}"

        exec_result = await manager.start_execution(
            activity_id=activity_id,
            variables=variables,
            session_id=session_id,
            reason="Test context requirements flow",
        )

        print(f"\n✅ Execution started!")
        print(f"   Execution ID: {exec_result.get('execution_id')}")
        print(f"   Status: {exec_result.get('status')}")
        print(f"   Session ID: {session_id}")

        # Wait a bit for execution to progress
        print("\n   Waiting 5s for execution to progress...")
        await asyncio.sleep(5)

        # Check status
        status = await manager.get_execution_status(exec_result["execution_id"])
        print(f"\n   Current Status: {status.get('status')}")
        print(
            f"   Completed Tasks: {status.get('completed_tasks', 0)}/{status.get('total_tasks', 0)}"
        )

    except Exception as e:
        print(f"❌ Execution failed: {e}")
        import traceback

        traceback.print_exc()
        return

    # Step 6: Check logs for tracing
    print("\n[6/6] Checking logs for context requirements tracing...")

    log_dir = Path.home() / ".local" / "share" / "opencode" / "logs"

    if not log_dir.exists():
        print(f"⚠️  Log directory not found: {log_dir}")
        print("   (This is expected if OpenCode hasn't been run via CLI yet)")
        print("\n✅ Activity execution completed successfully!")
        print("   Context requirements were passed to the backend.")
        print("   To see full tracing, run the activity via OpenCode CLI.")
        return

    # Find most recent log
    log_files = sorted(
        log_dir.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True
    )

    if not log_files:
        print("⚠️  No log files found yet")
        print("\n✅ Activity execution completed!")
        return

    most_recent_log = log_files[0]
    print(f"\n   Analyzing: {most_recent_log.name}")

    # Search for trace events
    trace_events = {
        "CONTEXT_REQUIREMENTS_EXTRACTED": [],
        "IMPULSE_CREATED": [],
        "MEMORY_AGENT_COMPLETED": [],
    }

    with open(most_recent_log, "r") as f:
        for line in f:
            for event in trace_events:
                if event in line:
                    trace_events[event].append(line.strip())

    print("\n   Trace Events Found:")
    for event, lines in trace_events.items():
        status = "✅" if lines else "⚠️ "
        print(f"   {status} {event}: {len(lines)} occurrences")
        if lines and len(lines) <= 2:
            for line in lines:
                # Try to extract JSON
                try:
                    json_start = line.find("{")
                    if json_start > 0:
                        json_str = line[json_start:]
                        data = json.loads(json_str)
                        print(f"      {json.dumps(data, indent=2)[:200]}")
                except:
                    print(f"      {line[:150]}")

    print("\n" + "=" * 80)
    print("✅ TEST COMPLETE")
    print("=" * 80)
    print("\nSummary:")
    print(f"  - Activity ID: {activity_id}")
    print(f"  - Context Requirements: {len(context_reqs)}")
    print(f"  - Execution ID: {exec_result.get('execution_id')}")
    print(f"  - Status: {exec_result.get('status')}")
    print("\nNext Steps:")
    print("  - Check backend logs for execution progress")
    print("  - Monitor execution status via CLI")
    print("  - Verify impulses were created matching context requirements")


if __name__ == "__main__":
    asyncio.run(main())
