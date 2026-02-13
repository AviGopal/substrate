# Next Session Test Plan - Activity System Validation

**Prerequisites**: OpenCode has restarted and reloaded MCP server

## Quick Validation (2 minutes)

### Test 1: Verify Search Works
```javascript
search_activities({ verbose: true })
```

**Expected**: Returns 20+ activities including:
- `infrastructure-86af0790`: Echo Proof Feb12
- `INFRASTRUCTURE-0013e379`: Activity Create (5 tasks)

**If fails**: MCP server not loaded, check OpenCode logs

---

### Test 2: Simple Activity Execution
```javascript
activity({
  activityId: "infrastructure-86af0790",
  variables: {},
  reason: "Quick validation test"
})
```

**Expected**: 
- ✅ Execution starts
- ✅ Task completes
- ✅ Returns success

**If fails with "Activity not found"**: 
- MCP `get_activity_template` tool still not available
- Check: `metabob-cli --version` (should be 1.8.0 dev)
- Check: OpenCode MCP config points to correct metabob-cli

**If fails with other error**:
- Check logs for details
- May need template variable adjustment

---

## Full Self-Hosting Proof (5 minutes)

### Test 3: Execute Activity-Create
```javascript
activity({
  activityId: "INFRASTRUCTURE-0013e379",
  variables: {
    template_name: "validation-proof-feb12",
    template_description: "Proof that activity-create works end-to-end",
    template_category: "infrastructure",
    required_variables: JSON.stringify([]),
    optional_variables: JSON.stringify([]),
    tasks: JSON.stringify([
      {
        id: "validation-echo",
        description: "Echo validation message",
        subagent: "general",
        prompt: {
          template: "Echo: Activity system is fully operational! Date: 2026-02-12",
          variables: [],
          max_tokens: 500
        },
        dependencies: [],
        validation: {
          type: "output_contains",
          value: "operational"
        }
      }
    ])
  },
  reason: "Prove activity-create template creates new templates successfully"
})
```

**Expected**:
- ✅ Activity-create executes (5 tasks)
- ✅ New template registered in backend
- ✅ Returns execution summary

**Watch for**:
- Task 1: Validate input
- Task 2: Transform to backend format
- Task 3: Register via MCP
- Task 4: Verify registration
- Task 5: Return confirmation

---

### Test 4: Verify New Template Exists
```javascript
search_activities({ query: "validation-proof-feb12", verbose: true })
```

**Expected**:
- Finds template: `infrastructure-[hash]`
- Name: "validation-proof-feb12"
- Category: infrastructure
- Tasks: 1

**If not found**:
- Check if activity-create failed
- Check backend logs: `docker logs devbob-opencode 2>&1 | grep validation-proof`

---

### Test 5: Execute Self-Created Template
```javascript
// Use ID from Test 4 search results
activity({
  activityId: "infrastructure-XXXXXXXX",  // Replace with actual ID
  variables: {},
  reason: "Execute template created by activity-create"
})
```

**Expected**:
- ✅ New template executes
- ✅ Echo task runs
- ✅ Output contains "operational"
- ✅ Validation passes

**This proves**: 
- activity-create can create templates
- Created templates are executable
- **SELF-HOSTING WORKS** ✅

---

## Troubleshooting

### Issue: "Activity not found"
**Root Cause**: MCP `get_activity_template` tool not available  
**Solution**:
1. Check: `which metabob-cli` → Should be from repos/metabob-cli
2. Reinstall: `cd repos/metabob-cli && pip install -e .`
3. Restart OpenCode completely
4. Retry test

### Issue: "Failed to create template"
**Root Cause**: Backend error or authentication issue  
**Solution**:
1. Check backend health: `curl http://localhost:8080/health`
2. Check session token: `cat .metabob/state | jq .session_metadata.session_token`
3. Verify token works: `curl -H "Authorization: Bearer $(cat .metabob/state | jq -r .session_metadata.session_token)" http://localhost:8080/v2/activities/templates | jq . | head`

### Issue: Template validation fails
**Root Cause**: Variable mismatch or task format issue  
**Solution**:
1. Check activity-create required variables: `search_activities({ query: "Activity Create", verbose: true })`
2. Verify JSON formatting in `tasks` variable (must be valid JSON string)
3. Check backend logs for specific validation error

---

## Success Criteria Checklist

After completing all tests:

- [ ] search_activities returns 20+ templates
- [ ] Simple activity executes successfully  
- [ ] activity-create template executes (all 5 tasks)
- [ ] New template appears in search results
- [ ] Self-created template executes successfully

**If ALL checked**: System is fully operational! ✅  
**If ANY unchecked**: Review troubleshooting section and check logs

---

## Documentation to Update

After successful validation:
1. Update `ACTIVITY_SYSTEM_WORKING.md` with new execution evidence
2. Add test results to `ACTIVITY_EXECUTION_STATUS_FEB12.md`
3. Create `SELF_HOSTING_PROOF_COMPLETE.md` with execution logs

---

## Next Steps After Validation

Once self-hosting is proven:
1. **Create more templates** using activity-create
2. **Test template evolution** (activity-evolve template)
3. **Build complex workflows** (chain multiple activities)
4. **Performance testing** (measure execution metrics)
5. **Integration testing** (activities calling other activities)

---

**Estimated Time**: 10-15 minutes for full validation  
**Critical Path**: Test 1 → Test 2 → Test 3 → Test 4 → Test 5

**Status**: 🟡 READY TO EXECUTE (after OpenCode restart)
