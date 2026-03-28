# Debug Logging Setup Complete

**Status**: Ready to observe activity execution

---

## What Was Added

### 1. metabob-cli MCP Tools (Python)
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

**Added to `get_activity_template_tool` (line ~3616)**:
```python
# DEBUG: Log that this tool was called
logger.critical(f"!!! GET_ACTIVITY_TEMPLATE_TOOL CALLED !!! activity_id={activity_id}")
print(f"!!! GET_ACTIVITY_TEMPLATE_TOOL CALLED !!! activity_id={activity_id}", file=sys.stderr, flush=True)
```

**Added to `create_activity_template_tool` (line ~4224)**:
```python
# DEBUG: Log that this tool was called  
logger.critical(f"!!! CREATE_ACTIVITY_TEMPLATE_TOOL CALLED !!! name={name}, category={category}")
print(f"!!! CREATE_ACTIVITY_TEMPLATE_TOOL CALLED !!! name={name}, category={category}", file=sys.stderr, flush=True)
```

### 2. OpenCode (TypeScript)
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

**Added to `getActivityTemplate` (line ~937)**:
```typescript
// DEBUG: Log the MCP call
console.error(`!!! OPENCODE: Calling MCP tool "get_activity_template" for activity_id="${activityId}" !!!`)

// ... after callMCPTool ...
console.error(`!!! OPENCODE: MCP tool returned:`, JSON.stringify(result).substring(0, 200))
```

**Added to `createActivityTemplate` (line ~1101)**:
```typescript
// DEBUG: Log the MCP call
console.error(`!!! OPENCODE: Calling MCP tool "create_activity_template" for template="${template.name}" !!!`)
console.error(`!!! OPENCODE: STACK TRACE:`, new Error().stack)
```

---

## How to Observe

### Current Session Status
- OpenCode is running via: `bun run dev ../..` (PID 781876)
- MCP server is running: `metabob-cli mcp --transport stdio` (PID 781958)

### Problem
The running processes have OLD code loaded in memory. The debug logs won't appear until:
1. **OpenCode restarts** (to load new TypeScript)
2. **MCP server restarts** (to reload Python modules)

### Solution: Restart Required

Since OpenCode spawns the MCP server, restarting OpenCode will restart both.

**To restart:**
1. Stop current OpenCode session (Ctrl+C in the terminal running `bun run dev`)
2. Restart: `cd repos/metabob-opencode && bun run dev ../..`
3. Start new OpenCode session
4. Run activity test

---

## Test Procedure (After Restart)

### Step 1: Trigger Activity Execution
```javascript
activity({
  activityId: "infrastructure-51aee5c8",
  variables: {name: "Debug Test"},
  reason: "Observing MCP tool calls with debug logging"
})
```

### Step 2: Watch Terminal Output

The terminal running `bun run dev` will show one of two patterns:

**Pattern A: get_activity_template is called (EXPECTED)**
```
!!! OPENCODE: Calling MCP tool "get_activity_template" for activity_id="infrastructure-51aee5c8" !!!
!!! GET_ACTIVITY_TEMPLATE_TOOL CALLED !!! activity_id=infrastructure-51aee5c8
!!! OPENCODE: MCP tool returned: {"status":"success","template":{...
```

**Pattern B: create_activity_template is called (CURRENT BUG)**
```
!!! OPENCODE: Calling MCP tool "create_activity_template" for template="..." !!!
!!! OPENCODE: STACK TRACE: Error
    at createActivityTemplate (...)
    at ...
!!! CREATE_ACTIVITY_TEMPLATE_TOOL CALLED !!! name=..., category=...
```

---

## What We'll Learn

### If Pattern A Appears
- ✅ `get_activity_template` IS being called
- ✅ Tool exists and is registered
- ❓ Why does it fail? Need to look at what the tool returns

### If Pattern B Appears  
- ❌ `create_activity_template` is being called instead
- ❓ Why? Stack trace will show the call path
- ❓ Is get_activity_template not registered?
- ❓ Is there a tool name mismatch?

### If Neither Pattern Appears
- ❌ Debug logs aren't working
- ❓ Code not reloaded?
- ❓ Output going elsewhere?

---

## Alternative: Direct Python Test

If restart isn't possible, we can test the MCP tool directly:

```bash
cd repos/metabob-cli

# Test that the debug logging works
python3 << 'EOF'
import sys
sys.path.insert(0, 'src')

from metabob_cli.mcp.tools import get_activity_template_tool
import asyncio

async def test():
    print("=== Testing get_activity_template_tool with debug logging ===")
    result = await get_activity_template_tool('infrastructure-51aee5c8')
    print("=== Result ===")
    print(result[:500])

asyncio.run(test())
EOF
```

**Expected output**:
```
!!! GET_ACTIVITY_TEMPLATE_TOOL CALLED !!! activity_id=infrastructure-51aee5c8
=== Testing get_activity_template_tool with debug logging ===
=== Result ===
{"status":"success","template":{...
```

This confirms:
1. Debug logging code is in place
2. Tool function works
3. Returns correct data

But it doesn't tell us if OpenCode is calling it correctly.

---

## Next Steps

1. **Restart OpenCode** to load debug logging
2. **Run activity test** as shown above
3. **Observe output** to see which tool is called
4. **Analyze results**:
   - If get_activity_template → debug why it fails
   - If create_activity_template → debug why wrong tool is called

---

## Files Modified

- `repos/metabob-cli/src/metabob_cli/mcp/tools.py` (added debug logging)
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` (added debug logging)

**Changes are NOT committed** - these are temporary debug additions.

---

**Status**: 🟡 READY TO OBSERVE (requires OpenCode restart)
