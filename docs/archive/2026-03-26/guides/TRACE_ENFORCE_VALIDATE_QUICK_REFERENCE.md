# Trace-Enforce-Validate Loop - Quick Reference Card

## One-Line Summary
**Self-verifying evolutionary system: requirements → traced → enforced → validated deterministically → conflicts detected → changes rippled → committed**

---

## Usage

```bash
activity trace-enforce-validate-loop \
  specificationName="<name>" \
  specificationDescription="<what requirement to enforce>" \
  expectedBehavior="<what should happen>" \
  validationStrategy="<how to verify it>"
```

---

## The 7 Phases (Automatic)

| Phase | What It Does | Output Impulse |
|-------|-------------|----------------|
| 1. **TRACE** | Maps current implementation vs desired state | `trace-{spec}` (5K tokens) |
| 2. **ENFORCE** | Applies code mutations to close gaps | `enforcement-{spec}` (3K tokens) |
| 3. **VALIDATE** | Creates deterministic test harness | `harness-{spec}` (2K tokens) |
| 4. **RUN** | Executes harness, collects PASS/FAIL | `validation-results-{spec}` (2K tokens) |
| 5. **AGGREGATE** | Detects conflicts with other specs | `conflict-analysis-{spec}` (3K tokens) |
| 6. **RIPPLE** | Propagates changes, resolves conflicts | `ripple-{spec}` (3K tokens) |
| 7. **COMMIT** | Creates tagged commit with full docs | `final-{spec}` (2K tokens) |

**Total:** 7 phases, 7 impulses, 20K tokens of preserved knowledge

---

## Quick Examples

### Data Validation
```bash
activity trace-enforce-validate-loop \
  specificationName="email-validation" \
  specificationDescription="Validate emails against RFC 5322" \
  expectedBehavior="Invalid emails rejected with EmailValidationError" \
  validationStrategy="Feed invalid formats, expect rejection"
```

### Security
```bash
activity trace-enforce-validate-loop \
  specificationName="auth-required" \
  specificationDescription="All API endpoints require authentication" \
  expectedBehavior="Unauthenticated requests return 401" \
  validationStrategy="Call without token, expect 401"
```

### Performance
```bash
activity trace-enforce-validate-loop \
  specificationName="response-time" \
  specificationDescription="API p95 latency < 500ms" \
  expectedBehavior="95% of requests under 500ms" \
  validationStrategy="Run 100 requests, measure p95"
```

### Business Logic
```bash
activity trace-enforce-validate-loop \
  specificationName="budget-validation" \
  specificationDescription="Activities must not exceed budget limits" \
  expectedBehavior="Throw BudgetExceededError if cost > budget" \
  validationStrategy="Run with budget=5, cost=10, expect error"
```

---

## Key Features

### ✅ Deterministic Validation (No LLM!)
```typescript
// Historical expected value (impulse)
const expected = loadImpulse("validation-{spec}-case-1");

// Run actual code
const actual = await runValidation(expected.input);

// Deterministic comparison (FAST!)
const pass = actual === expected.output;
```

### ✅ Automatic Conflict Detection
```json
{
  "conflict": {
    "spec1": "budget-validation",
    "spec2": "unrestricted-admin",
    "resolution": "Conditional validation by user role"
  }
}
```

### ✅ Knowledge Preservation
Every spec creates **7 impulses** documenting:
- What was traced
- What was enforced
- How it's validated
- Conflicts found
- Changes rippled
- Why decisions made

### ✅ Ripple Changes
Changes automatically propagate:
```
Entry → Validation → Transform → Logic → Persist → Response
  ↓         ↓           ↓          ↓        ↓         ↓
UPDATE    UPDATE      UPDATE     UPDATE   UPDATE   UPDATE
```

---

## Continuous Verification

### CI/CD
```yaml
jobs:
  verify-specs:
    steps:
      - run: |
          for harness in tests/validation-harnesses/*; do
            bun run $harness || exit 1
          done
```

### Pre-commit
```bash
#!/bin/bash
for harness in tests/validation-harnesses/*; do
  bun run $harness || exit 1
done
```

---

## What You Get

### Per Specification:
- ✅ Code enforcement (mutations applied)
- ✅ Validation harness (deterministic, LLM-independent)
- ✅ Test cases (expected values as impulses)
- ✅ Conflict analysis (checked against all other specs)
- ✅ Ripple changes (consistency across components)
- ✅ Git commit with tag `spec-{name}-v1`
- ✅ 7 impulses (complete knowledge preservation)

### System-Wide:
- ✅ **Zero drift** between requirements and code
- ✅ **Proactive conflict detection** (before bugs)
- ✅ **Deterministic verification** (CI/CD friendly)
- ✅ **Knowledge accumulation** (impulses grow over time)
- ✅ **Evolutionary codebase** (self-correcting)

---

## Success Metrics

| Metric | Traditional | Your System |
|--------|------------|-------------|
| Requirements → Code | Manual, error-prone | Automatic, correct |
| Conflict Detection | Bugs in production | Before merge |
| Validation Speed | Slow (LLM calls) | Fast (deterministic) |
| Knowledge Preservation | Lost over time | Preserved in impulses |
| Drift Prevention | Inevitable | Impossible |

---

## Documentation

- **Architecture:** `FUNCTIONAL_STATE_LOOP_ARCHITECTURE.md` (19K, comprehensive)
- **Quick Start:** `FUNCTIONAL_STATE_LOOP_QUICKSTART.md` (13K, examples)
- **Implementation:** `TRACE_ENFORCE_VALIDATE_LOOP_IMPLEMENTATION_COMPLETE.md` (summary)
- **This Card:** `TRACE_ENFORCE_VALIDATE_QUICK_REFERENCE.md` (you are here)

---

## Template Details

- **ID:** `trace-enforce-validate-loop`
- **Category:** infrastructure
- **File:** `templates/functional-state/trace-enforce-validate-loop.json`
- **Size:** 17K, 7 tasks
- **Status:** ✅ Registered (local + Metabob MCP)

---

## The Magic: Instructional ↔ Functional State Bridge

```
Traditional Development:
  Requirements (instructional) ─ ❌ ─→ Code (functional)
  [Manual translation, drift inevitable]

Your System:
  Requirements (instructional) ←─ ✅ ─→ Code (functional)
  [Activity loop keeps them synchronized]
```

**How:**
1. Requirements expressed as specifications
2. System traces current implementation
3. Code mutations enforce requirements
4. Harnesses validate enforcement deterministically
5. Conflicts detected and resolved
6. Changes ripple across components
7. Both states transition together, synchronized

**Result:** Requirements and code can't drift - they're locked together by deterministic validation.

---

## Next Step

**Pick a requirement and run it:**

```bash
activity trace-enforce-validate-loop \
  specificationName="YOUR-FIRST-SPEC" \
  specificationDescription="..." \
  expectedBehavior="..." \
  validationStrategy="..."
```

**Watch the 7 phases execute. Your codebase just evolved.** 🚀
