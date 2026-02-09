# Schema Alignment - Delegation Strategy

**Current Status**: Baseline established - NO activity executions running  
**Validation Tool**: `validate-activity-execution-algorithmic.ts`  
**Approach**: Break work into delegatable tasks with clear validation

---

## Task Structure

Each task has:
- **Clear acceptance criteria** (checklist)
- **Detailed implementation** (copy-paste code)
- **Testing commands** (immediate validation)
- **Validation script** (algorithmic proof)

---

## Phase 1: Schema Alignment (HIGH PRIORITY)

**Goal**: Fix 422 errors - align backend with proto  
**Timeline**: 3.5 hours  
**Validation**: Templates can be created without errors

### Task 1: Create Proto Pydantic Models
**File**: `repos/metabob-rpc-api/server/models/proto_task_step.py`  
**Time**: 1 hour  
**Owner**: Backend developer

**Deliverable**: Pydantic models matching proto exactly
- ProtoTaskStep with all nested models
- Includes `impulse_refs: List[ImpulseReference]`

**Validation**:
```bash
python -c "from server.models.proto_task_step import ProtoTaskStep; print('✅')"
```

**Document**: `TASK_BREAKDOWN_PHASE1.md` - Task 1

---

### Task 2: Update API Endpoints
**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`  
**Time**: 1 hour  
**Owner**: Backend developer

**Deliverable**: API accepts proto schema
- TemplateCreateRequest uses `List[ProtoTaskStep]`
- Old TemplateTask deprecated

**Validation**:
```bash
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "category": "test", "tasks": [<proto-schema>]}'

# Should return 201 (not 422)
```

**Document**: `TASK_BREAKDOWN_PHASE1.md` - Task 2

---

### Task 3: Data Migration Script
**File**: `repos/metabob-rpc-api/scripts/migrate_templates_to_proto.py`  
**Time**: 1 hour  
**Owner**: Backend developer

**Deliverable**: Migration script for existing data
- Converts old schema → proto schema
- Idempotent and safe
- Dry-run mode

**Validation**:
```bash
python scripts/migrate_templates_to_proto.py --dry-run
# Should show conversion plan without errors
```

**Document**: `TASK_BREAKDOWN_PHASE1.md` - Task 3

---

### Task 4: End-to-End Validation
**File**: `test-phase1-validation.ts`  
**Time**: 30 minutes  
**Owner**: Integration tester

**Deliverable**: Proof that schema alignment works
- OpenCode creates templates successfully
- Backend stores proto schema
- All proto fields present

**Validation**:
```bash
bun run test-phase1-validation.ts
# Should output: Phase 1 Validation: PASSED
```

**Document**: `TASK_BREAKDOWN_PHASE1.md` - Task 4

---

## How to Delegate

### For Each Task:

1. **Assign** task to specialist (backend dev, tester, etc.)

2. **Provide context**:
   - `TASK_BREAKDOWN_PHASE1.md` (detailed specs)
   - `SCHEMA_MISMATCH_ROOT_CAUSE.md` (why we're doing this)
   - Proto files: `repos/metabob-proto/proto/metabob/activity/variant.proto`

3. **Clear success criteria**:
   - Checklist in task breakdown
   - Validation command that must pass
   - Example output showing success

4. **Dependencies**:
   - Task 1 → Task 2 (models must exist before API uses them)
   - Task 2 → Task 3 (API must accept proto before migration)
   - All → Task 4 (final validation)

5. **Validation loop**:
   ```bash
   # After each task
   cd /home/avi/documents/work/exp-repo/metabob-devbob
   bun run validate-activity-execution-algorithmic.ts
   
   # Should show progress:
   # After Task 1: Models imported successfully
   # After Task 2: No 422 errors when creating templates
   # After Task 3: Existing templates migrated
   # After Task 4: Full E2E validation passes
   ```

---

## Progress Tracking

### Current State
- ✅ Baseline validation complete
- ✅ Task breakdown created
- ⏳ Task 1: Pending
- ⏳ Task 2: Pending
- ⏳ Task 3: Pending
- ⏳ Task 4: Pending

### After Each Task Completion
Update checklist in task breakdown:
- [x] Acceptance criterion 1
- [x] Acceptance criterion 2
- [x] Testing passed
- [x] Validation script confirms

---

## Communication Pattern

### Task Assignment Message
```
Task: Create Proto Pydantic Models (Phase 1, Task 1)

Goal: Create server/models/proto_task_step.py with Pydantic models matching proto schema

Context:
- Root cause: SCHEMA_MISMATCH_ROOT_CAUSE.md
- Proto source: repos/metabob-proto/proto/metabob/activity/variant.proto
- Task details: TASK_BREAKDOWN_PHASE1.md (Task 1 section)

Acceptance Criteria:
- [ ] File created: server/models/proto_task_step.py
- [ ] ProtoTaskStep class with all nested models
- [ ] Includes impulse_refs field
- [ ] Import test passes

Validation Command:
python -c "from server.models.proto_task_step import ProtoTaskStep; print('✅')"

Time Estimate: 1 hour

Dependencies: None (can start immediately)

Questions? See TASK_BREAKDOWN_PHASE1.md for full implementation details
```

### Task Completion Message
```
Task Complete: Proto Pydantic Models (Phase 1, Task 1)

✅ All acceptance criteria met:
- [x] File created: server/models/proto_task_step.py
- [x] ProtoTaskStep class implemented
- [x] Includes impulse_refs field  
- [x] Import test passes

Validation Results:
$ python -c "from server.models.proto_task_step import ProtoTaskStep; print('✅')"
✅ Import successful

Files Modified:
- repos/metabob-rpc-api/server/models/proto_task_step.py (NEW)

Next Task: Task 2 (Update API Endpoints) can now proceed
```

---

## Validation Checkpoints

### After Task 1 (Models)
```bash
cd repos/metabob-rpc-api
python -c "from server.models.proto_task_step import ProtoTaskStep; print('✅ Models ready')"
```

### After Task 2 (API)
```bash
# Test with curl (backend must be running)
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-proto-template.json

# Should return 201 Created (not 422 Unprocessable)
```

### After Task 3 (Migration)
```bash
cd repos/metabob-rpc-api
python scripts/migrate_templates_to_proto.py --dry-run
# Should show migration plan without errors

python scripts/migrate_templates_to_proto.py
# Should migrate existing templates
```

### After Task 4 (E2E Validation)
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run test-phase1-validation.ts
# Should output: === Phase 1 Validation: PASSED ===

bun run validate-activity-execution-algorithmic.ts
# Should show: Templates can be created (no 422 errors)
```

---

## Success Criteria (Phase 1 Complete)

1. ✅ Backend has proto-based Pydantic models
2. ✅ API accepts proto schema without 422 errors
3. ✅ Existing templates migrated to proto schema
4. ✅ OpenCode can create templates successfully
5. ✅ All proto fields present (including `impulse_refs`)
6. ✅ Validation script confirms alignment

**When all checked**: Phase 1 is complete, proceed to Phase 2 (ExecutionOutcome storage)

---

## Files Created

**Documentation**:
- `TASK_BREAKDOWN_PHASE1.md` - Detailed task specs
- `DELEGATION_STRATEGY.md` (this file) - How to delegate

**Validation**:
- `validate-activity-execution-algorithmic.ts` - Main validation
- `test-phase1-validation.ts` - Phase 1 specific tests

**Implementation** (will be created by tasks):
- `repos/metabob-rpc-api/server/models/proto_task_step.py`
- `repos/metabob-rpc-api/scripts/migrate_templates_to_proto.py`
- Modified: `repos/metabob-rpc-api/server/routes/v2_activities.py`

---

## Next Steps

1. Assign Task 1 to backend developer
2. Wait for Task 1 completion + validation
3. Assign Task 2 (depends on Task 1)
4. Wait for Task 2 completion + validation
5. Assign Task 3 (depends on Task 2)
6. Wait for Task 3 completion + validation
7. Assign Task 4 (final E2E validation)
8. Confirm Phase 1 complete
9. Proceed to Phase 2 (documented separately)

**Estimated total time**: 3.5 hours with sequential execution, 2 hours with parallel where possible
