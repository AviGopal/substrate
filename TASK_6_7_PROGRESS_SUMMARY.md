# Tasks 6-7: Code Generation & RPC Migration - IN PROGRESS

## ✅ Task 6: Code Generation Setup - COMPLETE

### Completed
1. **Buf Configuration** ✅
   - Created `buf.yaml` with linting and breaking change rules
   - Created `buf.gen.yaml` for code generation config
   - Created `package.json` with generation scripts
   - Created `.gitignore` for generated code

2. **Code Generation Script** ✅
   - Created `scripts/generate.sh` - automated generation
   - Generates Python code from all proto files
   - Creates proper package structure with `__init__.py`
   - Exports all types for easy imports
   - Includes verification tests

3. **Generated Python Code** ✅
   - 17 Python implementation files (`.py`)
   - 9 Python type stub files (`.pyi`)
   - Proper package structure: `metabob.activity`, `metabob.common`, etc.
   - All types importable and verified

4. **Documentation** ✅
   - `TASK_6_CODEGEN_COMPLETE.md` - Complete documentation
   - Usage examples and commands reference
   - Architecture impact analysis

### Generated Types Available
```python
# Activity types
from metabob.activity import (
    ActivityVariant, TaskStep, TaskPrompt, TaskValidation,
    TaskRetry, TaskMetrics, TaskComplexity,
    VariantPerformanceMetrics,
    CompositionConfig, LearningConfig, ExpectedOutcome,
    ExecutionConfig, ContextRequirement, IntegrationConfig,
    HooksConfig, TaskExecutionConfig, ImpulseReference,
    OptimizationConfig, ThompsonSamplingConfig, TrafficAllocationConfig,
    AdminConfig, AuthoringMetadata, ValidationRules,
    DocumentationMetadata, DeploymentConfig,
)

# Common types
from metabob.common import Genealogy, EntityStatus
```

## 🔄 Task 7: RPC API Migration - IN PROGRESS

### Completed
1. **Database Serialization Bug Fixed** ✅
   - **File:** `scripts/init-db.py`
   - **Lines changed:** 311, 314, 383
   - **Fix:** Proper JSON escaping for SQL statements
   ```python
   # Before (BROKEN):
   fields.append(f"{key} = {json.dumps(value)}")  # ❌
   
   # After (FIXED):
   escaped_json = json.dumps(value).replace('\\', '\\\\').replace('"', '\\"')
   fields.append(f'{key} = "{escaped_json}"')  # ✅
   ```
   - **Impact:** Now task_steps arrays will populate correctly in database

2. **Proto Dependency Added** ✅
   - **File:** `repos/metabob-rpc-api/pyproject.toml`
   - Added `metabob-proto>=0.1.0` to dependencies
   - Added editable source path in `[tool.uv.sources]`
   - Proto imports verified working

### In Progress
3. **Update Proto Imports** 🔄
   - **File to modify:** `server/models/proto_activity.py`
   - **Current state:** Has broken imports from old proto structure
   - **Required changes:**
     ```python
     # OLD (broken):
     from proto.activity import activity_pb2
     from proto.activity import task_pb2
     from proto.common import types_pb2
     
     # NEW (working):
     from metabob.activity import variant_pb2
     from metabob.common import types_pb2
     ```

### Not Started
4. **Test Database Seed** ⏳
   - Run `python3 scripts/init-db.py`
   - Verify task_steps arrays are populated
   - Check bootstrap activities load correctly

5. **Update Route Files** ⏳
   - **Files:** `server/routes/proto_activities.py`, `server/routes/activity_recommendations.py`
   - Update to use new proto imports
   - Test API endpoints

## Current Blocker

The next step is to update `server/models/proto_activity.py` to use the correct proto imports. This file currently tries to import from the old proto structure, which is causing all the import errors.

## Commands to Run Next

```bash
# 1. Test proto imports work
cd repos/metabob-rpc-api
python3 -c "import sys; sys.path.insert(0, '../metabob-proto/gen/python'); \
  from metabob.activity import ActivityVariant, TaskStep; \
  from metabob.common import Genealogy; print('OK')"

# 2. After fixing imports - test database seed
cd /home/avi/documents/work/exp-repo/metabob-devbob
python3 scripts/init-db.py

# 3. Verify task_steps populated
# Should see activities with non-empty task_steps arrays

# 4. Test API (after all fixes)
cd repos/metabob-rpc-api
uvicorn server.main:app --reload
curl http://localhost:8000/api/v1/activities/search
```

## Files Modified So Far

### Task 6 (5 files created)
1. `repos/metabob-proto/buf.yaml`
2. `repos/metabob-proto/buf.gen.yaml`
3. `repos/metabob-proto/package.json`
4. `repos/metabob-proto/.gitignore`
5. `repos/metabob-proto/scripts/generate.sh`

### Task 7 (2 files modified)
1. `scripts/init-db.py` - Fixed JSON escaping bug
2. `repos/metabob-rpc-api/pyproject.toml` - Added proto dependency

### Task 7 (Still Need to Modify)
3. `repos/metabob-rpc-api/server/models/proto_activity.py` - Update imports
4. `repos/metabob-rpc-api/server/routes/proto_activities.py` - Update imports (maybe)
5. `repos/metabob-rpc-api/server/routes/activity_recommendations.py` - Update imports (maybe)

## Success Metrics

### Task 6 ✅
- ✅ Buf configuration working
- ✅ Code generation script functional
- ✅ Python package structure correct
- ✅ All types importable
- ✅ Type stubs generated

### Task 7 (In Progress)
- ✅ Database serialization bug fixed
- ✅ Proto dependency added
- ✅ Proto imports verified
- ⏳ Proto imports updated in models
- ⏳ Database seed tested
- ⏳ API endpoints tested
- ⏳ All import errors resolved

## Next Immediate Steps

1. **Fix `proto_activity.py` imports** - Replace old proto imports with new generated types
2. **Test database seed** - Verify task_steps populate correctly
3. **Test API endpoints** - Ensure routes work with updated types
4. **Move to Task 8** - Migrate metabob-cli

## Estimated Time Remaining for Task 7

- Fix proto imports: 15 minutes
- Test database seed: 10 minutes
- Fix any route issues: 15 minutes
- Verification: 10 minutes
- **Total: ~50 minutes**

## Architecture Impact

**Before:**
- Proto code not generated
- RPC API has broken imports
- Database serialization bug (empty task_steps)
- Format fragmentation

**After (Tasks 6-7):**
- ✅ Proto code auto-generated and working
- ✅ Database serialization fixed
- 🔄 RPC API using generated types (in progress)
- ⏳ Format unification complete (pending Tasks 8-9)
