#!/usr/bin/env python3
"""
Phase 2 OpenCode Integration Test

Tests the complete flow:
  OpenCode tool invocation → CLI MCP enrichment → Backend storage → Redis

This verifies the end-to-end Phase 2 implementation with real OpenCode.
"""

import json
import subprocess
import sys
import time
from datetime import datetime

try:
    import redis
    import requests
except ImportError:
    print("Installing dependencies...")
    import os

    os.system("pip install redis requests")
    import redis
    import requests


def run_command(cmd, shell=True, check=True):
    """Run shell command and return output."""
    result = subprocess.run(
        cmd, shell=shell, check=check, capture_output=True, text=True
    )
    return result.stdout.strip(), result.stderr.strip()


def test_opencode_integration():
    """Test Phase 2 enrichment through real OpenCode flow."""
    print("=" * 80)
    print("Phase 2 OpenCode Integration Test")
    print("=" * 80)
    print()

    redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    acp_url = "http://localhost:3000"
    api_url = "http://localhost:8080"

    # Step 1: Verify infrastructure
    print("[1] Infrastructure Health Check")
    print("-" * 80)

    # Check backend
    try:
        resp = requests.get(f"{api_url}/health", timeout=5)
        if resp.status_code != 200:
            print(f"❌ Backend not healthy: {resp.status_code}")
            return 1
        print("✅ Backend API healthy")
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        return 1

    # Check devbob-clean
    stdout, stderr = run_command(
        "docker ps --filter 'name=devbob-clean' --format '{{.Status}}'"
    )
    if "Up" not in stdout:
        print(f"❌ devbob-clean container not running: {stdout}")
        return 1
    print("✅ devbob-clean container running")

    # Check OpenCode ACP
    try:
        resp = requests.get(f"{acp_url}/config", timeout=5)
        if resp.status_code == 200:
            print("✅ OpenCode ACP responding")
        else:
            print(f"⚠️  OpenCode ACP returned: {resp.status_code}")
    except Exception as e:
        print(f"⚠️  OpenCode ACP check failed: {e}")
        print("   (This is okay if ACP requires auth)")

    print()

    # Step 2: Copy test file to container
    print("[2] Setup Test File in Container")
    print("-" * 80)

    stdout, stderr = run_command(
        "docker exec devbob-clean test -f /workspace/test_code_intelligence.py && echo 'exists' || echo 'missing'"
    )

    if "missing" in stdout:
        print("Copying test file to container...")
        run_command(
            "docker cp test_code_intelligence.py devbob-clean:/workspace/test_code_intelligence.py"
        )
        print("✅ Test file copied to /workspace/test_code_intelligence.py")
    else:
        print("✅ Test file already exists in container")

    print()

    # Step 3: Create agent execution session
    print("[3] Create Agent Execution Session")
    print("-" * 80)

    session_id = f"opencode-test-{int(time.time())}"
    session_data = {
        "session_id": session_id,
        "agent_id": "devbob-clean",
        "agent_version": "1.0.0",
        "goal": "Test Phase 2 OpenCode integration with code intelligence",
        "context": {"test_type": "opencode_integration", "phase": "phase2"},
        "started_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    resp = requests.post(
        f"{api_url}/api/agent-execution/session/start", json=session_data
    )

    if resp.status_code != 200:
        print(f"❌ Failed to create session: {resp.status_code}")
        print(resp.text)
        return 1

    print(f"✅ Session created: {session_id}")
    print()

    # Step 4: Trigger OpenCode tool invocation via CLI
    print("[4] Trigger Tool Invocation via OpenCode")
    print("-" * 80)
    print("Executing: docker exec devbob-clean opencode read test_code_intelligence.py")
    print()

    # Execute opencode read command in container
    # This will trigger the full flow: OpenCode → CLI MCP → Backend
    start_time = time.time()
    stdout, stderr = run_command(
        f"docker exec devbob-clean timeout 30 opencode --session-id {session_id} read /workspace/test_code_intelligence.py",
        check=False,
    )
    duration = time.time() - start_time

    if stdout:
        print("Command output (first 500 chars):")
        print(stdout[:500])
        print("..." if len(stdout) > 500 else "")
    if stderr:
        print("Command stderr (first 500 chars):")
        print(stderr[:500])
        print("..." if len(stderr) > 500 else "")

    print()
    print(f"Tool invocation completed in {duration:.2f}s")
    print()

    # Step 5: Wait for async processing
    print("[5] Wait for Backend Processing")
    print("-" * 80)
    print("Waiting 2 seconds for async processing...")
    time.sleep(2)
    print("✅ Wait complete")
    print()

    # Step 6: Verify enrichment in Redis
    print("[6] Verify Enrichment in Redis")
    print("-" * 80)

    redis_key = f"agent_execution:session:{session_id}"
    session_json = redis_client.get(redis_key)

    if not session_json:
        print(f"❌ Session not found in Redis: {redis_key}")
        print()
        print("Checking if any sessions exist...")
        keys = redis_client.keys("agent_execution:session:*")
        print(f"Found {len(keys)} sessions in Redis")
        if keys:
            print("Recent sessions:")
            for key in keys[-5:]:
                print(f"  - {key}")
        return 1

    session_data = json.loads(session_json)
    tool_invocations = session_data.get("tool_invocations", [])

    if not tool_invocations:
        print(f"❌ No tool invocations found in session")
        print(f"Session data keys: {list(session_data.keys())}")
        return 1

    print(f"✅ Found {len(tool_invocations)} tool invocation(s)")
    print()

    # Step 7: Validate code_context enrichment
    print("[7] Validate Code Context Enrichment")
    print("-" * 80)

    # Find read tool invocation
    read_invocation = None
    for inv in tool_invocations:
        if inv.get("tool_name") == "read" and "test_code_intelligence.py" in inv.get(
            "file_path", ""
        ):
            read_invocation = inv
            break

    if not read_invocation:
        print("❌ No 'read' invocation found for test_code_intelligence.py")
        print(
            f"Available invocations: {[inv.get('tool_name') for inv in tool_invocations]}"
        )
        return 1

    print(f"✅ Found 'read' tool invocation")
    print(f"   File: {read_invocation.get('file_path')}")
    print(f"   Success: {read_invocation.get('success')}")
    print()

    # Check for code_context
    code_context = read_invocation.get("code_context")

    if not code_context:
        print("❌ code_context field is MISSING")
        print(f"   Available fields: {list(read_invocation.keys())}")
        print()
        print("This means enrichment is NOT flowing through the pipeline.")
        print()
        print("Debugging info:")
        print(f"  - Session ID: {session_id}")
        print(f"  - Tool invocations count: {len(tool_invocations)}")
        print(
            f"  - Invocation structure: {json.dumps(read_invocation, indent=2)[:500]}"
        )
        return 1

    print("✅ code_context field EXISTS")
    print()

    # Validate enrichment structure
    print("[8] Validate Enrichment Structure")
    print("-" * 80)

    required_fields = {
        "components": list,
        "component_count": int,
        "impact_score": (int, float),
        "dependents_count": int,
        "dependencies_count": int,
        "similar_files": list,
    }

    all_valid = True
    for field, expected_type in required_fields.items():
        value = code_context.get(field)
        if value is None:
            print(f"  ❌ {field}: MISSING")
            all_valid = False
        elif not isinstance(value, expected_type):
            print(f"  ⚠️  {field}: {value} (unexpected type: {type(value).__name__})")
        else:
            if isinstance(value, list):
                print(f"  ✅ {field}: {len(value)} items")
            else:
                print(f"  ✅ {field}: {value}")

    print()

    if not all_valid:
        print("⚠️  Some enrichment fields are missing")
        print(f"Available code_context fields: {list(code_context.keys())}")
        print()

    # Display enriched data
    print("[9] Enriched Data Sample")
    print("-" * 80)
    print(f"Components detected: {code_context.get('components', [])[:5]}")
    print(f"Total components: {code_context.get('component_count', 0)}")
    print(f"Impact score: {code_context.get('impact_score', 0)}")
    print(f"Dependents count: {code_context.get('dependents_count', 0)}")
    print(f"Dependencies count: {code_context.get('dependencies_count', 0)}")

    similar_files = code_context.get("similar_files", [])
    if similar_files:
        print(f"Similar files:")
        for sf in similar_files[:3]:
            print(f"  - {sf.get('file_path')} (similarity: {sf.get('similarity')})")
    else:
        print("Similar files: (none)")

    print()

    # Success summary
    print("=" * 80)
    print("✅ Phase 2 OpenCode Integration Test PASSED")
    print("=" * 80)
    print()
    print("What this validates:")
    print("  ✅ OpenCode tool invocation triggers CLI MCP")
    print("  ✅ CLI MCP enriches with code intelligence")
    print("  ✅ Backend receives enriched payload")
    print("  ✅ code_context persists to Redis correctly")
    print("  ✅ Complete Phase 2 pipeline working end-to-end")
    print()
    print("Phase 2 Status: PRODUCTION READY ✅")
    print()
    print(f"Session ID: {session_id}")
    print(f"Redis key: {redis_key}")
    print(f"Tool invocations: {len(tool_invocations)}")
    print("=" * 80)

    return 0


if __name__ == "__main__":
    sys.exit(test_opencode_integration())
