# System Tools and Learning Loop Architecture

**Date**: February 17, 2026  
**Purpose**: Document what tools exist, how they interact, and what the learning loop actually is

---

## Part 1: What Tools Do We Have?

### Core Tool Inventory (49 tools)

#### **Activity System Tools** (8 tools)
| Tool | Purpose | Learning Loop Role |
|------|---------|-------------------|
| `activity` | Execute activity templates | Records execution results → updates metrics |
| `activity-replay` | Re-execute failed activities | Retry mechanism for learning |
| `activity-error-inspector` | Inspect failed executions | Debugging for improvement |
| `search-activities` | Find templates | Discovery for template selection |
| `get-activity-template` | Retrieve specific template | Template loading |
| `list-activity-templates` | List all templates | Template discovery |
| `register-activity-template` | Add new template | Template evolution (new variants) |
| `post-activity-result` | Record execution metrics | **LEARNING LOOP CLOSURE** |

#### **File Operation Tools** (6 tools)
- `read`, `write`, `edit`, `multiedit`, `patch`, `ls`
- Purpose: File manipulation (used by agents during activity execution)

#### **Search Tools** (3 tools)
- `grep`, `glob`, `codesearch`
- Purpose: Code navigation and search

#### **Execution Tools** (3 tools)
- `bash`, `remote-bash`, `remote-sync`
- Purpose: Command execution and remote operations

#### **Metabob Integration Tools** (6 from MCP)
- `metabob_search_codebase_issues`
- `metabob_mark_problem_complete`
- `metabob_annotate_component`
- `metabob_analyze_change_impact`
- `metabob_list_file_components`
- `metabob_assess_deletion_safety`
- `metabob_suggest_related_changes`
- Purpose: Code quality analysis and annotation

#### **Impulse System Tools** (5 tools)
- `impulse-create`, `impulse-load`, `impulse-update`, `impulse-delete`, `impulse-list`
- Purpose: Context management for activities

#### **ACP (Agent Communication) Tools** (2 tools)
- `acp-delegate`, `acp-request-impulse-content`
- Purpose: Multi-agent coordination

#### **Development Tools** (16 tools)
- Memory: `memory-optimize`, `memory-budget`, `memory-health`, `memory-outline`
- LSP: `lsp-diagnostics`, `lsp-hover`
- Other: `todo`, `snippet`, `webfetch`, `websearch`, `signature`, `inspect-llm-request`, `test-metabob-mcp`

---

## Part 2: How Do Tools Interact?

### The Activity Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INVOKES ACTIVITY                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. activity tool → TemplateRepository.get()                │
│     - Query cache → Metabob → Local (bootstrap)             │
│     - Load template with metrics (success rate, cost, etc)  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Pre-flight Checks                                        │
│     - Git working tree clean?                                │
│     - Template validation passed?                            │
│     - Memory agent available?                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Activity Initialization                                  │
│     - Create branch (activity-execution)                     │
│     - Create activity storage record                         │
│     - Initialize metrics tracking                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Task Execution Loop                                      │
│     For each task:                                           │
│       - Load impulses (if referenced)                        │
│       - Spawn agent session                                  │
│       - Execute task prompt                                  │
│       - Agent uses tools (read, write, bash, etc)            │
│       - Run validation commands                              │
│       - Record task metrics                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Activity Completion                                      │
│     - Mark status: "done" or "failed"                        │
│     - Save activity storage record                           │
│     - Calculate total metrics                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Learning Loop Closure (AUTOMATIC)                        │
│     - TemplateRepository.updateMetrics()                     │
│     - Update success rate (running average)                  │
│     - Update average cost (running average)                  │
│     - Update average duration (running average)              │
│     - Update average tokens (running average)                │
│     - Increment execution count                              │
│     - Save to Metabob backend                                │
│     - Save to local storage                                  │
│     - Invalidate template cache                              │
└─────────────────────────────────────────────────────────────┘
```

### Tool Interaction Patterns

#### Pattern 1: Activity → Template Repository → Template Loader

```typescript
// Activity tool calls TemplateRepository
const template = await TemplateRepository.get(templateId, "all")

// TemplateRepository delegates to TemplateLoader
const result = await TemplateLoader.load(templateId, { backend: "auto" })

// TemplateLoader checks cache first, then backends
// Cache → Metabob → Local (bootstrap)
```

#### Pattern 2: Activity → Agent → Sub-tools

```typescript
// Activity spawns agent session for each task
const sessionID = await Session.create({
  agent: task.agent,
  prompt: renderedPrompt
})

// Agent uses tools during execution
// Agent calls: read, write, bash, grep, etc.
// These tools don't know they're in an activity context
```

#### Pattern 3: Activity → Validation → Commands

```typescript
// After task execution, run validation
await runValidationCommands(task.validation.commands, task.id)

// This spawns bash commands
for (const cmd of commands) {
  const proc = Bun.spawn(["sh", "-c", cmd.command])
  const exitCode = await proc.exited
  if (exitCode !== 0) throw new Error("Validation failed")
}
```

#### Pattern 4: Activity → Metrics Update (Learning Loop)

```typescript
// After activity completes, update template metrics
await TemplateRepository.updateMetrics(template.id, {
  executions: newExecutions,
  successRate: runningAverage(old, new, count),
  avgDuration: runningAverage(old, new, count),
  avgCost: runningAverage(old, new, count),
  avgTokens: runningAverage(old, new, count)
})

// This updates:
// 1. Metabob backend (via TemplateLoader)
// 2. Local storage (via TemplateLoader)
// 3. Template cache (invalidated)
```

---

## Part 3: The Learning Loop (What Actually Exists)

### Definition: What IS the Learning Loop?

**The learning loop is**: The system's ability to track activity execution results and use that data to improve future executions.

**Current Implementation Status**: ⚠️ **PARTIALLY IMPLEMENTED**

### Learning Loop Components

#### ✅ Component 1: Metric Collection (EXISTS)

**Where**: `activity.ts` (lines 1000-1020)
**What it does**:
```typescript
// After activity completes:
activity.stats.duration = completedAt - startedAt
activity.stats.tokens.input = totalTokens.input
activity.stats.tokens.output = totalTokens.output
activity.stats.tokens.cache.read = totalTokens.cache
activity.stats.cost.total = totalCost
activity.status = result.success ? "done" : "failed"
await Activity.save(activity)
```

**Evidence**: ✅ Our ground truth activity has metrics:
```json
{
  "stats": {
    "tokens": { "input": 31337, "output": 46 },
    "cost": { "total": 0.0950835 },
    "duration": 16278
  },
  "status": "done"
}
```

#### ✅ Component 2: Metric Aggregation (EXISTS)

**Where**: `activity.ts` (lines 1022-1030)
**What it does**:
```typescript
// Update template metrics with running averages
await TemplateRepository.updateMetrics(template.id, {
  executions: newExecutions,
  successRate: old + ((new ? 1 : 0) - old) / count,  // Running average
  avgDuration: old + (new - old) / count,             // Running average
  avgCost: old + (new - old) / count,                 // Running average
  avgTokens: { /* same pattern */ }
})
```

**Evidence**: ✅ Template metrics from search show this working:
```
ultra-simple-test:
  Success Rate: 100% (3 executions)
  Avg Cost: $0.0973
  Avg Duration: 24.2s
```

#### ✅ Component 3: Metric Storage (EXISTS)

**Where**: `TemplateRepository.updateMetrics()` → `TemplateLoader.updateMetrics()`
**What it does**:
- Updates Metabob backend (via gRPC/HTTP)
- Updates local storage (file system)
- Invalidates template cache

**Evidence**: ✅ Templates have historical metrics that persist across sessions

#### ⚠️ Component 4: Metric Usage for Selection (PARTIAL)

**Where**: `search-activities` tool shows metrics
**What it does**: Displays success rates, costs, durations to users
**What it DOESN'T do**: Automatically select best template variant

**Gap**: No Thompson Sampling implementation found in OpenCode
- Templates have metrics ✅
- Metrics are displayed ✅
- **Metrics don't drive automatic variant selection** ❌

#### ❌ Component 5: Variant Creation (MISSING)

**Where**: Should be in trailblazing system
**What it should do**: Create template variants when trailblazing succeeds
**What actually happens**: Unknown

**Evidence of Design**:
```typescript
// From template-genealogy.ts
enum EvolutionReason {
  SUCCESS = "EVOLUTION_REASON_SUCCESS",
  FAILURE_RECOVERY = "EVOLUTION_REASON_FAILURE_RECOVERY",
  OPTIMIZATION = "EVOLUTION_REASON_OPTIMIZATION",
  MANUAL = "EVOLUTION_REASON_MANUAL"
}

interface TemplateGenealogy {
  parent_id: string
  variant_hash: string
  generation: number
  evolution: TemplateEvolution
  variant_ids: string[]  // Child variants
}
```

**Gap**: Infrastructure exists, but automatic variant creation not wired up

#### ❌ Component 6: Thompson Sampling Selection (MISSING)

**Expected**: When multiple variants exist, use Thompson Sampling to select
**Reality**: No code found that implements Thompson Sampling in OpenCode

**Backend has it**: Python backend has Thompson Sampling (from metabob-proto):
```python
# From metabob-proto/metabob/activity/variant_pb2.py
# Variant selection with alpha/beta for Thompson Sampling
```

**Gap**: Backend has Thompson Sampling, but OpenCode doesn't call it

---

## Part 4: How Is the Learning Loop Enforced?

### Automatic Enforcement (What Happens Without User Action)

#### ✅ **Always Happens**: Metric Collection

**Enforcement Point**: End of `activity.ts` execution
```typescript
// This ALWAYS runs if activity completes
activity.completedAt = Date.now()
activity.stats.duration = completedAt - startedAt
activity.stats.cost.total = totalCost
await Activity.save(activity)
```

**Enforcement**: Built into activity execution flow, cannot be skipped

#### ✅ **Always Happens**: Metric Aggregation

**Enforcement Point**: After activity save
```typescript
// This ALWAYS runs after metrics are collected
await TemplateRepository.updateMetrics(template.id, {
  executions: newExecutions,
  successRate: runningAverage(...),
  avgDuration: runningAverage(...),
  avgCost: runningAverage(...)
})
```

**Enforcement**: Built into activity execution flow, automatic

#### ✅ **Always Happens**: Metric Storage

**Enforcement Point**: Inside `TemplateRepository.updateMetrics()`
```typescript
// This ALWAYS runs when updateMetrics is called
await TemplateLoader.updateMetrics(id, metrics)
// → Updates Metabob backend
// → Updates local storage
// → Invalidates cache
```

**Enforcement**: Built into template repository, cannot be skipped

### Manual/Optional Parts (What Requires User Action)

#### ⚠️ **Manual**: Variant Creation

**Current State**: No automatic variant creation
**Requires**: Manual template creation or unknown trigger

**Expected Flow** (not implemented):
```typescript
// After trailblazing succeeds
if (trailblazingSucceeded) {
  const newVariant = await createTemplateVariant({
    parentId: template.id,
    reason: EvolutionReason.FAILURE_RECOVERY,
    basedOnExecution: activity.id,
    improvised: true
  })
  await TemplateRepository.save(newVariant)
}
```

#### ❌ **Missing**: Thompson Sampling Selection

**Current State**: No automatic variant selection
**Requires**: Backend integration not implemented in OpenCode

**Expected Flow** (not implemented):
```typescript
// Before loading template
const variants = await getTemplateVariants(baseTemplateId)
if (variants.length > 1) {
  const selected = await thompsonSamplingSelect(variants)
  return selected
}
```

---

## Part 5: What's Actually Missing?

### Gap Analysis

#### ✅ **Working**: Basic Learning Loop
- Metrics collected ✅
- Metrics aggregated (running averages) ✅
- Metrics stored (Metabob + local) ✅
- Metrics displayed (search results) ✅

#### ⚠️ **Partial**: Variant Management
- Genealogy infrastructure exists ✅
- Template evolution types defined ✅
- Parent-child tracking implemented ✅
- **Automatic variant creation missing** ❌

#### ❌ **Missing**: Advanced Learning
- Thompson Sampling selection ❌
- Variant performance comparison ❌
- Automatic template optimization ❌
- Learning-driven template evolution ❌

### The "Learning Loop" That Actually Exists

**What works**:
```
Execute Activity → Collect Metrics → Update Template Stats → Store → Display
```

**What's missing**:
```
Compare Variants → Select Best → Create New Variants → Evolve Templates
```

### Specific Missing Pieces

#### 1. Trailblazing → Variant Creation

**Status**: Infrastructure exists, wiring missing

**What we have**:
- `trailblazing-executor.ts` - Executes recovery attempts
- `template-genealogy.ts` - Tracks evolution
- `template-version.ts` - Manages versions

**What's missing**:
- Automatic variant creation after successful trailblazing
- Variant registration in repository
- Parent-child linking

**Where to implement**:
```typescript
// In trailblazing-executor.ts after success
if (recoverySucceeded) {
  // Create variant
  const variant = createVariantFromRecovery(template, recovery)
  
  // Register with repository
  await TemplateRepository.save(variant)
  
  // Link to parent
  await linkVariantToParent(template.id, variant.id)
}
```

#### 2. Thompson Sampling Selection

**Status**: Backend has it, OpenCode doesn't use it

**What we have**:
- Backend gRPC endpoint for variant selection
- Proto definitions for Thompson Sampling
- Metrics (alpha/beta) tracked in backend

**What's missing**:
- OpenCode call to backend variant selection
- Integration in template loading
- Fallback to default when no variants

**Where to implement**:
```typescript
// In template-loader.ts before loading template
async function loadWithVariantSelection(id: string) {
  const variants = await backend.getVariants(id)
  
  if (variants.length > 1) {
    const selected = await backend.thompsonSamplingSelect(variants)
    return await load(selected.id)
  }
  
  return await load(id)
}
```

#### 3. Variant Performance Tracking

**Status**: Metrics tracked per template, not per variant

**What we have**:
- Template-level metrics ✅
- Execution history ✅

**What's missing**:
- Variant-specific metrics
- Variant comparison UI
- Variant performance trends

**Where to implement**:
```typescript
// In activity.ts after completion
await TemplateRepository.updateVariantMetrics(
  template.id,
  template.variantHash,  // Track by variant
  metrics
)
```

---

## Part 6: The Learning Loop Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                   LEARNING LOOP (Current State)                  │
└──────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │  User Invokes   │
                    │    Activity     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Load Template   │
                    │ (with metrics)  │
                    └────────┬────────┘
                             │
                 ┌───────────▼──────────┐
                 │   Execute Activity   │
                 │  (tasks, validation) │
                 └───────────┬──────────┘
                             │
              ┌──────────────▼─────────────┐
              │   Collect Metrics          │
              │   - Duration               │
              │   - Cost                   │
              │   - Tokens                 │
              │   - Success/Failure        │
              └──────────────┬─────────────┘
                             │
                   ┌─────────▼─────────┐
                   │  Update Template  │
                   │  Metrics          │
                   │  (running avg)    │
                   └─────────┬─────────┘
                             │
            ┌────────────────▼────────────────┐
            │    Store Metrics                │
            │    - Metabob Backend            │
            │    - Local Storage              │
            │    - Invalidate Cache           │
            └────────────────┬────────────────┘
                             │
                      ┌──────▼──────┐
                      │  Metrics    │
                      │  Available  │
                      │  for Next   │
                      │  Execution  │
                      └─────────────┘

┌──────────────────────────────────────────────────────────────────┐
│             MISSING: Advanced Learning Components                │
└──────────────────────────────────────────────────────────────────┘

    ❌ Variant Creation          ❌ Thompson Sampling
    (from trailblazing)         (variant selection)

                                ❌ Variant Comparison
                                (performance analysis)

                                ❌ Template Evolution
                                (automatic optimization)
```

---

## Part 7: Tool Interaction Matrix

### Which Tools Call Which?

```
activity
├─→ TemplateRepository.get()          [Load template]
├─→ ActivityGit.createBranch()         [Git operations]
├─→ Session.create()                   [Spawn agent]
│   └─→ Agent uses: read, write, bash, grep, etc.
├─→ runValidationCommands()            [Validate output]
├─→ TemplateRepository.updateMetrics() [Learning loop]
└─→ Activity.save()                    [Persist results]

activity-replay
├─→ Activity.load()                    [Load failed activity]
├─→ TemplateRepository.get()          [Get template]
└─→ [Same as activity after this]

activity-error-inspector
├─→ Activity.load()                    [Load activity]
├─→ Session.messages()                 [Get conversation]
└─→ Returns: errors, logs, context

search-activities
├─→ TemplateRepository.list()         [List templates]
└─→ Returns: templates with metrics

register-activity-template
├─→ TemplateRepository.save()         [Save template]
└─→ Stores: Metabob + Local

post-activity-result (Manual Tool)
└─→ TemplateRepository.updateMetrics() [Manual metric update]
```

### Tool Dependencies

```
Activity Tool Dependencies:
  ├─ TemplateRepository (template operations)
  ├─ ActivityGit (git operations)
  ├─ Session (agent spawning)
  ├─ Activity (storage operations)
  ├─ ImpulseResolver (load impulses)
  └─ MetabobCLI (metabob integration)

TemplateRepository Dependencies:
  ├─ TemplateLoader (backend abstraction)
  └─ TemplateCache (performance)

TemplateLoader Dependencies:
  ├─ TemplateCache (cache layer)
  ├─ Metabob gRPC client (backend)
  └─ Storage (local persistence)

Activity Dependencies:
  └─ Storage (file system persistence)

Session Dependencies:
  ├─ Agent (LLM integration)
  └─ ToolRegistry (tool execution)
```

---

## Part 8: Learning Loop Enforcement Mechanisms

### Automatic (Cannot Be Skipped)

1. **Metric Collection**
   - When: Activity completes
   - Where: `activity.ts` line ~1000
   - Enforcement: Built into execution flow

2. **Metric Aggregation**
   - When: After metric collection
   - Where: `activity.ts` line ~1022
   - Enforcement: Automatic after save

3. **Metric Storage**
   - When: Metrics are updated
   - Where: `TemplateRepository.updateMetrics()`
   - Enforcement: Transactional (all-or-nothing)

### Semi-Automatic (Happens If Conditions Met)

4. **Cache Invalidation**
   - When: Metrics updated
   - Where: `TemplateLoader.updateMetrics()`
   - Enforcement: Automatic cleanup

### Manual (User Must Trigger)

5. **Variant Creation**
   - When: User manually creates template
   - Where: `register-activity-template` tool
   - Enforcement: None (user initiated)

### Missing (Not Enforced At All)

6. **Thompson Sampling Selection**
   - When: Should happen on template load
   - Where: Not implemented
   - Enforcement: N/A

7. **Automatic Template Evolution**
   - When: Should happen after N executions
   - Where: Not implemented
   - Enforcement: N/A

---

## Part 9: What Gets Tracked vs. What Doesn't

### ✅ Tracked Automatically

| Metric | Where Stored | Used For |
|--------|--------------|----------|
| Execution count | Template record | Success rate calculation |
| Success/Failure | Template record | Success rate (running avg) |
| Duration (ms) | Template record | Average duration |
| Cost ($) | Template record | Average cost |
| Tokens (in/out/cache) | Template record | Average tokens |
| Start time | Activity record | Timing analysis |
| End time | Activity record | Duration calculation |
| Template ID | Activity record | Linking to template |
| Template version | Activity record | Versioning |

### ⚠️ Partially Tracked

| Metric | Status | Gap |
|--------|--------|-----|
| Session IDs | Stored but empty | Not populated in our test |
| Commits | Stored but empty | Not populated in our test |
| Agents used | Stored but empty | Not populated in our test |
| Tool calls | Not stored | No record of what tools were used |
| Validation results | Not stored | Don't know what passed/failed |

### ❌ Not Tracked At All

| Missing Metric | Why It Matters |
|----------------|----------------|
| Work evidence | Can't prove activity did anything |
| File changes | Can't see what was modified |
| Before/after snapshots | Can't verify correctness |
| Validation execution details | Can't debug validation failures |
| Agent reasoning | Can't see why decisions were made |
| Variant selection rationale | Don't know why variant was chosen |
| Trailblazing attempts | Don't track recovery efforts |

---

## Part 10: Summary

### What We Have

**Basic Learning Loop** ✅:
- Automatic metric collection
- Running average calculation
- Multi-backend storage (Metabob + local)
- Metric display in search results
- Template versioning infrastructure
- Genealogy tracking infrastructure

### What We're Missing

**Advanced Learning** ❌:
- Thompson Sampling variant selection
- Automatic variant creation from trailblazing
- Variant performance comparison
- Template evolution triggers
- Learning-driven optimization

**Correctness Validation** ❌ (The Real Problem):
- Work evidence tracking
- Before/after snapshots
- Validation execution logging
- Session activity recording
- Tool call tracking
- Behavioral verification

### The Actual Problem

**The learning loop works** (collects and stores metrics)

**But it doesn't matter** because:
1. We can't verify activities did the right thing
2. Metrics only track completion, not correctness
3. Success rate includes silent failures
4. No evidence of actual work performed

### What to Build Next

**Priority 1**: Correctness Validation (from earlier docs)
- Session tracking
- Work evidence collection
- Validation logging
- Before/after snapshots

**Priority 2**: Complete Learning Loop
- Wire up trailblazing → variant creation
- Implement Thompson Sampling selection
- Add variant performance tracking

**Priority 3**: Learning-Driven Evolution
- Automatic template optimization
- Pattern detection from executions
- Guided template improvement

---

**Next**: Which priority should we tackle first?
