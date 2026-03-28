# Alignment Checklist: Verifying Ontological Consistency

**Status:** ✅ Canonical checklist for spec creation and review

## Purpose

This checklist ensures that all specifications, code, and documentation align with the foundational ontology of the metabob-devbob system.

Use this checklist:
- **Before** creating new specs
- **During** code reviews
- **After** refactoring components
- **When** reviewing existing documentation

## Pre-Flight Checklist (Before Creating Specs)

### 1. Understand the Three States

**Have you clearly identified:**

- [ ] What is the **vessel** (instructional state)?
- [ ] What is the **becoming** (transient transformation)?
- [ ] What is the **instance** (functional result)?

**Questions to ask:**
- What provides the capacity to execute? (vessel)
- What transformation is happening? (becoming)
- What state results from the transformation? (instance)

**Red flags:**
- Confusion between vessel and instance
- Describing becoming as if it's static or storable
- Treating MiniBob as "the executor" instead of substrate

**Reference:** [ontology-foundation.md](./ontology-foundation.md)

---

### 2. Choose the Right Execution Mode

**Have you determined:**

- [ ] Is there a template for this task?
- [ ] Is the goal clear and well-defined?
- [ ] How much constraint vs. creativity is needed?
- [ ] Which execution mode is appropriate?

**Decision tree:**
```
Template exists? → Template-Driven ✅
  ↓ No
Goal clear? → Goal-Seeking 🔴
  ↓ No
Want to search first? → Search-First ❌ (not built)
  ↓ No
Pure Improvisation ❌ (not built)
```

**Red flags:**
- Using goal-seeking when template exists (unnecessarily slow)
- Using template-driven for novel problems (will fail)
- Describing search-first or pure improvisation as if they're built

**Reference:** [improvisation-spectrum.md](./improvisation-spectrum.md)

---

### 3. Use Correct Terminology

**Have you verified:**

- [ ] All terms match [terminology-glossary.md](./terminology-glossary.md)?
- [ ] No synonyms or variations used?
- [ ] Common misuses avoided?

**Common misuses to check:**
- ❌ "MiniBob executes activities" → ✅ "Activities execute through MiniBob as substrate"
- ❌ "The template runs" → ✅ "The template instantiates a becoming"
- ❌ "Load all impulses" → ✅ "Load impulses lazily by priority"
- ❌ "Goal-seeking searches" → ✅ "Goal-seeking improvises a path"
- ❌ "Store the execution" → ✅ "Store the execution trace"

**Reference:** [terminology-glossary.md](./terminology-glossary.md)

---

### 4. Verify Status Markers

**Have you used honest status markers:**

- [ ] ✅ Proven - implemented AND validated in production
- [ ] ⚠️ Implemented - code exists but not thoroughly validated
- [ ] ❌ Not Built - concept defined but no implementation
- [ ] 🔴 Experimental - active research, may change significantly

**Red flags:**
- Marking features as ✅ without production validation
- Omitting status markers entirely
- Describing unbuilt features in present tense without markers

**Questions to ask:**
- Has this been tested in production?
- Do we have metrics proving it works?
- Is the implementation stable or still changing?

---

### 5. Check Impulse Design

**If your spec involves impulses:**

- [ ] Impulses used for context, not instructions?
- [ ] Lazy loading strategy defined?
- [ ] Token budgets specified?
- [ ] Priority levels assigned?
- [ ] Pointer type appropriate?

**Pointer type checklist:**
- [ ] `memo` - Embedded content (local resolution)
- [ ] `file` - Filesystem read (local resolution)
- [ ] `activityExecutionTrace` - Full trace with state (backend)
- [ ] `activityTemplate` - Template structure (backend)
- [ ] `activityMetrics` - Performance data (backend)
- [ ] Custom type - Backend can resolve?

**Red flags:**
- Using impulses as instructions (they're context)
- Loading all impulses eagerly (should be lazy)
- No token budgets (will overflow context window)
- Missing priority (memory agent can't optimize)

**Reference:** [terminology-glossary.md](./terminology-glossary.md#impulse)

---

### 6. Consider Separation of Concerns

**Have you verified:**

- [ ] MiniBob responsibilities clear (execute, capture, resolve local impulses)?
- [ ] Backend responsibilities clear (store, learn, resolve all impulses)?
- [ ] No confusion about where logic belongs?

**MiniBob should:**
- ✅ Execute activities with LLM
- ✅ Capture execution traces
- ✅ Resolve LOCAL impulses (`memo`, `file`)
- ❌ NOT store persistently
- ❌ NOT perform pattern recognition
- ❌ NOT implement learning algorithms

**Backend should:**
- ✅ Store execution traces
- ✅ Resolve ALL impulse types
- ✅ Implement Thompson Sampling
- ✅ Perform pattern recognition
- ❌ NOT execute activities
- ❌ NOT interact with LLM directly

**Red flags:**
- MiniBob implementing learning algorithms
- Backend executing activities
- Confusion about impulse resolution boundaries

**Reference:** CLAUDE.md (Separation of Concerns section)

---

## Review Checklist (For Existing Specs)

### Terminology Review

**Check for:**

- [ ] Consistent use of "vessel" (not "executor", "runner", "engine")
- [ ] Correct use of "becoming" (not "process", "workflow", "execution" when referring to transient state)
- [ ] Proper use of "instance" (not "result", "output" when referring to functional state)
- [ ] "MiniBob" described as substrate (not executor, framework, orchestrator)
- [ ] "Impulse" used for context (not instructions, commands, directives)
- [ ] "Activity" vs "Task" used correctly (activity = sequence of tasks)
- [ ] "Template-driven" vs "Goal-seeking" vs "Improvisation" distinctions clear

**Red flags:**
- Multiple terms for the same concept
- Industry jargon that conflicts with our ontology
- Anthropomorphizing components ("MiniBob decides", "the template wants")

---

### Three-State Clarity

**Verify:**

- [ ] Each component clearly categorized as vessel, becoming, or instance
- [ ] State transitions explicitly described
- [ ] No confusion between what executes vs what's executing vs what executed
- [ ] Instance → vessel loop acknowledged (continuous transformation)

**Questions to ask:**
- Can you point to the vessel in the spec?
- Is the becoming described as ephemeral and transformative?
- Are instances observable and measurable?

---

### Implementation Status

**Check:**

- [ ] All features have status markers (✅⚠️❌🔴)
- [ ] Unbuilt features marked as ❌ or 🔴
- [ ] Implemented features marked as ⚠️ until validated
- [ ] Production-proven features marked as ✅
- [ ] No aspirational language without status markers

**Red flags:**
- "The system automatically extracts templates" (❌ not built - extraction works, automation doesn't)
- "Goal-seeking optimizes templates" (wrong - Thompson Sampling does, and it's ⚠️)
- "Pure improvisation discovers novel solutions" (❌ not built)

---

### Code References

**Verify:**

- [ ] Specs reference actual code files
- [ ] File paths are accurate and up-to-date
- [ ] Functions/types cited actually exist
- [ ] No references to removed or refactored code

**Example good references:**
- `repos/minibob/src/activity.ts` (executeActivity function)
- `repos/minibob/src/types.ts` (ActivityTemplate interface)
- `repos/metabob-activity-api/src/routes/activities.ts` (recommend endpoint)

---

### Cross-References

**Check:**

- [ ] Links to other meta docs correct
- [ ] Links to architecture docs valid
- [ ] Links to contracts (if they exist) accurate
- [ ] No broken internal references

---

## Domain-Specific Checklists

### For Activity Templates

**Verify:**

- [ ] Template is clearly a vessel (instructional state)
- [ ] Tasks are well-defined transformations
- [ ] Impulses provide context, not instructions
- [ ] Validation rules are measurable
- [ ] Retry strategy is specified
- [ ] Success/failure criteria clear

**Red flags:**
- Tasks that are too vague ("fix the bug")
- No validation rules (can't measure success)
- Impulses used as instructions
- No retry strategy (fragile execution)

---

### For Goal-Seeking Workflows

**Verify:**

- [ ] Goal description is clear and specific
- [ ] Required impulses identified
- [ ] Expected outcome measurable
- [ ] Fallback strategy defined
- [ ] Marked as 🔴 experimental (not production-ready)

**Red flags:**
- Vague goals ("make it better")
- No impulse context provided
- No way to measure success
- Claiming production-ready status

---

### For Ribosome Extraction

**Verify:**

- [ ] Input: successful execution trace
- [ ] Output: activity template
- [ ] State transitions captured
- [ ] Validation rules inferred from success
- [ ] Marked as 🔴 experimental

**Red flags:**
- Claiming automatic extraction (triggers not automated)
- Missing state transition data
- No validation rule generation
- Marked as ✅ proven (it's experimental)

---

### For Thompson Sampling

**Verify:**

- [ ] Beta distribution parameters clear
- [ ] Success/failure criteria defined
- [ ] Exploration/exploitation balance considered
- [ ] Variant selection logic described
- [ ] Marked as ⚠️ implemented (needs validation)

**Red flags:**
- Claiming optimization (it selects, not optimizes)
- Deterministic language (it's probabilistic)
- Marked as ✅ proven (needs production data)

---

### For Impulse Pointers

**Verify:**

- [ ] Pointer type specified
- [ ] Resolution responsibility clear (local vs backend)
- [ ] Token budget defined
- [ ] Priority assigned
- [ ] Lazy loading strategy described

**Red flags:**
- No pointer type (how to resolve?)
- Eager loading (wastes context window)
- No token budget (overflow risk)
- No priority (can't optimize)

---

## Self-Review Questions

Before publishing a spec, ask yourself:

### Clarity
- [ ] Can someone unfamiliar with the system understand this spec using only the meta docs?
- [ ] Are all terms from the glossary used correctly?
- [ ] Is the ontological grounding (vessel/becoming/instance) clear?

### Honesty
- [ ] Are status markers accurate and honest?
- [ ] Are unbuilt features clearly marked?
- [ ] Are experimental features flagged as such?

### Completeness
- [ ] Are all three states identified?
- [ ] Is the execution mode chosen and justified?
- [ ] Are code references provided?
- [ ] Are cross-references to related docs included?

### Correctness
- [ ] Does this align with the three-state model?
- [ ] Does this respect separation of concerns?
- [ ] Is MiniBob described as substrate, not executor?
- [ ] Are impulses used for context, not instructions?

### Consistency
- [ ] Does this use the same terminology as other specs?
- [ ] Does this follow the same structure as similar specs?
- [ ] Does this contradict any existing specs? (If so, which one is wrong?)

---

## Escalation: When Alignment Fails

If a spec cannot be aligned with the ontology:

1. **Double-check understanding**: Re-read [ontology-foundation.md](./ontology-foundation.md)
2. **Consult glossary**: Verify term usage in [terminology-glossary.md](./terminology-glossary.md)
3. **Review examples**: Look at [improvisation-spectrum.md](./improvisation-spectrum.md) for patterns
4. **Ask questions**: Discuss in team channel or GitHub issues
5. **Propose ontology change**: If the ontology is truly insufficient, propose an update (rare!)

**Important:** The ontology should be stable. If you're frequently finding misalignment, the spec is probably wrong, not the ontology.

---

## Quick Reference Card

### Status Markers
- ✅ **Proven**: Implemented AND validated
- ⚠️ **Implemented**: Code exists, not validated
- ❌ **Not Built**: Concept only
- 🔴 **Experimental**: Active research

### Three States
- **Vessel**: Instructional (static, reusable)
- **Becoming**: Transient (ephemeral, learning)
- **Instance**: Functional (observable, specific)

### MiniBob
- IS: Substrate, vessel, minimal context
- NOT: Executor, framework, orchestrator

### Impulses
- FOR: Context injection
- NOT FOR: Instructions, commands
- LOAD: Lazily, by priority, within budget

### Execution Modes
- **Template-Driven**: ✅ Known path, fast
- **Goal-Seeking**: 🔴 Adaptive path-finding
- **Search-First**: ❌ Not built
- **Pure Improvisation**: ❌ Not built

### Separation of Concerns
- **MiniBob**: Execute, capture, resolve local
- **Backend**: Store, learn, resolve all
- **Dashboard**: Observe, visualize, monitor

---

## Examples of Good Alignment

### Example 1: Activity Template Spec (Well-Aligned)

**Vessel:** Activity template JSON
**Becoming:** Sequential task execution with LLM
**Instance:** Execution trace with state transitions

**Execution mode:** Template-driven ✅
**Status:** Proven ✅

**Impulses:** Lazy-loaded context with budgets
**Separation:** MiniBob executes, backend stores traces

**Terminology:** Consistent with glossary

---

### Example 2: Goal-Seeking Spec (Well-Aligned)

**Vessel:** Goal description + impulse pointers
**Becoming:** Meso-level improvisation toward goal
**Instance:** Modified codebase + execution trace

**Execution mode:** Goal-seeking 🔴
**Status:** Experimental 🔴

**Impulses:** Provide context for path-finding
**Separation:** MiniBob improvises, backend learns patterns

**Terminology:** Consistently uses "adaptive path-finding"

---

### Example 3: Ribosome Extraction Spec (Well-Aligned)

**Vessel:** Successful execution trace (becomes vessel)
**Becoming:** Template assembly process
**Instance:** Extracted activity template

**Execution mode:** N/A (meta-process)
**Status:** Basic extraction ⚠️, automation ❌

**Impulses:** Execution trace as input
**Separation:** MiniBob provides trace, backend could automate triggers

**Terminology:** Accurately describes improvisation → template

---

## Examples of Poor Alignment

### Example 1: Executor Language (Misaligned)

❌ **Bad:** "MiniBob executor runs the template and produces output"

**Problems:**
- Calls MiniBob an "executor" (it's a substrate)
- Says template "runs" (templates are vessels, they instantiate becomings)
- "Produces output" (creates instances)

✅ **Good:** "The template instantiates a becoming through MiniBob substrate, resulting in an instance (execution trace)"

---

### Example 2: Missing Status Markers (Misaligned)

❌ **Bad:** "The system automatically extracts templates from successful improvisations and optimizes them through Thompson Sampling"

**Problems:**
- No status markers (extraction ⚠️, automation ❌, optimization is wrong term)
- Implies fully automated (not true)
- "Optimizes" (Thompson Sampling selects, doesn't optimize)

✅ **Good:** "The ribosome pattern can extract templates from successful executions (⚠️ implemented). Automatic trigger detection is planned (❌ not built). Thompson Sampling learns which variants perform best (⚠️ implemented, needs validation)."

---

### Example 3: Impulse Misuse (Misaligned)

❌ **Bad:** "Load all impulses at task start and use them to instruct the LLM what to do"

**Problems:**
- Eager loading (should be lazy)
- "Instruct" (impulses are context, not instructions)
- No priority or budget mentioned

✅ **Good:** "Load high-priority impulses first, within token budget, to provide context for LLM reasoning. Additional impulses loaded as needed during execution."

---

## Related Documentation

**Foundation:**
- [ontology-foundation.md](./ontology-foundation.md) - Three-state model
- [terminology-glossary.md](./terminology-glossary.md) - Canonical definitions
- [improvisation-spectrum.md](./improvisation-spectrum.md) - Execution modes

**Usage:**
- Use this checklist before creating ANY spec
- Use during code review
- Use when refactoring components
- Update this checklist if new alignment issues emerge

**Maintenance:**
- Update checklist when ontology evolves (rare)
- Add new common misuses as discovered
- Add domain-specific sections as needed
