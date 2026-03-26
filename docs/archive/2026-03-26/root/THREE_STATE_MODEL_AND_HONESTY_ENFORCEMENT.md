# Three-State Model & Honesty Enforcement

**Created**: 2026-02-24  
**Purpose**: Define the three-state model (Instructional, Functional, Transient) and establish mechanisms for the Transient state to probe and validate the Instructional state, keeping us honest about what we actually are.

---

## The Three-State Model

### State 1: Instructional State (What We Want)

**Definition**: The goals, requirements, specifications, rules, and knowledge that guide our behavior.

**Examples**:
- Requirements documents ("All executions must track metrics")
- Specifications ("Metrics collection should be automatic")
- Rules ("Activities transform instructional → functional state")
- Beliefs ("We have automatic learning systems")
- Goals ("Achieve 70% success rate")

**Storage**:
- Documentation (`.md` files in `docs/`)
- Specifications (rules in code comments)
- Activity templates (task descriptions)
- System prompts (instructional text)

**Character**: **What we THINK we are or should be**

---

### State 2: Functional State (What Exists)

**Definition**: The actual code, data structures, running processes, and observable behavior that constitute our reality.

**Examples**:
- Source code (`repos/metabob-opencode/`)
- Activity templates (`.metabob/activities/*.json`)
- Database records (SurrealDB, Redis)
- Running processes (`ps aux | grep opencode`)
- File system state (`git status`)

**Storage**:
- Git repository (version-controlled code)
- Databases (persistent data)
- File system (configuration, logs)
- Process memory (runtime state)

**Character**: **What we ACTUALLY are**

---

### State 3: Transient State (The Regulator)

**Definition**: The probing, testing, verification, and validation mechanisms that check if Instructional aligns with Functional.

**Examples**:
- Test executions (running activities to verify behavior)
- Probing scripts (checking if metrics update)
- Validation harnesses (external verification)
- Assessment activities (system health checks)
- Reality checks ("Let's verify what we think we are")

**Storage**:
- Test results (`docs/TEST_RESULTS_*.md`)
- Validation harnesses (`tests/validation-harnesses/`)
- Evidence-based assessments (`docs/EVIDENCE_BASED_*.md`)
- Execution logs (observing actual behavior)

**Character**: **What VERIFIES alignment between Instructional and Functional**

---

## The Regulatory Loop

### How the Three States Interact

```
┌─────────────────────────────────────────────────────────┐
│                  INSTRUCTIONAL STATE                     │
│               (What We Think We Are)                     │
│                                                          │
│  "We have automatic metrics collection"                 │
│  "Boredom system triggers during idle"                  │
│  "Thompson Sampling selects variants"                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Claims ↓
                 │
┌────────────────▼────────────────────────────────────────┐
│                  TRANSIENT STATE                         │
│                  (The Regulator)                         │
│                                                          │
│  Tests → "Execute activity, check if metrics update"    │
│  Probes → "Search for boredom logs"                     │
│  Validates → "Query SurrealDB for execution records"    │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Evidence ↓
                 │
┌────────────────▼────────────────────────────────────────┐
│                   FUNCTIONAL STATE                       │
│                  (What Actually Exists)                  │
│                                                          │
│  Metrics: execution_count = 0 (NOT updating)            │
│  Logs: No boredom entries (NOT triggering)              │
│  SurrealDB: 1 incomplete record (NOT persisting)        │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Gap Detected! ↓
                 │
┌────────────────▼────────────────────────────────────────┐
│              CORRECTION MECHANISM                        │
│            (Ratchet Improvement)                         │
│                                                          │
│  Option 1: Fix Functional → Match Instructional         │
│    "Wire up metrics collection hook"                    │
│                                                          │
│  Option 2: Update Instructional → Match Functional      │
│    "Document: Metrics configured but not collecting"    │
│                                                          │
│  Option 3: Both (Usually Best)                          │
│    "Fix code AND update docs with honest assessment"    │
└──────────────────────────────────────────────────────────┘
```

---

## Transient State Regulates Instructional

### The Probing Mechanism

**Purpose**: Transient state QUESTIONS Instructional state's claims

**Method**: Active testing and verification

**Questions to Ask**:
1. "We claim X - is it true?"
2. "Documentation says Y - can we observe it?"
3. "We believe Z - where's the evidence?"

### The Regulation Mechanism

**Transient state is regulated BY Functional state**:
- What Transient observes IS Functional reality
- Transient can't claim what Functional doesn't show
- Evidence comes from Functional, not Instructional

**Transient regulates Instructional state**:
- Detects when Instructional claims don't match Functional reality
- Forces Instructional to update (honest documentation)
- Prevents Instructional drift (fantasy vs reality)

---

## Guidelines We Need to Enforce

### Guideline 1: **No Claims Without Evidence**

**Rule**: Instructional state MUST NOT claim behaviors unless Transient has verified them in Functional state.

**Enforcement**:
```
Before documenting "We have automatic X":
  → Transient test: Does X actually happen automatically?
  → Functional evidence: Show X occurring without manual trigger
  → If no evidence: Document "X is configured but not verified"
```

**Example**:
- ❌ Claim: "We have automatic metrics collection"
- ✓ Test: Execute activity, check metrics
- ❌ Evidence: Metrics = 0, no updates
- ✓ Honest: "Metrics collection infrastructure exists but not working"

---

### Guideline 2: **Regular Reality Checks**

**Rule**: Transient state MUST periodically probe Instructional state's claims.

**Enforcement**:
```
Schedule: Monthly (or when claims are made)
Activity: validate-instructional-state
Process:
  1. List all claims in Instructional (grep for "automatic", "we have", "system does")
  2. For each claim, design a Transient test
  3. Execute tests, gather Functional evidence
  4. Update Instructional to match evidence
```

**Example** (Our current work):
- Claim: "Automatic behaviors running"
- Test: Execute, observe, query databases
- Evidence: Infrastructure present, behaviors not running
- Update: Documented honest assessment

---

### Guideline 3: **Traceability**

**Rule**: Every Instructional claim MUST have a reference to Transient verification.

**Enforcement**:
```
Documentation format:
"We have automatic X [verified: 2026-02-24, test: TEST_X.md, result: PASS]"
"X is configured [status: unverified]"
"We believe Y [hypothesis, requires verification]"
```

**Example**:
```markdown
## Automatic Metrics Collection

**Status**: Infrastructure configured but NOT functioning [verified: 2026-02-24]
**Test**: docs/TEST_RESULTS_METRICS_COLLECTION.md
**Evidence**: Execution happened, metrics stayed at 0
**Next**: Fix metrics collection hook (issue #123)
```

---

### Guideline 4: **Bias Towards Functional**

**Rule**: When Instructional conflicts with Functional, Functional is truth.

**Enforcement**:
```
If Instructional says: "X works"
And Functional shows: X doesn't work
Then:
  → Update Instructional immediately
  → Create task to fix Functional
  → Document the gap transparently
```

**Philosophy**: **Code is reality. Documentation is interpretation. Reality wins.**

---

### Guideline 5: **Transient as Skeptic**

**Rule**: Transient state's PRIMARY job is to doubt Instructional state.

**Enforcement**:
```
Transient mindset:
  "How can we be SURE X is true?"
  "Where's the EVIDENCE for Y?"
  "Can we OBSERVE Z happening?"
  "What would DISPROVE this claim?"
```

**Method**: Active skepticism
- Don't accept claims at face value
- Demand observable evidence
- Test assumptions regularly
- Document findings honestly

---

## Keeping Ourselves Honest

### The Honesty Enforcement Loop

```
Step 1: INSTRUCTIONAL makes claim
  "We have automatic metrics collection"

Step 2: TRANSIENT questions claim
  "How can we be sure? Let's test."

Step 3: TRANSIENT probes FUNCTIONAL
  Execute activity → Check metrics → Result: No update

Step 4: FUNCTIONAL provides evidence
  Metrics = 0, no execution records, infrastructure exists

Step 5: TRANSIENT reports gap
  "Claim is FALSE. Infrastructure present, behavior absent."

Step 6: CORRECTION triggered
  Option A: Fix Functional (wire up metrics)
  Option B: Update Instructional (honest documentation)
  Usually: Both

Step 7: INSTRUCTIONAL updated
  "Metrics collection configured but not functioning [verified: DATE]"

Step 8: Repeat periodically
  Re-test after fixes to verify correction
```

---

## Guidelines for Ratchet Mechanism

### Using Ratchet to Fix Functional State

When Transient detects a gap:

1. **Identify Bottleneck**
   - What's the specific gap? (e.g., "Metrics not updating")
   - Where in Functional state? (e.g., "Post-execution hook")
   - What's the impact? (e.g., "No learning data accumulating")

2. **Create Ratchet Cycle**
   ```bash
   opencode activity execute-ratchet-cycle-fixed \
     --domain activity-execution \
     --bottleneck "metrics-not-updating" \
     --max_cycles 1
   ```

3. **Ratchet Process**:
   - Inspect Current State (Functional code, data flow)
   - Identify Root Cause (missing hook, wrong storage)
   - Apply Improvement (add hook, fix storage)
   - Measure Progress (re-test with Transient)

4. **Verify Fix with Transient**
   - Re-run original test
   - Confirm Functional now matches Instructional
   - Update Instructional with new verified status

---

## Specific Guidelines for Current System

### Guideline: Activity Execution Must Update Metrics

**Instructional Claim**: "Every activity execution updates estimated_metrics"

**Transient Test**: Execute activity, check if execution_count increments

**Current Functional Reality**: Metrics don't update (verified 2026-02-24)

**Enforcement**:
1. Ratchet cycle to fix metrics collection
2. Add post-execution hook in Activity lifecycle
3. Verify updates in both storage locations
4. Re-test until Functional matches Instructional

**Success Criteria**:
```bash
# Before execution
execution_count = N

# Execute activity
opencode activity X

# After execution
execution_count = N + 1  # ✓ MUST increment
avg_cost = updated       # ✓ MUST include this execution
avg_duration = updated   # ✓ MUST include this execution
success_rate = recalc    # ✓ MUST recalculate
```

---

### Guideline: Boredom System Must Trigger

**Instructional Claim**: "Boredom system automatically triggers during idle time"

**Transient Test**: Start session, wait 5+ minutes idle, check for triggers

**Current Functional Reality**: Unknown (blocked, needs metrics first)

**Enforcement**:
1. Cannot test until metrics work (dependencies)
2. Once metrics work: test idle-time triggering
3. Check logs for "boredom" entries
4. Verify execution records created during idle
5. Update Instructional based on evidence

**Success Criteria**:
```bash
# Session idle for 5+ minutes
grep -i "boredom" ~/.local/share/opencode/log/dev.log
# Expected: "Session idle, fetching boredom activity"
# Expected: "Executing boredom activity: template-id"

# Check execution records
find ~/.local/share/opencode/storage/activity-execution -mmin -10
# Expected: New execution record from boredom trigger
```

---

### Guideline: Documentation Must Reflect Reality

**Instructional Standard**: Every claim must have verification status

**Format**:
```markdown
## Feature Name

**Status**: [VERIFIED | CONFIGURED | HYPOTHESIS | BROKEN]
**Last Verified**: YYYY-MM-DD
**Test**: Link to test results
**Evidence**: Observable behavior description

[If BROKEN]
**Issue**: What's not working
**Next**: Plan to fix
```

**Example**:
```markdown
## Automatic Metrics Collection

**Status**: BROKEN
**Last Verified**: 2026-02-24
**Test**: docs/TEST_RESULTS_METRICS_COLLECTION.md
**Evidence**: Activity executed (193.6s, $0.14), metrics stayed at 0

**Issue**: Post-execution hook not wired or failing silently
**Next**: Ratchet cycle to identify and fix hook
```

---

## Transient State Activities

### Verification Activities

We need regular Transient activities to probe Instructional:

1. **validate-instructional-state** (monthly)
   - List all claims in docs (grep patterns)
   - For each claim, check evidence
   - Generate honesty report

2. **test-automatic-behaviors** (after changes)
   - Test each claimed automatic behavior
   - Document which are actually working
   - Update status in docs

3. **probe-functional-state** (on-demand)
   - Check databases, logs, metrics
   - Verify claimed data is actually there
   - Report gaps

4. **evidence-based-assessment** (quarterly)
   - Comprehensive review
   - Compare Instructional vs Functional
   - Update all verification statuses

---

## Philosophy: Honest Self-Knowledge

### Why This Matters

**Without Transient regulation of Instructional**:
- Instructional drifts into fantasy
- Claims become comfortable lies
- Gaps grow unnoticed
- We lose touch with reality

**With Transient regulation**:
- Instructional stays grounded
- Claims are evidence-based
- Gaps are detected quickly
- We maintain honest self-knowledge

### The Core Principle

**"Let's always take time to consider if what we think we are is true"**

This principle IS the Transient state's purpose:
- Instructional tells us what we think
- Transient tests if it's true
- Functional shows what actually is
- Ratchet aligns them

---

## Implementation: Fixing Metrics Collection

### Current Status

**Instructional**: "Automatic metrics collection"
**Functional**: Metrics don't update
**Transient**: Verified gap (2026-02-24)
**Action**: Use ratchet mechanism to fix

### Ratchet Cycle Plan

```bash
# Execute ratchet to fix metrics
opencode activity execute-ratchet-cycle-fixed \
  --domain activity-execution \
  --bottleneck metrics-not-updating \
  --target metrics-collection-working \
  --max_cycles 1 \
  --improvement_threshold 100
```

**Expected Ratchet Process**:

1. **Inspect**: Read Activity lifecycle code
2. **Identify**: Find where metrics should update
3. **Fix**: Add/fix post-execution metric update
4. **Verify**: Re-run Test 1, confirm metrics increment
5. **Document**: Update verification status

**Success Criteria**: Test 1 passes (metrics update after execution)

---

## Conclusion

### The Three-State Model in Action

**Instructional** (What we claim):
- Documents, beliefs, goals, requirements

**Functional** (What actually is):
- Code, data, running processes, observable behavior

**Transient** (What keeps us honest):
- Tests, probes, verifications, reality checks

### Regulatory Relationships

**Transient regulates Instructional**:
- Questions claims
- Demands evidence
- Forces honesty

**Functional regulates Transient**:
- Provides evidence
- Shows reality
- Cannot be argued with

**Ratchet aligns Functional with Instructional**:
- Fixes gaps
- Implements claims
- Makes reality match intent

---

**The honesty loop: Claim → Test → Evidence → Update**

**This is how we stay true to ourselves.** ✓
