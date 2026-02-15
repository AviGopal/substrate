# Cochange Embeddings, Impulses, and Activity Learning Integration Guide

**Date**: 2026-02-14  
**Purpose**: Document how to use metabob-cli and metabob-rpc-api cochange embeddings to create impulses and improve activity learning  
**Status**: Comprehensive integration guide

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Cochange Embeddings Architecture](#cochange-embeddings-architecture)
3. [Using Metabob CLI for Cochange Analysis](#using-metabob-cli-for-cochange-analysis)
4. [Creating Impulses from Cochange Data](#creating-impulses-from-cochange-data)
5. [Activity Learning Integration](#activity-learning-integration)
6. [Complete Workflow Example](#complete-workflow-example)
7. [API Reference](#api-reference)

---

## System Overview

The system has three integrated layers that work together:

```
┌─────────────────────────────────────────────────────────────┐
│                     Activity Execution                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Activity reads impulses with cochange context    │   │
│  │ 2. Activity executes with code awareness            │   │
│  │ 3. Activity records outcome with changed files      │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                  Impulse System (Memory)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • bashOutput: Cochange predictions from CLI         │   │
│  │ • file: Related code files                          │   │
│  │ • memo: Cochange patterns & relationships           │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│        Metabob CLI + CPG Inference (Code Analysis)          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • CPG extraction (tree-sitter)                      │   │
│  │ • GNN embeddings (128-bit SimHash → 32-dim)        │   │
│  │ • FAISS similarity search                           │   │
│  │ • Cochange prediction (predict_cochanges)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

1. **Cochange Embeddings**: Semantic similarity vectors learned from code structure (CPG + GNN)
2. **Impulses**: Context objects that provide relevant information to activities
3. **Activity Learning**: Templates that improve by learning from execution outcomes
4. **Distributed Feedback**: System that records outcomes and evolves templates

---

## Cochange Embeddings Architecture

### What Are Cochange Embeddings?

Cochange embeddings are **semantic vectors** that capture structural similarity between code components. They predict which files should change together based on:

- **Structural patterns**: Code Property Graph (CPG) analysis
- **Dependency relationships**: Import graphs, function calls
- **Historical patterns**: Files that changed together in the past (via git)

### How They Work

```
File Changes → CPG Extraction → Feature Generation → GNN Model → Embeddings → FAISS Search
      ↓              ↓                  ↓                ↓            ↓           ↓
  auth.py    tree-sitter parse   SimHash features   32-dim vector  Index    Related files
```

**Pipeline**:
1. **CPG Extraction**: Parse code with tree-sitter → build dependency graph
2. **Feature Generation**: Extract 128-bit SimHash from graph structure
3. **GNN Model**: Transform features into 32-dimensional embeddings (ONNX inference)
4. **FAISS Index**: Store embeddings for fast similarity search
5. **Cochange Prediction**: Query index with changed file → get similar components

**Performance**:
- Query time: < 200ms (p95 < 300ms)
- Index update: ~60-110ms per file
- Background analysis: Continuous, non-blocking

---

## Using Metabob CLI for Cochange Analysis

### 1. MCP Tool: `suggest_related_changes`

This is the primary interface for cochange analysis.

**Purpose**: After making changes, find related files that should be reviewed or modified.

**Input**:
```typescript
{
  changed_files: string[],  // Files you just modified
  top_k: number              // Max suggestions (default: 5)
}
```

**Output**:
```typescript
{
  suggestions: [
    {
      file_path: "src/auth-utils.ts",
      total_issues: 12,
      high_severity_issues: 2,
      top_issues: [...],  // Top 3 issues for context
      recommendation: "⚠️ High priority - has critical issues"
    }
  ],
  status: "success" | "cpg_unavailable" | "partial_failure"
}
```

**Example Usage**:
```typescript
// After modifying authentication code
const result = await metabob_suggest_related_changes({
  changed_files: ["src/auth/login.ts"],
  top_k: 5
})

// Result suggests checking:
// - src/auth/session.ts (12 issues, 2 HIGH)
// - src/api/users.ts (3 issues, 0 HIGH)
// - src/middleware/auth-check.ts (8 issues, 1 HIGH)
```

### 2. Python API: `predict_cochanges`

Direct access to the CPG inference engine (used by CLI internally).

**Location**: `repos/cpg-inference/cpg_inference/service.py`

**Usage**:
```python
from cpg_inference import CoChangePredictor, InferenceConfig

# Initialize predictor
config = InferenceConfig(
    model_path="models/cpg_gnn.onnx",
    embedding_dim=32,
    top_k=10
)
predictor = CoChangePredictor(config, project_root=".")

# Predict cochanges
files = {
    "auth.py": open("auth.py").read(),
    "utils.py": open("utils.py").read(),
    # ... all project files
}

predictions = predictor.predict_cochanges(
    changed_files=["auth.py"],
    files=files,
    top_k=10
)

for pred in predictions:
    print(f"{pred.file_path} ({pred.component_name}): {pred.similarity_score}")
```

### 3. How It Works Internally

```python
# 1. Extract components from changed files
file_components, file_cpgs = extractor.extract_from_files(changed_files)

# 2. Generate features (128-bit SimHash)
query_features = feature_generator.generate_batch_features(
    file_components, file_cpgs
)

# 3. Generate embeddings (GNN model via ONNX)
query_embeddings = model.infer(query_features)  # 32-dim vectors

# 4. Search FAISS index for similar components
result_ids, result_scores = index_manager.search(
    query_embeddings,
    k=top_k,
    exclude_ids=exclude_ids  # Don't suggest same file
)

# 5. Return predictions with scores
predictions = [
    CoChangePrediction(
        file_path=component.file_path,
        component_name=component.name,
        similarity_score=score
    )
    for component_id, score in sorted_results
]
```

---

## Creating Impulses from Cochange Data

### What Are Impulses?

Impulses are **context objects** that provide relevant information to agents/activities. They are loaded into the agent's prompt as `<session_memory>`.

**Types relevant to cochange**:
- `bashOutput`: CLI command results (including cochange predictions)
- `file`: Code file contents
- `memo`: Text notes about patterns, relationships, decisions

### Impulse Creation Workflow

```typescript
// 1. Run cochange analysis
const cochangeResult = await bash({
  command: `opencode mcp call suggest_related_changes --changed_files='["src/auth.ts"]'`,
  description: "Get cochange predictions for auth.ts"
})

// 2. Create impulse with cochange data
const impulse = {
  type: "bashOutput",
  command: "suggest_related_changes",
  output: cochangeResult.output,
  budget: 1500  // Token budget for this context
}

// 3. Store in session memory
await Session.impulse.create(sessionID, {
  id: "cochange-auth-context",
  pointer: impulse,
  budget: 1500
})
```

### Impulse Synthesis Pattern

**Goal**: Combine cochange data with other analysis for rich context.

```typescript
async function synthesizeCochangeImpulse(
  changedFiles: string[]
): Promise<Impulse> {
  // 1. Get cochange predictions
  const cochanges = await metabob_suggest_related_changes({
    changed_files: changedFiles,
    top_k: 10
  })
  
  // 2. For each related file, get:
  //    - Component annotations (why it exists)
  //    - Priority issues (what's broken)
  //    - Dependencies (what it calls/is called by)
  
  const relatedContext = await Promise.all(
    cochanges.suggestions.map(async (suggestion) => {
      const components = await metabob_list_file_components({
        file_path: suggestion.file_path
      })
      
      const annotations = await metabob_get_component_annotations({
        component_ids: components.map(c => c.id)
      })
      
      return {
        file: suggestion.file_path,
        components: components,
        annotations: annotations,
        issues: suggestion.top_issues,
        recommendation: suggestion.recommendation
      }
    })
  )
  
  // 3. Create synthesized impulse
  return {
    type: "memo",
    content: `
# Cochange Analysis for ${changedFiles.join(", ")}

## Related Files to Review

${relatedContext.map(ctx => `
### ${ctx.file}
**Recommendation**: ${ctx.recommendation}

**Components**:
${ctx.components.map(c => `- ${c.name} (${c.type})`).join("\n")}

**Annotations** (why it exists):
${ctx.annotations.map(a => `- ${a.component}: ${a.reason}`).join("\n")}

**Top Issues**:
${ctx.issues.map(i => `- [${i.severity}] ${i.description}`).join("\n")}
`).join("\n")}

## Recommendation

Based on cochange patterns, you should:
1. Review ${relatedContext.filter(c => c.recommendation.includes("High priority")).length} high-priority files
2. Check for similar bugs/patterns in related files
3. Update tests that cover these related components
    `,
    budget: 2500
  }
}
```

### Using Impulses in Activities

Activities automatically receive impulses loaded into session memory:

```typescript
// In activity template execution
export async function execute(variables: Variables) {
  // Session memory is injected into agent context
  // Agent can see:
  // - <session_memory>
  //   - impulse: cochange-auth-context
  //   - impulse: related-file-annotations
  //   - impulse: priority-issues
  
  // Agent uses this context to make informed decisions
  // about which files to modify, what patterns to follow
}
```

---

## Activity Learning Integration

### Activity Lifecycle with Cochange Data

```
┌──────────────────────────────────────────────────────────────┐
│                    Before Execution                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 1. Load template expectations                         │  │
│  │ 2. Predict cochanges for current file                 │  │
│  │ 3. Create impulses with cochange context              │  │
│  │ 4. Load component annotations                         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                    During Execution                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Agent executes with full context:                     │  │
│  │ - Template instructions                               │  │
│  │ - Cochange predictions in session memory              │  │
│  │ - Component annotations (design decisions)            │  │
│  │ - Priority issues to fix                              │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                    After Execution                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 1. Compare predicted cochanges vs actual              │  │
│  │ 2. Calculate cochange accuracy                        │  │
│  │ 3. Record outcome to backend API                      │  │
│  │ 4. Update template based on learnings                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Recording Cochange Accuracy

**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity-outcome-recorder.ts`

```typescript
interface ActivityExpectation {
  predictedCochanges: string[]   // Files predicted to change together
  expectedComponents: string[]
  expectedDurationMs: number
  expectedCost: number
}

interface ActivityComparison {
  cochangeAccuracy: number       // % of predictions that were correct
  componentAccuracy: number
  missedComponents: string[]     // Components we should have predicted
  extraComponents: string[]      // Components we didn't predict
}

async function compareExpectationToReality(
  expectation: ActivityExpectation,
  actualChanges: string[]
): Promise<ActivityComparison> {
  // Calculate cochange accuracy
  const predictedSet = new Set(expectation.predictedCochanges)
  const actualSet = new Set(actualChanges)
  
  const cochangeHits = actualChanges.filter(f => predictedSet.has(f))
  const cochangeAccuracy = cochangeHits.length / predictedSet.size
  
  return {
    cochangeAccuracy,
    componentAccuracy: calculateComponentAccuracy(...),
    missedComponents: findMissedComponents(...),
    extraComponents: findExtraComponents(...)
  }
}
```

### Distributed Template Feedback

**Location**: `repos/metabob-opencode/packages/opencode/src/session/distributed-template-feedback.ts`

This system learns from cochange accuracy across all executions:

```typescript
interface ExecutionContext {
  // Predictions from cochange analysis
  predictedFiles: string[]
  predictedCochanges: string[]
  predictedDuration: number
  predictedCost: number
}

interface ExecutionResult {
  // Actual outcomes
  actualFiles: string[]
  actualCochanges: string[]
  actualDuration: number
  actualCost: number
  
  // Quality metrics
  issuesFixed: number
  issuesIntroduced: number
  codeQualityDelta: number
}

// System learns:
// - Which templates are good at predicting cochanges
// - Which file types require related changes
// - Which patterns reliably co-occur
// - Which templates miss related work
```

### Backend Learning API

**Location**: Metabob RPC API (backend service)

```typescript
// POST /v2/activity/outcome
{
  activityId: "act_abc123",
  templateId: "fix-bug-complete-v1",
  
  // Predicted cochanges (before)
  expectation: {
    predictedCochanges: [
      "src/auth.ts",
      "src/auth-utils.ts",
      "src/session.ts"
    ]
  },
  
  // Actual changes (after)
  result: {
    actualFiles: [
      "src/auth.ts",
      "src/auth-utils.ts",
      "src/api/users.ts"  // We missed this!
    ]
  },
  
  // Comparison
  comparison: {
    cochangeAccuracy: 0.66,  // 2/3 correct
    missedComponents: ["src/api/users.ts"]
  }
}
```

Backend uses this to:
1. **Update embeddings**: Reinforce correct predictions, adjust incorrect ones
2. **Evolve templates**: Add steps to check missed cochanges
3. **Route tasks**: Send similar tasks to containers with better cochange accuracy
4. **Create variants**: Commission new template variants with improved prediction

---

## Complete Workflow Example

### Scenario: Fix Authentication Bug

**Step 1: Activity receives cochange context via impulse**

```typescript
// Memory agent creates impulse before activity starts
const cochangeImpulse = await synthesizeCochangeImpulse(["src/auth/login.ts"])

await Session.impulse.create(sessionID, {
  id: "cochange-auth-fix",
  pointer: {
    type: "memo",
    content: cochangeImpulse.content
  },
  budget: 2000
})

// Activity template specifies expectation
const expectation: ActivityExpectation = {
  predictedCochanges: [
    "src/auth/login.ts",
    "src/auth/session.ts",
    "src/auth/utils.ts"
  ],
  expectedComponents: ["login", "validateSession", "hashPassword"],
  expectedDurationMs: 120000,
  expectedCost: 0.05
}
```

**Step 2: Activity executes with context**

```typescript
// Agent sees in <session_memory>:
/*
# Cochange Analysis for src/auth/login.ts

## Related Files to Review

### src/auth/session.ts
**Recommendation**: ⚠️ High priority - has critical issues

**Components**:
- SessionManager (class)
- validateSession (function)
- refreshToken (function)

**Annotations** (why it exists):
- SessionManager: Centralized session lifecycle management. 
  Previously sessions were scattered across 3 files causing race conditions.
  
**Top Issues**:
- [HIGH] Session timeout not refreshed on activity
- [MEDIUM] Missing error handling in refreshToken
*/

// Agent can now:
// 1. Fix login.ts
// 2. Check session.ts for similar patterns
// 3. Fix related issues proactively
// 4. Update tests for both files
```

**Step 3: Record outcome after execution**

```typescript
// Extract actual changes
const gitDiff = await bash({
  command: "git diff --name-only HEAD",
  description: "Get changed files"
})

const actualFiles = gitDiff.output.trim().split("\n")
// Result: ["src/auth/login.ts", "src/auth/session.ts", "src/api/users.ts"]

// Calculate comparison
const comparison = await compareExpectationToReality(expectation, actualFiles)
/*
{
  cochangeAccuracy: 0.66,  // 2/3 correct
  missedComponents: ["src/api/users.ts"],
  componentAccuracy: 0.85,
  costDelta: -0.02,
  durationDeltaMs: -5000
}
*/

// Record to backend
await recordActivityOutcome({
  activityId: activity.id,
  templateId: "fix-bug-complete-v1",
  expectation,
  comparison,
  decisions: agentDecisions  // Agent's reasoning during execution
})
```

**Step 4: Backend learns and evolves**

```typescript
// Backend receives outcome and:

// 1. Analyzes pattern
//    - Template often misses src/api/*.ts files when fixing auth
//    - Cochange predictor should give higher weight to API files

// 2. Updates embeddings
//    - Strengthen auth → api cochange weight
//    - Add src/api/users.ts to cochange training set

// 3. Evolves template
//    - Add step: "Check API files that use authentication"
//    - Update expectation: include src/api/ files

// 4. Creates variant (if accuracy < threshold)
const variant = await commissionVariant({
  baseTemplateId: "fix-bug-complete-v1",
  improvements: [
    "Add API file checking for auth-related changes",
    "Increase cochange prediction scope from 5 to 8 files"
  ],
  variantId: "fix-bug-complete-v1.1"
})
```

---

## API Reference

### Metabob CLI MCP Tools

#### `suggest_related_changes`
```typescript
metabob_suggest_related_changes(
  changed_files: string[],
  top_k?: number
): Promise<{
  suggestions: Array<{
    file_path: string
    total_issues: number
    high_severity_issues: number
    top_issues: Issue[]
    recommendation: string
  }>
  status: "success" | "cpg_unavailable" | "partial_failure"
}>
```

#### `list_file_components`
```typescript
metabob_list_file_components(
  file_path: string
): Promise<{
  components: Array<{
    id: string
    name: string
    type: "function" | "class" | "method"
    line_start: number
    line_end: number
  }>
}>
```

#### `get_component_annotations`
```typescript
metabob_get_component_annotations(
  component_ids: string[]
): Promise<{
  annotations: Array<{
    component_id: string
    component_name: string
    reason: string  // WHY it exists
    timestamp: string
  }>
}>
```

#### `annotate_component`
```typescript
metabob_annotate_component(
  file_path: string,
  component_name: string,
  component_type: "function" | "class" | "method",
  reason: string  // WHY + alternatives + constraints
): Promise<{ success: boolean }>
```

### CPG Inference Python API

```python
from cpg_inference import CoChangePredictor, InferenceConfig

class CoChangePredictor:
    def __init__(
        self,
        config: InferenceConfig,
        project_root: str = ".",
        storage_backend: StorageBackend | None = None
    )
    
    def add_file(
        self,
        file_path: str,
        content: str
    ) -> dict
    
    def predict_cochanges(
        self,
        changed_files: list[str],
        files: dict[str, str],
        top_k: int = 20,
        exclude_same_file: bool = True
    ) -> list[CoChangePrediction]
    
    def get_graph_engine(self) -> GraphQueryEngine
```

### Session Impulse API

```typescript
namespace Session {
  namespace impulse {
    function create(
      sessionID: string,
      impulse: {
        id: string
        pointer: ImpulsePointer
        budget: number
      }
    ): Promise<void>
    
    function get(
      sessionID: string,
      impulseID: string
    ): Promise<Impulse>
    
    function list(
      sessionID: string
    ): Promise<Impulse[]>
  }
}

type ImpulsePointer =
  | { type: "file", path: string }
  | { type: "bashOutput", command: string, output: string }
  | { type: "memo", content: string }
```

### Activity Outcome Recording API

```typescript
namespace ActivityOutcomeRecorder {
  function recordOutcome(
    outcome: ActivityOutcome
  ): Promise<void>
  
  interface ActivityOutcome {
    activityId: string
    templateId: string
    expectation?: ActivityExpectation
    comparison?: ActivityComparison
    decisions: AgentDecision[]
  }
  
  interface ActivityExpectation {
    predictedCochanges: string[]
    expectedComponents: string[]
    expectedDurationMs: number
    expectedCost: number
  }
  
  interface ActivityComparison {
    cochangeAccuracy: number
    missedComponents: string[]
    extraComponents: string[]
    costDelta: number
    durationDeltaMs: number
  }
}
```

---

## Best Practices

### 1. Always Check Cochanges Before Committing

```typescript
// After making changes
const cochanges = await metabob_suggest_related_changes({
  changed_files: modifiedFiles
})

// Review high-priority suggestions
const highPriority = cochanges.suggestions.filter(
  s => s.recommendation.includes("High priority")
)

if (highPriority.length > 0) {
  log.warn("⚠️  High priority related files need review:")
  highPriority.forEach(s => log.warn(`  - ${s.file_path}`))
}
```

### 2. Create Rich Impulses with Multiple Data Sources

```typescript
async function createRichContextImpulse(file: string) {
  const [cochanges, components, issues] = await Promise.all([
    metabob_suggest_related_changes({ changed_files: [file] }),
    metabob_list_file_components({ file_path: file }),
    metabob_search_codebase_issues({ query: `file:${file}` })
  ])
  
  return synthesizeImpulse({ cochanges, components, issues })
}
```

### 3. Record Detailed Outcomes for Learning

```typescript
// Track agent decisions during execution
const decisions: AgentDecision[] = []

// After each significant step
decisions.push({
  step: stepNumber,
  taskId: task.id,
  context: "Fixing authentication timeout",
  decision: "Also update session refresh logic",
  reasoning: "Cochange analysis suggested session.ts changes together with auth.ts",
  outcome: "success"
})

// Include in outcome recording
await recordOutcome({
  activityId,
  templateId,
  decisions,
  comparison: {
    cochangeAccuracy: calculatedAccuracy
  }
})
```

### 4. Use Cochange Data to Improve Template Expectations

```typescript
// Template with learned expectations
export const template: ActivityTemplate = {
  id: "fix-auth-bug-v2",
  
  // Updated based on cochange learning
  expectations: {
    predictedCochanges: [
      "src/auth/*.ts",
      "src/api/users.ts",      // Learned from missed predictions
      "src/middleware/*.ts"
    ],
    expectedComponents: [
      "login", "validateSession", "hashPassword",
      "authenticateRequest"    // Added from cochange analysis
    ]
  }
}
```

---

## Troubleshooting

### CPG Not Available

**Symptom**: `suggest_related_changes` returns `{ status: "cpg_unavailable" }`

**Cause**: Background CPG analysis hasn't completed yet

**Solution**:
```typescript
// Check status
const status = await metabob_get_status()
if (status.status === "initializing") {
  log.info("CPG is still initializing, continuing without cochange predictions")
}

// Continue without blocking - system works without CPG
```

### Low Cochange Accuracy

**Symptom**: Template consistently has low `cochangeAccuracy` (< 0.5)

**Cause**: Template operates on files with weak cochange signals

**Solution**:
1. Increase `top_k` to cast wider net
2. Add manual file checks for known patterns
3. Use component annotations to guide decisions
4. Request variant with improved prediction scope

### Missing Impulses

**Symptom**: Activity doesn't have cochange context in session memory

**Cause**: Memory agent didn't create impulse, or impulse was evicted

**Solution**:
```typescript
// Check impulse exists
const impulses = await Session.impulse.list(sessionID)
const cochangeImpulse = impulses.find(i => i.id.includes("cochange"))

if (!cochangeImpulse) {
  // Create it now
  await createCochangeImpulse(sessionID, changedFiles)
}
```

---

## Future Enhancements

1. **Real-time Cochange Streaming**: Push cochange updates as files change
2. **Cross-Project Learning**: Learn patterns across multiple repositories
3. **Semantic Clustering**: Group related cochanges by feature/domain
4. **Predictive Refactoring**: Suggest refactorings based on cochange patterns
5. **Test Co-location**: Predict which tests need updates based on code changes

---

## Summary

**Key Takeaways**:

✅ **Cochange embeddings** predict related files using CPG + GNN  
✅ **Impulses** deliver cochange context to activities via session memory  
✅ **Activity learning** improves by tracking cochange accuracy  
✅ **Distributed feedback** evolves templates based on real outcomes  

**Integration Points**:
1. **Before execution**: Create impulses with cochange predictions
2. **During execution**: Agent uses context to make informed decisions
3. **After execution**: Record cochange accuracy for learning
4. **Backend learning**: Update embeddings and evolve templates

**Best Practice**: Always run `suggest_related_changes` after making changes, and record the accuracy in activity outcomes.
