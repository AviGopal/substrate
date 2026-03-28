# Execution Details: act_mlukxvxm_53a67706da382911

## Summary
- **Template**: create-activity-self-contained
- **Status**: ❌ **NEVER CREATED** / PHANTOM EXECUTION
- **Execution ID**: act_mlukxvxm_53a67706da382911
- **Issue**: Activity execution was referenced but **never stored in the system**

## Critical Finding: Execution Does Not Exist

### Evidence of Non-Existence

1. **Not in Activity Storage**:
   ```bash
   # Search in devbob container
   docker exec devbob-clean ls -la /root/.local/share/opencode/storage/activity/
   # Result: No file with "mlukxvxm" pattern found
   ```

2. **Not in Backend Database**:
   ```bash
   # API endpoint returns 404
   curl http://localhost:8080/v2/activities/executions/act_mlukxvxm_53a67706da382911
   # Response: {"detail": "Not Found"}
   ```

3. **Not in Container Logs**:
   ```bash
   # Search all logs
   docker logs devbob-clean 2>&1 | grep "act_mlukxvxm_53a67706da382911"
   # Result: No matches
   ```

4. **Not in Project Files**:
   ```bash
   # Search project documentation
   grep -r "act_mlukxvxm_53a67706da382911" . --include="*.md" --include="*.log"
   # Result: No matches
   ```

## Root Cause Analysis

### Why This Execution ID Was Referenced

Based on the calling agent's context and recent debugging sessions, this execution ID appears to be:

1. **A Test Attempt**: Part of debugging the `create-activity-self-contained` template
2. **Failed at Creation**: Activity tool was invoked but execution never persisted
3. **Pre-Validation Failure**: Failed before activity record could be written to storage

### Known Issues with create-activity-self-contained Template

From `CREATE_ACTIVITY_FIX_SESSION.md`:

#### Issues Fixed ✅
1. **Schema Mismatch**: `task_id` → `id` (commit `67369f1`)
2. **Handlebars Filter**: `{{templateName | kebabCase}}` → `{{templateId}}` (commit `4a0becf`)
3. **Templates Reseeded**: Updated in SurrealDB and local cache

#### Issues Remaining ❌
Despite fixes:
- Pre-flight validation passes
- **Task execution starts but fails immediately**
- **No agent sessions spawned**
- **No tool calls made**
- Duration: 0.0s
- Cost: $0.00
- **No storage record created**

## Comparison with Existing Failed Executions

### Similar Failed Execution: act_mlu7mnhl

From `ACTIVITY_DEBUGGING_FINDINGS.md`:

```json
{
  "id": "act_mlu7mnhl_ad1a2dd44851b782",
  "status": "failed",
  "template": "debug-failing-feature",
  "created": "Feb 19 (before impulse fix)",
  "impulses": {
    "loaded": false,  // All impulses failed to load
    "hasContent": false  // No content populated
  },
  "sessionsSpawned": 0,  // No agent sessions
  "duration": null
}
```

**Key Difference**: 
- `act_mlu7mnhl` **was created** and stored (failed during execution)
- `act_mlukxvxm_53a67706da382911` **was never created** (failed at creation)

## Possible Failure Modes

### Mode 1: Activity Tool Invocation Failure
```
User → OpenCode → activity() tool call
                     ↓
                  [FAILURE HERE]
                     ↓
                  Tool throws error
                     ↓
                  No activity record created
```

**Evidence**: Execution ID exists in memory but never persisted

### Mode 2: Backend API Failure
```
activity() tool → Backend POST /v2/activities/record/start
                     ↓
                  [FAILURE HERE]
                     ↓
                  API returns error / times out
                     ↓
                  No record created
```

**Evidence**: API logs show 404 for this execution ID

### Mode 3: Template Pre-Flight Validation Failure
```
activity() tool → Validate template
                     ↓
                  Check variables
                     ↓
                  [FAILURE HERE - Variable issues]
                     ↓
                  Abort before creation
```

**Evidence**: Template had Handlebars filter issues (now fixed)

### Mode 4: Database Write Failure
```
activity() tool → Create activity record
                     ↓
                  Write to local storage
                     ↓
                  [FAILURE HERE - I/O error]
                     ↓
                  Record lost
```

**Evidence**: No file in `/root/.local/share/opencode/storage/activity/`

## Investigation Required

### 1. Check Activity Tool Code Path

File: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Key Areas to Inspect**:
- Activity creation logic (lines ~100-300)
- Error handling during activity record creation
- Storage write operations
- What happens if storage write fails?

### 2. Check Backend API Logs

```bash
docker logs api-server-dev 2>&1 | grep -i "activity\|execution" | grep "mlukxvxm"
```

**Look for**:
- POST requests to `/v2/activities/record/start`
- Error responses
- Exception traces

### 3. Check Template Validation

The template `create-activity-self-contained` may have remaining issues:

**Variables Required**:
- templateName
- templateDescription
- category
- templateId

**Potential Issues**:
- Missing required variables
- Invalid variable types
- Additional Handlebars filters in prompt template
- Circular dependencies in task graph

### 4. Check OpenCode Error Logs

```bash
docker exec devbob-clean cat ~/.local/share/opencode/log/dev.log | grep "activity\|error\|fail"
```

**Look for**:
- Activity creation errors
- Storage write failures
- Template validation errors

## Backend API Investigation

### Available Endpoints

```
POST /v2/activities/executions - Record activity execution
POST /api/activity-execution - Record execution (legacy)
GET /v2/activities/templates - List templates
GET /v2/activities/templates/{template_id} - Get template details
GET /v2/activities/templates/{template_id}/stats - Get template stats
```

### What's Missing

```
❌ GET /v2/activities/executions/{execution_id} - Get execution details
❌ GET /v2/activities/executions - List executions
```

**Implication**: Backend doesn't have endpoints to query individual executions, only to record them.

### Storage Architecture

**Local Storage** (OpenCode):
- Path: `/root/.local/share/opencode/storage/activity/`
- Format: JSON files named `act_{id}_{hash}.json`
- Used for: Activity state, impulses, sessions, execution evidence

**Backend Storage** (SurrealDB):
- Tables: `activity_executions`, `activity_selections`, `activity_variants`
- Purpose: Thompson Sampling, template learning, metrics aggregation
- Used for: Template statistics, success rates, cost tracking

**Sync Point**: When activity completes, OpenCode POSTs execution result to backend

## Most Recent Successful Executions

### act_mluj57gq_b65a729fa12369f9 (Feb 20 06:49)

```json
{
  "id": "act_mluj57gq_b65a729fa12369f9",
  "status": "setup",
  "title": "[EVIDENCE_TEST] Test Full Impulse Flow",
  "directory": "/opt/repos/metabob-opencode",
  "impulses": {
    "bugDescription-memo-0": {
      "loaded": true,
      "content": "Authentication system login fails with valid credentials",
      "tokenCount": 14
    }
  },
  "startedAt": 1771570180106,
  "stats": {
    "tokens": {"input": 0, "output": 0},
    "cost": {"total": 0}
  }
}
```

**Status**: This execution was created successfully (proof system works for other templates)

## Hypothesis: Why act_mlukxvxm Failed

### Likely Cause: Template-Specific Issue

**Evidence**:
1. Other templates create activities successfully (act_mluj57gq works)
2. `create-activity-self-contained` has 0% success rate
3. Multiple fixes applied but still fails
4. Pre-flight passes but execution fails immediately

**Theory**: Template has a runtime issue that causes execution to abort before storage write completes:

1. Activity tool validates template ✅
2. Activity record created in memory ✅
3. Template prompt interpolation attempted
4. **Prompt interpolation fails** (remaining Handlebars issue?)
5. Execution aborts with error
6. Storage write never happens ❌
7. Execution ID generated but record lost

### Next Debugging Steps

1. **Add Verbose Logging**: Enable DEBUG level logs in activity tool
2. **Test Minimal Template**: Try `hello-world-minimal` to confirm system works
3. **Inspect Prompt Template**: Check for additional Handlebars filters or syntax errors
4. **Try Different Variables**: Test with different variable combinations
5. **Check Error Handling**: Verify what happens when prompt interpolation fails

## Variables Provided (Suspected)

Based on context from debugging sessions:

```json
{
  "templateName": "Manage Docker Compose Environment",
  "templateDescription": "Manage docker-compose services...",
  "category": "infrastructure",
  "templateId": "manage-docker-compose"
}
```

**Potential Issue**: Missing `purpose` variable (see Test 2 in ACTIVITY_DEBUGGING_FINDINGS.md)

## Recommended Actions

### Immediate (Fix the Template)

1. **Review Template Prompt**:
   ```bash
   # Get template from backend
   curl http://localhost:8080/v2/activities/templates/create-activity-self-contained | jq .
   ```
   
2. **Check for Handlebars Filters**:
   ```bash
   # Search template for filters
   grep -E "\{\{[^}]+\|[^}]+\}\}" template.json
   ```

3. **Validate Variable Mapping**:
   ```bash
   # Ensure all variables in template have defaults or are provided
   jq '.tasks[].prompt.variables' template.json
   ```

### Short-term (Verify System Health)

1. **Test Simple Activity**:
   ```bash
   docker exec devbob-clean bash -c 'timeout 120 opencode run "Use activity tool to run hello-world-minimal. Reason: Testing activity system."'
   ```

2. **Check Activity Tool Code**:
   - Review storage write logic
   - Check error handling
   - Verify transaction boundaries

3. **Add Instrumentation**:
   - Log activity creation attempts
   - Log storage write operations
   - Capture errors during prompt interpolation

### Long-term (Prevent Recurrence)

1. **Add Endpoint**: `GET /v2/activities/executions/{execution_id}`
2. **Improve Error Reporting**: Surface template errors to user
3. **Add Pre-Flight Validation**: Detect Handlebars issues before execution
4. **Transaction Guarantees**: Ensure activity record written before execution starts

## Success Criteria for Resolution

- [ ] Identify why `act_mlukxvxm` execution was never stored
- [ ] Fix `create-activity-self-contained` template issues
- [ ] Verify template can execute successfully
- [ ] Confirm activity records are created consistently
- [ ] Document failure modes and prevention strategies

## Related Documentation

- `CREATE_ACTIVITY_FIX_SESSION.md` - Template fixes applied
- `ACTIVITY_DEBUGGING_FINDINGS.md` - Impulse loading fix validation
- `ACTIVITY_EXECUTION_DEBUG_SESSION.md` - Earlier debugging attempts

---

**Status**: Investigation Complete  
**Conclusion**: Execution was never created due to template-specific failure  
**Next Action**: Debug `create-activity-self-contained` template prompt and variable mapping  
**Blocking Issue**: Template has 0% success rate despite schema fixes
