# Communication Flow Architecture

## Overview

Understanding how the three components communicate is critical for maintaining proper separation of concerns and avoiding tight coupling.

## Component Communication Matrix

| From ↓ To → | metabob-rpc-api | metabob-cli | metabob-opencode |
|-------------|-----------------|-------------|------------------|
| **metabob-rpc-api** | - | ❌ Never | ❌ Never (WebSocket only) |
| **metabob-cli** | ✅ HTTP/REST | - | ❌ Never |
| **metabob-opencode** | ❌ Never (MCP Gateway) | ✅ MCP Protocol | - |

**Key Principle**: **One-way dependency chain**
```
metabob-opencode → metabob-cli → metabob-rpc-api
(MCP Protocol)      (HTTP REST)
```

---

## Detailed Communication Flows

### Flow 1: User Executes Activity (Primary Flow)

**Scenario**: User runs `opencode activity execute --template fix-bug-complete`

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Template Discovery                                      │
└─────────────────────────────────────────────────────────────────┘

[User] → [OpenCode CLI]
         │
         ▼
    [OpenCode Activity Tool]
         │
         │ MCP Call: search_activities(category="bugfix")
         ▼
    [metabob-cli MCP Server]
         │
         │ HTTP GET /v2/activities/templates?category=bugfix
         ▼
    [metabob-rpc-api]
         │
         │ Query Redis
         ▼
    [Redis: activity:templates:list]
         │
         │ Return: [{variant_id, name, success_rate, ...}, ...]
         ▼
    [metabob-rpc-api] → [metabob-cli MCP] → [OpenCode]
         │
         ▼
    [OpenCode selects template]


┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Template Retrieval                                      │
└─────────────────────────────────────────────────────────────────┘

[OpenCode Activity Tool]
         │
         │ Check local cache: ~/.local/share/opencode/storage/activity-template/
         │ Cache miss? → Fetch from backend
         │
         │ MCP Call: get_activity_template(template_id)
         ▼
    [metabob-cli MCP Server]
         │
         │ HTTP GET /v2/activities/templates/{variant_id}
         ▼
    [metabob-rpc-api]
         │
         │ Query Redis: activity:template:{variant_id}
         ▼
    [Redis]
         │
         │ Return: SAFE template (no tasks/prompts exposed via MCP)
         │         FULL template (if OpenCode calls backend directly - current issue)
         ▼
    [metabob-rpc-api] → [metabob-cli MCP] → [OpenCode]
         │
         │ OpenCode caches locally
         ▼
    [Local Storage: ~/.local/share/opencode/storage/activity-template/]


┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Activity Execution                                      │
└─────────────────────────────────────────────────────────────────┘

[OpenCode ActivityManager]
         │
         │ Start execution (variant_id, variables)
         │ Create execution_id
         │ Initialize execution state
         │
         ▼
    [For each task in template]
         │
         │ Task 1: "Search for similar bugs"
         │
         │ Spawn Agent (general/specialized)
         ▼
    [Agent executes with tools]
         │
         │ Agent needs code quality data
         │
         │ Tool Call: metabob_search_codebase_issues(query="bug pattern")
         ▼
    [metabob-cli MCP Server]
         │
         │ HTTP GET /v2/analysis/issues?query=...
         ▼
    [metabob-rpc-api]
         │
         │ Query Redis: analysis:issues
         │ Query CPG data
         ▼
    [Redis + Analysis Data]
         │
         │ Return: [{issue_id, severity, file, line, description}, ...]
         ▼
    [metabob-rpc-api] → [metabob-cli MCP] → [Agent] → [OpenCode]
         │
         │ Agent completes task
         │ OpenCode records task result
         │
         ▼
    [Task 2, Task 3, ... continue]


┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Execution Recording (Fixed in v0.6.14)                  │
└─────────────────────────────────────────────────────────────────┘

[OpenCode ActivityManager]
         │
         │ All tasks complete
         │ Calculate: success, duration_ms, cost, tokens
         │
         │ OPTION A (Current - WRONG):
         │ ┌─────────────────────────────────────────┐
         │ │ metabob-cli ActivityManager records     │
         │ │ POST /v2/activities/executions          │
         │ └─────────────────────────────────────────┘
         │
         │ OPTION B (Correct - TODO):
         │ ┌─────────────────────────────────────────┐
         │ │ OpenCode ActivityManager records        │
         │ │ Direct HTTP or via MCP tool             │
         │ └─────────────────────────────────────────┘
         │
         │ Current implementation (v0.6.14):
         ▼
    [metabob-cli ActivityManager] ← Should be OpenCode!
         │
         │ POST /v2/activities/executions
         │ Body: {
         │   variant_id: "fix-bug-complete-abc123",
         │   execution_id: "exec_xyz",
         │   success: true,
         │   duration_ms: 45000,
         │   cost: 0.02,
         │   tokens: {input: 1000, output: 500, cache: 0}
         │ }
         ▼
    [metabob-rpc-api]
         │
         │ Update Thompson Sampling
         │ Redis: activity:metrics:{variant_id}
         │   thompson_alpha += 1  (if success)
         │   thompson_beta += 1   (if failure)
         │   total_selections += 1
         │   avg_cost, avg_duration update
         ▼
    [Redis: Thompson Sampling Updated]
         │
         │ Return: Updated metrics
         ▼
    [metabob-cli] → [OpenCode]
         │
         ▼
    [User sees completion]
```

---

## Flow 2: Developer Uses CLI for Code Analysis

**Scenario**: Developer runs `metabob-cli analyze src/`

```
┌─────────────────────────────────────────────────────────────────┐
│ Code Analysis Flow (No OpenCode Involved)                       │
└─────────────────────────────────────────────────────────────────┘

[Developer] → metabob-cli analyze src/
         │
         ▼
    [metabob-cli: Analysis Command]
         │
         │ 1. Scan files matching patterns
         │ 2. Build file list
         │ 3. Submit for analysis
         │
         │ HTTP POST /v2/analysis/submit
         │ Body: {
         │   files: ["src/app.py", "src/utils.py", ...],
         │   project_id: "my-project"
         │ }
         ▼
    [metabob-rpc-api]
         │
         │ Create analysis job
         │ Queue files for processing
         ▼
    [Analysis Workers (async)]
         │
         │ Process each file
         │ Detect issues
         │ Build CPG
         ▼
    [Redis: Store results]
         │
         │ analysis:results:{job_id}
         │ cpg:components:{project_id}
         │
    [metabob-cli polls for completion]
         │
         │ HTTP GET /v2/analysis/results/{job_id}
         ▼
    [metabob-rpc-api]
         │
         │ Return results from Redis
         ▼
    [metabob-cli displays to developer]
         │
         ▼
    [Developer sees issues]
```

---

## Flow 3: Agent Uses Code Quality Tools During Execution

**Scenario**: Agent inside activity execution needs to check code quality

```
┌─────────────────────────────────────────────────────────────────┐
│ Code Quality Tool Usage (During Activity)                       │
└─────────────────────────────────────────────────────────────────┘

[OpenCode Agent: Task Execution]
         │
         │ Agent prompt includes: "Search for authentication bugs"
         │
         │ Agent decides to use tool
         │
         │ Tool Call: metabob_search_codebase_issues("authentication")
         ▼
    [OpenCode Tool Orchestrator]
         │
         │ Route to MCP tool
         ▼
    [MCP Client: metabob MCP]
         │
         │ JSON-RPC over stdio:
         │ {
         │   "jsonrpc": "2.0",
         │   "method": "tools/call",
         │   "params": {
         │     "name": "metabob_search_codebase_issues",
         │     "arguments": {"query": "authentication"}
         │   }
         │ }
         ▼
    [metabob-cli MCP Server]
         │
         │ Receive MCP request
         │ Parse arguments
         │
         │ HTTP GET /v2/analysis/issues?query=authentication
         ▼
    [metabob-rpc-api]
         │
         │ Search in Redis
         │ Filter by severity, relevance
         │ Apply query matching
         ▼
    [Redis: analysis:issues]
         │
         │ Return: [
         │   {
         │     issue_id: "issue_123",
         │     severity: "HIGH",
         │     category: "security.authentication",
         │     file: "src/auth.py",
         │     line: 42,
         │     description: "Weak password validation"
         │   },
         │   ...
         │ ]
         ▼
    [metabob-rpc-api] → [metabob-cli MCP] → [OpenCode Tool Result]
         │
         │ Agent receives tool result
         │ Agent uses data to make decisions
         │
         ▼
    [Agent continues task execution]
```

---

## Flow 4: Template Registration (Bootstrap)

**Scenario**: Developer creates new activity template

```
┌─────────────────────────────────────────────────────────────────┐
│ Template Registration Flow                                      │
└─────────────────────────────────────────────────────────────────┘

[Developer] Creates template JSON file
         │
         │ template.json:
         │ {
         │   "name": "Fix Authentication Bug",
         │   "category": "bugfix",
         │   "tasks": [...]
         │ }
         │
         │ OPTION A: Via metabob-cli
         │
         ▼
    [metabob-cli register-template template.json]
         │
         │ Validate template schema
         │ Calculate content hash
         │
         │ HTTP POST /v2/activities/templates
         │ Body: { name, category, task_steps, ... }
         ▼
    [metabob-rpc-api]
         │
         │ Auto-variant logic:
         │ - Check if template name exists
         │ - Calculate content hash
         │ - Create new variant if content differs
         │ - Return existing if duplicate
         │
         │ Generate variant_id: "fix-authentication-bug-abc123"
         │
         │ Initialize Thompson Sampling:
         │   thompson_alpha = 1.0
         │   thompson_beta = 1.0
         │   total_selections = 0
         │
         │ Store in Redis:
         │   activity:template:{variant_id} → full template
         │   activity:metrics:{variant_id} → metrics
         │   activity:templates:list → add to set
         ▼
    [Redis: Template Stored]
         │
         │ Return: {
         │   variant_id: "fix-authentication-bug-abc123",
         │   activity_id: "fix-authentication-bug",
         │   content_hash: "abc123",
         │   generation: 0
         │ }
         ▼
    [metabob-cli] → [Developer]
         │
         │ "Template registered successfully"
         │
         │
         │ OPTION B: Via OpenCode activity
         │
    [OpenCode: create-activity-template activity]
         │
         │ Agent creates template
         │ Agent calls MCP tool
         │
         │ MCP Call: metabob_register_template(template_data)
         ▼
    [metabob-cli MCP Server]
         │
         │ Same flow as OPTION A
         │ POST /v2/activities/templates
         ▼
    [metabob-rpc-api]
         │
         │ (same as above)
```

---

## Flow 5: Metrics and Learning (Thompson Sampling)

**Scenario**: Variant promotion is based on measured success rates, not LLM reasoning

```
┌─────────────────────────────────────────────────────────────────┐
│ Thompson Sampling Learning Flow                                 │
└─────────────────────────────────────────────────────────────────┘

[Multiple executions over time]
         │
         │ Execution 1: variant A → success
         │ Execution 2: variant A → success
         │ Execution 3: variant B → failure
         │ Execution 4: variant A → success
         │
         ▼
    [Each execution records to backend]
         │
         │ POST /v2/activities/executions
         ▼
    [metabob-rpc-api: Thompson Sampling Update]
         │
         │ For each execution:
         │
         │ IF success:
         │   thompson_alpha += 1
         │   total_successes += 1
         │ ELSE:
         │   thompson_beta += 1
         │   total_failures += 1
         │
         │ total_selections += 1
         │ success_rate = successes / total
         │ avg_cost = (avg_cost * (n-1) + new_cost) / n
         │ avg_duration = (avg_duration * (n-1) + new_duration) / n
         │
         │ Update Redis:
         │   activity:metrics:{variant_id}
         ▼
    [Redis: Metrics Updated]
         │
         │ Variant A: alpha=4.0, beta=1.0 (success_rate=75%)
         │ Variant B: alpha=1.0, beta=2.0 (success_rate=0%)
         │
         │
    [Next execution: Template selection]
         │
         │ OpenCode requests template list
         │
         │ MCP Call: search_activities(category="bugfix")
         ▼
    [metabob-cli MCP]
         │
         │ GET /v2/activities/templates?category=bugfix
         ▼
    [metabob-rpc-api]
         │
         │ For each variant:
         │   Calculate expected_value = thompson_alpha / (alpha + beta)
         │
         │ Sort by expected_value DESC
         │
         │ Return: [
         │   {variant_id: "variant-A", success_rate: 0.75, expected_value: 0.80},
         │   {variant_id: "variant-B", success_rate: 0.00, expected_value: 0.33}
         │ ]
         ▼
    [OpenCode selects variant A (higher expected value)]
         │
         │ Thompson Sampling guides selection
         │ Exploration vs Exploitation balance
         │
         ▼
    [Execution continues with selected variant]
```

---

## Flow 6: Real-time Updates (WebSocket)

**Scenario**: Dashboard monitors activity execution progress

```
┌─────────────────────────────────────────────────────────────────┐
│ Real-time Progress Updates (Future Enhancement)                 │
└─────────────────────────────────────────────────────────────────┘

[Dashboard/UI] connects to WebSocket
         │
         │ WS: ws://backend:8080/ws/executions/{execution_id}
         ▼
    [metabob-rpc-api WebSocket Handler]
         │
         │ Subscribe to Redis pub/sub
         │   channel: execution:{execution_id}
         │
         ▼
    [OpenCode ActivityManager]
         │
         │ Task 1 started
         │
         │ Publish: execution:{execution_id} → {"task": 1, "status": "running"}
         ▼
    [metabob-rpc-api Redis Pub/Sub]
         │
         │ Forward to WebSocket
         ▼
    [Dashboard receives update]
         │
         │ Shows: "Task 1/5: Searching for bugs..."
         │
         │
         │ Task 1 completed
         │
         │ Publish: execution:{execution_id} → {"task": 1, "status": "completed"}
         ▼
    [Dashboard updates progress bar]
         │
         │ Shows: "Task 2/5: Analyzing root cause..."
```

---

## Protocol Details

### MCP Protocol (OpenCode ↔ metabob-cli)

**Transport**: stdio (stdin/stdout)
**Format**: JSON-RPC 2.0

**Example Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "metabob_search_codebase_issues",
    "arguments": {
      "query": "authentication bugs",
      "limit": 10
    }
  }
}
```

**Example Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 3 issues:\n1. HIGH: Weak password validation (src/auth.py:42)\n..."
      }
    ]
  }
}
```

---

### HTTP REST (metabob-cli ↔ metabob-rpc-api)

**Transport**: HTTP/1.1
**Format**: JSON

**Example Request**:
```http
GET /v2/activities/templates?category=bugfix HTTP/1.1
Host: localhost:8080
Authorization: Bearer <session_token>
Content-Type: application/json
```

**Example Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "templates": [
    {
      "variant_id": "fix-bug-complete-abc123",
      "activity_id": "fix-bug-complete",
      "variant_name": "Fix Bug Complete",
      "category": "bugfix",
      "success_rate": 0.85,
      "total_selections": 20,
      "thompson_alpha": 18.0,
      "thompson_beta": 3.0,
      "expected_value": 0.857
    }
  ]
}
```

---

## Current Issues in Communication Flow

### Issue 1: ActivityManager in Wrong Component ❌

**Current**:
```
metabob-cli ActivityManager → POST /v2/activities/executions
```

**Problem**: Execution is OpenCode's responsibility, not metabob-cli

**Should Be**:
```
OpenCode ActivityManager → POST /v2/activities/executions (direct or via MCP)
```

---

### Issue 2: Template Storage Sync ❌

**Current**: Three storage locations create sync problems
```
Backend Redis ← ? → metabob-cli cache ← ? → OpenCode cache
```

**Should Be**: Backend is source of truth, caches are read-only
```
Backend Redis → (HTTP) → metabob-cli MCP → (MCP) → OpenCode cache
                                            ↓
                                    (on-demand fetch)
```

---

### Issue 3: Direct Backend Calls? ❌

**Question**: Does OpenCode ever call backend directly?

**Should Be**: NO - all backend communication via metabob-cli MCP (Gateway Pattern)

**Validation Needed**: Audit OpenCode codebase for direct HTTP calls to backend

---

## Intended vs Actual Communication

### Intended (Clean Architecture)

```
User/Agent
    ↓
OpenCode (orchestration)
    ↓ MCP only
metabob-cli (stateless tools)
    ↓ HTTP only
metabob-rpc-api (state/business logic)
    ↓
Redis/SurrealDB (persistence)
```

**Characteristics**:
- ✅ One-way dependency
- ✅ Protocol boundaries enforced
- ✅ Testable in isolation
- ✅ Clear ownership

---

### Actual (Current State)

```
User/Agent
    ↓
OpenCode (orchestration)
    ↓ MCP
metabob-cli (tools + execution logic) ← WRONG: Execution should be in OpenCode
    ↓ HTTP
metabob-rpc-api (state + business logic)
    ↓
Redis (with 3 cache locations) ← WRONG: Cache duplication
```

**Issues**:
- ❌ metabob-cli has ActivityManager (should be OpenCode)
- ❌ Execution recording done by wrong component
- ❌ Template caching duplicated in 3 places

---

## Action Items for Clean Communication

1. **Audit OpenCode**: Confirm no direct backend HTTP calls
2. **Move ActivityManager**: From metabob-cli to OpenCode
3. **Remove Caches**: metabob-cli should not cache templates locally
4. **Document Protocols**: Create protocol schemas for MCP and REST
5. **Add Validation**: CI check that enforces communication boundaries

---

## Summary

**Intended Communication Flow**:
```
OpenCode → (MCP) → metabob-cli → (HTTP) → metabob-rpc-api → Redis
```

**Key Principles**:
1. **One Direction**: Dependencies flow downward only
2. **Protocol Boundaries**: MCP between OpenCode/CLI, HTTP between CLI/Backend
3. **Stateless Middle**: metabob-cli has no state, pure pass-through
4. **Single Source of Truth**: Backend owns all persistent state

**Current Violations**:
- metabob-cli has execution logic (should be in OpenCode)
- Template caching in multiple places (should be backend + OpenCode cache only)
- Execution recording responsibility unclear (should be OpenCode)

