# Ripple Changes to Apply: MCP Architecture Compliance

**Source**: Complete MCP Data Flow specification (2026-03-08)
**Status**: Ready to apply
**Estimated Effort**: 3-4 hours

---

## Changes Required

### 1. Fix Thompson Sampling Architectural Violation ⚠️ CRITICAL

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`
**Lines**: 154-175
**Priority**: HIGH (last remaining architectural violation)

**Current Code** (VIOLATION):
```typescript
// Line 165: Direct HTTP bypass of MCP layer
const rpcResponse = await RpcHttpClient.selectTemplateVariant(templateId, rpcConfig)
```

**Required Change**:
```typescript
// Use MCP tool metabob_recommend_activities
const recommendations = await callMCPTool('metabob_recommend_activities', {
  task_description: `Select variant for ${templateId}`,
  category: templateCategory || 'infrastructure',
  loaded_impulses: [],
  max_activities: 1,
  priority_threshold: 0.7
})

const selectedId = recommendations?.[0]?.template_id || templateId
```

**Testing**:
1. Run `grep -r 'RpcHttpClient.selectTemplateVariant' repos/metabob-opencode/` → should return 0 matches
2. Execute test activity and verify template selection works
3. Check logs for MCP tool invocation
4. Test graceful degradation (MCP unavailable → random selection fallback)

**Impact**: Achieves 100% MCP architectural compliance

---

### 2. Implement Impulse Learning Integration

**File**: `repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts`
**Line**: 59 (stub implementation)
**Priority**: MEDIUM

**Current Code** (STUB):
```typescript
export async function captureActivityLearning(input: any): Promise<void> {
  log.debug("captureActivityLearning stub", { activityId: input.activityId })
}
```

**Required Change**:
```typescript
export async function captureActivityLearning(input: {
  activityId: string
  taskDescription: string
  impulsesUsed: string[]
  success: boolean
}): Promise<void> {
  try {
    // Call MCP tool for impulse recommendations
    const recommendations = await callMCPTool('metabob_recommend_impulses', {
      activity_id: input.activityId,
      task_description: input.taskDescription,
      limit: 10,
      priority_threshold: 0.5
    })
    
    log.info("impulse recommendations received", { 
      activityId: input.activityId,
      count: recommendations.length,
      topImpulse: recommendations[0]?.impulse_id
    })
    
    // Store recommendations for future impulse selection guidance
    // (Future enhancement: Cache in local storage for next activity)
    
  } catch (error) {
    // Graceful degradation - learning is non-critical path
    log.warn("impulse learning failed (non-blocking)", {
      activityId: input.activityId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
```

**Testing**:
1. Call after activity completion
2. Verify MCP tool is invoked with correct schema
3. Check logs for recommendations
4. Test error handling (backend unavailable)

**Impact**: Enables impulse usefulness learning loop

---

### 3. Add Architectural Compliance Validation

**File**: `tests/validation-harnesses/mcp-architecture-compliance.ts` (NEW)
**Priority**: LOW (but important for preventing regressions)

**Purpose**: Automated check to prevent future MCP bypasses

**Implementation**:
```typescript
// Scan codebase for architectural violations
const violations = [
  // Direct HTTP to backend
  { pattern: /fetch\(['"].*\/v2\/activities/, file: 'opencode/src/**/*.ts' },
  { pattern: /axios\.post\(['"].*\/v2\/activities/, file: 'opencode/src/**/*.ts' },
  { pattern: /RpcHttpClient\..*\(/, file: 'opencode/src/**/*.ts' },
  
  // MCP bypass patterns  
  { pattern: /\/\/ BYPASS MCP/, file: 'opencode/src/**/*.ts' },
]

// Run in CI/CD to block PRs with violations
```

**Testing**:
1. Run validation script
2. Should fail if violations exist
3. Should pass after fixes applied

**Impact**: Prevents future architectural violations

---

## Backend Dependencies (Already Complete)

✅ **metabob_recommend_activities** - MCP tool implemented
✅ **metabob_recommend_impulses** - MCP tool implemented
⏳ **Backend endpoints** - 3/5 implemented (2 pending)

---

## Validation Checklist

After applying all changes:

- [ ] Zero grep matches for `RpcHttpClient.selectTemplateVariant`
- [ ] Zero grep matches for direct HTTP to `/v2/activities`
- [ ] `captureActivityLearning()` no longer a stub
- [ ] MCP tools invoked in activity execution logs
- [ ] Template selection works (manual test)
- [ ] Impulse recommendations logged (manual test)
- [ ] Graceful degradation tested (MCP unavailable)
- [ ] TypeScript build succeeds
- [ ] All unit tests pass
- [ ] Architecture compliance validation added to CI

---

## Next Steps

1. Apply changes to `template-selector.ts`
2. Apply changes to `impulse-learning.ts`
3. Run validation tests
4. Commit with specification reference
5. Update architecture compliance docs
6. (Future) Implement missing backend endpoints for full functionality
