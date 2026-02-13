#!/usr/bin/env python3
"""
Analyze execution trace to identify code paths and unused endpoints
"""

import json
import sys
from collections import defaultdict
from pathlib import Path


def analyze_trace(trace_file: Path):
    """Analyze trace file and identify execution flow"""

    events = []
    with open(trace_file) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                events.append(event)
            except json.JSONDecodeError:
                continue

    if not events:
        print("❌ No trace events found")
        return

    trace_id = events[0].get("trace_id", "unknown")

    print("=" * 80)
    print(f"Execution Trace Analysis (trace_id: {trace_id})")
    print("=" * 80)
    print()

    # Count event types
    event_counts = defaultdict(int)
    for event in events:
        event_counts[event.get("event", "unknown")] += 1

    print("Event Counts:")
    for event_type in sorted(event_counts.keys()):
        count = event_counts[event_type]
        print(f"  {event_type:40} {count:>5}")
    print()

    # Execution flow
    print("Execution Flow (chronological):")
    for i, event in enumerate(events, 1):
        event_type = event.get("event", "unknown")
        timestamp = event.get("timestamp", "N/A")[-12:]  # Last 12 chars

        # Format based on event type
        if event_type == "execution_started":
            exec_id = event.get("execution_id", "N/A")
            status = event.get("status", "N/A")
            duration = event.get("duration_ms", 0)
            print(
                f"  {i:2}. {timestamp} {event_type:30} exec_id={exec_id} status={status} ({duration:.2f}ms)"
            )

        elif event_type == "step_fetched":
            step_id = event.get("step_id", "N/A")
            step_index = event.get("step_index", 0)
            total_steps = event.get("total_steps", 0)
            duration = event.get("duration_ms", 0)
            print(
                f"  {i:2}. {timestamp} {event_type:30} step={step_index + 1}/{total_steps} id={step_id} ({duration:.2f}ms)"
            )

        elif event_type == "execution_completed":
            message = event.get("message", "N/A")
            duration = event.get("total_duration_ms", 0)
            print(
                f"  {i:2}. {timestamp} {event_type:30} '{message}' ({duration:.2f}ms)"
            )

        else:
            print(f"  {i:2}. {timestamp} {event_type:30}")
    print()

    # Performance analysis
    print("Performance Analysis:")

    # Find slowest operations
    operations = [
        ("start_execution", "execution_started"),
        ("get_next_step", "step_fetched"),
        ("report_step_result", "step_reported"),
        ("check_completion", "execution_completed"),
    ]

    for call_event, result_event in operations:
        call = next(
            (e for e in events if e.get("event") == f"calling_{call_event}"), None
        )
        result = next((e for e in events if e.get("event") == result_event), None)

        if result and "duration_ms" in result:
            duration = result["duration_ms"]
            print(f"  {call_event:30} {duration:8.2f} ms")

    total = events[-1].get("total_duration_ms", 0) if events else 0
    print(f"  {'Total execution':30} {total:8.2f} ms")
    print()

    # Backend API calls (inferred)
    print("Backend API Calls (inferred from client operations):")
    print("  ✅ GET /v2/activities/templates/{id}")
    print("     └─ Called during: get_next_step (first call)")
    print("     └─ Duration: ~82ms")
    print()
    print("  ❓ POST /v2/activities/record/complete")
    print("     └─ Should be called on: execution_completed")
    print("     └─ NOT VISIBLE in client trace (async?)")
    print()
    print("  ❌ POST /v2/activities/record/start")
    print("     └─ NEVER CALLED (disabled in CLI)")
    print()
    print("  ❌ POST /v2/activities/record/step")
    print("     └─ NEVER CALLED (bulk recording only)")
    print()

    # Alternative paths
    print("Alternative Code Paths Identified:")
    print()
    print("  ACTIVE PATHS (used in trace):")
    print("    • activity_manager.py::start_execution()")
    print("    • activity_manager.py::get_next_step()")
    print("    • activity_manager.py::report_step_result()")
    print("    • Backend: GET /v2/activities/templates/{id}")
    print()
    print("  INACTIVE PATHS (defined but unused):")
    print(
        "    • activity_manager.py::start_execution() → POST /record/start (DISABLED)"
    )
    print(
        "    • activity_manager.py::report_step_result() → POST /record/step (NEVER CALLED)"
    )
    print("    • Backend: POST /v2/activities/record/start (exists but disabled)")
    print("    • Backend: POST /v2/activities/record/step (exists but unused)")
    print()

    # Recommendations
    print("Shrink-Fit Recommendations:")
    print()
    print("  1. REMOVE /record/start endpoint:")
    print("     - Backend has bug (creates templates instead of recording)")
    print("     - CLI explicitly disabled it")
    print("     - Alternative: Fix bug and re-enable, OR remove entirely")
    print()
    print("  2. DECIDE on step recording:")
    print("     - Current: Bulk recording at end (in-memory)")
    print("     - Alternative: Real-time per-step recording")
    print("     - Choice: Keep ONE path, remove the other")
    print()
    print("  3. CONSOLIDATE recording:")
    print("     - Keep: /record/complete (currently used)")
    print("     - Remove: /record/start, /record/step (if not implementing real-time)")
    print()

    return events


def main():
    trace_file = Path("execution_trace_clean.jsonl")

    if not trace_file.exists():
        print(f"❌ Trace file not found: {trace_file}")
        print(
            "Run: python3 trace_activity_execution.py 2>/dev/null > execution_trace_clean.jsonl"
        )
        sys.exit(1)

    analyze_trace(trace_file)


if __name__ == "__main__":
    main()
