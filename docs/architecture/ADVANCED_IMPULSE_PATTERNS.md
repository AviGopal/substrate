# Advanced Impulse Patterns: Resolvers, External Validation, and Intent Proxies

This document addresses three advanced architectural patterns in the impulse-driven system:

1. How resolvers use impulses as inputs (resolver composition)
2. How the system aligns when expected outputs are invalid for external reasons
3. How the system proactively discovers impulses to create intent proxies

---

## 1. Do Resolvers Use Impulses as Inputs?

**Answer: Yes. Resolvers are fully impulse-aware and compose through shape-based indirect coupling.**

### 1.1 Resolver Input Pattern

Resolvers don't work with raw pointers - they work with **fully-loaded impulse objects**:

```typescript
// Resolver interface
interface Resolver {
  name: string
  enabled: boolean

  resolve(
    impulseRefs: ImpulseRef[],      // Impulse references with budgets
    config: ResolverConfig
  ): Promise<Impulse[]>              // Returns NEW impulses
}

// ImpulseRef structure
interface ImpulseRef {
  id: string                         // Impulse identifier
  ref: string                        // Reference (same as id)
  priority: 'required' | 'optional'
  budget: number                     // Token limit
}
```

**Implementation**: `repos/minibob/src/activity.ts:1571-1621`

```typescript
private async executeWithResolver(
  task: ActivityTask,
  impulses: Impulse[],        // Pre-loaded impulse objects
  variables: Record<string, unknown>
): Promise<TaskResult> {
  // Prepare impulse references
  const impulseRefs: ImpulseRef[] = (task.inputImpulses || []).map(id => ({
    id,
    ref: id,
    priority: 'required',
    budget: 50000
  }))

  // Call resolver with impulse objects
  const outputImpulses = await resolver.resolve(impulseRefs, task.config || {})

  // Create output impulses (resolver outputs become new impulses)
  for (const outImpulse of outputImpulses) {
    createImpulse({
      id: outImpulse.id,
      pointer: outImpulse.pointer,
      budget: outImpulse.budget || 10000,
      priority: 'medium',
      metadata: {
        shape: outImpulse.metadata?.shape,
        producedBy: resolver.name
      }
    })
  }
}
```

### 1.2 Resolver Composition Pattern

Resolvers compose **indirectly** through the ImpulseStore using **shape metadata**:

```
┌─────────────────────────────────────────────────────────────┐
│  RESOLVER COMPOSITION: Indirect Shape-Based Coupling        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Resolver A                                                  │
│  ├─ Input: [file_path, config_params]                       │
│  ├─ Process: Validate configuration                         │
│  └─ Output: Impulse {shape: "validation_result"}            │
│                  ↓                                           │
│           (stored in ImpulseStore)                           │
│                  ↓                                           │
│  Resolver B                                                  │
│  ├─ Input: Find impulse where shape="validation_result"     │
│  ├─ Process: Deploy based on validation                     │
│  └─ Output: Impulse {shape: "deployment_status"}            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why indirect coupling?**
- Resolvers don't need to know about each other
- Enables parallelism (multiple resolvers can run independently)
- Supports introspection (can query available impulses before resolution)
- Enables fallback chains (if resolver fails, try next resolver for same shape)

### 1.3 Shape-Based Resolver Routing

Resolvers find their inputs by **searching for specific shapes**:

**Example**: `repos/minibob/src/resolvers/file-resolver.ts`

```typescript
async resolve(impulseRefs: ImpulseRef[], config: FileResolverConfig): Promise<Impulse[]> {
  // Load impulses
  const loaded = await loadImpulses(impulseRefs.map(r => r.ref))

  // Find inputs by SHAPE (not by ID!)
  switch (config.operation) {
    case 'write': {
      const path = loaded.find(i => i.metadata?.shape === 'file_path')?.content
      const content = loaded.find(i => i.metadata?.shape === 'content')?.content

      if (!path) throw new Error('write requires file_path impulse')
      if (!content) throw new Error('write requires content impulse')

      // Execute
      const result = await handlers.write({ path, content })

      // Return output impulse with NEW shape
      return [{
        id: `file-write-${Date.now()}`,
        pointer: { type: 'memo', content: result.output },
        metadata: {
          shape: 'write_result',          // Output shape for downstream
          filesModified: [path],
          producedBy: 'FileResolver'
        }
      }]
    }
  }
}
```

**The contract**: Shapes act as type signatures. If a previous resolver produced `{shape: "file_path"}` and `{shape: "content"}`, the write operation succeeds. Otherwise, it fails or falls back to LLM.

### 1.4 Lazy Evaluation Chains

When a resolver needs an impulse, it triggers cascading resolution:

```typescript
// From impulse.ts:100-169
async load(id: string): Promise<Impulse> {
  const impulse = this.impulses.get(id)

  // Already loaded?
  if (impulse.loaded && impulse.content) {
    return impulse
  }

  // Resolve pointer (may trigger more loads!)
  const result = await this.resolvePointer(impulse.pointer)

  // Resolution dispatch order:
  // 1. Local types (memo, file, directoryTree, gitDiff)
  // 2. Custom resolvers (workspace-registered)
  // 3. Vessel discovery (network-wide capability query)
  // 4. Backend MCP (metabob-activity-api)
  // 5. Fallback (in-memory cache)

  // Truncate to budget if needed
  let finalContent = content
  if (tokenCount > impulse.budget) {
    finalContent = content.substring(0, targetChars) + "\n... (truncated)"
  }

  return { ...impulse, loaded: true, content: finalContent }
}
```

**Cascading example**:
```
Activity needs impulse "deployment_config"
  → Resolves to pointer {type: "file", path: "k8s/config.yaml"}
    → File resolver needs to validate YAML
      → Creates impulse {shape: "yaml_validation"}
        → Validation resolver loads YAML schema
          → Creates impulse {shape: "schema_definition"}
            → (resolved recursively...)
```

### 1.5 Key Architectural Pattern

**Resolvers are impulse-aware, shape-driven, and indirectly coupled.**

| Aspect | Traditional Pipeline | Impulse-Based Composition |
|--------|---------------------|---------------------------|
| **Input** | Direct function parameters | ImpulseRef[] with shapes |
| **Coupling** | Direct function calls | Indirect via ImpulseStore |
| **Discovery** | Hardcoded dependencies | Shape-based runtime lookup |
| **Composition** | A → B → C pipeline | A creates shapes, B finds shapes, C uses shapes |
| **Failure** | Pipeline breaks | Graceful degradation (fallback to LLM) |
| **Learning** | Static configuration | Thompson Sampling learns optimal shape pairings |

**Implementation files**:
- `repos/minibob/src/impulse.ts:257-530` - Multi-layer resolution
- `repos/minibob/src/resolvers/base.ts` - Resolver interface
- `repos/minibob/src/resolvers/file-resolver.ts` - Shape-based routing example
- `repos/minibob/src/activity.ts:620-646` - Activity composition with impulse flow

---

## 2. Aligning When Expected Outputs Are Invalid for External Reasons

**Problem**: Activity produces correct outputs locally but fails when deployed due to integration issues, service incompatibility, or environmental differences.

**Solution**: Multi-layer validation with delayed failure detection and Thompson Sampling feedback.

### 2.1 Validation Layers

The system has **four validation layers** with different scopes:

```
┌──────────────────────────────────────────────────────────────┐
│  VALIDATION LAYER HIERARCHY                                  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  LAYER 1: Local Validation (MiniBob)                         │
│  ├─ typescript_compiles: Code compiles                       │
│  ├─ tests_pass: Unit tests pass                              │
│  ├─ lint_passes: Linting passes                              │
│  └─ json_valid/yaml_valid: Schema validation                 │
│  Scope: Developer machine                                    │
│  Latency: Instant to seconds                                 │
│                                                               │
│  LAYER 2: Integration Validation (CI/CD)                     │
│  ├─ Helm template validation                                 │
│  ├─ Docker image availability                                │
│  ├─ Dependency readiness checks                              │
│  └─ API endpoint tests                                       │
│  Scope: CI/CD pipeline                                       │
│  Latency: Minutes                                            │
│                                                               │
│  LAYER 3: Deployment Validation (Canary)                     │
│  ├─ Health endpoint verification                             │
│  ├─ Template response structure checks                       │
│  ├─ Pod readiness (kubectl wait)                             │
│  └─ RecordId normalization tests                             │
│  Scope: Canary environment                                   │
│  Latency: Minutes to hours                                   │
│                                                               │
│  LAYER 4: Production Validation (Monitoring)                 │
│  ├─ Health checks on running services                        │
│  ├─ Error rate monitoring                                    │
│  ├─ WebSocket event verification                             │
│  └─ Manual feedback (/warn, /teach commands)                 │
│  Scope: Production traffic                                   │
│  Latency: Hours to days                                      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Delayed Failure Detection

When external validation fails after local success, the system uses **validation failure reporting**:

**Implementation**: `repos/minibob/src/search-first-executor.ts:1115-1161`

```typescript
private async reportValidationFailure(
  templateId: string,
  step: GoalStep,
  reason?: string
): Promise<void> {
  // Activity reported "completed" but validation failed externally
  // Create a mock execution marking it as failed
  const mockExecution: ExecutionReport = {
    id: `validation_failure_${Date.now()}`,
    templateId,
    status: "failed",
    error: `Validation failed: ${reason ?? "unknown"}`,
    taskResults: [{
      taskId: step.id,
      status: "failed",
      error: `External validation failed: ${reason}`,
      metadata: {
        validationType: 'external',
        layer: 'deployment',  // or 'integration', 'production'
      }
    }],
  }

  // Report to backend - Thompson Sampling increments beta
  await mcp.reportExecution(mockExecution)

  // System learns: "This template works locally but not in deployment"
}
```

### 2.3 External Validation Examples

#### Example 1: Code Compiles Locally, Fails CI/CD

**Scenario**: Activity generates TypeScript code that compiles on developer machine but fails in CI because of different TypeScript version.

**Detection**:
```typescript
// Local validation passes
const localResult = await validateShape("source_code", "src/auth.ts")
// { valid: true, validators: ["typescript_compiles"] }

// But CI/CD fails
// deploy-canary.yml line 150:
// npm run typecheck → Exit code 1
// Error: Type 'RecordId' is not assignable to type 'string'

// Deployment script catches this:
if ! kubectl wait --for=condition=available deployment/metabob-activity-api; then
  echo "Deployment failed validation"
  exit 1
fi
```

**Feedback to learning**:
```typescript
// CI/CD workflow triggers webhook:
POST /v2/activities/external-validation-failure
{
  execution_id: "exec_123",
  template_id: "generate-typescript-code",
  failure_type: "deployment_validation",
  failure_reason: "TypeScript compilation failed in CI",
  layer: "integration",
  environment: "ci-pipeline"
}

// Backend updates Thompson Sampling:
UPDATE variant_performance_metrics
SET
  failed_executions += 1,
  thompson_beta += 1,
  external_failures += 1,
  last_failure_type = 'deployment_validation'
WHERE variant_id = 'generate-typescript-code';

// Result: Template score decreases for future recommendations
```

#### Example 2: Health Check Fails After Deployment

**Scenario**: Activity generates Kubernetes manifests that deploy successfully but health checks fail because service isn't actually ready.

**Detection** (`repos/deployment/.github/workflows/deploy-canary.yml:488-553`):

```bash
# Deploy succeeds
kubectl apply -f manifests/

# Pod starts
kubectl wait --for=condition=available deployment/my-service

# But health check fails
curl -sf http://localhost:8080/health || {
  echo "Health endpoint failed"
  # Automatic rollback
  kubectl rollout undo deployment/my-service
  # Report failure to learning system
  curl -X POST https://activity.metabob.com/v2/activities/external-validation-failure \
    -d '{"template_id": "generate-k8s-manifests", "failure_type": "health_check"}'
  exit 1
}
```

**Feedback loop**:
- Template score decreases
- Variant created with additional health check validation
- Future executions try the improved variant

#### Example 3: API Response Format Changed

**Scenario**: Activity generates API client code that works with local mock but fails against production API due to schema mismatch.

**Detection**:
```bash
# Integration test in CI/CD
# Validates response structure
RECS=$(curl -X POST http://localhost:8080/v2/activities/recommend \
  -d '{"task_description":"test"}')

# Check template_id type (catches RecordId normalization bug)
FIRST_ID_TYPE=$(echo "$RECS" | jq -r '.recommendations[0].template_id | type')
if [ "$FIRST_ID_TYPE" != "string" ]; then
  echo "API response format invalid: template_id is object, not string"
  exit 1
fi
```

**Real bug caught** (from deploy-canary.yml:529-537):
```yaml
# This check caught actual production bug:
# Backend returned RecordId objects instead of strings
# Would have broken all clients using template_id
# Caught in canary deployment before production rollout
```

### 2.4 Thompson Sampling Learns from External Failures

**Implementation**: `repos/metabob-activity-api/src/routes/activities.ts:1600-1615`

```sql
-- When external validation fails, failure is recorded with context
INSERT INTO activity_execution_traces {
  execution_id,
  variant_id,
  success: false,
  failure_type: 'external_validation',  -- Not 'execution' or 'timeout'
  failure_layer: 'deployment',           -- Which layer failed
  error_message: 'Health check failed',
  metadata: {
    local_validation_passed: true,       -- Passed locally!
    external_validation_passed: false,   -- Failed externally
    environment: 'canary'
  }
}

-- Update Thompson metrics with external failure tracking
UPDATE variant_performance_metrics
SET
  total_executions += 1,
  failed_executions += 1,
  external_failures += 1,              -- Track external vs local failures
  thompson_beta += 1,
  success_rate = successful_executions / total_executions,
  external_failure_rate = external_failures / total_executions
WHERE variant_id = $variant_id;
```

**Result**: Templates with high `external_failure_rate` get penalized in recommendations even if `success_rate` looks good from local validation.

### 2.5 Alignment Mechanisms

When environments diverge, the system adjusts through:

#### A. Variant Creation

When external validation fails, the ribosome creates a **variant with additional validation**:

```typescript
// Original template
{
  id: "generate-api-client",
  tasks: [
    { id: "generate", validation: { requiredFiles: ["client.ts"] } },
    { id: "test", validation: { commands: [{ command: "npm test" }] } }
  ]
}

// After external validation failure, create variant:
{
  id: "generate-api-client-v2",
  basedOn: "generate-api-client",
  tasks: [
    { id: "generate", validation: { requiredFiles: ["client.ts"] } },
    { id: "test", validation: { commands: [{ command: "npm test" }] } },
    {
      id: "integration-test",
      description: "Test against actual API endpoint",
      validation: {
        commands: [{
          command: "npm run test:integration",
          expectedOutput: "All integration tests passed"
        }]
      }
    }
  ],
  metadata: {
    createdFrom: "external_validation_failure",
    improvesOn: "Missing integration validation"
  }
}
```

#### B. Environment-Specific Validation Rules

Templates can declare validation rules that only run in specific environments:

```typescript
{
  id: "deploy-to-k8s",
  tasks: [{
    id: "deploy",
    validation: {
      // Local validation
      requiredFiles: ["deployment.yaml"],

      // CI/CD validation (only runs in CI)
      commands: [
        {
          command: "helm template . | kubectl apply --dry-run=client -f -",
          environment: "ci",
          expectedOutput: "created (dry run)"
        }
      ],

      // Canary validation (only runs in canary)
      externalChecks: [
        {
          type: "health_endpoint",
          url: "https://canary.metabob.com/health",
          environment: "canary",
          expectedStatus: 200
        }
      ]
    }
  }]
}
```

#### C. Manual Feedback Correction

Users can manually correct Thompson Sampling when they observe external failures:

```bash
# Activity worked locally but failed in production
# User provides feedback:
/warn generate-api-client "Works locally but fails against production API"

# System adjusts:
# - thompson_beta += 5 (penalty)
# - Adds tag "production_incompatible"
# - Future recommendations downweight this template

# User promotes better approach:
/teach generate-api-client-validated "This version includes integration tests"

# System adjusts:
# - thompson_alpha += 3 (boost)
# - Adds tag "production_validated"
# - Future recommendations prefer this variant
```

### 2.6 Key Insight: External Validation as Learning Signal

The system treats external validation failures as **high-quality learning signals**:

```
Local validation failure → template has bugs (obvious)
External validation failure → template has environmental assumptions (subtle!)

External failures are MORE valuable because they reveal:
- Incorrect assumptions about environment
- Missing integration testing
- Schema mismatches with production systems
- Configuration incompatibilities
- Timing/race conditions
- Network/service dependencies
```

**Thompson Sampling learns**:
- Which templates work end-to-end, not just locally
- Which validation rules prevent external failures
- Which shape combinations are fragile across environments
- Which variants are production-ready vs development-only

**Implementation files**:
- `repos/minibob/src/validators/early-exit.ts` - Local validation
- `repos/minibob/src/search-first-executor.ts:1115-1161` - Validation failure reporting
- `repos/deployment/.github/workflows/deploy-canary.yml:488-553` - External validation
- `repos/metabob-activity-api/src/routes/activities.ts:1600-1615` - Thompson Sampling updates

---

## 3. Proactive Impulse Discovery and Intent Proxies

**Question**: How does the system discover what impulses COULD be loaded? How do available shapes create "intent proxies" at transitions?

**Answer**: Through multi-layer discovery, relevance prediction, and shape-based intent inference.

### 3.1 Impulse State Space Discovery

The system discovers available impulses through **layered resolution**:

```typescript
// From impulse.ts:257-530
// Resolution dispatch order (in priority):

// TIER 1: LOCAL TYPES (instant)
memo: { content: "embedded data" }
file: { path: "src/auth.ts" }
directoryTree: { path: "/workspace" }
gitDiff: { ref: "HEAD~1..HEAD" }
toolList: { category: "bash" }
packageConfig: { path: "package.json" }

// TIER 2: CUSTOM RESOLVERS (workspace-specific)
// Registered by applications:
registerResolver('slack_message', async (pointer) => {
  // Resolve Slack messages
})

// TIER 3: VESSEL DISCOVERY (network-wide)
// Query: "Who can resolve shape X?"
GET /v2/vessels/discover?shape=execution_trace
// Returns: { vessels: [{ vesselId: "metabob-activity-api", endpoint: "..." }] }

// TIER 4: BACKEND MCP (centralized learning)
activityExecutionTrace: { executionId: "exec_123" }
activityTemplate: { templateId: "fix-bug-v2" }
activityMetrics: { activityId: "fix-bug" }

// TIER 5: FALLBACK (in-memory cache)
activityOutput: { activityId: "previous-task", taskId: "task-1" }
```

**Key insight**: The system doesn't have a single "available impulses" list. Instead, it discovers impulses **on-demand** through these layers.

### 3.2 Dynamic Capability Discovery (Vessel Network)

The system can **discover what impulses exist** without loading them:

**Implementation**: `repos/minibob/src/vessel-discovery.ts`

```typescript
interface VesselCapability {
  vesselId: string
  vesselName: string
  endpoint?: string
  shapes: string[]           // What this vessel can resolve
  operations?: string[]      // What operations it supports
  metadata?: {
    description: string
    examples: string[]
  }
}

// Discovery flow:
async function discoverAvailableShapes(): Promise<string[]> {
  // 1. Query all vessels for their capabilities
  const vessels = await fetchVessels()

  // 2. Collect all shapes they can resolve
  const allShapes = vessels.flatMap(v => v.shapes)

  // 3. Add local shapes
  allShapes.push('memo', 'file', 'directoryTree', 'gitDiff')

  // 4. Return unique shapes
  return [...new Set(allShapes)]
}

// Example result:
[
  'memo', 'file', 'directoryTree', 'gitDiff',
  'activityExecutionTrace', 'activityTemplate', 'activityMetrics',
  'slack_message', 'github_issue', 'jira_ticket',
  'error_log', 'test_result', 'deployment_status'
]
```

**This enables**:
- "What impulses could I load?" query
- "What vessels can help with this shape?" routing
- Dynamic plugin architecture (new vessels add new shapes)

### 3.3 Relevance Prediction: Which Impulses Matter?

The system predicts which unloaded impulses would be **most valuable**:

**Implementation**: `repos/metabob-activity-api/src/utils/impulse-relevancy.ts:180-257`

```typescript
async function discoverMissingImpulses(
  activityIds: string[],        // Candidate activities to execute
  loadedImpulses: string[],     // Currently loaded impulses
  limit: number = 5
): Promise<MissingImpulseSuggestion[]> {

  // Query: Find impulses that are CRITICAL for these activities
  //        but NOT currently loaded

  const query = `
    SELECT
      impulse_id,
      COUNT(activity_variant_id) AS activities_unlocked,
      AVG(relevance_score - irrelevance_score) AS avg_boost
    FROM impulse_relevance_metrics
    WHERE
      activity_variant_id IN $activityIds
      AND (relevance_score - irrelevance_score) > 0.3  -- CRITICAL threshold
      AND impulse_id NOT IN $loadedImpulses            -- NOT loaded
    GROUP BY impulse_id
    ORDER BY (avg_boost * activities_unlocked) DESC
    LIMIT $limit
  `

  const results = await db.query(query, { activityIds, loadedImpulses, limit })

  return results.map(r => ({
    impulse_id: r.impulse_id,
    reason: `Critical for ${r.activities_unlocked} activities (${(r.avg_boost * 100).toFixed(1)}% boost)`,
    unlocks_activities: activityIds.filter(a => /* has this impulse as critical */),
    avg_relevance_boost: r.avg_boost
  }))
}
```

**Example output**:
```typescript
[
  {
    impulse_id: "execution_trace",
    reason: "Critical for 7 activities (avg boost: 78.3%, 45 past successes)",
    unlocks_activities: ["fix-bug-advanced", "debug-with-trace", "regression-analyzer"],
    avg_relevance_boost: 0.783
  },
  {
    impulse_id: "git_blame",
    reason: "Critical for 4 activities (avg boost: 67.2%, 23 past successes)",
    unlocks_activities: ["identify-regression-commit", "contributor-context"],
    avg_relevance_boost: 0.672
  }
]
```

**MiniBob displays**:
```
💡 Load execution_trace to unlock advanced debugging (+78% success rate)
💡 Load git_blame for better regression analysis (+67% success rate)
```

### 3.4 Shape Signature as Intent Proxy

The **set of available impulse shapes** acts as an implicit representation of user intent:

```typescript
// User says: "Fix the failing authentication tests"

// Memory Agent analyzes intent:
const intent = await SessionMemoryAgent.analyzeIntent({
  promptText: "Fix the failing authentication tests",
  workingDirectory: "/workspace"
})

// Creates suggested impulses:
[
  { id: "test_output", shape: "test_suite", path: "test-results.log" },
  { id: "auth_code", shape: "source_code", path: "src/auth.ts" },
  { id: "test_file", shape: "test_suite", path: "src/auth.test.ts" }
]

// Load these impulses
await loadImpulses(["test_output", "auth_code", "test_file"])

// Now available shape signature is:
shapeSignature = ["test_suite", "source_code"]

// This signature PROXIES the intent:
// "User has test failures + source code = debugging scenario"
```

**Intent inference from shapes**:

| Shape Signature | Inferred Intent | Recommended Activities |
|----------------|-----------------|------------------------|
| `[error, source_code]` | "Debugging runtime error" | fix-error, analyze-error, debug-crash |
| `[test_suite, source_code]` | "Fixing failing tests" | fix-test, debug-test, test-driven-fix |
| `[documentation, source_code]` | "Understanding code" | explain-code, generate-docs, analyze-architecture |
| `[sql_schema, migration]` | "Database migration" | create-migration, rollback-migration, validate-schema |
| `[config_file, deployment]` | "Deployment configuration" | deploy-to-env, validate-config, test-deployment |

### 3.5 Proactive Loading Suggestions

Before executing an activity, the system suggests missing impulses:

**Flow**:
```typescript
// 1. User provides goal
goal = "Fix the authentication bug"

// 2. System analyzes intent, suggests initial impulses
suggestedImpulses = [
  { shape: "error", description: "Error logs showing auth failure" },
  { shape: "source_code", description: "Authentication module code" }
]

// 3. User loads these
loadedImpulses = ["error_log", "auth_module"]
shapeSignature = ["error", "source_code"]

// 4. System gets activity recommendations
recommendations = await recommendActivities({
  task_description: "Fix authentication bug",
  impulse_shapes: ["error", "source_code"],
  limit: 5
})

// Top 3:
// 1. "fix-auth-with-error" (86% success)
// 2. "debug-auth-flow" (81% success)
// 3. "analyze-auth-error" (77% success)

// 5. BEFORE executing, discover missing impulses
missingImpulses = await discoverMissingImpulses(
  ["fix-auth-with-error", "debug-auth-flow", "analyze-auth-error"],
  ["error_log", "auth_module"],
  limit: 3
)

// Returns:
[
  {
    impulse_id: "execution_trace",
    reason: "Critical for debug-auth-flow (92% boost, 15 past successes)",
    unlocks_activities: ["debug-auth-flow", "advanced-auth-debugger"],
    avg_relevance_boost: 0.92
  },
  {
    impulse_id: "test_results",
    reason: "Helpful for fix-auth-with-error (54% boost)",
    unlocks_activities: ["fix-auth-with-error"],
    avg_relevance_boost: 0.54
  }
]

// 6. Display to user:
"🔓 Load execution_trace to unlock better debugging (+92% success)"
"💡 Load test_results for additional context (+54% success)"

// 7. User loads execution_trace
loadImpulses(["execution_trace"])

// 8. Re-recommend activities (now with better shape signature)
recommendations = await recommendActivities({
  impulse_shapes: ["error", "source_code", "execution_trace"],
  limit: 5
})

// Now "debug-auth-flow" ranks #1 (was #2)
// Because it works BEST with ["error", "source_code", "execution_trace"] combination
```

### 3.6 Shape Inference from Workspace

The system can **infer available shapes** without explicit user input:

**Implementation**: `repos/minibob/src/understanding/explorer.ts`

```typescript
class CodeExplorer {
  async explore(rootPath: string): Promise<CodeStructure> {
    // 1. Scan filesystem
    const files = await listAllFiles(rootPath)

    // 2. Infer shapes from file patterns
    const shapes = new Set<string>()

    for (const file of files) {
      if (file.endsWith('.test.ts')) shapes.add('test_suite')
      if (file.endsWith('.ts') && !file.includes('.test.')) shapes.add('source_code')
      if (file.endsWith('.md')) shapes.add('documentation')
      if (file.endsWith('.json') && file.includes('package')) shapes.add('package_config')
      if (file.endsWith('.sql') || file.endsWith('.surql')) shapes.add('sql_schema')
      if (file.includes('error') || file.includes('log')) shapes.add('error_log')
    }

    // 3. Infer shapes from git status
    const gitStatus = await exec('git status --porcelain')
    if (gitStatus.includes('M ')) shapes.add('uncommitted_changes')
    if (gitStatus.includes('?? ')) shapes.add('untracked_files')

    // 4. Infer shapes from package.json
    const packageJson = await readPackageJson(rootPath)
    if (packageJson.scripts?.test) shapes.add('test_suite')
    if (packageJson.dependencies?.react) shapes.add('react_component')

    return {
      totalFiles: files.length,
      availableShapes: Array.from(shapes),
      // ... more metadata
    }
  }
}
```

**Result**: System knows "This workspace has source_code, test_suite, and error_log shapes available" **without user telling it**.

### 3.7 Intent Proxies at Activity Transitions

At each activity transition, the shape signature evolves:

```
STATE 0: Initial (empty workspace)
shapes: []
intent_proxy: "Exploration"
suggested_activities: ["explore-codebase", "initialize-project"]

    ↓ User: "Understand the codebase"
    ↓ System loads: [source_code, package_config]

STATE 1: After exploration
shapes: [source_code, package_config]
intent_proxy: "Code understanding"
suggested_activities: ["explain-architecture", "document-code", "analyze-dependencies"]

    ↓ User: "Tests are failing"
    ↓ System loads: [test_suite, error_log]

STATE 2: After test failure
shapes: [source_code, package_config, test_suite, error_log]
intent_proxy: "Debugging test failure"
suggested_activities: ["fix-failing-test", "debug-test-error", "analyze-test-logs"]

    ↓ Activity executes, produces: [patch, test_result]
    ↓ System loads: [patch, test_result]

STATE 3: After fix
shapes: [source_code, package_config, test_suite, error_log, patch, test_result]
intent_proxy: "Verifying fix"
suggested_activities: ["commit-changes", "create-pr", "document-fix"]
```

**The shape signature evolves with the workflow**, creating an implicit intent representation that guides activity selection at each transition.

### 3.8 Memory Agent: Continuous Intent Refinement

The SessionMemoryAgent continuously refines intent based on:

**Implementation**: `repos/minibob/src/memory-agent.ts`

```typescript
class SessionMemoryAgent {
  async analyzeIntent(input: {
    promptText: string
    workingDirectory?: string
    previousIntents?: Intent[]
  }): Promise<Intent> {

    // LLM prompt includes:
    // 1. Current shape signature
    // 2. Previous intents in this session
    // 3. Workspace structure (from CodeExplorer)
    // 4. Recent activity executions

    const systemPrompt = `
    Available impulse shapes in workspace: ${availableShapes.join(', ')}
    Recent activities: ${recentActivities.map(a => a.name).join(', ')}

    Based on user input "${promptText}" and available data,
    predict what impulses would be most helpful.

    For code_fix intent:
    - error file: CRITICAL (error message, stack trace)
    - related tests: HIGH (test failures demonstrating issue)
    - similar features: MEDIUM (code patterns that work)

    For feature_request intent:
    - files to modify: CRITICAL
    - similar features: HIGH
    - architecture: MEDIUM
    `

    return {
      type: "code_fix" | "feature_request" | "exploration" | "deployment",
      confidence: 0.0-1.0,
      suggestedImpulses: [
        { id, type, description, priority, budget, pointer }
      ],
      reasoning: "Why these impulses are suggested"
    }
  }
}
```

**Example**:
```typescript
// User: "Fix the TypeError in calculator.ts"

const intent = await SessionMemoryAgent.analyzeIntent({
  promptText: "Fix the TypeError in calculator.ts",
  workingDirectory: "/workspace"
})

// Returns:
{
  type: "code_fix",
  confidence: 0.95,
  suggestedImpulses: [
    {
      id: "errorFile",
      type: "file",
      description: "File containing the error",
      priority: "critical",
      budget: 2000,
      pointer: { type: "file", path: "calculator.ts" }
    },
    {
      id: "testResults",
      type: "file",
      description: "Test output showing failure",
      priority: "high",
      budget: 1500,
      pointer: { type: "file", path: "test-results.log" }
    },
    {
      id: "similarCode",
      type: "glob",
      description: "Similar calculator implementations",
      priority: "medium",
      budget: 3000,
      pointer: { type: "glob", pattern: "src/**/*calculator*.ts" }
    }
  ],
  reasoning: "TypeError suggests type mismatch. Need error location (errorFile), test context (testResults), and working examples (similarCode)."
}
```

---

## Summary: The Three Advanced Patterns

### 1. Resolvers Use Impulses (Shape-Based Composition)

- Resolvers are **fully impulse-aware** (see metadata, shapes, budgets)
- Compose **indirectly** through ImpulseStore using **shape-based routing**
- Find inputs by searching for specific shapes, not IDs
- Create outputs with new shapes for downstream resolvers
- Enable **decoupled, discoverable, learnable** composition

### 2. External Validation Alignment

- **Multi-layer validation**: local → integration → deployment → production
- **Delayed failure detection** catches issues after local success
- **Thompson Sampling learns** which templates work end-to-end
- **Variant creation** adds missing validation rules
- **External failures are high-quality signals** revealing environmental assumptions

### 3. Proactive Impulse Discovery (Intent Proxies)

- **Shape signature = intent proxy**: Available shapes implicitly represent user intent
- **Relevance prediction**: Historical data predicts which missing impulses would help
- **Proactive suggestions**: "Load X to unlock Y (+Z% boost)"
- **Continuous refinement**: Memory agent updates intent as shapes evolve
- **Workspace inference**: System discovers available shapes without user input

Together, these patterns create a **self-improving, context-aware system** that:
- Composes resolvers through shapes (not hardcoded pipelines)
- Learns from external failures (not just local success)
- Proactively discovers missing context (not just waits for user input)
- Creates intent proxies from available data (not explicit intent declarations)

**The key innovation**: Shape-based indirection enables learning, discovery, and composition without tight coupling or explicit configuration.
