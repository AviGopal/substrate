# Conflict Analysis: Activity System Runtime Validation with Complete Log Confirmation

## Executive Summary

**Specification**: Activity System Runtime Validation with Complete Log Confirmation
**Analysis Date**: 2026-03-10
**Overall Conflict Status**: ⚠️ ARCHITECTURAL MISALIGNMENT DETECTED

**Key Finding**: The current specification has a fundamental architectural mismatch with the deployed infrastructure, revealing conflicts with multiple validated specifications regarding logging visibility and activity execution patterns.

---

## Specifications Cross-Referenced

1. **Activity System Runtime Validation** (Current - FAILED)
   - Status: FAIL (0/8 patterns found)
   - Issue: kubectl logs isolation, activity not triggered
   
2. **Dynamic Activity Creation DevBob E2E** (PASSED)
   - Status: PASS (8/8 tests)
   - Validated: Activity execution, trailblazing, lifecycle hooks

3. **Complete Architecture Separation** (PASSED)
   - Status: PASS (7/7 tests)
   - Validated: opencode → CLI MCP → RPC API → SurrealDB flow

4. **Activity Template MCP-Only Flow** (PASSED with caveats)
   - Status: ARCHITECTURAL_COMPLIANCE_VERIFIED
   - Issue: CLI invocation differences in containerized environment

---

## Conflict Matrix

### Conflict 1: Logging Visibility Architectural Mismatch

**Type**: CONTRADICTORY_IMPLEMENTATION

**Specification 1**: Activity System Runtime Validation
- **Requirement**: "All 8 lifecycle log patterns visible in kubectl logs output"
- **Implementation Assumption**: kubectl logs captures activity execution logs
- **Status**: FAILED - logs not visible

**Specification 2**: Dynamic Activity Creation DevBob E2E
- **Requirement**: "Complete observability through kubectl logs"
- **Implementation**: Validated logs accessible at all boundaries (devbob, rpc-api, surrealdb)
- **Status**: PASSED

**Shared Component**: DevBob pod (devbob-794b69b4f4-rhnwg)

**Root Cause Discovery**:
The two specifications have different execution models:

1. **E2E Specification Execution**:
   - Activities executed via ACP server (main process, PID 1)
   - ACP server logs go to stdout/stderr → visible in kubectl logs
   - Result: ✅ Lifecycle logs visible

2. **Runtime Validation Execution**:
   - Activities executed via `kubectl exec opencode run` (subprocess)
   - Subprocess logs go to exec stderr → NOT visible in kubectl logs
   - Result: ❌ Lifecycle logs NOT visible

**Conflict Description**:
The specifications have conflicting assumptions about how activities are executed in DevBob:
- E2E spec assumes ACP API usage (correct for production)
- Runtime validation assumes kubectl exec usage (development/debugging pattern)

**Impact**:
- Runtime validation specification is architecturally incompatible with current deployment
- Lifecycle logs ARE implemented (verified in source code)
- Validation methodology needs to align with production execution patterns

**Resolution**:
1. **HIGH PRIORITY**: Update Runtime Validation specification to use ACP API for execution
2. **MEDIUM**: Document kubectl exec subprocess log isolation as known limitation
3. **LOW**: Create alternative validation method accepting kubectl exec stderr as valid source

---

### Conflict 2: Activity Triggering Requirements

**Type**: IMPLICIT_DEPENDENCY_MISMATCH

**Specification 1**: Activity System Runtime Validation
- **Test Input**: "Create a test file named quicktest.txt"
- **Expected**: Activity system triggered with lifecycle logs
- **Actual**: Direct tool call (Write tool), NO activity triggered
- **Status**: FAILED - activity not executed

**Specification 2**: Activity Template MCP-Only Flow
- **Observation**: "CLI in container does not support `--id`, `--variables`, `--reason` flags"
- **Finding**: Direct activity invocation requires different syntax in container
- **Status**: SKIPPED integration tests, PASSED code analysis

**Shared Component**: Activity recommendation system (`repos/metabob-opencode/packages/opencode/src/tool/activity.ts`)

**Root Cause**:
Activity recommendation system has thresholds for triggering:
- Simple single-step tasks → handled as direct tool calls
- Complex multi-step tasks → routed through activity templates
- Test prompt was too simple to trigger activity system

**Conflict Description**:
- Runtime validation expected simple prompt to trigger activity
- Activity system design prefers direct tool calls for simple tasks (performance optimization)
- No documented specification for activity triggering thresholds

**Impact**:
- Validation tests don't exercise activity system
- Lifecycle logs never generated (activity never runs)
- Specification doesn't account for activity recommendation logic

**Resolution**:
1. **HIGH PRIORITY**: Use complex multi-step prompts in validation tests
2. **MEDIUM**: Document activity triggering thresholds and conditions
3. **LOW**: Add direct activity invocation method: `opencode activity run --template=<id>`

---

### Conflict 3: CLI Invocation Patterns in Containers

**Type**: ENVIRONMENTAL_BEHAVIOR_DIVERGENCE

**Specification 1**: Activity System Runtime Validation
- **Command**: `kubectl exec -n metabob devbob-794b69b4f4-rhnwg -- sh -c 'echo "..." | opencode run'`
- **Expectation**: Standard OpenCode CLI behavior
- **Result**: Works but logs isolated from pod logs

**Specification 2**: Activity Template MCP-Only Flow
- **Finding**: "opencode CLI in container does not support `--id`, `--variables`, `--reason` flags"
- **Implication**: Container CLI configuration differs from development environment
- **Result**: Integration tests skipped

**Shared Component**: OpenCode CLI binary in DevBob container

**Root Cause**:
CLI behavior differs between environments:
- Development: Full flag support, rich command set
- Container (DevBob): ACP server mode, limited CLI surface
- Containerized CLI may have different configuration/build

**Conflict Description**:
Multiple specifications assume consistent CLI behavior, but container environment has:
- Different available flags
- Different log output destinations
- Different execution contexts (main process vs subprocess)

**Impact**:
- Validation methodologies incompatible across environments
- Some integration tests cannot run in containerized environment
- Documentation doesn't cover environment-specific CLI differences

**Resolution**:
1. **HIGH PRIORITY**: Document CLI differences between development and container environments
2. **MEDIUM**: Standardize validation methodology to use ACP API (environment-agnostic)
3. **LOW**: Add CLI flag compatibility layer for container environment

---

### Conflict 4: MCP-Only Architecture vs Direct Execution

**Type**: ARCHITECTURAL_BOUNDARY_AMBIGUITY

**Specification 1**: Complete Architecture Separation
- **Requirement**: "opencode → CLI (MCP) → RPC API → SurrealDB" (Vessel flow)
- **Validation**: All learning endpoints in RPC API, ZERO in opencode/CLI
- **Status**: PASSED (7/7 tests)

**Specification 2**: Activity System Runtime Validation
- **Execution Method**: kubectl exec direct to OpenCode CLI
- **Bypasses**: MCP layer, ACP API
- **Result**: Subprocess execution, logs not visible

**Shared Components**:
- Activity execution flow
- Template loading
- Metrics recording

**Root Cause**:
Architecture separation specification enforces vessel flow pattern (opencode → MCP → RPC), but validation uses direct CLI execution which bypasses this architecture.

**Conflict Description**:
- Architectural compliance validated for production (ACP API usage)
- Validation methodology uses development pattern (direct kubectl exec)
- Two execution paths exist with different logging behaviors

**Impact**:
- Validation doesn't test production code paths
- Architectural boundaries only enforced for ACP API usage
- kubectl exec provides backdoor around vessel flow pattern

**Resolution**:
1. **HIGH PRIORITY**: Align validation methodology with production architecture (use ACP API)
2. **MEDIUM**: Document kubectl exec as development/debugging tool, not production pattern
3. **LOW**: Add architectural validation that disallows direct CLI access in production

---

## Shared Components Analysis

### Component: activity.ts (Activity Orchestration)

**Affected by Specifications**:
1. Activity System Runtime Validation - Lifecycle logging (lines 478, 2348)
2. Dynamic Activity Creation DevBob E2E - Activity execution
3. Activity Template MCP-Only Flow - Template loading
4. Complete Architecture Separation - Data flow boundaries

**Conflict**:
- Runtime validation expects logs visible in kubectl logs
- E2E validation confirmed logs visible via ACP API
- Architecture separation requires MCP-only communication
- Different execution paths produce different observable behaviors

**Recommendation**: Refactor to support unified logging regardless of execution context

---

### Component: memory-agent.ts (Context Gathering)

**Affected by Specifications**:
1. Activity System Runtime Validation - Memory agent lifecycle logs (lines 470, 619)
2. Dynamic Activity Creation DevBob E2E - Lifecycle hooks and memory prediction

**Conflict**:
- Logs generated during activity execution
- Only visible when activity system is triggered
- Simple prompts bypass activity system entirely

**Recommendation**: Ensure memory agent logging works consistently across all invocation patterns

---

### Component: storage.ts (Persistence Layer)

**Affected by Specifications**:
1. Activity System Runtime Validation - Storage write confirmation (line 275)
2. Complete Architecture Separation - SurrealDB primary + Redis cache

**Conflict**:
- Storage logs confirm persistence operations
- Only generated during activity execution
- Validation didn't trigger activity, so no storage operations occurred

**Recommendation**: Add storage operation validation that's independent of activity system

---

### Component: DevBob Pod (devbob-794b69b4f4-rhnwg)

**Affected by Specifications**:
1. Activity System Runtime Validation - Log visibility
2. Dynamic Activity Creation DevBob E2E - Environment validation
3. Activity Template MCP-Only Flow - CLI behavior

**Conflicts**:
- Main process (ACP server) vs subprocess (kubectl exec) logging
- Different CLI behavior in container vs development
- Multiple execution patterns with different observability

**Recommendation**: Standardize on ACP API execution, document kubectl exec limitations

---

## Cross-Specification Dependencies

### Dependency Chain 1: Activity Execution → Lifecycle Logs → kubectl logs

```
Activity Triggered (activity.ts)
  ↓
Lifecycle Logs Written (activity.ts, memory-agent.ts, storage.ts, activity-git.ts)
  ↓
Logs to stderr
  ↓
kubectl logs visibility?
  ↓
YES if main process (ACP API) ✅ E2E Validation
NO if subprocess (kubectl exec) ❌ Runtime Validation
```

**Conflict**: Validation result depends on execution method

---

### Dependency Chain 2: Prompt Complexity → Activity Triggering → Validation Result

```
User Prompt
  ↓
Activity Recommendation System
  ↓
Simple prompt → Direct tool call (NO activity)
Complex prompt → Activity template (lifecycle logs generated)
  ↓
Validation Outcome
```

**Conflict**: Test input determines whether feature is exercised

---

## Recommendations by Priority

### HIGH PRIORITY (Blocking Production Validation)

1. **Update Runtime Validation Specification**
   - Change execution method from kubectl exec to ACP API
   - Use HTTP POST to ACP server for activity execution
   - Validate logs via kubectl logs from main process

2. **Use Complex Multi-Step Prompts**
   - Replace simple test prompts with complex multi-step tasks
   - Example: "Analyze codebase, identify patterns, create documentation, commit changes"
   - Ensures activity system is triggered

3. **Document Execution Patterns**
   - ACP API: Production pattern, logs visible in kubectl logs
   - kubectl exec: Development/debugging, logs in exec stderr
   - Clarify which pattern is canonical for validation

### MEDIUM PRIORITY (Consistency Improvements)

4. **Standardize Validation Methodology**
   - All validation specifications should use ACP API
   - Eliminates environment-specific behavior differences
   - Ensures architectural compliance

5. **Add Activity Triggering Documentation**
   - Document thresholds for activity recommendation
   - Provide examples of prompts that trigger activities
   - Add direct activity invocation method

6. **Create Unified Logging Strategy**
   - Ensure lifecycle logs work across all execution contexts
   - Consider structured logging with trace IDs
   - Implement log aggregation for multi-process scenarios

### LOW PRIORITY (Nice-to-Have)

7. **Add Architectural Validation**
   - Prevent direct kubectl exec in production
   - Enforce vessel flow pattern (MCP-only communication)
   - Add runtime checks for architectural compliance

8. **CLI Flag Compatibility**
   - Standardize CLI flags across environments
   - Add compatibility layer for container CLI
   - Document environment-specific limitations

---

## Resolution Action Plan

### Phase 1: Immediate Fixes (Current Sprint)

1. ✅ Document architectural conflict
2. ⏭️ Update Runtime Validation specification
   - Change execution to ACP API
   - Update test prompts to complex multi-step
3. ⏭️ Re-run validation with corrected methodology

### Phase 2: Consistency Improvements (Next Sprint)

4. ⏭️ Align all validation specifications to use ACP API
5. ⏭️ Add activity triggering documentation
6. ⏭️ Create unified logging strategy document

### Phase 3: Long-Term Architectural Improvements

7. ⏭️ Implement runtime architectural validation
8. ⏭️ Standardize CLI behavior across environments
9. ⏭️ Add automated conflict detection for specifications

---

## Conclusion

### Conflict Summary

**Total Conflicts**: 4
- **CONTRADICTORY_IMPLEMENTATION**: 1 (Logging visibility)
- **IMPLICIT_DEPENDENCY_MISMATCH**: 1 (Activity triggering)
- **ENVIRONMENTAL_BEHAVIOR_DIVERGENCE**: 1 (CLI invocation patterns)
- **ARCHITECTURAL_BOUNDARY_AMBIGUITY**: 1 (MCP-only vs direct execution)

**Shared Components**: 4
- activity.ts (4 specifications)
- memory-agent.ts (2 specifications)
- storage.ts (2 specifications)
- DevBob pod (3 specifications)

### Root Cause

The Activity System Runtime Validation specification was created with assumptions about execution methodology that don't align with the production architecture validated by other specifications:

1. **Execution Method**: Assumed kubectl exec (development pattern) instead of ACP API (production pattern)
2. **Log Visibility**: Assumed subprocess logs visible in kubectl logs (incorrect for subprocesses)
3. **Activity Triggering**: Assumed simple prompts trigger activities (optimization bypasses activity system)

### Verdict

**Specifications are NOT contradictory** - they validate different aspects correctly. However, the Runtime Validation specification uses an **incorrect validation methodology** that doesn't align with the production architecture.

**The lifecycle logging functionality IS implemented and WORKS** - the validation just needs to use the correct execution pattern (ACP API) to observe it.

### Next Steps

1. Update Runtime Validation specification to use ACP API execution
2. Use complex prompts that trigger activity system
3. Re-run validation with corrected methodology
4. Expect PASS result (all 8 lifecycle patterns visible via ACP API execution)

---

## Metadata

- **Analysis Date**: 2026-03-10T15:45:00Z
- **Specifications Analyzed**: 4
- **Conflicts Detected**: 4
- **Shared Components**: 4
- **Resolution Priority**: HIGH
- **Estimated Fix Time**: 2-4 hours (update spec + re-run validation)
