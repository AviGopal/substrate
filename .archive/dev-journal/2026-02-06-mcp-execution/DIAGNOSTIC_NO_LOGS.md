# Diagnostic: Why No Session Memory Agent Logs?

## Discovery: No Chat Turns Are Happening

### What the Logs Show

**Recent activity** (last 500 lines):
```
INFO service=session-state get session state
INFO service=server GET /session/{id}/state
INFO service=storage storage cache hit (messages/parts)
```

**What's missing**:
- ❌ No `session.prompt` logs
- ❌ No `turn-lifecycle` logs
- ❌ No `session-memory-agent` logs
- ❌ No `prepareSessionMemory` logs

### What This Means

**The TUI is open and polling session state**, but **no actual agent turns are executing**.

The logs you're seeing are from:
- TUI refresh (every ~100ms)
- State queries (session info, messages, parts)
- Cache hits (serving TUI requests from memory)

**This is normal when viewing a session but not actively chatting.**

---

## How to Trigger Session Memory Agent

### The agent only runs when:

1. **User sends a message** in chat
2. **Activity executes** a turn
3. **Agent responds** to prompt

### To See Logs, Send a Message

**In TUI**:
```bash
opencode chat --agent activity
> Hello, can you help me?
```

**Or via API**:
```bash
curl -X POST localhost:3000/session/{id}/prompt \
  -d '{"agent": "activity", "parts": [{"type": "text", "text": "test"}]}'
```

**Then check logs**:
```bash
tail -f ~/.local/share/opencode/log/dev.log | grep -E "turn-lifecycle|session-memory"
```

---

## Expected Log Sequence When Turn Happens

### When you send a message, you'll see:

```
INFO  service=session.prompt prompt
DEBUG service=session.prompt extracting promptText from parts
INFO  service=turn-lifecycle executing pre-turn hooks {hookCount: 5}
INFO  service=turn-lifecycle executing hook {hook: "session-memory-preparation", priority: 10}
DEBUG service=turn-lifecycle-hooks importing prepareSessionMemory
INFO  service=session.prompt prepareSessionMemory() starting
DEBUG service=session-memory-agent budget status checked {utilization: "15.2%"}
INFO  service=session-memory-agent analyzeIntent() starting
INFO  service=session-memory-agent analyzeIntent() completed {suggestedImpulses: 2}
INFO  service=session.prompt intent analyzed
INFO  service=session-memory-agent impulse created {impulseId: "errorFile"}
INFO  service=session-memory-agent impulse loaded {tokenCount: 1847}
INFO  service=session-memory-agent prepare() completed {created: 2, loaded: 1}
INFO  service=turn-lifecycle-hooks session memory preparation completed
INFO  service=turn-lifecycle hook completed {hook: "session-memory-preparation", success: true}
INFO  service=session.prompt pre-turn hooks completed
[Main agent executes...]
INFO  service=turn-lifecycle executing post-turn hooks
INFO  service=turn-lifecycle executing hook {hook: "session-memory-optimization", priority: 110}
INFO  service=session-memory-lifecycle optimized session memory for turn
INFO  service=turn-lifecycle-hooks annotated component interactions {annotated: 1}
INFO  service=turn-lifecycle hook completed {hook: "session-memory-optimization", success: true}
```

**This is what's missing** - because no turns are happening!

---

## Why RAM Usage Is High

### The 268 MB Log File

```bash
-rw-r--r-- 1 avi avi 268M Feb 6 21:13 dev.log
```

**This is huge!** 268 MB of logs suggests:
1. Many past sessions
2. Lots of debug-level storage cache hits
3. No log rotation configured

### What's Using RAM

**Likely sources**:

1. **Storage cache** (up to 100 MB)
   - 500 items cached
   - Messages, parts, session memory stores
   - This is intentional and bounded

2. **Message history** (varies)
   - All messages in current session
   - All parts (tool calls, outputs, etc.)
   - Could be 50-200 MB in long sessions

3. **Log file buffer** (if tailed)
   - If log file is being read/tailed
   - 268 MB file in memory

### Check Current RAM Usage

```bash
# See what opencode processes are using
ps aux | grep opencode | grep -v grep

# Check specific process
top -p $(pgrep -f opencode | head -1)
```

---

## How to Fix High RAM Usage

### Solution 1: Clear Old Logs

```bash
# Backup current log
mv ~/.local/share/opencode/log/dev.log ~/.local/share/opencode/log/dev.log.backup

# Or truncate
> ~/.local/share/opencode/log/dev.log

# Or rotate
mv ~/.local/share/opencode/log/dev.log ~/.local/share/opencode/log/dev-$(date +%Y%m%d).log
```

### Solution 2: Clear Storage Cache

```bash
# Via CLI
opencode reset --cache

# Or programmatically
```

```typescript
import { Storage } from "./storage/storage"
Storage.clearCache()
```

### Solution 3: Clear Old Sessions

```bash
# Reset old session data
opencode reset --sessions --keep-recent 10
```

### Solution 4: Check Config

**File**: `~/.config/opencode/opencode.json` or `.opencode/opencode.json`

Check if session memory is even enabled:
```json
{
  "sessionMemory": {
    "enabled": false  // ← If false, memory agent won't run
  }
}
```

---

## Verify Hooks Are Registered

### Quick Test

Create a simple test file:

```typescript
// test-hooks.ts
import { TurnLifecycle } from "./src/session/turn-lifecycle"

// This import should register hooks
import "./src/session/turn-lifecycle-hooks"

// Check what's registered
const hooks = TurnLifecycle.getHooks()
console.log("Registered hooks:", hooks.map(h => ({
  name: h.name,
  priority: h.priority
})))

// Expected output:
// [
//   {name: "session-memory-preparation", priority: 10},
//   {name: "activity-recommendation-injection", priority: 15},
//   {name: "metabob-context-preparation", priority: 20},
//   {name: "boredom-task-suggestion", priority: 25},
//   {name: "post-turn-cleanup", priority: 100},
//   {name: "session-memory-optimization", priority: 110}
// ]
```

Run:
```bash
cd repos/metabob-opencode/packages/opencode
bun run test-hooks.ts
```

**If output shows hooks**: They're registered ✅  
**If empty array**: Import issue ❌

---

## Test the Session Memory Agent

### Manual Test

```bash
# Start fresh session
cd repos/metabob-opencode/packages/opencode
bun run index.ts chat --agent activity

# Send a message
> Fix the bug in memory-agent.ts

# Watch logs in another terminal
tail -f ~/.local/share/opencode/log/dev.log | grep -E "turn-lifecycle|session-memory-agent|prepareSessionMemory"
```

**You should immediately see**:
```
INFO turn-lifecycle executing pre-turn hooks
INFO turn-lifecycle executing hook {session-memory-preparation}
INFO session.prompt prepareSessionMemory() starting
DEBUG session-memory-agent budget status checked
INFO session-memory-agent analyzeIntent() completed
...
```

**If you don't see these**: The hooks aren't executing.

---

## Possible Issues

### Issue 1: Config Disabled

**Check**: `~/.config/opencode/opencode.json` or `.opencode/opencode.json`

```json
{
  "sessionMemory": {
    "enabled": false  // ← This would disable everything
  }
}
```

**Fix**: Remove the `enabled: false` line or set to `true`

---

### Issue 2: Code Not Built

**If using TypeScript compilation**:

```bash
cd repos/metabob-opencode/packages/opencode
bun run build
```

**Our changes need to be compiled** if using a build step.

---

### Issue 3: Wrong Entry Point

**Check how opencode is started**:

```bash
which opencode
# Is it using the version with our changes?

# Or if running from source:
bun run index.ts chat  # Uses src/index.ts
bun dev                # Uses dev build
```

---

### Issue 4: Logs at DEBUG Level

**Session memory agent uses log.debug() for many operations**.

**Check if DEBUG logs are enabled**:

```bash
# These logs are log.info() - always visible
grep "analyzeIntent() completed" dev.log

# These logs are log.debug() - only visible with DEBUG=*
grep "budget status checked" dev.log
```

**To see ALL logs**:
```bash
DEBUG=* opencode chat
```

---

## RAM Usage Investigation

### Check What's Actually Using RAM

```bash
# Measure process memory
ps aux | grep opencode | awk '{print $6/1024 " MB - " $11}'

# Or more detailed:
pmap $(pgrep -f opencode | head -1) | tail -1
```

### Common RAM Consumers

1. **Storage cache**: Max 100 MB (bounded)
2. **Message history**: 50-200 MB (long sessions)
3. **Log file in memory**: 268 MB (if tailed/read)
4. **Impulse content**: Variable (loaded files)

### Quick Fix

```bash
# Clear cache
opencode reset --cache

# Clear old sessions
opencode reset --sessions --keep-recent 5

# Truncate logs
> ~/.local/share/opencode/log/dev.log

# Restart opencode
```

---

## Action Plan

### Step 1: Verify Hooks Registered

```bash
cd repos/metabob-opencode/packages/opencode
bun run -e 'import {TurnLifecycle} from "./src/session/turn-lifecycle"; import "./src/session/turn-lifecycle-hooks"; console.log(TurnLifecycle.getHooks().map(h => h.name))'
```

**Expected**: Array with "session-memory-preparation" and "session-memory-optimization"

---

### Step 2: Send a Test Message

```bash
# In opencode chat
> test message

# Watch logs
tail -f ~/.local/share/opencode/log/dev.log | grep -v "storage cache"
```

**Expected**: See turn-lifecycle and session-memory-agent logs

---

### Step 3: Check Config

```bash
# Check if session memory is disabled
cat ~/.config/opencode/opencode.json | grep -A5 sessionMemory
cat .opencode/opencode.json | grep -A5 sessionMemory
```

**If shows `"enabled": false`**: That's why!

---

### Step 4: Enable DEBUG Logging

```bash
DEBUG=* opencode chat
# Or specific services:
DEBUG=session-memory-agent,turn-lifecycle,session.prompt opencode chat
```

---

## Summary

### Why No Logs

**Most likely**: No chat turns are happening, only TUI state polling

The logs show:
- ✅ TUI is querying session state (works)
- ✅ Storage cache is serving requests (works)
- ❌ No `prompt()` calls (no messages sent)
- ❌ No turn lifecycle execution (no turns)
- ❌ No session memory agent activity (no preparation needed)

### To Verify System Works

1. **Send a message** in opencode chat
2. **Watch logs** with grep filter (ignore storage cache)
3. **Look for**: "turn-lifecycle", "session-memory-agent", "prepareSessionMemory"

If those logs appear after sending a message, the system is working!

If they still don't appear, check:
- Config has `sessionMemory.enabled !== false`
- Using the correct opencode binary (with our changes)
- DEBUG logging enabled to see debug-level messages

### RAM Usage

The 268 MB log file and storage cache hits explain the RAM usage. To reduce:
- Truncate or rotate log file
- Clear storage cache
- Restart opencode

The storage cache itself is bounded at 100 MB and working correctly.
