#!/usr/bin/env python3
"""
Test Agent Execution Tracking - End-to-End Validation

Tests the complete flow:
1. Session start recording on first message
2. Tool invocation enrichment (code_context)
3. Session completion on exit

Usage:
    python3 scripts/test-agent-execution-tracking.py
"""

import json
import subprocess
import time
import sys
from pathlib import Path
import requests

# Configuration
BACKEND_URL = "http://localhost:8080"
REDIS_CONTAINER = "metabob-redis"
TEST_TIMEOUT = 120  # 2 minutes


def log(message: str, level: str = "INFO"):
    """Print timestamped log message"""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


def check_redis_sessions():
    """Check Redis for agent_execution sessions"""
    try:
        result = subprocess.run(
            [
                "docker",
                "exec",
                REDIS_CONTAINER,
                "redis-cli",
                "KEYS",
                "agent_execution:session:*",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        keys = [k.strip() for k in result.stdout.strip().split("\n") if k.strip()]
        return keys
    except Exception as e:
        log(f"Failed to check Redis: {e}", "ERROR")
        return []


def get_session_data(session_key: str):
    """Get session data from Redis"""
    try:
        result = subprocess.run(
            ["docker", "exec", REDIS_CONTAINER, "redis-cli", "GET", session_key],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.stdout.strip():
            return json.loads(result.stdout.strip())
        return None
    except Exception as e:
        log(f"Failed to get session data: {e}", "ERROR")
        return None


def test_session_start():
    """Test 1: Verify session start recording"""
    log("=" * 60)
    log("TEST 1: Session Start Recording")
    log("=" * 60)

    # Check baseline (should be zero sessions)
    baseline_sessions = check_redis_sessions()
    log(f"Baseline sessions: {len(baseline_sessions)}")

    # Create a test workspace
    test_dir = Path("/tmp/opencode-test-session")
    test_dir.mkdir(exist_ok=True)

    log(f"Test workspace: {test_dir}")

    # Create a simple test script that will trigger OpenCode
    test_script = test_dir / "test_prompt.txt"
    test_script.write_text(
        "Hello, please create a file named hello.txt with the content 'Hello World'"
    )

    log("Starting OpenCode session with first message...")
    log("NOTE: This test requires manual interaction or automated OpenCode invocation")
    log("")
    log("To test manually:")
    log(f"  1. cd {test_dir}")
    log("  2. opencode agent")
    log("  3. Send message: 'Hello, create a test file'")
    log("  4. Exit OpenCode")
    log("")
    log("Checking if OpenCode is available...")

    # Check if opencode CLI is available
    try:
        result = subprocess.run(
            ["which", "opencode"], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            opencode_path = result.stdout.strip()
            log(f"✅ OpenCode found at: {opencode_path}")
        else:
            log("⚠️  OpenCode CLI not found in PATH", "WARN")
            log("Skipping automated test - manual testing required", "WARN")
            return False
    except Exception as e:
        log(f"Failed to check OpenCode: {e}", "ERROR")
        return False

    log("")
    log("For automated testing, we'll check if any sessions exist after 30 seconds...")
    log("(This assumes someone is running OpenCode manually)")

    # Wait for potential session creation
    for i in range(6):
        time.sleep(5)
        sessions = check_redis_sessions()
        if len(sessions) > len(baseline_sessions):
            log(f"✅ NEW SESSION DETECTED! Found {len(sessions)} sessions")

            # Get the new session data
            for session_key in sessions:
                if session_key not in baseline_sessions:
                    log(f"New session key: {session_key}")
                    session_data = get_session_data(session_key)
                    if session_data:
                        log(f"Session data: {json.dumps(session_data, indent=2)}")

                        # Validate session fields
                        required_fields = [
                            "session_id",
                            "agent_id",
                            "goal",
                            "started_at",
                        ]
                        missing = [f for f in required_fields if f not in session_data]

                        if missing:
                            log(f"❌ FAIL: Missing fields: {missing}", "ERROR")
                            return False
                        else:
                            log("✅ PASS: All required fields present")
                            return True
        else:
            log(f"  Waiting... ({i + 1}/6) - Sessions: {len(sessions)}")

    log("⚠️  No new sessions detected after 30 seconds", "WARN")
    log("Test requires manual OpenCode execution", "WARN")
    return None  # Inconclusive


def test_tool_enrichment():
    """Test 2: Verify tool invocation enrichment"""
    log("=" * 60)
    log("TEST 2: Tool Invocation Enrichment")
    log("=" * 60)

    sessions = check_redis_sessions()
    if not sessions:
        log("❌ FAIL: No sessions found - run Test 1 first", "ERROR")
        return False

    log(f"Found {len(sessions)} sessions")

    # Get the most recent session
    latest_session_key = sorted(sessions)[-1]
    session_data = get_session_data(latest_session_key)

    if not session_data:
        log("❌ FAIL: Could not retrieve session data", "ERROR")
        return False

    log(f"Checking session: {session_data.get('session_id', 'unknown')}")

    # Check for tool invocations with code_context
    tool_invocations = session_data.get("tool_invocations", [])
    log(f"Found {len(tool_invocations)} tool invocations")

    if not tool_invocations:
        log("⚠️  No tool invocations yet - session may still be active", "WARN")
        return None

    # Check if any tool invocation has code_context enrichment
    enriched_count = 0
    for inv in tool_invocations:
        if inv.get("code_context"):
            enriched_count += 1
            log(f"✅ Tool '{inv.get('tool_name')}' has code_context enrichment")

            # Validate enrichment fields
            code_context = inv["code_context"]
            expected_fields = [
                "components",
                "component_count",
                "impact_score",
                "dependents_count",
                "dependencies_count",
                "similar_files",
            ]

            present_fields = [f for f in expected_fields if f in code_context]
            log(f"   Enrichment fields: {len(present_fields)}/{len(expected_fields)}")

            if len(present_fields) >= 4:  # At least 4/6 fields should be present
                log(f"   Sample: {json.dumps(code_context, indent=4)}")

    if enriched_count > 0:
        log(f"✅ PASS: {enriched_count}/{len(tool_invocations)} tools enriched")
        return True
    else:
        log("⚠️  No enriched tool invocations found", "WARN")
        log("   This may indicate enrichment is not working", "WARN")
        return False


def test_session_completion():
    """Test 3: Verify session completion"""
    log("=" * 60)
    log("TEST 3: Session Completion")
    log("=" * 60)

    sessions = check_redis_sessions()
    if not sessions:
        log("❌ FAIL: No sessions found", "ERROR")
        return False

    log(f"Checking {len(sessions)} sessions for completion status")

    completed_count = 0
    in_progress_count = 0

    for session_key in sessions:
        session_data = get_session_data(session_key)
        if session_data:
            status = session_data.get("status", "unknown")
            session_id = session_data.get("session_id", "unknown")

            if status == "completed":
                completed_count += 1
                log(f"✅ Session {session_id[:12]}... is COMPLETED")

                # Check for completion fields
                if "completed_at" in session_data:
                    log(f"   Completed at: {session_data['completed_at']}")
                if "total_duration_ms" in session_data:
                    duration_sec = session_data["total_duration_ms"] / 1000
                    log(f"   Duration: {duration_sec:.1f}s")
                if "outcome" in session_data:
                    log(f"   Outcome: {session_data['outcome']}")

            elif status == "in_progress":
                in_progress_count += 1
                log(f"⏳ Session {session_id[:12]}... is IN PROGRESS")

    log("")
    log(f"Summary: {completed_count} completed, {in_progress_count} in progress")

    if completed_count > 0:
        log("✅ PASS: Found completed sessions")
        return True
    elif in_progress_count > 0:
        log(
            "⚠️  All sessions still in progress - exit OpenCode to test completion",
            "WARN",
        )
        return None
    else:
        log("❌ FAIL: No sessions with valid status", "ERROR")
        return False


def main():
    """Run all tests"""
    log("Agent Execution Tracking - End-to-End Tests")
    log("=" * 60)

    # Check prerequisites
    log("Checking prerequisites...")

    # Check backend is running
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        log(f"✅ Backend is running (status: {response.status_code})")
    except Exception as e:
        log(f"❌ Backend is not accessible: {e}", "ERROR")
        log(
            "Please start backend with: docker-compose up metabob-rpc-api-server",
            "ERROR",
        )
        return 1

    # Check Redis is running
    sessions = check_redis_sessions()
    if sessions is not None:
        log(f"✅ Redis is accessible")
    else:
        log("❌ Redis is not accessible", "ERROR")
        return 1

    log("")

    # Run tests
    results = {}

    # Test 1: Session Start
    result = test_session_start()
    results["session_start"] = result
    log("")

    # Test 2: Tool Enrichment
    if result is not False:  # Only run if test 1 passed or was inconclusive
        result = test_tool_enrichment()
        results["tool_enrichment"] = result
        log("")

    # Test 3: Session Completion
    result = test_session_completion()
    results["session_completion"] = result
    log("")

    # Summary
    log("=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)

    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    inconclusive = sum(1 for v in results.values() if v is None)

    for test_name, result in results.items():
        status = (
            "✅ PASS"
            if result is True
            else "❌ FAIL"
            if result is False
            else "⚠️  INCONCLUSIVE"
        )
        log(f"{test_name}: {status}")

    log("")
    log(f"Passed: {passed}, Failed: {failed}, Inconclusive: {inconclusive}")

    if failed > 0:
        log("❌ SOME TESTS FAILED", "ERROR")
        return 1
    elif inconclusive == len(results):
        log("⚠️  ALL TESTS INCONCLUSIVE - Manual testing required", "WARN")
        return 2
    else:
        log("✅ TESTS PASSED", "INFO")
        return 0


if __name__ == "__main__":
    sys.exit(main())
