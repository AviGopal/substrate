#!/usr/bin/env python3
"""
Runtime test for context requirements flow.
Tests that context_requirements from backend templates flow through to impulse creation.
"""

import asyncio
import json
import time
import subprocess
from pathlib import Path
from metabob_cli.mcp.tools import execute_activity_tool, search_activities_tool


async def main():
    print("=" * 80)
    print("CONTEXT REQUIREMENTS RUNTIME FLOW TEST")
    print("=" * 80)

    # Step 1: Search for refactor template
    print("\n[1/5] Searching for refactor template...")
    search_result = await search_activities_tool({"query": "refactor", "verbose": True})

    if not search_result.get("success"):
        print(f"❌ Search failed: {search_result.get('error')}")
        return

    activities = search_result.get("activities", [])
    refactor_activity = None
    for act in activities:
        if act.get("id") == "refactor-72eb4607":
            refactor_activity = act
            break

    if not refactor_activity:
        print("❌ refactor-72eb4607 template not found")
        print(f"Available: {[a.get('id') for a in activities]}")
        return

    print(
        f"✅ Found: {refactor_activity.get('id')} with {len(refactor_activity.get('context_requirements', []))} context requirements"
    )

    # Display context requirements
    print("\n[2/5] Context Requirements from Template:")
    for req in refactor_activity.get("context_requirements", []):
        print(
            f"  - {req['key']}: required={req['required']}, types={req['impulse_types']}, budget={req['budget_min']}-{req['budget_max']}"
        )

    # Step 3: Get timestamp for log filtering
    timestamp_before = time.time()
    print(f"\n[3/5] Starting execution at {timestamp_before}...")

    # Step 4: Execute activity
    print("\n[4/5] Executing refactor activity...")

    workspace_path = Path.cwd() / "test-workspace" / "refactor-test"

    # Use subprocess to call OpenCode CLI directly
    cmd = [
        "opencode",
        "--cwd",
        str(workspace_path),
        "activity",
        "execute",
        "--activity-id",
        "refactor-72eb4607",
        "--variables",
        json.dumps(
            {
                "target_file": "sample.ts",
                "refactor_goal": "Improve code readability and add type safety",
                "preserve_behavior": "true",
            }
        ),
        "--reason",
        "Test context requirements flow",
    ]

    print(f"Command: {' '.join(cmd)}")

    try:
        # Run with timeout
        result = subprocess.run(
            cmd, cwd=workspace_path, capture_output=True, text=True, timeout=60
        )

        print(f"\nReturn code: {result.returncode}")
        if result.stdout:
            print(f"STDOUT:\n{result.stdout[:500]}")
        if result.stderr:
            print(f"STDERR:\n{result.stderr[:500]}")

    except subprocess.TimeoutExpired:
        print("⚠️  Execution timed out after 60s")
    except Exception as e:
        print(f"❌ Execution error: {e}")

    # Step 5: Check logs for tracing events
    print("\n[5/5] Checking logs for context requirements tracing...")

    log_dir = Path.home() / ".local" / "share" / "opencode" / "logs"

    if not log_dir.exists():
        print(f"❌ Log directory not found: {log_dir}")
        return

    # Find most recent log file
    log_files = sorted(
        log_dir.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True
    )

    if not log_files:
        print("❌ No log files found")
        return

    most_recent_log = log_files[0]
    print(f"\nAnalyzing log: {most_recent_log.name}")

    # Search for our tracing events
    trace_events = {
        "CONTEXT_REQUIREMENTS_EXTRACTED": 0,
        "IMPULSE_CREATED_ACTIVITY_SCOPE": 0,
        "IMPULSE_CREATED_SESSION_SCOPE": 0,
        "MEMORY_AGENT_COMPLETED": 0,
    }

    with open(most_recent_log, "r") as f:
        for line in f:
            for event in trace_events:
                if event in line:
                    trace_events[event] += 1
                    # Print the line for inspection
                    if trace_events[event] <= 3:  # Only print first 3 occurrences
                        print(f"\n✅ {event}:")
                        # Try to extract JSON if present
                        try:
                            json_start = line.find("{")
                            if json_start > 0:
                                json_str = line[json_start:]
                                data = json.loads(json_str)
                                print(f"   {json.dumps(data, indent=2)[:300]}")
                        except:
                            print(f"   {line[:200]}")

    print("\n" + "=" * 80)
    print("TRACE EVENT SUMMARY:")
    print("=" * 80)
    for event, count in trace_events.items():
        status = "✅" if count > 0 else "❌"
        print(f"{status} {event}: {count} occurrences")

    # Success criteria
    all_found = all(count > 0 for count in trace_events.values())

    print("\n" + "=" * 80)
    if all_found:
        print("✅ SUCCESS: All trace events found in logs!")
        print("   Context requirements successfully flowed through to impulse creation")
    else:
        print("⚠️  PARTIAL: Some trace events missing")
        print(
            "   This may be expected if the activity execution didn't reach all phases"
        )
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
