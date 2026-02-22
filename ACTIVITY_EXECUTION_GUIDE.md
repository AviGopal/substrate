# Activity Execution Guide - DevBob Docker Environment

## Overview

This guide shows how to execute activities in the DevBob Docker environment and track what gets generated and stored.

## Activity Execution Methods

### Method 1: Via Activity Tool (Recommended - Programmatic)

The `activity` tool is the primary interface for executing activity templates:

```typescript
// In an OpenCode session or agent
activity({
  templateId: "hello-world-minimal",
  variables: {
    testId: "demo-123",
    name: "DevBobTest"
  },
  reason: "Demonstrate activity execution and storage"
})
```

**What happens**:
1. Template loaded from Redis by `templateId`
2. Variables interpolated into task prompts
3. Activity directory created: `~/.local/share/opencode/activities/act_<id>`
4. Sub-agent spawned for each task
5. Execution tracked and metrics updated

### Method 2: Via OpenCode CLI (Prompts Directory)

```bash
# Create prompts directory
mkdir -p .activity-test
cat > .activity-test/001-hello.txt << EOF
Create a hello.txt file with "Hello World"
EOF

# Execute as activity
opencode activity run .activity-test
```

**Limitations**:
- No variable interpolation support
- Fixed prompts only
- Single execution mode

### Method 3: Via ACP Delegation (Multi-Container)

```typescript
// Delegate to devbob container
acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Execute hello-world activity",
  prompt: "Execute the hello-world-minimal activity template"
})
```

**Use case**: Delegate work to isolated container environments

## Tracking Activity Execution

### 1. Monitor Execution in Real-Time

Watch the activity as it executes:

```bash
# Follow container logs
docker logs -f devbob-clean

# Watch activity directory creation
watch -n 1 'docker exec devbob-clean ls -lth /root/.local/share/opencode/activities | head -10'
```

### 2. Check Activity Status

```bash
# List all activities with status
docker exec devbob-clean opencode activity list --verbose

# Example output:
# 📊 Activity Summary
# Total: 10 | Active: 7 | Completed: 0 | Failed: 3
# Success Rate: 0% (0/3)
```

### 3. Inspect Activity Artifacts

```bash
# List activity directories
docker exec devbob-clean find /root/.local/share/opencode/activities -type d -name "act_*"

# View activity metadata
docker exec devbob-clean cat /root/.local/share/opencode/activities/act_<id>/activity.json

# View task outputs
docker exec devbob-clean cat /root/.local/share/opencode/activities/act_<id>/tasks/task-1/output.txt
```

### 4. Check Redis Metrics Updates

```bash
# Before execution
docker exec metabob-redis redis-cli GET "activity:metrics:hello-world-minimal-31727b21"

# Execute activity (programmatically via tool)

# After execution - metrics should update
docker exec metabob-redis redis-cli GET "activity:metrics:hello-world-minimal-31727b21"

# Look for changes in:
# - total_selections (incremented)
# - total_successes or total_failures (incremented)
# - thompson_alpha or thompson_beta (updated)
# - avg_cost, avg_duration_ms (recalculated)
```

### 5. Query SurrealDB Execution History

```bash
# Query with proper headers
curl -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM activity_execution ORDER BY created_at DESC LIMIT 10;"}'
```

## What Gets Generated During Execution

### Filesystem Artifacts

```
~/.local/share/opencode/activities/act_<activity_id>_<hash>/
├── activity.json              # Activity metadata
│   {
│     "id": "act_...",
│     "template_id": "hello-world-minimal",
│     "status": "running|completed|failed",
│     "started_at": "2026-02-22T...",
│     "completed_at": "2026-02-22T...",
│     "variables": {...},
│     "metrics": {
│       "duration_ms": 45000,
│       "cost": 0.0234,
│       "tokens": { "input": 12000, "output": 500, "cache": 2000 }
│     }
│   }
│
├── execution-log.txt          # Full execution log
│   [2026-02-22 23:10:00] Activity started: hello-world-minimal
│   [2026-02-22 23:10:01] Task 1/1: Create hello file
│   [2026-02-22 23:10:15] Agent session spawned
│   [2026-02-22 23:10:45] Task completed successfully
│   [2026-02-22 23:10:46] Activity completed
│
├── tasks/
│   └── task-1/
│       ├── session.json       # Agent session data
│       │   {
│       │     "agent": "general",
│       │     "messages": [...],
│       │     "tool_calls": [...],
│       │     "result": "success"
│       │   }
│       │
│       ├── output.txt         # Task output/result
│       │   Created hello.txt successfully
│       │   File contains: Hello from DevBobTest!
│       │
│       └── artifacts/         # Task-specific files
│           └── hello.txt      # Files created by task
│
└── artifacts/                 # Activity-level artifacts
    ├── commit.txt             # Commit info (if applicable)
    └── validation.txt         # Validation results
```

### Redis Updates

**Before Execution**:
```json
{
  "total_selections": 0,
  "total_successes": 0,
  "total_failures": 0,
  "thompson_alpha": 1.0,
  "thompson_beta": 1.0,
  "avg_cost": 0.0,
  "avg_duration_ms": 0.0
}
```

**After Successful Execution**:
```json
{
  "total_selections": 1,
  "total_successes": 1,
  "total_failures": 0,
  "thompson_alpha": 2.0,        // Incremented (successes + 1)
  "thompson_beta": 1.0,         // Unchanged (failures + 1)
  "avg_cost": 0.0234,           // Updated with actual cost
  "avg_duration_ms": 45000.0,   // Updated with actual duration
  "last_updated": "2026-02-22T23:10:46.123Z"
}
```

### SurrealDB Records

**activity_execution table**:
```json
{
  "id": "execution:act_mlycv7bo_7e0831d496995961",
  "activity_id": "hello-world-minimal",
  "variant_id": "hello-world-minimal-31727b21",
  "status": "completed",
  "started_at": "2026-02-22T23:10:00.000Z",
  "completed_at": "2026-02-22T23:10:46.123Z",
  "duration_ms": 45123,
  "cost": 0.0234,
  "tokens": {
    "input": 12000,
    "output": 500,
    "cache": 2000
  },
  "variables": {
    "testId": "demo-123",
    "name": "DevBobTest"
  },
  "tasks": [
    {
      "task_id": "task-1",
      "status": "completed",
      "duration_ms": 45000,
      "cost": 0.0234
    }
  ],
  "created_at": "2026-02-22T23:10:00.000Z"
}
```

## Thompson Sampling in Action

### How Template Selection Works

1. **Fetch all candidate templates** for the requested task type
2. **Sample from Beta distribution** for each template:
   ```python
   score = random.betavariate(thompson_alpha, thompson_beta)
   ```
3. **Select template with highest score** (probabilistic)
4. **Execute selected template**
5. **Update parameters** based on result:
   - Success: `alpha += 1`
   - Failure: `beta += 1`

### Example Scenario

**Initial state** (3 templates):
```
Template A: alpha=5, beta=2  → ~71% success rate → Higher selection probability
Template B: alpha=2, beta=2  → ~50% success rate → Medium selection probability
Template C: alpha=1, beta=5  → ~17% success rate → Lower selection probability
```

**After 10 selections**:
- Template A selected 6 times (highest score most often)
- Template B selected 3 times
- Template C selected 1 time (exploration)

**This ensures**:
- ✅ Best templates used most often (exploitation)
- ✅ Weak templates still tested occasionally (exploration)
- ✅ Automatic adaptation to changing success rates
- ✅ New templates get fair evaluation

## End-to-End Example

### 1. Execute Activity

```typescript
// Via activity tool
const result = await activity({
  templateId: "hello-world-minimal",
  variables: {
    testId: `demo-${Date.now()}`,
    name: "E2ETest"
  },
  reason: "Demonstrate full activity lifecycle"
});
```

### 2. Monitor Execution

```bash
# Watch activity directory
watch 'docker exec devbob-clean ls -lth /root/.local/share/opencode/activities | head -5'

# Follow logs
docker logs -f devbob-clean 2>&1 | grep -E "(activity|task)"
```

### 3. Verify Results

```bash
# Check activity completed
docker exec devbob-clean opencode activity list | grep "Completed"

# Check artifacts created
docker exec devbob-clean find /root/.local/share/opencode/activities -name "*.txt"

# Verify Redis metrics updated
docker exec metabob-redis redis-cli GET "activity:metrics:hello-world-minimal-31727b21" | \
  jq '{selections, successes, alpha, beta}'
```

### 4. Query History

```bash
# Get execution record from SurrealDB
curl -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"SELECT * FROM activity_execution WHERE activity_id = 'hello-world-minimal' LIMIT 1;\"}"
```

## Troubleshooting

### Activity Won't Execute

**Check**: Git working tree must be clean
```bash
docker exec devbob-clean sh -c "cd /workspace && git status"
# If dirty: git commit or git stash
```

**Check**: Template exists in Redis
```bash
docker exec metabob-redis redis-cli KEYS "activity:template:*" | grep "<template-id>"
```

**Check**: Container has network access
```bash
docker exec devbob-clean ping -c 1 api-server-dev
```

### Metrics Not Updating

**Check**: Redis connection
```bash
docker exec devbob-clean sh -c "redis-cli -h metabob-redis PING"
```

**Check**: Execution completed successfully
```bash
docker exec devbob-clean opencode activity list
# Look for "Completed" status, not "Failed"
```

### Artifacts Not Found

**Check**: Activity actually ran
```bash
docker exec devbob-clean ls -la /root/.local/share/opencode/activities/
```

**Check**: Correct activity ID
```bash
# List all activities first
docker exec devbob-clean opencode activity list

# Then check specific one
docker exec devbob-clean ls -la /root/.local/share/opencode/activities/act_<id>/
```

## Summary

**Activity execution workflow**:
1. Template selected (Thompson Sampling)
2. Activity directory created
3. Tasks executed sequentially
4. Artifacts generated and stored
5. Metrics updated (Redis + SurrealDB)
6. Learning loop adapts template selection

**Storage locations**:
- **Redis**: Templates + metrics (fast access)
- **SurrealDB**: Execution history (persistent)
- **Filesystem**: Artifacts + logs (local)

**Key tools**:
- `activity` tool: Execute templates programmatically
- `opencode activity list`: View execution status
- Redis CLI: Check metrics updates
- SurrealDB API: Query execution history
