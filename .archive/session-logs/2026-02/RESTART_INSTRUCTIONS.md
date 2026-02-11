# Memory Issue - Restart Required

## Problem

Process **PID 1145129** is running **old code without memory leak fixes** and has accumulated **37 GB of RAM** over 3 hours.

## Why This Happened

- Fixes were deployed to source code at **22:38:00**
- This process started at **22:48:48** (10 min later)
- But it's running cached/old code from before the fixes
- Bun's dev mode didn't reload the new code

## Solution

### 1. Kill the leaking process

```bash
kill 1145129
```

Or if it's your active terminal session, use `Ctrl+C` in that terminal.

### 2. Restart with fixes

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
bun dev ../..
```

This will start a fresh process with the memory leak fixes loaded.

### 3. Verify the fix worked

Monitor the new process for 5 minutes:

```bash
# Get the new PID
new_pid=$(pgrep -f "packages/opencode.*index.ts" -n)

# Monitor memory every 30 seconds
for i in {1..10}; do
  ps -p $new_pid -o pid,%mem,rss,etime 2>/dev/null || echo "Process not found"
  sleep 30
done
```

Expected result: Memory should stay around 600-700 MB with no growth.

## Verification

The fixed version (PID 1134047) has been running for 3+ hours with **stable memory at 635 MB**.

After restarting, your new process should show the same stability.

## Quick Status Check

```bash
# See both processes
ps aux | grep "bun.*packages/opencode" | grep -v grep

# Expected after restart:
# - PID 1134047: ~635 MB (stable background process)
# - PID xxxxxx: ~650 MB (your new process with fixes)
```

## Memory Monitoring Endpoint

Once restarted, you can monitor via:

```bash
curl http://localhost:3000/debug/memory | python3 -m json.tool
```

This shows:
- Process memory (RSS, heap, external)
- Session context stats
- Uptime
