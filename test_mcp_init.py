#!/usr/bin/env python3
import subprocess
import json
import select
import sys
import os

# Ensure env is set
env = os.environ.copy()
env.update({
    'METABOB_API_URL': 'http://localhost:8080',
    'METABOB_API_KEY': 'mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8',
    'METABOB_PROJECT_ID': 'exp-repo-dev'
})

# Start MCP server
proc = subprocess.Popen(
    ['metabob-cli', 'mcp', '--transport', 'stdio'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=env,
    text=True,
    bufsize=0  # Unbuffered
)

print("MCP server started, PID:", proc.pid, file=sys.stderr)

# Send initialize
init_msg = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "test", "version": "1.0"}
    }
}

print("Sending:", json.dumps(init_msg), file=sys.stderr)
proc.stdin.write(json.dumps(init_msg) + '\n')
proc.stdin.flush()

# Wait for output with timeout
import time
timeout = 5
start = time.time()
while time.time() - start < timeout:
    if proc.poll() is not None:
        print("Process exited!", file=sys.stderr)
        break
    
    # Check if stdout has data
    ready, _, _ = select.select([proc.stdout], [], [], 0.5)
    if ready:
        line = proc.stdout.readline()
        if line:
            print("Received:", line.strip())
            try:
                data = json.loads(line)
                print(json.dumps(data, indent=2))
                break
            except:
                print("Not JSON:", line)
    
    # Check stderr
    ready, _, _ = select.select([proc.stderr], [], [], 0.1)
    if ready:
        err = proc.stderr.readline()
        if err:
            print("STDERR:", err.strip(), file=sys.stderr)

proc.terminate()
try:
    proc.wait(timeout=1)
except:
    proc.kill()

print("Done", file=sys.stderr)
