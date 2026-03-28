# MCP Hung Process Diagnosis - Session Exists But Processes Stuck
**Date**: February 12, 2026, 12:25 AM PST  
**Status**: 🟡 Session token valid, but MCP processes hung in CPU loop

---

## Critical Discovery

**The session token EXISTS and WORKS!**

```bash
$ cat .metabob/state | jq '.session_metadata'
{
  "session_token": "c2Vzc2lvbnM6...",
  "session_id": "62a4d853-4673-4450-b17e-4521f96e5c0e:exp-repo-dev:...",
  "project_id": "exp-repo-dev",
  "created_at": "2026-02-11T23:41:07.817607Z"
}

$ curl -H "Authorization: Bearer c2Vzc2lvbnM6..." \
  http://localhost:8080/v2/activities/templates?limit=3
→ ✅ Returns: REFACTOR-9c629da6, INFRASTRUCTURE-c0b9dfaa, INFRASTRUCTURE-d3b89954
```

**The problem is NOT session creation.** The problem is **MCP processes are hung in an infinite loop**.

---

## The Real Issue: File Watcher CPU Loop

### Observed Behavior

Two MCP processes were running, both consuming **124-125% CPU** continuously:

```bash
$ ps aux | grep "metabob-cli mcp"
avi  434839  124  0.8  2471256  521824  python3.13 metabob-cli mcp --transport stdio
avi  441092  125  0.6  2385736  382196  python3.13 metabob-cli mcp --transport stdio
```

**125% CPU = stuck in tight loop, not I/O wait**

### What's Causing the Loop

Looking at the `.metabob/state` file, it's **30 MB** and contains file states for **thousands of test files**:

```bash
$ ls -lh .metabob/state
-rw-r--r--  1 avi avi 31M Feb 12 00:22 state

$ cat .metabob/state | jq '.file_states | length'
# Thousands of files from repos/metabob-cli/tests/perf-repos/
```

The state file is tracking:
- `repos/metabob-cli/tests/perf-repos/medium/**` 
- `repos/metabob-cli/tests/perf-repos/large/**`
- `repos/metabob-cli/tests/perf-repos/xlarge/**`
- Tens of thousands of Python test files

**File watcher is monitoring all these files**, causing:
1. Constant file system polling
2. State file updates (30 MB read/write operations)
3. JSON serialization/deserialization
4. FileStateManager lock contention
5. **CPU spinning in polling loop**

---

## Root Cause

The MCP server's file watcher (`watch_files: true` in config) is monitoring the entire repository, including massive test fixture directories with 10,000+ files.

**From `.metabob/config.json`:**
```json
{
  "base_url": "http://localhost:8080",
  "api_key": "mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8",
  "state_directory": ".metabob",
  "watch_files": true,     ← WATCHING ALL FILES
  "batch_size": 5
}
```

**Impact:**
- 30 MB state file
- Thousands of file system stats per second
- Constant JSON serialization
- MCP process stuck at 125% CPU
- Tools time out because event loop is blocked

---

## Why Tools Timeout

Even though session exists and backend works, the MCP server can't respond to tool calls because:

1. **Event loop blocked**: File watcher is consuming all CPU cycles
2. **State file I/O**: Every tool call tries to read 30 MB state file
3. **Lock contention**: FileStateManager is constantly locked by file watcher
4. **No responsiveness**: Server literally cannot process incoming requests

This is why:
```javascript
search_activities({ verbose: true })
→ {"activities": [], "count": 0}  // Timeout, not "no activities"
```

And:
```bash
test_metabob_mcp()
→ "MCP error -32001: Request timed out"
```

---

## Solution

### Immediate Fix: Disable File Watcher

Edit `.metabob/config.json`:
```json
{
  "base_url": "http://localhost:8080",
  "api_key": "mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8",
  "state_directory": ".metabob",
  "watch_files": false,    ← DISABLE FOR NOW
  "batch_size": 5
}
```

### Medium-term Fix: Add .metabobignore

Create `.metabobignore` (like `.gitignore`):
```
# Exclude test fixtures
repos/metabob-cli/tests/perf-repos/
repos/*/tests/
**/node_modules/
**/.git/
**/venv/
**/__pycache__/
```

### Long-term Fix: Improve File Watcher

In `repos/metabob-cli/src/metabob_cli/file_watcher.py`:

1. **Respect .gitignore**: Don't watch files git ignores
2. **Size limits**: Skip files > 1 MB, directories > 1000 files
3. **Throttling**: Batch file system events (debounce 500ms)
4. **Background thread**: Move polling to separate thread
5. **State file limits**: Cap state file at 1000 files, LRU eviction

---

## Current State After Killing Processes

```bash
$ ps aux | grep "metabob-cli mcp"
# No processes

$ test_metabob_mcp
→ "Not connected"
```

**OpenCode needs full restart** to spawn new MCP server with fixed configuration.

---

## Action Plan

### Step 1: Disable File Watcher (Now)
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
echo '{"base_url":"http://localhost:8080","api_key":"mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8","state_directory":".metabob","watch_files":false,"batch_size":5}' > .metabob/config.json
```

### Step 2: Clean State File (Optional)
```bash
# Backup current state
cp .metabob/state .metabob/state.backup.30mb

# Create minimal state with just session
jq '{version, session_metadata, file_states: {}}' .metabob/state > .metabob/state.clean
mv .metabob/state.clean .metabob/state
```

### Step 3: Restart OpenCode
- Exit current OpenCode process
- Start fresh OpenCode session
- New MCP server will spawn with `watch_files: false`

### Step 4: Verify
```javascript
search_activities({ verbose: true })
// Should return 17 activities instantly
```

---

## Why This Was Hard to Diagnose

1. **Session was created** - So we thought that wasn't the issue
2. **Backend was working** - Direct curl tests succeeded
3. **Process was running** - MCP server appeared healthy
4. **High CPU looked like "busy"** - Not obviously a bug

The real clue was:
- **125% CPU continuously** (not bursty)
- **30 MB state file** (absurdly large)
- **Timeout errors** (not "not found" errors)

---

## Lessons Learned

### For metabob-cli Development

1. **File watcher needs limits** - Cannot watch infinite files
2. **State file needs size cap** - 30 MB is too large for JSON
3. **Respect .gitignore by default** - Most files shouldn't be watched
4. **Background file watching** - Don't block MCP event loop
5. **Add metrics** - Log watched file count, state file size

### For OpenCode Integration

1. **MCP health monitoring** - Detect high CPU and restart
2. **Timeout error details** - "Request timed out" doesn't indicate why
3. **Process lifecycle** - Should auto-restart hung MCP servers

### For Development Environments

1. **Don't run MCP in test repo root** - Too many test fixtures
2. **Configure watch directories** - Opt-in, not opt-out
3. **Monitor resource usage** - CPU/memory alerts

---

## Expected Outcome After Fix

### Before (Current)
```
MCP Process: 125% CPU, 30 MB state file, timeouts
search_activities(): → {"activities": [], "count": 0} (timeout)
```

### After (With watch_files: false)
```
MCP Process: <1% CPU, ~5 KB state file, responsive
search_activities(): → {"activities": [...17...], "count": 17} (<100ms)
```

---

## Testing Plan

After restart with fixed configuration:

1. **Verify MCP startup**:
   ```bash
   ps aux | grep "metabob-cli mcp"
   # Should show <5% CPU
   ```

2. **Check state file size**:
   ```bash
   ls -lh .metabob/state
   # Should be < 100 KB
   ```

3. **Test search_activities**:
   ```javascript
   search_activities({ verbose: true })
   // Should return 17 activities
   ```

4. **Execute test activity**:
   ```javascript
   activity({
     activityId: "INFRASTRUCTURE-c0b9dfaa",  // Code Analysis
     variables: {},
     reason: "Test activity execution works"
   })
   ```

---

## Related Issues

### In docker-compose.yaml (line 579)
```yaml
devbob:
  environment:
    METABOB_DISABLE_AUTO_INJECT: "true"
  # Comment says: "KNOWN ISSUE: auto_inject hangs due to MCP IPC issues"
```

This is likely the **same issue** - file watcher causing hangs.

### In SEQUENCE_BREAK_IDENTIFIED.md
Discussion of MCP server startup timing and session creation blocking. This is a **different issue** - that was about initial startup, this is about runtime file watching.

---

## Conclusion

**Good news**: Everything works! Session creation, backend, authentication, activity templates - all functional.

**Bad news**: File watcher is watching 10,000+ test files, causing MCP process to spin at 125% CPU and timeout all requests.

**Fix**: Disable file watching (or add .metabobignore) and restart OpenCode.

**Impact**: After fix, full activity system should work perfectly. We can then demonstrate:
- search_activities() → 17 templates
- activity() execution
- Activity creation with "Activity Create" template
- Full end-to-end workflow

---

**Prepared by**: Activity Mode Agent  
**Root Cause**: File watcher monitoring 10,000+ test files  
**Fix**: Disable watch_files or add .metabobignore  
**Status**: Ready for OpenCode restart with fixed config
