# Post-Restart Status: Fix Not Yet Loaded

## Current Situation

After restarting OpenCode, we tested both template types:

### ✅ Templates WITHOUT contextRequirements: **WORKING**
```
Template: hello-world-minimal
Status: Completed ✅
Duration: 54.8s
Cost: $0.0943
Output: /tmp/hello-post-restart-test.txt created successfully
```

### ❌ Templates WITH contextRequirements: **STILL BROKEN**
```
Template: debug-failing-feature
contextRequirements in source: 3 (bugDescription, relevantFiles, recentChanges)
contextRequirements in registered: 0 (EMPTY!)
Status: Bug still present
```

---

## Root Cause: Fix Not Loaded

### The Problem

**OpenCode is running from a pre-built binary that doesn't include our fix.**

Evidence:
1. ✅ Source code HAS the fix:
   ```typescript
   // Line 933 in activity-template.ts
   contextRequirements: options.contextRequirements || [],  // ← FIXED!
   ```

2. ✅ Binary was rebuilt (timestamp: Feb 19 15:47)

3. ❌ Running OpenCode doesn't have the fix:
   ```bash
   $ which opencode
   /home/avi/.local/bin/opencode  # ← Global install, not local build
   ```

4. ❌ Templates still have empty contextRequirements after registration

### The Issue

The OpenCode session is using `/home/avi/.local/bin/opencode` (global install), not the locally built binary in `repos/metabob-opencode/packages/opencode/dist/`.

---

## Solution Options

### Option 1: Install Local Build (Recommended)
Replace global install with our fixed local build:

```bash
cd repos/metabob-opencode/packages/opencode
bun run build  # Ensure latest
bun link       # Or: npm link

# Verify
which opencode  # Should still be /home/avi/.local/bin/opencode
opencode --version  # Check if updated
```

### Option 2: Use Local Build Directly
Point to the local build explicitly:

```bash
cd repos/metabob-opencode/packages/opencode
./dist/opencode-linux-x64/opencode [command]

# Or add to PATH temporarily
export PATH="$(pwd)/dist/opencode-linux-x64:$PATH"
```

### Option 3: Run from Development Mode
Use the TypeScript source directly:

```bash
cd repos/metabob-opencode/packages/opencode
bun run dev  # Or equivalent dev command
```

###  Option 4: Modify Global Install
Copy the fixed binary to global install location:

```bash
cd repos/metabob-opencode/packages/opencode
cp dist/opencode-linux-x64/opencode /home/avi/.local/bin/opencode
```

---

## Verification Steps

After applying solution, verify the fix:

### Step 1: Check Binary Has Fix
```bash
# The fix changes template registration behavior
# We can verify by registering a template with contextRequirements
# and checking if they're preserved
```

### Step 2: Re-register Template
```bash
# Remove old registration
rm .metabob/activities/debug-failing-feature.json

# Register with fixed binary
register_activity_template({
  file_path: "templates/bootstrap/debug-failing-feature.json",
  register_with_metabob: true
})
```

### Step 3: Verify contextRequirements Preserved
```bash
cat .metabob/activities/debug-failing-feature.json | jq '.contextRequirements | length'
# Expected: 3 (not 0!)

cat .metabob/activities/debug-failing-feature.json | jq '.contextRequirements[0].key'
# Expected: "bugDescription"
```

### Step 4: Test Execution
```bash
activity({
  templateId: "debug-failing-feature",
  variables: {debugId: "test", outputPath: "."},
  reason: "Test with fixed binary"
})

# Expected behavior:
# - Pre-flight: "Context: Gathering (3 requirements)"
# - Task 1 executes with context variables
# - Duration > 30s (actual work, not 0.1s failure)
```

---

## Why This Matters

### Impact of Unfixed Binary

**Affected**: ALL templates with contextRequirements
- debug-failing-feature (our new template)
- create-activity-template (bootstrap)
- 15-20 OpenCode built-in templates
- Any custom templates using context

**Symptom**: Templates fail immediately (0.1s) with:
```
ERROR: Missing variables in template: {{variableName}}
Provided variables: [only user-provided, no context]
```

**Root Cause**: contextRequirements stripped → context never gathered → variables missing

### What Works Now

**Unaffected**: Templates WITHOUT contextRequirements
- hello-world-minimal ✅
- Any simple templates with only user variables
- Basic workflows

---

## Testing Matrix

| Template Type | Source | Registered | Execution | Status |
|--------------|---------|------------|-----------|--------|
| No context requirements | ✅ | ✅ | ✅ 54.8s | **WORKING** |
| With context requirements | ✅ | ❌ Empty | ❌ 0.1s fail | **BROKEN** |

---

## Next Actions

**Immediate** (choose one solution above):
1. Identify which OpenCode binary is being used
2. Apply one of the 4 solution options
3. Restart OpenCode session if needed
4. Re-register debug-failing-feature template
5. Verify contextRequirements preserved (length = 3)
6. Test execution (should gather context and run tasks)

**Validation**:
- Simple template (no context): Already working ✅
- Complex template (with context): Pending fix load

---

## Files Status

### Source Code
- ✅ Fixed: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts:933`
- ✅ Committed: Commit `c49d369b`
- ✅ Rebuilt: Binary timestamp Feb 19 15:47

### Running Binary
- ❌ Not loaded: Using `/home/avi/.local/bin/opencode`
- ❌ Has old code: contextRequirements = [] hardcoded
- ⏳ Needs update: Apply one of 4 solutions above

### Templates
- ✅ Source correct: All templates have proper contextRequirements
- ❌ Registration broken: contextRequirements stripped to []
- ⏳ Pending re-registration: After binary update

---

## Summary

**Current State**:
- Basic activities work (hello-world-minimal executed successfully)
- Context-aware activities broken (contextRequirements still stripped)
- Fix exists in source but not loaded in running binary

**Root Issue**:
- Global OpenCode install (`/home/avi/.local/bin/opencode`) doesn't have fix
- Local build has fix but isn't being used

**Resolution**:
- Update running binary to use local build with fix
- Re-register templates
- Verify contextRequirements preserved
- Test end-to-end execution

**Expected After Fix**:
- All templates work (with and without context)
- Context gathering triggers correctly
- debug-failing-feature template executes all 5 tasks
- Bootstrap workflow unblocked

---

*Status check: 2026-02-20*  
*Basic activities: ✅ Working*  
*Context activities: ❌ Pending binary update*  
*Next: Apply solution to load fixed binary*
