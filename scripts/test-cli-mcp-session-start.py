#!/usr/bin/env python3
"""Test CLI MCP tool for session start recording."""

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add CLI to path
cli_path = Path(__file__).parent.parent / "repos" / "metabob-cli" / "src"
sys.path.insert(0, str(cli_path))


async def test_mcp_tool():
    """Test metabob_record_session_start MCP tool directly."""
    print("=" * 60)
    print("Testing CLI MCP Tool: metabob_record_session_start")
    print("=" * 60)

    try:
        # Import after path setup
        from metabob_cli.mcp.agent_execution_tools import AgentExecutionTools

        # Create tools instance (no watcher needed for session start)
        tools = AgentExecutionTools(
            watcher_interface=None, backend_url="http://localhost:8080"
        )

        # Test data
        session_id = (
            f"cli-mcp-test-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
        )
        test_data = {
            "session_id": session_id,
            "agent_id": "activity-mode",
            "goal": "Test CLI MCP tool invocation",
            "agent_version": "1.0.0",
            "context": {
                "test_type": "direct CLI MCP call",
                "via": "AgentExecutionTools",
            },
            "started_at": datetime.now(timezone.utc).isoformat(),
        }

        print("\n1. Test Data:")
        print(json.dumps(test_data, indent=2))

        # Call the method directly
        print("\n2. Calling tools.record_session_start()...")
        result = await tools.record_session_start(**test_data)

        print("\n3. Result:")
        print(json.dumps(result, indent=2))

        # Verify in Redis
        print("\n4. Verifying in Redis...")
        import subprocess

        redis_cmd = [
            "docker",
            "exec",
            "metabob-redis",
            "redis-cli",
            "GET",
            f"agent_execution:session:{session_id}",
        ]
        redis_result = subprocess.run(redis_cmd, capture_output=True, text=True)

        if redis_result.stdout.strip():
            print("✅ Session found in Redis:")
            redis_data = json.loads(redis_result.stdout.strip())
            print(json.dumps(redis_data, indent=2))

            # Validate fields
            print("\n5. Field Validation:")
            required_fields = [
                "session_id",
                "agent_id",
                "goal",
                "agent_version",
                "started_at",
                "status",
            ]
            all_present = True
            for field in required_fields:
                present = field in redis_data
                status = "✅" if present else "❌"
                print(f"  {status} {field}: {present}")
                if not present:
                    all_present = False

            if all_present:
                print("\n✅ SUCCESS: CLI MCP tool works end-to-end!")
                return True
            else:
                print("\n⚠️  WARNING: Some fields missing")
                return False
        else:
            print("❌ Session NOT found in Redis")
            print(f"Redis output: {redis_result.stdout}")
            print(f"Redis error: {redis_result.stderr}")
            return False

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_mcp_tool())
    sys.exit(0 if success else 1)
