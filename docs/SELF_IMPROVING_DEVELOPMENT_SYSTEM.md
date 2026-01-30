# Self-Improving Development System

**Status**: Implementation Ready  
**Created**: January 30, 2026  
**Version**: 1.0.0

## Executive Summary

This document describes how metabob enables a **self-improving development system** that learns from its mistakes and prevents ineffective fixes like those that plagued the memory leak investigation.

**The Problem We're Solving**: Multiple commits added 13,000+ lines of code that did nothing to fix the actual memory leak. The system needs to:
1. Detect when proposed fixes don't actually address the problem
2. Learn what approaches work/don't work for each component
3. Prevent accumulation of unmaintained code
4. Continuously refine its understanding based on validation results

**The Solution**: A metabob-directed learning system with:
- **Bounded annotation growth** (max 5 annotations, 2500 tokens per component)
- **Component-specific prompts** that evolve based on what works
- **Automatic task decomposition** using CPG analysis
- **Feedback-driven association graph** (component ↔ impulse ↔ task ↔ activity)

---

## How It Would Have Prevented the Memory Leak Disaster

### What Happened

**5 commits attempted to fix memory leak**:
1. `2b5aa7d8` - Added LRU cache to Storage layer (+13,219 lines)
2. `b2c646f7` - Added impulse memory optimizer (+193 lines)
3. `d1ae13a2` - Implemented bounded impulse cache (+2,568 lines)
4. `79d5e92a` - Added subscription manager (+747 lines)
5. `6b0f5b83` - Added session memory manager (+1,062 lines)

**Total**: 17,789 lines of code added  
**Actual fix needed**: 3-line change to Session.messages() to add default limit  
**Result**: Memory leak still present, 17,789 lines of maintenance burden

### How Metabob Would Catch This

#### 1. **Impact Analysis Before Implementation**

```typescript
// Before implementing SessionMemoryManager
await metabob_analyze_change_impact({
  file_path: "src/session/session-memory-manager.ts",
  component_name: "SessionMemoryManager",
  analysis_type: "prospective"
})

// Result:
{
  callPaths: [],                    // ❌ No callers
  dependencies: ["Session"],        // ✅ Depends on Session
  dependents: [],                   // ❌ Nothing depends on this
  integrationStatus: "orphaned",    // ❌ RED FLAG
  recommendation: "DO NOT IMPLEMENT - no integration points"
}
```

**Outcome**: Activity would FAIL at validation step - no integration

#### 2. **Disconnected Code Detection After Implementation**

```typescript
// After creating session-memory-manager.ts
await metabob_assess_deletion_safety({
  file_path: "src/session/session-memory-manager.ts",
  component_name: "SessionMemoryManager"
})

// Result:
{
  liveness: "dead",                 // ❌ Never called
  live_paths: [],                   // ❌ No execution paths
  callers: ["tests/session-memory-manager.test.ts"], // ⚠️  Only test file
  deletion_safety: "HIGH",          // ❌ Can delete safely
  recommendation: "REMOVE - not integrated into codebase"
}
```

**Outcome**: Post-commit validation would flag this for removal

#### 3. **Related Changes Suggestions**

```typescript
// After creating session-memory-manager.ts
await metabob_suggest_related_changes({
  changed_files: ["src/session/session-memory-manager.ts"],
  analysis_scope: "integration"
})

// Result:
{
  missingIntegrations: [
    {
      file: "src/session/index.ts",
      reason: "Session.create() should register with SessionMemoryManager",
      confidence: 0.95,
      required: true
    },
    {
      file: "src/app.ts",
      reason: "App startup should initialize SessionMemoryManager",
      confidence: 0.92,
      required: true
    }
  ],
  recommendation: "INTEGRATION INCOMPLETE - 2 critical files not updated"
}
```

**Outcome**: Activity validation would fail - missing integration points

#### 4. **Annotation-Driven Learning**

After the first failed attempt (LRU cache), the system would learn:

```typescript
// Component annotation for Session.messages component
await metabob_annotate_component({
  file_path: "src/session/index.ts",
  component_name: "messages",
  annotation_type: "FAILURE",
  message: `❌ FAILED APPROACH: Added LRU cache to Storage layer

PROBLEM: Cache doesn't prevent initial load of all messages
ROOT CAUSE: No default limit on message count
VALIDATION: Memory still grew to 16GB

LESSON: Fixing downstream (Storage) doesn't help if upstream (messages) is unbounded

CORRECT APPROACH: Add default limit at source (messages function)
- Add .default(100) to schema
- Add runtime fallback: const limit = input.limit ?? 100
- Change loop to always respect limit

DO NOT REPEAT:
- Adding caches (doesn't prevent load)
- Adding managers (orphaned code)
- Adding cleanup (races with growth)
`
})
```

**Outcome**: Second attempt would have this context and avoid same mistake

#### 5. **Component-Specific Prompt Evolution**

After first failure, prompt profile would update:

```typescript
// Prompt profile for Session.messages after failed LRU cache attempt
{
  componentId: "src/session/index.ts::messages",
  
  ineffectiveInstructions: [
    {
      text: "Add LRU cache for message storage",
      successRate: 0.0,
      usageCount: 1,
      reason: "Doesn't prevent initial unbounded load"
    }
  ],
  
  knownPitfalls: [
    "Caching downstream doesn't help if upstream is unbounded",
    "Manager classes often become orphaned without explicit integration",
    "Schema defaults alone insufficient - need runtime fallback"
  ],
  
  optimizedPrompt: `Fix unbounded message accumulation in messages() function.

ROOT CAUSE: No default limit - function loads ALL messages into memory

CORRECT FIX (3 lines):
1. Add .default(100) to limit parameter schema
2. Add runtime fallback: const effectiveLimit = input.limit ?? 100  
3. Change loop condition to ALWAYS respect limit

AVOID THESE APPROACHES (0% success rate):
❌ Adding LRU caches (tried 2 times, failed both)
❌ Creating manager classes (become orphaned)
❌ Adding periodic cleanup (races with growth)

VALIDATION CRITERIA:
- Memory stays under 100MB after loading 1000 sessions
- All existing tests pass
- New test: verify limit is enforced even when not specified

KNOWN PITFALLS:
- Schema default alone is insufficient (must have runtime fallback)
- Downstream fixes don't work (must fix at source)`,
  
  promptVersion: 2  // Evolved after first failure
}
```

**Outcome**: Second attempt uses learned knowledge, makes correct fix

---

## System Architecture

### 1. Bounded Annotation System

**Problem**: Annotations grow unbounded → context bloat → less effective prompts

**Solution**: Budget system with LRU-style refinement

```typescript
interface ComponentAnnotationBudget {
  componentId: string
  maxAnnotations: 5              // Hard limit
  maxTokensPerAnnotation: 500    // Per annotation
  totalTokenBudget: 2500         // Total (5 × 500)
  
  annotations: RankedAnnotation[] // Sorted by relevance
  refinementGeneration: number    // How many times refined
}

interface RankedAnnotation {
  type: "WHY" | "CONSTRAINT" | "PATTERN" | "FAILURE" | "SUCCESS"
  content: string
  tokens: number
  relevanceScore: number          // 0-1, determines eviction
  successContributions: number    // Times this annotation helped
  failureCorrelations: number     // Times present during failures
}
```

**Refinement Algorithm**:
1. **After each validation**, update relevance scores:
   - Success + annotation in context → boost score
   - Failure + annotation in context → penalize score
   - Not used recently → decay score
2. **If over budget**, evict lowest-scoring annotations
3. **Add new insight** from validation if has higher score
4. **Compress similar** annotations to save budget

**Result**: Components maintain 3-5 high-quality annotations that actually help

### 2. Component-Specific Prompt Optimization

**Problem**: Generic prompts don't leverage learned knowledge about what works

**Solution**: Each component learns its own optimal prompt

```typescript
interface ComponentPromptProfile {
  componentId: string
  
  effectiveInstructions: WeightedInstruction[]    // What works
  ineffectiveInstructions: WeightedInstruction[]  // What doesn't
  
  requiredContext: string[]        // Always needed
  optionalContext: string[]        // Sometimes helpful
  unnecessaryContext: string[]     // Never helpful
  
  knownPitfalls: string[]          // Don't repeat mistakes
  successfulApproaches: string[]   // Ordered by success rate
  
  optimizedPrompt: string          // Generated from learned patterns
  promptVersion: number            // Increments when prompt evolves
}
```

**Learning Process**:
1. Track which instructions correlate with success/failure
2. Move ineffective instructions from "effective" to "ineffective" list
3. Extract pitfalls from failures
4. Generate optimized prompt incorporating learned patterns
5. Version the prompt to track evolution

**Result**: Prompts evolve to focus on what actually works for each component

### 3. Metabob-Directed Task Decomposition

**Problem**: Manual task breakdown misses impacted components

**Solution**: Use CPG to automatically identify components and sequence changes

```typescript
// Automatic decomposition using metabob
async function decomposeTaskByComponents(
  taskDescription: string,
  repository: Repository
): Promise<TaskDecomposition> {
  
  // Step 1: Extract intent, find entry points
  const intent = await extractIntent(taskDescription)
  const entryPoints = await metabob_search_codebase_issues({
    query: `related to: ${intent}`,
    max_results: 10
  })
  
  // Step 2: Analyze impact from entry points
  const impacts = []
  for (const entry of entryPoints) {
    const impact = await metabob_analyze_change_impact({
      file_path: entry.file,
      component_name: entry.component,
      max_depth: 3
    })
    impacts.push(impact)
  }
  
  // Step 3: Build dependency-ordered change sequence
  const sequence = await orderByDependencies(impacts)
  
  // Step 4: Generate component-targeted activities
  const activities = sequence.map(step => ({
    targetComponents: step.components,
    optimizedPrompts: await loadOptimizedPromptsFor(step.components),
    requiredImpulses: await selectOptimalContext(step.components),
    validationCriteria: step.validationCriteria
  }))
  
  return { impacts, sequence, activities }
}
```

**Result**: Complex tasks automatically broken into component-targeted subtasks

### 4. Feedback-Driven Association Graph

**Problem**: No memory of what worked before for similar situations

**Solution**: Graph tracking component ↔ impulse ↔ task ↔ activity associations

```typescript
interface AssociationGraph {
  // Nodes
  components: Map<string, ComponentNode>
  impulses: Map<string, ImpulseNode>
  tasks: Map<string, TaskNode>
  activities: Map<string, ActivityNode>
  
  // Edges (weighted by success correlation)
  componentImpulseEdges: WeightedEdge[]  // Which impulses help which components
  impulseTaskEdges: WeightedEdge[]       // Which impulses help which tasks
  taskActivityEdges: WeightedEdge[]      // Which activities work for which tasks
  componentTaskEdges: WeightedEdge[]     // Which tasks work for which components
}

interface WeightedEdge {
  source: string
  target: string
  weight: number        // Success correlation: 0-1
  confidence: number    // Based on sample size
  lastUpdatedAt: Date
}
```

**Learning Algorithm**:
1. **After validation**, update edge weights:
   - Success → boost weight between (component, helpful impulse)
   - Failure → penalize weight between (component, unhelpful impulse)
2. **Prune weak associations**:
   - Remove edges with low weight + high confidence (reliably unhelpful)
   - Remove stale edges (not updated in 90 days)
3. **Use for context selection**:
   - Find highest-weighted impulses for (component, task) pair
   - Select within token budget using knapsack algorithm

**Result**: System learns what context actually helps for each component/task combo

---

## Complete Workflow: Memory Leak Fix (How It Should Have Gone)

### Phase 1: Task Decomposition (Metabob-Driven)

```typescript
const task = "Fix memory leak where session messages accumulate unbounded"

// System automatically decomposes using metabob
const decomposition = await decomposeTaskByComponents(task, repository)

/*
Result:
{
  impactedComponents: [
    {
      componentId: "src/session/index.ts::messages",
      impactType: "modify",
      reason: "Root cause - no default limit",
      complexity: "simple",
      linesOfCode: 15,
      estimatedEffort: "5 minutes"
    }
  ],
  changeSequence: [
    {
      step: 1,
      components: ["src/session/index.ts::messages"],
      rationale: "Add default 100-message limit",
      approach: "Add schema default + runtime fallback",
      validation: "Memory stays under 100MB after 1000 operations",
      estimatedImpact: "99% memory reduction"
    }
  ]
}
*/
```

**Key insight**: Metabob identified the actual problem - `messages` function has no limit

### Phase 2: Load Component Knowledge

```typescript
// Load learned knowledge about this component
const componentId = "src/session/index.ts::messages"

// 1. Load annotation budget
const annotations = await loadComponentAnnotations(componentId)
/*
annotations = [
  {
    type: "WHY",
    content: "Streams messages from storage for session replay",
    relevanceScore: 0.95,
    tokens: 80
  },
  {
    type: "CONSTRAINT",
    content: "Must preserve message order (reverse at end)",
    relevanceScore: 0.88,
    tokens: 65
  },
  {
    type: "PATTERN",
    content: "Uses async generator for streaming",
    relevanceScore: 0.76,
    tokens: 55
  }
]
*/

// 2. Load prompt profile
const promptProfile = await loadComponentPromptProfile(componentId)
/*
promptProfile = {
  optimizedPrompt: "...",  // Component-specific instructions
  knownPitfalls: [],       // Empty - no previous attempts
  effectiveInstructions: [],
  ineffectiveInstructions: []
}
*/

// 3. Load association graph
const contextImpulses = await selectOptimalContext(
  componentId,
  "fix_memory_leak",
  associationGraph,
  tokenBudget: 5000
)
/*
contextImpulses = [
  "impulse_streaming_patterns",     // score: 0.82
  "impulse_memory_optimization",    // score: 0.75
] // Total: 1800 tokens
*/
```

### Phase 3: Execute Fix with Validation Gates

```typescript
// Execute component-targeted activity
const result = await executeComponentTargetedActivity({
  targetComponent: componentId,
  prompt: promptProfile.optimizedPrompt,
  contextImpulses,
  validationGates: [
    {
      name: "impact_analysis",
      fn: async () => {
        // Verify change actually impacts the problem
        const impact = await metabob_analyze_change_impact({...})
        assert(impact.affectsMemoryUsage === true)
      }
    },
    {
      name: "integration_check",
      fn: async () => {
        // Verify new code is actually used
        const safety = await metabob_assess_deletion_safety({...})
        assert(safety.liveness === "live")
      }
    },
    {
      name: "memory_validation",
      fn: async () => {
        // Measure actual memory usage
        const memory = await runMemoryTest()
        assert(memory.final < 100 * 1024 * 1024) // < 100MB
      }
    }
  ]
})
```

**Key difference**: Validation gates BEFORE commit prevent ineffective fixes

### Phase 4: Validation & Learning

```typescript
// Run validation
const validation = await runValidation(result.changes)

/*
validation = {
  success: true,
  componentId: "src/session/index.ts::messages",
  impulseIds: ["impulse_streaming_patterns", "impulse_memory_optimization"],
  taskType: "fix_memory_leak",
  activityId: activity.id,
  cost: 0.04,
  duration: 12000,
  memoryBefore: 16000,  // MB
  memoryAfter: 95,      // MB
  reduction: "99.4%",
  hasNewInsight: true,
  insight: "Default in schema alone insufficient - runtime fallback essential"
}
*/

// System automatically learns from validation
await refineComponentAnnotations(componentId, validation)
/*
New annotation added:
{
  type: "SUCCESS",
  content: "✅ Memory leak fixed by adding default limit. 
           CRITICAL: Schema default + runtime fallback both required.
           Reduction: 16GB → 95MB (99.4%)",
  relevanceScore: 1.0,
  tokens: 85
}
*/

await optimizeComponentPrompt(componentId, validation)
/*
Prompt updated:
effectiveInstructions += [
  {
    text: "Add both schema default (.default(100)) and runtime fallback",
    successRate: 1.0,
    usageCount: 1
  }
]
promptVersion: 1 → 2
*/

await updateAssociationsFromValidation(validation, associationGraph)
/*
Edges updated:
- messages ↔ impulse_streaming_patterns: weight 0.82 → 0.88
- messages ↔ fix_memory_leak task: weight 0.0 → 1.0
- fix_memory_leak ↔ fix-bug-complete activity: weight 0.0 → 1.0
*/
```

**Result**: System learned what works for next time

### Comparison: What Actually Happened vs. What Should Have Happened

| Aspect | What Happened | With Metabob Learning |
|--------|--------------|----------------------|
| **Lines added** | 17,789 lines | 3 lines |
| **Commits** | 5 failed attempts | 1 successful fix |
| **Time** | Days of work | 15 minutes |
| **Memory usage** | Still leaking (16GB+) | Fixed (95MB) |
| **Maintenance burden** | 17,789 lines to maintain | 3 lines to maintain |
| **Learning** | None - repeated mistakes | System learned for next time |
| **Detection** | Manual discovery it didn't work | Automated validation gates |

---

## Implementation Roadmap

### Phase 1: Annotation Budget System (Week 1)
**Goal**: Prevent annotation bloat

**Tasks**:
- [ ] Implement ComponentAnnotationBudget schema
- [ ] Add refinement algorithm (score updates, eviction, compression)
- [ ] Add metabob integration for reading/writing annotations
- [ ] Test on metabob-opencode components
- [ ] Create monitoring dashboard

**Deliverables**:
- Annotation budget manager
- Refinement service
- Dashboard showing annotation health

### Phase 2: Prompt Optimization (Week 2)
**Goal**: Component-specific prompts that evolve

**Tasks**:
- [ ] Implement ComponentPromptProfile tracking
- [ ] Build prompt optimization algorithm
- [ ] Add learning from failures (extract pitfalls)
- [ ] Generate component-specific templates
- [ ] Version prompts to track evolution

**Deliverables**:
- Prompt profile manager
- Learning algorithm
- Versioned prompts per component

### Phase 3: Metabob Decomposition (Week 3)
**Goal**: Automatic component-targeted task breakdown

**Tasks**:
- [ ] Build task decomposition using CPG
- [ ] Implement component-targeted activities
- [ ] Add dataflow-based sequencing
- [ ] Create validation gates (impact, integration, performance)
- [ ] Test on complex multi-component tasks

**Deliverables**:
- Task decomposer
- Component-targeted activity templates
- Validation gate framework

### Phase 4: Association Learning (Week 4)
**Goal**: Remember what worked before

**Tasks**:
- [ ] Implement AssociationGraph schema
- [ ] Add validation feedback loop
- [ ] Build optimal context selection (knapsack algorithm)
- [ ] Create learning metrics dashboard
- [ ] Add pruning for weak associations

**Deliverables**:
- Association graph manager
- Context selector
- Learning metrics dashboard

### Phase 5: Integration & Testing (Week 5)
**Goal**: End-to-end workflow

**Tasks**:
- [ ] Integrate all systems
- [ ] Create `component-targeted-fix-with-learning` activity template
- [ ] Test on real bugs (including memory leak)
- [ ] Measure learning convergence
- [ ] Document usage patterns

**Deliverables**:
- Complete working system
- Activity template library
- User documentation
- Performance benchmarks

---

## Validation Gates: Preventing Bad Fixes

### Gate 1: Impact Analysis
**Question**: Does the proposed fix actually affect the problem area?

```typescript
const impactGate = {
  name: "impact_analysis",
  required: true,
  async validate(changes: Changes): Promise<ValidationResult> {
    const impact = await metabob_analyze_change_impact({
      file_path: changes.file,
      component_name: changes.component,
      max_depth: 3
    })
    
    // Verify change affects problem area
    const affectsProblem = impact.dependents.some(d => 
      d.component_id.includes(problemArea)
    )
    
    return {
      pass: affectsProblem,
      message: affectsProblem 
        ? "✅ Change affects problem area"
        : "❌ Change is isolated - won't fix problem"
    }
  }
}
```

**Memory leak example**: Would have failed for SessionMemoryManager (no path to messages function)

### Gate 2: Integration Check
**Question**: Is the new code actually used?

```typescript
const integrationGate = {
  name: "integration_check",
  required: true,
  async validate(changes: Changes): Promise<ValidationResult> {
    const safety = await metabob_assess_deletion_safety({
      file_path: changes.file,
      component_name: changes.component
    })
    
    // Verify code has callers
    const hasCallers = safety.live_paths && safety.live_paths.length > 0
    const onlyTestCallers = safety.callers?.every(c => c.includes('test'))
    
    return {
      pass: hasCallers && !onlyTestCallers,
      message: hasCallers && !onlyTestCallers
        ? "✅ Code is integrated and called"
        : "❌ Code is orphaned - only called from tests"
    }
  }
}
```

**Memory leak example**: Would have failed for BoundedImpulseCache (never imported)

### Gate 3: Related Changes
**Question**: Are all necessary integration points updated?

```typescript
const relatedChangesGate = {
  name: "related_changes",
  required: true,
  async validate(changes: Changes): Promise<ValidationResult> {
    const related = await metabob_suggest_related_changes({
      changed_files: changes.files,
      analysis_scope: "integration"
    })
    
    // Check for missing integrations
    const hasMissingIntegrations = related.missing_integrations?.length > 0
    
    return {
      pass: !hasMissingIntegrations,
      message: hasMissingIntegrations
        ? `❌ Missing integrations: ${related.missing_integrations.map(m => m.file).join(', ')}`
        : "✅ All integration points updated",
      metadata: { missingIntegrations: related.missing_integrations }
    }
  }
}
```

**Memory leak example**: Would have flagged Session.create() not calling SessionMemoryManager

### Gate 4: Performance Validation
**Question**: Does the fix actually improve the measured metric?

```typescript
const performanceGate = {
  name: "performance_validation",
  required: true,
  async validate(changes: Changes, issue: Issue): Promise<ValidationResult> {
    // Measure before/after
    const before = await measurePerformance(issue.metric)
    await applyChanges(changes)
    const after = await measurePerformance(issue.metric)
    
    const improved = after < before * 0.9 // 10% improvement threshold
    const reduction = ((before - after) / before * 100).toFixed(1)
    
    return {
      pass: improved,
      message: improved
        ? `✅ ${issue.metric} improved: ${reduction}% reduction`
        : `❌ ${issue.metric} not improved: ${reduction}% change`,
      metadata: { before, after, reduction }
    }
  }
}
```

**Memory leak example**: Would have shown memory still at 16GB after LRU cache attempt

---

## Metrics & Success Criteria

### Annotation Health
- **Avg annotations per component**: Target 3-5 (✅ bounded growth)
- **Avg tokens per component**: Target 1500-2500 (✅ efficient)
- **Annotation relevance score**: Target avg 0.7+ (✅ high quality)
- **Eviction rate**: Target <1 per week per component (✅ stable)

### Prompt Effectiveness
- **Success rate by prompt version**: Should increase over time (✅ learning)
- **Cost per successful fix**: Should decrease over time (✅ efficiency)
- **Prompt stability**: Fewer changes = converged (✅ maturity)

### Decomposition Quality
- **Avg components per decomposition**: Target 1-3 (✅ focused)
- **Decomposition accuracy**: Target 95%+ (✅ catches all impacted)
- **Activity success rate**: Target 80%+ (✅ effective breakdown)

### Association Learning
- **Edge weight convergence**: Variance should decrease (✅ stabilizing)
- **Context selection effectiveness**: Success rate with selected context (✅ optimal)
- **Graph density**: Should stabilize, not grow unbounded (✅ pruning works)

### Overall System Health
- **Fix success rate**: Target 85%+ on first attempt (vs. <20% before)
- **Code churn**: Target <100 lines per fix (vs. 17,000 before)
- **Learning rate**: New insights per fix (target 1-2 actionable insights)
- **Maintenance burden**: Lines of code added should be actively used

---

## Related Documents

- [ANNOTATION_DRIVEN_LEARNING_SYSTEM.md](./architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md) - Detailed architecture
- [INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md](./INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md) - Metabob integration
- [component-targeted-fix-with-learning.json](../templates/validation/component-targeted-fix-with-learning.json) - Activity template
- [bootstrap-annotation-learning-system.ts](../scripts/bootstrap-annotation-learning-system.ts) - Setup script

---

## Next Steps

1. **Bootstrap the system**:
   ```bash
   npm run bootstrap-learning-system ./repos/metabob-opencode
   ```

2. **Test on memory leak**:
   ```bash
   npm run test-learning-system -- \
     --task "Fix memory leak in session messages" \
     --repository ./repos/metabob-opencode
   ```

3. **Monitor learning**:
   ```bash
   npm run learning-dashboard
   ```

4. **Iterate based on metrics**:
   - Check annotation health
   - Verify prompt evolution
   - Validate decomposition accuracy
   - Tune association weights

---

**Status**: Superseded by Double-Blind Architecture (v3.0.0)  
**Estimated Effort**: 5 weeks (3 engineers)  
**ROI**: Prevent disasters like 17,000 lines of useless code  
**Dependencies**: Metabob MCP, Activity System, Storage Layer

**⚠️ Architecture Update**: This document describes the self-improving system but has been **superseded by the double-blind learning architecture** to eliminate agent bias. See:
- **[ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)** - Start here for current architecture
- **[FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md)** - Executive summary with implementation plan
