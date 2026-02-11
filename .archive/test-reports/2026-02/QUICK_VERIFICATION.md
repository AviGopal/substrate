# Quick Verification - Is Session Memory Agent Working?

## 30-Second Check

```bash
# Look at recent logs
tail -100 ~/.local/share/opencode/log/dev.log | grep -E "session-memory-preparation|impulse loaded|optimized session memory"
```

### Expected Output:

```
[turn-lifecycle] executing hook {hook: "session-memory-preparation", priority: 10}
[session-memory-agent] impulse loaded {impulseId: "errorFile", tokenCount: 1847, budget: 2000}
[turn-lifecycle] executing hook {hook: "session-memory-optimization", priority: 110}
```

### What This Tells You:

| Log Message | Meaning | Status |
|-------------|---------|--------|
| `executing hook...session-memory-preparation` | Hook is registered and triggering | ✅ Working |
| `impulse loaded...tokenCount: 1847` | Impulses being loaded with content | ✅ Working |
| `executing hook...session-memory-optimization` | Post-turn cleanup running | ✅ Working |

**If all three present**: System is working correctly!

---

## 5-Minute Detailed Check

### Step 1: Check Hook Registration

```bash
grep "hook registered" logs | grep -E "session-memory-preparation|session-memory-optimization"
```

**Expected**:
```
"hook registered" {name: "session-memory-preparation", priority: 10}
"hook registered" {name: "session-memory-optimization", priority: 110}
```

✅ **Both registered**: Hooks will execute  
❌ **Missing**: Import issue in turn-lifecycle-hooks.ts

---

### Step 2: Check Function Invocation

```bash
grep "prepareSessionMemory() starting" logs
```

**Expected**: One per turn  
✅ **Found**: Function is being called  
❌ **Not found**: Hook not calling function or export missing

---

### Step 3: Check Budget Awareness

```bash
grep "budget status checked" logs | tail -5
```

**Expected**:
```
"budget status checked" {utilization: "15.2%", usedTokens: 3500, availableTokens: 88500}
```

✅ **Found**: Budget awareness active  
❌ **Not found**: We didn't add the budget check correctly

---

### Step 4: Check Impulse Quality

```bash
# Count empty vs loaded impulses
grep "impulse created" logs | wc -l
grep "impulse loaded.*tokenCount: [1-9]" logs | wc -l
```

**Good**: Loaded count > 0 and close to created count  
**Bad**: All impulses stay empty (tokenCount: 0)

---

### Step 5: Check Cleanup

```bash
grep "optimized session memory for turn" logs | tail -3
```

**Expected**:
```
"optimized session memory for turn" {turn: 13, unloaded: 0, deleted: 0}
"optimized session memory for turn" {turn: 14, unloaded: 1, deleted: 0}
"optimized session memory for turn" {turn: 15, unloaded: 0, deleted: 0}
```

✅ **Runs every turn**: Cleanup is automatic  
❌ **Never runs**: Hook not registered or disabled

---

### Step 6: Check Annotations

```bash
grep "annotated component interactions" logs
```

**Expected**:
```
"annotated component interactions" {sessionID, annotated: 2, turnNumber: 15}
```

✅ **Found**: Component learning active  
❌ **Not found**: Either no impulses loaded or metabob client unavailable

---

### Step 7: Verify in Metabob State

```bash
cat ~/.metabob/state | python -m json.tool | grep -C5 "SESSION MEMORY"
```

**Expected**:
```json
{
  "component_name": "analyzeIntent",
  "file_path": "src/session/memory-agent.ts",
  "reason": "SESSION MEMORY: Loaded 1847 tokens\nPriority: high\nTurn: 15\n..."
}
```

✅ **Found**: Annotations persisted for future use  
❌ **Not found**: Annotations not reaching metabob backend

---

## Complete Log Sequence (What to Look For)

### Every Turn Should Show:

```
1. [turn-lifecycle] executing pre-turn hooks
2. [turn-lifecycle] executing hook {session-memory-preparation}
3. [session.prompt] prepareSessionMemory() starting
4. [session-memory-agent] budget status checked
5. [session-memory-agent] analyzeIntent() completed
6. [session-memory-agent] impulse created (x N)
7. [session-memory-agent] impulse loaded (x M, where M <= N)
8. [session-memory-agent] prepare() completed
9. [turn-lifecycle] hook completed {session-memory-preparation}
10. [turn-lifecycle] pre-turn hooks completed
    [Main agent executes here]
11. [turn-lifecycle] executing post-turn hooks
12. [turn-lifecycle] executing hook {session-memory-optimization}
13. [session-memory-lifecycle] optimized session memory
14. [session-memory-optimization] annotated component interactions
15. [turn-lifecycle] hook completed {session-memory-optimization}
```

---

## Troubleshooting Decision Tree

```
No "session-memory-preparation" logs?
├─> Check hook registration
│   └─> grep "hook registered" logs
│       ├─> Found: Hook registered ✅
│       └─> Not found: Import issue ❌
│
Hook executes but no "prepareSessionMemory"?
├─> Check export and import
│   └─> Is function exported? Is import correct?
│
prepareSessionMemory runs but no impulses loaded?
├─> Check "impulse loaded" logs
│   ├─> Found with tokenCount > 0: Working ✅
│   └─> All tokenCount: 0: Loading issue ❌
│
No "budget status checked" logs?
├─> Check if we added the code correctly
│   └─> Line ~141 in memory-agent.ts
│
No "annotated component interactions"?
├─> Check if impulses were loaded
│   └─> grep "impulse loaded.*tokenCount: [1-9]"
│       ├─> None loaded: Nothing to annotate (expected)
│       └─> Some loaded but no annotations: MCP issue
```

---

## Quick Test Script

```bash
#!/bin/bash
# quick-verify.sh

echo "=== Session Memory Agent Verification ==="
echo ""

# Get log file
LOG="$HOME/.local/share/opencode/log/dev.log"

echo "1. Hook Registration:"
grep -c "hook registered.*session-memory-preparation" "$LOG" && echo "   ✅ Preparation hook registered" || echo "   ❌ Hook not registered"
grep -c "hook registered.*session-memory-optimization" "$LOG" && echo "   ✅ Optimization hook registered" || echo "   ❌ Hook not registered"
echo ""

echo "2. Hook Execution (last 10):"
grep "executing hook.*session-memory" "$LOG" | tail -10 | wc -l
echo "   Recent executions: $?"
echo ""

echo "3. Impulse Loading (last 10):"
grep "impulse loaded.*tokenCount: [1-9]" "$LOG" | tail -10 | wc -l
echo "   Loaded impulses: $?"
echo ""

echo "4. Budget Checks (last 10):"
grep "budget status checked" "$LOG" | tail -10 | wc -l
echo "   Budget checks: $?"
echo ""

echo "5. Annotations (last 10):"
grep "annotated component interactions" "$LOG" | tail -10 | wc -l
echo "   Annotations: $?"
echo ""

echo "6. Cleanup (last 10):"
grep "optimized session memory" "$LOG" | tail -10 | wc -l
echo "   Optimizations: $?"
echo ""

echo "=== Summary ==="
echo "If all counts > 0, system is working!"
```

**Usage**:
```bash
chmod +x quick-verify.sh
./quick-verify.sh
```

---

## Live Monitoring

### Watch in Real-Time

```bash
# Terminal 1: Run opencode
opencode chat --agent activity

# Terminal 2: Watch memory agent
tail -f ~/.local/share/opencode/log/dev.log | grep --line-buffered -E "session-memory-agent|turn-lifecycle.*session-memory"

# You'll see logs streaming as each turn executes
```

### What You'll See Live

```
[turn-lifecycle] executing hook {session-memory-preparation}
[session-memory-agent] budget status checked {utilization: "12.5%"}
[session-memory-agent] analyzeIntent() completed {suggestedImpulses: 2}
[session-memory-agent] impulse loaded {tokenCount: 1523}
[session-memory-agent] prepare() completed {created: 2, loaded: 1}
[turn-lifecycle] hook completed {session-memory-preparation}
...
[turn-lifecycle] executing hook {session-memory-optimization}
[session-memory-optimization] annotated component interactions {annotated: 1}
[turn-lifecycle] hook completed {session-memory-optimization}
```

---

## TUI Indicators

If using the TUI (terminal UI), look for:

### Sidebar: Impulses Section

```
Session Memory (3 impulses, 4.2k tokens)
├─ HIGH (1 loaded)
│  └─ ✓ errorFile [file] 1847/2000 tokens
├─ MEDIUM (1 loaded)
│  └─ ✓ relatedTests [file] 965/1500 tokens
└─ LOW (1 unloaded)
   └─ ○ documentation [file] 0/1000 tokens
```

**Indicators**:
- ✓ = Loaded (green, has content)
- ○ = Unloaded (gray, no content)
- Numbers like `1847/2000` = actual/budget tokens

---

## Summary: Trust But Verify

### The System Tells You It's Working Via:

1. **Hook logs** - "executing hook" messages
2. **Function logs** - "prepareSessionMemory() starting"
3. **Budget logs** - "budget status checked" with utilization
4. **Impulse logs** - "impulse loaded" with tokenCount > 0
5. **Cleanup logs** - "optimized session memory" after turns
6. **Annotation logs** - "annotated component interactions"
7. **Storage** - Annotations in ~/.metabob/state
8. **TUI** - Impulses show ✓ with token counts

### Quick Verification Command

```bash
tail -100 ~/.local/share/opencode/log/dev.log | \
  grep -E "session-memory-preparation|impulse loaded.*tokenCount: [1-9]|optimized session memory" | \
  wc -l
```

**If result > 0**: System is working!  
**If result = 0**: Check hook registration and imports
