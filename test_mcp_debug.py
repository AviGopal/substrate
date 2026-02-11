#!/usr/bin/env python3
"""Test MCP tools with debug logging"""

import asyncio
import json
import logging
import os
import sys

# Enable debug logging
logging.basicConfig(level=logging.DEBUG, format='%(name)s - %(levelname)s - %(message)s')

# Set up environment
os.environ["METABOB_API_KEY"] = "test-api-key"
os.environ["METABOB_API_URL"] = "http://localhost:8080"
os.environ["METABOB_PROJECT_ID"] = "metabob-devbob"

sys.path.insert(0, "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src")

async def test_mcp_tools_debug():
    """Test MCP tools with debugging"""
    from metabob_cli.mcp.server import _ensure_session, get_config_manager
    from metabob_cli.mcp.tools import search_activities_tool
    
    print("\n=== Step 1: Creating session ===")
    await _ensure_session()
    
    config = get_config_manager()
    session_token = config.get("session_token", "")
    base_url = config.get("base_url", "")
    print(f"Config - base_url: {base_url}")
    print(f"Config - session_token: {session_token[:20]}... (len={len(session_token)})")
    
    print("\n=== Step 2: Calling search_activities_tool ===")
    result = await search_activities_tool(query="jiggle", limit=5)
    
    print(f"\n=== Step 3: Result ===")
    print(f"Type: {type(result)}")
    print(f"Content: {result[:500] if isinstance(result, str) else result}")

if __name__ == "__main__":
    asyncio.run(test_mcp_tools_debug())
