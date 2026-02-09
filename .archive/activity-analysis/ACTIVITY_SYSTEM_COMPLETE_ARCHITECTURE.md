# Activity System: Complete Architecture and Data Flow

## Executive Summary

**The activity system enables Metabob to learn optimal development workflows through observation and measurement.**

**Key Components**:
1. **metabob-opencode**: Agent execution environment with activity framework
2. **metabob-cli MCP**: Backend interface for template storage and retrieval
3. **metabob-rpc-api**: Learning system with Thompson Sampling and optimization

**Data Flow**: Agent executes → Metrics tracked → Outcomes recorded → Metabob learns → Recommendations improve

---

## Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ACTIVITY SYSTEM ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. AGENT ORCHESTRATION (metabob-opencode)                              │
│     ┌──────────────────────────────────────┐                            │
│     │ Agent decides: WHICH activity to run │                            │
│     │                                       │                            │
│     │ search_activities({ category })      │ ← Only 2 tools visible     │
│     │   ↓ Returns ranked templates         │                            │
│     │ activity({ templateId, variables })  │                            │
│     └──────────────────────────────────────┘                            │
│                        ↓                                                 │
│  2. TEMPLATE LOADING (metabob-opencode)                                 │
│     ┌──────────────────────────────────────┐                            │
│     │ TemplateExecutor.execute()           │                            │
│     │   ↓                                   │                            │
│     │ TemplateRepository.get(templateId)   │                            │
│     │   ↓                                   │                            │
│     │ TemplateLoader.load()                │                            │
│     │   ├─ Check: TemplateCache (5-min)    │                            │
│     │   └─ Fetch: TemplateServiceClient    │                            │
│     └──────────────────────────────────────┘                            │
│                        ↓                                                 │
│  3. BACKEND RETRIEVAL (metabob-cli MCP)                                 │
│     ┌──────────────────────────────────────┐                            │
│     │ TemplateServiceClient.getTemplate()  │                            │
│     │   ↓                                   │                            │
│     │ MetabobAPI (HTTP) or MetabobCLI (MCP)│                            │
│     │   ↓                                   │                            │
│     │ metabob-cli MCP Server               │                            │
│     │   ↓                                   │                            │
│     │ ActivityManager.get_activity()       │                            │
│     └──────────────────────────────────────┘                            │
│                        ↓                                                 │
│  4. STORAGE (metabob-rpc-api)                                           │
│     ┌──────────────────────────────────────┐                            │
│     │ SurrealDB: activity_templates table  │                            │
│     │                                       │                            │
│     │ {                                     │                            │
│     │   id: "template-name",               │                            │
│     │   version: 3,                        │                            │
│     │   tasks: [...],                      │                            │
│     │   executions: 45,                    │                            │
│     │   successRate: 0.82,                 │                            │
│     │   avgCost: 2.15,                     │                            │
│     │   avgDuration: 18500                 │                            │
│     │ }                                     │                            │
│     └──────────────────────────────────────┘                            │
│                        ↓                                                 │
│  5. EXECUTION (metabob-opencode)                                        │
│     ┌──────────────────────────────────────┐                            │
│     │ Template loaded → Tasks executed     │                            │
│     │                                       │                            │
│     │ For each task:                       │                            │
│     │   - Load impulse context             │                            │
│     │   - Interpolate variables            │                            │
│     │   - Execute via subagent             │                            │
│     │   - Track: cost, tokens, duration    │                            │
│     │   - Run validation                   │                            │
│     │   - Record result                    │                            │
│     └──────────────────────────────────────┘                            │
│                        ↓                                                 │
│  6. METRICS RECORDING (metabob-opencode)                                │
│     ┌──────────────────────────────────────┐                            │
│     │ TemplateExecutor.updateMetrics()     │                            │
│     │                                       │                            │
│     │ executions += 1                      │                            │
│     │ successRate = (old*n + result) / n+1 │                            │
│     │ avgCost = (old*n + cost) / n+1       │                            │
│     │ avgDuration = (old*n + dur) / n+1    │                            │
│     └──────────────────────────────────────┘                            │
│                        ↓                                                 │
│  7. BACKEND UPDATE (metabob-cli MCP)                                    │
│     ┌──────────────────────────────────────┐                            │
│     │ TemplateServiceClient.updateMetrics()│                            │
│     │   ↓                                   │                            │
│     │ MetabobAPI.updateTemplateMetrics()   │                            │
│     │   ↓                                   │                            │
│     │ ActivityManager.updateMetrics()      │                            │
│     │   ↓                                   │                            │
│     │ POST /activity-recommendations/...   │                            │
│     └──────────────────────────────────────┘                            │
│                        ↓                                                 │
│  8. LEARNING (metabob-rpc-api)                                          │
│     ┌──────────────────────────────────────┐                            │
│     │ Thompson Sampling Updates:           │                            │
│     │                                       │                            │
│     │ If success: alpha += 1               │                            │
│     │ If failure: beta += 1                │                            │
│     │                                       │                            │
│     │ Success rate ≈ alpha / (alpha+beta)  │                            │
│     └──────────────────────────────────────┘                            │
│                        ↓                                                 │
│  9. OPTIMIZATION (metabob-rpc-api)                                      │
│     ┌──────────────────────────────────────┐                            │
│     │ Weekly: Analyze failure patterns     │                            │
│     │ Monthly: Generate evolved variants   │                            │
│     │ Continuous: Thompson Sampling ranks  │                            │
│     └──────────────────────────────────────┘                            │
│                        ↓                                                 │
│  10. IMPROVED RECOMMENDATIONS                                           │
│      ┌─────────────────────────────────────┐                            │
│      │ Future search_activities():         │                            │
│      │   - Higher ranked templates         │                            │
│      │   - Better success predictions      │                            │
│      │   - Optimized variants preferred    │                            │
│      └─────────────────────────────────────┘                            │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Breakdown

### Component 1: Agent Decision Layer (metabob-opencode)

**Files**:
- `src/tool/search-activities.ts`
- `src/tool/activity.ts`

**Responsibilities**:
- Expose 2 simple tools to agents
- Hide implementation details
- Focus agent on WHAT and WHEN decisions

**Agent Perspective**:
```typescript
// Step 1: Discovery
const results = await search_activities({ category: "feature" })
// Returns: [{ id, name, successRate, description }]

// Step 2: Selection (agent's decision)
// Pick based on: success rate, description match, cost

// Step 3: Execution
await activity({
  activityId: "add-rest-endpoint",
  variables: { method: "POST", path: "/api/users" },
  reason: "User wants registration endpoint"
})

// Framework handles everything else (context, validation, metrics)
```

---

### Component 2: Template Management (metabob-opencode)

**Files**:
- `src/session/activity-template-repository.ts`
- `src/session/template-loader.ts`
- `src/session/template-cache.ts`

**Responsibilities**:
- Cache templates (5-min TTL)
- Load from backend
- Save to backend
- Update metrics

**Key Operations**:

```typescript
// 1. LIST (with caching)
TemplateRepository.list({ category: "feature" })
  ↓
TemplateLoader.list()
  ↓
TemplateServiceClient.listTemplates()
  ↓
Metabob Backend (SurrealDB)

// 2. GET (with caching)
TemplateRepository.get("template-id")
  ↓
TemplateCache.get("template-id") // Check cache first
  ↓ (if miss)
TemplateLoader.load("template-id")
  ↓
TemplateServiceClient.getTemplate()
  ↓
Metabob Backend (SurrealDB)

// 3. SAVE (register new template)
TemplateRepository.save(template)
  ↓
TemplateLoader.save(template)
  ↓
TemplateServiceClient.registerTemplate()
  ↓
MetabobAPI.registerActivityTemplate()
  ↓
Metabob Backend (SurrealDB)

// 4. UPDATE METRICS (after execution)
TemplateRepository.updateMetrics(id, metrics)
  ↓
TemplateLoader.updateMetrics()
  ↓
TemplateServiceClient.updateTemplateMetrics()
  ↓
MetabobAPI.updateTemplateMetrics()
  ↓
Metabob Backend (SurrealDB)
```

---

### Component 3: Template Execution (metabob-opencode)

**Files**:
- `src/session/template-executor.ts`
- `src/session/activity.ts`

**Responsibilities**:
- Load template from repository
- Interpolate variables
- Execute tasks in dependency order
- Track metrics per task
- Run validation
- Update template metrics

**Execution Flow**:

```typescript
TemplateExecutor.execute({ templateId, variables, reason })
  ↓
1. Load template from TemplateRepository
2. Validate variables (required fields present)
3. Create Activity.Info (tracking object)
4. Execute tasks:
   ↓
   For each task (in dependency order):
     a. Load required impulses
     b. Interpolate prompt with variables
     c. Create subagent session
     d. Execute task
     e. Record: success, cost, duration, tokens
     f. Run task validation
     g. Store result in Activity.Info
   ↓
5. Run integration validation
6. Calculate totals: cost, duration, tokens, success
7. Update template metrics (Bayesian update)
8. Return ExecutionResult
```

**Metrics Tracked Per Execution**:
```typescript
interface ExecutionResult {
  activityId: string
  success: boolean
  tasks: TaskExecution[]
  totalDuration: number      // milliseconds
  totalCost: number          // USD
  totalTokens: {
    input: number
    output: number
    cache: number
  }
}

interface TaskExecution {
  taskId: string
  status: "completed" | "failed"
  duration: number
  cost: number
  tokens: { input, output, cache }
  attempts: number
  error?: string
}
```

**Metrics Update Algorithm** (Bayesian):
```typescript
// File: template-executor.ts, lines 1892-1908
const executions = template.executions + 1
const successCount = template.successRate * template.executions + (result.success ? 1 : 0)

await ActivityTemplate.update(template.id, {
  executions,
  successRate: successCount / executions,  // ← Rolling average
  avgDuration: (template.avgDuration * template.executions + result.totalDuration) / executions,
  avgCost: (template.avgCost * template.executions + result.totalCost) / executions,
  avgTokens: {
    input: (template.avgTokens.input * template.executions + result.totalTokens.input) / executions,
    output: (template.avgTokens.output * template.executions + result.totalTokens.output) / executions,
    cache: (template.avgTokens.cache * template.executions + result.totalTokens.cache) / executions,
  }
})
```

---

### Component 4: Backend Communication (metabob-opencode)

**Files**:
- `src/server/template-service-client.ts`
- `src/util/metabob-api.ts`
- `src/util/metabob.ts` (MetabobCLI wrapper)

**Responsibilities**:
- HTTP API calls to backend
- Fallback to MCP if HTTP fails
- Connection status tracking
- Error handling and retries

**API Methods**:

```typescript
// Primary: Direct HTTP (first-party integration)
MetabobAPI.registerActivityTemplate(template)
  → POST http://localhost:8080/activity-recommendations/variants

MetabobAPI.updateTemplateMetrics(id, metrics)
  → PATCH http://localhost:8080/activity-recommendations/variants/{id}/metrics

MetabobAPI.getTemplate(id)
  → GET http://localhost:8080/activity-recommendations/variants/{id}/details

MetabobAPI.listTemplates(category)
  → GET http://localhost:8080/activity-recommendations/variants?category={category}

// Fallback: MCP tools (via metabob-cli)
MetabobCLI.registerActivityTemplate(template)
  → MCP tool: metabob_register_activity_template

MetabobCLI.searchActivities(query)
  → MCP tool: metabob_search_activities
```

**Connection Management**:
```typescript
// Check connection status (cached for 1 minute)
const status = await TemplateServiceClient.checkConnection()

if (status.connected) {
  // Use direct API
  await MetabobAPI.registerActivityTemplate(template)
} else {
  // Fallback to MCP
  await MetabobCLI.registerActivityTemplate(template)
}
```

---

### Component 5: MCP Server (metabob-cli)

**Files**:
- `src/metabob_cli/mcp/activity_manager.py`
- `src/metabob_cli/mcp/tools.py`
- `src/metabob_cli/mcp/server.py`

**Responsibilities**:
- Expose activity operations as MCP tools
- Communicate with backend API
- Manage session tokens
- Handle backend failures gracefully

**MCP Tools** (for metabob-opencode):

```python
# Template Management
@mcp.tool(name="create_activity_template")
async def create_activity_template_tool(
    name: str,
    description: str,
    category: str,
    tasks: str,  # JSON array
) -> str:
    manager = get_activity_manager(base_url, session_token)
    result = await manager.create_template(...)
    return json.dumps(result)

# Activity Execution (if needed for step-by-step mode)
@mcp.tool(name="start_activity_execution")
async def start_activity_execution_tool(...) -> str:
    # Creates execution tracking
    # Returns execution_id

@mcp.tool(name="get_next_step")
async def get_next_step_tool(execution_id: str) -> str:
    # Returns ONLY current step (incremental delivery)

@mcp.tool(name="report_step_result")
async def report_step_result_tool(...) -> str:
    # Records step completion with metrics
```

**Note**: metabob-opencode's TemplateExecutor handles full execution internally. These MCP tools are for alternative execution modes or external clients.

---

### Component 6: Backend API (metabob-rpc-api)

**Files**:
- `server/routes/activity_recommendations.py`
- `server/actions/activities.py`

**Endpoints**:

```python
# Template Management
POST   /activity-recommendations/variants
GET    /activity-recommendations/variants/{variant_id}/details
GET    /activity-recommendations/variants
PATCH  /activity-recommendations/variants/{variant_id}/metrics
DELETE /activity-recommendations/variants/{variant_id}

# Thompson Sampling
POST   /activity-recommendations/recommendations
POST   /activity-recommendations/selections
POST   /activity-recommendations/conversions

# Genealogy
GET    /activity-recommendations/variants/{variant_id}/lineage
POST   /activity-recommendations/variants/{parent_id}/derive
```

**Database Schema** (SurrealDB):

```sql
-- Table: activity_templates
{
  id: string,                    // e.g., "add-rest-endpoint"
  variant_id: string,            // e.g., "add-rest-endpoint:sha256_abc123"
  version: number,               // e.g., 3
  name: string,                  // e.g., "Add REST Endpoint"
  description: string,
  category: string,              // feature, bugfix, refactor, tool
  tasks: array<Task>,            // Full task definitions
  variables: object,             // Variable schema
  
  -- Execution metrics (updated after each run)
  executions: number,            // Total executions
  successRate: number,           // 0.0 - 1.0
  avgDuration: number,           // milliseconds
  avgCost: number,               // USD
  avgTokens: {
    input: number,
    output: number,
    cache: number
  },
  
  -- Thompson Sampling parameters
  alpha: number,                 // Success count + 1
  beta: number,                  // Failure count + 1
  
  -- Genealogy
  parent_hash: string,           // Parent's content hash
  lineage: array<string>,        // All ancestor hashes
  content_hash: string,          // This variant's hash
  evolution_type: string,        // derived, optimized, merged
  evolution_note: string,        // Why this variant exists
  
  -- Metadata
  created_at: datetime,
  updated_at: datetime,
  status: string                 // active, testing, deprecated
}

-- Table: activity_executions
{
  execution_id: string,
  variant_id: string,
  template_id: string,
  success: boolean,
  duration_ms: number,
  cost: number,
  tokens: object,
  task_results: array<TaskResult>,
  validation_results: object,
  created_at: datetime
}

-- Table: activity_recommendations
{
  impression_id: string,
  selection_id: string,
  variant_id: string,
  consumer_id: string,
  session_id: string,
  predicted_conversion: number,
  actual_conversion: boolean,
  created_at: datetime
}
```

---

### Component 7: Thompson Sampling (metabob-rpc-api)

**Algorithm**:

```python
def get_recommendations(query: str, category: str) -> List[Recommendation]:
    # 1. Fetch all variants matching category
    variants = db.query("SELECT * FROM activity_templates WHERE category = $category")
    
    # 2. For each variant, sample from Beta distribution
    recommendations = []
    for variant in variants:
        # Thompson Sampling: sample from Beta(alpha, beta)
        alpha = variant.alpha or (variant.successRate * variant.executions + 1)
        beta = variant.beta or ((1 - variant.successRate) * variant.executions + 1)
        
        sample = np.random.beta(alpha, beta)
        
        recommendations.append({
            "variant_id": variant.variant_id,
            "predicted_conversion": sample,
            "expected_value": sample * (1 - variant.avgCost),
            "confidence": alpha + beta,  # Higher = more data
            "success_rate": variant.successRate,
            "executions": variant.executions
        })
    
    # 3. Sort by sampled value (exploration built-in)
    recommendations.sort(key=lambda r: r["predicted_conversion"], reverse=True)
    
    # 4. Apply exploration parameter (10% random)
    if random.random() < 0.1:
        random.shuffle(recommendations)
    
    # 5. Return top N
    return recommendations[:limit]
```

**Key Properties**:
- **Exploration**: Low-performing variants still tried occasionally
- **Exploitation**: High-performing variants tried more often
- **Convergence**: Over time, best variant emerges naturally
- **No Manual Tuning**: Algorithm handles trade-offs automatically

---

## Registration Flow (Detailed)

### Scenario: Agent Creates "Jiggle Documentation" Template

#### Step 1: Agent Decision

```typescript
// Agent searches for existing templates
const existing = await search_activities({ query: "documentation" })

// No match found, decide to create new template
// Agent decides to use create-activity-template activity
await activity({
  activityId: "create-activity-template",
  variables: {
    templateName: "Jiggle Documentation",
    templateDescription: "Organize docs by date, percolate details, delete obsolete",
    category: "tool",
    purpose: "Systematically maintain documentation quality",
    templateId: "jiggle-documentation"
  },
  reason: "User wants to organize documentation"
})
```

#### Step 2: Template Creation Activity Executes

**Task 1: analyze-examples** (improved version)
```
Memory agent loads high-quality tool templates
Agent studies: cleanup-docs-tests, git-revision-management
Agent extracts patterns: task count, validation strategies
Output: "Patterns observed: 3-5 tasks optimal, comprehensive validation..."
```

**Task 2: design-task-graph** (improved version)
```
Agent designs graph:

scan-inventory (agent: general)
  Purpose: Find all .md files, extract metadata
  Validation: Output contains file list JSON
  ↓
analyze-relationships (agent: general)
  Purpose: Identify doc relationships
  Validation: Output contains relationship graph
  ↓
percolate-updates (agent: general)
  Purpose: Copy details from newer to older docs
  Validation: At least 1 file updated
  ↓
generate-summary (agent: general)
  Purpose: Create SUMMARY.md
  Validation: SUMMARY.md exists

Output saved for next task
```

**Task 3: write-template-json** (improved version)
```
Agent converts graph to JSON:
  - 4 tasks (optimal range)
  - Each task has validation
  - Each task has retry config
  - Dependencies match graph

Self-validation runs:
  ✓ jq empty jiggle-documentation.json
  ✓ jq '.tasks | length' → 4 (valid)
  ✓ jq '.tasks | all(.validation)' → true
  ✓ Dependency graph valid

Creates: jiggle-documentation.json
```

**Task 4: register-template**
```
Calls: register_activity_template({ file_path: "jiggle-documentation.json" })
  ↓
Loads JSON, generates full schema
  ↓
TemplateRepository.save(template)
  ↓
TemplateLoader.save()
  ↓
TemplateServiceClient.registerTemplate()
  ↓
MetabobAPI.registerActivityTemplate()
  → POST /activity-recommendations/variants
  ↓
SurrealDB stores template

Verification:
search_activities({ query: "jiggle" })
  ↓
Found: [{ id: "jiggle-documentation", name: "Jiggle Documentation", ... }]
  ✓ Registration successful
```

#### Step 3: Template Now Discoverable

```typescript
// Any agent can now find it
const results = await search_activities({ category: "tool" })

// Results include:
{
  id: "jiggle-documentation",
  name: "Jiggle Documentation",
  description: "Organize docs by date, percolate details, delete obsolete",
  category: "tool",
  executions: 0,          // Not yet executed
  successRate: 0.5,       // Uniform prior
  avgCost: 0,             // No data yet
  avgDuration: 0          // No data yet
}
```

#### Step 4: First Execution

```typescript
// Agent uses the new template
const result = await activity({
  activityId: "jiggle-documentation",
  variables: { doc_directory: "." },
  reason: "Organize project documentation"
})

// After execution:
// - success: true
// - cost: $0.85
// - duration: 12,500 ms
// - tokens: { input: 8500, output: 2100, cache: 5000 }
```

#### Step 5: Metrics Updated

```typescript
// Automatic update after execution
await TemplateRepository.updateMetrics("jiggle-documentation", {
  executions: 1,
  successRate: 1.0,        // 1/1 = 100%
  avgDuration: 12500,
  avgCost: 0.85,
  avgTokens: { input: 8500, output: 2100, cache: 5000 }
})

// Backend also updates Thompson Sampling:
alpha = 2  // 0 + 1 (prior) + 1 (success)
beta = 1   // 0 + 1 (prior) + 0 (no failures)
```

#### Step 6: Future Searches Rank Higher

```typescript
// Next search for tool templates
const results = await search_activities({ category: "tool" })

// Thompson Sampling:
// - Samples from Beta(2, 1) for jiggle-documentation → ~0.75
// - Samples from Beta(45, 10) for cleanup-docs → ~0.82
// - Samples from Beta(3, 8) for git-revision → ~0.30

// Ranked results:
[
  { id: "cleanup-docs", successRate: 0.82, sample: 0.82 },
  { id: "jiggle-documentation", successRate: 1.0, sample: 0.75 },
  { id: "git-revision", successRate: 0.27, sample: 0.30 }
]

// Note: cleanup-docs ranked higher despite lower success rate
// because it has more executions (higher confidence: 45+10=55 vs 2)
```

---

## Learning System Details

### Bayesian Success Rate Update

**Formula**:
```
successCount = old_successRate * old_executions + (current_success ? 1 : 0)
new_successRate = successCount / new_executions
```

**Example Evolution**:
```
Initial:   executions=0,  successRate=0.5  (uniform prior)
After E1:  executions=1,  successRate=1.0  (1 success, 0 failures)
After E2:  executions=2,  successRate=1.0  (2 success, 0 failures)
After E3:  executions=3,  successRate=0.67 (2 success, 1 failure)
After E4:  executions=4,  successRate=0.75 (3 success, 1 failure)
After E10: executions=10, successRate=0.80 (8 success, 2 failures)
```

### Thompson Sampling Selection

**For each search query**:
1. Fetch all matching templates
2. For each template, sample from Beta(alpha, beta)
3. Sort by sampled value
4. Apply exploration parameter (10% random)
5. Return top N

**Effect**:
- High success templates sampled higher on average
- But randomness ensures all templates tried occasionally
- Over many queries, best templates emerge naturally
- Handles exploration/exploitation trade-off automatically

### Confidence via Execution Count

```
Template A: 90% success rate, 5 executions   → Low confidence
Template B: 80% success rate, 50 executions  → High confidence

Thompson Sampling:
- Beta(45, 10) for B has narrower distribution
- Beta(5, 1) for A has wider distribution
- B selected more often despite lower success rate
- Over time, A needs more executions to prove itself
```

---

## Evolution and Optimization

### Automated Template Evolution

**Trigger**: After 20+ executions with <80% success rate

**Process**:
```python
# Weekly job
for template in templates_with_enough_data:
    if template.successRate < 0.80:
        # Aggregate failure patterns
        failures = get_executions(template.id, success=False)
        patterns = analyze_failure_patterns(failures)
        
        # Generate optimizations
        if len(patterns) > 0:
            optimizations = generate_optimizations(patterns)
            
            # Create evolved variant
            await create_variant({
                "parent_id": template.id,
                "changes": optimizations.changes,
                "evolution_note": optimizations.rationale,
                "evolution_type": "optimized"
            })
```

**Example Optimization**:
```
Template: create-activity-template
Success Rate: 67% (20 executions)

Failure Analysis:
  - 40% failed at write-template-json (schema errors)
  - 30% failed validation (task count >7)
  - 20% failed registration (timeout)
  - 10% other

Optimizations Generated:
  1. Add schema validation to write-template-json task
  2. Enforce task count <= 5 (stricter than 7)
  3. Increase registration timeout to 60s

Expected Impact: +20% success rate

Create Evolved Variant:
  variant_id: create-activity-template:sha256_evolved_v4
  parent_hash: sha256_v3
  evolution_type: optimized
```

### Variant Competition (Thompson Sampling)

```
Variant v3: alpha=14, beta=7  (67% success, 21 executions)
Variant v4: alpha=2,  beta=1  (50% prior, 0 executions)

Week 1:
  - Thompson samples v3 → 0.68, v4 → 0.62
  - v3 selected 8 times, v4 selected 2 times (exploration)
  - v4 results: 2 successes, 0 failures
  - v4 updated: alpha=4, beta=1 (80% success)

Week 2:
  - Thompson samples v3 → 0.65, v4 → 0.78
  - v3 selected 4 times, v4 selected 6 times
  - v4 results: 5 successes, 1 failure
  - v4 updated: alpha=9, beta=2 (82% success)

Week 4:
  - v4 has 20 executions: 16 successes, 4 failures (80%)
  - v3 has 30 executions: 20 successes, 10 failures (67%)
  - Thompson consistently ranks v4 higher
  - v4 becomes dominant variant

Week 8:
  - v4 proven superior (80% vs 67%)
  - v3 marked as deprecated
  - v4 becomes base for future evolution
```

---

## How to Ensure Success

### For create-activity-template Specifically

**Current Success Factors**:
1. ✅ Two-task structure with explicit verification
2. ✅ Temporary working directory (prevents pollution)
3. ✅ Quality gates for JSON validation
4. ✅ Learning section documents patterns

**Improvements to Implement**:
1. ✅ Split into 4 tasks (analyze, design, write, register)
2. ✅ Enhanced validation (schema, task count, dependencies)
3. ✅ Better examples (high success rate, same category)
4. ✅ Detailed learning metrics (per-task quality indicators)

**Expected Impact**:
```
Current:  65% success rate (estimated)
+ Split:  +15% (guided process)
+ Valid:  +10% (catches errors early)
+ Examp:  +5%  (better patterns)
Total:    95% success rate target
```

### For All Templates

**Design Principles**:
1. **Atomic tasks** - One clear responsibility per task
2. **Comprehensive validation** - Catch errors early
3. **Appropriate budgets** - Realistic token allocations
4. **Good examples** - Context helps agents understand
5. **Clear prompts** - Explicit instructions and success criteria

**Measurement**:
- Track success rate over 20+ executions
- Analyze failure patterns systematically
- Evolve based on data, not hunches
- Use Thompson Sampling for variant selection

**Optimization Loop**:
```
Execute 20+ times
  ↓
Analyze failures
  ↓
Generate optimizations
  ↓
Create evolved variant
  ↓
A/B test with Thompson Sampling
  ↓
Best variant becomes dominant
  ↓
Repeat with new base
```

---

## Summary

### How Registration Works

1. **Agent writes JSON** via create-activity-template activity
2. **Task 2 registers** using register_activity_template tool
3. **TemplateLoader.save()** sends to backend via TemplateServiceClient
4. **MetabobAPI** POSTs to /activity-recommendations/variants
5. **SurrealDB stores** template with initial metrics
6. **Task 2 verifies** using search_activities
7. **Template discoverable** by all agents immediately

**Key**: Backend (SurrealDB) is single source of truth. Registration verified before activity completes.

### How Templates Succeed More Often

1. **Bayesian Learning**: Success rate converges to true probability with more executions
2. **Thompson Sampling**: Better templates selected more often (but all tried occasionally)
3. **Automated Evolution**: Failure patterns analyzed, optimizations generated, variants created
4. **Variant Competition**: Multiple approaches compete, best emerges naturally

**For create-activity-template Specifically**:
- **Current**: 2 tasks, basic validation, ~65% success
- **Improved**: 4 tasks, enhanced validation, ~80-95% success
- **Timeline**: 2 weeks to implement, 3 months to validate with data

### Core Insight

**The system is already designed to learn and improve automatically.**

What's needed:
1. Feed it more execution data (run activities)
2. Implement improved validation (catch errors early)
3. Let Thompson Sampling compete variants
4. Trust the learning loop

**Agent's job**: Search → Execute → Provide variables  
**Framework's job**: Track → Learn → Optimize  
**Metabob's job**: Observe → Identify patterns → Improve recommendations
