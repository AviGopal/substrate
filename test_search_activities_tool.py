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
    print(f">>> Sending: {msg['method']}", file=sys.stderr)
    proc.stdin.write(json.dumps(msg) + '\n')
    proc.stdin.flush()

def wait_for_response(timeout=10):
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
if not resp:
    print("Initialize failed!", file=sys.stderr)
    sys.exit(1)

print("Initialized. Testing search_activities...", file=sys.stderr)

# Call search_activities with correct name
send_message({
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
        "name": "search_activities",
        "arguments": {
            "query": "",
            "limit": 5,
            "min_success_rate": 0.0
        }
    }
})

resp = wait_for_response(timeout=15)
if resp:
    print("\n=== search_activities RESULT ===")
    result = resp.get("result", {})
    if isinstance(result, dict) and "content" in result:
        for content in result["content"]:
            if content["type"] == "text":
                try:
                    data = json.loads(content["text"])
                    print(json.dumps(data, indent=2))
                except:
                    print(content["text"])
    else:
        print(json.dumps(result, indent=2))
else:
    print("No response received!", file=sys.stderr)

proc.terminate()
