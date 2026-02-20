# Session Resume Summary: Activity Execution Debugging - Session 2

## Previous Session (Session 1)
- **Goal**: Debug activity execution with context requirements
- **Finding**: Activities showed LEGACY schema (`directory`, `prompts[]`) instead of NEW schema (`tasks[]`, `executionEvidence`)
- **Critical Discovery**: Both schemas coexist in a hybrid system
- **Problem**: Activities created in devbob had `executionEvidence: undefined` and `loaded: false` impulses

## This Session (Session 2) 

### Investigation Results

**Root Cause Found**: Container code was outdated
- Container commit: `2c33f140` (from Feb 19, before fix)
- Host commit: `7465be33` (includes impulse loading fix)
- Fix date: Feb 19 (after container creation)

**The Fix (commit 7465be33)**:
- Location: `tool/activity.ts` lines 603-694
- Purpose: Map context requirements to template variables
- Mechanism:
  1. Loads impulses created by SessionMemoryAgent.gatherContext()
  2. Maps each impulse to template variable by `requirement.key`
  3. Merges with user-provided variables
  4. Passes merged variables to task execution

**Additional Discovery**:
- `Activity.create()` (in `session/activity.ts`) DOES initialize NEW schema fields
- Lines 416-425 create `executionEvidence`, `workArtifacts`, `correctnessVerdict`
- Container was missing this code too

### Actions Taken

1. **Updated container code**:
   - Copied `tool/activity.ts` with impulse loading fix
   - Copied `tool/activity-errors.ts` (dependency)
   - Copied `session/activity.ts` with executionEvidence initialization
   - Copied `session/template-metrics-client.ts` (dependency)

2. **Rebuilt TypeScript**:
   - Ran `bun run build` in container
   - Build succeeded after all dependencies copied

3. **Validated with test**:
   - Created `test-impulse-loading-direct.ts`
   - Tests impulse creation from contextRequirements
   - Verified activity schema has NEW fields

### Test Results

```
=== Testing Impulse Loading Fix (commit 7465be33) ===

Template: Fix Bug with Metabob
Context Requirements: 4

Activity created with executionEvidence: true  ✓
Impulses created from contextRequirements: 4  ✓
All impulses stored: true  ✓
```

**Key Observations**:
- `hasExecutionEvidence=true` - NEW schema is active
- `hasWorkArtifacts=true` - NEW schema fields present
- Impulses created as placeholders (`loaded=false`)
- Impulses will be loaded during actual execution by SessionMemoryAgent.gatherContext()

## Current Status

### ✅ Validated
1. NEW schema (`executionEvidence`, `workArtifacts`) is initialized by `Activity.create()`
2. Impulses are created from template's `contextRequirements`
3. Hybrid schema (LEGACY + NEW) works correctly
4. Container now has latest code with fixes

### ⚠️ Not Yet Tested
1. Full activity execution with template that has contextRequirements
2. SessionMemoryAgent.gatherContext() loading impulses
3. Impulse loading (lines 628-644 in activity.ts)
4. Variable mapping (lines 656-657 in activity.ts)
5. Sessions spawned by task execution

## Next Steps

To fully validate the fix:

### Option A: Run Full Activity (Complete Test)
```bash
docker exec -it devbob-clean opencode activity \
  --template fix-bug-with-metabob \
  --variables '{"testVar": "test"}' \
  --reason "Full test of impulse loading: validate loading, mapping, and task execution"
```

Expected results:
- SessionMemoryAgent.gatherContext() creates impulses
- Lines 603-694 load impulses and map to variables
- Each impulse: `loaded: true`, `content` populated
- Tasks receive variables like `{{bugDescription}}`, `{{errorContext}}`
- Sessions spawned: > 0
- Activity completes successfully

### Option B: Examine Existing Activities
Check if any activities were created with NEW schema:
```bash
docker exec devbob-clean find /root/.local/share/opencode/storage/activity -name "*.json" \
  -exec bash -c 'jq -r "select(.executionEvidence != null) | .id" {}' \;
```

### Option C: Create Isolated Test
Write test that mocks SessionMemoryAgent.gatherContext() to directly test lines 603-694.

## Files Modified in Container

- `/opt/repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (impulse loading fix)
- `/opt/repos/metabob-opencode/packages/opencode/src/tool/activity-errors.ts` (new file)
- `/opt/repos/metabob-opencode/packages/opencode/src/session/activity.ts` (executionEvidence init)
- `/opt/repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts` (new file)

## Key Learnings

1. **Hybrid Schema**: LEGACY and NEW schemas coexist intentionally
   - LEGACY: `directory`, `branch`, `prompts[]`, `todos[]`
   - NEW: `executionEvidence`, `workArtifacts`, `correctnessVerdict`, `impulses`
   - Both are present in same activity object

2. **Fix Scope**: The impulse loading fix (commit 7465be33) only runs when:
   - `template.contextRequirements.length > 0`
   - SessionMemoryAgent.gatherContext() succeeds
   - Impulses are created and stored in `activity.impulses`

3. **Container Sync**: Container code can diverge from host
   - Container created from image at specific commit
   - Host development continues after container creation
   - Manual file copy + rebuild needed to test latest changes

4. **Evidence Fields**: `executionEvidence` is the marker of NEW system
   - If present: activity uses NEW validation system
   - Contains: `sessionsSpawned[]`, `toolCalls[]`
   - Used for correctness validation

## Conclusion

**Infrastructure validated**: Activity system correctly initializes NEW schema fields and creates impulses from contextRequirements.

**Fix partially validated**: Impulse creation works. Loading and mapping code exists but not yet tested in full execution.

**Next session goal**: Run full activity execution to validate complete impulse loading → variable mapping → task execution flow.
