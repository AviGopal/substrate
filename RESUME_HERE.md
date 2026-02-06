# 🎯 Resume Here: Activity System Unification

## Current Status: 65% Complete ✅

**Last Completed:** Task 7 (Core) - Database serialization bug fixed  
**Next Up:** Task 8 - Migrate metabob-cli (~1 hour)

---

## Quick Start: Continue Where We Left Off

### 1. Review What Was Done (5 min)
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Read the comprehensive summary
cat FINAL_SESSION_SUMMARY.md

# Or the visual progress
cat PROGRESS_VISUAL_SUMMARY.md
```

### 2. Verify Environment (2 min)
```bash
# Test proto generation still works
cd repos/metabob-proto
./scripts/generate.sh
# Expected: ✓ Code generation complete!

# Test imports work
cd ../metabob-rpc-api
python3 -c "import sys; sys.path.insert(0, '../metabob-proto/gen/python'); \
  from metabob.activity import ActivityVariant; print('✅ OK')"
```

### 3. Start Task 8 (1 hour)
See detailed plan below ⬇️

---

## Task 8: Migrate metabob-cli

**Goal:** Update CLI to use generated proto types for template validation

**Estimated Time:** 1 hour

### Step 1: Add Proto Dependency (10 min)

```bash
cd repos/metabob-cli
```

**File:** `pyproject.toml`

Add to dependencies:
```toml
dependencies = [
    # ... existing
    "metabob-proto>=0.1.0",
]
```

Add to sources:
```toml
[tool.uv.sources]
metabob-proto = { path = "../metabob-proto", editable = true }
```

### Step 2: Check Current Usage (15 min)

```bash
# Find where activity types are used
grep -r "ActivityVariant\|activity.*variant" src/ --include="*.py"

# Check activity_manager.py specifically
head -100 src/metabob_cli/mcp/activity_manager.py
```

**Look for:**
- Custom activity/variant type definitions
- JSON schema validation code
- Template registration logic

### Step 3: Update Imports (if needed) (20 min)

**File:** `src/metabob_cli/mcp/activity_manager.py`

If using custom types, replace with:
```python
import sys
from pathlib import Path

# Add proto to path
PROTO_PATH = Path(__file__).parent.parent.parent.parent / "metabob-proto" / "gen" / "python"
if str(PROTO_PATH) not in sys.path:
    sys.path.insert(0, str(PROTO_PATH))

from metabob.activity import ActivityVariant, TaskStep
from metabob.common import Genealogy
```

### Step 4: Test CLI Commands (15 min)

```bash
# Test template registration (if applicable)
python3 -m metabob_cli register-template path/to/template.json

# Test MCP server commands
python3 -m metabob_cli mcp-server --help
```

### Expected Outcome ✅

- ✅ Proto dependency added
- ✅ Imports updated (if needed)
- ✅ CLI commands work
- ✅ Template validation functional

### Possible Findings

**Scenario A: CLI doesn't use activity types directly**
- Just add dependency for future use
- Verify CLI still works
- Move to Task 9

**Scenario B: CLI has custom activity types**
- Replace with generated proto types
- Update validation logic
- Test registration commands

**Scenario C: CLI uses variant_id/activity_id format**
- Verify compatibility with proto schema
- May need field mapping

---

## Task 9: Migrate metabob-opencode (Next, 2-3 hours)

**Goal:** Generate TypeScript types and migrate OpenCode frontend

### Prerequisites

1. **Set up TypeScript generation**
   - Install ts-proto: `npm install --save-dev ts-proto`
   - Update buf.gen.yaml with TypeScript plugin
   - Generate TypeScript types

2. **Locate ActivitySchemaAdapter**
   ```bash
   cd repos/metabob-opencode
   find . -name "*activity*schema*adapter*" -o -name "*ActivitySchemaAdapter*"
   ```

3. **Plan migration**
   - Map adapter functionality to generated types
   - Identify all import locations
   - Plan deletion strategy

### Detailed plan in: `TASK_9_TYPESCRIPT_MIGRATION_PLAN.md` (create when ready)

---

## Task 10-12: Testing & Documentation (3-4 hours)

See: `PROGRESS_VISUAL_SUMMARY.md` for details

---

## Key Files for Reference

### Documentation
- `FINAL_SESSION_SUMMARY.md` - Comprehensive overview
- `PROGRESS_VISUAL_SUMMARY.md` - Visual progress tracking
- `TASK_6_CODEGEN_COMPLETE.md` - Code generation details
- `TASK_7_COMPLETION_SUMMARY.md` - Database fix details

### Code
- `repos/metabob-proto/scripts/generate.sh` - Proto code generation
- `scripts/init-db.py` - Database initialization (bug fixed!)
- `test-json-escaping.py` - Verification test for fix

### Proto Schema
- `repos/metabob-proto/proto/metabob/activity/variant.proto` - Core variant schema
- `repos/metabob-proto/proto/metabob/activity/execution.proto` - OpenCode extensions
- `repos/metabob-proto/proto/metabob/activity/optimization.proto` - A/B testing
- `repos/metabob-proto/proto/metabob/activity/admin.proto` - Authoring/deployment

---

## Critical Insights from Last Session

### 1. Database Bug Fixed ✅
**Problem:** ALL activities had empty task_steps[] arrays  
**Cause:** JSON not escaped in SQL strings  
**Fix:** Proper escaping in init-db.py lines 311, 314, 383  
**Impact:** Activity storage/retrieval now functional

### 2. Proto Design Gap Identified
**Variant Types** (what we have):
- ActivityVariant - template definition
- TaskStep - task definition  
- For: Storage, A/B testing

**Execution Types** (what's needed):
- ActivityExecution - runtime instance
- ExecutionResult - outcomes
- For: Tracking, metrics

**Decision:** Deferred full RPC migration until execution types designed

### 3. Migration Strategy
- ✅ Fix critical bugs first
- ✅ Incremental service-by-service migration
- ✅ Preserve backward compatibility
- ✅ Design proto types properly before migrating

---

## Quick Reference Commands

```bash
# Generate proto code
cd repos/metabob-proto && ./scripts/generate.sh

# Test JSON escaping fix
cd /home/avi/documents/work/exp-repo/metabob-devbob && python3 test-json-escaping.py

# Test proto imports
cd repos/metabob-rpc-api && python3 -c "import sys; sys.path.insert(0, '../metabob-proto/gen/python'); from metabob.activity import ActivityVariant; print('OK')"

# Initialize database (requires SurrealDB)
cd /home/avi/documents/work/exp-repo/metabob-devbob && python3 scripts/init-db.py
```

---

## Success Metrics for This Session

### Task 8 Complete ✅
- ✅ Proto dependency added to CLI
- ✅ Imports updated (if needed)
- ✅ CLI commands tested
- ✅ Template validation works

### Bonus: TypeScript Setup ⭐
- ⭐ ts-proto configured
- ⭐ TypeScript types generated
- ⭐ Ready for Task 9

---

## Timeline

**This Session Target:**
- Task 8: 1 hour
- TypeScript setup: 30 min
- Task 9 started: 1 hour
- **Total: 2.5 hours**

**Remaining After This:**
- Task 9 completion: 1-1.5 hours
- Tasks 10-12: 3-4 hours
- **Total: 4-5.5 hours (1 more session)**

---

## When You're Done with Task 8

1. **Update progress docs:**
   ```bash
   # Update PROGRESS_VISUAL_SUMMARY.md
   # Mark Task 8 as complete
   ```

2. **Document findings:**
   - Create `TASK_8_CLI_MIGRATION_SUMMARY.md`
   - Note any issues or insights
   - Update timeline estimates

3. **Move to TypeScript setup:**
   - Research ts-proto configuration
   - Test generation
   - Plan Task 9 approach

4. **Or take a break! 😊**
   - You'll have completed 70%
   - Only 30% remaining
   - Clear path forward

---

**LET'S GO! 🚀**

**First command:** `cd repos/metabob-cli && cat pyproject.toml`
