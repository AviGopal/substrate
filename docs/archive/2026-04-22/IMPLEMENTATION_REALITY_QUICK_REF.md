# Implementation Reality: Quick Reference

**Last Updated**: 2026-04-08
**Purpose**: One-page truth table for what's actually implemented

---

## The Big Corrections

### ✅ CORRECTION: Manual Feedback WORKS (not broken!)

**Previous assumption**: `/teach` and `/warn` commands fail silently (404)
**Reality**: Fully implemented, production-ready, endpoint exists and functions correctly

**Verify**:
```bash
curl -X POST https://activity.metabob.com/v2/activities/feedback \
  -H "Authorization: Bearer $JWT" \
  -d '{"activity_id":"test","direction":"positive","intensity":0}'
# Returns 200 OK with affected_activities list
```

**Location**: `repos/metabob-activity-api/src/routes/activities.ts:2429-2680`

---

## What Works vs What We Document

| Feature | Documented | Actually Implemented | Status | Evidence |
|---------|-----------|----------------------|--------|----------|
| **Thompson Sampling** | ✅ | ✅ Beta(α,β) sampling | ✅ | 22+ tests pass |
| **Manual feedback** | ✅ | ✅ POST /feedback endpoint | ✅ | Line 2429 in activities.ts |
| **Impulse resolution** | ✅ | ✅ 10-layer dispatch | ✅⚠️ | Line 257-530 in impulse.ts |
| **Shape inference** | ✅ | ✅ Regex + emergent | ✅⚠️ | shape-inference.ts |
| **Missing impulse discovery** | ✅ | ✅ Bayesian P(success\|loaded) | ✅ | impulse-relevancy.ts:170-257 |
| **Shape-based routing** | ✅ | ❌ Uses pointer.type instead | ⚠️ | Pointer type dispatch only |
| **External validation feedback** | ✅ | ⚠️ Validation exists, no loop | ⚠️ | CI/CD doesn't POST results |
| **Cascading impulse loads** | ✅ | ❌ Not implemented | ❌ | Only parallel loading |
| **EnvironmentScanner** | ✅ | ❌ Doesn't exist | ❌ | LLM suggestions only |
| **Automatic variant creation** | ✅ | ❌ Manual ribosome only | ❌ | No triggers |

---

## Manual Feedback Intensity Mapping

| Command | Intensity | Multiplier | Use Case |
|---------|-----------|------------|----------|
| `/teach` or `/warn` | 0 | 1.5x | Mild correction |
| `/teach!` or `/warn!` | 0 | 1.5x | Same as above |
| `/teach!!` or `/warn!!` | 1 | 2.0x | Strong feedback |
| `/teach!!!` or `/warn!!!` | 2 | 2.5x | Very strong |
| `/teach!!!!` or `/warn!!!!` | 3 | 3.0x | Maximum (rare) |

**Direction**:
- `positive` (teach): Multiplies α (success count)
- `negative` (warn): Multiplies β (failure count)

**Adjacent boosting**:
- ✅ Positive feedback boosts adjacent activities (1.25x multiplier)
- ❌ Negative feedback does NOT penalize adjacent (warnings are specific)

---

## Impulse Resolution Dispatch (10 Layers)

**Verified**: All 10 layers implemented (`impulse.ts:257-530`)

| Priority | Type | Resolved By | Line # |
|----------|------|-------------|--------|
| 1 | `memo` | Local (embedded) | 259 |
| 2 | `file` | Local (filesystem) | 264 |
| 3 | `directoryTree` | Local (Bun.Glob) | 291 |
| 4 | `gitDiff` | Local (git) | 343 |
| 5 | `toolList` | Local (registry) | 356 |
| 6 | `packageConfig` | Local (package.json) | 366 |
| 7 | Custom resolvers | Vessel-specific | 391-408 |
| 8 | Vessel discovery | HTTP capability | 410-480 |
| 9 | Backend MCP | metabob-activity-api | 482-501 |
| 10 | Fallback | activityOutput | 503-517 |

**Key insight**: Routes by `pointer.type`, NOT by `metadata.shape`

---

## Shape Inference: What It Actually Does

**Implemented**: Regex patterns + emergent learning (`shape-inference.ts`)

**11 Canonical Shapes** (bootstrap):
1. `goal` - User intent
2. `error` - Error messages, stack traces
3. `source_code` - Code files
4. `test_suite` - Test files, specs
5. `documentation` - README, docs
6. `configuration` - Config files (JSON, YAML, TOML)
7. `dependency` - package.json, requirements.txt
8. `environment` - .env, secrets
9. `build_artifact` - Compiled output
10. `log` - Application logs
11. `performance` - Metrics, traces

**Emergent shapes**: Learned from executions (not predefined)

**What shapes are used for**:
- ✅ Activity selection (Thompson Sampling)
- ✅ Relevance scoring
- ✅ Intent classification

**What shapes are NOT used for**:
- ❌ Resolver routing (pointer.type does this)
- ❌ Content loading (pointer.path does this)

---

## Thompson Sampling: Beta Distribution Parameters

**Formula**: `Beta(α, β)` where:
- `α` = success count + 1 (prior)
- `β` = failure count + 1 (prior)

**Shape-conditioned**: Each activity has separate α/β for each input shape combination

**Example**:
```sql
Activity "debug-null-pointer":
  - With shapes ['error', 'source_code']: α=15, β=3 (83% success)
  - With shapes ['goal'] alone: α=5, β=8 (38% success)

System learns: This activity NEEDS error + source_code to succeed!
```

**Sampling**:
```typescript
// For each activity:
const sample = beta(alpha, beta)  // Sample from Beta distribution
// Select activity with highest sample value
```

**Exploration vs Exploitation**:
- Low confidence (α≈β): High variance → explores
- High confidence (α>>β or β>>α): Low variance → exploits

---

## External Validation: Four Layers

| Layer | Status | Feedback Loop | Location |
|-------|--------|---------------|----------|
| 1. Local | ✅ Implemented | ✅ Immediate | search-first-executor.ts:1037-1113 |
| 2. Integration | ⚠️ SearchFirst only | ✅ Immediate | search-first-executor.ts:1122-1161 |
| 3. Deployment | ✅ CI/CD validates | ❌ No feedback | deploy-canary.yml:488-553 |
| 4. Production | ⚠️ Minimal monitoring | ❌ No feedback | Basic health checks |

**Gap**: Layers 3 and 4 validate but don't report results to backend

**Missing**:
```yaml
# deploy-canary.yml should POST results
- name: Report CI result
  run: |
    curl -X POST https://activity.metabob.com/v2/activities/ci-result \
      -H "Authorization: Bearer $JWT" \
      -d '{"template_id":"$ID","result":"$STATUS","stage":"canary"}'
```

---

## Test Coverage Snapshot

| Component | Unit Tests | Integration Tests | Coverage |
|-----------|-----------|-------------------|----------|
| Thompson Sampling | ✅ 22+ | ✅ E2E flow | HIGH |
| Manual feedback | ✅ Server | ❌ Client | MEDIUM |
| Impulse resolution | ⚠️ Partial | ❌ None | LOW |
| Shape inference | ✅ Integrated | ✅ Activity tests | MEDIUM |
| External validation | ❌ None | ⚠️ SearchFirst | LOW |
| Dashboard | ❌ None | ❌ None | ZERO |
| Vessel discovery | ❌ None | ❌ None | ZERO |

---

## Common Misconceptions Corrected

### ❌ WRONG: "Manual feedback is broken"
✅ **CORRECT**: Fully implemented, production-ready, use it!

### ❌ WRONG: "Shape-based routing routes impulses to resolvers"
✅ **CORRECT**: Shapes select activities. Pointer types select resolvers.

### ❌ WRONG: "EnvironmentScanner proactively discovers context"
✅ **CORRECT**: LLM suggests context ad-hoc, no scanner component exists.

### ❌ WRONG: "Cascading loads resolve dependencies"
✅ **CORRECT**: All impulses loaded in parallel, no cascading.

### ❌ WRONG: "Variant creation is automatic"
✅ **CORRECT**: Ribosome extraction is manual, no automatic triggers.

### ❌ WRONG: "CI/CD failures update Thompson Sampling"
✅ **CORRECT**: CI/CD validates but doesn't report back to backend.

---

## How to Verify Claims

### Endpoint Exists?
```bash
grep -n "app.post('/feedback'" repos/metabob-activity-api/src/routes/activities.ts
# If line number returned: ✅ Endpoint exists
```

### Route Mounted?
```bash
grep -n "app.route('/v2/activities', activitiesRoutes)" repos/metabob-activity-api/src/index.ts
# If line number returned: ✅ Route mounted
```

### Tests Exist?
```bash
bun test repos/metabob-activity-api/src/routes/activities.test.ts
# If tests pass: ✅ Tested
```

### Deployed?
```bash
curl https://activity.metabob.com/health
# If 200 OK: ✅ Deployed
```

---

## File Location Quick Reference

| Feature | Primary File | Line Range |
|---------|-------------|------------|
| Thompson Sampling | `metabob-activity-api/src/routes/activities.ts` | 2786-2856 |
| Manual feedback | `metabob-activity-api/src/routes/activities.ts` | 2429-2680 |
| Impulse resolution | `minibob/src/impulse.ts` | 257-530 |
| Shape inference | `metabob-activity-api/src/utils/shape-inference.ts` | Full file |
| Missing impulse discovery | `metabob-activity-api/src/utils/impulse-relevancy.ts` | 170-257 |
| External validation | `minibob/src/search-first-executor.ts` | 1037-1161 |
| CI/CD validation | `deployment/.github/workflows/deploy-canary.yml` | 488-553 |

---

## When in Doubt

1. **Read the code** - Don't trust documentation alone
2. **Check the tests** - If tests exist and pass, feature likely works
3. **Verify endpoints** - `curl` is your friend
4. **Consult this doc** - Cross-reference claims

---

**Last verified**: 2026-04-08
**Audit source**: `docs/IMPLEMENTATION_AUDIT_2026-04-08.md`
**Reality analysis**: `docs/architecture/IMPLEMENTATION_REALITY_IDIOMS.md`
**Scenarios**: `docs/architecture/REALITY_CHECK_SCENARIOS.md`
