#!/usr/bin/env python3
import subprocess
import json
import select
import sys
import os
import time

env = os.environ.copy()
env.update({
    'METABOB_API_URL': 'http://localhost:8080',
    'METABOB_API_KEY': 'mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8',
    'METABOB_PROJECT_ID': 'exp-repo-dev'
})

proc = subprocess.Popen(
    ['metabob-cli', 'mcp', '--transport', 'stdio'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=env,
    text=True,
    bufsize=0
)

def send_message(msg):
    proc.stdin.write(json.dumps(msg) + '\n')
    proc.stdin.flush()

def wait_for_response(timeout=5):
    start = time.time()
    while time.time() - start < timeout:
        ready, _, _ = select.select([proc.stdout], [], [], 0.5)
        if ready:
            line = proc.stdout.readline()
            if line:
                return json.loads(line)
    return None

# Initialize
send_message({
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "test", "version": "1.0"}
    }
})
resp = wait_for_response()

# List tools
send_message({
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
})

resp = wait_for_response(timeout=10)
if resp:
    tools = resp.get("result", {}).get("tools", [])
    print(f"Found {len(tools)} tools:\n")
    for tool in tools:
        print(f"  - {tool['name']}")
        if 'activity' in tool['name'].lower() or 'search' in tool['name'].lower():
            print(f"    Description: {tool.get('description', 'N/A')}")
    print(f"\nActivity-related tools:")
    activity_tools = [t for t in tools if 'activity' in t['name'].lower()]
    for t in activity_tools:
        print(f"  {t['name']}: {t.get('description', '')[:80]}")
else:
    print("No response!")

proc.terminate()
