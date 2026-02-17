# Activity Execution - What We Fixed vs What Remains

**Date**: February 9, 2026  
**Method**: Iterative error fixing with HTTP response verification

---

## Errors Fixed

### Error 1: Database Empty
**Symptom**: search_activities returns 0 results  
**Test**: `python3 test-activity-execution-flow.py`  
**Before**: Count: 0  
**Fix**: Registered jiggle activity via POST /v2/activities/templates  
**After**: Count: 27 templates (including jiggle as refactor-5fccfc17)  

### Error 2: Template Variable Format
**Symptom**: 422 "Input should be a valid string"  
**Test**: `python3 register-jiggle-activity.py`  
**Before**: Variables were objects `[{name:"scope",...}]`  
**Fix**: Converted to strings `["scope","mode",...]`  
**After**: 201 Created - registration succeeded  

### Error 3: Wrong Endpoint
**Symptom**: 404 Not Found when fetching variant  
**Test**: `python3 test-correct-endpoint.py`  
**Before**: Code called `/activity-recommendations/variants/{id}/details`  
**Fix**: Changed to `/v2/activities/templates/{id}`  
**After**: 200 OK - template details returned  

---

## What Works Now

### Backend API Layer
```bash
# List templates
curl http://localhost:8080/v2/activities/templates
→ 200 OK, 27 templates

# Get specific template
curl http://localhost:8080/v2/activities/templates/refactor-5fccfc17
→ 200 OK, full template with 4 tasks

# Start execution
curl -X POST http://localhost:8080/v2/activities/record/start
→ 200 OK, execution_id returned

# Record step
curl -X POST http://localhost:8080/v2/activities/record/step
→ 200 OK, recorded: true

# Complete execution
curl -X POST http://localhost:8080/v2/activities/record/complete
→ 200 OK, completed: null (means success)
```

### Code Layer
- metabob-api.ts: Fixed to use correct endpoint
- OpenCode rebuilt successfully
- No TypeScript errors

---

## What Hasn't Been Tested

### Agent → Activity Tool → Backend Flow

```
Agent calls: activity({ activityId: "refactor-5fccfc17", ... })
    ↓ (ActivityTool.execute)
    ↓ (TemplateRepository.get)
    ↓ (TemplateLoader.load)
    ↓ (MetabobAPI.getVariantDetails) ← We fixed this
    ↓ (HTTP GET /v2/activities/templates/{id}) ← This works
    ↓ Returns template
    ↓ (MetabobCLI.startExecution) ← Not tested yet
    ↓ MCP call to metabob-cli
    ↓ metabob-cli calls backend
    ↓ Backend starts execution ← This works
    ↓ Returns to agent
```

**Untested portion**: The MCP layer (MetabobCLI → metabob-cli → backend)

---

## Next Error Will Likely Be

One of these:

### Option A: MCP Connection Issues
- metabob-cli MCP server not running
- MCP session not created
- MCP authentication fails

### Option B: Execution Step Issues
- First task prompt fails to execute
- Variables not interpolated correctly
- Validation commands fail
- Agent doesn't complete all 4 tasks

### Option C: Return Format Issues  
- MCP returns data in unexpected format
- OpenCode can't parse the response
- Metadata missing or wrong shape

---

## To Actually Test

Need to either:

1. **Install rebuilt OpenCode**:
   ```bash
   cd repos/metabob-opencode
   tar -xzf packages/opencode/opencodetmp/opencode-linux-x64.tar.gz
   ./opencode-linux-x64/bin/opencode
   ```

2. **Or run in devbob container** (which should have the activity system):
   ```bash
   docker exec -it devbob-opencode bash
   # Inside container:
   opencode
   # Then in session:
   activity({ activityId: "refactor-5fccfc17", variables: {...}, reason: "..." })
   ```

3. **Or test MCP layer directly**:
   ```python
   # Call metabob-cli MCP server
   # Send activity execution request
   # See what error comes back
   ```

---

## Progress Summary

**Fixed**: 3 errors (database empty, schema mismatch, wrong endpoint)  
**Verified**: Backend API works end-to-end  
**Remaining**: MCP layer + actual agent execution  

**No speculation. Only tested facts.**

---

## Evidence Files

All tests return actual HTTP responses:
- `test-activity-execution-flow.py` → Shows 27 templates now exist
- `test-correct-endpoint.py` → Shows 200 OK for template fetch
- `test-full-execution.sh` → Shows execution recording works
- `check-what-registered.py` → Shows jiggle registered

**Next**: Run the activity via the actual tool and capture the next error.
