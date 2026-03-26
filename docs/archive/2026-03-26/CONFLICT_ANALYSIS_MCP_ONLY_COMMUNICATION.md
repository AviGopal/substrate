# Conflict Analysis: MCP-Only Communication

**Specification**: metabob-opencode must ONLY communicate via metabob-cli MCP server, never direct HTTP to backend

**Analysis Date**: 2026-03-02

**Overall Status**: ✅ **NO ACTIVE CONFLICTS** (1 resolved supersession)

---

## Executive Summary

The MCP-Only Communication specification successfully resolved a previous architectural inconsistency by replacing direct HTTP calls with MCP tool usage. One conflict was detected and resolved through temporal supersession - the later enforcement (MCP approach) replaced the earlier enforcement (direct HTTP approach).

**Key Finding**: MCP-Only Communication **supersedes** the "Activity Execution Recording" direct HTTP approach, creating a cleaner architectural boundary and aligning with MCP-based integration patterns throughout metabob-opencode.

---

## Other Specifications Analyzed

1. **Activity Execution Recording and Metrics Feedback Loop** ⚠️ Superseded
2. **metrics-calculation-in-rpc-api-only** ✅ Complementary
3. **thompson-sampling-in-rpc-api-only** ✅ Complementary (exception documented)
4. **impulse-learning-storage-complete** ✅ Compatible
5. **complete-architecture-separation** ✅ Compatible
6. **surrealdb-primary-redis-cache** ✅ Compatible
7. **context-optimization-endpoint-complete** ✅ Compatible
8. **bootstrap-template-filepath-compliance** ✅ Compatible
9. **project-scoped-template-filtering** ✅ Compatible

---

## Conflicts Detected

### Conflict 1: RESOLVED - Superseded Previous Specification

**Type**: `RESOLVED_SUPERSEDED`

**Specs Involved**:
- **Spec 1**: MCP-Only Communication (enforced 2026-03-02 20:11)
- **Spec 2**: Activity Execution Recording and Metrics Feedback Loop (enforced 2026-03-02 19:48)

**Shared Component**: `template-metrics-client.ts::reportExecution()`

**Description**:

Activity Execution Recording enforced a direct HTTP POST approach at 19:48. MCP-Only Communication enforced MCP tool usage at 20:11. The later enforcement supersedes the earlier one.

**Timeline**:

1. **2026-03-02 19:48** - Activity Execution Recording enforced
   - Approach: Direct `fetch()` to `http://metabog-rpc-api:8000/api/v1/learning-loop/executions`
   - File: `ENFORCEMENT_ACTIVITY_EXECUTION_RECORDING.md`
   - Rationale: MCP tool `metabob_post_activity_result` did not exist

2. **2026-03-02 20:11** - MCP-Only Communication enforced
   - Approach: `callMCPTool('post_activity_result', {...})`
   - File: `ENFORCEMENT_MCP_ONLY_COMMUNICATION.md`
   - Rationale: Clean architectural boundary, centralized error handling

**Resolution**:

✅ MCP-Only Communication is the **current enforced specification**. The direct HTTP approach was replaced with MCP tool invocation.

**Current State**:
```typescript
// Current (MCP approach)
const result = await callMCPTool<{ success: boolean; ... }>(
  "post_activity_result",
  {
    activityId: data.activity_id,
    result: { success, duration, cost, tokens },
    backend: "all",
  },
)
```

**Previous State** (superseded):
```typescript
// Previous (Direct HTTP approach)
const response = await fetch(`${backendURL}/api/v1/learning-loop/executions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestBody),
})
```

**Impact**: ✅ **POSITIVE** - Cleaner architectural boundary

---

## Complementary Relationships

### Relationship 1: MCP-Only Communication ↔ metrics-calculation-in-rpc-api-only

**Type**: `ALIGNED`

**Shared Component**: `template-metrics-client.ts`

**Description**:

Both specifications enforce that opencode is a thin client:
- **MCP-Only Communication** enforces **HOW** to communicate (via MCP layer)
- **metrics-calculation-in-rpc-api-only** enforces **WHAT** to communicate (raw data, not calculations)

**Resolution**: Specifications complement each other - MCP handles transport, metrics spec handles content

**Impact**: ✅ POSITIVE

---

### Relationship 2: MCP-Only Communication ↔ thompson-sampling-in-rpc-api-only

**Type**: `ALIGNED`

**Shared Component**: `rpc-http-client.ts` (acceptable exception)

**Description**:

Thompson Sampling exception is explicitly documented in MCP-Only Communication validation (test case 5). Thompson sampling requires real-time ML decision from backend, which is a different use case than metrics reporting.

**Resolution**: Exception explicitly documented and validated

**Impact**: ⚪ NEUTRAL - Exception is acceptable

---

## Shared Components

### Component 1: template-metrics-client.ts::reportExecution()

**Affected By**:
- MCP-Only Communication
- Activity Execution Recording and Metrics Feedback Loop
- metrics-calculation-in-rpc-api-only

**Current State**: Uses `callMCPTool('post_activity_result')` - MCP approach

**Previous State**: Used direct `fetch()` to backend - HTTP approach

**Conflict Status**: ✅ RESOLVED

**Recommendation**: Keep current MCP approach - cleaner architecture

**Enforcement History**:
1. 2026-03-02 19:48 - Activity Execution Recording → Direct HTTP
2. 2026-03-02 20:11 - MCP-Only Communication → MCP tool (current)

---

### Component 2: boredom-manager.ts

**Affected By**:
- MCP-Only Communication

**Current State**: Uses `TemplateMetricsClient.reportExecution()` abstraction

**Previous State**: Used direct MCP call with wrong tool name `metabob_post_activity_result`

**Conflict Status**: ✅ NONE

**Recommendation**: No changes needed - abstraction maintained

---

### Component 3: rpc-http-client.ts

**Affected By**:
- MCP-Only Communication (acceptable exception)
- thompson-sampling-in-rpc-api-only

**Current State**: Uses direct HTTP for Thompson Sampling

**Conflict Status**: ✅ NONE

**Recommendation**: Keep as acceptable exception - different use case (ML real-time decisions)

---

## Overlapping Requirements

### Requirement 1: Metrics must be sent to backend

**Specified By**:
- MCP-Only Communication
- Activity Execution Recording and Metrics Feedback Loop
- metrics-calculation-in-rpc-api-only

**Compliance**: ✅ FULLY_COMPLIANT

**Evidence**: Metrics are sent via MCP tool which routes to backend `/api/v1/learning-loop/executions` endpoint

**Approach**: `MCP tool 'post_activity_result' → metabob-cli → backend API`

---

### Requirement 2: No direct HTTP to backend (except Thompson Sampling)

**Specified By**:
- MCP-Only Communication

**Compliance**: ✅ FULLY_COMPLIANT

**Evidence**: `template-metrics-client.ts` uses MCP, only `rpc-http-client.ts` uses direct HTTP (acceptable)

**Approach**: All metrics reporting routes through MCP layer

---

### Requirement 3: Thompson sampling must function

**Specified By**:
- thompson-sampling-in-rpc-api-only
- MCP-Only Communication (exception)

**Compliance**: ✅ FULLY_COMPLIANT

**Evidence**: Thompson Sampling exception documented in test case 5, verified in validation

**Approach**: Direct HTTP acceptable for ML real-time decisions

---

## Architectural Evolution

### Phase 1: Direct HTTP Approach

**Date**: 2026-03-02 19:48

**Specification**: Activity Execution Recording and Metrics Feedback Loop

**Approach**: Direct HTTP POST

**Rationale**: MCP tool `metabob_post_activity_result` did not exist, backend API was ready

**Data Flow**:
```
opencode → direct HTTP → metabob-rpc-api
```

---

### Phase 2: MCP Tool Approach (Current)

**Date**: 2026-03-02 20:11

**Specification**: MCP-Only Communication

**Approach**: MCP tool `post_activity_result`

**Rationale**: Enforce clean architectural boundary, centralized error handling

**Data Flow**:
```
opencode → MCP → metabob-cli → metabob-rpc-api
```

---

### Transition Analysis

**Breaking Change**: ❌ No

**Reason**: Both approaches hit the same backend endpoint, only transport mechanism changed

**Risk Level**: 🟢 LOW

---

## Impact Assessment

### Positive Impacts

✅ Clean architectural boundary (opencode → MCP → cli → backend)  
✅ Centralized error handling in MCP layer  
✅ Consistent with other Metabob integrations  
✅ Easy mocking for tests  
✅ No direct backend URL coupling  

### Negative Impacts

None detected

### Risk Assessment

| Risk Type | Level | Notes |
|-----------|-------|-------|
| Regression Risk | 🟢 LOW | Interface unchanged, only transport mechanism changed |
| Integration Risk | 🟢 LOW | MCP tool 'post_activity_result' exists and works |
| Deployment Risk | 🟢 LOW | Graceful degradation if MCP unavailable |

---

## Recommendations

### Immediate Actions

1. ✅ Keep MCP-Only Communication as the enforced specification
2. 📁 Archive Activity Execution Recording enforcement (superseded)
3. 🔄 Update Activity Execution Recording validation to expect MCP approach
4. 📝 Document architectural evolution in ARCHITECTURE.md

### Monitoring

- Watch for `metrics reporting successful via MCP` logs
- Monitor MCP tool `post_activity_result` invocations
- Verify backend receives execution data via MCP route
- Check `template_metrics` table for updated metrics

### Future Improvements

- Consider creating unified enforcement tracking system
- Add timestamp-based specification precedence
- Implement conflict detection automation
- Create specification supersession workflow

---

## Conclusion

**Status**: ✅ **NO ACTIVE CONFLICTS**

**Supersession**: MCP-Only Communication supersedes Activity Execution Recording (direct HTTP approach)

**Compatibility**: ✅ FULLY COMPATIBLE with all other specifications

**Risk Level**: 🟢 LOW

**Recommendation**: ✅ **CURRENT ARCHITECTURE VALIDATED**

### Summary

The MCP-Only Communication specification successfully resolved a previous architectural inconsistency by replacing direct HTTP with MCP tool usage. This creates a cleaner architectural boundary and aligns with the MCP-based integration pattern used throughout metabob-opencode.

**No conflicts** with other specifications. Thompson Sampling exception is documented and validated. The current architecture is validated and ready for production.

---

## Related Documents

- `ENFORCEMENT_MCP_ONLY_COMMUNICATION.md` - Current enforcement
- `ENFORCEMENT_ACTIVITY_EXECUTION_RECORDING.md` - Superseded enforcement
- `TRACE_MCP_ONLY_COMMUNICATION.md` - Trace analysis
- `VALIDATION_RESULTS_MCP_ONLY_COMMUNICATION.md` - Validation results
- `CONFLICT_ANALYSIS_SUMMARY.json` - Previous conflict analysis
- `validation-results-thompson-sampling-in-rpc-api-only.json` - Thompson Sampling validation
- `validation-results-metrics-calculation-in-rpc-api-only.json` - Metrics calculation validation

---

**Conflict Analysis Complete** ✅
