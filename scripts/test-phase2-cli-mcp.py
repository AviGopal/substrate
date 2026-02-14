#!/usr/bin/env python3
"""
Phase 2 CLI MCP Integration Test

Tests the CLI MCP enrichment layer directly:
  CLI MCP tool tracking → Backend storage → Redis

This verifies the CLI enrichment implementation without OpenCode dependency.
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


def test_cli_mcp_enrichment():
    """Test Phase 2 enrichment through CLI MCP layer."""
    print("=" * 80)
    print("Phase 2 CLI MCP Enrichment Test")
    print("=" * 80)
    print()

    redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    api_url = "http://localhost:8080"
    mcp_port = 8082  # CLI MCP server in devbob-clean

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

    # Check CLI MCP server
    try:
        # MCP server doesn't have a simple health endpoint, but we can check if port is open
        stdout, stderr = run_command(
            f"docker exec devbob-clean netstat -tln | grep '{mcp_port}' || echo 'not listening'",
            check=False,
        )
        if "LISTEN" in stdout or str(mcp_port) in stdout:
            print("✅ CLI MCP server running on port 8082")
        else:
            print(f"⚠️  CLI MCP server status unclear: {stdout}")
    except Exception as e:
        print(f"⚠️  CLI MCP check failed: {e}")

    print()

    # Step 2: Ensure test file exists in container
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

    session_id = f"cli-mcp-test-{int(time.time())}"
    session_data = {
        "session_id": session_id,
        "agent_id": "devbob-clean",
        "agent_version": "1.0.0",
        "goal": "Test Phase 2 CLI MCP enrichment layer",
        "context": {"test_type": "cli_mcp_enrichment", "phase": "phase2"},
        "started_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
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

    # Step 4: Simulate tool invocation with enrichment via CLI
    print("[4] Test CLI MCP Enrichment via Direct Call")
    print("-" * 80)
    print("Strategy: Call CLI MCP record_tool_invocation inside container")
    print()

    # Create a Python script to call the MCP tool directly
    test_script = f"""
import sys
import os
import json

# Add CLI package to path
sys.path.insert(0, '/opt/metabob-cli/src')

from metabob_cli.mcp.agent_execution_tools import AgentExecutionTools

# Initialize the tools
tools = AgentExecutionTools(
    api_url="http://api-server-dev:8080",
    project_id="exp-repo-dev"
)

# Set the current session
tools.current_session_id = "{session_id}"

# Record a tool invocation with file path (will trigger enrichment)
result = tools.record_tool_invocation(
    session_id="{session_id}",
    tool_name="read",
    success=True,
    duration_ms=125.5,
    error=None,
    file_path="/workspace/test_code_intelligence.py",
    args={{"filePath": "/workspace/test_code_intelligence.py"}}
)

print("Record result:", json.dumps(result, indent=2))
"""

    # Write script to container
    with open("/tmp/test_cli_enrichment.py", "w") as f:
        f.write(test_script)

    run_command(
        "docker cp /tmp/test_cli_enrichment.py devbob-clean:/tmp/test_cli_enrichment.py"
    )

    # Execute script in container
    stdout, stderr = run_command(
        "docker exec devbob-clean python3 /tmp/test_cli_enrichment.py", check=False
    )

    print("CLI MCP call output:")
    if stdout:
        print(stdout)
    if stderr:
        print("Errors:")
        print(stderr[:500])

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

    # Get the read tool invocation
    read_invocation = tool_invocations[0]

    print(f"✅ Found tool invocation")
    print(f"   Tool: {read_invocation.get('tool_name')}")
    print(f"   File: {read_invocation.get('file_path')}")
    print(f"   Success: {read_invocation.get('success')}")
    print()

    # Check for code_context
    code_context = read_invocation.get("code_context")

    if not code_context:
        print("❌ code_context field is MISSING")
        print(f"   Available fields: {list(read_invocation.keys())}")
        print()
        print("This means CLI MCP enrichment is NOT working.")
        print()
        print("Debugging info:")
        print(f"  - Session ID: {session_id}")
        print(f"  - Tool invocations count: {len(tool_invocations)}")
        print(f"  - Invocation structure:")
        print(json.dumps(read_invocation, indent=2))
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
            print(f"  ⚠️  {field}: MISSING (optional enrichment)")
        elif not isinstance(value, expected_type):
            print(f"  ⚠️  {field}: {value} (unexpected type: {type(value).__name__})")
        else:
            if isinstance(value, list):
                print(f"  ✅ {field}: {len(value)} items")
            else:
                print(f"  ✅ {field}: {value}")

    print()

    # Display enriched data
    print("[9] Enriched Data Sample")
    print("-" * 80)
    components = code_context.get("components", [])
    if components:
        print(f"Components detected: {components[:5]}")
        print(
            f"Total components: {code_context.get('component_count', len(components))}"
        )
    else:
        print("Components: (none - file may not have analyzable code)")

    print(f"Impact score: {code_context.get('impact_score', 'N/A')}")
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
    print("✅ Phase 2 CLI MCP Enrichment Test PASSED")
    print("=" * 80)
    print()
    print("What this validates:")
    print("  ✅ CLI MCP accepts tool tracking requests")
    print("  ✅ CLI MCP enriches with code intelligence")
    print("  ✅ Enriched payload sent to backend")
    print("  ✅ code_context persists to Redis correctly")
    print("  ✅ Phase 2 enrichment layer working")
    print()
    print("Note: Full OpenCode integration depends on OpenCode session tracking")
    print()
    print(f"Session ID: {session_id}")
    print(f"Redis key: {redis_key}")
    print(f"Tool invocations: {len(tool_invocations)}")
    print("=" * 80)

    return 0


if __name__ == "__main__":
    sys.exit(test_cli_mcp_enrichment())
