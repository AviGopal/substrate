# DevBob Self-Sustaining Development Roadmap

**Status**: Active Planning  
**Created**: January 27, 2026  
**Goal**: Enable DevBob containers to develop themselves incrementally

---

## Current State Assessment

### ✅ What Works
- **Containers Running**: All 4 DevBob containers are up and healthy
- **OpenCode Installed**: Version `0.0.0-feat/activity-execution-fixes` working
- **Metabob-CLI MCP**: Running as sidecar (stdio transport) in each container
- **Basic Persistence**: `.opencode` and `.metabob` directories mounted as volumes
- **ACP Servers**: Running on ports 3001-3004 (but not externally accessible - network issue)

### ❌ Current Blockers

#### 1. **ACP Network Not Accessible from Host**
- **Symptom**: `curl http://localhost:3001/acp/sessions` fails with "Unable to connect"
- **Impact**: Cannot delegate to containers via `acp_delegate`
- **Root Cause**: Likely port mapping or network configuration issue
- **Priority**: HIGH - blocks all delegation

#### 2. **No Activity Persistence/Recovery**
- **Symptom**: If container restarts, no way to resume interrupted activities
- **Impact**: Lost work, no failure recovery
- **Root Cause**: No activity state checkpointing
- **Priority**: HIGH - blocks self-sustaining development

#### 3. **No Centralized Activity Management**
- **Symptom**: No way to track activities across all DevBob containers
- **Impact**: No coordination, no learning from past executions
- **Root Cause**: No metabob-rpc-api activity endpoints
- **Priority**: MEDIUM - limits multi-agent coordination

#### 4. **No Autonomous Task Queue**
- **Symptom**: Containers just sit idle, no self-assigned work
- **Impact**: Not self-sustaining, requires manual delegation
- **Root Cause**: No task queue or autonomous work selection
- **Priority**: MEDIUM - needed for true autonomy

#### 5. **No Health/Status Monitoring**
- **Symptom**: Don't know if agents are working, stuck, or failed
- **Impact**: No observability, hard to debug
- **Root Cause**: No status reporting to central API
- **Priority**: LOW - nice to have

---

## Dependency-Ordered Implementation Plan

### Phase 0: Fix Network Access (UNBLOCKS EVERYTHING)
**Duration**: 1-2 hours  
**Priority**: CRITICAL

**Problem**: ACP servers running but not accessible from host

**Tasks**:
1. Debug port mapping in docker-compose.devbob.yaml
2. Verify network connectivity between host and containers
3. Test ACP endpoints from host
4. Document working ACP delegation pattern

**Success Criteria**:
```bash
# Should work:
curl http://localhost:3001/acp/sessions
# Returns: [] or list of sessions

acp_delegate({
  target: "docker://devbob-rpc-api",
  taskDescription: "Test connectivity",
  prompt: "List files in /workspace"
})
# Returns: successful delegation
```

**Implementation**:
- Activity: `fix-devbob-network-access`
- Location: Run in host (exp-repo) OpenCode session
- Estimated Cost: $0.10, 10 minutes

---

### Phase 1: Activity Persistence & Recovery (ENABLES RELIABILITY)
**Duration**: 1 day  
**Priority**: HIGH  
**Depends On**: Phase 0

**Problem**: Lost activity state on container restart, no recovery from failures

**Tasks**:

#### 1.1: Activity State Checkpointing
**What**: Save activity progress to persistent volume

**Implementation**:
```typescript
// In OpenCode activity execution system
interface ActivityCheckpoint {
  activityId: string;
  templateId: string;
  variables: Record<string, any>;
  currentTask: number;           // Which task (0-based)
  completedTasks: string[];      // Task IDs completed
  failedTasks: {
    taskId: string;
    error: string;
    timestamp: string;
  }[];
  startedAt: string;
  lastCheckpoint: string;
  status: "running" | "paused" | "failed" | "completed";
}

// Save checkpoint after each task
async function saveCheckpoint(activity: Activity): Promise<void> {
  const checkpoint: ActivityCheckpoint = {
    activityId: activity.id,
    templateId: activity.templateId,
    variables: activity.variables,
    currentTask: activity.currentTaskIndex,
    completedTasks: activity.completedTaskIds,
    failedTasks: activity.failedTasks,
    startedAt: activity.startedAt,
    lastCheckpoint: new Date().toISOString(),
    status: activity.status
  };
  
  // Save to .opencode/activities/checkpoints/{activityId}.json
  await fs.writeFile(
    `.opencode/activities/checkpoints/${activity.id}.json`,
    JSON.stringify(checkpoint, null, 2)
  );
}
```

**Storage Location**: `{workspace}/.opencode/activities/checkpoints/`  
**Persistence**: Docker volume `devbob_{repo}_opencode`

#### 1.2: Activity Resume Logic
**What**: Detect and resume interrupted activities on container start

**Implementation**:
```typescript
// On container start / ACP server start
async function resumeInterruptedActivities(): Promise<void> {
  const checkpointDir = ".opencode/activities/checkpoints";
  const checkpoints = await fs.readdir(checkpointDir);
  
  for (const file of checkpoints) {
    const checkpoint = JSON.parse(await fs.readFile(`${checkpointDir}/${file}`));
    
    if (checkpoint.status === "running" || checkpoint.status === "paused") {
      console.log(`[RESUME] Found interrupted activity: ${checkpoint.activityId}`);
      
      // Resume from current task
      await activity_replay({
        activityId: checkpoint.activityId,
        startFromTask: checkpoint.currentTask,
        skipValidation: false
      });
    }
  }
}
```

**Trigger**: Entrypoint script calls `opencode activity resume --all` on start

#### 1.3: Failure Recovery Strategy
**What**: Handle different failure modes

**Recovery Modes**:
1. **Task Failure**: Retry task with same inputs (max 3 attempts)
2. **Container Crash**: Resume from last checkpoint on restart
3. **Network Failure**: Pause activity, auto-resume when connection restored
4. **Validation Failure**: Mark task failed, continue to next task (or stop if critical)

**Configuration**:
```json
{
  "activity_recovery": {
    "enabled": true,
    "auto_resume_on_start": true,
    "max_retries_per_task": 3,
    "retry_backoff_ms": [1000, 5000, 15000],
    "pause_on_network_failure": true,
    "fail_fast_on_validation": false,
    "checkpoint_interval_tasks": 1
  }
}
```

**Success Criteria**:
- Container restart → activity resumes from checkpoint
- Task failure → retries with backoff
- All checkpoints persisted in volume

**Activity**: `implement-activity-persistence-recovery`  
**Estimated**: $0.50, 4 hours

---

### Phase 2: Centralized Activity Management (ENABLES COORDINATION)
**Duration**: 2 days  
**Priority**: HIGH  
**Depends On**: Phase 1

**Problem**: No way to track activities across all DevBob containers, no learning

**Tasks**:

#### 2.1: Activity Registry in metabob-rpc-api
**What**: REST API to register, track, and query activities across all agents

**Endpoints**:
```typescript
// Register activity execution
POST /api/v1/activities/executions
{
  activityId: string;
  templateId: string;
  agentName: string;           // "devbob-rpc-api"
  repository: string;          // "metabob-rpc-api"
  variables: Record<string, any>;
  status: "started" | "running" | "completed" | "failed";
  startedAt: string;
}

// Update activity status
PATCH /api/v1/activities/executions/:id
{
  status: "completed" | "failed";
  duration: number;            // ms
  cost: number;                // $
  tokens: { input, output, cache };
  errors?: string[];
  completedTasks: string[];
  failedTasks: string[];
}

// Get activity execution details
GET /api/v1/activities/executions/:id

// List activities (with filters)
GET /api/v1/activities/executions?agent=devbob-rpc-api&status=completed&limit=50

// Get activity metrics (for learning)
GET /api/v1/activities/templates/:templateId/metrics
{
  templateId: string;
  totalExecutions: number;
  successRate: number;
  avgDuration: number;
  avgCost: number;
  errorPatterns: { error: string, count: number }[];
}
```

**Database Schema** (SurrealDB):
```sql
DEFINE TABLE activity_execution SCHEMAFULL;
DEFINE FIELD activity_id ON TABLE activity_execution TYPE string;
DEFINE FIELD template_id ON TABLE activity_execution TYPE string;
DEFINE FIELD agent_name ON TABLE activity_execution TYPE string;
DEFINE FIELD repository ON TABLE activity_execution TYPE string;
DEFINE FIELD variables ON TABLE activity_execution TYPE object;
DEFINE FIELD status ON TABLE activity_execution TYPE string;
DEFINE FIELD started_at ON TABLE activity_execution TYPE datetime;
DEFINE FIELD completed_at ON TABLE activity_execution TYPE datetime;
DEFINE FIELD duration_ms ON TABLE activity_execution TYPE int;
DEFINE FIELD cost_usd ON TABLE activity_execution TYPE float;
DEFINE FIELD tokens ON TABLE activity_execution TYPE object;
DEFINE FIELD completed_tasks ON TABLE activity_execution TYPE array;
DEFINE FIELD failed_tasks ON TABLE activity_execution TYPE array;
DEFINE FIELD errors ON TABLE activity_execution TYPE array;
DEFINE INDEX idx_activity_id ON TABLE activity_execution COLUMNS activity_id UNIQUE;
DEFINE INDEX idx_template_id ON TABLE activity_execution COLUMNS template_id;
DEFINE INDEX idx_agent_name ON TABLE activity_execution COLUMNS agent_name;
DEFINE INDEX idx_status ON TABLE activity_execution COLUMNS status;
```

#### 2.2: Activity Reporting from DevBob Containers
**What**: DevBob agents report activity lifecycle to central API

**Integration Points**:
```typescript
// In OpenCode activity execution (ActivityExecutor)

// On activity start
await reportToAPI("POST", "/api/v1/activities/executions", {
  activityId,
  templateId,
  agentName: process.env.CODEBASE_NAME || "unknown",
  repository: getCurrentRepo(),
  variables,
  status: "started",
  startedAt: new Date().toISOString()
});

// On activity complete/fail
await reportToAPI("PATCH", `/api/v1/activities/executions/${activityId}`, {
  status: success ? "completed" : "failed",
  duration: Date.now() - startTime,
  cost: calculateCost(tokens),
  tokens,
  completedTasks,
  failedTasks,
  errors
});

async function reportToAPI(method: string, path: string, body: any) {
  const apiUrl = process.env.METABOB_API_URL || "http://metabob-api-dev:8080";
  const apiKey = process.env.METABOB_API_KEY || "";
  
  try {
    await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error(`Failed to report to API: ${error.message}`);
    // Don't fail activity on reporting failure
  }
}
```

#### 2.3: metabob-cli Activity Commands
**What**: CLI to query and manage activities from terminal

**Commands**:
```bash
# List recent activities
metabob-cli activity list --agent devbob-rpc-api --limit 10

# Show activity details
metabob-cli activity show <activity-id>

# Get template metrics
metabob-cli activity metrics <template-id>

# Generate cost report
metabob-cli activity cost-report --since 2026-01-01 --by-agent

# Resume failed activity
metabob-cli activity resume <activity-id>
```

**Implementation**: Add `activity` command group to metabob-cli

**Success Criteria**:
- Activities reported to central API
- Metrics queryable via API and CLI
- Learning data available for routing decisions

**Activity**: `implement-centralized-activity-management`  
**Estimated**: $1.50, 8 hours

---

### Phase 3: Autonomous Task Queue (ENABLES SELF-SUSTAINING)
**Duration**: 3 days  
**Priority**: MEDIUM  
**Depends On**: Phase 2

**Problem**: Containers sit idle, no self-assigned work

**Tasks**:

#### 3.1: Task Queue in metabob-rpc-api
**What**: Central queue for pending work items

**Endpoints**:
```typescript
// Submit task to queue
POST /api/v1/tasks/queue
{
  description: string;
  priority: "high" | "medium" | "low";
  assignedAgent?: string;      // Optional: specific agent
  tags: string[];              // ["bugfix", "authentication", "rpc-api"]
  context?: {
    relatedIssues: string[];
    files: string[];
    impulses: string[];
  };
}

// Get next task for agent
GET /api/v1/tasks/queue/next?agent=devbob-rpc-api
// Returns: task or null

// Update task status
PATCH /api/v1/tasks/:taskId
{
  status: "claimed" | "in_progress" | "completed" | "failed";
  activityId?: string;         // Link to activity execution
}

// List tasks
GET /api/v1/tasks/queue?status=pending&priority=high
```

**Database Schema**:
```sql
DEFINE TABLE task_queue SCHEMAFULL;
DEFINE FIELD task_id ON TABLE task_queue TYPE string;
DEFINE FIELD description ON TABLE task_queue TYPE string;
DEFINE FIELD priority ON TABLE task_queue TYPE string;
DEFINE FIELD assigned_agent ON TABLE task_queue TYPE string;
DEFINE FIELD claimed_by ON TABLE task_queue TYPE string;
DEFINE FIELD tags ON TABLE task_queue TYPE array;
DEFINE FIELD context ON TABLE task_queue TYPE object;
DEFINE FIELD status ON TABLE task_queue TYPE string;
DEFINE FIELD created_at ON TABLE task_queue TYPE datetime;
DEFINE FIELD claimed_at ON TABLE task_queue TYPE datetime;
DEFINE FIELD completed_at ON TABLE task_queue TYPE datetime;
DEFINE FIELD activity_id ON TABLE task_queue TYPE string;
DEFINE INDEX idx_status ON TABLE task_queue COLUMNS status;
DEFINE INDEX idx_priority ON TABLE task_queue COLUMNS priority;
DEFINE INDEX idx_assigned_agent ON TABLE task_queue COLUMNS assigned_agent;
```

#### 3.2: Autonomous Work Loop in DevBob
**What**: Each DevBob container polls queue and self-assigns work

**Implementation**:
```typescript
// Add to entrypoint or new service
async function autonomousWorkLoop() {
  const agentName = process.env.CODEBASE_NAME;
  const pollInterval = parseInt(process.env.WORK_POLL_INTERVAL || "60000"); // 1 min
  
  while (true) {
    try {
      // Get next task from queue
      const task = await fetch(
        `${METABOB_API_URL}/api/v1/tasks/queue/next?agent=${agentName}`
      ).then(r => r.json());
      
      if (!task) {
        // No work, sleep
        await sleep(pollInterval);
        continue;
      }
      
      console.log(`[WORK] Claimed task: ${task.taskId} - ${task.description}`);
      
      // Update status to claimed
      await updateTaskStatus(task.taskId, "claimed");
      
      // Route task to activity template
      const routingDecision = await routeTask(task);
      
      if (!routingDecision.templateId) {
        console.log(`[WORK] No template found, skipping task`);
        await updateTaskStatus(task.taskId, "failed", "No matching template");
        continue;
      }
      
      // Execute activity
      const result = await executeActivity({
        templateId: routingDecision.templateId,
        variables: routingDecision.variables,
        reason: task.description
      });
      
      // Update task status
      await updateTaskStatus(task.taskId, result.success ? "completed" : "failed", {
        activityId: result.activityId
      });
      
    } catch (error) {
      console.error(`[WORK] Error in work loop: ${error.message}`);
      await sleep(pollInterval);
    }
  }
}

// Start work loop in background
if (process.env.AUTONOMOUS_MODE === "true") {
  autonomousWorkLoop().catch(console.error);
}
```

**Configuration**:
```bash
# In .env.devbob
AUTONOMOUS_MODE=true
WORK_POLL_INTERVAL=60000  # 1 minute
MAX_CONCURRENT_TASKS=2
```

#### 3.3: Task Routing (Simple Version)
**What**: Match tasks to activity templates

**Algorithm**:
```typescript
async function routeTask(task: Task): Promise<RoutingDecision> {
  // Simple keyword matching (before full intent routing)
  const keywords = extractKeywords(task.description);
  
  // Match to templates
  const templates = await searchActivities({});
  
  for (const template of templates) {
    const score = scoreTemplate(template, keywords, task.tags);
    if (score > 0.7) {
      return {
        templateId: template.id,
        variables: extractVariables(task, template),
        confidence: score
      };
    }
  }
  
  return { templateId: null, confidence: 0 };
}
```

**Success Criteria**:
- Tasks added to queue
- DevBob agents poll and claim tasks
- Activities executed autonomously
- Status updates sent to API

**Activity**: `implement-autonomous-task-queue`  
**Estimated**: $2.00, 12 hours

---

### Phase 4: Health & Status Monitoring (ENABLES OBSERVABILITY)
**Duration**: 1 day  
**Priority**: LOW  
**Depends On**: Phase 2

**Problem**: No visibility into what agents are doing

**Tasks**:

#### 4.1: Agent Heartbeat
**What**: Periodic status reports to central API

**Implementation**:
```typescript
// Every 30 seconds
async function sendHeartbeat() {
  await fetch(`${METABOB_API_URL}/api/v1/agents/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentName: process.env.CODEBASE_NAME,
      status: "idle" | "working" | "error",
      currentActivity: currentActivity?.id || null,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      lastActivity: lastActivityTimestamp
    })
  });
}

setInterval(sendHeartbeat, 30000);
```

#### 4.2: Status Dashboard
**What**: Simple web UI showing agent status

**Endpoint**: `GET /api/v1/agents/status`
```json
[
  {
    "name": "devbob-rpc-api",
    "status": "working",
    "currentActivity": "act_123",
    "uptime": 3600,
    "lastHeartbeat": "2026-01-27T17:00:00Z"
  },
  ...
]
```

**CLI**: `metabob-cli agents list`

**Success Criteria**:
- Heartbeats sent every 30s
- Status queryable via API
- CLI shows live agent status

**Activity**: `implement-agent-health-monitoring`  
**Estimated**: $0.50, 4 hours

---

## Hierarchical Activity Dependencies

```
Phase 0: fix-devbob-network-access (MUST RUN FIRST)
    ↓
Phase 1: implement-activity-persistence-recovery
    ↓
Phase 2: implement-centralized-activity-management
    ↓
    ├──→ Phase 3: implement-autonomous-task-queue
    └──→ Phase 4: implement-agent-health-monitoring
```

---

## Implementation Strategy

### Week 1: Foundation
**Goal**: Get basic delegation and persistence working

1. **Day 1**: Fix network access (Phase 0)
   - Activity: `fix-devbob-network-access`
   - Verify: `acp_delegate` works from host
   
2. **Day 2-3**: Implement persistence (Phase 1)
   - Activity: `implement-activity-persistence-recovery`
   - Verify: Container restart resumes activity

### Week 2: Coordination
**Goal**: Get central activity management working

3. **Day 4-6**: Centralized activity management (Phase 2)
   - Activity: `implement-centralized-activity-management`
   - In parallel:
     - `devbob-rpc-api`: Implement API endpoints
     - `devbob-cli`: Implement CLI commands
     - `devbob-opencode`: Implement reporting hooks
   - Verify: Activities tracked in central API

### Week 3: Autonomy
**Goal**: Get self-sustaining development working

4. **Day 7-9**: Autonomous task queue (Phase 3)
   - Activity: `implement-autonomous-task-queue`
   - Verify: Agents claim and execute tasks autonomously

5. **Day 10**: Health monitoring (Phase 4)
   - Activity: `implement-agent-health-monitoring`
   - Verify: Dashboard shows live agent status

---

## Success Metrics

### Phase 0 Success
- [ ] `curl http://localhost:3001/acp/sessions` returns valid JSON
- [ ] `acp_delegate` successfully connects to all 4 containers
- [ ] Can send tasks and receive responses

### Phase 1 Success
- [ ] Activity checkpoints saved after each task
- [ ] Container restart resumes interrupted activity
- [ ] Failed tasks retry with backoff
- [ ] No data loss on crash

### Phase 2 Success
- [ ] All activities reported to central API
- [ ] Metrics queryable via `metabob-cli activity metrics`
- [ ] Activity history viewable in dashboard
- [ ] Learning data available for routing

### Phase 3 Success
- [ ] Tasks added to queue via API
- [ ] Agents poll and claim tasks every 60s
- [ ] Activities executed autonomously
- [ ] Task status updated in queue

### Phase 4 Success
- [ ] Agents send heartbeats every 30s
- [ ] `metabob-cli agents list` shows all 4 agents
- [ ] Dashboard shows real-time status
- [ ] Alerts on agent failure

---

## Risk Mitigation

### Risk: Activity Execution Hangs
**Mitigation**: 
- Implement timeout per task (default: 30min)
- Heartbeat mechanism to detect hangs
- Auto-kill and restart on timeout

### Risk: Checkpoint Corruption
**Mitigation**:
- Atomic writes (write to .tmp, then rename)
- Checkpoint validation on load
- Keep last 3 checkpoints as backups

### Risk: API Unavailable
**Mitigation**:
- Queue reports locally (SQLite cache)
- Retry with exponential backoff
- Continue working even if API down

### Risk: Infinite Loop (Agent Keeps Failing Same Task)
**Mitigation**:
- Max retries per task (3)
- Blacklist failed tasks for 1 hour
- Alert on repeated failures

---

## Metabob-CLI Sidecar Integration

### Current State
- Metabob-CLI runs as MCP server (stdio transport) in each container
- Started automatically by OpenCode
- Provides code analysis, CPG, and annotation tools

### Enhanced Integration for Activity Management

#### 1. Activity State Sync
```bash
# metabob-cli reports activity state to backend
metabob-cli activity sync --activity-id act_123 --status running

# Backend stores state for cross-agent visibility
```

#### 2. Component Tracking
```bash
# metabob-cli tracks which components were modified by activity
metabob-cli activity track-components --activity-id act_123 \
  --files src/auth.py,src/routes.py

# Used for:
# - Impact analysis
# - Intent graph updates
# - Learning component ownership
```

#### 3. Annotation Pipeline
```bash
# After activity completes, auto-annotate key components
metabob-cli activity annotate --activity-id act_123 \
  --auto-generate \
  --max-components 5

# Generates annotations from:
# - Activity description
# - Git commit messages
# - File changes
# - Test results
```

#### 4. Cross-Agent Coordination
```bash
# Query backend for related activities in other repos
metabob-cli activity search --tags authentication --agent all

# Returns activities from all agents, used for:
# - Finding similar past work
# - Avoiding duplicate efforts
# - Learning from other agents
```

### Configuration
Add to `.metabob/config.json` in each container:
```json
{
  "base_url": "http://metabob-api-dev:8080",
  "api_key": "${METABOB_API_KEY}",
  "activity_reporting": {
    "enabled": true,
    "sync_interval": 60,
    "auto_annotate": true,
    "track_components": true
  }
}
```

---

## Next Steps

### Immediate (Now)
1. Run activity: `fix-devbob-network-access`
   ```bash
   opencode activity execute fix-devbob-network-access
   ```

2. Test delegation:
   ```typescript
   acp_delegate({
     target: "docker://devbob-rpc-api",
     taskDescription: "Test connectivity",
     prompt: "List files in /workspace and show git status"
   })
   ```

### This Week (Week 1)
1. Implement Phase 1 (persistence)
2. Test recovery on container restart
3. Document working patterns

### Next Week (Week 2)
1. Implement Phase 2 (central activity management)
2. Multi-agent activity tracking working
3. Learning data available

### Week 3
1. Implement Phase 3 (autonomous queue)
2. Agents self-assign work
3. System is self-sustaining

---

## Related Documents
- [INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md](./INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md) - Future vision
- [MULTI_CONTAINER_DEVBOB_ARCHITECTURE.md](./MULTI_CONTAINER_DEVBOB_ARCHITECTURE.md) - Container architecture
- [DEVBOB_CONFIGURATION.md](./DEVBOB_CONFIGURATION.md) - Configuration guide

---

**Status**: Ready for Phase 0 Implementation  
**Next Action**: Fix ACP network access  
**Estimated Timeline**: 3 weeks to full self-sustaining operation
