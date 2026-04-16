# Idiom Analysis: Examining Terminology and Conceptual Clarity

> **Purpose**: Audit how we talk about this system and whether our terminology accurately reflects the underlying mechanisms.
>
> **Date**: 2026-04-08
>
> **Status**: Analysis Complete

---

## Executive Summary

This analysis examines the alignment between our **language** (how we describe the system) and our **mechanisms** (how the system actually works). The goal is to identify conceptual mismatches where terminology obscures rather than clarifies the underlying behavior.

### Key Findings

1. **"Intent" is Emergent, Not Explicit** - We say "activities convey intent," but intent actually emerges from probabilistic shape matching, not explicit specification.

2. **"Expected Outcome" is Multi-Level and Ambiguous** - The term conflates design-time validation rules with runtime predictions and learned patterns.

3. **"Pass Impulses" vs "Resolve Pointers"** - We frequently use "pass" when we mean "resolve," obscuring the lazy-loading architecture.

4. **"Expectation Adjustment" is Mechanical, Not Cognitive** - Thompson Sampling parameter updates happen algorithmically, not through reflection.

5. **"Learning from Outcomes" Needs Precision** - We learn different things from different aspects of outcomes (success/failure, shape matches, tool usage).

---

## 1. Terminology Audit Findings

### 1.1 Across Core Documents

Analyzed three foundational documents:
- `IMPULSE_ACTIVITY_FOUNDATION.md` (canonical reference)
- `BOOTSTRAP_LEARNING_LOOP.md` (learning implementation)
- `/tmp/impulse-flow-architecture.md` (execution flow)

#### Consistent Terms (Good)

| Term | Usage | Meaning |
|------|-------|---------|
| **Impulse** | Universal | Data pointer with metadata |
| **Activity** | Universal | State transition specification |
| **Vessel** | Universal | Bundle of resolvers + activities |
| **Resolver** | Universal | Component that loads data from pointers |
| **Thompson Sampling** | Universal | Probabilistic template selection |
| **Trace** | Universal | Execution record (inputs, steps, outputs, state) |

#### Inconsistent or Ambiguous Terms (Problematic)

| Term | Document A | Document B | Issue |
|------|-----------|-----------|-------|
| **Intent** | "Activities convey intent to expected outcome" | "Intent = highest-ranked activity that matches shapes" | Explicit vs emergent |
| **Expected Outcome** | "Validation rules" | "Output shapes + patterns" | Fixed vs computed |
| **Pass Impulses** | Used 12 times | "Resolve pointers" | Suggests eager passing, not lazy loading |
| **Expectation** | "Adjust expectations" | "Update α/β parameters" | Cognitive vs mechanical |
| **Learning** | "Learn from traces" | "Learn from outcomes" | Source vs content |

---

## 2. Conceptual Mismatches Identified

### 2.1 "Intent" - Explicit vs Emergent

#### What We Say

> "How do activities **convey intent** to expected outcome?"
>
> "Activities **convey** intent through input shapes, output shapes, validation rules, task sequence, and resolver selection."

#### What Actually Happens

```typescript
// Intent is NOT conveyed - it's COMPUTED
function selectActivity(goalShapes: string[], activities: Activity[]): Activity {
  // 1. Filter by shape compatibility
  const compatible = activities.filter(a =>
    a.inputSchema.required.every(shape => goalShapes.includes(shape))
  )

  // 2. Thompson Sampling selects probabilistically
  const selected = sampleFromBeta(compatible.map(a => ({
    activity: a,
    score: sampleBeta(a.thompson_alpha, a.thompson_beta)
  })))

  return selected // ← Intent "emerges" from this selection
}
```

**The Mismatch:**
- **"Convey"** suggests deliberate communication from template to executor
- **Reality**: Intent emerges from constraint satisfaction (shape matching) + learned probabilities (Thompson Sampling)

**Where This Language Appears:**
- IMPULSE_ACTIVITY_FOUNDATION.md line 248: "How Activities Convey Intent to Expected Outcome"
- impulse-flow-architecture.md line 9: "How do activities convey intent to expected outcome?"
- CLAUDE.md line 143: "Vessels are collections of ideas and **intent**"

#### Proposed Terminology

Instead of "activities convey intent," use:

- **"Activities specify constraints"** - They define what inputs are required and what outputs will be produced
- **"Intent emerges from shape matching"** - The highest-ranked compatible activity becomes the "intent" for this execution
- **"Selection is probabilistic, not deterministic"** - Thompson Sampling means intent varies across executions

---

### 2.2 "Expected Outcome" - Multi-Level Ambiguity

#### What We Say

> "How can we use shapes and the activity execution graph to **generate expectations**?"
>
> "Expectations adjust based on outcome mismatches."

#### What Actually Happens

**Three Different "Expected Outcomes":**

**Level 1: Design-Time Validation Rules** (Fixed)
```typescript
task.validation = {
  requiredFiles: ["auth.ts"],       // MUST exist
  requiredPatterns: ["PASS"],       // MUST be in output
  forbiddenPatterns: ["TODO"]       // MUST NOT be in output
}
```

**Level 2: Output Shape Declarations** (Fixed)
```typescript
activity.outputSchema = {
  produces: ["patch", "test_result"]  // These shapes WILL be created
}
```

**Level 3: Learned Success Probabilities** (Dynamic)
```typescript
// Computed from historical executions
activityPerformance = {
  overallSuccessRate: 0.93,          // α=45, β=3
  withShape_X_rate: 0.96,            // When input includes shape X
  withShape_Y_rate: 0.78             // When input includes shape Y
}
```

**The Mismatch:**
- **"Expected outcome"** conflates fixed validation (Level 1 & 2) with learned predictions (Level 3)
- **"Generate expectations"** suggests computation, but Levels 1 & 2 are template-defined, only Level 3 is computed
- **"Adjust expectations"** only applies to Level 3 (Thompson parameters), not Levels 1 & 2

**Where This Language Appears:**
- impulse-flow-architecture.md line 6: "How can we use shapes...to **generate expectations**?"
- impulse-flow-architecture.md line 7: "How do we **adjust expectations** based on outcomes?"
- Multiple uses of "expected outcome" throughout docs

#### Proposed Terminology

Replace "expected outcome" with precise terms:

| What We Mean | Use This Term |
|--------------|---------------|
| Design-time validation rules | **Validation constraints** |
| Output shape declarations | **Output schema** |
| Learned success probabilities | **Performance priors** or **success distribution** |
| All three together | **Success criteria** (validation + schema + priors) |

**Before:**
> "Activities convey intent to expected outcome through validation rules."

**After:**
> "Activities specify success criteria through validation constraints (what must be true), output schema (what will be created), and performance priors (how likely to succeed based on past executions)."

---

### 2.3 "Pass Impulses" vs "Resolve Pointers"

#### What We Say

> "How do we **pass impulses** like variables to other resolvers?"

#### What Actually Happens

**Impulses are NOT passed directly:**

```typescript
// WRONG mental model: eager passing
function executeTask(task: Task, impulses: Impulse[]) {
  const loadedContent = impulses.map(i => i.content)  // ❌ Not how it works
  return resolver.execute(loadedContent)
}

// CORRECT: lazy pointer resolution
function executeTask(task: Task, impulses: Impulse[]) {
  // 1. Pass metadata ONLY to LLM for reasoning
  const metadata = impulses.map(i => i.metadata)
  const decision = await llm.decide(task.prompt, metadata)

  // 2. LLM indicates which impulses are needed
  const neededIds = extractImpulseRefs(decision)

  // 3. THEN resolve pointers on-demand
  const resolved = await Promise.all(
    neededIds.map(id => impulseStore.load(id))  // ← Resolution happens here
  )

  return resolver.execute(resolved.map(r => r.content))
}
```

**The Mismatch:**
- **"Pass impulses"** suggests eager data transfer (like function arguments)
- **Reality**: Metadata-first reasoning, then lazy pointer resolution
- **This is a core architectural principle** ("Metadata First, Content Later")

**Where This Language Appears:**
- impulse-flow-architecture.md line 5: "How do we **pass impulses** like variables?"
- Multiple code comments using "pass impulse"
- Activity templates saying "pass these impulses to the next task"

#### Proposed Terminology

| Instead of | Say This |
|-----------|----------|
| "Pass impulses to resolver" | "Provide impulse pointers; resolver loads content" |
| "Activity receives impulses" | "Activity receives impulse metadata; tasks resolve content" |
| "Impulses as variables" | "Impulse pointers as lazy-loaded context" |

**Key Distinction:**

```typescript
// We DON'T do this (eager passing):
executeTask(task, [impulseA.content, impulseB.content])

// We DO this (lazy resolution):
executeTask(task, [
  { id: "A", pointer: {...}, metadata: {...} },  // Not loaded yet
  { id: "B", pointer: {...}, metadata: {...} }   // Not loaded yet
])
// Resolver decides which to load based on metadata
```

---

### 2.4 "Expectation Adjustment" - Mechanical vs Cognitive

#### What We Say

> "How do we **adjust expectations** based on outcomes?"
>
> "Expectations **adjust** based on outcome mismatches."

#### What Actually Happens

**The Update is Purely Algorithmic:**

```typescript
// After execution completes
if (execution.status === 'completed') {
  // SUCCESS: Increment alpha (successes counter)
  UPDATE activity_template
  SET thompson_alpha = thompson_alpha + 1
  WHERE id = execution.template_id

} else if (execution.status === 'failed') {
  // FAILURE: Increment beta (failures counter)
  UPDATE activity_template
  SET thompson_beta = thompson_beta + 1
  WHERE id = execution.template_id
}

// That's it. No "adjustment" in the cognitive sense.
// Next selection samples from Beta(α, β) distribution.
```

**The Mismatch:**
- **"Adjust"** suggests active modification based on analysis
- **Reality**: Mechanical counter increments; Beta distribution naturally shifts
- **No reflection or interpretation** - just `α++` or `β++`

**Where This Language Appears:**
- impulse-flow-architecture.md line 38: "Expectations adjust based on outcome mismatches"
- BOOTSTRAP_LEARNING_LOOP.md line 11: "Expectation Adjustment Learning Loop"
- Multiple references to "adjusting" expectations

#### Proposed Terminology

| Instead of | Say This |
|-----------|----------|
| "Adjust expectations" | "Update Thompson parameters" or "Record outcome" |
| "Expectation adjustment" | "Parameter updates" or "Bayesian updates" |
| "System learns to adjust" | "Success counters increment; sampling distribution shifts" |

**Before:**
> "The system adjusts expectations based on outcome mismatches, improving future recommendations."

**After:**
> "The system records execution outcomes (success → α++, failure → β++), shifting the Beta(α, β) sampling distribution toward better-performing variants."

---

### 2.5 "Learning from Outcomes" - What Exactly Do We Learn?

#### What We Say

> "Learn from outcomes."
>
> "Learning happens through measured outcomes."

#### What Actually Happens

**We learn DIFFERENT things from DIFFERENT aspects of outcomes:**

**From Success/Failure Status:**
```sql
-- Thompson Sampling parameters
UPDATE activity_template
SET thompson_alpha += IF(success, 1, 0),
    thompson_beta += IF(success, 0, 1)
```

**From Shape Matches:**
```sql
-- Shape-conditioned success rates
SELECT
  activity_id,
  input_shapes,
  COUNT(*) FILTER(WHERE success) / COUNT(*) as success_rate
GROUP BY activity_id, input_shapes
```

**From Impulse Usage:**
```sql
-- Impulse relevance scores
SELECT
  impulse_shape,
  activity_id,
  times_loaded,
  times_success_when_loaded / times_loaded as relevance_score
```

**From Tool Call Patterns:**
```sql
-- Tool usage patterns
SELECT
  activity_id,
  tool_name,
  avg_duration,
  success_rate
FROM tool_usage_log
```

**From State Transitions:**
```typescript
// File modification patterns
const learned = {
  'npm:test creates coverage/': { always: true },
  'npm:test modifies .cache/': { always: true },
  'npm:test never modifies src/': { always: true }
}
```

**The Mismatch:**
- **"Learn from outcomes"** is too vague
- **Reality**: Multiple learning loops extracting different signals
- **Different signals feed different decisions** (template selection, impulse filtering, tool choice, etc.)

#### Proposed Terminology

Be specific about WHAT we're learning:

| Vague | Precise |
|-------|---------|
| "Learn from outcomes" | "Extract success signals for Thompson Sampling" |
| "System learns" | "Update shape-conditioned success rates" OR "Track impulse relevance patterns" |
| "Learning loop" | "Feedback loops: template selection, impulse filtering, tool usage, composition tracking" |

**Before:**
> "The system learns from outcomes to improve recommendations."

**After:**
> "Execution traces feed multiple learning loops: (1) Thompson Sampling for template selection, (2) shape-conditioned success rates for context-aware ranking, (3) impulse relevance scores for context optimization, (4) composition patterns for multi-step workflows, (5) tool usage metrics for resolver selection."

---

## 3. Analysis of Key Idioms

### 3.1 "Impulses as Variables"

**Where Used:**
- IMPULSE_ACTIVITY_FOUNDATION.md suggests thinking of impulses like template variables
- Code comments reference "impulse variables"

**Is This Accurate?**

**Similarities to Variables:**
- ✅ Named references (`error_log`, `source_code`)
- ✅ Substituted into task prompts
- ✅ Scoped to activity execution

**Critical Differences:**

| Variables | Impulses |
|-----------|----------|
| Eager evaluation | Lazy resolution |
| Value-based | Pointer-based |
| Copy semantics | Reference semantics |
| No metadata | Rich metadata (shape, summary, rowCount) |
| Fixed size | Budget-limited |
| Always loaded | Loaded on-demand |

**Verdict: MISLEADING**

The "variables" metaphor obscures the lazy-loading, metadata-first architecture.

**Better Metaphor:** "Impulses as lazy-loaded smart pointers with metadata"

---

### 3.2 "Activities Convey Intent"

**Where Used:**
- impulse-flow-architecture.md line 9
- IMPULSE_ACTIVITY_FOUNDATION.md line 248
- Multiple design documents

**Is "Convey" the Right Verb?**

**Dictionary Definition of "Convey":**
> To transport, communicate, or transmit something from one place/entity to another.

**What Activities Actually Do:**

```typescript
// Activities DON'T convey intent...
// They SPECIFY CONSTRAINTS that enable intent to EMERGE

interface Activity {
  // INPUT CONSTRAINTS: What must be available
  inputSchema: { required: ["error_log", "source_code"] }

  // OUTPUT SCHEMA: What will be produced
  outputSchema: { produces: ["patch", "test_result"] }

  // VALIDATION CONSTRAINTS: What success looks like
  tasks: [{
    validation: {
      requiredPatterns: ["PASS"],
      forbiddenPatterns: ["TODO"]
    }
  }]
}

// Intent EMERGES when:
// 1. Shape matching finds compatible activities
// 2. Thompson Sampling selects one probabilistically
// 3. That selection becomes the "intent" for this execution
```

**Verdict: INACCURATE**

"Convey" suggests active communication. Activities are passive constraint specifications.

**Better Verbs:**
- **"Specify"** - Activities specify constraints
- **"Define"** - Activities define success criteria
- **"Enable"** - Activities enable intent to emerge through selection

---

### 3.3 "Expected Outcome" - Fixed or Dynamic?

**Where Used:**
- Throughout architecture docs as a key concept
- Often paired with "intent"

**The Ambiguity:**

**Interpretation 1: Fixed at Design Time**
```typescript
// Template author writes:
outputSchema: { produces: ["patch", "test_result"] }
validation: { requiredPatterns: ["PASS"] }

// This is FIXED - won't change during execution
```

**Interpretation 2: Predicted at Runtime**
```typescript
// Before execution, we might predict:
expectedOutcome = {
  successProbability: 0.93,  // From Thompson parameters
  estimatedDuration: 45000,   // From historical avg
  likelyModifiedFiles: ["auth.ts"]  // From past traces
}

// This is DYNAMIC - computed from learning
```

**Interpretation 3: Validated After Execution**
```typescript
// After execution, we check:
actualOutcome.shapes === expectedOutcome.shapes  // ✓ or ✗
actualOutcome.patterns.includes("PASS")           // ✓ or ✗
actualOutcome.forbiddenPatterns.length === 0      // ✓ or ✗

// This is COMPARISON - actual vs expected
```

**The Problem:** "Expected outcome" means different things in different contexts.

**Verdict: AMBIGUOUS**

We need distinct terms for:
1. **Declared outputs** (output schema)
2. **Validation rules** (required/forbidden patterns)
3. **Performance priors** (predicted success rate)
4. **Actual results** (what happened)

---

### 3.4 "Learning from Outcomes" - Source vs Content

**Where Used:**
- Design principles
- Learning loop documentation

**The Vagueness:**

When we say "learn from outcomes," do we mean:

**A. Learn from the FACT of success/failure?**
```typescript
// Just the binary outcome
outcome = { success: true }
// → Update Thompson parameters
```

**B. Learn from the PATTERN of what happened?**
```typescript
// What tools were used, in what order
outcome = {
  toolSequence: ["read_file", "llm_generate", "write_file"],
  filesModified: ["auth.ts"],
  duration: 45000
}
// → Extract reusable pattern
```

**C. Learn from the DIFFERENCE between expected and actual?**
```typescript
// What we predicted vs what happened
outcome = {
  expectedFiles: ["auth.ts"],
  actualFiles: ["auth.ts", "auth.test.ts"],  // Unexpected test file!
  expectedPattern: "PASS",
  actualPattern: "PASS (42 tests)"
}
// → Adjust output schema to include test files
```

**Verdict: IMPRECISE**

"Outcomes" encompasses multiple signals. We should be explicit about which signals feed which learning loops.

---

## 4. Process Description Examination

### 4.1 The "Intent → Activity → Outcome" Flow

**How We Currently Describe It:**

```
User Intent → Activity Selection → Execution → Outcome → Learning
```

**Issues:**

1. **"User Intent"** is actually "Goal Description" (text input)
2. **"Activity Selection"** is multi-step: shape extraction → matching → Thompson sampling
3. **"Execution"** has internal phases: impulse loading → task execution → validation
4. **"Outcome"** is multi-faceted: success/failure + state delta + outputs
5. **"Learning"** is multiple concurrent loops, not a single step

### 4.2 More Accurate Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ INPUT: Goal Description (text)                               │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ SHAPE EXTRACTION: Infer required impulse shapes              │
│   "Fix auth bug" → ["goal", "error_log", "source_code"]     │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ SHAPE MATCHING: Find compatible activities                   │
│   WHERE input_shapes ⊆ available_shapes                     │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ THOMPSON SAMPLING: Select probabilistically                  │
│   Sample from Beta(α, β) for each candidate                 │
│   Select activity with highest sample                        │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ EXECUTION: Run selected activity                             │
│   ├─ Load impulse metadata (not content)                    │
│   ├─ For each task:                                         │
│   │   ├─ LLM reasons about metadata                         │
│   │   ├─ Resolve needed impulse pointers                    │
│   │   ├─ Execute resolver (llm, file, bash, etc.)           │
│   │   ├─ Validate output                                    │
│   │   └─ Create output impulses                             │
│   └─ Record state transition                                │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ MULTI-SIGNAL OUTCOME                                         │
│   ├─ Success/Failure (boolean)                              │
│   ├─ State Delta (files before/after)                       │
│   ├─ Output Impulses (shapes + content)                     │
│   ├─ Tool Usage (which resolvers, how long)                 │
│   ├─ Impulse Access (which loaded, which used)              │
│   └─ Validation Results (required/forbidden patterns)       │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ PARALLEL LEARNING LOOPS                                      │
│   ├─ Thompson Sampling: α++ or β++                          │
│   ├─ Shape Conditioning: Update success rates per shape set │
│   ├─ Impulse Relevance: Track which impulses helped         │
│   ├─ Composition: Record activity chains                    │
│   ├─ Tool Metrics: Track resolver performance               │
│   └─ Ribosome: Extract new templates from improvisation     │
└─────────────────────────────────────────────────────────────┘
```

**Key Differences:**

1. **No single "intent" step** - Intent emerges from selection
2. **Execution is detailed** - Not a black box
3. **Outcome is multi-faceted** - Not just success/failure
4. **Learning is parallel** - Multiple simultaneous updates

---

## 5. Recommended Terminology Refinements

### 5.1 Replace Ambiguous Terms

| Retire This | Use This Instead | Rationale |
|-------------|-----------------|-----------|
| "Intent" (standalone) | "Selected activity" or "emergent intent" | Intent is not explicit |
| "Convey intent" | "Specify constraints" | Activities don't communicate |
| "Expected outcome" | "Validation constraints" + "output schema" + "performance priors" | Three distinct concepts |
| "Adjust expectations" | "Update Thompson parameters" | Mechanical, not cognitive |
| "Pass impulses" | "Provide impulse pointers" | Not eager passing |
| "Learn from outcomes" | "Extract [specific signal] from execution traces" | Be precise |

### 5.2 Introduce Precise Terms

**For Execution Flow:**
- **Goal description** - User input text
- **Shape extraction** - Inferring required impulse types
- **Shape matching** - Finding compatible activities
- **Probabilistic selection** - Thompson Sampling
- **Lazy resolution** - Loading impulse content on-demand

**For Outcomes:**
- **Validation result** - Did it meet constraints?
- **State delta** - What changed?
- **Output impulses** - What was created?
- **Performance metrics** - How long, how much?

**For Learning:**
- **Parameter update** - Thompson α/β increment
- **Shape conditioning** - Success rates per input signature
- **Relevance scoring** - Which impulses helped
- **Pattern extraction** - Ribosome creating templates

### 5.3 Strengthen Existing Good Terms

These terms are clear and should be used consistently:

- ✅ **Impulse** (data pointer with metadata)
- ✅ **Resolver** (loads content from pointer)
- ✅ **Activity** (state transition specification)
- ✅ **Vessel** (bundle of resolvers + activities)
- ✅ **Trace** (execution record)
- ✅ **Thompson Sampling** (probabilistic selection)
- ✅ **Shape** (impulse type/semantic category)

---

## 6. Glossary of Precise Definitions

### Core Concepts

**Activity**
: A template specifying a state transition. Defines input constraints (required shapes), output schema (produced shapes), task sequence (steps to execute), and validation rules (success criteria). Activities are passive specifications, not active agents.

**Impulse**
: A lazy-loaded pointer to data, with metadata enabling reasoning without loading content. Consists of: (1) pointer (type + location), (2) metadata (shape, summary, rowCount, etc.), (3) resolution state (loaded/unloaded), (4) optional content (when loaded).

**Shape**
: A semantic category for impulse content. Examples: `error_log`, `source_code`, `execution_trace`, `user_table`. Used for constraint matching and pattern learning.

**Resolver**
: A component that loads content from an impulse pointer. Resolvers live where data lives: `file` resolver in MiniBob, `sql` resolver in database vessel, `trace` resolver in backend.

**Vessel**
: A bundle of resolvers (data access) + activities (capabilities) + lifecycle hooks. The execution environment where data lives and work happens.

**Thompson Sampling**
: Probabilistic template selection using Beta(α, β) distribution. α = successes + 1, β = failures + 1. Enables exploration (trying low-performing variants) and exploitation (favoring high-performing variants).

**Trace**
: A complete execution record containing: input impulses, task sequence, tool calls, output impulses, state transitions, success/failure status, performance metrics.

### Process Terms

**Shape Extraction**
: Inferring required impulse types from goal description. "Fix auth bug" → `["goal", "error_log", "source_code"]`.

**Shape Matching**
: Finding activities where `activity.inputSchema.required ⊆ available_shapes`.

**Emergent Intent**
: The selected activity becomes the "intent" through probabilistic selection. Not specified upfront; emerges from constraints + learning.

**Lazy Resolution**
: Loading impulse content on-demand, after metadata-based reasoning determines it's needed. Core principle: "metadata first, content later."

**Validation Constraints**
: Rules that execution output must satisfy. Includes: `requiredFiles`, `requiredPatterns`, `forbiddenPatterns`. Fixed at design time.

**Output Schema**
: Declaration of impulse shapes the activity will produce. Example: `produces: ["patch", "test_result"]`. Fixed at design time.

**Performance Priors**
: Learned probability distributions over outcomes. Computed from Thompson parameters and historical traces. Dynamic, updates with each execution.

**State Delta**
: The difference between filesystem/database state before and after execution. Tracked via file hashes or database snapshots.

### Learning Terms

**Parameter Update**
: Incrementing Thompson α (on success) or β (on failure). Pure algorithm, no interpretation.

**Shape Conditioning**
: Computing success rates for (activity, input_shape_set) pairs. Enables context-aware ranking.

**Relevance Scoring**
: Tracking which impulses, when loaded, correlate with success. `relevance = P(success | impulse_loaded)`.

**Composition Tracking**
: Recording which activities call which other activities. Enables multi-step workflow learning.

**Pattern Extraction (Ribosome)**
: Converting successful improvisation traces into reusable activity templates. Mechanism for growing capability library.

**Variant Creation**
: Cloning a template with modifications based on failure analysis. Enables systematic failure recovery.

---

## 7. Examples of Clarified Language

### Before and After Comparisons

#### Example 1: Intent

**Before:**
> "The user provides intent, the activity conveys that intent to the executor, and the outcome is compared against expected results."

**After:**
> "The user provides a goal description. Shape extraction infers required impulse types. Shape matching finds compatible activities. Thompson Sampling selects one probabilistically—this selection becomes the emergent intent for this execution. Validation compares actual outputs against declared constraints (output schema + validation rules)."

#### Example 2: Impulse Passing

**Before:**
> "We pass impulses as variables to the activity executor, which uses them to execute tasks."

**After:**
> "We provide impulse pointers (with metadata) to the activity executor. During task execution, the LLM reasons about impulse metadata to decide which content to load. Resolvers then lazily load the needed impulse content on-demand."

#### Example 3: Learning

**Before:**
> "The system learns from outcomes and adjusts expectations to improve future performance."

**After:**
> "Execution traces feed parallel learning loops: (1) Thompson parameter updates (α++ on success, β++ on failure), (2) shape-conditioned success rate computation, (3) impulse relevance score tracking, (4) composition pattern recording. These signals shift sampling distributions and filter recommendations."

#### Example 4: Expected Outcome

**Before:**
> "Activities define expected outcomes, which guide execution and enable validation."

**After:**
> "Activities specify success criteria through three mechanisms: (1) validation constraints (required files/patterns), (2) output schema (shapes that will be produced), and (3) performance priors (learned success probability from Thompson parameters). Validation compares actual results against constraints and schema; priors inform selection probability."

---

## 8. Implications for Documentation

### 8.1 Documents Needing Updates

**High Priority:**
1. `IMPULSE_ACTIVITY_FOUNDATION.md` - Update section "How Activities Convey Intent to Expected Outcome"
2. `impulse-flow-architecture.md` - Rephrase core questions to avoid "convey" and "pass"
3. `BOOTSTRAP_LEARNING_LOOP.md` - Replace "expectation adjustment" with "parameter updates"

**Medium Priority:**
4. `CLAUDE.md` - Clarify "vessels are collections of ideas and intent"
5. Code comments using "pass impulses" - Update to "provide impulse pointers"
6. Activity template documentation - Distinguish validation vs schema vs priors

### 8.2 New Documentation to Create

**Needed:**
1. **Execution Flow Diagram** - Visual representation of shape extraction → matching → selection → execution → learning
2. **Learning Loops Reference** - Detailed description of each parallel learning mechanism
3. **Terminology Quick Reference** - One-page glossary for new contributors

### 8.3 Teaching Materials

For explaining the system to new users/developers:

**Avoid:**
- "Activities convey intent"
- "Pass impulses to the executor"
- "System adjusts expectations"
- "Expected outcome"

**Use:**
- "Activities specify constraints; intent emerges from selection"
- "Impulses are lazy-loaded pointers with metadata"
- "Thompson parameters update mechanically"
- "Validation constraints + output schema + performance priors"

---

## 9. Conceptual Model Alignment Check

### 9.1 Does Our Language Match Our Mechanisms?

**Mechanism: Shape Matching**
- ✅ Language: "Activities match by input shape requirements"
- ❌ Language: "Activities understand user intent"

**Mechanism: Lazy Impulse Resolution**
- ✅ Language: "Metadata-first, content loaded on-demand"
- ❌ Language: "Pass impulses as variables"

**Mechanism: Thompson Sampling**
- ✅ Language: "Probabilistic selection from Beta distribution"
- ❌ Language: "System learns the best activity for each intent"

**Mechanism: Validation**
- ✅ Language: "Check output against declared constraints"
- ❌ Language: "Compare outcome to expected result"

**Mechanism: Parameter Updates**
- ✅ Language: "Increment α on success, β on failure"
- ❌ Language: "Adjust expectations based on outcomes"

### 9.2 Red Flags in Current Language

Watch for these patterns that suggest conceptual drift:

| Red Flag | What It Suggests | Reality Check |
|----------|------------------|---------------|
| "The activity knows..." | Anthropomorphization | Activities are data structures |
| "Intent is conveyed..." | Communication metaphor | Intent emerges from selection |
| "System understands..." | Cognitive metaphor | System matches patterns |
| "Expected to..." | Prediction language | Often means "declared to" |
| "Learns that..." | Knowledge acquisition | Often means "increments counter" |

---

## 10. Recommendations

### 10.1 Immediate Actions

1. **Update IMPULSE_ACTIVITY_FOUNDATION.md**
   - Replace "convey intent" with "specify constraints"
   - Distinguish validation constraints, output schema, performance priors
   - Clarify that intent emerges from selection

2. **Create Terminology Guide**
   - Extract glossary from this document
   - Add to repository as `TERMINOLOGY.md`
   - Link from main README

3. **Audit Code Comments**
   - Search for "pass impulse" → replace with "provide impulse pointer"
   - Search for "expected outcome" → specify which meaning
   - Search for "adjust expectation" → replace with "update parameters"

### 10.2 Ongoing Practices

1. **When Writing Documentation**
   - Ask: "Does this metaphor obscure the mechanism?"
   - Prefer precise technical terms over intuitive metaphors
   - Distinguish emergent properties from explicit specifications

2. **When Explaining to Others**
   - Start with mechanisms, not metaphors
   - Use "for example" not "it's like"
   - Correct misunderstandings about eager vs lazy, explicit vs emergent

3. **When Naming New Concepts**
   - Choose names that reveal mechanism
   - Avoid anthropomorphic terms
   - Be consistent with existing precise terminology

### 10.3 Testing Understanding

Ask these questions when reviewing docs:

1. **Is "intent" explicit or emergent?**
   - Correct: Emergent from shape matching + Thompson selection

2. **Are impulses passed or resolved?**
   - Correct: Pointers provided, content resolved on-demand

3. **Is "expected outcome" fixed or dynamic?**
   - Correct: Validation is fixed, schema is fixed, performance priors are dynamic

4. **Does "learning" mean reflection or measurement?**
   - Correct: Measurement (counting successes/failures, recording patterns)

5. **Are expectations adjusted cognitively or algorithmically?**
   - Correct: Algorithmically (α++, β++)

---

## Conclusion

**Core Issue:** Our language sometimes uses **cognitive metaphors** (convey, understand, expect, adjust) for **mechanical processes** (match, count, sample, increment).

**Why This Matters:**
- Confuses new contributors about how the system actually works
- Makes debugging harder (wrong mental model)
- Obscures the elegant simplicity of the architecture

**The Fix:** Use **precise technical language** that reveals mechanisms:
- Shape matching (not "understanding intent")
- Lazy resolution (not "passing impulses")
- Parameter updates (not "adjusting expectations")
- Validation constraints (not "expected outcomes")

**The Benefit:** Clearer communication leads to:
- Faster onboarding
- Fewer conceptual bugs
- Better alignment between design and implementation
- Easier system evolution

---

**Next Steps:**
1. Review and approve terminology refinements
2. Update core architecture documents
3. Create terminology reference guide
4. Audit codebase comments
5. Update teaching materials

**Success Metric:** New contributors can accurately explain the execution flow without using "intent," "convey," "pass impulses," or "expected outcome" ambiguously.
