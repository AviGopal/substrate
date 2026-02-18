# Safe Self-Improvement Plan: Canary-First Approach

## Core Philosophy

**"We use our existing system to build itself, safely, through repeatable experiments."**

### The New Rule
**NEVER deploy self-improvement changes directly to host.**

Always follow the canary workflow:
1. **Experiment** in `devbob-clean` container
2. **Learn** by capturing knowledge
3. **Demonstrate** by repeating in fresh container
4. **Adopt** to host with rollback ready

---

## Integration with Original Plan

### Original Plan (Risky)
```
Phase 1 → Execute create-step-library-system on host
Phase 2 → Execute create-workflow-composer on host
Phase 3 → Execute create-optimizer on host
```

**Problem**: If anything breaks, host system is compromised.

---

### New Plan (Safe)
```
Phase 0 → Build canary infrastructure (THIS FIRST)
Phase 1 → Test Phase 1 activities in canary → Demonstrate → Adopt
Phase 2 → Test Phase 2 activities in canary → Demonstrate → Adopt
Phase 3 → Test Phase 3 activities in canary → Demonstrate → Adopt
```

**Benefit**: Host system never touched until proven safe.

---

## Phase 0: Build Canary Infrastructure (NEW)

### Goal
Build the safe experimentation system BEFORE attempting self-improvement.

### Activities to Create
1. `canary-test-and-learn` - Execute activity in container, capture knowledge
2. `canary-demonstrate-knowledge` - Repeat activity to prove repeatability
3. `canary-adopt-to-host` - Deploy validated change with rollback

### Implementation
```bash
# Create canary infrastructure activities
opencode activity execute add-feature-complete \
  --variables '{
    "featureName": "Canary Testing Infrastructure",
    "files": ["src/canary"],
    "description": "Build canary-test-and-learn, canary-demonstrate-knowledge, and canary-adopt-to-host activity templates. See CANARY_ENVIRONMENT_STRATEGY.md for complete spec."
  }' \
  --reason "Build safe experimentation infrastructure before self-improvement"
```

**Duration**: 2-3 hours  
**Cost**: $3-5  
**Risk**: LOW (building safety system, not changing core)

---

## Updated Timeline

### Week 1: Safety First
**Day 1-2**: Build canary infrastructure (Phase 0)
- Create 3 canary activities
- Test with simple activity (add-hello-world)
- Validate: experiment → learn → demonstrate → adopt

**Day 3-4**: Canary test Phase 1.1 (Step Library)
- Experiment: create-step-library-system in devbob-clean
- Learn: Capture CANARY_KNOWLEDGE_create-step-library-system.md
- Demonstrate: Repeat in fresh container
- Adopt: Deploy to host with rollback

**Day 5-6**: Canary test Phase 1.2 (Workflow Composer)
- Experiment: create-workflow-composer in devbob-clean
- Learn: Capture knowledge
- Demonstrate: Prove repeatability
- Adopt: Deploy to host

---

### Week 2-3: Phase 2 with Canary
**Day 7-9**: Metrics Analysis Engine (canary-first)
**Day 10-12**: Workflow Optimizer (canary-first)

---

### Week 4-5: Phase 3 with Canary
**Day 13-15**: Pattern Codification (canary-first)
**Day 16-18**: Autonomous Debug Queue (canary-first)

---

### Week 6: Validation & Knowledge Review
**Day 19-21**: Full system validation
- Review all knowledge documents
- Re-demonstrate all capabilities
- Measure: adoption rate, rollback usage, confidence levels

---

## Canary Workflow for Each Activity

### Template: How to Safely Test Any Self-Improvement Change

```bash
ACTIVITY_ID="create-step-library-system"

# Step 1: Experiment (devbob-clean)
./devbob start devbob-clean

opencode activity execute canary-test-and-learn \
  --variables "{
    \"activityId\": \"$ACTIVITY_ID\",
    \"variables\": {...}
  }" \
  --reason "Safe experimentation in isolated canary"

# If SUCCESS: Knowledge captured in CANARY_KNOWLEDGE_${ACTIVITY_ID}.md
# If FAILURE: Analyze, fix, retry (container is disposable)

# Step 2: Demonstrate (fresh devbob-clean)
./devbob stop devbob-clean
./devbob start devbob-clean

opencode activity execute canary-demonstrate-knowledge \
  --variables "{
    \"activityId\": \"$ACTIVITY_ID\",
    \"knowledgeDoc\": \"CANARY_KNOWLEDGE_${ACTIVITY_ID}.md\"
  }" \
  --reason "Prove repeatability of learned knowledge"

# If SUCCESS: Knowledge validated (confidence: HIGH)
# If FAILURE: Knowledge incomplete, iterate

# Step 3: Adopt (host with rollback)
opencode activity execute canary-adopt-to-host \
  --variables "{
    \"activityId\": \"$ACTIVITY_ID\",
    \"knowledgeDoc\": \"CANARY_KNOWLEDGE_${ACTIVITY_ID}.md\"
  }" \
  --reason "Deploy validated capability to production"

# Rollback branch automatically created: canary-rollback-${ACTIVITY_ID}-${timestamp}
```

---

## Knowledge Retention System

### Why This Matters
**"If we can't repeat it, we didn't learn it."**

Every successful change must be:
1. Documented (HOW we did it)
2. Demonstrated (PROVE we can repeat it)
3. Validated (TWO successful executions minimum)

### Knowledge Document Example

**File**: `CANARY_KNOWLEDGE_create-step-library-system.md`

```markdown
# Canary Knowledge: create-step-library-system

## Status
- ✅ Canary Test: SUCCESS (2024-02-17 14:30)
- ✅ Demonstrated: SUCCESS (2024-02-17 16:45)
- ✅ Adopted to Host: YES (2024-02-17 18:00)
- 🔒 Confidence: HIGH

## What We Built
Atomic step library with 60 steps across 6 categories (filesystem, code, test, git, LLM, data).

## How We Built It

### Prerequisites
- OpenCode installed with metabob-cli
- TypeScript/Bun available
- Test framework (vitest)

### Steps
1. Created step schema (src/step/step.ts)
   ```bash
   bun create src/step/step.ts
   # Define Step interface with Zod validation
   ```

2. Implemented step registry (src/step/step-registry.ts)
   ```bash
   # Storage layer with CRUD operations
   ```

3. Created step executor (src/step/step-executor.ts)
   ```bash
   # Runtime execution with validation and timeout
   ```

4. Built step catalog (60 steps in 6 categories)
   ```bash
   # Filesystem: read-file, write-file, etc.
   # Code: parse-typescript, generate-code, etc.
   # ...
   ```

5. Created comprehensive test suite
   ```bash
   bun test src/step
   # All 60 steps tested
   ```

### Key Decisions
- **Chose Zod for validation**: Type-safe, runtime validation
- **Storage in localStorage + backend sync**: Persistent across sessions
- **Timeout per step**: Prevents hanging operations
- **Retry logic**: Idempotent steps can be retried

## Why It Works
- Clear input/output contracts
- Validation at boundaries
- Atomic operations (composable)
- Test coverage ensures reliability

## Failure Modes
1. **Invalid input**: Caught by Zod validation → clear error message
2. **Timeout**: Step takes too long → aborted, can retry
3. **Missing dependency**: Tool not available → fails fast with error

## Validation
```bash
# Tests pass
bun test src/step
# Expected: 60/60 pass

# Can execute steps
const result = await StepExecutor.execute("read-file", { path: "test.txt" })
# Expected: { success: true, output: "file contents" }
```

## Demonstration History
1. **First Demo** (2024-02-17 14:30): SUCCESS
   - Container: devbob-clean-abc123
   - Duration: 2h 15min
   - All 60 steps implemented and tested
   - Zero failures

2. **Second Demo** (2024-02-17 16:45): SUCCESS
   - Container: devbob-clean-def456
   - Duration: 1h 45min (30min faster - learned!)
   - Same results, fully automated
   - Confidence: HIGH ✓

## Adoption History
- **Adopted to Host**: 2024-02-17 18:00
- **Rollback Branch**: canary-rollback-create-step-library-system-20240217-180000
- **Production Status**: ACTIVE
- **Incidents**: 0
- **Usage**: 127 step executions in first 24h

## Related Knowledge
- Enables: create-workflow-composer (needs step library)
- Pattern: Schema-first design (Zod validation)
- Future: Add more steps as needed (extensible design)
```

---

## Success Metrics (Updated)

### Safety Metrics
- ✅ **Zero host breakages** from self-improvement
- ✅ **100% canary coverage** (all changes tested in container first)
- ✅ **Rollback availability** for 100% of adoptions
- ✅ **<5 min recovery time** if rollback needed

### Learning Metrics
- ✅ **100% knowledge capture** (every success documented)
- ✅ **100% demonstration success** (every change repeated)
- ✅ **<2h demonstration time** (proves automation)
- ✅ **Confidence: HIGH** for 90%+ of adoptions

### Performance Metrics (same as before)
- ✅ **Step library**: 60+ atomic steps
- ✅ **Cost reduction**: 25% average
- ✅ **Time reduction**: 20% average
- ✅ **Autonomous operation**: 80%+ failure resolution

---

## Risk Mitigation

### Before Canary Strategy (Risky)
- ❌ Changes applied directly to host
- ❌ No proof of repeatability
- ❌ No rollback plan
- ❌ Hope-based deployment

### After Canary Strategy (Safe)
- ✅ Changes tested in disposable containers
- ✅ Repeatability proven (2+ demonstrations)
- ✅ Rollback branch always ready
- ✅ Evidence-based deployment

---

## The Beautiful Part

**This isn't just safety - it's learning at scale.**

Every experiment teaches us:
- ✅ What works (captured as repeatable knowledge)
- ✅ What doesn't work (captured as failure patterns)
- ✅ How to automate it (proven through demonstration)
- ✅ How to recover (rollback procedures documented)

**The system doesn't just build itself - it learns HOW to build itself safely.**

---

## Immediate Next Steps

### Today (Day 0)
1. ✅ Created safe self-improvement plan
2. ✅ Designed canary environment strategy
3. Create canary infrastructure activities

```bash
# Build the safety system first
opencode activity execute add-feature-complete \
  --variables '{
    "featureName": "Canary Testing Infrastructure",
    "files": ["src/canary"],
    "description": "See CANARY_ENVIRONMENT_STRATEGY.md for complete spec"
  }' \
  --reason "Build safe experimentation before self-improvement"
```

### Tomorrow (Day 1)
4. Test canary workflow with simple activity
5. Validate: experiment → learn → demonstrate → adopt
6. Begin Phase 1.1 (Step Library) using canary workflow

---

## Command Reference

### Start Canary Container
```bash
./devbob start devbob-clean
```

### Check Container Status
```bash
./devbob status
```

### View Logs
```bash
./devbob logs devbob-clean
```

### Stop Container
```bash
./devbob stop devbob-clean
```

### Copy Files from Container
```bash
docker cp devbob-clean:/workspace/output ./canary-artifacts/
```

### Rollback Host
```bash
git checkout canary-rollback-ACTIVITY-ID-TIMESTAMP
```

---

## Conclusion

**We now have a complete plan for safe, repeatable, recoverable self-improvement.**

The system will:
1. Test all changes in disposable containers first
2. Capture knowledge from every success
3. Prove repeatability through demonstration
4. Deploy to host only after validation
5. Always have a rollback plan ready

**This is how autonomous systems should evolve: carefully, deliberately, with full traceability.**

**Ready to build the safety system?** 🚀

```bash
# Start building safe self-improvement infrastructure
opencode activity execute add-feature-complete \
  --variables '{
    "featureName": "Canary Testing Infrastructure",
    "files": ["src/canary"],
    "description": "See CANARY_ENVIRONMENT_STRATEGY.md"
  }' \
  --reason "Foundation for safe recursive self-improvement"
```
