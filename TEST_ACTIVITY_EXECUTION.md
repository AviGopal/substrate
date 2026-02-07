# Test Activity Execution Through OpenCode

## Goal

Test that activities can be discovered and executed through metabob-opencode, and verify that the create-activity-template activity works correctly.

## Setup Status

### Backend Services ✅
```
✓ API Server: http://localhost:8080 (v0.16.0)
✓ SurrealDB: ws://localhost:8000
✓ Redis: redis://localhost:6379
✓ Branch: refactor-code-similarity
```

### Database Status ✅
```
Organization: exp-repo
Project: exp-repo-dev

Activities Registered:
1. create-activity-template (variant: create-activity-template-f20bafb3) ✅
2. jiggle-documentation (variant: jiggle-documentation-772b239e) ✅
```

### Registration Method Used ✅
```bash
# Used the proper tool (reusing existing components!)
metabob-cli register-template \
  /path/to/template.json \
  --status active
```

This is the correct approach - reusing metabob-cli's existing registration functionality rather than writing custom scripts.

## Test Plan

### Test 1: Verify Activity Has Task Steps

Check that registered activities have non-empty task_steps:

```bash
cd repos/metabob-rpc-api
SURREAL_USER=local SURREAL_PASS=testing SURREAL_DATABASE=development \
  ./admin-cli.sh db query \
  "SELECT variant_id, activity_id, array::len(task_steps) AS step_count 
   FROM activity_variants 
   WHERE activity_id = 'create-activity-template'"
```

**Expected**: `step_count > 0` (should be 4 tasks)

### Test 2: API Endpoint Returns Full Data

```bash
curl -s -H "X-Internal-Request: true" \
  "http://localhost:8080/activity-recommendations/variants/create-activity-template-f20bafb3/details" \
  | jq '{variant_id, activity_id, task_count: (.task_steps | length)}'
```

**Expected**: Full activity details with task_steps array populated

### Test 3: OpenCode Can Discover Activity

```bash
cd repos/metabob-opencode

# Start OpenCode with metabob enabled
opencode
```

Then in OpenCode prompt:
```
Can you search for available activities? Use the search_activities tool.
```

**Expected**: Should find create-activity-template in the results

### Test 4: Execute create-activity-template Activity

In OpenCode:
```
Run the create-activity-template activity to create a simple "hello-world" template.

Variables:
- templateName: "Hello World Example"
- templateDescription: "A simple hello world template for testing"
- category: "tool"
- purpose: "Verify activity execution works end-to-end"
```

**Expected Flow**:
1. Activity starts with proper context loading
2. Executes 4 tasks:
   - analyze-examples
   - design-task-graph
   - write-template-json
   - register-template
3. Creates a JSON file for the new template
4. Registers it with the backend
5. Can verify the new template exists via search_activities

### Test 5: Verify New Template Was Created

After execution:
```bash
cd repos/metabob-rpc-api
SURREAL_USER=local SURREAL_PASS=testing SURREAL_DATABASE=development \
  ./admin-cli.sh activities list
```

**Expected**: Should now show "hello-world" or similar activity in the list

## Current Status

- ✅ Backend running with local code (refactor-code-similarity branch)
- ✅ Organization and project created (exp-repo, exp-repo-dev)
- ✅ create-activity-template registered with task_steps
- ⏳ Ready to test execution through OpenCode

## Next Steps

1. Verify task_steps are populated (Test 1)
2. Confirm API returns full data (Test 2)
3. Start OpenCode and test discovery (Test 3)
4. Execute create-activity-template (Test 4)
5. Verify new template creation (Test 5)

## Expected Outcomes

If everything works correctly:
- ✅ Activities discoverable via search_activities MCP tool
- ✅ Activity execution creates proper workflow
- ✅ Tasks execute in dependency order
- ✅ New templates get registered automatically
- ✅ System self-improves (meta-capability)

## Architecture Validation

This test will verify:
1. **Proper tool reuse**: metabob-cli register-template (not custom scripts)
2. **metabob-proto as standard**: Bootstrap templates source of truth
3. **Component reuse**: Using existing RPC API endpoints
4. **Clean separation**: Agents don't see variant IDs or A/B metrics
5. **Activity system works**: End-to-end template creation and registration

---

**Ready to execute!**
