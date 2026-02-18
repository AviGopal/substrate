# Metabob Tool Hang Diagnosis

**Date**: Feb 15, 2026  
**Issue**: Metabob MCP tools (especially `list_file_components` and `analyze_change_impact`) hang or return undefined results

## Root Causes Identified

### 1. **Bootstrap Loop in Metabob CLI** (PRIMARY)
**Evidence**: Core logs show continuous bootstrap attempts:
```
🔄 Bootstrap mode: 2160 files need analysis (0 updated ⚡, 2160 never submitted)
🔄 BOOTSTRAP check #10825: 2160 need analysis (0 updated ⚡, 2160 new), active_job=False
```

**Problem**: 
- Metabob CLI is stuck trying to analyze 2160 files
- 7 jobs are queued on the server, all at 0% progress
- Job `117f092b-bcaf-4ce5-86ec-569075e6fd65` is continuously resumed but never completes
- This prevents any new tool calls from completing

**Impact**: All Metabob MCP tool calls block waiting for the analysis engine to be ready

---

### 2. **Response Format Mismatch** (SECONDARY)
**Evidence**: JavaScript error:
```
TypeError: undefined is not an object (evaluating 'result.content.filter')
```

**Location**: `/repos/metabob-opencode/packages/opencode/src/session/metabob-cpg-interface.ts:137-141`

**Problem**:
```typescript
const result = await metabobClient.callTool({
  name: "list_file_components",
  arguments: { file_path: filePath }
}) as any

if (result?.content && Array.isArray(result.content)) {
  const textContent = result.content
    .filter((item: any) => item.type === "text")  // <-- FAILS HERE
```

The code expects:
```typescript
result = {
  content: [
    { type: "text", text: "..." }
  ]
}
```

But Metabob CLI may be returning:
- `result.content = undefined` (most likely due to bootstrap blocking)
- `result.content = string` (plain text instead of array)
- `result = undefined` (tool call timeout)

---

## Why Tools Hang

The hang occurs because:

1. **Activity task** calls `metabob_list_file_components`
2. **MCP call** is sent to Metabob CLI via stdio
3. **Metabob CLI** receives the call but:
   - Is stuck in bootstrap loop checking 2160 files
   - Job queue has 7 pending jobs at 0%
   - Analysis engine is not in a "ready" state
4. **MCP handler** waits for response (with default timeout, likely 30-60s)
5. **Either**:
   - Timeout occurs → returns undefined
   - Partial response returns → `result.content` is undefined/malformed
6. **JavaScript code** tries to call `.filter()` on undefined → TypeError

---

## Evidence Timeline

### Server State
- **7 active jobs** all queued at 0%
- **2160 files** pending analysis
- **Bootstrap mode** continuously looping every ~300ms
- **Job 117f092b...** being resumed repeatedly but never progressing

### Tool Call Behavior
- `metabob_list_file_components` called with `file_path=test_refactor_demo.py`
- Returns error: `TypeError: undefined is not an object (evaluating 'result.content.filter')`
- Suggests response structure is missing or malformed

---

## Why Bootstrap is Stuck

Possible reasons for bootstrap deadlock:

### 1. **Server-Side Job Processing Failure**
- Metabob server has 7 jobs queued but not processing them
- Could be:
  - API rate limits
  - Server capacity issues
  - Network connectivity problems
  - Authentication failures

### 2. **State Corruption**
- State file size: **1.18 MB** (current)
- Backup state: **31.38 MB** (suspicious size)
- Possible state corruption causing job tracking issues

### 3. **Concurrent Session Conflict**
- **Two metabob-cli processes** running:
  ```
  PID 3809817 (14:07 start, 4 min CPU)
  PID 3820726 (14:40 start, 45 min CPU!!!)
  ```
- PID 3820726 using **71.6% CPU** and **45 minutes** of CPU time
- Possible lock contention or duplicate job submissions

---

## Fix Strategy

### Immediate Actions (Stop the Bleeding)

#### 1. **Kill Stuck Processes**
```bash
# Kill the high-CPU metabob-cli process
kill -9 3820726

# Check for any other stuck processes
ps aux | grep metabob-cli
```

#### 2. **Clear Job Queue**
```bash
# Stop all metabob-cli processes
pkill -f "metabob-cli mcp"

# Backup and reset state
cd /home/avi/documents/work/exp-repo/metabob-devbob/.metabob
cp state state.backup.$(date +%Y%m%d_%H%M%S)
rm state

# Restart metabob-cli (will create fresh state)
metabob-cli mcp --transport stdio
```

#### 3. **Check Server-Side Job Status**
```bash
# View job status on Metabob server
metabob-cli jobs list

# Cancel stuck jobs
metabob-cli jobs cancel 117f092b-bcaf-4ce5-86ec-569075e6fd65
metabob-cli jobs cancel --all-queued
```

---

### Defensive Code Fixes

#### 1. **Add Timeout to Tool Calls**
In `metabob-cpg-interface.ts`:
```typescript
const result = await Promise.race([
  metabobClient.callTool({
    name: "list_file_components",
    arguments: { file_path: filePath }
  }),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Tool call timeout")), 5000)
  )
]) as any
```

#### 2. **Handle Undefined Content Gracefully**
```typescript
if (!result?.content) {
  log.warn("metabob tool returned empty content", { filePath })
  return []
}

// Handle both array and string formats
const contentArray = Array.isArray(result.content) 
  ? result.content 
  : [{ type: "text", text: result.content }]

const textContent = contentArray
  .filter((item: any) => item?.type === "text")
  .map((item: any) => item.text || "")
  .join("\n")
```

#### 3. **Add Circuit Breaker**
```typescript
let metabobAvailable = true
let failureCount = 0

export async function queryFileComponents(filePath: string): Promise<FileComponent[]> {
  // Circuit breaker: don't try if we know it's down
  if (!metabobAvailable && failureCount > 3) {
    log.warn("metabob circuit breaker tripped, skipping query")
    return []
  }

  try {
    // ... existing code ...
    failureCount = 0 // Reset on success
  } catch (error) {
    failureCount++
    if (failureCount > 3) {
      metabobAvailable = false
      log.error("metabob circuit breaker tripped after 3 failures")
    }
    return []
  }
}
```

---

### Preventive Measures

#### 1. **Limit Bootstrap Scope**
Add to `.metabobignore`:
```
repos/*
node_modules/*
*.log
*.md
test-workspace/*
.archive/*
```

This reduces the 2160 files to a manageable number.

#### 2. **Configure Job Limits**
In `.metabob/config.json`:
```json
{
  "max_concurrent_jobs": 1,
  "bootstrap_batch_size": 5,
  "job_timeout_seconds": 300,
  "retry_failed_jobs": false
}
```

#### 3. **Add Health Check**
Create `check_metabob_health.sh`:
```bash
#!/bin/bash
# Check if metabob-cli is responsive

timeout 5s metabob-cli jobs list > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Metabob CLI not responsive, restarting..."
  pkill -f "metabob-cli mcp"
  sleep 2
  # Restart will happen automatically via opencode
fi
```

---

## Testing Plan

After fixes, test in this order:

### 1. **Basic Connectivity**
```bash
# Test that MCP connection works
metabob-cli mcp --transport stdio
# Send test request
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | metabob-cli mcp --transport stdio
```

### 2. **Tool Response Format**
```bash
# Test list_file_components directly
metabob-cli component list test_refactor_demo.py --format json
```

### 3. **Activity Execution**
```typescript
// Test safe-refactor-v1 activity with fixed Metabob tools
activity({
  activityId: "other-e5032a65",
  variables: { files: ["test_refactor_demo.py"] },
  reason: "Test Metabob tool integration after fix"
})
```

---

## Success Criteria

- ✅ No bootstrap loops in logs (stable state within 10 seconds)
- ✅ Job queue clears within 5 minutes
- ✅ `metabob_list_file_components` returns results in <5 seconds
- ✅ No `TypeError: undefined is not an object` errors
- ✅ Activity tasks can use Metabob tools without hanging
- ✅ CPU usage for metabob-cli stays below 10%

---

## Next Steps

1. **Immediate**: Kill stuck processes and reset state
2. **Code fix**: Add defensive handling for undefined content
3. **Config**: Update `.metabobignore` to reduce file count
4. **Test**: Run basic tool calls to verify fixes
5. **Monitor**: Watch logs for bootstrap stability

---

## Related Files

- **Logs**: `.metabob/logs/core.log`, `.metabob/logs/server.log`
- **State**: `.metabob/state` (1.18 MB)
- **Config**: `.metabob/config.json`
- **Code**: `repos/metabob-opencode/packages/opencode/src/session/metabob-cpg-interface.ts`
- **Ignore**: `.metabobignore`

---

## References

- Activity execution trace showing tool calls
- Server logs showing bootstrap loop
- JavaScript error showing response format issue
- Process list showing duplicate metabob-cli instances
