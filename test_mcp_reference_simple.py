#!/usr/bin/env python3
"""
Minimal MCP Reference Test - Prove the protocol works
"""
import asyncio
import json
import subprocess
import os

async def test_mcp_reference():
    print("=" * 80)
    print("MINIMAL MCP REFERENCE TEST")
    print("=" * 80)
    print()
    
    # Start MCP server
    env = os.environ.copy()
    env.update({
        "METABOB_API_KEY": "test-api-key",
        "METABOB_API_URL": "http://localhost:8080",
        "METABOB_PROJECT_ID": "metabob-devbob",
        "METABOB_ORG_ID": "test-org",
    })
    
    print("Step 1: Starting MCP server...")
    proc = await asyncio.create_subprocess_exec(
        "metabob-cli", "mcp", "--transport", "stdio",
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env
    )
    print(f"  ✓ Server started (PID: {proc.pid})")
    print()
    
    # Give it time to initialize
    await asyncio.sleep(3)
    
    # Test 1: List tools
    print("Step 2: Listing available tools...")
    list_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list",
        "params": {}
    }
    
    proc.stdin.write((json.dumps(list_request) + "\n").encode())
    await proc.stdin.drain()
    
    line = await asyncio.wait_for(proc.stdout.readline(), timeout=10.0)
    list_response = json.loads(line.decode())
    
    if "result" in list_response and "tools" in list_response["result"]:
        tools = list_response["result"]["tools"]
        print(f"  ✓ Found {len(tools)} tools")
        
        # Find search_activities
        search_tool = next((t for t in tools if t["name"] == "search_activities"), None)
        if search_tool:
            print(f"  ✓ Found 'search_activities' tool")
            print(f"    Input schema: {json.dumps(search_tool.get('inputSchema', {}), indent=6)}")
        else:
            print("  ✗ 'search_activities' tool NOT found")
            print(f"    Available: {[t['name'] for t in tools[:5]]}")
    else:
        print("  ✗ Failed to list tools")
        print(f"    Response: {list_response}")
    print()
    
    # Test 2: Call search_activities
    print("Step 3: Calling search_activities...")
    search_request = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": "search_activities",
            "arguments": {
                "query": "jiggle",
                "category": "",  # Empty string (the problematic case)
                "limit": 5,
                "min_success_rate": 0.0
            }
        }
    }
    
    print(f"  Request: {json.dumps(search_request, indent=2)}")
    proc.stdin.write((json.dumps(search_request) + "\n").encode())
    await proc.stdin.drain()
    
    line = await asyncio.wait_for(proc.stdout.readline(), timeout=10.0)
    search_response = json.loads(line.decode())
    
    print(f"\n  Response: {json.dumps(search_response, indent=2)[:500]}...")
    print()
    
    # Parse result
    if "result" in search_response:
        content = search_response["result"].get("content", [])
        if content and len(content) > 0:
            text = content[0].get("text", "{}")
            try:
                data = json.loads(text)
                status = data.get("status")
                count = data.get("count", 0)
                
                print(f"  Status: {status}")
                print(f"  Count: {count}")
                
                if count > 0:
                    print(f"  ✓ SUCCESS: Found {count} activities")
                    activities = data.get("activities", [])
                    for act in activities[:3]:
                        print(f"    - {act.get('name', 'unknown')} ({act.get('activity_id', 'unknown')})")
                else:
                    print(f"  ⚠️  WARNING: No activities returned (empty string bug?)")
            except json.JSONDecodeError as e:
                print(f"  ✗ Failed to parse response: {e}")
        else:
            print("  ✗ No content in response")
    elif "error" in search_response:
        print(f"  ✗ ERROR: {search_response['error']}")
    else:
        print("  ✗ Unexpected response format")
    
    print()
    
    # Test 3: Call with null category
    print("Step 4: Calling search_activities with null category...")
    search_request_null = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "search_activities",
            "arguments": {
                "query": "jiggle",
                "category": None,  # Explicit null
                "limit": 5,
                "min_success_rate": 0.0
            }
        }
    }
    
    # JSON null becomes Python None, which becomes JSON null again
    search_json = json.dumps(search_request_null)
    print(f"  Category in JSON: {json.loads(search_json)['params']['arguments']['category']}")
    
    proc.stdin.write((search_json + "\n").encode())
    await proc.stdin.drain()
    
    line = await asyncio.wait_for(proc.stdout.readline(), timeout=10.0)
    search_response_null = json.loads(line.decode())
    
    if "result" in search_response_null:
        content = search_response_null["result"].get("content", [])
        if content and len(content) > 0:
            text = content[0].get("text", "{}")
            try:
                data = json.loads(text)
                count = data.get("count", 0)
                print(f"  ✓ Count with null: {count}")
            except:
                pass
    print()
    
    # Cleanup
    proc.terminate()
    await proc.wait()
    print("✓ Test complete")
    print("=" * 80)

if __name__ == "__main__":
    try:
        asyncio.run(test_mcp_reference())
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
