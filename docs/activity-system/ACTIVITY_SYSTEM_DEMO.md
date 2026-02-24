# Activity System Demo - Docker Environment

This document demonstrates how the activity system works in the DevBob Docker environment, showing what gets generated and where data is stored.

## Environment Setup

The docker-compose environment includes:
- **devbob-clean**: Container running OpenCode with activity system
- **metabob-redis**: Redis for activity template and metrics storage
- **metabob-surreal**: SurrealDB for activity execution records
- **api-server-dev**: Metabob RPC API for backend operations

## Activity Storage Architecture

### 1. Redis Storage (Template Cache & Metrics)

Activity templates and metrics are stored in Redis for fast access:

```bash
# Example: Activity template stored in Redis
docker exec metabob-redis redis-cli GET "activity:template:hello-world-minimal-31727b21"
```

**Output:**
```json
{
  "variant_id": "hello-world-minimal-31727b21",
  "activity_id": "hello-world-minimal",
  "variant_name": "Hello World Minimal",
  "description": "Minimal test activity with no context requirements - single task that writes a file",
  "version": 1,
  "task_steps": [],
  "variables": {},
  "context_requirements": [],
  "expected_duration_ms": 10000,
  "expected_cost": 0.01,
  "expected_quality_score": 0.5,
  "created_at": "2026-02-20T18:45:28.681634",
  "genealogy": {
    "content_hash": "31727b21",
    "parent_hash": null,
    "generation": 0
  }
}
```

### 2. SurrealDB Storage (Execution Records)

Activity execution data is stored in SurrealDB with schema:
- `activity_execution`: Individual execution records with results
- `template_metrics`: Aggregated metrics (success rate, avg cost, avg duration)
- `failure_patterns`: Common failure modes for learning

### 3. Filesystem Storage (Local State)

Activity state and artifacts are stored locally:
- `~/.local/share/opencode/activities/act_*`: Activity execution directories
- `.opencode/activities/`: Project-level activity metadata
- Activity artifacts (temp files, logs, outputs) in ACTIVITY_TEMP_DIR

## Running Activities in Docker

### Method 1: Activity Template Execution (Recommended)

This is the NEW activity system that uses templates:

```bash
# List available activity templates
docker exec devbob-clean sh -c "cd /workspace && opencode activity template list"

# Execute a template (requires prompts directory approach)
# Note: Direct template execution via CLI is being migrated to use opencode run
```

### Method 2: Prompts Directory Execution (Current CLI)

```bash
# Execute from a prompts directory
docker exec devbob-clean sh -c "cd /workspace && opencode activity run .activity-test"
```

### Method 3: Via Tool Call (Programmatic)

The `activity` tool is used by agents to execute templates:

```typescript
activity({
  templateId: "hello-world-minimal",
  variables: {
    testId: "demo-123",
    name: "DevBobDemo"
  },
  reason: "Test activity execution in Docker environment"
})
```

## What Gets Generated

### During Activity Execution

1. **Activity Directory**: `~/.local/share/opencode/activities/act_<id>`
   - Session data
   - Task outputs
   - Execution logs

2. **Temporary Artifacts**: `ACTIVITY_TEMP_DIR` environment variable points to:
   - Task-specific temp files
   - Agent session artifacts
   - Build outputs

3. **Redis Updates**:
   - Execution started event
   - Task completion events
   - Final metrics update

4. **SurrealDB Records**:
   - Activity execution record created
   - Task results stored
   - Metrics aggregated

### After Activity Completion

1. **Local Storage**:
   ```bash
   ~/.local/share/opencode/
   ├── activities/
   │   └── act_mlycv7bo_7e0831d496995961/
   │       ├── activity.json           # Activity metadata
   │       ├── execution-log.txt       # Execution log
   │       └── tasks/
   │           ├── task-1/
   │           │   ├── session.json    # Agent session data
   │           │   └── output.txt      # Task output
   │           └── task-2/
   │               └── ...
   ```

2. **Redis Keys**:
   ```
   activity:template:<template-id>    # Template definition
   activity:metrics:<template-id>     # Aggregated metrics
   activity:execution:<exec-id>       # Execution state (temporary)
   ```

3. **SurrealDB Tables**:
   ```sql
   -- Activity execution record
   SELECT * FROM activity_execution WHERE activity_id = '<id>';
   
   -- Template metrics (success rate, costs, duration)
   SELECT * FROM template_metrics WHERE template_id = '<template-id>';
   
   -- Failure patterns for learning
   SELECT * FROM failure_patterns WHERE template_id = '<template-id>';
   ```

## Verifying Activity Execution

### Check Redis for Activity Templates

```bash
# List all activity keys
docker exec metabob-redis redis-cli KEYS "activity:*"

# Get specific template
docker exec metabob-redis redis-cli GET "activity:template:hello-world-minimal-31727b21" | jq '.'

# Get template metrics
docker exec metabob-redis redis-cli GET "activity:metrics:hello-world-minimal-31727b21" | jq '.'
```

### Check SurrealDB for Execution Records

```bash
# Query recent activity executions
curl -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  -H "Content-Type: application/json" \
  -d 'SELECT * FROM activity_execution ORDER BY created_at DESC LIMIT 10;'
```

### Check Filesystem for Activity Data

```bash
# List activity directories
docker exec devbob-clean find /root/.local/share/opencode/activities -type d -name "act_*"

# View activity metadata
docker exec devbob-clean cat /root/.local/share/opencode/activities/act_*/activity.json
```

## Activity Lifecycle Flow

```
1. User/Agent calls activity tool
   ↓
2. Template loaded from Redis
   ↓
3. Activity directory created in ~/.local/share/opencode/activities/
   ↓
4. For each task:
   - Sub-agent spawned with task prompt
   - Session data stored in task directory
   - Output artifacts created
   ↓
5. Execution completes
   ↓
6. Metrics posted to:
   - Redis (template metrics)
   - SurrealDB (execution record)
   ↓
7. Learning loop updates:
   - Success rate calculated
   - Average cost/duration updated
   - Failure patterns recorded (if failed)
```

## Key Observations

1. **Redis** stores templates and metrics for fast Thompson Sampling selection
2. **SurrealDB** stores full execution history for analysis and learning
3. **Filesystem** stores local activity state and artifacts
4. **Activity System** is fully containerized and works across Docker environments
5. **Data flows** from execution → Redis metrics → SurrealDB history → Learning loop

## Next Steps

To fully test the activity system:

1. ✅ Verify Redis has activity templates
2. ✅ Check current activity execution method
3. ⏳ Execute a test activity using proper CLI
4. ⏳ Verify SurrealDB receives execution data
5. ⏳ Demonstrate learning loop metrics update
6. ⏳ Show activity artifacts generated

## Current Status

- **Docker Environment**: ✅ Running and healthy
- **Redis Storage**: ✅ Activity templates present
- **CLI Command**: ⚠️  Needs correct syntax (migrating from execute to run)
- **SurrealDB**: ⏳ Need to test with correct API call
- **Activity Execution**: ⏳ Need to use prompts directory approach
