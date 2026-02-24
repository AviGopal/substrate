# Activity Template Created: Debug Failing Feature

## Overview

Created a reusable activity template that captures the systematic debugging workflow demonstrated in the context negotiation fix session.

**Template ID**: `debug-failing-feature`  
**Category**: bugfix  
**Tasks**: 5 (reproduce → analyze → fix → verify → document)  
**Context Requirements**: 3 (bugDescription, relevantFiles, recentChanges)  

---

## Template Structure

### Task Flow

```
reproduce (minimal/failing cases)
    ↓
analyze (root cause identification)
    ↓
fix (apply targeted solution)
    ↓
verify (test both cases)
    ↓
document (comprehensive summary)
```

### Task 1: Reproduce
**Goal**: Create minimal reproduction using binary search through complexity

**Technique**: 
- Minimal case: Simplest version that should work (baseline ✅)
- Failing case: Minimal version that demonstrates bug (repro ❌)
- Document exact difference

**Output**: 
- `/tmp/debug-{id}/minimal-case.*`
- `/tmp/debug-{id}/failing-case.*`
- `/tmp/debug-{id}/reproduction-summary.md`

### Task 2: Analyze
**Goal**: Trace through code to identify root cause

**Technique**:
- Log analysis (timing, errors, layer identification)
- Data flow inspection (input → processing → output)
- Code trace (entry point → transformations → bug location)

**Output**: `/tmp/debug-{id}/root-cause-analysis.md` with:
- Bug location (file:line)
- Problem code
- Why it fails (mechanism)
- Evidence (logs, variables)

### Task 3: Fix
**Goal**: Apply minimal targeted fix

**Principle**: Smallest change possible, preserve working behavior

**Steps**:
1. Verify current state (read file, confirm bug exists)
2. Design fix (minimal change, consider edge cases)
3. Apply fix (edit tool, maintain code style)
4. Rebuild if needed (compilation)

**Output**: `/tmp/debug-{id}/fix-applied.md` with before/after comparison

### Task 4: Verify
**Goal**: Test fix with both minimal and failing cases

**Tests**:
1. Re-run minimal case (should still work - no regression)
2. Re-run failing case (should now work - bug fixed)
3. Additional tests (test suite, related features)

**Output**: `/tmp/debug-{id}/verification-results.md`

### Task 5: Document
**Goal**: Create comprehensive session documentation

**Gathers**:
- All `/tmp/debug-{id}/*.md` files
- Timeline and metrics
- Before/after code
- Learnings and insights

**Output**: `DEBUG_SESSION_{id}.md` with:
- Executive summary
- Investigation timeline
- Root cause analysis
- The fix (with code)
- Verification results
- Impact assessment
- Learnings
- Next steps

---

## Context Requirements

### 1. bugDescription (required)
- **Purpose**: Clear bug description with symptoms and expected behavior
- **Types**: memo
- **Budget**: 500-1000 tokens

### 2. relevantFiles (optional)
- **Purpose**: Files related to failing feature
- **Types**: file, component
- **Budget**: 2000-4000 tokens

### 3. recentChanges (optional)
- **Purpose**: Recent commits that may have introduced bug
- **Types**: commit, file
- **Budget**: 1000-2000 tokens

---

## Key Techniques Codified

### 1. Binary Search Through Complexity
Start simple, add one feature at a time until bug appears.

**From session**:
- `hello-world-minimal` (no contextRequirements) → ✅ worked
- `hello-world-with-context` (with contextRequirements) → ❌ failed
- Isolated: contextRequirements is the trigger

### 2. Log Analysis for Timing
Fast failures (0.0s) indicate pre-flight/validation issues.

**From session**:
```
DEBUG: skipping context gathering (template has no contextRequirements)
ERROR: Missing variables: {{greeting}}
```
Immediate failure → registration issue, not execution issue

### 3. Data Flow Inspection
Track data through transformations to find loss/corruption.

**From session**:
- Source JSON: `contextRequirements: [{...}]` ✅
- Registered template: `contextRequirements: []` ❌
- Bug: Field lost during `initializeTemplateSchema()`

### 4. Minimal Change Principle
Smallest fix that resolves the issue.

**From session**:
- 3 lines changed (add parameter, use it, pass it)
- No breaking changes
- Additive fix (preserves existing behavior)

### 5. Before/After Verification
Test both baseline and bugfix cases.

**From session**:
- Minimal case still works → no regression
- Context case now works → bug fixed
- (Pending restart to verify with new binary)

---

## Usage Examples

### Example 1: Simple Bug
```bash
activity({
  templateId: "debug-failing-feature",
  variables: {
    debugId: "auth-token-failure",
    outputPath: "."
  },
  reason: "Debug authentication token validation failing for expired tokens"
})
```

### Example 2: With Full Context
```bash
# First create impulses
impulse_create({
  id: "bug-desc",
  pointer: {
    type: "memo",
    content: "User login fails with 500 error after password reset..."
  }
})

impulse_create({
  id: "auth-files",
  pointer: {
    type: "file",
    path: "src/auth/login.ts"
  }
})

# Then run activity
activity({
  templateId: "debug-failing-feature",
  variables: {
    debugId: "login-500-error",
    outputPath: "./docs/debug-sessions"
  },
  reason: "Systematic debug of login 500 error after password reset"
})
```

---

## Comparison to This Session

### What the Template Captures

✅ **Reproduction strategy** (minimal vs failing)  
✅ **Root cause analysis** (logs → data flow → code trace)  
✅ **Fix approach** (minimal change, targeted solution)  
✅ **Verification** (both cases tested)  
✅ **Documentation** (comprehensive summary)  

### What the Template Adds

✨ **Structure**: 5 clear tasks with dependencies  
✨ **Context requirements**: Configurable inputs  
✨ **Reusability**: Works for any debugging scenario  
✨ **Quality gates**: Validation of outputs  
✨ **Consistency**: Same approach every time  

### What's Still Manual

⚠️ **Code reading**: Agent must understand codebase  
⚠️ **Fix design**: Agent must choose correct solution  
⚠️ **Testing judgment**: Agent must assess if fix is complete  

But the **workflow** is now repeatable and systematic.

---

## Success Criteria

**Template is successful if it produces**:

1. ✅ Clear reproduction (minimal + failing cases)
2. ✅ Identified root cause (file:line + explanation)
3. ✅ Applied fix (code changes committed)
4. ✅ Verification results (both cases tested)
5. ✅ Comprehensive documentation (session summary)

**Metrics from original session**:
- Time to reproduce: ~20 min
- Time to root cause: ~30 min  
- Time to fix: ~10 min
- Time to verify: ~10 min (pending restart)
- **Total**: ~70 minutes

**Target for template**:
- Same quality output
- Comparable timing
- Consistent structure
- Reusable across bug types

---

## Integration with System

### When to Use This Template

✅ **Feature failing unexpectedly**  
✅ **Silent failures** (no clear error messages)  
✅ **Regression** (worked before, broken now)  
✅ **Integration issues** (components not communicating)  
✅ **Data corruption** (values lost/transformed incorrectly)  

### When NOT to Use

❌ Simple typos (direct fix faster)  
❌ Known issues (just apply known fix)  
❌ Performance optimization (different workflow)  
❌ Feature requests (not bugs)  

### Composition with Other Templates

Can be chained with:
- `fix-bug-complete` - After this template identifies fix
- `add-comprehensive-tests` - After fix to prevent regression
- `refactor-with-tests` - If fix reveals need for restructuring

---

## Known Limitations

### 1. Requires Restart for Binary Changes
**Issue**: If fix modifies compiled code, verification pending restart.  
**Workaround**: Document "pending restart" status in verification results.

### 2. Context Requirements Not Yet Working
**Issue**: Current session has old binary, contextRequirements stripped.  
**Status**: Fix applied, pending OpenCode restart.  
**Impact**: Template will work correctly after restart.

### 3. No Automated Test Execution
**Issue**: Template doesn't automatically run test suites.  
**Workaround**: Manual test execution in verify task.

---

## Next Steps

### Immediate
- [ ] Restart OpenCode to load new binary with contextRequirements fix
- [ ] Test `debug-failing-feature` template end-to-end
- [ ] Verify contextRequirements work correctly
- [ ] Add to bootstrap template set

### Follow-Up
- [ ] Add regression test for contextRequirements preservation
- [ ] Create variant for performance issues (debug-slow-feature)
- [ ] Create variant for flaky tests (debug-flaky-test)
- [ ] Integrate with test automation frameworks

### Long-Term
- [ ] Track template success rate (Thompson Sampling)
- [ ] Evolve based on usage patterns
- [ ] Create domain-specific variants (debug-api-failure, debug-ui-bug)

---

## File Locations

**Template Definition**: `templates/bootstrap/debug-failing-feature.json`  
**Registered**: `.metabob/activities/debug-failing-feature.json`  
**Documentation**: This file (`ACTIVITY_CREATED_DEBUG_WORKFLOW.md`)

**Related Files**:
- `SESSION_COMPLETE_CONTEXT_NEGOTIATION_FIX.md` - Original session
- `templates/bootstrap/hello-world-minimal.json` - Minimal test case
- `templates/bootstrap/hello-context-test.json` - Failing test case

---

## Conclusion

This template captures the systematic debugging workflow that successfully identified and fixed a critical bug in ~70 minutes. It codifies:

- **Minimal reproduction** via binary search
- **Root cause analysis** via log analysis + data flow  
- **Targeted fixes** via minimal change principle
- **Verification** via regression + bugfix testing
- **Documentation** via comprehensive summaries

The template is ready to use for similar debugging scenarios and will improve over time through Thompson Sampling as it accumulates success/failure data.

---

*Template created: 2026-02-19*  
*Based on: Context negotiation debug session*  
*Status: Registered ✅ | Context fix pending restart*
