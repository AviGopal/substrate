# Activity Execution via Agent - Test Plan

## Goal
Demonstrate that an agent can:
1. Use the `activity` tool to execute `create-activity-template`
2. Create a new template that gets stored in SurrealDB
3. Execute the newly created template

## Test Scenario

### Scenario: Create "Bug Fix Complete" Template

**User Request**:
> "I need an activity template for fixing bugs that includes reproducing the bug, fixing it, adding tests, and committing the changes."

**Expected Agent Behavior**:

1. **Agent recognizes pattern**: "create activity template" → use `create-activity-template`

2. **Agent calls activity tool**:
```typescript
await activity({
  activityId: "create-activity-template",
  variables: {
    templateName: "Bug Fix Complete",
    templateId: "bug-fix-complete",
    category: "bugfix",
    description: "Fix a bug with reproduction, tests, and commit"
  },
  reason: "User requested bug fix template with full workflow"
})
```

3. **Activity executor runs 4 tasks**:
   - Task 1: `analyze-examples` - Agent searches for similar templates
   - Task 2: `design-task-graph` - Agent designs 4-task workflow
   - Task 3: `write-template-json` - Agent creates JSON template
   - Task 4: `register-template` - Agent registers with backend

4. **Result**: New template `bug-fix-complete-{hash}` in SurrealDB

5. **Agent can then use new template**:
```typescript
await activity({
  activityId: "bug-fix-complete",
  variables: {
    bugDescription: "Users getting logged out after 5 minutes",
    bugLocation: "src/auth/session.ts"
  },
  reason: "User reported session timeout bug"
})
```

## Manual Test Steps

### Via OpenCode TUI

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
opencode

# In chat:
> Create an activity template for bug fixes that includes:
> 1. Reproducing the bug
> 2. Fixing the issue
> 3. Adding regression tests
> 4. Committing with clear message
```

**Expected**: Agent uses `search_activities`, finds `create-activity-template`, executes it

### Via OpenCode Run Command

```bash
opencode run "Create an activity template called 'Feature Complete' for implementing features with design, implementation, tests, and documentation"
```

**Expected**: Non-interactive execution, template created

### Via ACP Delegation

```bash
# From another agent or script
curl -X POST http://localhost:6677/acp/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "target": "docker://devbob-opencode",
    "prompt": "Create an activity template for refactoring code with analysis, refactor, tests, and validation",
    "variables": {
      "templateName": "Refactor with Tests",
      "category": "refactor"
    }
  }'
```

**Expected**: Remote execution, template created in target container

## Verification Steps

After any execution method:

```bash
# 1. Check variant count increased
curl -H "X-Internal-Request: true" \
  http://localhost:8080/activity-recommendations/variants | jq 'length'

# 2. Find new template
curl -H "X-Internal-Request: true" \
  http://localhost:8080/activity-recommendations/variants | \
  jq '.[] | select(.activity_id | contains("bug-fix")) | .variant_id'

# 3. Get template details
NEW_ID="bug-fix-complete-XXXXXXXX"  # Replace with actual ID
curl -H "X-Internal-Request: true" \
  "http://localhost:8080/activity-recommendations/variants/${NEW_ID}/details" | \
  jq '.variant_name, .task_steps[].title'

# 4. Verify it's executable
# Try using the new template in another session
opencode run "Fix the authentication bug using the bug-fix-complete template"
```

## Current Status

✅ **Backend Ready**: Endpoints working, templates stored
✅ **Simulated Execution**: Proven template creation works
⏳ **Agent Tool Call**: Need to test via actual agent session
⏳ **Full E2E**: Need to verify agent → execution → new template → use new template

## Next Action

Run the actual test with OpenCode agent to demonstrate:
1. Agent tool call
2. Template creation
3. Registration in SurrealDB
4. Execution of newly created template

---

**Prepared by**: Activity Mode Agent
**Date**: February 7, 2026
**Status**: Ready for execution testing
