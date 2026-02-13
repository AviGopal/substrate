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
    print(f">>> {json.dumps(msg)}", file=sys.stderr)
    proc.stdin.write(json.dumps(msg) + '\n')
    proc.stdin.flush()

def wait_for_response(timeout=5):
    start = time.time()
    while time.time() - start < timeout:
        ready, _, _ = select.select([proc.stdout], [], [], 0.5)
        if ready:
            line = proc.stdout.readline()
            if line:
                print(f"<<< {line.strip()}", file=sys.stderr)
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

print("Initialized successfully", file=sys.stderr)

# Call search_activities
send_message({
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
        "name": "metabob_search_activities",
        "arguments": {
            "query": "",
            "limit": 5,
            "min_success_rate": 0.0
        }
    }
})

resp = wait_for_response(timeout=10)
if resp:
    print("\n=== RESULT ===")
    print(json.dumps(resp, indent=2))
else:
    print("No response received!", file=sys.stderr)

proc.terminate()
proc.wait(timeout=1)
