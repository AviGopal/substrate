#!/usr/bin/env python3
"""
Direct Phase 2 End-to-End Test

Tests the Agent Execution Intelligence flow by:
1. Calling the backend API directly (simulating OpenCode)
2. Verifying code_context enrichment in responses
3. Checking Redis storage

This bypasses the MCP layer but tests the critical backend flow.
"""

import json
import requests
import sys
import time
from datetime import datetime

# Configuration
API_BASE = "http://localhost:8080/api"
TEST_SESSION_ID = f"phase2-e2e-test-{int(time.time())}"
TEST_AGENT_ID = "phase2-test-agent"


def test_session_start():
    """Test 1: Start a session"""
    print("\n[Test 1] Starting agent execution session...")

    payload = {
        "session_id": TEST_SESSION_ID,
        "agent_id": TEST_AGENT_ID,
        "agent_version": "2.0-phase2",
        "goal": "Test Phase 2 code intelligence enrichment",
        "started_at": datetime.now().isoformat(),
        "context": {
            "test_type": "phase2_e2e",
            "file_path": "test_code_intelligence.py",
        },
    }

    response = requests.post(
        f"{API_BASE}/agent-execution/session/start",
        json=payload,
        headers={"Content-Type": "application/json"},
    )

    if response.status_code == 200:
        print("✓ Session started successfully")
        print(f"  Session ID: {TEST_SESSION_ID}")
        return True
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  Response: {response.text}")
        return False


def test_tool_invocation_with_file():
    """Test 2: Record tool invocation with file path (should trigger enrichment)"""
    print("\n[Test 2] Recording tool invocation with file path...")

    payload = {
        "session_id": TEST_SESSION_ID,
        "tool_name": "read",
        "args": {"file_path": "test_code_intelligence.py"},
        "file_path": "test_code_intelligence.py",  # Top-level field
        "success": True,
        "duration_ms": 125.5,
        "timestamp": datetime.now().isoformat(),
    }

    response = requests.post(
        f"{API_BASE}/agent-execution/tool/invocation",
        json=payload,
        headers={"Content-Type": "application/json"},
    )

    if response.status_code == 200:
        data = response.json()
        print("✓ Tool invocation recorded")

        # Check if code_context was returned
        if "code_context" in data:
            print("✓ CODE CONTEXT ENRICHMENT DETECTED!")
            print(f"  Components: {data['code_context'].get('components', [])}")
            print(f"  Impact Score: {data['code_context'].get('impact_score', 'N/A')}")
            print(f"  Dependents: {data['code_context'].get('dependents_count', 0)}")
            print(
                f"  Dependencies: {data['code_context'].get('dependencies_count', 0)}"
            )
            print(
                f"  Similar Files: {len(data['code_context'].get('similar_files', []))}"
            )
            return True
        else:
            print("⚠  No code_context in response (enrichment may be async)")
            return False
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  Response: {response.text}")
        return False


def test_redis_verification():
    """Test 3: Verify data in Redis"""
    print("\n[Test 3] Verifying Redis storage...")

    import subprocess

    # Get session data from Redis
    cmd = [
        "docker",
        "exec",
        "metabob-redis",
        "redis-cli",
        "GET",
        f"agent_execution:session:{TEST_SESSION_ID}",
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)

        if result.stdout.strip() == "(nil)":
            print("✗ Session not found in Redis")
            return False

        data = json.loads(result.stdout)
        print("✓ Session found in Redis")
        print(f"  Session ID: {data.get('session_id')}")
        print(f"  Agent ID: {data.get('agent_id')}")
        print(f"  Tool Invocations: {len(data.get('tool_invocations', []))}")

        # Check for code_context in tool invocations
        has_code_context = False
        for invocation in data.get("tool_invocations", []):
            if "code_context" in invocation:
                has_code_context = True
                print("\n✓ CODE CONTEXT FOUND IN REDIS!")
                print(f"  File: {invocation.get('file_path', 'N/A')}")
                ctx = invocation["code_context"]
                print(f"  Components: {ctx.get('components', [])}")
                print(f"  Impact Score: {ctx.get('impact_score', 'N/A')}")
                print(f"  Dependents: {ctx.get('dependents_count', 0)}")
                break

        if not has_code_context:
            print("\n⚠  No code_context in tool invocations")
            print("   This is expected if CLI enrichment is not available")

        return has_code_context

    except subprocess.CalledProcessError as e:
        print(f"✗ Redis query failed: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"✗ Invalid JSON from Redis: {e}")
        print(f"   Raw output: {result.stdout[:200]}")
        return False


def test_session_complete():
    """Test 4: Complete the session"""
    print("\n[Test 4] Completing session...")

    payload = {
        "session_id": TEST_SESSION_ID,
        "completed_at": datetime.now().isoformat(),
        "total_duration_ms": 5000.0,
        "outcome": {
            "success": True,
            "goal_achieved": True,
            "tests_passed": True,
            "code_quality_improved": True,
        },
        "reflection": {
            "what_worked": "Phase 2 code intelligence enrichment",
            "what_didnt_work": "Nothing",
            "improvements_suggested": "None - working as expected",
        },
    }

    response = requests.post(
        f"{API_BASE}/agent-execution/session/complete",
        json=payload,
        headers={"Content-Type": "application/json"},
    )

    if response.status_code == 200:
        print("✓ Session completed successfully")
        return True
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  Response: {response.text}")
        return False


def main():
    print("=" * 70)
    print("Phase 2 End-to-End Test: Code Intelligence Enrichment")
    print("=" * 70)

    # Run tests
    results = []

    results.append(("Session Start", test_session_start()))
    results.append(("Tool Invocation", test_tool_invocation_with_file()))

    # Wait a moment for async processing
    print("\n⏳ Waiting 2 seconds for async processing...")
    time.sleep(2)

    results.append(("Redis Verification", test_redis_verification()))
    results.append(("Session Complete", test_session_complete()))

    # Summary
    print("\n" + "=" * 70)
    print("Test Summary")
    print("=" * 70)

    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status:8} {name}")

    passed = sum(1 for _, r in results if r)
    total = len(results)

    print(f"\nResults: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 Phase 2 E2E test PASSED!")
        print("   Code intelligence enrichment is working!")
        return 0
    else:
        print("\n⚠️  Some tests failed - see details above")
        print("   Note: code_context may be absent if CLI enrichment unavailable")
        print("   This is expected behavior (graceful degradation)")
        return 1


if __name__ == "__main__":
    sys.exit(main())
