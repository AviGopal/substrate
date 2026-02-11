#!/usr/bin/env python3
"""Test MCP tools after creating session"""

import asyncio
import json
import os
import sys

# Set up environment
os.environ["METABOB_API_KEY"] = "test-api-key"
os.environ["METABOB_API_URL"] = "http://localhost:8080"
os.environ["METABOB_PROJECT_ID"] = "metabob-devbob"

sys.path.insert(0, "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src")

async def test_mcp_tools_with_session():
    """Test MCP tools after ensuring session exists"""
    from metabob_cli.mcp.server import _ensure_session, get_config_manager
    from metabob_cli.mcp.tools import search_activities_tool
    
    print("Step 1: Creating session...")
    await _ensure_session()
    
    config = get_config_manager()
    session_token = config.get("session_token", "")
    print(f"  Session token: {session_token[:20]}... (length: {len(session_token)})")
    
    print("\nStep 2: Calling search_activities_tool...")
    result = await search_activities_tool(query="jiggle", limit=5)
    
    print("\nStep 3: Parsing results...")
    if isinstance(result, str):
        data = json.loads(result)
        templates = data.get("templates", [])
        print(f"  Found {len(templates)} templates")
        
        jiggle_found = any("jiggle" in t.get("variant_name", "").lower() for t in templates)
        
        if jiggle_found:
            print("\n✅ SUCCESS: Jiggle template found!")
            for t in templates:
                if "jiggle" in t.get("variant_name", "").lower():
                    print(f"  - {t.get('variant_name')}")
            return True
        else:
            print(f"\n❌ FAILURE: Jiggle template NOT found")
            print(f"  Templates: {[t.get('variant_name') for t in templates]}")
            return False
    else:
        print(f"\n❌ FAILURE: Unexpected result type: {type(result)}")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_mcp_tools_with_session())
    sys.exit(0 if result else 1)
