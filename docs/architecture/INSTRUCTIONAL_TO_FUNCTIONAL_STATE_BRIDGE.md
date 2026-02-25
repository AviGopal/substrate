# Instructional to Functional State Bridge: Clarified Architecture

> **Ontological Context**: This document discusses the bridge between Instructional and Functional states within the [three-state ontology model](./ONTOLOGY_OF_BECOMING.md). What we historically called "Functional State" and "Instructional State" map to **Instance** (actualized outcomes) and **Vessel** (templates/capacity) respectively. The "bridge" itself is the **Process of Becoming** - the continuous transformation that converts vessels into instances, which immediately become vessels for the next transformation. Understanding this ontology clarifies that OpenCode is a **vessel** through which this becoming manifests, not the system itself.

## Terminology Clarification

You're absolutely right - I was overcomplicating the terminology. Let me reframe with your correct definitions, now aligned with the three-state ontology:

### The Two States (Mapped to Ontology)

**Functional State = Instance** (The actual environment/data we're operating on)
- Codebase (files, git commits, branches)
- File system (directories, permissions)
- Runtime environment (processes, services)
- Database (tables, records)
- Or ANY data we're manipulating
- **Each instance immediately becomes a vessel for the next transformation**

**Instructional State = Vessel** (The context/knowledge guiding operations)
- What the user wants (intent, goals)
- What we know about the domain (patterns, best practices)
- What we've learned (successful recipes, failure patterns)
- Current context (impulses, annotations, metrics)
- **Provides the capacity and instructions for becoming**

### The Bridge: The Process-of-Becoming (LLM + Activities)

**The bridge is the process-of-becoming itself** - the continuous transformation from vessel to instance to vessel again.

**LLM Role** (Assists the becoming):
- Reads **Vessel** (Instructional State)
- Determines which **Instance** (Functional State) mutations to perform
- Decides the order of operations

**Activity Role** (Is itself a vessel):
- Structured recipe for **Instance** (Functional State) mutations
- Measured (we track success/failure/cost)
- Validatable (we can verify the outcome)
- Optimizable (based on measured behavior, not reasoning)
- **Contains instructions for becoming** - the activity template is a vessel

## The Real Architecture

### Current Flow (Ontologically Aligned)

```
User Intent (Vessel - Instructional State)
    ↓
  Process-of-Becoming: LLM interprets intent
    ↓
  Becoming: LLM decides which tool calls to make
    ↓
  Becoming: Tools mutate Instance (Functional State)
    ├── Write file (mutate codebase instance)
    ├── Git commit (mutate repo state instance)
    ├── Run script (mutate runtime state instance)
    └── Any tool call (mutate any data instance)
    ↓
  Instance (Functional State) updated
    ↓
  Instance immediately becomes Vessel for next transformation
```

### With Activities (Ontologically Aligned)

```
User Intent + Context (Vessel - Instructional State)
    ↓
  Activity Template (Vessel - structured recipe for becoming)
    ↓
  For each task in template:
    ├── Becoming: LLM reads Vessel (impulses, context)
    ├── Becoming: LLM decides which tool calls to make
    ├── Becoming: Tools mutate Instance (Functional State)
    └── Becoming: Measure outcome (success/failure/cost)
    ↓
  Instance (Functional State) updated
    ↓
  Instance becomes Vessel: Learning integrates outcome
    ↓
  Vessel evolves: Optimize recipe based on measurements
    ↓
  Continuous loop: Vessel → Becoming → Instance → Vessel (repeat)
```

**Key insight**: The activity system IS the process-of-becoming. OpenCode vessel provides the capacity; the activity execution is the continuous transformation.

## What We Already Have

### Functional State Management ✅

**Already exists**:
- File system operations (read, write, edit)
- Git operations (commit, branch, merge)
- Process execution (bash, scripts, tests)
- Data operations (any tool call)

**This IS functional state management!** We don't need to add anything new here.

### Instructional State Management ✅

**Already exists**:
- Impulses (context fragments)
- SessionMemory (aggregated context)
- Activity.impulses (activity-scoped context)
- Metabob context (code quality insights)
- User messages (intent)

**This IS instructional state!** The impulse system already manages this.

### The Bridge ✅

**Already exists**:
- LLM interprets instructional state → decides tool calls
- Activities structure sequences of mutations
- Metrics track success/failure/cost
- Trailblazing creates variants on failure

**This IS the bridge!** We already have the core infrastructure.

## What's Missing: Optimization Based on Measurement

Your key insight:
> "Our goal is to optimize these based on measured behavior, and not from LLM or human reasoning."

**This is the gap!** We have:
- ✅ Structured recipes (activities)
- ✅ Measurements (success rate, cost, duration)
- ✅ Validation (pre/post checks)
- ❌ **Optimization based on measurements** ← MISSING

Currently:
- Templates are created by humans/LLMs
- Trailblazing creates variants reactively (when failure occurs)
- Variants are NOT automatically promoted based on success rates

**Needed**:
- Analyze measured outcomes systematically
- Identify which variants succeed more often
- Promote successful variants automatically
- Deprecate failing variants automatically
- No human/LLM reasoning - purely data-driven

## The Learning Loop (Currently Missing)

### What We Have Now

```
Execute Activity
    ↓
  Measure outcome
    ↓
  Store metrics in backend
    ↓
  [STOP] ← No feedback loop!
```

### What We Need

```
Execute Activity
    ↓
  Measure outcome
    ↓
  Store metrics in backend
    ↓
  Analyze patterns (which variants succeed?)
    ↓
  Update template selection logic
    ↓
  Promote successful variants
    ↓
  [LOOP] Use better templates next time
```

## Concrete Example: File Editing

### Functional State
```typescript
// The codebase (functional state we're mutating)
const codebase = {
  "src/server.ts": "...",
  "src/client.ts": "...",
  "package.json": "..."
}
```

### Instructional State
```typescript
// Context guiding the operation (instructional state)
const impulses = {
  "user-intent": {
    content: "Add authentication to the API",
    type: "requirement"
  },
  "existing-patterns": {
    content: "Project uses JWT tokens, stored in Redis",
    type: "pattern"
  },
  "metabob-priorities": {
    content: "Fix 3 security issues in auth module first",
    type: "priority"
  }
}
```

### Activity: Add Authentication

```typescript
const addAuthActivity = {
  id: "add-authentication",
  tasks: [
    {
      description: "Analyze current auth implementation",
      impulseReferences: ["user-intent", "existing-patterns", "metabob-priorities"],
      // LLM reads instructional state, decides which files to read
      // Tools mutate functional state: file reads (no mutation yet)
    },
    {
      description: "Implement JWT middleware",
      // LLM decides: write to src/middleware/auth.ts
      // Tools mutate functional state: write file, add imports
    },
    {
      description: "Add auth routes",
      // LLM decides: edit src/routes/index.ts
      // Tools mutate functional state: edit file
    },
    {
      description: "Run tests",
      // Tools mutate functional state: execute test command
    }
  ],
  
  // Validation checks functional state
  validation: {
    postChecks: [
      "file exists: src/middleware/auth.ts",
      "tests pass: npm test"
    ]
  },
  
  // Measurements (tracked automatically)
  metrics: {
    successRate: 0.87,  // 87% of executions succeed
    avgCost: 0.23,      // $0.23 per execution
    avgDuration: 45000  // 45 seconds
  }
}
```

### Learning: Variant Evolution

**Scenario**: Activity fails 13% of the time

**Current** (reactive):
1. Execution fails
2. Trailblazing kicks in
3. LLM generates recovery prompt
4. Retry succeeds
5. Create variant with recovery logic
6. Variant stored but not automatically used

**Needed** (proactive):
1. Analyze failure patterns across 100 executions
2. Identify common failure: "Missing Redis connection"
3. Generate variant that checks Redis first
4. Test variant in sandbox (not production)
5. Measure variant success rate: 98%
6. **Automatically promote variant** as new canonical template
7. Deprecate original (87% success) template

**Key**: Optimization happens from measurements, not LLM reasoning!

## The Optimization Engine (What's Missing)

### Current State
```
Backend (Metabob):
  - Stores execution results
  - Tracks metrics per template
  - Provides search/query API
  
Frontend (OpenCode):
  - Executes activities
  - Reports results to backend
  - Searches templates by success rate
  
❌ No automatic optimization loop
```

### Needed State
```
Backend (Metabob):
  - Stores execution results
  - Tracks metrics per template
  - Analyzes patterns
  - Generates optimization recommendations
  
Frontend (OpenCode):
  - Executes activities
  - Reports results to backend
  - Searches templates by success rate
  - Receives optimization recommendations
  - Applies optimizations automatically
  
✅ Closed-loop optimization
```

### The Optimization Algorithm

```typescript
// Backend: Analyze execution patterns
async function analyzeTemplatePerformance(
  templateId: string
): Promise<OptimizationRecommendation> {
  const executions = await getRecentExecutions(templateId, limit: 100)
  
  // Find patterns in failures
  const failures = executions.filter(e => !e.success)
  const failurePatterns = clusterByError(failures)
  
  // Find patterns in successes
  const successes = executions.filter(e => e.success)
  const successPatterns = clusterByContext(successes)
  
  // Compare variants
  const variants = await getTemplateVariants(templateId)
  const variantMetrics = variants.map(v => ({
    id: v.id,
    successRate: calculateSuccessRate(v),
    contexts: getSuccessfulContexts(v)
  }))
  
  // Find best variant per context
  const recommendations = variantMetrics
    .filter(v => v.successRate > baseTemplate.successRate + 0.05)  // 5% improvement
    .map(v => ({
      action: "promote",
      variantId: v.id,
      reason: `${v.successRate * 100}% success rate in contexts: ${v.contexts}`,
      confidence: calculateConfidence(v, executions.length)
    }))
  
  return {
    templateId,
    recommendations,
    analysisDate: Date.now()
  }
}
```

### Frontend: Apply Optimization

```typescript
// Frontend: Receive and apply recommendations
async function applyOptimization(
  recommendation: OptimizationRecommendation
): Promise<void> {
  if (recommendation.action === "promote" && recommendation.confidence > 0.8) {
    // Load variant
    const variant = await getTemplate(recommendation.variantId)
    
    // Test in sandbox
    const sandboxResults = await testInSandbox(variant, iterations: 10)
    
    // If sandbox confirms improvement, promote
    if (sandboxResults.successRate > baseTemplate.successRate + 0.05) {
      await promoteVariant(recommendation.variantId)
      
      log.info("promoted variant based on measurements", {
        baseSuccessRate: baseTemplate.successRate,
        variantSuccessRate: sandboxResults.successRate,
        improvement: sandboxResults.successRate - baseTemplate.successRate,
        source: "data-driven optimization (no human reasoning)"
      })
    }
  }
}
```

## Alignment with Your Vision

### What You Said

> "Functional state is just the conventional software portion of environment. We already have functional state being managed - the codebase itself, but it could be any data."

**✅ Correct!** Functional state = whatever we're mutating (codebase, database, any data).

> "The LLM takes instructional state and makes determinations on which functional state mutations to perform and in which order."

**✅ Correct!** LLM bridges instructional state → functional state mutations.

> "Activities are structured, measured, and validatable recipes for sequences of state mutations."

**✅ Correct!** Activities = recipes for mutations with validation.

> "Our goal is to optimize these based on measured behavior, and not from LLM or human reasoning."

**✅ The gap!** This optimization loop doesn't exist yet.

## What's Already Working

### 1. Functional State Operations ✅
```typescript
// Tools that mutate functional state (codebase)
await edit({ filePath: "src/server.ts", oldString: "...", newString: "..." })
await bash({ command: "git commit -m 'Add feature'" })
await write({ filePath: "src/new.ts", content: "..." })
```

**Already works!** Tools mutate functional state (codebase, git, processes, any data).

### 2. Instructional State Management ✅
```typescript
// Impulses provide context (instructional state)
await impulse_create({
  id: "user-requirement",
  pointer: { type: "memo", content: "Add auth to API" },
  budget: 2000
})

// LLM reads impulses when making decisions
const context = await loadImpulses(["user-requirement", "existing-patterns"])
```

**Already works!** Impulse system manages instructional state.

### 3. Structured Recipes ✅
```typescript
// Activities structure mutation sequences
const activity = {
  tasks: [
    { description: "Read current code", impulseReferences: ["codebase-structure"] },
    { description: "Implement feature", impulseReferences: ["user-requirement"] },
    { description: "Run tests" }
  ],
  validation: {
    postChecks: ["tests pass"]
  }
}
```

**Already works!** Activity templates structure operations.

### 4. Measurements ✅
```typescript
// Backend tracks execution outcomes
await reportExecutionResult({
  activityId: "add-auth",
  success: true,
  duration: 45000,
  cost: 0.23,
  tokens: 12500
})

// Can query success rates
const metrics = await searchActivities({ category: "feature" })
// Returns: { id: "add-auth", successRate: 0.87, avgCost: 0.23 }
```

**Already works!** Backend stores and aggregates metrics.

### 5. Variant Creation ✅
```typescript
// Trailblazing creates variants on failure
if (!result.success && trailblazingEnabled) {
  const variant = await createVariantFromRecovery(
    baseTemplate,
    recoveryAttempts
  )
  await registerTemplate(variant)
}
```

**Already works!** Trailblazing creates variants reactively.

## What's Missing: The Optimization Loop

### Gap 1: Pattern Analysis ❌

**Need**: Analyze execution patterns to find optimization opportunities

```typescript
// Doesn't exist yet
async function analyzeExecutionPatterns(templateId: string): Promise<Insights> {
  const executions = await getExecutions(templateId, limit: 1000)
  
  return {
    failurePatterns: clusterFailures(executions),
    successContexts: identifySuccessContexts(executions),
    variantComparison: compareVariants(executions),
    recommendations: generateRecommendations(executions)
  }
}
```

**Status**: ❌ Backend has data but no analysis engine

### Gap 2: Automatic Variant Promotion ❌

**Need**: Promote variants based on success rate data

```typescript
// Doesn't exist yet
async function promoteVariantIfBetter(
  baseTemplateId: string,
  variantId: string
): Promise<boolean> {
  const baseMetrics = await getTemplateMetrics(baseTemplateId)
  const variantMetrics = await getTemplateMetrics(variantId)
  
  if (variantMetrics.successRate > baseMetrics.successRate + 0.05) {
    await promoteVariant(variantId)  // Make variant the canonical template
    await deprecateTemplate(baseTemplateId)
    return true
  }
  
  return false
}
```

**Status**: ❌ Variant promotion is manual, not data-driven

### Gap 3: Continuous Learning Pipeline ❌

**Need**: Background process that continuously optimizes templates

```typescript
// Doesn't exist yet
async function optimizationDaemon(): Promise<void> {
  while (true) {
    // Find templates with poor performance
    const templates = await findTemplatesNeedingOptimization({
      minExecutions: 100,
      successRateBelow: 0.90,
      hasVariants: true
    })
    
    for (const template of templates) {
      // Analyze patterns
      const insights = await analyzeExecutionPatterns(template.id)
      
      // Find better variants
      const betterVariants = insights.variantComparison
        .filter(v => v.successRate > template.successRate + 0.05)
      
      // Test in sandbox
      for (const variant of betterVariants) {
        const sandboxResults = await testInSandbox(variant.id)
        
        if (sandboxResults.confirm) {
          await promoteVariantIfBetter(template.id, variant.id)
        }
      }
    }
    
    await sleep(24 * 60 * 60 * 1000)  // Run daily
  }
}
```

**Status**: ❌ No continuous optimization pipeline

### Gap 4: Context-Aware Template Selection ❌

**Need**: Select template variant based on current context

```typescript
// Doesn't exist yet (search returns best overall, not best for context)
async function selectOptimalTemplate(
  taskDescription: string,
  currentContext: InstructionalState
): Promise<Template> {
  // Analyze current context
  const contextFeatures = extractFeatures(currentContext)
  
  // Find templates that match task
  const candidates = await searchActivities({ query: taskDescription })
  
  // For each candidate, find which variant works best in this context
  const scoredCandidates = await Promise.all(
    candidates.map(async (template) => {
      const variants = await getTemplateVariants(template.id)
      
      // Find variant with highest success rate in similar contexts
      const bestVariant = variants
        .map(v => ({
          variant: v,
          score: calculateContextSimilarity(v.successfulContexts, contextFeatures)
        }))
        .sort((a, b) => b.score - a.score)
        [0]
      
      return {
        template: bestVariant.variant,
        contextScore: bestVariant.score
      }
    })
  )
  
  // Return best match for current context
  return scoredCandidates.sort((a, b) => b.contextScore - a.contextScore)[0].template
}
```

**Status**: ❌ Template selection is global, not context-aware

## Implementation Plan: Close the Loop

### Phase 1: Pattern Analysis (1-2 months)

**Goal**: Understand which templates/variants work in which contexts

**Backend changes**:
```typescript
// Add analysis endpoints
POST /api/templates/{id}/analyze
  → Returns: failure patterns, success contexts, variant comparison

GET /api/templates/{id}/recommendations
  → Returns: optimization recommendations based on measurements
```

**Implementation**:
1. Cluster failures by error message/context
2. Cluster successes by context features
3. Compare variant metrics
4. Generate data-driven recommendations

### Phase 2: Variant Promotion (2-3 months)

**Goal**: Automatically promote successful variants

**Backend changes**:
```typescript
// Add promotion logic
POST /api/templates/{baseId}/promote-variant
  body: { variantId, reason, confidence }
  → Marks variant as canonical, deprecates base

GET /api/templates/{id}/variants/best
  query: { context }
  → Returns best variant for given context
```

**Frontend changes**:
```typescript
// Before executing activity
const optimal = await getOptimalVariant(templateId, currentContext)
await executeActivity(optimal)  // Use best variant, not base template
```

### Phase 3: Continuous Optimization (3-4 months)

**Goal**: Background process that continuously improves templates

**Backend service**:
```typescript
// New service: template-optimizer
class TemplateOptimizer {
  async run() {
    while (true) {
      await this.optimizationCycle()
      await sleep(24 * 60 * 60 * 1000)  // Daily
    }
  }
  
  async optimizationCycle() {
    // Find templates needing optimization
    const candidates = await this.findCandidates()
    
    // Analyze patterns
    const insights = await Promise.all(
      candidates.map(t => this.analyze(t.id))
    )
    
    // Test promising variants in sandbox
    const promotions = await this.testVariants(insights)
    
    // Apply optimizations
    await this.applyPromotions(promotions)
    
    // Log results
    log.info("optimization cycle complete", {
      templatesAnalyzed: candidates.length,
      variantsPromoted: promotions.length
    })
  }
}
```

### Phase 4: Context-Aware Selection (4-6 months)

**Goal**: Select best variant for current context

**Frontend changes**:
```typescript
// Enhanced activity search
const template = await searchActivities({
  query: "add authentication",
  context: {
    projectType: "Express.js API",
    existingAuth: false,
    database: "PostgreSQL"
  }
})

// Returns variant that succeeds most in similar contexts
// Not just globally best template
```

## Success Metrics

### Current State
- ✅ Template success rates tracked
- ✅ Variants created on failure
- ❌ Variants not automatically promoted
- ❌ No pattern analysis
- ❌ No context-aware selection

### Target State (6 months)
- ✅ Template success rates tracked
- ✅ Variants created on failure
- ✅ Variants automatically promoted based on data
- ✅ Pattern analysis identifies optimization opportunities
- ✅ Context-aware variant selection

### Key Metrics
1. **Variant Promotion Rate**: # variants promoted per week (target: 5-10)
2. **Success Rate Improvement**: Avg improvement after promotion (target: +10%)
3. **Automation %**: % of optimizations that are automatic vs manual (target: >80%)
4. **Context Match Accuracy**: How often selected variant is optimal (target: >85%)

## The Core Insight

You nailed it:

> "The LLM takes instructional state and makes determinations on which functional state mutations to perform and in which order."

**This is the correct mental model!**

We have:
- ✅ Functional State (codebase/data we're mutating)
- ✅ Instructional State (impulses/context guiding operations)
- ✅ Bridge (LLM + tools + activities)
- ✅ Measurements (success/failure/cost tracking)
- ❌ **Optimization based on measurements** ← The gap

**The optimization loop is what's missing**, not functional state management (which already works via tools/activities).

## Next Steps

To close the loop, we need to:

1. **Add pattern analysis** (backend)
   - Cluster failures by cause
   - Identify success contexts
   - Compare variant performance

2. **Add variant promotion** (backend + frontend)
   - Promote variants with >5% success rate improvement
   - Deprecate underperforming templates
   - Track promotion history

3. **Add optimization daemon** (backend service)
   - Run daily analysis
   - Test promising variants
   - Apply promotions automatically

4. **Add context-aware selection** (frontend)
   - Extract context features from current state
   - Select variant that works best in similar contexts
   - Fallback to global best if no match

**Priority**: Start with #1 (pattern analysis) - it provides the foundation for everything else.

**Timeline**: 6 months to close the loop completely.

Does this align with your understanding? Should we start implementing Phase 1 (pattern analysis)?
