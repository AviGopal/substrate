#!/usr/bin/env python3
"""
Direct test of MCP search_activities tool to verify parameters
"""
import asyncio
import json
import subprocess

async def test_search():
    """Test search_activities with correct parameters"""
    
    # Start MCP server
    import os
    env = os.environ.copy()
    env.update({
        "METABOB_API_KEY": "test-api-key",
        "METABOB_API_URL": "http://localhost:8080",
        "METABOB_PROJECT_ID": "metabob-devbob",
        "METABOB_ORG_ID": "test-org",
    })
    
    proc = await asyncio.create_subprocess_exec(
        "metabob-cli", "mcp", "--transport", "stdio",
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env
    )
    
    # Wait for init
    await asyncio.sleep(2)
    
    # Send listTools request
    list_tools_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list",
        "params": {}
    }
    
    proc.stdin.write((json.dumps(list_tools_request) + "\n").encode())
    await proc.stdin.drain()
    
    response = await proc.stdout.readline()
    tools_response = json.loads(response.decode())
    print("=== Available Tools ===")
    if "result" in tools_response and "tools" in tools_response["result"]:
        for tool in tools_response["result"]["tools"]:
            print(f"  - {tool['name']}")
            if tool['name'] == "search_activities":
                print(f"    Schema: {json.dumps(tool.get('inputSchema', {}), indent=6)}")
    print()
    
    # Send search_activities request
    search_request = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": "search_activities",  # Note: WITHOUT metabob_ prefix
            "arguments": {
                "query": "jiggle",
                "category": "",
                "limit": 5,
                "min_success_rate": 0.0
            }
        }
    }
    
    print("=== Sending search request ===")
    print(json.dumps(search_request, indent=2))
    print()
    
    proc.stdin.write((json.dumps(search_request) + "\n").encode())
    await proc.stdin.drain()
    
    response = await proc.stdout.readline()
    search_response = json.loads(response.decode())
    
    print("=== Search Response ===")
    print(json.dumps(search_response, indent=2))
    
    proc.terminate()
    await proc.wait()

if __name__ == "__main__":
    asyncio.run(test_search())
