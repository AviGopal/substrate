# TUI Sidebar Test Plan

**Objective**: Verify impulses are now visible in TUI sidebar after our fix

---

## Quick Test (5 minutes)

```bash
# 1. Start OpenCode in TUI mode
cd repos/metabob-opencode
bun run dev

# 2. Send a simple message that triggers lifecycle hook
> "What files are in the current directory?"

# 3. Check TUI sidebar (right side of screen)
# Look for "Memory" section
# Should show impulse count and budget utilization

# 4. Expected Result:
✅ Impulses visible (count > 0)
✅ Budget tracking displayed
✅ Loading status shown

# 5. If impulses shown = SUCCESS! 
# If still 0 impulses = investigate further
```

---

## Detailed Test (15 minutes)

```bash
# Test 1: Lifecycle Hook Impulses
cd repos/metabob-opencode && bun run dev
> "Fix the bug in turn-lifecycle-hooks.ts"

# Check sidebar for:
- file:turn-lifecycle-hooks.ts impulse
- metabob impulses (if any)
- Budget utilization percentage

# Test 2: Manual Impulse Creation
> impulse_create({ 
    id: "test-impulse", 
    pointer: { type: "memo", content: "test" }, 
    budget: 1000,
    priority: "high"
  })

# Check sidebar for:
- test-impulse appears immediately
- Budget increases by 1000 tokens

# Test 3: Impulse Loading
> impulse_load({ id: "test-impulse" })

# Check sidebar for:
- test-impulse marked as "loaded"
- Token count updated
- Budget utilization changes

# Test 4: Activity Execution
> activity({
    templateId: "add-feature-complete",
    variables: { featureName: "test", files: ["test.ts"] },
    reason: "Test impulses"
  })

# Check sidebar during/after execution:
- Impulses created by activity appear
- Budget tracking works
- Impulses persist after activity completes
```

---

## What to Look For

**SUCCESS Indicators** ✅:
- Impulse count > 0
- Individual impulses listed with IDs
- Budget utilization percentage displayed
- Loading status (loaded/unloaded) shown
- Real-time updates as impulses created/loaded

**FAILURE Indicators** ❌:
- Impulse count = 0 (still broken)
- Empty impulse list
- No budget information
- Sidebar shows "No impulses"

---

## If Still Broken

**Check 1**: Verify our changes are compiled
```bash
cd repos/metabob-opencode
git log -1 --oneline  # Should show: d9460903
git diff HEAD packages/opencode/src/tool/impulse-create.ts  # Should be empty
```

**Check 2**: Check if SessionMemory has impulses
```typescript
// In REPL or debug
const { SessionMemory } = await import("./src/session/session-memory")
const impulses = await SessionMemory.listImpulses(sessionID)
console.log("Impulses in SessionMemory:", impulses)
```

**Check 3**: Check TUI is querying correctly
```bash
# Check server logs for session_memory endpoint calls
# Should see GET /session/{id}/state requests
```

---

## Expected Output

**TUI Sidebar Memory Section**:
```
┌─ Memory ────────────────────────┐
│ ▶ 3 impulses • 45% used         │
│   12,450/50,000 tokens           │
│                                  │
│ ● file:auth.ts                   │
│   5,000/5,000 tokens (high)      │
│                                  │
│ ○ metabob:priority               │
│   0/3,000 tokens (medium)        │
│                                  │
│ ● bash:test-results              │
│   2,450/5,000 tokens (low)       │
└──────────────────────────────────┘
```

---

## Next Action

**Run the Quick Test now** - just 5 minutes to verify!

If it works:
✅ Celebrate! Fix is complete!
✅ Document success
✅ Move to cache pattern (optional optimization)

If it doesn't work:
⚠️ Debug: Check SessionMemory has impulses
⚠️ Check: TUI query path
⚠️ Verify: Compilation succeeded
