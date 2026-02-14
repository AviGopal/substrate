#!/usr/bin/env python3
"""
End-to-End Test for Phase 2: Agent Execution Intelligence

Tests the complete flow:
OpenCode (simulated) → CLI MCP → Backend → Redis

This test verifies that code_context enrichment works through the MCP layer.
"""

import json
import os
import sys
import time
from pathlib import Path

# Add CLI to Python path for direct import
cli_path = Path(__file__).parent.parent / "repos" / "metabob-cli" / "src"
sys.path.insert(0, str(cli_path))

try:
    import redis
    import requests
except ImportError:
    print("Installing dependencies...")
    os.system("pip install redis requests")
    import redis
    import requests


class Phase2E2ETest:
    """Test Phase 2 enrichment through simulated OpenCode → MCP → Backend flow."""

    def __init__(self):
        self.redis_client = redis.Redis(
            host="localhost", port=6379, decode_responses=True
        )
        self.api_url = "http://localhost:8080"
        self.test_file = str(Path(__file__).parent.parent / "test_code_intelligence.py")
        self.session_id = None

    def setup(self):
        """Setup test environment."""
        print("=" * 70)
        print("Phase 2 E2E Test - OpenCode → CLI MCP → Backend")
        print("=" * 70)
        print()

        # Check backend health
        try:
            response = requests.get(f"{self.api_url}/health", timeout=5)
            if response.status_code != 200:
                print("❌ Backend API not healthy")
                return False
        except Exception as e:
            print(f"❌ Cannot connect to backend: {e}")
            return False

        # Check Redis
        try:
            self.redis_client.ping()
        except Exception as e:
            print(f"❌ Cannot connect to Redis: {e}")
            return False

        print("✅ Backend services healthy")
        print()
        return True

    def test_mcp_enrichment(self):
        """Test enrichment through MCP layer (simulated OpenCode call)."""
        print("[Test 1] MCP Tool Call with Enrichment")
        print("-" * 70)

        # Import the MCP tools from CLI
        try:
            from metabob_cli.mcp.tools import agent_execution_tools
        except ImportError:
            print("❌ Cannot import CLI MCP tools")
            print("   Path:", cli_path)
            return False

        # Create a test session first
        print("Creating test session...")
        session_data = {
            "agent_type": "activity",
            "initial_context": {"test": "phase2_e2e"},
            "metadata": {"test_type": "e2e_enrichment"},
        }

        response = requests.post(
            f"{self.api_url}/api/v2/agent-execution/sessions", json=session_data
        )

        if response.status_code != 200:
            print(f"❌ Failed to create session: {response.text}")
            return False

        self.session_id = response.json()["session_id"]
        print(f"✅ Session created: {self.session_id}")
        print()

        # Now simulate OpenCode calling metabob_record_tool_invocation via MCP
        print("Calling MCP tool: metabob_record_tool_invocation")
        print(f"  File: {self.test_file}")
        print()

        # This simulates what OpenCode does in session.ts lines 434-456
        tool_args = {
            "session_id": self.session_id,
            "tool_name": "read",
            "tool_args": {
                "filePath": self.test_file  # OpenCode extracts this
            },
            "timestamp": time.time(),
        }

        try:
            # Call the MCP tool directly (this is what the MCP server would do)
            from metabob_cli.mcp.agent_execution_tools import record_tool_invocation

            result = record_tool_invocation(tool_args)

            if "error" in result:
                print(f"❌ MCP tool returned error: {result['error']}")
                return False

            print("✅ MCP tool call succeeded")
            print()
            return True

        except Exception as e:
            print(f"❌ MCP tool call failed: {e}")
            import traceback

            traceback.print_exc()
            return False

    def verify_enrichment(self):
        """Verify that code_context was enriched in Redis."""
        print("[Test 2] Verify Code Context Enrichment in Redis")
        print("-" * 70)

        if not self.session_id:
            print("❌ No session ID available")
            return False

        # Wait a moment for async processing
        time.sleep(1)

        # Fetch session from Redis
        redis_key = f"agent_execution:session:{self.session_id}"
        session_json = self.redis_client.get(redis_key)

        if not session_json:
            print(f"❌ Session not found in Redis: {redis_key}")
            return False

        session_data = json.loads(session_json)

        # Check tool_invocations
        tool_invocations = session_data.get("tool_invocations", [])
        if not tool_invocations:
            print("❌ No tool invocations recorded")
            return False

        print(f"✅ Found {len(tool_invocations)} tool invocation(s)")
        print()

        # Check the first invocation for code_context
        invocation = tool_invocations[0]
        code_context = invocation.get("code_context")

        if not code_context:
            print("❌ code_context is missing or null")
            print(f"   Invocation keys: {list(invocation.keys())}")
            return False

        print("✅ code_context field exists and has data")
        print()

        # Validate enrichment structure
        print("Enrichment Details:")
        print("-" * 70)

        required_fields = {
            "components": list,
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
                print(
                    f"  ❌ {field}: Wrong type (expected {expected_type}, got {type(value)})"
                )
                all_valid = False
            else:
                if isinstance(value, list):
                    print(f"  ✅ {field}: {len(value)} items")
                    if field == "components" and value:
                        print(f"      Examples: {value[:3]}")
                    elif field == "similar_files" and value:
                        print(
                            f"      Examples: {[f.get('file_path', 'unknown') for f in value[:2]]}"
                        )
                else:
                    print(f"  ✅ {field}: {value}")

        print()
        return all_valid

    def verify_performance(self):
        """Verify enrichment performance is acceptable."""
        print("[Test 3] Performance Verification")
        print("-" * 70)

        if not self.session_id:
            print("❌ No session ID available")
            return False

        redis_key = f"agent_execution:session:{self.session_id}"
        session_json = self.redis_client.get(redis_key)
        session_data = json.loads(session_json)

        invocation = session_data["tool_invocations"][0]

        # Check if we recorded timing information
        timestamp = invocation.get("timestamp")
        duration = invocation.get("duration_ms")

        if duration:
            print(f"  Enrichment duration: {duration}ms")
            if duration < 200:
                print("  ✅ Performance acceptable (<200ms)")
            else:
                print("  ⚠️  Performance slower than target (>200ms)")
        else:
            print("  ⚠️  Duration not recorded (expected in future)")

        print()
        return True

    def run(self):
        """Run all tests."""
        if not self.setup():
            return 1

        tests = [
            ("MCP Enrichment", self.test_mcp_enrichment),
            ("Enrichment Verification", self.verify_enrichment),
            ("Performance Check", self.verify_performance),
        ]

        results = []
        for name, test_func in tests:
            try:
                result = test_func()
                results.append((name, result))
            except Exception as e:
                print(f"❌ Test crashed: {e}")
                import traceback

                traceback.print_exc()
                results.append((name, False))

        # Summary
        print("=" * 70)
        print("Test Summary")
        print("=" * 70)

        passed = sum(1 for _, result in results if result)
        total = len(results)

        for name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status}: {name}")

        print()
        print(f"Results: {passed}/{total} tests passed")

        if self.session_id:
            print()
            print("Session ID for manual inspection:")
            print(f"  {self.session_id}")
            print()
            print("Redis inspection command:")
            print(
                f"  docker exec metabob-redis redis-cli GET 'agent_execution:session:{self.session_id}'"
            )

        print("=" * 70)

        return 0 if passed == total else 1


if __name__ == "__main__":
    test = Phase2E2ETest()
    sys.exit(test.run())
