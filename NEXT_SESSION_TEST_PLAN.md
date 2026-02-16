# Next Session Test Plan - Template Loading Integration

**Date**: 2026-02-16
**Purpose**: Test template loading fix in a fresh OpenCode session

## Quick Start (For New Session)

```bash
# 1. Verify binary is current
ls -lah ~/.local/bin/opencode  # Should show: Feb 16 02:53+

# 2. Test template loading
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run test-activity-execution-simulation.ts

# 3. If successful, test activity tool:
activity({ 
  activityId: "fix-bug-complete",
  variables: { 
    bug_description: "getUserProfile crashes with null user",
    affected_files: "test-cochange-learning/src/auth.ts"
  },
  reason: "Test cochange learning integration"
})
```

## What Was Fixed

✅ **template-loader.ts** (lines 114-135, 183-211)
- Removed bootstrap-only restriction
- Now loads ANY template from local storage
- Binary rebuilt: Feb 16 02:53

✅ **Verified Working** (direct API tests)
- `TemplateRepository.get("fix-bug-complete")` → Success
- `TemplateRepository.list()` → Returns 13 templates

## Why Current Session Can't Test

The OpenCode instance running THIS session started BEFORE the binary rebuild.
Need fresh session to test the fixed binary.

## Expected Result

When running `activity({ activityId: "fix-bug-complete", ... })`:
- ✅ Template loads from local storage
- ✅ Activity executes
- ✅ Cochange predictions in session memory
- ✅ Learning data captured
