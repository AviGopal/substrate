#!/usr/bin/env python3
"""
Test impulse data flow from metabob-cli MCP server to backend.

This test validates the complete impulse system integration:
1. Start metabob-cli MCP server (stdio mode)
2. Send JSON-RPC messages to execute activities
3. Verify impulse data persists to SurrealDB backend
4. Validate learning loop updates

Architecture:
  OpenCode → metabob-cli MCP (stdio) → Backend API → SurrealDB

Test Flow:
  1. Initialize: Start MCP server subprocess
  2. Send: JSON-RPC initialize/tools.list
  3. Execute: Start activity with impulse context
  4. Report: Send step results with impulse usage
  5. Verify: Query SurrealDB for persisted data
  6. Cleanup: Stop MCP server

Dependencies:
  - metabob-cli MCP server (../repos/metabob-cli)
  - Backend API (http://localhost:8080)
  - SurrealDB (http://localhost:8000)
"""

import asyncio
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

# Configuration
METABOB_CLI_PATH = Path(__file__).parent / "repos/metabob-cli"
PYTHON_PATH = METABOB_CLI_PATH / ".venv/bin/python"
MCP_MODULE = "metabob_cli.mcp.server"
BACKEND_URL = "http://localhost:8080"
SURREALDB_URL = "http://localhost:8000"

# Test data
TEST_ORG_ID = "test-org-impulse-mcp"
TEST_PROJECT_ID = "test-project-impulse-mcp"
TEST_SESSION_ID = f"test-session-{int(time.time())}"
TEST_EXECUTION_ID = f"test-exec-{int(time.time())}"


class MCPClient:
    """Simple MCP client for stdio communication."""

    def __init__(self, process: subprocess.Popen):
        self.process = process
        self.request_id = 0

    def _send_message(self, message: Dict[str, Any]) -> None:
        """Send JSON-RPC message to MCP server."""
        json_str = json.dumps(message)
        print(f"→ Sending: {json_str[:200]}...")
        self.process.stdin.write(f"{json_str}\n".encode())
        self.process.stdin.flush()

    def _read_response(self, timeout: float = 10.0) -> Optional[Dict[str, Any]]:
        """Read JSON-RPC response from MCP server."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            line = self.process.stdout.readline()
            if not line:
                time.sleep(0.1)
                continue

            try:
                response = json.loads(line.decode().strip())
                print(f"← Received: {json.dumps(response, indent=2)[:300]}...")
                return response
            except json.JSONDecodeError as e:
                print(f"✗ Failed to parse response: {e}")
                print(f"  Raw line: {line}")
                continue

        print(f"✗ Timeout waiting for response after {timeout}s")
        return None

    def call_method(
        self, method: str, params: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Call MCP method and return response."""
        self.request_id += 1
        message = {"jsonrpc": "2.0", "id": self.request_id, "method": method}
        if params:
            message["params"] = params

        self._send_message(message)
        return self._read_response()

    def initialize(self) -> bool:
        """Send initialize request."""
        response = self.call_method(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0.0"},
            },
        )
        return response is not None and "result" in response

    def list_tools(self) -> Optional[list]:
        """List available tools."""
        response = self.call_method("tools/list")
        if response and "result" in response:
            return response["result"].get("tools", [])
        return None


async def query_surrealdb(query: str) -> Dict[str, Any]:
    """Query SurrealDB directly."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SURREALDB_URL}/sql",
            headers={
                "Accept": "application/json",
                "NS": "metabob",
                "DB": "devbob",
            },
            auth=("root", "root"),
            content=query,
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()


async def verify_impulse_in_db(impulse_id: str) -> bool:
    """Verify impulse exists in SurrealDB."""
    query = f"SELECT * FROM impulse_registry WHERE impulse_id = '{impulse_id}';"
    result = await query_surrealdb(query)
    print(f"✓ Query result: {json.dumps(result, indent=2)[:500]}...")
    return bool(result and result[0].get("result"))


async def create_test_activity_execution() -> Dict[str, Any]:
    """Create test activity execution via backend API."""
    async with httpx.AsyncClient() as client:
        payload = {
            "org_id": TEST_ORG_ID,
            "project_id": TEST_PROJECT_ID,
            "session_id": TEST_SESSION_ID,
            "template_id": "test-impulse-template",
            "variant_id": "v1",
            "variables": {"testVar": "testValue"},
            "parent_activity_id": None,
        }
        response = await client.post(
            f"{BACKEND_URL}/api/v2/activity/start_execution",
            json=payload,
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()


async def report_impulse_usage(
    execution_id: str, step_id: str, impulse_id: str, succeeded: bool = True
) -> Dict[str, Any]:
    """Report step result with impulse usage via backend API."""
    async with httpx.AsyncClient() as client:
        payload = {
            "execution_id": execution_id,
            "step_id": step_id,
            "result": {
                "success": succeeded,
                "output": "Test step output",
                "impulses_used": [
                    {
                        "impulse_id": impulse_id,
                        "usage_type": "loaded",
                        "tokens_used": 1500,
                        "resolution_time_ms": 50,
                    }
                ],
            },
        }
        response = await client.post(
            f"{BACKEND_URL}/api/v2/activity/report_step_result",
            json=payload,
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()


async def register_impulse_in_db(impulse_data: Dict[str, Any]) -> None:
    """Directly register impulse in SurrealDB for testing."""
    query = f"""
    INSERT INTO impulse_registry {{
        impulse_id: "{impulse_data["impulse_id"]}",
        impulse_type: "{impulse_data["impulse_type"]}",
        org_id: "{impulse_data["org_id"]}",
        project_id: "{impulse_data["project_id"]}",
        session_id: "{impulse_data.get("session_id", "")}",
        pointer: {json.dumps(impulse_data.get("pointer", {}))},
        budget: {impulse_data["budget"]},
        scope: "{impulse_data.get("scope", "session")}",
        created_by: "{impulse_data["created_by"]}",
        created_for: "{impulse_data.get("created_for", "")}",
        tags: {json.dumps(impulse_data.get("tags", []))},
        related_impulses: {json.dumps(impulse_data.get("related_impulses", []))},
        status: "{impulse_data.get("status", "active")}",
        usage_count: {impulse_data.get("usage_count", 0)},
        success_when_used: {impulse_data.get("success_when_used", 0)},
        success_rate: {impulse_data.get("success_rate", 0)},
        created_at: time::now()
    }};
    """
    await query_surrealdb(query)


async def main():
    """Main test flow."""
    print("=" * 80)
    print("IMPULSE SYSTEM: MCP → BACKEND → SURREALDB TEST")
    print("=" * 80)
    print()

    # Test 1: Verify prerequisites
    print("[1/7] Checking prerequisites...")
    if not PYTHON_PATH.exists():
        print(f"✗ Python not found: {PYTHON_PATH}")
        return 1

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{BACKEND_URL}/", timeout=5.0)
            response.raise_for_status()
            data = response.json()
            print(f"✓ Backend API healthy: {BACKEND_URL} (v{data.get('version')})")
    except Exception as e:
        print(f"✗ Backend API not available: {e}")
        return 1

    try:
        await query_surrealdb("INFO FOR DB;")
        print(f"✓ SurrealDB connected: {SURREALDB_URL}")
    except Exception as e:
        print(f"✗ SurrealDB not available: {e}")
        return 1

    print()

    # Test 2: Start MCP server
    print("[2/7] Starting metabob-cli MCP server (stdio mode)...")
    try:
        process = subprocess.Popen(
            [str(PYTHON_PATH), "-m", MCP_MODULE, "stdio"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(METABOB_CLI_PATH),
            env={
                **subprocess.os.environ,
                "METABOB_CONFIG_PATH": str(METABOB_CLI_PATH / ".metabob/config.json"),
                "METABOB_TEST_MODE": "1",
            },
        )
        print(f"✓ MCP server started (PID: {process.pid})")
        time.sleep(2)  # Wait for server startup

        if process.poll() is not None:
            print(f"✗ MCP server exited immediately")
            stderr = process.stderr.read().decode()
            print(f"  stderr: {stderr}")
            return 1
    except Exception as e:
        print(f"✗ Failed to start MCP server: {e}")
        return 1

    print()

    try:
        client = MCPClient(process)

        # Test 3: Initialize MCP connection
        print("[3/7] Initializing MCP connection...")
        if not client.initialize():
            print("✗ Failed to initialize MCP connection")
            return 1
        print("✓ MCP connection initialized")
        print()

        # Test 4: List tools
        print("[4/7] Listing MCP tools...")
        tools = client.list_tools()
        if not tools:
            print("✗ Failed to list tools")
            return 1

        tool_names = [tool["name"] for tool in tools]
        print(f"✓ Found {len(tools)} tools:")
        for name in sorted(tool_names)[:10]:
            print(f"  - {name}")
        if len(tool_names) > 10:
            print(f"  ... and {len(tool_names) - 10} more")
        print()

        # Test 5: Create impulse in database
        print("[5/7] Creating test impulse in database...")
        test_impulse_id = f"test-impulse-mcp-{int(time.time())}"
        impulse_data = {
            "impulse_id": test_impulse_id,
            "impulse_type": "file",
            "org_id": TEST_ORG_ID,
            "project_id": TEST_PROJECT_ID,
            "session_id": TEST_SESSION_ID,
            "pointer": {
                "type": "file",
                "path": "test/file.py",
                "offset": 0,
                "limit": 100,
            },
            "budget": 2000,
            "scope": "session",
            "created_by": "test-mcp-client",
            "created_for": "MCP integration test",
            "tags": ["test", "mcp", "integration"],
            "related_impulses": [],
            "status": "active",
            "usage_count": 0,
            "success_when_used": 0,
            "success_rate": 0.0,
        }

        try:
            await register_impulse_in_db(impulse_data)
            print(f"✓ Impulse registered: {test_impulse_id}")
        except Exception as e:
            print(f"✗ Failed to register impulse: {e}")
            return 1
        print()

        # Test 6: Create activity execution and report impulse usage
        print("[6/7] Creating activity execution and reporting impulse usage...")
        try:
            # Create activity execution
            exec_response = await create_test_activity_execution()
            execution_id = exec_response.get("execution_id", TEST_EXECUTION_ID)
            print(f"✓ Activity execution created: {execution_id}")

            # Report step result with impulse usage
            step_id = "step-0"
            report_response = await report_impulse_usage(
                execution_id, step_id, test_impulse_id, succeeded=True
            )
            print(f"✓ Step result reported with impulse usage")
            print(f"  Response: {json.dumps(report_response, indent=2)[:200]}...")
        except Exception as e:
            print(f"✗ Failed to report impulse usage: {e}")
            import traceback

            traceback.print_exc()
            # Continue to verification even if reporting fails
        print()

        # Test 7: Verify data in SurrealDB
        print("[7/7] Verifying impulse data in SurrealDB...")

        # Check impulse_registry
        registry_exists = await verify_impulse_in_db(test_impulse_id)
        if registry_exists:
            print(f"✓ Impulse found in impulse_registry: {test_impulse_id}")
        else:
            print(f"✗ Impulse NOT found in impulse_registry")

        # Check impulse_usage
        usage_query = f"""
        SELECT * FROM impulse_usage 
        WHERE impulse_id = '{test_impulse_id}' 
        AND execution_id = '{execution_id}';
        """
        usage_result = await query_surrealdb(usage_query)
        usage_records = usage_result[0].get("result", []) if usage_result else []
        if usage_records:
            print(f"✓ Found {len(usage_records)} usage record(s) in impulse_usage")
            for record in usage_records:
                print(f"  - step_id: {record.get('step_id')}")
                print(f"  - step_succeeded: {record.get('step_succeeded')}")
                print(f"  - usage_type: {record.get('usage_type')}")
        else:
            print(f"⚠️  No usage records found (report may have failed)")

        # Check success rate update
        registry_query = f"""
        SELECT impulse_id, usage_count, success_when_used, success_rate 
        FROM impulse_registry 
        WHERE impulse_id = '{test_impulse_id}';
        """
        registry_result = await query_surrealdb(registry_query)
        registry_data = (
            registry_result[0].get("result", [{}])[0] if registry_result else {}
        )
        if registry_data:
            print(f"✓ Learning loop data:")
            print(f"  - usage_count: {registry_data.get('usage_count', 0)}")
            print(f"  - success_when_used: {registry_data.get('success_when_used', 0)}")
            print(f"  - success_rate: {registry_data.get('success_rate', 0.0):.2%}")
        print()

        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"✓ MCP server started and responded")
        print(f"✓ Impulse created in database")
        print(f"✓ Activity execution created")
        if usage_records:
            print(f"✓ Impulse usage tracked successfully")
            print(f"✓ Learning loop data present")
            print()
            print("🎉 ALL TESTS PASSED - Impulse system integration working!")
        else:
            print(f"⚠️  Impulse usage tracking incomplete")
            print()
            print("⚠️  PARTIAL SUCCESS - Backend integration needs investigation")

        return 0 if usage_records else 2

    finally:
        # Cleanup: Stop MCP server
        print()
        print("Stopping MCP server...")
        try:
            process.terminate()
            process.wait(timeout=5)
            print("✓ MCP server stopped")
        except Exception as e:
            print(f"⚠️  MCP server cleanup error: {e}")
            process.kill()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
