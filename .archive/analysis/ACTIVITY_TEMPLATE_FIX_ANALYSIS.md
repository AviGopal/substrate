# Activity Template Fix Analysis

**Template**: organize-documentation-and-create-codebase-state-snapshot  
**Date**: 2026-02-17  
**Status**: Identified root causes

---

## Issues Identified

### 1. **Schema Confusion** - CRITICAL
**Problem**: Template has both `task_steps` (correct) and `tasks` (legacy) fields
- `task_steps`: 4 items (correct)
- `tasks`: Duplicate array causing validation errors

**Impact**: Template registration/validation fails  
**Fix**: Remove `tasks` array, keep only `task_steps`

### 2. **Validation Command Format** - MEDIUM
**Problem**: Validation commands use wrong format
```json
"commands": [
  {
    "command": "test -d .archive && test -f .archive/README.md",
    "expected_exit_code": 0
  }
]
```

**Expected Format** (based on schema):
```json
"commands": [
  {
    "name": "check-archive-exists",
    "command": "test -d .archive && test -f .archive/README.md",
    "required": true
  }
]
```

**Impact**: Validation might fail or skip  
**Fix**: Update command format to match schema

### 3. **Handlebars Variable Defaults** - LOW
**Problem**: Template uses `{{#if target_directory}}` but doesn't provide default

**Current**:
```handlebars
{{#if target_directory}}
**Target Directory**: {{target_directory}}
{{else}}
**Target Directory**: Repository root (.)
{{/if}}
```

**Issue**: When `target_directory` is not provided, should default to `.`

**Fix**: Use direct interpolation with default:
```handlebars
**Target Directory**: {{target_directory}} (or repository root if empty)
```

Or fix in prompt to use `.` in find commands

### 4. **Missing Date Variable** - LOW
**Problem**: Template references `{{date}}` variable but doesn't declare it

**Occurrences**:
- Task 1: `**Date**: {{date}}`
- Task 4: `**Last Updated**: {{date}}`

**Fix**: Either:
- Add `date` as a variable (auto-generated)
- Use literal current date instruction: "Use today's date (2026-02-17)"

### 5. **Context Rules vs Schema Alignment** - LOW
**Problem**: Uses `context_rules` (local format) but schema expects different structure

**Current**:
```json
"context_rules": {
  "max_tokens": 8000,
  "compression_strategy": "filter"
}
```

**May need**: `prompt.maxTokens` and `prompt.compressionStrategy` at top level

### 6. **Estimated vs Actual Metrics** - COSMETIC
**Problem**: Template has both metric types

**Current**:
```json
"estimated_metrics": {
  "execution_count": 0,
  "success_rate": 0
}
```

**Note**: This is fine, just initialization

---

## Root Cause Analysis

### Why Did Template Fail?

**Primary Cause**: Duplicate `tasks` array conflicts with `task_steps`
- Registration code likely validates against one or the other
- Having both causes schema validation to fail
- System rejects template before execution starts

**Secondary Cause**: Validation command format mismatch
- Commands might not execute properly
- Validation step skips or errors

**Tertiary Cause**: Missing variable declarations
- `{{date}}` interpolation fails
- Agent receives malformed prompt

---

## Fix Priority

### P0 - Critical (Blocks Execution)
1. ✅ Remove duplicate `tasks` array
2. ✅ Fix validation command format

### P1 - High (Causes Runtime Errors)
3. ✅ Add `date` variable or fix date references
4. ✅ Fix `target_directory` default handling

### P2 - Low (Optimization)
5. ⏳ Verify context_rules alignment
6. ⏳ Clean up metrics initialization

---

## Recommended Fix Strategy

### Approach 1: Minimal Fix (Recommended)
1. Remove `tasks` array entirely
2. Fix validation command format
3. Replace `{{date}}` with instruction "Use today's date"
4. Set `target_directory` default to `.`

**Pros**: Low risk, minimal changes  
**Cons**: Still has schema alignment questions

### Approach 2: Complete Rewrite
1. Start with clean schema
2. Rebuild from successful templates
3. Validate against backend schema

**Pros**: Clean, correct schema  
**Cons**: More work, higher risk

---

## Testing Plan

After fix:

### 1. Schema Validation
```bash
# Validate JSON structure
cat fixed-template.json | jq . > /dev/null
echo "Schema valid: $?"
```

### 2. Template Registration
```bash
# Try to register template
opencode activity register --template fixed-template.json
```

### 3. Dry Run Execution
```bash
# Execute on small test directory
opencode activity execute --template organize-documentation-v2 --dry-run
```

### 4. Full Execution Test
```bash
# Execute on current directory
opencode activity execute --template organize-documentation-v2
```

---

## Expected Outcome

After fix:
- ✅ Template registers successfully
- ✅ Validation commands execute properly
- ✅ All variables interpolate correctly
- ✅ Four tasks execute in sequence
- ✅ Archive structure created
- ✅ Codebase state snapshot generated
- ✅ Documentation index updated

**Success Rate Target**: 80%+ (matching other stable templates)
