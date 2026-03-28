# Activity System Architecture Reset - Removing Local Storage and Binary Classification

**Date**: March 8, 2026  
**Context**: Review of activity system reveals architectural drift from core design principles  
**Issue**: Local storage and strict LLM/deterministic binary classification preventing progressive optimization  

---

## Core Problem Identified

### The Original Vision: Progressive "Cooking Off" of LLM Scaffolding

**Design Philosophy** (from commit `09da75ef` - "ductile rigidity paradigm"):
> "The purpose of this project is to 'cook off' the LLM scaffolding as we better understand the sequences of steps required to accomplish a task."

**Intended Flow**:
```
Iteration 1: Full LLM assistance (learn the task)
  ↓
Iteration 2: Mix of LLM + deterministic (optimize known steps)
  ↓
Iteration 3: Mostly deterministic + minimal LLM (final polish)
  ↓
Iteration N: Pure deterministic (task fully understood)
```

### Current Architecture: Binary Classification **BREAKS** This Flow

**Problem 1: Strict Separation**
```typescript
// Current (WRONG - prevents progressive transition)
executionMode: "llm-assisted" | "deterministic"  // Binary choice

// What we need (RIGHT - allows gradual transition)
tasks: [
  { id: "analyze", executionMode: "llm-assisted" },     // Still learning
  { id: "build", executionMode: "deterministic" },      // Already optimized
  { id: "deploy", executionMode: "deterministic" },     // Already optimized
  { id: "document", executionMode: "llm-assisted" }     // Still learning
]
```

**Problem 2: Local Storage Creates Stagnation**

```
Commit 3f7b29b5 (Mar 2, 2026): "Enforce backend-only template storage via MCP"

Before this commit:
  - Templates stored locally
  - No version tracking
  - No learning feedback loop
  - Templates never evolve

After this commit:
  - Templates in backend
  - Should enable evolution tracking
  - Should enable metrics-driven optimization
  - BUT: Local storage still exists and interferes

Current state:
  ~/.local/share/opencode/storage/activity-template/
  - 19 templates stored locally
  - Never updated
  - Never synchronized
  - Block backend-driven evolution
```

### Why This Prevents Core Development

**Scenario**: You want to optimize the "build-and-deploy" activity

**Intended workflow** (progressive cooking off):
1. Run activity with full LLM → observe what it does
2. Identify repeatable steps → convert to deterministic
3. Activity evolves: 80% deterministic, 20% LLM
4. Metrics show deterministic steps are reliable
5. Backend updates template with optimizations
6. Next run uses optimized version
7. Repeat until 100% deterministic (if possible)

**Current broken workflow** (local storage prevents evolution):
1. Run activity with full LLM
2. Want to convert steps to deterministic
3. Edit template JSON locally
4. Register to backend
5. **BUT**: Local copy still exists
6. **BUT**: Next run might load local copy (cache behavior undefined)
7. **BUT**: Backend changes don't propagate back to local
8. **BUT**: No clear "source of truth" - local vs backend drift
9. **RESULT**: Give up on optimization, stick with what works

---

## Historical Context: Why Local Storage Exists

### Commit Analysis

**Commit `3f7b29b5` (Mar 2, 2026)**:
```
feat(templates): Enforce backend-only template storage via MCP

Instructional State Change:
Templates should be stored and retrieved from backend via MCP, not stored
locally on client machines. This enables centralized learning, reduces
client-side complexity, and ensures template quality control through
metabob-proto.

After:
- Templates stored in backend only (via MCP)
- Single write: backend via metabob-cli MCP
- Fallback chain: cache → backend (embedded bootstrap fallback only)
- Bootstrap templates embedded in binary, registered with backend
- Registration direct to backend (no local file writes)

Validation:
- Status: PARTIAL_PASS (4/9 tests passed, 4 false negatives, 1 legacy cleanup needed)
- ❌ FAIL: Legacy local storage directory exists (cleanup needed)

Ripple Impact:
- Legacy cleanup: rm -rf ~/.local/share/opencode/storage/activity-template/
```

**Key Finding**: **LEGACY CLEANUP WAS NEVER COMPLETED**

The commit intended to remove local storage but:
1. Validation failed (legacy directory still exists)
2. Cleanup was deferred
3. Local storage continued to work
4. Templates accumulated locally
5. Backend-only architecture never fully enforced

### Why Local Storage Seemed Useful

**Development convenience**:
- Fast access (no MCP call)
- Works offline
- Easy to inspect (just read JSON files)
- Easy to edit (just modify files)

**BUT** these "benefits" are actually **anti-patterns**:
- Fast access → Prevents centralized learning
- Works offline → Prevents version synchronization
- Easy to inspect → Prevents schema evolution
- Easy to edit → Prevents quality control

---

## The Binary Classification Problem

### Current Schema (Activity-Level Classification)

```typescript
// CURRENT (WRONG)
interface ActivityTemplate {
  name: string
  executionMode?: "llm-assisted" | "deterministic"  // Template-level
  tasks: Task[]
}

// Forces this pattern (can't mix):
{
  "name": "Build App",
  "executionMode": "deterministic",  // ALL tasks must be deterministic
  "tasks": [
    { "id": "install", "toolSequence": [...] },
    { "id": "build", "toolSequence": [...] },
    { "id": "test", "toolSequence": [...] }
  ]
}
```

**Problems**:
1. Can't have some tasks LLM-assisted, others deterministic
2. Can't gradually transition tasks from LLM → deterministic
3. Forces complete rewrite to change execution mode
4. No path for progressive optimization

### Current Schema (Task-Level Classification) - Better but Still Binary

```typescript
// CURRENT IMPLEMENTATION (PARTIAL - task-level)
interface Task {
  id: string
  executionMode?: "llm-assisted" | "deterministic"  // Task-level (good!)
  prompt?: PromptConfig                              // For LLM
  toolSequence?: ToolCall[]                          // For deterministic
}

// Allows this pattern (can mix):
{
  "name": "Build App",
  "tasks": [
    { "id": "install", "executionMode": "deterministic", "toolSequence": [...] },
    { "id": "build", "executionMode": "deterministic", "toolSequence": [...] },
    { "id": "analyze", "executionMode": "llm-assisted", "prompt": {...} }  // Can mix!
  ]
}
```

**Better** but **still binary**:
1. ✅ Can mix LLM and deterministic tasks
2. ✅ Can transition tasks individually
3. ❌ Each task is binary (can't have partial optimization)
4. ❌ No metadata about "readiness" for deterministic conversion
5. ❌ No progressive transition within a single task

### What We Actually Need: Progressive Transition Metadata

```typescript
// PROPOSED (RIGHT - enables progressive optimization)
interface Task {
  id: string
  
  // Execution strategy (not binary mode)
  execution: {
    // Primary method
    method: "llm-assisted" | "hybrid" | "deterministic"
    
    // For hybrid: which steps are deterministic
    deterministicSteps?: string[]  // e.g., ["setup", "build", "cleanup"]
    llmSteps?: string[]            // e.g., ["analyze", "optimize"]
    
    // Optimization metadata
    optimization: {
      readiness: "learning" | "ready-for-conversion" | "optimized" | "stable"
      successRate: number     // 0-1 (deterministic conversion threshold: 0.95)
      avgCost: number         // Track cost reduction over iterations
      lastOptimized: number   // Timestamp of last optimization
      optimizationOpportunities: string[]  // e.g., ["Step 2 always identical", "Pattern detected"]
    }
  }
  
  // LLM configuration (optional - for llm-assisted or hybrid)
  prompt?: PromptConfig
  
  // Deterministic configuration (optional - for deterministic or hybrid)
  toolSequence?: ToolCall[]
  
  // Hybrid configuration (optional - for progressive transition)
  hybridFlow?: {
    steps: Array<{
      id: string
      type: "llm" | "deterministic"
      config: PromptConfig | ToolCall[]
    }>
  }
}
```

**Example of Progressive Transition**:

```typescript
// Iteration 1: Full LLM (learning)
{
  "id": "build-app",
  "execution": {
    "method": "llm-assisted",
    "optimization": {
      "readiness": "learning",
      "successRate": 0.0,
      "avgCost": 0.0,
      "optimizationOpportunities": []
    }
  },
  "prompt": {
    "template": "Build the application and run tests"
  }
}

// Iteration 5: LLM learns pattern → hybrid suggested
{
  "id": "build-app",
  "execution": {
    "method": "hybrid",  // TRANSITION STARTED
    "deterministicSteps": ["install", "build"],  // These are stable
    "llmSteps": ["analyze-errors"],              // This still needs LLM
    "optimization": {
      "readiness": "ready-for-conversion",
      "successRate": 0.87,  // 87% of runs follow same pattern
      "avgCost": 0.015,     // Down from 0.05 (70% reduction)
      "optimizationOpportunities": [
        "Install always runs: bun install",
        "Build always runs: bun run build",
        "Error analysis varies by build output"
      ]
    }
  },
  "hybridFlow": {
    "steps": [
      {
        "id": "install",
        "type": "deterministic",
        "config": [{"tool": "bash", "params": {"command": "bun install"}}]
      },
      {
        "id": "build",
        "type": "deterministic",
        "config": [{"tool": "bash", "params": {"command": "bun run build"}}]
      },
      {
        "id": "analyze",
        "type": "llm",
        "config": {"template": "Analyze build output: {{buildOutput}}"}
      }
    ]
  }
}

// Iteration 10: Fully optimized → deterministic
{
  "id": "build-app",
  "execution": {
    "method": "deterministic",  // TRANSITION COMPLETE
    "optimization": {
      "readiness": "stable",
      "successRate": 0.98,  // 98% success with deterministic
      "avgCost": 0.0,       // Zero LLM cost
      "lastOptimized": 1709884800,
      "optimizationOpportunities": []
    }
  },
  "toolSequence": [
    {"tool": "bash", "params": {"command": "bun install"}},
    {"tool": "bash", "params": {"command": "bun run build"}},
    {"tool": "bash", "params": {"command": "bun test"}}
  ]
}
```

---

## Architectural Requirements for "Cooking Off"

### Requirement 1: Single Source of Truth (Backend Only)

**REMOVE**:
- Local template storage (`~/.local/share/opencode/storage/activity-template/`)
- Local template fallback in TemplateLoader
- Dual-write patterns

**ENFORCE**:
- All templates loaded from backend via MCP
- Only bootstrap templates embedded in binary (cold-start only)
- Template modifications always go through backend

**Implementation**:
```bash
# Step 1: Remove local storage
rm -rf ~/.local/share/opencode/storage/activity-template/

# Step 2: Update TemplateLoader to fail if backend unavailable (except bootstrap)
# Step 3: Remove all local storage code paths
# Step 4: Enforce strictBackend=true for all non-bootstrap templates
```

### Requirement 2: Version Tracking and Evolution

**ADD**:
- Template version schema (already exists in `template-version.ts`)
- Template genealogy (already exists in `template-genealogy.ts`)
- Metrics-driven optimization triggers

**ENFORCE**:
- Every template execution updates metrics
- Metrics trigger optimization suggestions
- Backend tracks template evolution over time

**Implementation**:
```typescript
// After each execution
await TemplateServiceClient.updateMetrics(templateId, {
  executions: currentExecutions + 1,
  successRate: calculateSuccessRate(history),
  avgCost: calculateAvgCost(history),
  avgDuration: calculateAvgDuration(history),
  
  // NEW: Optimization readiness
  optimizationReadiness: {
    deterministicConversionReady: successRate > 0.95 && patternDetected,
    costReductionOpportunity: avgCost > threshold && repeatableSteps.length > 0,
    suggestedOptimizations: [
      { type: "deterministic-conversion", confidence: 0.87, steps: [...] },
      { type: "hybrid-split", confidence: 0.72, config: {...} }
    ]
  }
})
```

### Requirement 3: Progressive Transition Support

**ADD**:
- Hybrid execution mode (mix LLM + deterministic)
- Step-level execution tracking
- Pattern detection for deterministic conversion
- Optimization suggestion system

**REMOVE**:
- Strict binary classification (llm-assisted XOR deterministic)
- Template-level execution mode (move to task-level only)

**Implementation**:
```typescript
// executeTask() logic
async function executeTask(task: Task, variables: Record<string, unknown>) {
  const method = task.execution?.method || "llm-assisted"
  
  if (method === "llm-assisted") {
    return await executeLLMTask(task, variables)
  } else if (method === "deterministic") {
    return await executeDeterministicTask(task, variables)
  } else if (method === "hybrid") {
    // NEW: Progressive execution
    const results = []
    for (const step of task.hybridFlow.steps) {
      if (step.type === "llm") {
        results.push(await executeLLMStep(step, variables))
      } else {
        results.push(await executeDeterministicStep(step, variables))
      }
    }
    return combineResults(results)
  }
}
```

### Requirement 4: Automatic Optimization Detection

**ADD**:
- Pattern detection in LLM outputs
- Repetition analysis (same tool calls across runs)
- Cost/benefit analysis for deterministic conversion
- Automatic suggestion generation

**Implementation**:
```typescript
// After N executions, analyze patterns
async function analyzeOptimizationOpportunities(templateId: string) {
  const history = await getExecutionHistory(templateId, { limit: 100 })
  
  // Detect repeatable patterns
  const patterns = detectRepeatedToolCalls(history)
  
  // Calculate conversion confidence
  const confidence = calculateDeterministicConversionConfidence(patterns)
  
  if (confidence > 0.80) {
    // Suggest deterministic conversion
    await TemplateServiceClient.suggestOptimization(templateId, {
      type: "deterministic-conversion",
      confidence,
      estimatedCostSavings: patterns.avgCost * patterns.frequency,
      proposedToolSequence: patterns.mostCommonSequence,
      affectedSteps: patterns.steps
    })
  }
}
```

---

## Migration Plan

### Phase 1: Remove Local Storage (Week 1)

**Goal**: Complete the cleanup from commit `3f7b29b5`

**Tasks**:
1. ✅ Analyze current local storage usage
2. ⬜ Remove local storage directory: `rm -rf ~/.local/share/opencode/storage/activity-template/`
3. ⬜ Update TemplateLoader: Remove local storage fallback for non-bootstrap templates
4. ⬜ Enforce `strictBackend: true` for all production usage
5. ⬜ Update tests to not rely on local storage
6. ⬜ Verify all templates load from backend via MCP

**Validation**:
```bash
# After cleanup, this should be empty (except bootstrap embedded in binary)
ls ~/.local/share/opencode/storage/activity-template/
# Expected: Directory doesn't exist or is empty

# All templates should come from backend
bun run dev ../.. search_activities({ verbose: true })
# Expected: Templates loaded from "metabob" source
```

### Phase 2: Remove Binary Classification (Week 2)

**Goal**: Enable task-level execution modes, deprecate template-level

**Tasks**:
1. ⬜ Remove template-level `executionMode` field
2. ⬜ Ensure all templates use task-level `executionMode`
3. ⬜ Update existing templates to use task-level classification
4. ⬜ Update documentation to reflect task-level classification only

**Migration Script**:
```typescript
// Convert templates from template-level to task-level
function migrateTemplate(template: OldTemplate): NewTemplate {
  const templateMode = template.executionMode || "llm-assisted"
  
  return {
    ...template,
    executionMode: undefined,  // Remove template-level
    tasks: template.tasks.map(task => ({
      ...task,
      executionMode: task.executionMode || templateMode  // Use task-level
    }))
  }
}
```

### Phase 3: Add Progressive Transition Support (Week 3-4)

**Goal**: Enable hybrid mode and optimization metadata

**Tasks**:
1. ⬜ Add `execution` schema to Task
2. ⬜ Add `optimization` metadata to Task
3. ⬜ Implement `hybrid` execution method
4. ⬜ Implement pattern detection for optimization suggestions
5. ⬜ Add metrics-driven optimization triggers
6. ⬜ Build optimization suggestion UI/CLI

**New Schema**:
```typescript
// Add to activity-template.ts
const ExecutionConfigSchema = z.object({
  method: z.enum(["llm-assisted", "hybrid", "deterministic"]),
  deterministicSteps: z.array(z.string()).optional(),
  llmSteps: z.array(z.string()).optional(),
  optimization: z.object({
    readiness: z.enum(["learning", "ready-for-conversion", "optimized", "stable"]),
    successRate: z.number().min(0).max(1),
    avgCost: z.number(),
    lastOptimized: z.number().optional(),
    optimizationOpportunities: z.array(z.string())
  })
})

const HybridFlowSchema = z.object({
  steps: z.array(z.object({
    id: z.string(),
    type: z.enum(["llm", "deterministic"]),
    config: z.union([PromptConfigSchema, z.array(ToolCallSchema)])
  }))
})
```

### Phase 4: Backend Integration (Week 5)

**Goal**: Ensure backend supports optimization workflow

**Tasks**:
1. ⬜ Add optimization suggestion storage to backend
2. ⬜ Add pattern detection API to metabob-rpc-api
3. ⬜ Add template evolution tracking to backend
4. ⬜ Build optimization dashboard

**Backend APIs**:
```python
# metabob-rpc-api additions
@router.post("/api/v1/templates/{template_id}/suggest-optimization")
async def suggest_optimization(template_id: str, suggestion: OptimizationSuggestion):
    """Record optimization suggestion for template"""
    pass

@router.get("/api/v1/templates/{template_id}/optimization-history")
async def get_optimization_history(template_id: str):
    """Get history of optimizations for template"""
    pass

@router.post("/api/v1/templates/{template_id}/apply-optimization")
async def apply_optimization(template_id: str, optimization_id: str):
    """Apply suggested optimization to template (create new version)"""
    pass
```

---

## Expected Outcomes

### Immediate Benefits (Phase 1 complete)

✅ **Single source of truth**: All templates from backend
✅ **No local drift**: Backend changes immediately visible
✅ **Version tracking**: Template evolution properly tracked
✅ **Multi-user sync**: All users see latest optimizations

### Medium-term Benefits (Phase 2-3 complete)

✅ **Progressive optimization**: Tasks transition from LLM → deterministic gradually
✅ **Cost reduction**: Automated detection of optimization opportunities
✅ **Better UX**: Clear visibility into optimization readiness
✅ **Learning loop**: Metrics drive continuous improvement

### Long-term Benefits (Phase 4 complete)

✅ **Self-optimizing system**: Templates improve automatically over time
✅ **Pattern reuse**: Common patterns detected and shared across templates
✅ **Zero-cost workflows**: Fully optimized templates run with zero LLM cost
✅ **Knowledge accumulation**: System learns task decomposition patterns

---

## Risks and Mitigation

### Risk 1: Breaking Existing Workflows

**Risk**: Users rely on local storage for development

**Mitigation**:
- Provide clear migration guide
- Add warning logs before removal
- Create backup of local templates before deletion
- Provide import script: local → backend

### Risk 2: Backend Dependency

**Risk**: System unusable if backend unavailable

**Mitigation**:
- Keep bootstrap templates embedded (cold-start capability)
- Add cache layer for recently used templates
- Implement retry logic with exponential backoff
- Provide offline mode with limited functionality

### Risk 3: Migration Complexity

**Risk**: Existing templates need manual updates

**Mitigation**:
- Build automated migration scripts
- Provide validation tools for migrated templates
- Create comprehensive test suite
- Phase migration over time (not big-bang)

---

## Conclusion

The current activity system has **architectural drift** from the core "cooking off" philosophy:

1. **Local storage exists** when it should have been removed (commit `3f7b29b5` cleanup incomplete)
2. **Binary classification** prevents progressive optimization
3. **No optimization loop** connecting metrics to template evolution

**Recommendation**: Execute 4-phase migration plan to align implementation with original vision.

**Timeline**: 5 weeks
**Effort**: Medium (mostly schema + cleanup, core execution logic already exists)
**Impact**: High (enables core use case of progressive optimization)

**Next Steps**:
1. Review this document with stakeholders
2. Prioritize Phase 1 (local storage removal) - quick win, high impact
3. Prototype Phase 3 (hybrid mode) - validate approach before full implementation
4. Schedule full migration after validation

---

**Document Status**: ✅ READY FOR REVIEW
**Author**: Claude (OpenCode Activity Mode)
**Date**: March 8, 2026
