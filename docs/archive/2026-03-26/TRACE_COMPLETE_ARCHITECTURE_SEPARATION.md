# Trace Analysis: Complete Architecture Separation

## Specification
**Name:** complete-architecture-separation

**Description:** The three-component architecture has clean separation: metabob-opencode (execution + coordination), metabob-cli (data collection + enrichment + gateway), metabob-rpc-api (ML training + metrics + storage).

---

## Executive Summary

✅ **Trace Complete** - Full analysis of architecture separation specification

**Status:** VIOLATIONS FOUND - ML logic present in execution layer

**Critical Issues:** 3 violations requiring immediate action
- 1 CRITICAL: Full Thompson Sampling implementation in metabob-opencode
- 2 MEDIUM: Metric calculations and selection logic in execution layer
- 1 LOW: Acceptable data passing in CLI gateway (no action needed)

---

## Current State Analysis

### Violations Found

#### 1. CRITICAL: Thompson Sampling in metabob-opencode
**File:** `repos/metabob-opencode/packages/opencode/src/ml/thompson-sampler.ts`
**Lines:** 1-451 (entire file)
**Issue:** Contains full Thompson Sampling implementation with Beta distribution calculations

**Evidence:**
- `ThompsonSampler` class with `select()` and `update()` methods
- `sampleBeta()` and `sampleGamma()` statistical sampling functions
- `ModelArm` storage interface with alpha/beta parameters
- 451 lines of ML logic in execution layer

**Why This Matters:** Thompson Sampling is ML/learning logic that must only exist in the RPC API layer, not in the execution/coordination layer.

#### 2. MEDIUM: Template Selection Metadata in metabob-opencode
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`
**Lines:** 54-273
**Issue:** References `thompson_sampling` method and stores `thompsonSampling` metadata

**Evidence:**
- `SelectionResult["thompsonSampling"]` interface with alpha/beta fields
- `method: "thompson_sampling" | "fallback" | "direct_load"` enum
- Selection logic that references Thompson Sampling algorithm

**Why This Matters:** While storing selection results is acceptable, the execution layer should not reference ML algorithm details.

#### 3. MEDIUM: Metric Calculations in Activity Tool
**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
**Lines:** 1051-1056, 1377-1382
**Issue:** Calculates thompsonAlpha, thompsonBeta, and allocationWeight locally

**Evidence:**
```typescript
const thompsonAlpha = successCount + 1
const thompsonBeta = failureCount + 1
const allocationWeight = thompsonAlpha / (thompsonAlpha + thompsonBeta)
```

**Why This Matters:** Metric calculation using ML formulas should happen in RPC API, not opencode.

#### 4. LOW: Data Passing in metabob-cli (ACCEPTABLE)
**File:** `repos/metabob-cli/src/metabob_cli/mcp/api_validation.py`
**Lines:** 31-32
**Issue:** Exposes `thompson_alpha` and `thompson_beta` fields

**Status:** ✅ NO ACTION NEEDED
**Why:** This is data passing/validation only, not computation. CLI correctly acts as gateway.

---

## Desired State

### Component Roles

#### 1. metabob-opencode: Execution + Coordination
**Responsibilities:**
- Activity orchestration and task execution
- Session management and prompt construction
- Tool invocation and result handling
- Template selection coordination (call API, use result)

**Prohibitions:**
- ❌ ZERO Thompson Sampling implementation
- ❌ ZERO Beta distribution calculations
- ❌ ZERO ML training or learning algorithms
- ❌ ZERO pattern extraction logic
- ❌ ZERO direct metric calculations

**Data Flow:** opencode → MCP tools → CLI gateway → RPC API

#### 2. metabob-cli: Data Collection + Enrichment + MCP Gateway
**Responsibilities:**
- Expose MCP tools for opencode consumption
- Proxy HTTP requests to metabob-rpc-api
- Enrich data with context (file paths, component names)
- Validate API responses before returning to opencode
- Handle API errors gracefully with fallbacks

**Prohibitions:**
- ❌ ZERO Thompson Sampling implementation
- ❌ ZERO training logic or model updates
- ❌ ZERO pattern extraction (only data collection)
- ❌ ZERO direct SurrealDB access (only via RPC API)

**Data Flow:** MCP tools ← opencode | CLI → HTTP REST → RPC API

#### 3. metabob-rpc-api: ML Training + Metrics + Storage
**Responsibilities:**
- Thompson Sampling for template selection
- Activity execution storage in SurrealDB
- Template metrics aggregation and caching
- Pattern extraction from execution data
- Learning loop: execution → patterns → metrics → selection

**Data Flow:** HTTP REST ← CLI | RPC API → SurrealDB

---

## Data Flow Analysis

### Current (INCORRECT):
```
opencode (thompson-sampler.ts) → direct Beta sampling → local ModelArm storage
```

### Desired (CORRECT):
```
opencode → MCP call → CLI (api_client.py) → HTTP POST /api/templates/select 
        → RPC API (activity.py::select_variant_thompson_sampling) → SurrealDB
```

### Template Lifecycle

1. **Creation:**
   ```
   opencode creates template → POST /api/templates 
   → RPC API stores in SurrealDB with variant_id
   ```

2. **Selection:**
   ```
   opencode requests template → GET /api/templates/select/{activity_id} 
   → RPC API runs Thompson Sampling → returns selected variant
   ```

3. **Execution:**
   ```
   opencode executes activity → records metrics locally 
   → POST /api/activity-execution → RPC API stores and updates metrics
   ```

4. **Learning:**
   ```
   RPC API background job → aggregate executions 
   → update template_metrics table → Thompson Sampling uses updated metrics
   ```

---

## Critical Changes Required

### [PRIORITY 1] Delete thompson-sampler.ts
**Action:** Remove `repos/metabob-opencode/packages/opencode/src/ml/thompson-sampler.ts` entirely

**Reason:** Thompson Sampling must only exist in RPC API, not execution layer

**Impact:** Removes 451 lines of ML logic from opencode

**Replacement:** Call `/api/templates/select` endpoint via MCP tools

### [PRIORITY 2] Refactor template-selector.ts
**Action:** Refactor to call RPC API instead of local Thompson Sampling

**Reason:** Template selection must be coordinated via API, not computed locally

**Impact:** Changes selection flow from local computation to API call

**Changes:**
- Remove `thompsonSampling` calculation logic
- Keep only result metadata storage
- Add API client call to RPC API endpoint

### [PRIORITY 3] Remove Metric Calculations from activity.ts
**Action:** Remove `thompsonAlpha`/`thompsonBeta` calculations (lines 1051-1056, 1377-1382)

**Reason:** Metrics calculation must happen in RPC API, not opencode

**Impact:** Simplifies activity tool to pure execution tracking

**Replacement:** POST execution results to `/api/activity-execution`, let RPC API calculate metrics

---

## Validation Checks

### 1. Verify Zero ML Keywords in opencode
```bash
grep -r 'thompson|beta_distribution|pattern_extraction' \
  repos/metabob-opencode/packages/opencode/src --include='*.ts' | \
  grep -v 'thompsonSampling:' | grep -v '// Reference'
```
**Expected:** EMPTY (zero ML keywords except metadata references)

### 2. Verify Zero Training Logic in CLI
```bash
grep -r 'train|fit_model|sampleBeta|sampleGamma' \
  repos/metabob-cli/src --include='*.py'
```
**Expected:** EMPTY (zero training logic)

### 3. Verify All Thompson Sampling in RPC API
```bash
grep -r 'select_variant_thompson_sampling|thompson_alpha|thompson_beta' \
  repos/metabob-rpc-api/server --include='*.py' | wc -l
```
**Expected:** >50 (all Thompson Sampling logic in RPC API)

### 4. Verify Data Flow via HTTP
```bash
grep -r 'http://localhost:8080|METABOB_RPC_API_URL' \
  repos/metabob-cli/src --include='*.py' | wc -l
```
**Expected:** >5 (CLI makes HTTP calls to RPC API)

---

## Component-by-Component Analysis

| File | Component | Current Behavior | Desired Behavior | Gap |
|------|-----------|------------------|------------------|-----|
| `repos/metabob-opencode/packages/opencode/src/ml/thompson-sampler.ts` | ThompsonSampler class | Full Thompson Sampling implementation | **DELETED** | Remove entire file, use API |
| `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts` | selectTemplate function | Contains thompsonSampling metadata | Pure API client | Remove calculation logic |
| `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` | Activity tool metrics | Calculates thompsonAlpha/Beta | POST to API only | Remove metric calculations |
| `repos/metabob-cli/src/metabob_cli/mcp/api_validation.py` | ActivityTemplateMetrics | Exposes thompson_alpha/beta | Keep as-is | **NO CHANGE** |
| `repos/metabob-cli/src/metabob_cli/mcp/api_client.py` | call_api function | Proxies HTTP to RPC API | Same | **NO CHANGE** |
| `repos/metabob-rpc-api/server/actions/activity.py` | select_variant_thompson_sampling | Implements Thompson Sampling | Same | **NO CHANGE** |
| `repos/metabob-rpc-api/server/services/pattern_extraction_service.py` | Pattern extraction | Extracts patterns from data | Same | **NO CHANGE** |

---

## Next Steps

1. ✅ **Trace Complete** - Create impulse for downstream tasks
   - Impulse ID: `trace-complete-architecture-separation`
   - Location: `impulses/trace-complete-architecture-separation.json`
   - Budget: 5000 tokens

2. 🔜 **Create Enforcement Activity** - Validate separation rules
   - Check for ML keywords in opencode
   - Verify data flow through API calls
   - Report violations with file/line numbers

3. 🔜 **Create Migration Activity** - Remove ML logic from opencode
   - Delete thompson-sampler.ts
   - Refactor template-selector.ts
   - Update activity.ts to use API

4. 🔜 **Update API Contracts** - Document component boundaries
   - Define clear API contracts
   - Add integration tests for data flow
   - Document prohibited patterns

---

## Impulse Created

**ID:** `trace-complete-architecture-separation`
**Type:** `templateDefinition`
**Location:** `impulses/trace-complete-architecture-separation.json`
**Budget:** 5000 tokens
**Tags:** trace, architecture, separation, validation, complete-architecture-separation

**Content:** Full trace analysis with:
- Current state violations
- Desired state specifications
- Component roles and responsibilities
- Data flow diagrams
- Critical changes required
- Validation checks
- Component-by-component gap analysis

**Ready for:** Downstream validation and enforcement tasks

---

## Summary

✅ **Trace Complete:** Full analysis of complete-architecture-separation specification

**Key Findings:**
- 1 CRITICAL violation: thompson-sampler.ts contains 451 lines of ML logic in execution layer
- 2 MEDIUM violations: template-selector.ts and activity.ts contain metric calculations
- 1 LOW issue (acceptable): api_validation.py correctly passes data without computation

**Architecture Status:**
- ✅ metabob-rpc-api: Correctly implements all ML/learning logic
- ✅ metabob-cli: Correctly acts as gateway with data validation
- ❌ metabob-opencode: Contains ML logic that must be moved to RPC API

**Next Action:** Run enforcement activity to validate and report violations in detail
