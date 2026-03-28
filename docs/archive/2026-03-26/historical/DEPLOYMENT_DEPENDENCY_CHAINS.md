# DevBob Deployment Workflow - Dependency Chain Analysis

## Overview

This document traces the complete dependency chains for the three main deployment workflows:
1. **Boredom Activity Execution** (Vessel Updates via Idle Detection)
2. **Activity Template Registration** (Template Distribution)
3. **Container Orchestration** (Multi-Container Deployment)

---

## Chain 1: Boredom Activity Execution Flow (Vessel Binary Updates)

### Entry Point
**Component:** `BoredomManager.startMonitoring()`  
**File:** `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:46`  
**Trigger:** `Session.Event.Created` event  
**Input:** `sessionID: string`

### Full Dependency Chain

```
1. BoredomManager.startMonitoring(sessionID)
   ↓
2. setInterval → BoredomManager.checkIdleAndExecute()  [every 30 seconds]
   ↓
3. BoredomManager.isIdle() checks (Date.now() - lastActivityTime) >= 5 minutes
   ↓
4. BoredomManager.fetchBoredomActivities()
   ↓
5. MCP.callTool("metabob_fetch_boredom_activities", {...})
   ↓
6. Backend API returns BoredomActivity[] sorted by priority
   ↓
7. BoredomManager.executeBoredomActivity(manager, topActivity)
   ↓
8. TemplateRepository.get(activity.template_id)
   ↓
9. Activity.create({ title: "[BOREDOM] ...", ... })
   ↓
10. executeActivityInline(templateId, variables, sessionID, reason, signal)
    ↓
11. Task execution with VesselUpdateManager functions
    ↓
12. VesselUpdateManager.getCurrentVersions("/workspace/.vessel-versions.json")
    ↓
13. MCP.callTool("metabob_get_latest_vessel_version", {...})
    ↓
14. Download new binary, VesselUpdateManager.computeChecksum()
    ↓
15. Replace binary, update tracking file
    ↓
16. MCP.callTool("metabob_post_activity_result", {...})
```

### Component Details

#### 1. BoredomManager.startMonitoring()
**File:** `boredom-manager.ts:46`  
**Purpose:** Initialize idle monitoring for a session  
**Input Type:**
```typescript
sessionID: string
```
**Output Type:**
```typescript
void (side effect: creates ManagerInstance in sessionManagers Map)
```
**What it does:** Creates a manager instance with idle tracking and starts a 30-second interval timer

---

#### 2. BoredomManager.checkIdleAndExecute()
**File:** `boredom-manager.ts:109`  
**Purpose:** Check if session is idle and trigger boredom activity  
**Input Type:**
```typescript
manager: ManagerInstance {
  sessionID: string
  lastActivityTime: number
  isExecutingBoredomActivity: boolean
  currentActivity?: {
    activityId: string
    abortController: AbortController
  }
}
```
**Output Type:**
```typescript
Promise<void>
```
**What it does:** Compares current time to lastActivityTime, fetches activities if idle >= 5 minutes

---

#### 3. BoredomManager.isIdle()
**File:** `boredom-manager.ts:155`  
**Purpose:** Determine if session has been idle for threshold duration  
**Input Type:**
```typescript
manager: ManagerInstance
```
**Output Type:**
```typescript
boolean
```
**Data Transformation:**
```typescript
idleTime = Date.now() - manager.lastActivityTime
return idleTime >= IDLE_THRESHOLD_MS (5 * 60 * 1000)
```

---

#### 4. BoredomManager.fetchBoredomActivities()
**File:** `boredom-manager.ts:163`  
**Purpose:** Query backend API for prioritized work  
**Input Type:**
```typescript
none (uses MCP client internally)
```
**Output Type:**
```typescript
Promise<BoredomActivity[]>

interface BoredomActivity {
  activity_type: "improve-template" | "debug-failures" | "optimize-performance"
  priority: number  // 0.0 - 1.0
  template_id: string
  improvement_gradient: number
  reason: string
  estimated_effort: string
  metrics: {
    success_rate: number
    avg_cost: number
    avg_duration_ms: number
    execution_count: number
    failure_patterns: Array<{pattern: string, count: number}>
    performance_trends: Record<string, any>
    last_execution: Record<string, any>
  }
}
```
**What it does:** Calls `metabob_fetch_boredom_activities` MCP tool with filters:
- `max_activities: 5`
- `priority_threshold: 0.6`
- `exclude_recent_hours: 24`

---

#### 5. MCP.callTool("metabob_fetch_boredom_activities")
**File:** `../mcp` (client call)  
**Purpose:** HTTP/RPC call to Metabob backend boredom API  
**Input Type:**
```typescript
{
  name: "metabob_fetch_boredom_activities"
  arguments: {
    max_activities: number
    priority_threshold: number
    exclude_recent_hours: number
  }
}
```
**Output Type:**
```typescript
{
  content: [{
    type: "text"
    text: JSON.stringify({
      status: "success"
      activities: BoredomActivity[]
    })
  }]
}
```
**What it does:** Backend analyzes template metrics, learning data, and recent execution history to rank activities

---

#### 6. BoredomManager.executeBoredomActivity()
**File:** `boredom-manager.ts:203`  
**Purpose:** Execute highest priority boredom activity  
**Input Type:**
```typescript
manager: ManagerInstance
boredomActivity: BoredomActivity
```
**Output Type:**
```typescript
Promise<void>
```
**What it does:** 
1. Loads template from TemplateRepository
2. Extracts variables from boredom activity metrics
3. Creates Activity instance
4. Calls `executeActivityInline()` with abort signal
5. Reports results to backend

**Data Transformation:**
```typescript
// Step 2: Extract variables
const variables = {
  success_rate: boredomActivity.metrics.success_rate,
  avg_cost: boredomActivity.metrics.avg_cost,
  avg_duration_ms: boredomActivity.metrics.avg_duration_ms,
  execution_count: boredomActivity.metrics.execution_count,
  failure_patterns: JSON.stringify(boredomActivity.metrics.failure_patterns || []),
  performance_trends: JSON.stringify(boredomActivity.metrics.performance_trends || {}),
  last_execution: JSON.stringify(boredomActivity.metrics.last_execution || {}),
}
```

---

#### 7. TemplateRepository.get()
**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`  
**Purpose:** Load activity template by ID  
**Input Type:**
```typescript
templateId: string
```
**Output Type:**
```typescript
Promise<ActivityTemplate | null>

interface ActivityTemplate {
  id: string
  name: string
  description: string
  category: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  tasks: ActivityTask[]
  integration: {...}
  metabob: {...}
}
```
**What it does:** Queries local storage (`.metabob/activities/`) or backend MCP for template

---

#### 8. Activity.create()
**File:** `repos/metabob-opencode/packages/opencode/src/session/activity.ts`  
**Purpose:** Initialize new activity execution instance  
**Input Type:**
```typescript
{
  directory: string
  branch: string
  baseCommit: string
  title: string
}
```
**Output Type:**
```typescript
Promise<Activity>

interface Activity {
  id: string  // Generated: act_<random>
  title: string
  directory: string
  branch: string
  baseCommit: string
  templateId?: string
  variables?: Record<string, unknown>
  reason?: string
  status: "pending" | "running" | "done" | "failed"
  tasks: TaskExecution[]
  stats?: {
    cost: { total: number }
    tokens: { input: number, output: number, cache: { read: number } }
  }
}
```
**What it does:** Creates activity metadata, initializes Git tracking, sets up task list

---

#### 9. executeActivityInline()
**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1136`  
**Purpose:** Execute activity template tasks sequentially  
**Input Type:**
```typescript
templateId: string
variables: Record<string, unknown>
sessionID: string
reason: string
subagent: string
abortSignal?: AbortSignal
```
**Output Type:**
```typescript
Promise<{
  activityId: string
  success: boolean
  cancelled: boolean
  error?: string
}>
```
**What it does:**
1. Creates Activity instance
2. For each task in template:
   - Resolves impulses for context
   - Interpolates variables into prompt
   - Creates sub-session with specialized agent
   - Executes task
   - Validates results
   - Handles failures/retries
3. Marks activity complete
4. Returns execution summary

---

#### 10. VesselUpdateManager.getCurrentVersions()
**File:** `repos/metabob-opencode/packages/opencode/src/vessel/update.ts:181`  
**Purpose:** Read current vessel version tracking  
**Input Type:**
```typescript
filePath?: string = "/workspace/.vessel-versions.json"
```
**Output Type:**
```typescript
Promise<VersionTracking>

interface VersionTracking {
  current: Record<string, VesselVersion>
  history: VesselUpdateRecord[]
}

interface VesselVersion {
  name: string        // "opencode" | "metabob-cli"
  version: string     // "1.2.3"
  checksum: string    // SHA-256 hex
  downloadUrl: string // Binary URL
}

interface VesselUpdateRecord {
  vessel: string
  version: string
  timestamp: string  // ISO 8601
  source: string     // "github" | "registry" | "local"
  reason: string
}
```
**What it does:** Reads JSON file, validates structure, returns current versions and history

**Data Transformation:**
```typescript
// Read file
const content = await readFile(filePath, "utf-8")
const data = JSON.parse(content)

// Validate and normalize
return {
  current: data.current || {},
  history: Array.isArray(data.history) ? data.history : []
}
```

---

#### 11. VesselUpdateManager.computeChecksum()
**File:** `repos/metabob-opencode/packages/opencode/src/vessel/update.ts:248`  
**Purpose:** Compute SHA-256 checksum for binary integrity verification  
**Input Type:**
```typescript
filePath: string
```
**Output Type:**
```typescript
Promise<string>  // Hex checksum
```
**What it does:** Reads file content, computes SHA-256 hash, returns hex string

**Data Transformation:**
```typescript
const content = await readFile(filePath)
const hash = createHash("sha256")
hash.update(content)
return hash.digest("hex")
```

---

#### 12. MCP.callTool("metabob_post_activity_result")
**File:** `boredom-manager.ts:284`  
**Purpose:** Report activity execution results to backend  
**Input Type:**
```typescript
{
  name: "metabob_post_activity_result"
  arguments: {
    activity_id: string
    template_id: string
    success: boolean
    duration: number  // milliseconds
    cost: number      // dollars
    tokens: {
      input: number
      output: number
      cache: number
    }
    cancelled: boolean
  }
}
```
**Output Type:**
```typescript
void (backend stores metrics for learning loop)
```
**What it does:** Sends execution metrics to backend for template success rate tracking

---

## Chain 2: Activity Template Registration Flow

### Entry Point
**Component:** `register_activity_template` tool  
**File:** `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts:20`  
**Trigger:** Tool call from LLM or CLI  
**Input:** Template JSON file or impulse ID

### Full Dependency Chain

```
1. Tool call: register_activity_template({ file_path: "..." })
   ↓
2. RegisterActivityTemplateTool.execute(params, ctx)
   ↓
3. Load template JSON from file or impulse
   ↓
4. ActivityTemplate.CreateOptions.parse(json)  [Zod validation]
   ↓
5. ActivityTemplate.create(options)  [Generates ID from name]
   ↓
6. [Optional] Test execution validation if validate_before_register=true
   ↓
7. TemplateRepository.save(template, backends)
   ↓
8a. Local: Write to .metabob/activities/{template.id}.json
   ↓
8b. Metabob: MCP.callTool("metabob_register_activity_template", {...})
   ↓
9. Return success with template ID
```

### Component Details

#### 1. RegisterActivityTemplateTool.execute()
**File:** `register-activity-template.ts:43`  
**Purpose:** Main entry point for template registration  
**Input Type:**
```typescript
params: {
  file_path?: string
  impulse_id?: string
  register_with_metabob?: boolean  // default: true
  validate_before_register?: boolean
  test_variables?: Record<string, any>
}
ctx: ToolContext {
  sessionID?: string
}
```
**Output Type:**
```typescript
{
  title: string
  metadata: {
    templateId: string
    name: string
    category: string
    taskCount: number
    source: "file" | "impulse"
    localRegistered: boolean
    metabobRegistered: boolean
    metabobError?: string
    validated: boolean
    validationSuccess?: boolean
    validationDuration?: number
  }
  output: string
}
```
**What it does:** Orchestrates the entire registration workflow

---

#### 2. Load Template JSON
**File:** `register-activity-template.ts:58-99`  
**Purpose:** Load template definition from file or impulse  
**Input Type:**
```typescript
// From file
file_path: string

// From impulse
impulse_id: string
```
**Output Type:**
```typescript
json: any  // Raw template JSON
```

**Data Transformation (Impulse Path):**
```typescript
// Determine storage scope
const sessionID = ctx.sessionID
const scope = sessionID ? "session" : "activity"

// Load impulse
const impulseKey = scope === "session"
  ? ["impulse-session", sessionID, params.impulse_id]
  : ["impulse-activity", params.impulse_id]

const impulse = await Storage.read<ActivityTemplate.Impulse.Schema>(impulseKey)

// Validate type
if (impulse.pointer.type !== "templateDefinition") {
  throw new Error(`Expected "templateDefinition", got "${impulse.pointer.type}"`)
}

// Extract definition
json = impulse.pointer.definition
```

**Data Transformation (File Path):**
```typescript
const content = await Bun.file(params.file_path).text()
json = JSON.parse(content)
```

---

#### 3. ActivityTemplate.CreateOptions.parse()
**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`  
**Purpose:** Validate template structure with Zod schema  
**Input Type:**
```typescript
json: any
```
**Output Type:**
```typescript
ActivityTemplate.CreateOptions {
  name: string
  description: string
  category: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  tasks: Array<{
    id: string
    subagent: string
    description: string
    dependencies: string[]
    prompt: {
      template: string
      maxTokens: number
      compressionStrategy: "filter" | "summarize"
      variables: Array<{
        name: string
        type: string
        required: boolean
        description: string
      }>
    }
    validation: {
      requiredFiles: string[]
      requiredPatterns: Array<{ file: string, pattern: string }>
      forbiddenPatterns: Array<{ file: string, pattern: string }>
      commands: Array<{ command: string, description: string }>
    }
    retry: {
      maxAttempts: number
      strategy: "simple" | "backoff"
    }
  }>
  integration: {
    preChecks: string[]
    postChecks: string[]
    qualityGates: string[]
  }
  metabob: {
    enabled: boolean
    learningMode: boolean
    targetContextTokens: number
    annotationStrategy: "key-components" | "all"
  }
}
```
**What it does:** Validates all required fields, types, and constraints

---

#### 4. ActivityTemplate.create()
**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`  
**Purpose:** Generate template ID and create full template object  
**Input Type:**
```typescript
options: ActivityTemplate.CreateOptions
```
**Output Type:**
```typescript
ActivityTemplate {
  id: string  // Generated from name
  ...options  // All fields from CreateOptions
}
```

**Data Transformation:**
```typescript
// Generate ID from name
// Example: "Update Vessel Binary" → "update-vessel-binary"
const id = options.name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

return {
  id,
  ...options
}
```

---

#### 5. Optional Validation Execution
**File:** `register-activity-template.ts:120-182`  
**Purpose:** Test-execute template before registration to ensure it works  
**Input Type:**
```typescript
template: ActivityTemplate
test_variables: Record<string, any>
```
**Output Type:**
```typescript
validationResult: {
  success: boolean
  duration: number
  cost: number
  tokens: { input: number, output: number, cache: number }
  error?: string
}
```

**Workflow:**
```typescript
// 1. Temporarily save to local storage
await TemplateRepository.save(template, ["local"])

// 2. Execute with test variables
const result = await ActivityTool.execute({
  templateId: template.id,
  variables: test_variables,
  reason: "Template validation execution"
}, ctx)

// 3. Check if execution succeeded
if (result.metadata?.status !== "done") {
  // Clean up and abort registration
  await TemplateRepository.remove(template.id, ["local"])
  throw new Error(`Template validation failed: ${result.metadata?.error}`)
}

// 4. Update template with initial success metrics
await TemplateRepository.updateMetrics(template.id, {
  executions: 1,
  successRate: 1.0,
  avgDuration: duration,
  avgCost: cost,
  avgTokens: tokens
})
```

**Why This Matters:**
- Prevents broken templates from being registered
- Templates start with 100% success rate (1/1 execution)
- Immediate preference in backend ranking
- Catches integration issues early

---

#### 6. TemplateRepository.save()
**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`  
**Purpose:** Persist template to local storage and/or backend  
**Input Type:**
```typescript
template: ActivityTemplate
backends: Array<"local" | "metabob">
```
**Output Type:**
```typescript
Promise<void>
```

**Data Transformation:**

**Local Storage (Backend: "local"):**
```typescript
// Save to: .metabob/activities/{template.id}.json
const filePath = `.metabob/activities/${template.id}.json`
await Bun.write(filePath, JSON.stringify(template, null, 2))
```

**Metabob Backend (Backend: "metabob"):**
```typescript
await MCP.callTool("metabob_register_activity_template", {
  template: {
    id: template.id,           // Required by backend (added by this tool)
    activity_id: template.id,  // Alias for id
    ...template
  }
})
```

---

## Chain 3: Container Orchestration Flow

### Entry Point
**Component:** `docker-compose up`  
**File:** `docker-compose.yaml:1`  
**Trigger:** CLI command  
**Input:** Profile selection

### Full Dependency Chain

```
1. docker-compose --profile stable --profile devbob up -d
   ↓
2. Start backend services (redis, surreal, api-server, celery-worker)
   ↓
3. Wait for metabob-rpc-api-server healthcheck
   ↓
4. Start devbob containers (clean, rpc-api, cli, opencode, dashboard)
   ↓
5. For each container: docker run with entrypoint.sh
   ↓
6. entrypoint.sh: Validate environment variables
   ↓
7. entrypoint.sh: Process opencode config (env var substitution)
   ↓
8. entrypoint.sh: Wait for backend availability (health endpoint)
   ↓
9. entrypoint.sh: Start metabob-cli dashboard (port 8001, SSE mode)
   ↓
10. entrypoint.sh: Start opencode ACP server (port 3000)
    ↓
11. opencode: Auto-start metabob-cli MCP sidecar (stdio)
    ↓
12. Container ready (3 services running)
```

### Component Details

#### 1. docker-compose Profile Selection
**File:** `docker-compose.yaml`  
**Purpose:** Select which services to start  
**Input Type:**
```bash
docker-compose --profile <profile> up -d
```

**Profiles:**
- `stable` - Backend services only
- `devbob` - Adds clean test container
- `devbob-dev` - Adds all codebase manager containers

**Output:** Service dependency graph resolved, containers started

---

#### 2. Backend Services Startup
**File:** `docker-compose.yaml:43-180`  
**Purpose:** Start shared backend infrastructure  

**Services Started:**

##### redis (line 43)
```yaml
image: redis:7-alpine
ports: 6379
command: redis-server --appendonly yes --maxmemory 2gb
```

##### surreal (line 61)
```yaml
image: surrealdb/surrealdb:latest
ports: 8000
command: start --log trace --user root --pass root file:/data/database.db
```

##### metabob-rpc-api-server (line 103)
```yaml
image: metabobapp/metabob-rpc-api:${API_VERSION:-0.16.12}
ports: 8080
healthcheck:
  test: curl -f http://localhost:8080/health || exit 1
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
depends_on:
  - redis
  - surreal
```

##### celery-worker (line 149)
```yaml
command: celery -A metabob_api.tasks worker --loglevel=info
depends_on:
  metabob-rpc-api-server:
    condition: service_healthy
```

---

#### 3. Health Check Wait
**File:** `docker-compose.yaml:124-130`  
**Purpose:** Ensure API server is ready before starting devbob containers  
**Input Type:** HTTP health probe  
**Output Type:** Boolean (healthy/unhealthy)

**Health Check Command:**
```bash
curl -f http://localhost:8080/health || exit 1
```

**Timing:**
- Interval: 10 seconds
- Timeout: 5 seconds
- Retries: 5
- Start period: 30 seconds (grace period)

**Dependency Declaration:**
```yaml
devbob-clean:
  depends_on:
    metabob-rpc-api-server:
      condition: service_healthy
```

---

#### 4. DevBob Container Startup
**File:** `docker-compose.yaml:187+`  
**Purpose:** Start OpenCode agent containers  

**Container Definitions:**

##### devbob-clean (line 187, Profile: devbob)
```yaml
image: devbob:latest
container_name: devbob-clean
ports:
  - "3000:3000"  # ACP
  - "8082:8082"  # MCP
environment:
  CODEBASE_NAME: clean-test
  REPO_URL: ""
  REPO_CHECKOUT_MODE: skip
volumes:
  - devbob_clean_workspace:/workspace
  - ./repos/cpg-inference:/opt/repos/cpg-inference:ro
```

##### devbob-rpc-api (line 248, Profile: devbob-dev)
```yaml
container_name: devbob-rpc-api
ports:
  - "3001:3000"  # ACP
  - "8081:8082"  # MCP
environment:
  CODEBASE_NAME: metabob-rpc-api
  CONTAINER_ROLE: backend-codebase-manager
volumes:
  - ./repos/metabob-rpc-api:/workspace
```

*Similar for devbob-cli, devbob-opencode, devbob-dashboard...*

---

#### 5. entrypoint.sh: Environment Validation
**File:** `docker/entrypoint.sh:50-66`  
**Purpose:** Verify required environment variables are set  
**Input Type:** Environment variables from docker-compose  
**Output Type:** Exit 1 if validation fails

**Required Variables:**
```bash
ANTHROPIC_API_KEY  # LLM provider
METABOB_API_URL    # Backend API endpoint
METABOB_PROJECT_ID # Project identifier
```

**Validation Code:**
```bash
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
  echo "ERROR: Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set"
  exit 1
fi

if [ -z "$METABOB_API_URL" ]; then
  echo "ERROR: METABOB_API_URL is not set"
  exit 1
fi

if [ -z "$METABOB_PROJECT_ID" ]; then
  echo "ERROR: METABOB_PROJECT_ID is not set"
  exit 1
fi
```

---

#### 6. entrypoint.sh: Config Processing
**File:** `docker/entrypoint.sh:68-160`  
**Purpose:** Generate opencode.json with environment variable substitution  
**Input Type:** `$OPENCODE_CONFIG` (JSON template with `${VAR}` placeholders)  
**Output Type:** `/workspace/.opencode/opencode.json` (processed)

**Data Transformation:**
```bash
# Input: OPENCODE_CONFIG with placeholders
{
  "provider": {
    "anthropic": {
      "apiKey": "${ANTHROPIC_API_KEY}"
    }
  },
  "mcp": {
    "metabob": {
      "url": "${METABOB_API_URL}",
      "projectId": "${METABOB_PROJECT_ID}"
    }
  }
}

# Process: envsubst replaces ${VAR} with actual values
echo "$OPENCODE_CONFIG" | envsubst > /workspace/.opencode/opencode.json

# Output: Concrete configuration
{
  "provider": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  },
  "mcp": {
    "metabob": {
      "url": "http://metabob-rpc-api-server:8080",
      "projectId": "proj_abc123"
    }
  }
}
```

---

#### 7. entrypoint.sh: Backend Health Check
**File:** `docker/entrypoint.sh:163-181`  
**Purpose:** Wait for backend API to be ready  
**Input Type:** HTTP health endpoint  
**Output Type:** Boolean (continue or exit)

**Health Check Logic:**
```bash
BACKEND_URL="${METABOB_API_URL}/health"
MAX_RETRIES=30
RETRY_INTERVAL=2

for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf "$BACKEND_URL" > /dev/null 2>&1; then
    echo "Backend is ready"
    break
  fi
  
  if [ $i -eq $MAX_RETRIES ]; then
    echo "ERROR: Backend not available after ${MAX_RETRIES} attempts"
    exit 1
  fi
  
  echo "Waiting for backend... (attempt $i/$MAX_RETRIES)"
  sleep $RETRY_INTERVAL
done
```

---

#### 8. entrypoint.sh: Start metabob-cli Dashboard
**File:** `docker/entrypoint.sh:183-207`  
**Purpose:** Start dashboard with SSE mode for real-time updates  
**Input Type:** Environment configuration  
**Output Type:** Background process on port 8001

**Command:**
```bash
cd /opt/metabob-cli

source .venv/bin/activate

metabob-cli dashboard \
  --host "${DASHBOARD_HOST:-0.0.0.0}" \
  --port "${DASHBOARD_PORT:-8001}" \
  --sse \
  --no-browser \
  > /var/log/dashboard.log 2>&1 &

DASHBOARD_PID=$!
echo "Started metabob-cli dashboard (PID: $DASHBOARD_PID)"
```

**Service Details:**
- Binding: `0.0.0.0:8001`
- Mode: SSE (Server-Sent Events for real-time updates)
- Logs: `/var/log/dashboard.log`
- Daemonized: Runs in background

---

#### 9. entrypoint.sh: Start OpenCode ACP Server
**File:** `docker/entrypoint.sh:209-242`  
**Purpose:** Start Agent Client Protocol server for agent communication  
**Input Type:** OpenCode configuration, environment variables  
**Output Type:** Foreground process on port 3000

**Command:**
```bash
cd /workspace

ACP_HOST="${ACP_HOSTNAME:-0.0.0.0}"
ACP_PORT="${ACP_PORT:-3000}"

opencode acp \
  --hostname "$ACP_HOST" \
  --port "$ACP_PORT" \
  --log-level info \
  > /var/log/opencode-acp.log 2>&1 &

ACP_PID=$!
echo "Started OpenCode ACP server (PID: $ACP_PID)"
```

**Service Details:**
- Binding: `0.0.0.0:3000`
- Protocol: Agent Client Protocol (ACP)
- Logs: `/var/log/opencode-acp.log`
- Auto-starts: metabob-cli MCP sidecar (stdio mode)

---

#### 10. OpenCode Auto-Start MCP Sidecar
**File:** OpenCode internal (not in entrypoint.sh)  
**Purpose:** Start metabob-cli MCP server for tool calls  
**Input Type:** opencode.json MCP configuration  
**Output Type:** Child process (stdio communication)

**Auto-Start Logic:**
```typescript
// When opencode starts, it reads opencode.json
{
  "mcp": {
    "metabob": {
      "command": "metabob-cli",
      "args": ["mcp"],
      "type": "stdio"
    }
  }
}

// OpenCode spawns child process
const mcpProcess = spawn("metabob-cli", ["mcp"], {
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env
})

// Communication via JSON-RPC over stdin/stdout
```

**MCP Tools Available:**
- `metabob_fetch_boredom_activities`
- `metabob_get_latest_vessel_version`
- `metabob_post_activity_result`
- `metabob_register_activity_template`
- Plus: Code quality analysis tools

---

#### 11. Container Ready State
**File:** N/A (system state)  
**Purpose:** All services running and healthy  

**Services Running:**
1. **metabob-cli dashboard**
   - Process: Python Flask app
   - Port: 8001
   - Protocol: HTTP + SSE
   - Purpose: Real-time activity monitoring UI

2. **OpenCode ACP server**
   - Process: Node.js/Bun app
   - Port: 3000
   - Protocol: ACP (Agent Client Protocol)
   - Purpose: Agent-to-agent communication

3. **metabob-cli MCP sidecar**
   - Process: Python CLI app (child of opencode)
   - Port: N/A (stdio)
   - Protocol: JSON-RPC (Model Context Protocol)
   - Purpose: Tool execution for code quality and backend API

**Health Indicators:**
```bash
# Check processes
ps aux | grep -E "dashboard|opencode|metabob-cli"

# Check ports
netstat -tlnp | grep -E "3000|8001|8082"

# Check logs
tail -f /var/log/opencode-acp.log
tail -f /var/log/dashboard.log
```

---

## Summary: Data Flow Patterns

### Pattern 1: Idle → Execution → Reporting
```
User idle (5 min)
  ↓
Backend prioritizes work (boredom API)
  ↓
Execute template with variables
  ↓
Update vessel binary
  ↓
Report metrics to backend (learning loop)
```

### Pattern 2: Template Definition → Distribution → Execution
```
Create template JSON
  ↓
Validate structure (Zod)
  ↓
Generate ID from name
  ↓
Optional: Test execution
  ↓
Save to local + backend
  ↓
Available for activity execution
```

### Pattern 3: Container Startup → Service Coordination
```
docker-compose up
  ↓
Start backend (redis, surreal, api-server)
  ↓
Wait for health checks
  ↓
Start devbob containers
  ↓
Process config (env var substitution)
  ↓
Start dashboard (port 8001)
  ↓
Start ACP server (port 3000)
  ↓
Auto-start MCP sidecar (stdio)
  ↓
Container ready (3 services)
```

---

## Key Integration Points

### 1. MCP Bridge (OpenCode ↔ Backend)
**Files:**
- `repos/metabob-opencode/packages/opencode/src/mcp/index.ts`
- metabob-cli MCP server (Python)

**Tools Used:**
- `metabob_fetch_boredom_activities` - Get prioritized work
- `metabob_get_latest_vessel_version` - Check for updates
- `metabob_post_activity_result` - Report metrics
- `metabob_register_activity_template` - Distribute templates

### 2. Activity System (Template → Execution)
**Files:**
- `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
- `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Flow:**
```
Template (JSON) → Activity (instance) → Tasks (execution) → Results (metrics)
```

### 3. Container Orchestration (Compose → Entrypoint → Services)
**Files:**
- `docker-compose.yaml`
- `docker/entrypoint.sh`
- `docker/Dockerfile.devbob`

**Flow:**
```
Compose profiles → Container start → Env validation → Config processing → Service startup
```

---

## Next Steps for Deployment Automation

### Priority Activities to Create

#### 1. `update-vessel-opencode-binary`
**Dependency Chain:**
```
BoredomManager.executeBoredomActivity()
  ↓ uses
VesselUpdateManager.getCurrentVersions()
  ↓ uses
VesselUpdateManager.computeChecksum()
  ↓ uses
MCP.callTool("metabob_get_latest_vessel_version")
```

**Variables Needed:**
- `current_version` (from VesselUpdateManager)
- `latest_version` (from backend)
- `download_url` (from backend)
- `checksum` (from backend)

#### 2. `configure-vessel-for-environment`
**Dependency Chain:**
```
entrypoint.sh environment validation
  ↓ uses
Environment variable substitution
  ↓ outputs
/workspace/.opencode/opencode.json
```

**Variables Needed:**
- `environment` ("production" | "staging" | "development")
- `api_url` (backend URL)
- `project_id` (project identifier)
- `llm_provider` ("anthropic" | "openai")

#### 3. `sync-templates-to-containers`
**Dependency Chain:**
```
TemplateRepository.list()
  ↓ outputs template list
docker cp for each template
  ↓ transfers files
Container TemplateRepository.reload()
  ↓ loads new templates
```

**Variables Needed:**
- `container_names` (array of containers to sync)
- `template_ids` (optional: specific templates, or all)
- `backends` (["local", "metabob"])

---

## Conclusion

This dependency chain analysis reveals three main deployment workflows:

1. **Boredom-Driven Updates**: Automated vessel binary updates via idle detection and backend prioritization
2. **Template Distribution**: File-based and API-based template registration with optional validation
3. **Container Orchestration**: Multi-stage startup with health checks and service coordination

All three workflows are now well-documented with exact file paths, line numbers, input/output types, and data transformations. This provides the foundation for creating deployment automation activities.
