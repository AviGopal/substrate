# CRITICAL BUG: Missing Memory Tools

## Severity: 🔴 **BLOCKER**

## Date: 2026-02-20

## Summary

The `manage-session-memory` activity template references **3 tools that don't exist**, which will cause the memory management hook to fail when it tries to execute.

---

## Problem

### Template Expects (from `manage-session-memory.json`)

```
impulse_create          ✅ EXISTS
impulse_load            ✅ EXISTS  
memory_budget           ✅ EXISTS
memory_context_view     ❌ MISSING
memory_compress         ❌ MISSING
memory_reorder          ❌ MISSING
```

### Tools Actually Available (from `packages/opencode/src/tool/`)

```
impulse_create.ts       ✅
impulse_load.ts         ✅
impulse_unload.ts       ✅
impulse_delete.ts       ✅
impulse_list.ts         ✅
impulse_update.ts       ✅
memory_budget.ts        ✅
memory_outline.ts       ✅ (might be alias for memory_context_view?)
memory_optimize.ts      ✅
memory_health.ts        ✅
```

### Memory Agent Definition (from `agent.ts` lines 512-540)

```typescript
tools: {
  // Impulse management
  impulse_create: true,      ✅
  impulse_list: true,        ✅
  impulse_load: true,        ✅
  impulse_unload: true,      ✅
  impulse_delete: true,      ✅
  impulse_update: true,      ✅
  // Context management
  memory_outline: true,      ✅ (not memory_context_view!)
  memory_budget: true,       ✅
  memory_optimize: true,     ✅ (not memory_compress!)
  // Negotiation
  negotiate_context: true,   ✅
  activity_reason: true,     ✅
  // Standard tools
  bash: true,
  read: true,
  grep: true,
  glob: true,
  list: true,
  // Metabob tools
  ...metabob tools
}
```

---

## Impact

### Immediate

1. **Task 3 will fail**: `review-context-space` task calls `memory_context_view`
   - Error: "Tool not found: memory_context_view"
   - Activity execution halts

2. **Task 4 will fail**: `optimize-if-needed` task calls `memory_compress` and `memory_reorder`
   - Error: "Tool not found: memory_compress"
   - Activity execution halts

3. **Memory management hook fails**: Pre-turn hook cannot complete
   - Session continues WITHOUT prepared context
   - Agent operates without impulse-based context
   - Defeats the purpose of the entire memory system

### Cascading

- No context preparation before agent turns
- Impulse system is non-functional  
- Memory optimization doesn't work
- The entire session memory architecture is broken

---

## Root Cause

**Tool naming mismatch** between:
1. Template author's expectations (what tools should be called)
2. Actual implementation (what tools exist)

Likely causes:
- Template was written before tools were implemented
- Tools were renamed during implementation
- Template and tools developed by different people/times
- Missing communication about naming conventions

---

## Evidence from Live Testing

### Test 1.1: Hook Registration ✅ PASS
- 5 hooks registered correctly
- `memory-management` hook exists at priority 10

### Test 1.2: Hook Enabled ⏸️ SKIPPED
- Would need instance context (config loading issue)
- Not critical - hook is clearly enabled by default

### Test 1.3: Hook Execution ❌ WOULD FAIL
- Hook would execute `manage-session-memory` activity
- Activity Task 3 would call `memory_context_view` → **TOOL NOT FOUND**
- Activity would fail
- Hook would report failure (but non-fatal)

### Test 2: Memory Agent Tools ⚠️ PARTIAL
- ✅ Memory agent exists
- ✅ Most tools available
- ❌ 3 tools referenced by template are missing

---

## Possible Solutions

### Option 1: Create Missing Tools (CORRECT but time-consuming)

**Create 3 new tools**:

1. **`memory_context_view`**
   - Alias or replacement for `memory_outline`?
   - Returns: List of impulses with metadata
   - Parameters: `{ includeDetails?: boolean }`

2. **`memory_compress`**
   - Compress impulse content to reduce tokens
   - Parameters: `{ impulseId: string, strategy: string, targetTokens: number }`
   - Strategies: "extract-key-sections", "summarize", "filter"

3. **`memory_reorder`**
   - Change impulse priorities
   - Parameters: `{ reordering: Array<{ impulseId: string, newPriority: string, reason: string }> }`

**Pros**:
- Implements intended functionality
- Template works as designed

**Cons**:
- Takes time to implement
- Need to design compression strategies
- Need to implement priority reordering logic

### Option 2: Update Template to Use Existing Tools (QUICK FIX)

**Changes to `manage-session-memory.json`**:

```diff
Task 3: review-context-space
- memory_context_view
+ memory_outline  // Use existing tool

Task 4: optimize-if-needed
- memory_compress({ ... })
+ memory_optimize()  // Use existing tool for suggestions
- memory_reorder({ ... })
+ impulse_update({ id, priority: "low" })  // Update priorities individually
```

**Pros**:
- Works immediately
- Uses existing tools
- No new code needed

**Cons**:
- `memory_optimize` may not do what `memory_compress` was meant to do
- Need multiple `impulse_update` calls instead of batch `memory_reorder`
- Template behavior changes from original intent

### Option 3: Disable Memory Management Hook (NUCLEAR OPTION)

**Config change**:
```json
{
  "sessionMemory": {
    "enabled": false
  }
}
```

**Pros**:
- System works immediately
- No hook failures

**Cons**:
- **Defeats entire purpose of memory system**
- No automatic context preparation
- Impulse system remains non-functional
- Wasted implementation effort

---

## Recommended Solution

**Two-phase approach**:

### Phase 1: Quick Fix (15 minutes)

1. **Update `manage-session-memory.json` template**:
   - Replace `memory_context_view` → `memory_outline`
   - Replace `memory_compress` → `memory_optimize` + manual impulse_unload
   - Replace `memory_reorder` → individual `impulse_update` calls

2. **Update task prompts** to match new tool names

3. **Test execution** to verify it works

### Phase 2: Proper Implementation (2-4 hours, later)

4. **Create `memory_context_view` tool**:
   ```typescript
   // Alias or enhanced version of memory_outline
   // Add includeDetails parameter
   ```

5. **Create `memory_compress` tool**:
   ```typescript
   // Implement compression strategies
   // Strategies: extract-key-sections, summarize, filter
   ```

6. **Create `memory_reorder` tool**:
   ```typescript
   // Batch priority updates
   // More efficient than individual impulse_update calls
   ```

7. **Update template back to original design**

---

## Testing Plan (After Fix)

### Test 1: Hook Execution
```bash
# Start session
# Send message: "Fix bug in auth.ts"
# Check logs:
#   - "executing memory management activity"
#   - No "tool not found" errors
#   - "memory management completed"
```

### Test 2: Tool Calls Work
```bash
# Verify in logs:
#   - memory_outline called successfully
#   - memory_optimize called successfully
#   - impulse_update called successfully
```

### Test 3: Context Prepared
```bash
# Check session impulses after hook
# Should have impulses created by activity
# Verify impulses transferred to parent session
```

---

## Files to Modify (Phase 1)

### Template
```
repos/metabob-proto/activities/bootstrap/manage-session-memory.json
```

**Changes**:
- Task 3 (line ~84): `memory_context_view` → `memory_outline`
- Task 4 (line ~107): Update compression logic to use `memory_optimize` + `impulse_unload`
- Task 4 (line ~107): Update reordering logic to use `impulse_update`

### Verify No Other References
```bash
# Check if any other templates use these tools
grep -r "memory_context_view\|memory_compress\|memory_reorder" \
  repos/metabob-proto/activities/ \
  repos/metabob-cli/.venv/lib/python3.13/site-packages/activities/
```

---

## Related Issues

### Issue 1: Tool Naming Inconsistency

**Problem**: Different naming conventions across the codebase
- Some tools: `impulse_create` (snake_case)
- Some tools: `memory-outline` in files, `memory_outline` in code

**Solution**: Standardize on snake_case for tool names

### Issue 2: Template Validation

**Problem**: No validation that template tools exist before execution

**Solution**: Add pre-flight check:
```typescript
// Before executing activity
for (const task of template.tasks) {
  for (const toolName of extractToolsFromPrompt(task.prompt)) {
    if (!agentHasTool(task.subagent, toolName)) {
      throw new Error(`Task "${task.id}" references missing tool: ${toolName}`)
    }
  }
}
```

### Issue 3: Documentation Mismatch

**Problem**: Template docs describe tools that don't exist

**Solution**: 
- Update template task prompts to match actual tools
- Document all available memory/impulse tools
- Keep tool reference up to date

---

## Next Steps

### Immediate (Block 1: 15 minutes)

1. ✅ Document this bug (this file)
2. ⬜ Apply Phase 1 quick fix
3. ⬜ Test hook execution
4. ⬜ Verify no errors

### Short-term (Block 2: 30 minutes)

5. ⬜ Add template validation
6. ⬜ Document available tools
7. ⬜ Check for other template/tool mismatches

### Long-term (Block 3: 2-4 hours)

8. ⬜ Implement missing tools properly
9. ⬜ Update template back to original design
10. ⬜ Add comprehensive tests

---

## Conclusion

The memory system architecture is **sound**, but the template references **non-existent tools**. This is a **critical blocker** that must be fixed before the memory management hook can work.

**The quick fix (Phase 1) will unblock testing immediately.**

After that, we can properly implement the missing tools (Phase 2) to match the original design intent.

---

## Status

- **Discovered**: 2026-02-20 during live testing
- **Severity**: 🔴 Blocker
- **Fix Status**: ⏳ Pending
- **Estimated Fix Time**: 15 minutes (Phase 1), 2-4 hours (Phase 2)
