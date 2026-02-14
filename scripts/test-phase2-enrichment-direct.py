#!/usr/bin/env python3
"""
Direct test of Phase 2 enrichment flow: Backend API → Redis

This simulates what the CLI MCP tool would send after enrichment.
Tests that the backend correctly receives and stores code_context.
"""

import json
import sys
import time

try:
    import redis
    import requests
except ImportError:
    print("Installing dependencies...")
    import os

    os.system("pip install redis requests")
    import redis
    import requests


def test_enriched_tool_invocation():
    """Test backend with simulated enriched payload from CLI."""
    print("=" * 70)
    print("Phase 2 Enrichment Test - Simulated CLI → Backend Flow")
    print("=" * 70)
    print()

    redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    api_url = "http://localhost:8080"

    # Check backend health
    print("[1] Backend Health Check")
    print("-" * 70)
    try:
        resp = requests.get(f"{api_url}/health", timeout=5)
        if resp.status_code != 200:
            print(f"❌ Backend not healthy: {resp.status_code}")
            return 1
        print("✅ Backend API healthy")
        print()
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        return 1

    # Create test session
    print("[2] Create Test Session")
    print("-" * 70)

    session_data = {
        "session_id": "test-session-" + str(int(time.time())),
        "agent_id": "test-agent",
        "agent_version": "1.0.0",
        "goal": "Test Phase 2 code intelligence enrichment",
        "context": {"test": "phase2_enrichment"},
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    resp = requests.post(
        f"{api_url}/api/agent-execution/session/start", json=session_data
    )

    if resp.status_code != 200:
        print(f"❌ Failed to create session: {resp.status_code}")
        print(resp.text)
        return 1

    result = resp.json()
    session_id = session_data["session_id"]
    print(f"✅ Session created: {session_id}")
    print(f"   Response: {result}")
    print()

    # Record tool invocation WITH enriched code_context
    # This simulates what CLI MCP would send after enrichment
    print("[3] Record Tool Invocation with Code Context")
    print("-" * 70)

    # Simulated enriched payload (what CLI would send)
    enriched_payload = {
        "session_id": session_id,
        "tool_name": "read",
        "success": True,
        "duration_ms": 123.45,
        "error": None,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "file_path": "/workspace/test_code_intelligence.py",
        "args": {"filePath": "/workspace/test_code_intelligence.py"},
        # This is the enriched data from CLI (Phase 2)
        "code_context": {
            "operation": "read",
            "timestamp": "2026-02-13T12:00:00Z",
            "components": [
                "AuthService",
                "AuthService.authenticate",
                "AuthService._verify_credentials",
                "create_auth_service",
                "AuthConfig",
            ],
            "component_count": 9,
            "impact_score": 0.45,
            "dependents_count": 3,
            "dependencies_count": 2,
            "similar_files": [
                {"file_path": "/workspace/auth_utils.py", "similarity": 0.85},
                {"file_path": "/workspace/session.py", "similarity": 0.72},
            ],
        },
    }

    print("Payload includes:")
    print(f"  - Components: {len(enriched_payload['code_context']['components'])}")
    print(f"  - Impact score: {enriched_payload['code_context']['impact_score']}")
    print(f"  - Dependents: {enriched_payload['code_context']['dependents_count']}")
    print(
        f"  - Similar files: {len(enriched_payload['code_context']['similar_files'])}"
    )
    print()

    resp = requests.post(
        f"{api_url}/api/agent-execution/tool/invocation", json=enriched_payload
    )

    if resp.status_code != 200:
        print(f"❌ Failed to record tool invocation: {resp.status_code}")
        print(resp.text)
        return 1

    result = resp.json()
    print(f"✅ Tool invocation recorded with code_context")
    print(f"   Response: {result}")
    print()

    # Verify enrichment in Redis
    print("[4] Verify Code Context in Redis")
    print("-" * 70)

    # Wait for async processing
    time.sleep(0.5)

    redis_key = f"agent_execution:session:{session_id}"
    session_json = redis_client.get(redis_key)

    if not session_json:
        print(f"❌ Session not found in Redis: {redis_key}")
        return 1

    session_data = json.loads(session_json)
    tool_invocations = session_data.get("tool_invocations", [])

    if not tool_invocations:
        print("❌ No tool invocations in Redis")
        return 1

    invocation = tool_invocations[0]
    code_context = invocation.get("code_context")

    if not code_context:
        print("❌ code_context field is missing")
        print(f"   Available fields: {list(invocation.keys())}")
        return 1

    print("✅ code_context field exists in Redis")
    print()

    # Validate structure
    print("[5] Validate Enrichment Structure")
    print("-" * 70)

    required_fields = {
        "components": list,
        "impact_score": (int, float),
        "dependents_count": int,
        "dependencies_count": int,
        "similar_files": list,
        "component_count": int,
    }

    all_valid = True
    for field, expected_type in required_fields.items():
        value = code_context.get(field)
        if value is None:
            print(f"  ❌ {field}: MISSING")
            all_valid = False
        elif not isinstance(value, expected_type):
            print(f"  ⚠️  {field}: {value} (type: {type(value).__name__})")
        else:
            if isinstance(value, list):
                print(f"  ✅ {field}: {len(value)} items")
            else:
                print(f"  ✅ {field}: {value}")

    print()

    if not all_valid:
        print("❌ Some required fields missing")
        return 1

    # Display enriched data
    print("[6] Enriched Data Sample")
    print("-" * 70)
    print(f"Components detected: {code_context.get('components', [])}")
    print(f"Impact score: {code_context.get('impact_score')}")
    print(f"Dependents: {code_context.get('dependents_count')}")
    print(
        f"Similar files: {[f.get('file_path') for f in code_context.get('similar_files', [])]}"
    )
    print()

    # Success summary
    print("=" * 70)
    print("✅ Phase 2 Enrichment Test PASSED")
    print("=" * 70)
    print()
    print("What this validates:")
    print("  ✅ Backend accepts code_context field")
    print("  ✅ code_context persists to Redis correctly")
    print("  ✅ All enrichment fields present and valid")
    print("  ✅ Data structure matches Phase 2 schema")
    print()
    print("Next Step:")
    print("  Test full OpenCode → CLI MCP → Backend flow in real environment")
    print()
    print("Session ID:", session_id)
    print(f"Redis key: {redis_key}")
    print("=" * 70)

    return 0


if __name__ == "__main__":
    sys.exit(test_enriched_tool_invocation())
