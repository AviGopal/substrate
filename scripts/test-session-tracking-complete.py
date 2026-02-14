#!/usr/bin/env python3
"""
Complete end-to-end test of agent execution tracking.

Tests the full flow:
1. Backend API accepts session start
2. CLI MCP tool records to backend
3. Session appears in Redis with correct structure
4. Tool invocations are recorded
5. Session completion works
"""

import asyncio
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add CLI to path
cli_path = Path(__file__).parent.parent / "repos" / "metabob-cli" / "src"
sys.path.insert(0, str(cli_path))


def redis_get(key: str) -> dict | None:
    """Get value from Redis."""
    result = subprocess.run(
        ["docker", "exec", "metabob-redis", "redis-cli", "GET", key],
        capture_output=True,
        text=True,
    )
    if result.stdout.strip() and result.stdout.strip() != "(nil)":
        return json.loads(result.stdout.strip())
    return None


def redis_keys(pattern: str) -> list[str]:
    """Get keys matching pattern from Redis."""
    result = subprocess.run(
        ["docker", "exec", "metabob-redis", "redis-cli", "KEYS", pattern],
        capture_output=True,
        text=True,
    )
    keys = [k for k in result.stdout.strip().split("\n") if k]
    return keys


async def test_complete_flow():
    """Test complete agent execution tracking flow."""
    print("=" * 70)
    print("COMPLETE AGENT EXECUTION TRACKING TEST")
    print("=" * 70)

    from metabob_cli.mcp.agent_execution_tools import AgentExecutionTools

    # Create tools instance
    tools = AgentExecutionTools(
        watcher_interface=None, backend_url="http://localhost:8080"
    )

    session_id = f"test-complete-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"

    # Test 1: Session Start
    print("\n" + "=" * 70)
    print("TEST 1: Session Start")
    print("=" * 70)

    start_result = await tools.record_session_start(
        session_id=session_id,
        agent_id="activity-mode",
        goal="Complete end-to-end test of agent execution tracking",
        agent_version="1.0.0",
        context={"test_name": "complete_flow", "automated": True},
        started_at=datetime.now(timezone.utc).isoformat(),
    )

    print(f"✅ Session start result: {json.dumps(start_result, indent=2)}")

    # Verify in Redis
    session_key = f"agent_execution:session:{session_id}"
    session_data = redis_get(session_key)

    if not session_data:
        print(f"❌ FAIL: Session not found in Redis at key {session_key}")
        return False

    print(f"✅ Session found in Redis")
    print(f"   - agent_id: {session_data.get('agent_id')}")
    print(f"   - goal: {session_data.get('goal')}")
    print(f"   - status: {session_data.get('status')}")

    # Test 2: Tool Invocation
    print("\n" + "=" * 70)
    print("TEST 2: Tool Invocation Recording")
    print("=" * 70)

    tool_result = await tools.record_tool_invocation(
        session_id=session_id,
        tool_name="read",
        file_path="/test/example.py",
        args={"filePath": "/test/example.py"},
        success=True,
        duration_ms=150,
        error=None,
    )

    print(f"✅ Tool invocation recorded: {json.dumps(tool_result, indent=2)}")

    # Verify tool invocation in Redis
    session_data = redis_get(session_key)
    if not session_data:
        print(f"❌ FAIL: Session data not found")
        return False

    tool_invocations = session_data.get("tool_invocations", [])

    if len(tool_invocations) != 1:
        print(f"❌ FAIL: Expected 1 tool invocation, got {len(tool_invocations)}")
        return False

    print(f"✅ Tool invocation found in session data:")
    print(f"   - tool: {tool_invocations[0].get('tool_name')}")
    print(f"   - file: {tool_invocations[0].get('file_path')}")
    print(f"   - duration: {tool_invocations[0].get('duration_ms')}ms")

    # Test 3: Session Completion
    print("\n" + "=" * 70)
    print("TEST 3: Session Completion")
    print("=" * 70)

    complete_result = await tools.record_session_complete(
        session_id=session_id,
        total_duration_ms=5000,
        outcome={
            "success": True,
            "goal_achieved": True,
            "tests_passed": True,
            "code_quality_improved": None,
            "error": None,
        },
        summary="All tests passed successfully",
        metadata={"tests_passed": True},
    )

    print(f"✅ Session completion recorded: {json.dumps(complete_result, indent=2)}")

    # Verify completion in Redis
    session_data = redis_get(session_key)

    if not session_data:
        print(f"❌ FAIL: Session data not found after completion")
        return False

    if session_data.get("status") != "completed":
        print(
            f"❌ FAIL: Expected status='completed', got '{session_data.get('status')}'"
        )
        return False

    print(f"✅ Session marked as completed")
    print(f"   - outcome: {session_data.get('outcome')}")
    print(f"   - summary: {session_data.get('summary')}")
    print(f"   - tool_invocations: {len(session_data.get('tool_invocations', []))}")

    # Final Summary
    print("\n" + "=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)

    print(f"\n✅ ALL TESTS PASSED")
    print(f"\nSession Data:")
    print(json.dumps(session_data, indent=2))

    # Cleanup test data
    print(f"\n🧹 Cleaning up test session...")
    subprocess.run(
        ["docker", "exec", "metabob-redis", "redis-cli", "DEL", session_key],
        capture_output=True,
    )

    return True


if __name__ == "__main__":
    try:
        success = asyncio.run(test_complete_flow())
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
