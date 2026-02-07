# Activity Execution Guide

## Why Activities Can't Execute Yet

The repositories are clean, but to execute activities you need:

### 1. Backend Must Be Running
Activities are stored in SurrealDB and accessed via metabob-cli MCP:
```bash
# Check if backend is running
docker ps | grep surreal
docker ps | grep metabob-rpc-api
```

### 2. Bootstrap Activities Must Be Seeded
The 8 bootstrap activities from metabob-proto must be in SurrealDB:
```bash
cd repos/metabob-proto
python scripts/seed_activities.py
```

### 3. metabob-cli MCP Must Be Available
OpenCode accesses activities through metabob-cli:
```bash
# Check MCP status
cd repos/metabob-opencode
bun run packages/opencode/src/index.ts metabob status
```

## Using DevBob Containers for Validation

### Quick Start (Single Container)
```bash
# Start devbob-opencode container
./devbob start

# Check logs
docker logs devbob-opencode

# Attach to running container's OpenCode session
./devbob attach opencode

# Or exec into container
docker exec -it devbob-opencode bash
```

### Full Stack (With Backend)
```bash
# Set mode to include backend services
export DEVBOB_MODE=dev

# Start all services
./devbob start

# Check all services
docker ps

# Should see:
# - redis
# - surrealdb
# - metabob-rpc-api-server
# - metabob-rpc-api-worker
# - devbob-opencode
```

### Running a Test Session
```bash
# Start devbob
./devbob start

# Attach to the running OpenCode agent
./devbob attach opencode

# In the session, the agent should be able to:
# 1. Use metabob-cli's search_activities tool
# 2. Get activity details via get_activity tool
# 3. Execute via activity tool
# 4. Report results via post_activity_result tool
```

## How to Execute Activities

### Step 1: Search for Activities (via MCP)
The agent should use metabob-cli's `search_activities` tool:
```typescript
// In agent session
search_activities({
  query: "fix bug",
  category: "bugfix",
  limit: 5
})
```

### Step 2: Get Activity Details (via MCP)
```typescript
get_activity({
  activity_id: "bug-fix"
})
```

### Step 3: Execute Activity
```typescript
activity({
  activityId: "bug-fix",
  variables: {
    bug_description: "TypeError in Tool.execute",
    error_message: "Cannot read property 'stdout' of null"
  },
  reason: "Fixing TypeError when processing bash output"
})
```

### Step 4: Results Automatically Reported
- Execution tracked in `~/.local/share/opencode/storage/activity-execution/`
- Results sent back to backend via `post_activity_result` tool
- Backend learns from execution for future recommendations

## Inspecting Activity Execution Reports

### Find All Activity Executions
```bash
# List all activity executions for current project
ls ~/.local/share/opencode/storage/activity-execution/<project-id>/

# Or use CLI
cd repos/metabob-opencode
bun run packages/opencode/src/index.ts activity list
```

### View Specific Activity Details
```bash
# Read activity execution JSON
cat ~/.local/share/opencode/storage/activity-execution/<project-id>/<activity-id>.json | jq .

# Or use CLI for formatted output
bun run packages/opencode/src/index.ts activity list --verbose
```

### Activity Execution Report Structure
```json
{
  "id": "act_...",
  "templateId": "bug-fix",
  "templateVersion": 1,
  "status": "done",
  "reason": "Fixing TypeError...",
  "variables": { "bug_description": "...", "error_message": "..." },
  "stats": {
    "duration": 180000,
    "cost": { "total": 2.45 },
    "tokens": { "input": 15000, "output": 3000, "cache": { "read": 5000 } }
  },
  "tasks": [
    {
      "id": "understand-bug",
      "status": "completed",
      "duration": 45000,
      "sessionId": "ses_..."
    },
    {
      "id": "locate-source",
      "status": "completed",
      "duration": 60000,
      "sessionId": "ses_..."
    },
    {
      "id": "implement-fix",
      "status": "completed",
      "duration": 75000,
      "sessionId": "ses_..."
    }
  ],
  "impulses": { /* impulse pointers */ },
  "commits": ["abc123", "def456"],
  "comparison": { /* expected vs actual */ }
}
```

### Inspect Individual Task Sessions
Each task creates a session. To see what happened in each step:
```bash
# Find sessions for an activity
cat ~/.local/share/opencode/storage/activity-execution/<project-id>/<activity-id>.json | \
  jq -r '.tasks[].sessionId'

# View specific task session
cat ~/.local/share/opencode/storage/session/<project-id>/<session-id>.json | jq .

# View messages in that session
ls ~/.local/share/opencode/storage/message/<session-id>/
```

### Use activity-error-inspector Tool
For failed activities, use the inspector tool (available in agent sessions):
```typescript
activity_error_inspector({
  activityId: "act_..." // or omit to see all failed activities
})
```

This provides:
- Failure reason
- Which task failed
- Error messages
- Session IDs for debugging
- Suggested fixes

## Validation Workflow with DevBob

### End-to-End Test
```bash
# 1. Start full stack
export DEVBOB_MODE=dev
./devbob start

# 2. Verify backend is ready
curl http://localhost:8080/health  # rpc-api
docker exec devbob-opencode metabob-cli --version  # cli available

# 3. Seed bootstrap activities
docker exec devbob-opencode bash -c "cd /workspace/metabob-proto && python scripts/seed_activities.py"

# 4. Start OpenCode session
./devbob attach opencode

# 5. In the session, test activity execution:
# "Please search for activities related to bug fixing, then execute one with appropriate variables"

# 6. After execution, inspect results:
docker exec devbob-opencode bash -c "cd /workspace/metabob-opencode && bun run packages/opencode/src/index.ts activity list --verbose"
```

### Monitoring Execution
```bash
# Watch activity execution in real-time
watch -n 2 'ls -lht ~/.local/share/opencode/storage/activity-execution/*/ | head -20'

# Monitor metabob-cli logs
docker logs -f devbob-opencode 2>&1 | grep -i activity

# Monitor backend logs
docker logs -f metabob-rpc-api-server 2>&1 | grep -i activity
```

## Common Issues

### "Activity not found"
- Backend not seeded: Run `python repos/metabob-proto/scripts/seed_activities.py`
- MCP not connected: Check `metabob status`

### "Missing required variables"
- Check activity definition: Use `get_activity` tool first
- See required variables in the response
- Provide all required variables to `activity` tool

### "Template not found in backend"
- Backend needs seeding
- Or create new template using metabob-cli MCP tools

## Summary

**To execute activities you need:**
1. ✅ Clean repositories (DONE)
2. ⏳ Backend running (SurrealDB + metabob-rpc-api)
3. ⏳ Bootstrap activities seeded
4. ⏳ metabob-cli MCP available to OpenCode

**Once setup, the flow is:**
- Agent: `search_activities()` → finds activities from backend
- Agent: `get_activity()` → gets details and requirements
- Agent: `activity()` → executes with variables
- System: Reports results → backend learns

**To inspect execution:**
- CLI: `activity list --verbose`
- Storage: `~/.local/share/opencode/storage/activity-execution/<project>/<activity>.json`
- Tool: `activity_error_inspector()` for failures
