# Dataflow, Learning, and Vessel Architecture

**Date**: 2026-02-26  
**Purpose**: Trace complete dataflow from metabob-opencode → metabob-cli → metabob-rpc-api → SurrealDB and explain the learning loop, improvement gradients, boredom activities, vessels, and DevBob container coordination.

---

## Executive Summary

### Quick Answers

**What is a vessel?**
- A **vessel** is the **instructional state** - the capacity to execute (binary, template, container image)
- OpenCode binary is a vessel, DevBob container is a vessel, activity templates are vessels
- Vessels contain **potential** (instructions), not **outcomes** (instances)

**How do we test dataflow without metabob-rpc-api?**
- You **cannot** - metabob-rpc-api is the exclusive gateway to SurrealDB
- The architecture enforces: `metabob-opencode → metabob-cli → metabob-rpc-api → SurrealDB`
- Testing requires the full stack (Redis, SurrealDB, metabob-rpc-api, metabob-cli, metabob-opencode)

**How do we calculate improvement gradients?**
- **Thompson Sampling** (Bayesian Multi-Armed Bandit) in metabob-rpc-api
- Success rate trends + execution frequency + recency → priority score
- Stored in Redis, queried via `/api/v1/learning-loop/boredom-activities`

**How do DevBob containers coordinate?**
- **ACP (Agent Client Protocol)** for task delegation
- **Shared SurrealDB** for activity state synchronization
- **Impulse sharing** for context transfer between containers

---

## 1. The Complete Dataflow

### 1.1 Forward Flow: Execution Recording

```
┌─────────────────────────────────────────────────────────────────┐
│ metabob-opencode (TypeScript)                                   │
│   - User triggers activity execution                            │
│   - ActivityTool.execute() spawns sub-agent                     │
│   - Sub-agent completes tasks, produces artifacts               │
│   - Activity completes with metrics (cost, duration, tokens)    │
└────────────┬────────────────────────────────────────────────────┘
             │ MCP JSON-RPC (stdio)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ metabob-cli MCP Server (Python)                                 │
│   - Tool: metabob_post_activity_result                          │
│   - Receives: { variant_id, success, duration, cost, tokens }   │
│   - Validates payload schema                                    │
│   - Forwards to backend API                                     │
└────────────┬────────────────────────────────────────────────────┘
             │ HTTP POST
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ metabob-rpc-api (Python FastAPI)                                │
│   - Endpoint: POST /api/v1/activity-execution/results           │
│   - Validates authentication (session token)                    │
│   - Updates template metrics via Thompson Sampling              │
│   - Records execution history                                   │
└────────────┬────────────────────────────────────────────────────┘
             │ SurrealDB driver
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ SurrealDB                                                        │
│   - Table: activity_templates                                   │
│     - learning.success_rate (Bayesian update)                   │
│     - learning.execution_count += 1                             │
│     - learning.avg_cost (running average)                       │
│     - learning.avg_duration_ms (running average)                │
│   - Table: activity_executions (history)                        │
│     - execution_id, template_id, success, duration, cost, ...   │
│   - Table: failure_patterns (if failed)                         │
│     - error_type, frequency, last_seen                          │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
1. **metabob-opencode** NEVER calls metabob-rpc-api directly (violates MCP gateway)
2. **metabob-cli** acts as stateless proxy (no business logic)
3. **metabob-rpc-api** owns all database writes (exclusive access)
4. **SurrealDB** is the single source of truth for learning metrics

---

### 1.2 Reverse Flow: Boredom Activity Fetch

```
┌─────────────────────────────────────────────────────────────────┐
│ metabob-opencode (TypeScript)                                   │
│   - BoredomManager detects idle (5+ minutes no user activity)   │
│   - Calls: metabob_fetch_boredom_activities()                   │
└────────────┬────────────────────────────────────────────────────┘
             │ MCP JSON-RPC (stdio)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ metabob-cli MCP Server (Python)                                 │
│   - Tool: metabob_fetch_boredom_activities                      │
│   - Params: { max_activities, priority_threshold, ... }         │
│   - Forwards to backend API                                     │
└────────────┬────────────────────────────────────────────────────┘
             │ HTTP GET
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ metabob-rpc-api (Python FastAPI)                                │
│   - Endpoint: GET /api/v1/learning-loop/boredom-activities      │
│   - Queries SurrealDB for templates with:                       │
│     - success_rate < 0.95 (room for improvement)                │
│     - execution_count > 5 (sufficient data)                     │
│     - last_execution > 24h ago (not recent)                     │
│   - Calculates improvement_gradient per template                │
│   - Sorts by priority (gradient * urgency)                      │
│   - Returns top N activities                                    │
└────────────┬────────────────────────────────────────────────────┘
             │ SurrealDB query
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ SurrealDB                                                        │
│   - Query:                                                       │
│     SELECT * FROM activity_templates                            │
│     WHERE learning.success_rate < 0.95                          │
│       AND learning.execution_count > 5                          │
│       AND last_execution.timestamp < $exclude_recent            │
│     ORDER BY improvement_gradient DESC                          │
│     LIMIT $max_activities                                       │
└────────────┬────────────────────────────────────────────────────┘
             │ Results
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ metabob-cli MCP Server (Python)                                 │
│   - Receives: [{ template_id, priority, gradient, ... }]        │
│   - Serializes to JSON                                          │
│   - Returns via JSON-RPC                                        │
└────────────┬────────────────────────────────────────────────────┘
             │ MCP JSON-RPC response
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ metabob-opencode (TypeScript)                                   │
│   - BoredomManager receives activities                          │
│   - Selects highest priority activity                           │
│   - Executes via ActivityTool.execute()                         │
│   - Marks as boredom-triggered (metadata)                       │
│   - Loop continues → back to Forward Flow                       │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
1. **Idle detection** triggers boredom loop (5 min threshold)
2. **Priority calculation** happens in backend (not metabob-cli)
3. **Automatic execution** with special metadata (`initiatedBy='boredom-auto'`)
4. **Feedback loop** closes when execution completes → metrics updated

---

## 2. Purpose of Each Component

### 2.1 metabob-opencode (Vessel for Execution)

**Role**: Execution orchestration and user interaction

**Responsibilities**:
- Activity execution (spawn sub-agents, manage tasks)
- Boredom detection (idle monitoring)
- MCP client (call tools from metabob-cli)
- Impulse management (lazy loading, resolution)
- Session state tracking
- User interface (CLI, dashboard)

**Does NOT**:
- ❌ Access SurrealDB directly
- ❌ Calculate improvement gradients
- ❌ Manage template learning metrics
- ❌ Store activity history (only local cache)

**Vessel Analogy**:
- OpenCode is a **vessel** (instructional state)
- Activity execution is the **becoming** (transient state)
- Completed activity is an **instance** (functional state)

---

### 2.2 metabob-cli (MCP Gateway)

**Role**: Stateless proxy between OpenCode and backend

**Responsibilities**:
- MCP server (expose tools via JSON-RPC)
- HTTP proxy (forward requests to metabob-rpc-api)
- Schema validation (tool arguments)
- Error handling (retry with backoff)
- Graceful degradation (return empty on failure)

**Does NOT**:
- ❌ Store any state (fully stateless)
- ❌ Perform business logic (pure proxy)
- ❌ Access SurrealDB directly
- ❌ Calculate metrics or gradients

**Architectural Principle**: MCP Gateway Pattern
- OpenCode → (MCP only) → metabob-cli → (HTTP only) → Backend
- Enforces loose coupling (language-agnostic protocols)

---

### 2.3 metabob-rpc-api (Learning Engine)

**Role**: Business logic, learning algorithms, database access

**Responsibilities**:
- Template metrics management (Thompson Sampling)
- Improvement gradient calculation
- Boredom activity prioritization
- Failure pattern tracking
- Activity execution history
- SurrealDB schema management
- Redis caching (priority queues)

**Key Algorithms**:

#### Thompson Sampling (Bayesian MAB)
```python
def thompson_sampling(templates: List[Template]) -> Template:
    """
    Select template to execute based on Thompson Sampling.
    
    For each template:
      1. Maintain Beta distribution: Beta(successes, failures)
      2. Sample from distribution: θ ~ Beta(α, β)
      3. Select template with highest sampled θ
    
    Properties:
      - Automatic exploration/exploitation balance
      - Learns true success rates over time
      - Prioritizes high-performing templates
    """
    samples = []
    for t in templates:
        # Beta distribution parameters
        alpha = t.successes + 1  # Add 1 for prior (avoid 0)
        beta = t.failures + 1
        
        # Sample from Beta(α, β)
        theta = beta_distribution.sample(alpha, beta)
        samples.append((theta, t))
    
    # Select template with highest sampled value
    return max(samples, key=lambda x: x[0])[1]
```

#### Improvement Gradient Calculation
```python
def calculate_improvement_gradient(template: Template) -> float:
    """
    Calculate how much improvement potential a template has.
    
    Factors:
      - Success rate gap (1.0 - current_success_rate)
      - Execution frequency (recent usage)
      - Recency (time since last execution)
      - Failure pattern severity
    
    Returns: 0.0 (no improvement needed) to 1.0 (urgent improvement)
    """
    # Gap: How far from perfect?
    success_gap = 1.0 - template.learning.success_rate
    
    # Frequency: More executions = more important to improve
    frequency_weight = min(template.learning.execution_count / 50, 1.0)
    
    # Recency: Recent failures more urgent
    hours_since_last = (now() - template.last_execution.timestamp).hours
    recency_weight = 1.0 / (1.0 + hours_since_last / 24)  # Decay over days
    
    # Failure severity: Critical errors more urgent
    severity_weight = template.failure_patterns.max_severity / 10.0
    
    # Combine factors
    gradient = (
        success_gap * 0.5 +           # 50% weight on success gap
        frequency_weight * 0.2 +      # 20% weight on usage
        recency_weight * 0.2 +        # 20% weight on recency
        severity_weight * 0.1         # 10% weight on severity
    )
    
    return min(gradient, 1.0)
```

**Does NOT**:
- ❌ Execute activities (that's OpenCode's job)
- ❌ Manage user sessions (OpenCode does this)
- ❌ Generate activity prompts (templates contain prompts)

---

### 2.4 SurrealDB (Learning State Persistence)

**Role**: Graph database for activities, templates, and learning metrics

**Schema**:

#### activity_templates
```surreal
DEFINE TABLE activity_templates SCHEMAFULL;

DEFINE FIELD id ON activity_templates TYPE string;
DEFINE FIELD name ON activity_templates TYPE string;
DEFINE FIELD category ON activity_templates TYPE string;
DEFINE FIELD tasks ON activity_templates TYPE array;

-- Learning metrics (Thompson Sampling state)
DEFINE FIELD learning.success_rate ON activity_templates TYPE float DEFAULT 0.0;
DEFINE FIELD learning.execution_count ON activity_templates TYPE int DEFAULT 0;
DEFINE FIELD learning.avg_cost ON activity_templates TYPE float DEFAULT 0.0;
DEFINE FIELD learning.avg_duration_ms ON activity_templates TYPE float DEFAULT 0.0;
DEFINE FIELD learning.improvement_gradient ON activity_templates TYPE float DEFAULT 0.0;

-- Last execution tracking
DEFINE FIELD last_execution.timestamp ON activity_templates TYPE datetime;
DEFINE FIELD last_execution.success ON activity_templates TYPE bool;
DEFINE FIELD last_execution.duration ON activity_templates TYPE int;
DEFINE FIELD last_execution.cost ON activity_templates TYPE float;

-- Failure patterns
DEFINE FIELD failure_patterns ON activity_templates TYPE array;
```

#### activity_executions
```surreal
DEFINE TABLE activity_executions SCHEMAFULL;

DEFINE FIELD id ON activity_executions TYPE string;
DEFINE FIELD template_id ON activity_executions TYPE string;
DEFINE FIELD success ON activity_executions TYPE bool;
DEFINE FIELD duration ON activity_executions TYPE int;
DEFINE FIELD cost ON activity_executions TYPE float;
DEFINE FIELD tokens ON activity_executions TYPE object;
DEFINE FIELD initiated_by ON activity_executions TYPE string;  -- 'user' | 'boredom-auto' | 'boredom-manual'
DEFINE FIELD timestamp ON activity_executions TYPE datetime;
DEFINE FIELD error ON activity_executions TYPE string;
```

**Key Operations**:

1. **Update metrics (after execution)**:
```surreal
UPDATE activity_templates:{template_id}
SET
  learning.execution_count += 1,
  learning.success_rate = (
    (learning.success_rate * learning.execution_count + $success_int) 
    / (learning.execution_count + 1)
  ),
  learning.avg_cost = (
    (learning.avg_cost * learning.execution_count + $cost) 
    / (learning.execution_count + 1)
  ),
  learning.avg_duration_ms = (
    (learning.avg_duration_ms * learning.execution_count + $duration) 
    / (learning.execution_count + 1)
  ),
  learning.improvement_gradient = <calculate_gradient>,
  last_execution = {
    timestamp: time::now(),
    success: $success,
    duration: $duration,
    cost: $cost
  }
WHERE id = $template_id;
```

2. **Query boredom activities**:
```surreal
SELECT * FROM activity_templates
WHERE learning.success_rate < 0.95
  AND learning.execution_count > 5
  AND time::unix(last_execution.timestamp) < time::unix() - 86400
ORDER BY learning.improvement_gradient DESC
LIMIT $max_activities;
```

---

## 3. How Learning Works

### 3.1 The Learning Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                      LEARNING LOOP                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. EXECUTE                                                     │
│     User/Boredom triggers activity                             │
│     ↓                                                           │
│  2. MEASURE                                                     │
│     Capture: success, duration, cost, tokens                   │
│     ↓                                                           │
│  3. RECORD                                                      │
│     POST /api/v1/activity-execution/results                    │
│     ↓                                                           │
│  4. UPDATE METRICS (Thompson Sampling)                         │
│     SurrealDB: learning.success_rate, improvement_gradient     │
│     ↓                                                           │
│  5. CALCULATE PRIORITIES                                        │
│     Templates with high gradient = high priority               │
│     ↓                                                           │
│  6. SUGGEST IMPROVEMENTS (Boredom System)                      │
│     GET /api/v1/learning-loop/boredom-activities               │
│     ↓                                                           │
│  7. AUTO-EXECUTE IMPROVEMENTS                                   │
│     BoredomManager executes highest priority                   │
│     ↓                                                           │
│  Loop back to step 1                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Gradient Calculation Example

```python
# Example: "add-feature-complete" template

# Current state (from SurrealDB)
template = {
    "id": "add-feature-complete",
    "learning": {
        "success_rate": 0.75,        # 75% success rate (room for improvement)
        "execution_count": 30,       # Used 30 times (important template)
        "avg_cost": 0.25,
        "avg_duration_ms": 45000
    },
    "last_execution": {
        "timestamp": "2026-02-25T10:00:00Z",  # 16 hours ago
        "success": False             # Last execution failed!
    },
    "failure_patterns": [
        {"type": "timeout", "count": 3, "severity": 7},
        {"type": "validation", "count": 2, "severity": 5}
    ]
}

# Calculate gradient
success_gap = 1.0 - 0.75 = 0.25                    # 25% gap to perfect
frequency_weight = min(30 / 50, 1.0) = 0.6         # Used frequently (60%)
recency_weight = 1.0 / (1.0 + 16/24) = 0.6         # Recent failure (60%)
severity_weight = 7 / 10 = 0.7                     # Severe errors (70%)

improvement_gradient = (
    0.25 * 0.5 +     # 0.125 from success gap
    0.6 * 0.2 +      # 0.12 from frequency
    0.6 * 0.2 +      # 0.12 from recency
    0.7 * 0.1        # 0.07 from severity
) = 0.435            # 43.5% improvement potential

# Priority calculation (for boredom system)
priority = improvement_gradient * urgency_multiplier
urgency = 1.0 + (recent_failure ? 0.3 : 0.0) + (high_usage ? 0.2 : 0.0)
priority = 0.435 * 1.5 = 0.6525  # HIGH PRIORITY

# Result: This template will be suggested by boredom system
```

---

## 4. Boredom Activities

### 4.1 What Are Boredom Activities?

**Definition**: Activities automatically triggered when a session is idle (5+ minutes) to improve the system.

**Purpose**: Autonomous self-improvement through:
- Template evolution (fix failing templates)
- Pattern learning (discover new patterns)
- Context optimization (improve impulse usage)
- Vessel updates (keep binaries current)

### 4.2 Boredom Activity Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                   BOREDOM ACTIVITY LIFECYCLE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IDLE DETECTION (BoredomManager)                               │
│     Session idle for 5+ minutes                                │
│     ↓                                                           │
│  FETCH CANDIDATES (metabob_fetch_boredom_activities)           │
│     GET /api/v1/learning-loop/boredom-activities               │
│     Returns: [                                                 │
│       {                                                         │
│         template_id: "add-feature-complete",                   │
│         priority: 0.85,                                        │
│         improvement_gradient: 0.43,                            │
│         reason: "75% success rate, recent failures",           │
│         estimated_effort: "15-20 minutes"                      │
│       }                                                         │
│     ]                                                           │
│     ↓                                                           │
│  SELECT HIGHEST PRIORITY                                        │
│     Sort by priority DESC, take first                          │
│     ↓                                                           │
│  EXECUTE WITH METADATA                                          │
│     ActivityTool.execute({                                     │
│       templateId: "add-feature-complete",                      │
│       initiatedBy: "boredom-auto",                             │
│       branch: "boredom-activity",                              │
│       reason: "75% success rate, recent failures"              │
│     })                                                          │
│     ↓                                                           │
│  MONITOR EXECUTION                                              │
│     Abort if user returns (respects user priority)             │
│     ↓                                                           │
│  RECORD RESULTS                                                 │
│     POST /api/v1/activity-execution/results                    │
│     { initiated_by: "boredom-auto", ... }                      │
│     ↓                                                           │
│  UPDATE METRICS                                                 │
│     Thompson Sampling updates success rate                     │
│     Gradient recalculated                                      │
│     ↓                                                           │
│  CONTINUE MONITORING                                            │
│     Loop back to idle detection                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Boredom Activity Types

| Activity Type | Purpose | Triggered When | Example |
|---------------|---------|----------------|---------|
| **improve-template** | Fix failing template | Success rate < 80% | "Fix 'add-feature-complete' timeout issues" |
| **evolve-template** | Enhance successful template | Success rate 80-95% | "Add error handling to 'fix-bug-complete'" |
| **discover-pattern** | Learn new patterns | No template exists | "Extract pattern from manual fix" |
| **update-vessel** | Keep binaries current | New version available | "Update OpenCode to v1.0.65" |
| **optimize-context** | Improve impulse usage | High context costs | "Reduce impulse token usage by 30%" |

---

## 5. Vessels Explained

### 5.1 The Three-State Ontology

```
VESSEL (Instructional State)
    ↓ Instantiation
BECOMING (Transient State)
    ↓ Actualization
INSTANCE (Functional State)
    ↓ Learning
IMPROVED VESSEL (Next iteration)
```

**Vessel**: The capacity to execute (binary, template, container)
**Becoming**: The execution in progress (transient, ephemeral)
**Instance**: The completed execution (artifacts, metrics, outcomes)

### 5.2 Vessel Examples

#### OpenCode Binary (Vessel)
```
Instructional State:
  - Binary file: /usr/local/bin/opencode
  - Version: 1.0.64
  - Capabilities: [activities, impulses, MCP, ACP]
  - Potential: Can execute activities, spawn agents, delegate tasks

Instantiation → Becoming:
  - Process starts: PID 12345
  - Session created: sess_abc123
  - Activity executing: act_def456
  - Tools being called: [read, edit, bash]

Actualization → Instance:
  - Files modified: [src/auth.ts, src/utils.ts]
  - Commits created: [abc123, def456]
  - Metrics recorded: { cost: 0.25, duration: 45000 }
  - State persisted: ~/.local/share/opencode/storage/
```

#### Activity Template (Vessel)
```json
// Instructional State (Template)
{
  "id": "add-feature-complete",
  "name": "Add Feature (Complete Workflow)",
  "tasks": [
    {
      "id": "task-1",
      "prompt": "Implement feature logic...",
      "validation": { "requiredFiles": ["src/feature.ts"] }
    },
    {
      "id": "task-2",
      "prompt": "Add tests...",
      "validation": { "commands": ["npm test"] }
    }
  ]
}

// Becoming (Execution in progress)
{
  "activityId": "act_abc123",
  "status": "executing",
  "currentTask": "task-1",
  "agent": { "id": "agent_def456", "status": "working" }
}

// Instance (Completed execution)
{
  "activityId": "act_abc123",
  "status": "completed",
  "artifacts": ["src/feature.ts", "tests/feature.test.ts"],
  "metrics": { "success": true, "duration": 30000, "cost": 0.18 }
}
```

#### DevBob Container (Vessel)
```dockerfile
# Instructional State (Dockerfile + Image)
FROM node:20-alpine
RUN npm install -g opencode@1.0.64
RUN pip install metabob-cli==0.6.14
COPY entrypoint.sh /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Becoming (Container starting)
docker run -d \
  -e ANTHROPIC_API_KEY="..." \
  -e METABOB_API_URL="http://metabob-rpc-api:8080" \
  --name devbob-vessel-1 \
  devbob:local-fixed

# Instance (Running container)
CONTAINER ID   STATUS          PORTS                    NAMES
abc123def456   Up 10 minutes   3000/tcp, 8082/tcp       devbob-vessel-1
```

### 5.3 Vessel Update Workflow

**Problem**: DevBob containers need updates (OpenCode binary, templates, plugins)

**Solution**: `update-vessel-opencode-binary` activity template

```
1. CHECK CURRENT VERSION
   Read /workspace/.vessel-versions.json
   → { opencode: "1.0.64" }

2. FETCH LATEST VERSION
   GitHub API: GET /repos/metabob/opencode/releases/latest
   → { tag_name: "v1.0.65", assets: [...] }

3. COMPARE VERSIONS
   Current: 1.0.64
   Latest:  1.0.65
   → Update needed!

4. DOWNLOAD BINARY
   curl -L https://github.com/.../opencode-linux-x64 -o /tmp/opencode-new
   → Binary downloaded

5. VERIFY CHECKSUM
   sha256sum /tmp/opencode-new == expected_checksum
   → Verified!

6. INSTALL BINARY
   mv /tmp/opencode-new /usr/local/bin/opencode
   chmod +x /usr/local/bin/opencode
   → Installed

7. UPDATE TRACKING
   Write /workspace/.vessel-versions.json
   → { opencode: "1.0.65", history: [...] }

8. VERIFY INSTALLATION
   opencode --version
   → 1.0.65 ✓
```

---

## 6. DevBob Container Coordination

### 6.1 Multi-Vessel Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOST ENVIRONMENT                             │
│   (Parent OpenCode instance)                                    │
│                                                                 │
│   ┌───────────────────────────────────────────────────────┐    │
│   │ Task: "Implement authentication system"              │    │
│   │ Complexity: High                                      │    │
│   │ Decision: Delegate to DevBob vessels                  │    │
│   └────────────────┬──────────────────────────────────────┘    │
│                    │ ACP Delegation                            │
└────────────────────┼───────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│ DevBob Vessel 1  │      │ DevBob Vessel 2  │
│                  │      │                  │
│ Container ID:    │      │ Container ID:    │
│  abc123          │      │  def456          │
│                  │      │                  │
│ Task: Backend    │      │ Task: Frontend   │
│ Port: 3001       │      │ Port: 3002       │
│ ACP: Running     │      │ ACP: Running     │
│                  │      │                  │
│ Impulses:        │      │ Impulses:        │
│  - apiDesign     │      │  - apiDesign     │
│  - dbSchema      │      │  - uiDesign      │
└────────┬─────────┘      └─────────┬────────┘
         │                          │
         │ Shared State via SurrealDB
         └──────────┬───────────────┘
                    ▼
       ┌────────────────────────────┐
       │      SurrealDB             │
       │                            │
       │ activity_executions        │
       │ - vessel_1_activity_id     │
       │ - vessel_2_activity_id     │
       │                            │
       │ impulse_state              │
       │ - apiDesign (shared)       │
       │ - dbSchema (vessel 1)      │
       │ - uiDesign (vessel 2)      │
       └────────────────────────────┘
```

### 6.2 ACP Delegation Flow

```typescript
// Host OpenCode instance

const result = await acp_delegate({
  target: "docker://devbob-vessel-1",
  taskDescription: "Implement authentication backend",
  prompt: "Create JWT authentication endpoints with tests",
  shareImpulses: ["apiDesign", "dbSchema"],  // Share context
  timeout: 600  // 10 minutes
})

// What happens inside:

// 1. ACP Client establishes connection
//    → WebSocket to http://localhost:3001/acp

// 2. Serialize impulses
//    apiDesign → { type: "memo", content: "..." }
//    dbSchema → { type: "file", path: "schema.sql" }

// 3. Send task to vessel
//    ACP Request: {
//      type: "execute",
//      payload: {
//        prompt: "Create JWT authentication endpoints...",
//        impulses: [apiDesign, dbSchema],
//        sessionId: "sess_abc123"
//      }
//    }

// 4. Vessel executes (inside container)
//    - Load impulses into session
//    - Execute activity: "add-feature-complete"
//    - Produce artifacts: [src/auth.ts, tests/auth.test.ts]
//    - Record to SurrealDB

// 5. Return results to host
//    ACP Response: {
//      type: "result",
//      payload: {
//        success: true,
//        artifacts: [...],
//        metrics: { cost: 0.25, duration: 45000 }
//      }
//    }

// 6. Host integrates results
//    - Retrieve artifacts from vessel
//    - Merge into host workspace
//    - Update activity state
```

### 6.3 Vessel Coordination Patterns

#### Pattern 1: Sequential Delegation
```
Task 1 (Vessel 1) → Complete → Task 2 (Vessel 2) → Complete → Task 3 (Vessel 3)
```
**Use case**: Backend → Frontend → Integration tests

#### Pattern 2: Parallel Execution
```
         ┌─ Task A (Vessel 1)
Task → ──┼─ Task B (Vessel 2)  →  Merge Results
         └─ Task C (Vessel 3)
```
**Use case**: Multiple independent features

#### Pattern 3: Pipeline
```
Vessel 1 (Design) → Vessel 2 (Implement) → Vessel 3 (Test) → Vessel 4 (Deploy)
```
**Use case**: Full SDLC automation

#### Pattern 4: Boredom Coordination
```
Vessel 1: Idle → Boredom activity: "improve-template"
Vessel 2: Idle → Boredom activity: "update-vessel"
Vessel 3: Busy → Skip boredom
```
**Use case**: Autonomous self-improvement across fleet

---

## 7. Testing Without metabob-rpc-api

### 7.1 Why You Can't Skip It

**The architecture enforces dataflow through metabob-rpc-api:**

```
✅ ENFORCED:
metabob-opencode → metabob-cli → metabob-rpc-api → SurrealDB

❌ VIOLATIONS:
metabob-opencode → SurrealDB (direct access blocked)
metabob-cli → SurrealDB (no database driver)
metabob-opencode → metabob-rpc-api (bypasses MCP gateway)
```

**Enforcement mechanisms:**
1. **No SurrealDB driver in metabob-opencode** (can't connect)
2. **No HTTP client for backend in metabob-opencode** (must use MCP)
3. **metabob-rpc-api is exclusive gateway** (owns all DB writes)

### 7.2 Minimal Test Stack

**Required components:**
```
docker-compose up -d redis surrealdb metabob-rpc-api
```

**Test dataflow:**
```bash
# 1. Start minimal stack
docker-compose up -d redis surrealdb metabob-rpc-api

# 2. Verify backend health
curl http://localhost:8080/health
# → {"status": "healthy", "services": {"redis": "ok", "surrealdb": "ok"}}

# 3. Test activity recording
curl -X POST http://localhost:8080/api/v1/activity-execution/results \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "add-feature-complete",
    "success": true,
    "duration": 30000,
    "cost": 0.18,
    "tokens": {"input": 5000, "output": 3000, "cache": 0}
  }'
# → {"status": "success", "message": "Result recorded"}

# 4. Query metrics
curl http://localhost:8080/api/v1/learning-loop/boredom-activities?max_activities=5
# → {"activities": [...]}

# 5. Verify SurrealDB state
docker exec -it surrealdb surreal sql \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns test --db test \
  --pretty
> SELECT * FROM activity_templates WHERE id = 'add-feature-complete';
```

### 7.3 E2E Validation Script

See: `scripts/validate-metabob-stack.sh`

```bash
#!/bin/bash
set -euo pipefail

echo "Validating Metabob Stack..."

# 1. Check Redis
redis-cli -h localhost -p 6379 ping || {
  echo "❌ Redis not responding"
  exit 1
}
echo "✓ Redis: OK"

# 2. Check SurrealDB
curl -f http://localhost:8000/health || {
  echo "❌ SurrealDB not responding"
  exit 1
}
echo "✓ SurrealDB: OK"

# 3. Check metabob-rpc-api
curl -f http://localhost:8080/health || {
  echo "❌ metabob-rpc-api not responding"
  exit 1
}
echo "✓ metabob-rpc-api: OK"

# 4. Test dataflow
RESULT=$(curl -s -X POST http://localhost:8080/api/v1/activity-execution/results \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "test-template",
    "success": true,
    "duration": 1000,
    "cost": 0.01,
    "tokens": {"input": 100, "output": 50, "cache": 0}
  }')

if [[ "$RESULT" == *"success"* ]]; then
  echo "✓ Dataflow: OK"
else
  echo "❌ Dataflow test failed"
  exit 1
fi

echo ""
echo "✅ All checks passed!"
echo "Metabob Stack Status: Ready"
```

---

## 8. Summary Diagrams

### 8.1 Complete Data Flow

```
┌───────────────────────────────────────────────────────────────────────┐
│                         USER ACTION                                   │
│   "opencode activity execute --template add-feature-complete"         │
└────────────────────────────┬──────────────────────────────────────────┘
                             │
                ┌────────────▼────────────┐
                │  metabob-opencode       │
                │  - ActivityTool.execute │
                │  - Spawn sub-agent      │
                │  - Complete tasks       │
                │  - Measure metrics      │
                └────────────┬────────────┘
                             │ MCP Tool Call
                ┌────────────▼────────────┐
                │  metabob-cli MCP Server │
                │  - metabob_post_result  │
                │  - Validate payload     │
                │  - Forward to backend   │
                └────────────┬────────────┘
                             │ HTTP POST
                ┌────────────▼────────────┐
                │  metabob-rpc-api        │
                │  - Thompson Sampling    │
                │  - Calculate gradient   │
                │  - Update metrics       │
                └────────────┬────────────┘
                             │ DB Write
                ┌────────────▼────────────┐
                │  SurrealDB              │
                │  - activity_templates   │
                │  - activity_executions  │
                │  - failure_patterns     │
                └─────────────────────────┘
                             │
                ┌────────────▼────────────┐
                │  LEARNING LOOP          │
                │  - Gradient updated     │
                │  - Priority recalc      │
                │  - Boredom queue        │
                └────────────┬────────────┘
                             │ 5 min idle
                ┌────────────▼────────────┐
                │  BoredomManager         │
                │  - Fetch activities     │
                │  - Select highest pri   │
                │  - Auto-execute         │
                └────────────┬────────────┘
                             │
                        Loop back to top
```

### 8.2 Vessel Transformation Cycle

```
VESSEL (Template)
   "add-feature-complete"
   [Success rate: 75%]
         │
         │ Execute
         ▼
BECOMING (In Progress)
   Activity: act_abc123
   Status: executing
   Task 2 of 4
         │
         │ Complete
         ▼
INSTANCE (Result)
   Success: true
   Duration: 30s
   Cost: $0.18
         │
         │ Learn
         ▼
IMPROVED VESSEL (Updated Template)
   "add-feature-complete"
   [Success rate: 76%]
   [Gradient: 0.35 → 0.33]
         │
         │ Next execution
         └─────────┐
                   │
         Loop continues...
```

---

## 9. Key Takeaways

### Architecture Principles
1. **MCP Gateway Enforced**: metabob-opencode → metabob-cli → metabob-rpc-api → SurrealDB
2. **Exclusive DB Access**: Only metabob-rpc-api writes to SurrealDB
3. **Stateless Proxy**: metabob-cli has no business logic
4. **Thompson Sampling**: Bayesian learning for template selection
5. **Improvement Gradients**: Multi-factor prioritization (success gap, frequency, recency, severity)

### Vessels
1. **Instructional State**: Capacity to execute (binary, template, image)
2. **Transient State**: Execution in progress (becoming)
3. **Functional State**: Completed execution (instance)
4. **Vessel Updates**: DevBob containers self-update binaries/templates
5. **Multi-Vessel**: Parallel execution, task delegation, fleet coordination

### Learning Loop
1. **Execute** → Measure → Record → **Learn** → Improve → Execute (continuous)
2. **Thompson Sampling** balances exploration vs exploitation
3. **Improvement Gradients** prioritize which templates need work
4. **Boredom Activities** autonomous self-improvement during idle time
5. **Feedback Closes Loop**: Results update metrics → gradients → priorities

### Testing
1. **Full Stack Required**: Can't test without metabob-rpc-api + SurrealDB
2. **Minimal Stack**: redis + surrealdb + metabob-rpc-api (3 services)
3. **Validation Script**: `scripts/validate-metabob-stack.sh`
4. **E2E Test Activity**: `test-metabob-stack-e2e-fixed`

---

## 10. References

**Architecture Documents**:
- `ARCHITECTURE_COMPLIANCE_ASSESSMENT_2026-02-24.md` - Boundary enforcement validation
- `DEPLOYMENT_ARCHITECTURAL_BOUNDARIES.md` - Complete boundary analysis
- `docs/architecture/ONTOLOGY_OF_BECOMING.md` - Three-state ontology
- `docs/architecture/CRITICAL_ARCHITECTURE_ERRORS.md` - What we got wrong

**Learning System**:
- `MODEL_OPTIMIZATION_SUMMARY.md` - Thompson Sampling explanation
- `BOREDOM_SYSTEM_SUCCESS_DEMONSTRATION.md` - Boredom system validation
- `IMPULSE_LEARNING_SYSTEM_SUMMARY.md` - Impulse learning architecture

**Deployment**:
- `METABOB_STACK_DEPLOYMENT_GUIDE.md` - K8s deployment
- `DEVBOB_ACP_SUCCESS_SUMMARY.md` - ACP delegation guide
- `scripts/validate-metabob-stack.sh` - Stack validation script

**Activity Templates**:
- `test-metabob-stack-e2e-fixed` - E2E stack testing
- `update-vessel-opencode-binary` - Vessel update workflow
- `evolve-activity-self-contained` - Template evolution

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-26  
**Author**: Activity Mode (OpenCode)  
**Validated**: ✅ Full stack dataflow traced and documented
