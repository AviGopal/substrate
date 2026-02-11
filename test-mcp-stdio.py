#!/usr/bin/env python3
"""
Test metabob-cli MCP via stdio (the actual transport OpenCode uses)
"""
import subprocess
import json
import os
import time

# Start MCP server
env = os.environ.copy()
env.update({
    "METABOB_API_KEY": "test-api-key",
    "METABOB_API_URL": "http://localhost:8080",
    "METABOB_PROJECT_ID": "metabob-devbob",
    "METABOB_ORG_ID": "test-org",
})

print("Starting MCP server...")
proc = subprocess.Popen(
    ["metabob-cli", "mcp", "--transport", "stdio"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=env,
    text=True,
    bufsize=1
)

time.sleep(2)

# Test 1: Initialize
print("\n=== Test 1: Initialize ===")
init_request = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "test-client", "version": "1.0"}
    }
}

proc.stdin.write(json.dumps(init_request) + "\n")
proc.stdin.flush()

# Read response
response_line = proc.stdout.readline()
print(f"Response: {response_line[:200]}")

# Test 2: List tools
print("\n=== Test 2: List Tools ===")
list_request = {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
}

proc.stdin.write(json.dumps(list_request) + "\n")
proc.stdin.flush()

response_line = proc.stdout.readline()
try:
    response = json.loads(response_line)
    tools = response.get("result", {}).get("tools", [])
    print(f"Found {len(tools)} tools")
    search_tool = next((t for t in tools if t["name"] == "search_activities"), None)
    if search_tool:
        print("✓ search_activities tool found")
    else:
        print("✗ search_activities tool NOT found")
        print(f"Available: {[t['name'] for t in tools[:5]]}")
except Exception as e:
    print(f"Parse error: {e}")
    print(f"Response: {response_line[:200]}")

# Test 3: Call search_activities
print("\n=== Test 3: Call search_activities ===")
search_request = {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
        "name": "search_activities",
        "arguments": {
            "query": "",
            "category": "",
            "limit": 5,
            "min_success_rate": 0.0
        }
    }
}

proc.stdin.write(json.dumps(search_request) + "\n")
proc.stdin.flush()

response_line = proc.stdout.readline()
try:
    response = json.loads(response_line)
    if "result" in response:
        content = response["result"].get("content", [])
        if content:
            text = content[0].get("text", "")
            data = json.loads(text)
            print(f"Status: {data.get('status')}")
            print(f"Count: {data.get('count')}")
            if data.get('count', 0) > 0:
                print("✓ Activities found!")
                for act in data.get('activities', [])[:3]:
                    print(f"  - {act.get('name')}")
            else:
                print("✗ No activities returned")
    elif "error" in response:
        print(f"Error: {response['error']}")
except Exception as e:
    print(f"Parse error: {e}")
    print(f"Response: {response_line[:500]}")

# Cleanup
proc.terminate()
proc.wait()

print("\n=== Test Complete ===")
