#!/usr/bin/env python3
"""
Test script to validate context requirements tracing infrastructure.
This simulates what the memory agent would do, bypassing the API call.
"""

import json
import datetime
from pathlib import Path

# Test trace directory
trace_dir = Path("/tmp/.context-flow-trace")
trace_dir.mkdir(parents=True, exist_ok=True)


def test_context_requirements_extraction():
    """Simulate context requirements extraction trace"""
    timestamp = datetime.datetime.now().isoformat()
    trace_data = {
        "event": "CONTEXT_REQUIREMENTS_EXTRACTED",
        "timestamp": timestamp,
        "cwd": "/home/avi/documents/work/exp-repo/metabob-devbob",
        "sessionID": "test_session_001",
        "templateId": "refactor-72eb4607",
        "count": 3,
        "requirements": [
            {
                "key": "target-code",
                "required": True,
                "types": ["file", "directory"],
                "budgetMin": 2000,
                "budgetMax": 8000,
            },
            {
                "key": "usage-patterns",
                "required": False,
                "types": ["bashOutput", "memo"],
                "budgetMin": 1000,
                "budgetMax": 5000,
            },
            {
                "key": "test-coverage",
                "required": False,
                "types": ["file", "bashOutput"],
                "budgetMin": 1000,
                "budgetMax": 3000,
            },
        ],
    }

    filename = trace_dir / f"context-requirements-{timestamp.replace(':', '-')}.json"
    with open(filename, "w") as f:
        json.dump(trace_data, f, indent=2)

    print(f"✅ Created: {filename}")
    return filename


def test_memory_agent_completion():
    """Simulate memory agent completion trace"""
    timestamp = datetime.datetime.now().isoformat()
    trace_data = {
        "event": "MEMORY_AGENT_COMPLETED",
        "timestamp": timestamp,
        "cwd": "/home/avi/documents/work/exp-repo/metabob-devbob",
        "sessionID": "test_session_001",
        "duration": 2500,
        "impulsesCreated": 3,
        "breakdown": [
            {
                "id": "target-code-refactor",
                "type": "file",
                "budgetUsed": 3500,
                "budgetAllocated": 5000,
            },
            {
                "id": "usage-patterns-search",
                "type": "bashOutput",
                "budgetUsed": 800,
                "budgetAllocated": 2000,
            },
            {
                "id": "test-coverage-check",
                "type": "file",
                "budgetUsed": 1200,
                "budgetAllocated": 2000,
            },
        ],
    }

    filename = trace_dir / f"memory-agent-complete-{timestamp.replace(':', '-')}.json"
    with open(filename, "w") as f:
        json.dump(trace_data, f, indent=2)

    print(f"✅ Created: {filename}")
    return filename


def test_impulse_creation_activity():
    """Simulate activity-scoped impulse creation"""
    timestamp = datetime.datetime.now().isoformat()
    trace_data = {
        "event": "IMPULSE_CREATED_ACTIVITY_SCOPE",
        "timestamp": timestamp,
        "cwd": "/home/avi/documents/work/exp-repo/metabob-devbob",
        "sessionID": "test_session_001",
        "id": "target-code-refactor",
        "pointerType": "file",
        "budget": 5000,
        "priority": "required",
        "activityId": "act_test_001",
    }

    filename = trace_dir / f"impulse-created-{timestamp.replace(':', '-')}-1.json"
    with open(filename, "w") as f:
        json.dump(trace_data, f, indent=2)

    print(f"✅ Created: {filename}")
    return filename


def test_impulse_creation_session():
    """Simulate session-scoped impulse creation"""
    timestamp = datetime.datetime.now().isoformat()
    trace_data = {
        "event": "IMPULSE_CREATED_SESSION_SCOPE",
        "timestamp": timestamp,
        "cwd": "/home/avi/documents/work/exp-repo/metabob-devbob",
        "sessionID": "test_session_001",
        "id": "session-context-global",
        "pointerType": "memo",
        "budget": 1000,
        "priority": "optional",
        "targetSession": "ses_test_parent_001",
    }

    filename = trace_dir / f"impulse-created-{timestamp.replace(':', '-')}-2.json"
    with open(filename, "w") as f:
        json.dump(trace_data, f, indent=2)

    print(f"✅ Created: {filename}")
    return filename


def validate_traces():
    """Validate all traces were created correctly"""
    files = list(trace_dir.glob("*.json"))

    print(f"\n📊 Validation Results:")
    print(f"   Trace directory: {trace_dir}")
    print(f"   Files found: {len(files)}")

    for f in sorted(files):
        size = f.stat().st_size
        try:
            with open(f, "r") as fp:
                data = json.load(fp)
                event = data.get("event", "UNKNOWN")
                print(f"   ✅ {f.name} ({size} bytes) - {event}")
        except Exception as e:
            print(f"   ❌ {f.name} - ERROR: {e}")

    return len(files)


if __name__ == "__main__":
    print("🧪 Testing Context Requirements Tracing Infrastructure\n")

    # Run all tests
    test_context_requirements_extraction()
    test_memory_agent_completion()
    test_impulse_creation_activity()
    test_impulse_creation_session()

    # Validate
    count = validate_traces()

    print(f"\n✅ Infrastructure Test Complete: {count} trace files created")
    print(f"\n💡 Next: Verify OpenCode can write similar files during actual execution")
