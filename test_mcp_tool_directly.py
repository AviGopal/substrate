#!/usr/bin/env python3
"""Test search_activities_tool directly (not via MCP server)"""

import asyncio
import json
import sys
from pathlib import Path

# Add repos to path
sys.path.insert(0, str(Path(__file__).parent / "repos/metabob-cli/src"))


# Mock the server module
class MockServer:
    @staticmethod
    def get_config_manager():
        return {"base_url": "http://localhost:8080", "state_directory": ".metabob"}


# Patch before importing tools
sys.modules["metabob_cli.mcp.server"] = MockServer()

from metabob_cli.mcp.tools import search_activities_tool


async def test_tool():
    """Test the actual MCP tool function"""

    print("\n=== Testing search_activities_tool directly ===\n")

    # Call the tool with same parameters
    print("[1] Calling search_activities_tool()...")
    print("    Parameters: query='', category='', limit=20, min_success_rate=0.0")

    result_str = await search_activities_tool(
        query="",
        category="",
        limit=20,
        min_success_rate=0.0,
    )

    print("\n[2] Tool returned:")
    print(f"    Type: {type(result_str)}")
    print(f"    Length: {len(result_str)} chars")

    # Parse result
    result = json.loads(result_str)

    print("\n[3] Parsed result:")
    print(f"    Status: {result.get('status')}")
    print(f"    Count: {result.get('count')}")
    print(f"    Activities: {len(result.get('activities', []))}")

    if result.get("activities"):
        print("\n[4] Activities found:")
        for i, activity in enumerate(result["activities"], 1):
            print(f"      {i}. {activity.get('id')} - {activity.get('name')}")
    else:
        print("\n[4] ❌ NO ACTIVITIES RETURNED")

    print("\n=== END TEST ===\n")

    return result


if __name__ == "__main__":
    result = asyncio.run(test_tool())
    sys.exit(0 if result.get("count", 0) > 0 else 1)
