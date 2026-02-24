# Next Session: Quick Start Guide

## What Was Fixed This Session

✅ **Bootstrap template ID mapping issue resolved**
- Proto schema uses `activity_id` → now maps to OpenCode `id`
- Proto schema uses `task_id` → now maps to task `id`
- All 4 bootstrap templates load correctly
- Local storage fallback working
- Build successful

## Current Status

### ✅ Working
- Bootstrap template loading (4/4 templates)
- Local storage fallback
- Per-task impulse recalculation
- Turn lifecycle hook integration
- Memory agent architecture

### 🔄 Ready for Testing
- Memory agent execution in live session
- Impulse creation via tools
- Full end-to-end workflow

## How to Test (Next Session)

### Option 1: Quick Verification Test

```bash
# 1. Start OpenCode in activity mode
cd repos/metabob-opencode/packages/opencode
./dist/opencode-linux-x64 -m activity

# 2. Send test message
"Fix the authentication bug in auth.ts"

# 3. Check logs for:
# - "executing memory management activity" ✓
# - "memory management completed" ✓
# - Template load messages ✓
# - Impulse creation messages ✓
```

### Option 2: Database Verification

```typescript
// After running a session, check database:

// 1. Memory agent sessions
SELECT * FROM session 
WHERE agent_mode = 'memory' 
ORDER BY created_at DESC LIMIT 5

// 2. Memory activities
SELECT * FROM activity 
WHERE template_id = 'manage-session-memory' 
ORDER BY created_at DESC LIMIT 5

// 3. Impulses created
SELECT * FROM session_memory 
WHERE session_id = '<your_session_id>'
ORDER BY created_at DESC
```

### Option 3: Full Integration Test

```bash
# Run the test script from previous session
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun test-memory-agent-hook.ts

# Expected output:
# ✅ memory-management hook found
# ✅ Template loaded: Manage Session Memory
# ✅ Tasks: 5
```

## What to Look For

### Success Indicators
- [ ] Memory management hook runs (priority 10)
- [ ] manage-session-memory template loads
- [ ] Memory subagent session created
- [ ] 5 tasks execute:
  1. analyze-intent
  2. create-impulses (calls impulse_create)
  3. review-context-space
  4. optimize-if-needed
  5. finalize-context
- [ ] Impulses appear in database
- [ ] Activity execution includes per-task recalculation

### If Issues Occur

**Template not loading:**
```bash
# Check local storage
ls -la ~/.local/share/opencode/storage/activity-template/manage-session-memory.json

# Verify ID
jq -r '.id' ~/.local/share/opencode/storage/activity-template/manage-session-memory.json
# Should output: manage-session-memory
```

**No impulses created:**
```bash
# Check if memory agent has impulse tools
# Look for tool availability in agent definition
grep -A 20 "mode.*memory" repos/metabob-opencode/packages/opencode/src/agent/agent.ts
```

**Hook not running:**
```bash
# Check config
cat ~/.config/opencode/opencode.json | jq '.sessionMemory'
# Should be empty (enabled by default) or { "enabled": true }
```

## Files to Review

### Core Implementation
1. `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts`
   - Lines 71, 121: ID mapping

2. `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`
   - Lines 20-106: Memory management hook

3. `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`
   - Lines 411-439: Per-task recalculation

4. `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`
   - Lines 1069-1169: recalculateForTask()

### Templates
1. `repos/metabob-proto/activities/bootstrap/manage-session-memory.json`
   - Verify activity_id field
   - Verify task_id fields
   - Verify task prompts reference impulse tools

## Expected Workflow

```
User Message: "Fix authentication bug"
    ↓
Turn Lifecycle Hook (priority 10)
    ↓
Load Template: manage-session-memory (from local storage)
    ↓
Create Memory Subagent Session (parentID linked)
    ↓
Execute 5 Tasks:
    1. analyze-intent → classify intent
    2. create-impulses → impulse_create("error-file", ...)
    3. review-context-space → memory_context_view()
    4. optimize-if-needed → compress if needed
    5. finalize-context → summary
    ↓
Impulses Persisted to SessionMemory
    ↓
Main Agent Turn Begins (with prepared context)
```

## Quick Commands

### Rebuild
```bash
cd repos/metabob-opencode/packages/opencode
bun run build
```

### Re-bootstrap Templates
```bash
bun /tmp/test-bootstrap.ts
```

### Check Template
```bash
bun /tmp/test-memory-template.ts
```

### View Logs
```bash
# If using systemd service
journalctl -u opencode -f

# If running directly
# Logs appear in stdout
```

## Success Criteria

When testing is complete, you should see:
- ✅ Memory agent session created (mode: "memory")
- ✅ impulse_create tool called (in session logs)
- ✅ Impulses in database (session_memory table)
- ✅ Per-task recalculation logs (during activity execution)
- ✅ Activity completes successfully

## Troubleshooting

### Issue: Template ID is null
**Cause**: Bootstrap conversion not applied
**Fix**: Run `bun /tmp/test-bootstrap.ts` again

### Issue: Hook not running
**Cause**: Config disabled or agent mode wrong
**Fix**: Check config, ensure agent mode is "primary"

### Issue: No tool calls
**Cause**: Memory agent doesn't have impulse tools
**Fix**: Check agent.ts definition for memory mode tools

### Issue: Database empty
**Cause**: No sessions run yet
**Fix**: Start actual opencode session and send message

## Ready to Go!

Everything is built and verified. Just need to test in a live session. Good luck! 🚀
