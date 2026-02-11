#!/usr/bin/env python3
"""
Test MCP activity execution tools directly via the MCP server
This bypasses OpenCode context and calls the MCP tools directly
"""
import asyncio
import httpx
import json

async def test_mcp_tools():
    print("=" * 70)
    print("Testing MCP Activity Execution Tools (Direct)")
    print("=" * 70)
    print()
    
    # MCP server is at localhost:3100 in the devbob-opencode container
    # We'll use host.docker.internal from host or localhost
    mcp_url = "http://localhost:3100"
    
    print(f"MCP Server: {mcp_url}")
    print()
    
    # Test 1: Check if MCP server is responding
    print("Test 1: MCP Server Health Check")
    print("-" * 70)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Try to list tools
            response = await client.post(
                f"{mcp_url}/list-tools",
                json={}
            )
            
            if response.status_code == 200:
                tools = response.json()
                print(f"✅ MCP server responding")
                print(f"   Available tools: {len(tools.get('tools', []))}")
                
                # Find activity-related tools
                activity_tools = [
                    t for t in tools.get('tools', []) 
                    if 'activity' in t.get('name', '').lower()
                ]
                print(f"   Activity tools: {len(activity_tools)}")
                for tool in activity_tools[:5]:
                    print(f"      - {tool.get('name')}")
                print()
            else:
                print(f"❌ Unexpected response: {response.status_code}")
                print(f"   {response.text[:200]}")
                return False
    except Exception as e:
        print(f"❌ Failed to connect to MCP server: {e}")
        print(f"   Is the MCP server running at {mcp_url}?")
        return False
    
    # Test 2: Search for activities
    print("Test 2: Search Activities via MCP")
    print("-" * 70)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{mcp_url}/call-tool",
                json={
                    "name": "search_activities",
                    "arguments": {
                        "query": "validation test",
                        "limit": 5
                    }
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ search_activities tool called")
                
                # Parse the content
                content = result.get('content', [])
                if content and len(content) > 0:
                    text_content = content[0].get('text', '{}')
                    activities = json.loads(text_content) if isinstance(text_content, str) else text_content
                    
                    if isinstance(activities, list):
                        print(f"   Found {len(activities)} activities")
                        for i, activity in enumerate(activities[:3], 1):
                            activity_id = activity.get('id', activity.get('variant_id', 'unknown'))
                            activity_name = activity.get('name', 'Unknown')
                            print(f"      {i}. {activity_name} ({activity_id})")
                    else:
                        print(f"   Activities: {activities}")
                print()
            else:
                print(f"❌ Failed: {response.status_code}")
                print(f"   {response.text[:300]}")
                return False
    except Exception as e:
        print(f"❌ search_activities failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test 3: Call start_activity_execution
    print("Test 3: Start Activity Execution via MCP")
    print("-" * 70)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Use a simple activity ID from search results
            response = await client.post(
                f"{mcp_url}/call-tool",
                json={
                    "name": "start_activity_execution",
                    "arguments": {
                        "activity_id": "bug-fix-v1",
                        "session_id": "test-mcp-direct",
                        "variables": json.dumps({
                            "bug_description": "Test MCP execution",
                            "error_message": "Testing"
                        }),
                        "cost_budget": 1.0
                    }
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ start_activity_execution called")
                
                content = result.get('content', [])
                if content and len(content) > 0:
                    text_content = content[0].get('text', '{}')
                    exec_result = json.loads(text_content) if isinstance(text_content, str) else text_content
                    
                    print(f"   Status: {exec_result.get('status')}")
                    print(f"   Execution ID: {exec_result.get('execution_id')}")
                    print(f"   State: {exec_result.get('state')}")
                print()
                return True
            else:
                print(f"❌ Failed: {response.status_code}")
                print(f"   {response.text[:300]}")
                return False
    except Exception as e:
        print(f"❌ start_activity_execution failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_mcp_tools())
    print("=" * 70)
    if result:
        print("✅ MCP TOOLS TEST PASSED")
    else:
        print("❌ MCP TOOLS TEST FAILED")
    print("=" * 70)
