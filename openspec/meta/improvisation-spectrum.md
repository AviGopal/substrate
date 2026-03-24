# Improvisation Spectrum: Four Modes of Execution

**Status:** ⚠️ Template-driven proven | 🔴 Goal-seeking experimental | ❌ Search-first and pure improvisation not built

## Overview

The becoming manifests across a **spectrum of constraint and creativity**:

- **High constraint** (template-driven): Known path, fast, reliable
- **Low constraint** (pure improvisation): Unknown path, slow, exploratory

Between these extremes lie **goal-seeking** and **search-first** modes, each balancing constraint and creativity differently.

Understanding this spectrum is essential for:
- Choosing the right execution mode for a task
- Designing activities that balance speed and adaptability
- Knowing when to extract templates (ribosome pattern)

## The Four Modes

### 1. Template-Driven Execution

**Status:** ✅ Proven in production

**Definition:** Execute a pre-defined sequence of tasks with known structure and minimal variation.

**Characteristics:**
- **Constraint:** Highest - full task sequence specified in advance
- **Speed:** Fastest - no planning overhead
- **Reliability:** Highest - known successful path
- **Creativity:** Lowest - follows predetermined structure
- **Use case:** Repetitive tasks with known solutions

**How it works:**
1. Load activity template (vessel)
2. Execute tasks sequentially
3. Use impulses for context variation
4. Capture execution trace (instance)

**Example:** `fix-bug-template.json`
```json
{
  "id": "fix-auth-bug-v1",
  "name": "Fix authentication bug",
  "tasks": [
    {
      "id": "read-error",
      "description": "Read error logs",
      "impulseRefs": ["errorFile"]
    },
    {
      "id": "locate-bug",
      "description": "Find bug in codebase",
      "impulseRefs": ["relatedCode"]
    },
    {
      "id": "apply-fix",
      "description": "Apply bug fix",
      "validation": { "requiredPatterns": ["test passing"] }
    }
  ]
}
```

**Code reference:** `repos/minibob/src/activity.ts` (executeActivity function)

**When to use:**
- Task has been done before successfully
- Path to solution is well-understood
- Speed and reliability more important than creativity
- Template exists with good success rate

**Limitations:**
- Cannot handle novel situations
- Limited adaptation to unexpected conditions
- Requires template to exist

### 2. Goal-Seeking Execution

**Status:** 🔴 Experimental - implemented but not validated

**Definition:** Given a goal description and context (impulses), adaptively find a path to achieve the goal.

**Characteristics:**
- **Constraint:** Medium-high - goal specifies destination, not path
- **Speed:** Medium - adaptive path-finding with some overhead
- **Reliability:** Medium - depends on goal clarity and context quality
- **Creativity:** Medium - can discover novel paths to known goals
- **Use case:** Known goal, unknown or varying path

**How it works:**
1. Parse goal description into executable intent
2. Load relevant context via impulses
3. Improvise action sequence (meso-level improvisation)
4. Execute actions, observe results, adapt
5. Capture successful paths for template extraction

**Example:** Goal-seeking call
```typescript
// From repos/minibob/src/goal-processor.ts
create_activity_goal_seeking({
  goalDescription: "Fix authentication timeout issue",
  impulseRefs: [
    "activityExecutionTrace:failed-auth-exec-123",
    "file:src/auth/session.ts:40:20",
    "activityMetrics:auth-related-activities"
  ]
})
```

**Code reference:**
- `repos/minibob/src/goal-processor.ts` (parseGoal, recommendActivities)
- `repos/minibob/src/improviser.ts` (mesoscale and macroscale improvisation)

**When to use:**
- Goal is clear but path varies
- Context changes between executions
- Want to learn from execution patterns
- No template exists yet, but goal is well-defined

**Limitations:**
- Requires clear goal articulation
- Context quality critical for success
- Slower than template-driven
- May need multiple attempts to find optimal path

**Key insight:** Goal-seeking is NOT search. It's **adaptive path-finding** where the LLM reasons about next steps based on goal + context + previous results.

### 3. Search-First Execution

**Status:** ❌ Not built - concept defined

**Definition:** Search for relevant templates/patterns first, fall back to improvisation if nothing found.

**Characteristics:**
- **Constraint:** Variable - high if template found, low if improvising
- **Speed:** Variable - fast with template, slower with improvisation
- **Reliability:** Medium-high - templates reliable, improvisation exploratory
- **Creativity:** Medium - reuses known patterns, creates when necessary
- **Use case:** Maximize reuse while enabling novel solutions

**How it works:**
1. Parse user intent
2. Search template library for matches
3. If good match found → template-driven execution
4. If partial match → adapt template (meso-level improvisation)
5. If no match → pure improvisation
6. Extract successful improvisation into new template

**Example workflow:**
```
User: "Add Redis caching to the activity API"

1. Search: Find templates matching "add caching", "redis integration"
2. Found: "add-cache-layer-v2" (80% match)
3. Adapt: Modify template for specific API structure
4. Execute: Run adapted template
5. Ribosome: Extract successful execution as new variant
```

**When to use:**
- Want to maximize reuse of known patterns
- Task may or may not have been done before
- Willing to invest in template search overhead
- Value both speed (when template exists) and creativity (when it doesn't)

**Limitations:**
- Search quality depends on template metadata
- Partial matches require good adaptation logic
- Overhead of search may not be worth it for simple tasks

**Implementation notes:** Requires:
- Template search/indexing system
- Template similarity scoring
- Template adaptation mechanisms
- Decision logic for match threshold

### 4. Pure Improvisation

**Status:** ❌ Not built - concept defined

**Definition:** Create solution step-by-step with no predetermined structure, purely from intent and feedback.

**Characteristics:**
- **Constraint:** Lowest - only intent as guide
- **Speed:** Slowest - each step requires reasoning
- **Reliability:** Lowest - exploratory, may fail multiple times
- **Creativity:** Highest - can discover entirely novel approaches
- **Use case:** Novel problems, research, exploration

**How it works:**
1. Start with only user intent (no template, no goal structure)
2. Reason about first step
3. Execute step, observe results
4. Reason about next step based on results
5. Repeat until intent satisfied or max attempts reached
6. Ribosome: Extract entire sequence as template if successful

**Example workflow:**
```
User: "Design a new caching strategy that minimizes SurrealDB queries"

1. Step 1: Analyze current query patterns
   - Execute: Run query analysis
   - Observe: 80% queries are repeated within 5 minutes

2. Step 2: Research caching approaches
   - Execute: Search for Redis TTL patterns
   - Observe: Found sliding window approach

3. Step 3: Design cache key schema
   - Execute: Draft schema
   - Observe: Needs to handle nested queries

4. Step 4: Implement cache layer
   - Execute: Write cache middleware
   - Observe: Tests pass

5. Step 5: Validate performance
   - Execute: Run benchmarks
   - Observe: 60% reduction in DB queries

6. Ribosome: Extract as "design-query-cache-v1" template
```

**Code reference:** `repos/minibob/src/improviser.ts` (macroscale improvisation - experimental)

**When to use:**
- Problem has never been solved before
- No similar templates exist
- Exploration and learning more important than speed
- Willing to accept failures as learning

**Limitations:**
- Very slow (each step requires LLM reasoning)
- High token cost
- Low success rate on first attempt
- Requires good feedback loops to converge

**Three levels of improvisation:**

1. **Microscale** (within a task): Adapt specific tool calls, handle edge cases
2. **Mesoscale** (task sequence): Determine which tasks needed to achieve goal
3. **Macroscale** (problem structure): Discover entirely new problem-solving approaches

## The Constraint → Creativity Spectrum

```
High Constraint                                    Low Constraint
Fast, Reliable                                     Slow, Exploratory
Known Path                                         Unknown Path

Template-Driven → Goal-Seeking → Search-First → Pure Improvisation
     ✅               🔴              ❌               ❌
```

**Key insight:** All modes are valuable. The right choice depends on:
- Is there a template? (Use template-driven)
- Is the goal clear? (Use goal-seeking)
- Unsure if template exists? (Use search-first when built)
- Completely novel problem? (Use pure improvisation when built)

## The Ribosome Pattern

**Status:** 🔴 Experimental - basic extraction works, advanced features not built

**Definition:** Successful improvisation → template extraction

The ribosome pattern is the **bridge** between high-creativity modes and high-constraint modes. It enables the system to learn from successful improvisations.

**How it works:**
1. Execute goal-seeking or pure improvisation
2. Capture full execution trace with state transitions
3. If successful, extract task sequence
4. Generate activity template from sequence
5. Store template for future reuse
6. Future similar goals use template-driven execution

**Implementation:** `repos/minibob/src/activity.ts` (assembleTemplateFromExecution function)

**Example:**
```typescript
// After successful goal-seeking execution
const trace = await captureExecutionTrace(execution)

if (trace.success) {
  const template = assembleTemplateFromExecution(trace)
  // template now reusable for similar goals
  await storeTemplate(template)
}
```

**Enhanced state tracking:**
```typescript
{
  inputState: {
    filesAvailable: ["src/auth/session.ts", "src/db/surreal.ts"],
    environment: { "NODE_ENV": "development" },
    impulses: ["errorFile", "relatedCode"],
    variables: { errorType: "timeout" }
  },
  outputState: {
    filesModified: ["src/auth/session.ts"],
    filesCreated: [],
    filesDeleted: [],
    exitCode: 0
  },
  stateTransition: {
    before: { "src/auth/session.ts": "abc123..." },
    after: { "src/auth/session.ts": "def456..." },
    workingDirectory: "/app/repos/metabob"
  }
}
```

**Status:**
- ✅ Basic trace capture works
- ⚠️ Template assembly implemented but unproven
- ❌ Automatic similarity detection not built
- ❌ Template clustering/merging not built
- ❌ Variant evolution not automated

**Vision (not yet built):**
- Improvisations automatically extracted as templates
- Similar templates merged into variants
- Thompson Sampling selects best variant over time
- System becomes more template-driven over time (faster, more reliable)

## Choosing the Right Mode

### Decision Tree

```
Do you have a template for this task?
├─ Yes → Use Template-Driven (fastest, most reliable)
└─ No
   └─ Is the goal clear and well-defined?
      ├─ Yes → Use Goal-Seeking (adaptive path-finding)
      └─ No
         └─ Want to search for similar templates first?
            ├─ Yes → Use Search-First (when built)
            └─ No → Use Pure Improvisation (when built)
```

### By Use Case

**Repetitive tasks:** Template-Driven
- Bug fixes following known patterns
- Deployment procedures
- Code formatting/linting

**Adaptive tasks:** Goal-Seeking
- Debugging new issues
- Implementing features with varying requirements
- Refactoring with different starting codebases

**Exploratory tasks:** Search-First (when built)
- Unsure if template exists
- Want to balance reuse and creativity
- Learning what patterns are available

**Research tasks:** Pure Improvisation (when built)
- Never been done before
- No similar work exists
- Discovery more important than speed

## Implementation Status by Mode

### Template-Driven ✅
- [x] Template schema defined
- [x] Task execution logic
- [x] Impulse injection
- [x] Validation rules
- [x] Execution trace capture
- [x] Success/failure tracking

### Goal-Seeking 🔴
- [x] Goal parser (basic)
- [x] Intent extraction
- [x] Impulse-driven context
- [x] Meso-level improvisation
- [ ] Robust error handling
- [ ] Multi-attempt learning
- [ ] Success pattern recognition

### Search-First ❌
- [ ] Template search/indexing
- [ ] Similarity scoring
- [ ] Partial match detection
- [ ] Template adaptation logic
- [ ] Search-to-improvisation fallback

### Pure Improvisation ❌
- [x] Macroscale improvisation (experimental code exists)
- [ ] Step-by-step reasoning
- [ ] Feedback integration
- [ ] Convergence detection
- [ ] Multi-attempt learning

### Ribosome 🔴
- [x] Execution trace capture
- [x] State transition tracking
- [x] Basic template assembly
- [ ] Automatic extraction triggers
- [ ] Template similarity detection
- [ ] Variant merging
- [ ] Thompson Sampling integration

## Examples from Real System

### Template-Driven: Fix Boredom Activities ✅

**Template:** `templates/fix-boredom-activities-v1.json`
**Success rate:** ~70% (real data from dashboard)
**Average duration:** 45 seconds

Tasks:
1. Identify boredom threshold issue
2. Update boredom detection logic
3. Validate fix with tests

### Goal-Seeking: Debug Failed Template 🔴

**Goal:** "Fix failed template execution by analyzing error trace"
**Impulses:**
- `activityExecutionTrace:failed-exec-456`
- `activityTemplate:buggy-template-v2`
- `file:src/activity.ts:100:50`

**Status:** Implemented but needs validation with real failures

### Search-First: Not Built ❌

**Planned use case:** "Add caching to API endpoint"
1. Search for "caching", "redis", "api middleware" templates
2. If found: Use template
3. If not found: Goal-seek or improvise
4. Extract successful path as new template

### Pure Improvisation: Not Built ❌

**Planned use case:** "Design a new learning algorithm for template selection"
1. No templates exist for this
2. No clear goal structure
3. Step-by-step discovery:
   - Research existing algorithms
   - Prototype approaches
   - Test and compare
   - Extract winning approach as template

## Related Documentation

**Core concepts:**
- [ontology-foundation.md](./ontology-foundation.md) - Vessel/Becoming/Instance model
- [terminology-glossary.md](./terminology-glossary.md) - Precise term definitions

**Implementation:**
- [docs/architecture/RIBOSOME_ARCHITECTURE.md](../../docs/architecture/RIBOSOME_ARCHITECTURE.md) - Template extraction details
- `repos/minibob/src/activity.ts` - Template execution
- `repos/minibob/src/goal-processor.ts` - Goal-seeking implementation
- `repos/minibob/src/improviser.ts` - Improvisation modes

**Contracts:**
- [openspec/contracts/activity-template-schema.md](../contracts/activity-template-schema.md) - Template structure (⚠️ if exists)
- [openspec/contracts/goal-seeking-api.md](../contracts/goal-seeking-api.md) - Goal-seeking interface (⚠️ if exists)

## Future Evolution

**Near-term (Phase 1-2):**
- Validate goal-seeking in production
- Improve ribosome extraction quality
- Add success pattern recognition

**Medium-term (Phase 3-4):**
- Implement search-first mode
- Build template similarity scoring
- Automate ribosome triggers

**Long-term (Phase 5-6):**
- Implement pure improvisation
- Cross-vessel improvisation coordination
- Self-evolving template libraries

The spectrum expands capabilities while maintaining the foundation: **measured outcomes drive optimization**, not reasoning or assumptions.
