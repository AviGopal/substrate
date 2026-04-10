# Vessel Integration Standardization - Revision Summary

## Date: 2026-04-10

This document summarizes all revisions made to fix critical and major issues identified in the OpenSpec review.

---

## NEW FILES CREATED

### 1. specs/impulse-resolution-vessel-direct/spec.md
**Purpose**: Delta spec documenting modifications to impulse-resolution capability

**Key content**:
- Three-tier fallback chain: local → vessel-direct → backend-routing
- Discovery integration for finding capable vessels
- Circuit breaker filtering during vessel selection
- Execution trace extensions (resolution_tier, resolved_by_vessel_id)
- Configuration schema for discovery and vessel endpoints

### 2. specs/activity-execution-coordination-traces/spec.md
**Purpose**: Delta spec documenting modifications to activity-execution capability

**Key content**:
- New trace fields: resolved_by_vessel_id, impulse_resolutions array
- Routing trace schema (discovery queries, vessel selection)
- Circuit breaker trace schema (state transitions)
- Health score computation algorithm with formula
- Trace sampling strategy (100% failures, 10% successes)
- Retention policy (7 days raw, 90 days aggregated, indefinite for patterns)

---

## CRITICAL ISSUES FIXED

### Issue #1: Vessel Discovery Architecture Mismatch

**Files modified**:
- `specs/vessel-discovery/spec.md`

**Changes**:
- ✅ Changed from "standalone vessel" to "Activity-API endpoints"
- ✅ Updated all references to reflect `/v2/vessels/*` endpoints in Activity-API
- ✅ Added shape registry integration requirement
- ✅ Clarified discovery queries shape registry for compatibility
- ✅ Deprecated impulse-based discovery (now REST endpoints)

### Issue #2: Missing Delta Specs

**Files created**:
- ✅ `specs/impulse-resolution-vessel-direct/spec.md` - Documents modified impulse-resolution capability
- ✅ `specs/activity-execution-coordination-traces/spec.md` - Documents modified activity-execution capability

### Issue #3: Circuit Breaker Threshold Inconsistencies

**Files modified**:
- `design.md` (Risk 3, line ~469)
- `specs/cross-vessel-protocol/spec.md` (Scenario: Transition to OPEN)
- `tasks.md` (Task 10.3)

**Standardized to**:
```
Circuit breaker opens when EITHER:
- 5 consecutive failures occur
- OR failure rate ≥ 50% over 60-second window
```

### Issue #4: Dual-Role Authentication Pattern

**Files modified**:
- `design.md` (Decision 1)
- `specs/vessel-authentication/spec.md`

**Added**:
- Explanation of Analysis-API dual-role pattern:
  1. As a Vessel: mTLS + API key (vessel-to-vessel)
  2. As Backend Recipient: API key only (internal service mesh)
- Scenarios showing authentication mode detection
- Configuration examples for both modes

### Issue #5: Phase Dependencies Over-Complexity

**Files modified**:
- `tasks.md`

**Changes**:
- ✅ Added "Implementation Philosophy" section at top
- ✅ Clarified: "Implement in logical dependency order"
- ✅ Removed strict phasing barriers: "Phases can overlap if dependencies satisfied"
- ✅ Eliminated backward compatibility concerns: "Focus on correctness, not migration paths"

---

## MAJOR INCONSISTENCIES FIXED

### Issue #6: Field Naming Standardization

**Files modified**:
- `specs/cross-vessel-protocol/spec.md`

**Standardized**:
- Database/SurrealDB: `snake_case` (vessel_id, org_id, created_at)
- HTTP API JSON: `camelCase` (vesselId, orgId, createdAt)
- Added note about transformation at boundaries

### Issue #7: Protocol Versioning in Authentication

**Files modified**:
- `specs/vessel-authentication/spec.md`

**Added**:
- Requirement: Protocol version validation
- Scenario: Protocol version mismatch (returns 400 with supported versions)
- Scenario: Compatible protocol version (processes normally)
- Scenario: Missing version header (defaults to 2.0 with warning)

### Issue #8: Shape Registry Relationship Clarification

**Files modified**:
- `specs/vessel-discovery/spec.md`

**Added**:
- Requirement: Shape definition lookup integration
- Scenario: Discovery returns shape compatibility information
- Scenario: Shape not registered in registry (404 with suggestion)
- Scenario: Vessel advertises incompatible shape version (warning in results)

### Issue #9: Health Scoring Algorithm Definition

**Files modified**:
- `specs/execution-tracing-integration/spec.md`

**Added**:
- Requirement: Health score computation with exact formula:
  ```
  health_score = (success_rate × 0.5) + (latency_factor × 0.3) + (availability_factor × 0.2)
  ```
- Scenario: Health score below threshold (0.52 example)
- Scenario: Health score drops below 0.3 threshold (routing ineligibility)
- Scenario: Perfect health score (0.97 example)

### Issue #10: Context Acquisition in Goal Orchestrators

**Files modified**:
- `specs/minibob-goal-orchestrators/spec.md`

**Added**:
- Scenario: Test orchestrator acquires error context first
- Scenario: Refactor orchestrator acquires codebase context
- Integration showing context:error-log → test generation flow
- Integration showing context:codebase → refactoring target identification flow

### Issue #11: Error Response Format Standardization

**Files modified**:
- `specs/cross-vessel-protocol/spec.md`
- `specs/analysis-api-direct-integration/spec.md`
- `specs/vessel-discovery/spec.md`

**Standardized format**:
```json
{
  "loaded": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "vessel_id": "...",
      "timeout_ms": 5000,
      "...": "..."
    },
    "retry_after_ms": 30000
  }
}
```

### Issue #12: Missing Error Code

**Files modified**:
- `specs/cross-vessel-protocol/spec.md`

**Added**:
```
| SHAPE_VALIDATION_FAILED | 422 | Content doesn't match shape schema | No | No impact |
```

---

## ADDITIONAL IMPROVEMENTS

### Proposal.md Updates

**Changes**:
- ✅ Updated "Modified Capabilities" section with delta spec references
- ✅ Clarified discovery starts in Activity-API (not standalone service)
- ✅ Removed "New service: Vessel Registry" (starts as Activity-API endpoints)

### Discovery Service Clarification

**Throughout specs**:
- Changed from "discovery-vessel" terminology to "Activity-API discovery endpoints"
- Updated integration patterns to use REST endpoints, not impulse pointers
- Clarified extraction strategy: "Extract to dedicated service when 5+ vessels or query latency > 10ms P99"

---

## CONSISTENCY VERIFICATION

### All specs now align on:

1. **Circuit Breaker Thresholds**: 5 consecutive failures OR ≥50% failure rate over 60s
2. **Error Response Format**: Consistent JSON structure with code, message, details, retry_after_ms
3. **Field Naming**: snake_case in DB, camelCase in HTTP APIs
4. **Authentication Patterns**: Clear distinction between backend-to-vessel (API key) and vessel-to-vessel (mTLS + API key)
5. **Discovery Implementation**: Activity-API endpoints, not standalone service
6. **Health Score Formula**: Weighted average (success × 0.5 + latency × 0.3 + availability × 0.2)
7. **Protocol Versioning**: X-Protocol-Version header validation with clear error messages
8. **Context Acquisition**: Integrated into goal orchestrators as first child activities

---

## FILES MODIFIED SUMMARY

**Modified**: 9 files
**Created**: 3 files (2 delta specs + this summary)

### Modified files:
1. `proposal.md` - Added delta spec references, clarified discovery ownership
2. `design.md` - Added dual-role auth pattern, fixed circuit breaker threshold
3. `tasks.md` - Added implementation philosophy, simplified phasing, fixed circuit breaker task
4. `specs/vessel-discovery/spec.md` - Changed to Activity-API implementation, added shape registry integration
5. `specs/cross-vessel-protocol/spec.md` - Added field naming convention, error code, standardized thresholds
6. `specs/vessel-authentication/spec.md` - Added dual-role pattern, protocol versioning
7. `specs/execution-tracing-integration/spec.md` - Added health scoring algorithm
8. `specs/minibob-goal-orchestrators/spec.md` - Added context acquisition integration scenarios
9. `specs/analysis-api-direct-integration/spec.md` - Standardized error response format

### Created files:
1. `specs/impulse-resolution-vessel-direct/spec.md` - Delta spec for impulse-resolution
2. `specs/activity-execution-coordination-traces/spec.md` - Delta spec for activity-execution
3. `REVISION_SUMMARY.md` (this file)

---

## GUIDING PRINCIPLES APPLIED

All revisions aligned with:

1. ✅ **Correctness over compatibility** - Fixed wrong implementations, didn't support them
2. ✅ **Alignment with foundation** - Every change preserves "resolvers live where data lives"
3. ✅ **Simplicity over phasing** - Removed unnecessary migration complexity
4. ✅ **Consistency over creativity** - Used same patterns everywhere
5. ✅ **Functionality over documentation** - Focused on making specs implementable

---

## VALIDATION CHECKLIST

- [x] All circuit breaker thresholds standardized
- [x] All error responses use consistent format
- [x] All field naming follows convention (snake_case DB, camelCase API)
- [x] Discovery implementation clarified (Activity-API, not standalone)
- [x] Dual-role authentication documented
- [x] Protocol versioning added
- [x] Health scoring algorithm defined
- [x] Context acquisition integrated
- [x] Delta specs created for modified capabilities
- [x] Cross-references updated and consistent

---

## NEXT STEPS

Implementation can proceed using these standardized specifications. All architectural decisions are resolved and consistent across artifacts.
