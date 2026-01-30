# Separation of Concerns: metabob-opencode ↔ metabob-cli ↔ metabob-rpc-api

**Date**: January 30, 2026  
**Status**: Architecture Boundaries (CRITICAL)  
**Purpose**: Define clear boundaries between components to prevent responsibility bleed

---

## Core Principle

**Each component has ONE job. No overlap. No mixing.**

```
┌─────────────────────────────────────────────────────────────────────┐
│                          metabob-opencode                           │
│                                                                     │
│  RESPONSIBILITY: Task Execution & Agent Coordination                │
│  - Execute activities (templates)                                  │
│  - Coordinate agents (ACP delegation)                              │
│  - Manage sessions, memory, context                                │
│  - Make task decisions                                             │
│                                                                     │
│  DOES NOT:                                                         │
│  - ❌ Run CPG analysis (that's metabob-cli's job)                 │
│  - ❌ Store learning data (that's metabob-rpc-api's job)          │
│  - ❌ Make learning decisions (that's metabob-rpc-api's job)      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                    Consumes MCP Tools
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                          metabob-cli                                │
│                         (MCP Mode)                                  │
│                                                                     │
│  RESPONSIBILITY: Pure CPG Analysis                                  │
│  - Run cpg-inference locally (<10ms)                               │
│  - Expose MCP tools (via stdio)                                    │
│  - Return WHAT exists in code                                      │
│  - No opinions, no scores, no learning                             │
│                                                                     │
│  DOES NOT:                                                         │
│  - ❌ Execute activities (that's metabob-opencode's job)          │
│  - ❌ Store anything (stateless, pure analysis)                   │
│  - ❌ Make recommendations (that's metabob-rpc-api's job)         │
│  - ❌ Track history (that's metabob-rpc-api's job)                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                    (optionally queries for embeddings)
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        metabob-rpc-api                              │
│                                                                     │
│  RESPONSIBILITY: Learning & Recommendations                         │
│  - Store learning state (SurrealDB)                                │
│  - Thompson Sampling (variant assignment)                          │
│  - Track impressions & outcomes                                    │
│  - Update parameters (Celery Beat)                                 │
│  - Provide recommendations (opaque, no internals)                  │
│                                                                     │
│  DOES NOT:                                                         │
│  - ❌ Execute activities (that's metabob-opencode's job)          │
│  - ❌ Run CPG analysis (that's metabob-cli's job)                 │
│  - ❌ Make task decisions (that's metabob-opencode's job)         │
│  - ❌ Expose learning internals to agents                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component 1: metabob-opencode

### Single Responsibility
**Execute tasks through activity templates, coordinating agents and managing context.**

### What It Does

**Core Functions**:
1. **Activity Execution**
   - Load activity templates
   - Execute task sequences
   - Coordinate sub-agents
   - Track progress

2. **Agent Coordination**
   - Delegate tasks via ACP
   - Manage agent sessions
   - Handle communication

3. **Context Management**
   - Session memory
   - Impulse system
   - Token budgets
   - Undo/redo stacks

4. **Task Decisions**
   - Which activity to use
   - When to delegate
   - What to commit

### What It Does NOT Do

**❌ CPG Analysis** (metabob-cli's job)
```typescript
// ❌ WRONG: Don't parse code in metabob-opencode
function searchCodebase(query: string) {
  // Parse AST, build CPG, search...
}

// ✅ CORRECT: Delegate to metabob-cli MCP
const results = await metabob_search_codebase_issues({ query })
```

**❌ Learning Storage** (metabob-rpc-api's job)
```typescript
// ❌ WRONG: Don't store learning data in metabob-opencode
function recordActivitySuccess(activityId: string) {
  await db.activities.update({ successCount: +1 })
}

// ✅ CORRECT: Delegate to metabob-rpc-api
await fetch('http://rpc-api/api/v1/feedback/record', {
  body: { impression_id, outcome: 'success' }
})
```

**❌ Learning Decisions** (metabob-rpc-api's job)
```typescript
// ❌ WRONG: Don't implement Thompson Sampling in metabob-opencode
function selectActivity(task: string) {
  const variants = await getVariants()
  const theta = sampleBeta(variants[0].alpha, variants[0].beta)
  // ...
}

// ✅ CORRECT: Query metabob-rpc-api
const rec = await fetch('http://rpc-api/api/v1/recommendations/get', {
  body: { task, component_ids }
})
```

### Boundaries

**Inbound**:
- User requests (CLI, UI)
- Agent messages (ACP)
- Tool results (MCP, local tools)

**Outbound**:
- MCP tool calls (metabob-cli) - **READ ONLY**
- HTTP requests (metabob-rpc-api) - **OPAQUE RESPONSES**
- File system operations (workspace)
- Git operations (repository)

**Data Flow**:
```
User → metabob-opencode → MCP (metabob-cli) → CPG results
                        → RPC (metabob-rpc-api) → Recommendations
                        → Workspace → Files modified
```

---

## Component 2: metabob-cli (MCP Mode)

### Single Responsibility
**Provide pure, fast, local CPG analysis via MCP tools. No state. No opinions.**

### What It Does

**Core Functions**:
1. **CPG Analysis** (via cpg-inference)
   - Parse code → AST
   - Build CPG (components, dependencies)
   - Query CPG (search, impact, safety)

2. **MCP Tool Exposure**
   - Expose tools via stdio (MCP protocol)
   - Handle tool calls
   - Return structured results

3. **Pure Data Return**
   - Component IDs
   - File paths
   - Dependencies/dependents
   - Existence checks (true/false)

### What It Does NOT Do

**❌ Scoring or Ranking** (metabob-rpc-api's job)
```python
# ❌ WRONG: Don't add similarity scores in metabob-cli
def search_codebase_issues(query: str):
    components = cpg.search(query)
    return [{
        "component_id": c.id,
        "similarity_score": 0.85  # ❌ NO! This is learning data
    }]

# ✅ CORRECT: Return only what exists
def search_codebase_issues(query: str):
    components = cpg.search(query)
    return [{
        "component_id": c.id,
        "file_path": c.file,
        "component_name": c.name
    }]
```

**❌ Recommendations** (metabob-rpc-api's job)
```python
# ❌ WRONG: Don't suggest what to do
def analyze_change_impact(file: str, component: str):
    impact = cpg.get_impact(file, component)
    return {
        "dependencies": impact.deps,
        "recommendation": "Fix dependencies first"  # ❌ NO!
    }

# ✅ CORRECT: Return only graph structure
def analyze_change_impact(file: str, component: str):
    impact = cpg.get_impact(file, component)
    return {
        "dependencies": impact.deps,
        "dependents": impact.dependents
    }
```

**❌ State Storage** (metabob-rpc-api's job)
```python
# ❌ WRONG: Don't cache learning data
class MetabobCLI:
    def __init__(self):
        self.search_history = []  # ❌ NO!
        self.success_rates = {}   # ❌ NO!

# ✅ CORRECT: Stateless analysis
class MetabobCLI:
    def __init__(self, repo_path: str):
        self.repo_path = repo_path  # ✅ Only config
```

**❌ Activity Execution** (metabob-opencode's job)
```python
# ❌ WRONG: Don't execute tasks
def fix_component(component_id: str):
    # Apply fix...
    # Run tests...
    # Commit...

# ✅ CORRECT: Only analyze
def get_component_info(component_id: str):
    return cpg.get_component(component_id)
```

### Boundaries

**Inbound**:
- MCP tool calls (stdio, from metabob-opencode)
- Repository path (config)

**Outbound**:
- MCP tool results (stdio, to metabob-opencode)
- (Optional) RPC API calls for embeddings ONLY

**Data Flow**:
```
metabob-opencode → MCP call → metabob-cli → cpg-inference → CPG
                             ← MCP result ← Pure data ←
```

**Important**: metabob-cli should NEVER call metabob-rpc-api for learning data. If embeddings are needed, they should be for CPG indexing only, not learning-based recommendations.

---

## Component 3: metabob-rpc-api

### Single Responsibility
**Learn from outcomes, provide opaque recommendations. Hidden from agents.**

### What It Does

**Core Functions**:
1. **Variant Assignment** (Thompson Sampling)
   - Sample from Beta(alpha, beta)
   - Select activity variant
   - Track impression

2. **Context Selection** (Association-Based)
   - Query component-impulse associations
   - Select highest weighted impulses
   - Return within token budget

3. **Feedback Processing**
   - Update Thompson parameters
   - Update association weights
   - Trigger background learning

4. **Background Learning** (Celery Beat)
   - Batch parameter updates
   - Prune weak associations
   - Generate analytics (humans only)

5. **Storage** (SurrealDB)
   - Activity variants (alpha, beta)
   - Variant assignments (impressions)
   - Component-impulse associations
   - Component embeddings

### What It Does NOT Do

**❌ CPG Analysis** (metabob-cli's job)
```python
# ❌ WRONG: Don't parse code in metabob-rpc-api
@app.post("/api/v1/recommendations/get")
def get_recommendation(task: str, component_ids: List[str]):
    # Parse repository AST...  ❌ NO!
    # Build CPG...              ❌ NO!

# ✅ CORRECT: Use embeddings from metabob-cli or pre-computed
@app.post("/api/v1/recommendations/get")
def get_recommendation(task: str, component_ids: List[str]):
    # Query pre-computed embeddings
    similar = db.query("SELECT * FROM component_embeddings WHERE ...")
    # Thompson Sampling
    # Return recommendation
```

**❌ Activity Execution** (metabob-opencode's job)
```python
# ❌ WRONG: Don't execute activities
@app.post("/api/v1/execute-activity")
def execute_activity(activity_id: str):
    # Load template...  ❌ NO!
    # Run tasks...      ❌ NO!
    # Commit...         ❌ NO!

# ✅ CORRECT: Only recommend
@app.post("/api/v1/recommendations/get")
def get_recommendation(task: str):
    # Thompson Sampling
    return {"recommended_activity": "fix-bug-complete"}
```

**❌ Expose Learning Internals** (double-blind violation)
```python
# ❌ WRONG: Don't show scores/probabilities to agents
@app.post("/api/v1/recommendations/get")
def get_recommendation(task: str):
    variants = thompson_sample()
    return {
        "recommended_activity": variants[0].activity_id,
        "confidence": 0.85,        # ❌ NO! Agent bias
        "theta_sampled": 0.73,     # ❌ NO! Internal data
        "success_rate": 0.8        # ❌ NO! Learning data
    }

# ✅ CORRECT: Opaque recommendation
@app.post("/api/v1/recommendations/get")
def get_recommendation(task: str):
    variants = thompson_sample()
    impression = track_impression(variants[0])
    return {
        "recommended_activity": variants[0].activity_id,
        "context_impulses": select_context(variants[0]),
        "impression_id": impression.id  # Opaque token
    }
```

**❌ Make Task Decisions** (metabob-opencode's job)
```python
# ❌ WRONG: Don't decide whether to execute
@app.post("/api/v1/should-i-execute")
def should_execute(activity_id: str):
    # Check success rate...  ❌ NO! Agent decides
    return {"execute": True}

# ✅ CORRECT: Only provide recommendations when asked
@app.post("/api/v1/recommendations/get")
def get_recommendation(task: str):
    # Thompson Sampling
    # Agent decides whether to use recommendation
```

### Boundaries

**Inbound**:
- HTTP POST /api/v1/recommendations/get (from metabob-opencode)
- HTTP POST /api/v1/feedback/record (from metabob-opencode)
- (Optional) Embedding requests from metabob-cli

**Outbound**:
- SurrealDB queries/updates
- Celery task queue
- (Optional) Metabob backend sync

**Data Flow**:
```
metabob-opencode → HTTP → metabob-rpc-api → SurrealDB
                         ← Recommendation ←
                         
                         → Celery → Background learning
```

---

## Communication Protocols

### metabob-opencode ↔ metabob-cli

**Protocol**: MCP (Model Context Protocol) over stdio

**Flow**:
```typescript
// metabob-opencode
const mcpClient = new MCPClient({ command: 'metabob-cli', args: ['--mcp'] })

// Request
const result = await mcpClient.callTool('metabob_search_codebase_issues', {
  query: 'memory leak',
  limit: 10
})

// Response (pure CPG, no scores)
// [
//   { component_id: "src/session/index.ts::messages", file_path: "...", ... },
//   ...
// ]
```

**Contract**:
- ✅ metabob-cli exposes tools via MCP
- ✅ metabob-opencode consumes tools via MCP client
- ❌ NO learning data in responses
- ❌ NO state stored in metabob-cli
- ❌ NO HTTP/REST (only stdio)

### metabob-opencode ↔ metabob-rpc-api

**Protocol**: HTTP/REST

**Flow**:
```typescript
// metabob-opencode
const response = await fetch('http://api-server:8080/api/v1/recommendations/get', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'Fix memory leak',
    component_ids: ['src/session/index.ts::messages'],
    task_type: 'fix_bug'
  })
})

// Response (opaque, no internals)
// {
//   recommended_activity: "fix-bug-complete",
//   context_impulses: [{id, content}],
//   impression_id: "imp_abc123"
// }
```

**Contract**:
- ✅ metabob-opencode queries for recommendations
- ✅ metabob-opencode posts feedback
- ❌ NO learning internals exposed (double-blind)
- ❌ NO CPG analysis in metabob-rpc-api
- ❌ NO activity execution in metabob-rpc-api

### metabob-cli ↔ metabob-rpc-api

**Protocol**: (OPTIONAL) HTTP/REST for embeddings only

**Flow**:
```python
# metabob-cli (ONLY if embedding support added)
# For CPG indexing, NOT for learning recommendations

embedding = requests.post('http://api-server:8080/api/v1/embeddings/compute', {
  'text': component_description,
  'type': 'component'
})

# Store in local CPG index for faster search
```

**Contract**:
- ⚠️ OPTIONAL: metabob-cli MAY query for embeddings (CPG indexing)
- ❌ metabob-cli MUST NOT query for learning data
- ❌ metabob-cli MUST NOT send learning feedback
- ❌ metabob-rpc-api MUST NOT trigger CPG analysis

**Important**: This connection should be minimal or non-existent. If needed, it's ONLY for embedding computation to improve CPG search, NOT for learning-based recommendations.

---

## Anti-Patterns (What NOT to Do)

### ❌ Anti-Pattern 1: Responsibility Bleed

**BAD**: metabob-opencode doing CPG analysis
```typescript
// ❌ WRONG: Don't parse code in metabob-opencode
class ActivityTask {
  async execute() {
    const ast = parseTypeScript(this.file)
    const components = extractComponents(ast)
    // ...
  }
}

// ✅ CORRECT: Use metabob-cli MCP
class ActivityTask {
  async execute() {
    const components = await metabob_list_file_components({ file: this.file })
    // ...
  }
}
```

### ❌ Anti-Pattern 2: Leaking Learning Data

**BAD**: metabob-cli returning scores
```python
# ❌ WRONG: Don't add learning data to CPG results
def search_codebase_issues(query: str):
    components = cpg.search(query)
    # Query metabob-rpc-api for success rates  ❌ NO!
    for component in components:
        component['success_rate'] = get_success_rate(component.id)
    return components

# ✅ CORRECT: Pure CPG only
def search_codebase_issues(query: str):
    components = cpg.search(query)
    return [{"component_id": c.id, "file_path": c.file} for c in components]
```

### ❌ Anti-Pattern 3: Mixing Protocols

**BAD**: metabob-cli exposing HTTP endpoints
```python
# ❌ WRONG: Don't add REST API to metabob-cli
@app.get("/api/search")
def search_api(query: str):
    return search_codebase_issues(query)

# ✅ CORRECT: Only MCP tools
def main():
    mcp_server = MCPServer()
    mcp_server.add_tool('metabob_search_codebase_issues', search_codebase_issues)
    mcp_server.run()  # stdio only
```

### ❌ Anti-Pattern 4: Storing State in Wrong Place

**BAD**: metabob-opencode storing learning parameters
```typescript
// ❌ WRONG: Don't store learning data in metabob-opencode
class ActivitySystem {
  private successRates: Map<string, number> = new Map()
  
  async selectActivity(task: string) {
    // Thompson Sampling in metabob-opencode  ❌ NO!
  }
}

// ✅ CORRECT: Query metabob-rpc-api
class ActivitySystem {
  async selectActivity(task: string) {
    const rec = await fetch('http://rpc-api/api/v1/recommendations/get', ...)
    return rec.recommended_activity
  }
}
```

### ❌ Anti-Pattern 5: Direct Database Access

**BAD**: metabob-opencode directly querying SurrealDB
```typescript
// ❌ WRONG: Don't bypass metabob-rpc-api
const db = new Surreal()
await db.connect('ws://localhost:8000')
const variants = await db.query('SELECT * FROM activity_variants')

// ✅ CORRECT: Use metabob-rpc-api HTTP endpoints
const rec = await fetch('http://rpc-api/api/v1/recommendations/get', ...)
```

---

## Validation Checklist

### metabob-opencode

- [ ] Does NOT parse code (uses metabob-cli MCP)
- [ ] Does NOT store learning data (uses metabob-rpc-api)
- [ ] Does NOT implement Thompson Sampling (uses metabob-rpc-api)
- [ ] DOES execute activities
- [ ] DOES coordinate agents
- [ ] DOES manage context/memory

### metabob-cli

- [ ] Does NOT return scores/confidence (pure CPG)
- [ ] Does NOT make recommendations (pure data)
- [ ] Does NOT store state (stateless)
- [ ] Does NOT expose HTTP/REST (MCP stdio only)
- [ ] DOES run cpg-inference
- [ ] DOES expose MCP tools
- [ ] DOES return component structure

### metabob-rpc-api

- [ ] Does NOT parse code (uses embeddings)
- [ ] Does NOT execute activities (returns recommendations)
- [ ] Does NOT expose learning internals (double-blind)
- [ ] Does NOT make task decisions (agent's job)
- [ ] DOES implement Thompson Sampling
- [ ] DOES store learning state
- [ ] DOES provide opaque recommendations
- [ ] DOES process feedback

---

## Summary

| Component | Single Responsibility | Protocol | State |
|-----------|----------------------|----------|-------|
| **metabob-opencode** | Execute tasks & coordinate agents | CLI, MCP client, HTTP client | Session, memory, context |
| **metabob-cli** | Pure CPG analysis | MCP server (stdio) | **Stateless** |
| **metabob-rpc-api** | Learn & recommend | HTTP server | Learning data (SurrealDB) |

**Golden Rule**: Each component does ONE thing. No overlap. No responsibility bleed.

**Communication**: 
- metabob-opencode → metabob-cli: **MCP (stdio)**
- metabob-opencode → metabob-rpc-api: **HTTP**
- metabob-cli → metabob-rpc-api: **OPTIONAL** (embeddings only, if at all)

**Data Boundaries**:
- **CPG data**: Lives in metabob-cli (transient, computed on-demand)
- **Learning data**: Lives in metabob-rpc-api (persistent, SurrealDB)
- **Session data**: Lives in metabob-opencode (transient, session-scoped)

---

**This separation MUST be maintained for the architecture to work correctly.**
