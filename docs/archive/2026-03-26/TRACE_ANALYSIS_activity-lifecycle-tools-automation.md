# Trace Analysis: activity-lifecycle-tools-automation

**Specification**: OpenCode must automatically use MCP tools for activity template lifecycle management (create, evolve, debug) and boredom system configuration.

**Status**: PARTIAL IMPLEMENTATION - Tools exist but lack automated triggers

---

## Executive Summary

The system has all the necessary infrastructure for automated template lifecycle management:
- ✅ **register_activity_template** tool with auto-registration hooks
- ✅ **evolve-activity-self-contained** meta-template (bootstrap)
- ✅ **debug-activity-self-contained** meta-template (bootstrap)
- ✅ **BoredomManager** with idle detection and MCP integration
- ✅ **Turn lifecycle hooks** system for pre/post turn automation

However, **critical gaps prevent automated operation**:
- ❌ BoredomManager fetches activities but doesn't map types to meta-templates
- ❌ No automatic debugging trigger on repeated activity failures
- ❌ No lifecycle configuration in config schema
- ❌ No lifecycle hooks for template evolution/debugging

---

## Current State vs Desired State

### 1. Template Registration (✅ WORKING)

**Current**: 
```
User creates template 
  → ActivityTemplate.create() 
  → maybeAutoRegisterWithMetabob() 
  → TemplateRepository.save() 
  → MetabobCLI.registerActivityTemplate() 
  → metabob_register_activity_template MCP tool
```

**Config**: `config.metabob.template_auto_registration.enabled=true` and `strategy='on-create'`

**Status**: ✅ Working correctly. No changes needed.

**Evidence**: `template-auto-registration.test.ts` has comprehensive test coverage.

---

### 2. Boredom System (⚠️ PARTIAL)

**Current**:
```
Idle detection (5min) 
  → BoredomManager.fetchBoredomActivities() 
  → metabob_fetch_boredom_activities MCP tool 
  → Returns activities with type='improve-template'|'debug-failures'|'optimize-performance'
  → BoredomManager.executeBoredomActivity() 
  → executeActivityInline(boredomActivity.template_id, variables)
  ❌ WRONG: Uses templateId from backend directly, not meta-template
```

**Desired**:
```
Idle detection 
  → fetchBoredomActivities() 
  → MAP activity_type to meta-template:
     'improve-template' → 'evolve-activity-self-contained'
     'debug-failures' → 'debug-activity-self-contained'
     'optimize-performance' → TBD
  → executeActivityInline(mappedTemplateId, variables from metrics)
  ✅ Correct: Invokes meta-template to improve stale template
```

**Fix Location**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:254-396`

**Fix**:
```typescript
async function executeBoredomActivity(
  manager: ManagerInstance,
  boredomActivity: BoredomActivity
): Promise<void> {
  // Step 1: Map activity_type to meta-template
  const templateMapping = {
    "improve-template": "evolve-activity-self-contained",
    "debug-failures": "debug-activity-self-contained",
    "optimize-performance": "optimize-activity-self-contained", // TBD
  }
  
  const metaTemplateId = templateMapping[boredomActivity.activity_type]
  if (!metaTemplateId) {
    l.warn("unknown boredom activity type", { type: boredomActivity.activity_type })
    return
  }
  
  // Step 2: Load meta-template
  const template = await TemplateRepository.get(metaTemplateId)
  if (!template) {
    l.warn("meta-template not found", { templateId: metaTemplateId })
    return
  }
  
  // Step 3: Extract variables from boredom activity
  const variables: Record<string, unknown> = {
    templateId: boredomActivity.template_id, // Template to improve/debug
    success_rate: boredomActivity.metrics.success_rate,
    avg_cost: boredomActivity.metrics.avg_cost,
    avg_duration_ms: boredomActivity.metrics.avg_duration_ms,
    execution_count: boredomActivity.metrics.execution_count,
    failure_patterns: JSON.stringify(boredomActivity.metrics.failure_patterns || []),
    performance_trends: JSON.stringify(boredomActivity.metrics.performance_trends || {}),
    last_execution: JSON.stringify(boredomActivity.metrics.last_execution || {}),
  }
  
  // Step 4: Execute meta-template (not the stale template itself)
  const result = await executeActivityInline(
    metaTemplateId, // ← Use meta-template ID
    variables,
    manager.sessionID,
    `[BOREDOM] ${boredomActivity.reason}`,
    "boredom-manager",
    abortController.signal
  )
  
  // ... rest of the function
}
```

---

### 3. Activity Failure Debugging (❌ MISSING)

**Current**:
```
Activity fails 
  → activity.status = 'failed' 
  → Activity.save() 
  → END (no follow-up action)
```

**Desired**:
```
Activity fails 
  → Check failure count for templateId in last 24h (via MCP)
  → If >3 failures:
    → Auto-trigger debug-activity-self-contained 
    → Variables: { executionId: failedActivity.id }
    → Notify user: "Template X failing repeatedly, debugging triggered"
```

**Fix Location**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1230-1590`

**Fix** (add after `activity.status = "failed"`):
```typescript
// After activity fails, check if we should auto-debug
if (activity.status === "failed") {
  try {
    const config = await Config.get()
    const lifecycleConfig = config.metabob?.template_lifecycle_automation
    
    if (lifecycleConfig?.auto_debug_on_failure !== false) {
      // Query backend for recent failures of this template
      const recentFailures = await TemplateMetricsClient.getRecentFailures({
        template_id: activity.templateId,
        hours: 24,
      })
      
      const threshold = lifecycleConfig?.failure_threshold_count ?? 3
      
      if (recentFailures.length >= threshold) {
        log.warn("template failing repeatedly, triggering auto-debug", {
          templateId: activity.templateId,
          failureCount: recentFailures.length,
          threshold,
        })
        
        // Trigger debug-activity-self-contained
        const { executeActivityInline } = await import("./activity")
        await executeActivityInline(
          "debug-activity-self-contained",
          { executionId: activity.id },
          ctx.sessionID,
          `Auto-debug: Template ${activity.templateId} failed ${recentFailures.length} times in 24h`,
          "auto-debug-system"
        )
        
        // TODO: Notify user via TUI or log
      }
    }
  } catch (error) {
    log.warn("auto-debug check failed (non-blocking)", { error })
  }
}
```

---

### 4. Lifecycle Configuration (❌ MISSING)

**Current**: No config schema for lifecycle automation

**Desired**: Add to `repos/metabob-opencode/packages/opencode/src/config/schemas/metabob.ts:102-150`

```typescript
template_lifecycle_automation: z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe("Enable automated template lifecycle (evolution, debugging)"),
    auto_evolve_on_staleness: z
      .boolean()
      .default(true)
      .describe("Automatically evolve templates when they become stale"),
    staleness_threshold_days: z
      .number()
      .int()
      .positive()
      .default(30)
      .describe("Days without use before template is considered stale"),
    auto_debug_on_failure: z
      .boolean()
      .default(true)
      .describe("Automatically trigger debug-activity when template fails repeatedly"),
    failure_threshold_count: z
      .number()
      .int()
      .positive()
      .default(3)
      .describe("Number of failures in 24h before auto-debugging is triggered"),
    max_evolution_frequency_hours: z
      .number()
      .int()
      .positive()
      .default(168) // 1 week
      .describe("Minimum hours between automatic template evolutions"),
  })
  .optional()
  .describe("Automated template lifecycle management configuration"),
```

---

### 5. Lifecycle Hooks (❌ MISSING)

**Current**: No hooks for template lifecycle

**Desired**: Add to `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`

**Hook 1: Post-Activity Completion** (Priority: 125)
```typescript
TurnLifecycle.registerHook({
  name: "template-lifecycle-check",
  priority: 125, // After session-memory-optimization (110)
  
  enabled: async (ctx) => {
    const config = await Config.get()
    return config.metabob?.template_lifecycle_automation?.enabled !== false
  },
  
  execute: async (ctx) => {
    // Check if an activity just completed
    const { Activity } = await import("./activity")
    const recentActivity = Activity.getRecentlyCompleted(ctx.sessionID)
    
    if (!recentActivity) return { success: true, modified: false }
    
    // If failed repeatedly, trigger debug-activity
    // (logic similar to what we added in activity.ts)
    
    // If template is stale, trigger evolve-activity
    // (check last evolution time, success rate trends)
    
    return { success: true, modified: true }
  }
})
```

---

## Component Inventory

| Component | File | Status | Gap |
|-----------|------|--------|-----|
| RegisterActivityTemplateTool | register-activity-template.ts:20-275 | ✅ Working | None |
| maybeAutoRegisterWithMetabob | activity-template.ts:653-694 | ✅ Working | None |
| BoredomManager | boredom-manager.ts:254-396 | ⚠️ Partial | No template mapping |
| TurnLifecycle hooks | turn-lifecycle-hooks.ts:1-1023 | ⚠️ Partial | No lifecycle hooks |
| ActivityTool.execute | activity.ts:970-1590 | ⚠️ Partial | No auto-debug trigger |
| Metabob Config Schema | metabob.ts:102-150 | ❌ Missing | No lifecycle config |
| evolve-activity-self-contained | evolve-activity-self-contained.json | ✅ Ready | Not auto-invoked |
| debug-activity-self-contained | debug-activity-self-contained.json | ✅ Ready | Not auto-invoked |
| MetabobCLI.registerActivityTemplate | metabob.ts:784-850 | ✅ Working | None |

---

## Implementation Priority

### P0 - Critical (Blocking Self-Improvement Loop)

1. **Fix BoredomManager template mapping** (boredom-manager.ts:254-396)
   - Impact: Boredom system will actually improve templates instead of running wrong activities
   - Effort: 1-2 hours
   - Risk: Low (isolated change)

2. **Add auto-debug trigger on failure** (activity.ts:1230-1590)
   - Impact: Templates will be debugged automatically when failing repeatedly
   - Effort: 2-3 hours
   - Risk: Medium (need to add MCP call for failure tracking)

### P1 - High (Enables Configuration Control)

3. **Add lifecycle config schema** (metabob.ts:102-150)
   - Impact: Users can control when/how templates are auto-improved
   - Effort: 1 hour
   - Risk: Low (config schema addition)

4. **Add lifecycle hooks** (turn-lifecycle-hooks.ts)
   - Impact: Template health monitoring integrated into normal operation
   - Effort: 3-4 hours
   - Risk: Medium (need to coordinate with Activity lifecycle)

### P2 - Nice to Have

5. **Create validation harness** (tests/validation-harnesses/)
   - Impact: Can verify lifecycle automation works end-to-end
   - Effort: 4-6 hours
   - Risk: Low (test code)

---

## Data Flow Diagrams

### Current Flow (Broken)

```
┌─────────────────────────────────────────────────────────────┐
│ Boredom System (BROKEN)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Idle 5min → fetchBoredomActivities()                        │
│               ↓                                               │
│  Backend returns:                                             │
│    { activity_type: "improve-template",                      │
│      template_id: "some-stale-template",                     │
│      priority: 0.85 }                                         │
│               ↓                                               │
│  ❌ executeBoredomActivity(boredomActivity.template_id)      │
│      Tries to execute "some-stale-template" directly         │
│      (not the meta-template!)                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Activity Failure (NO AUTOMATION)                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Activity fails → status = 'failed' → Activity.save()        │
│                                          ↓                    │
│                                        END                    │
│                                          ↑                    │
│                           (no follow-up action)               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Desired Flow (Fixed)

```
┌─────────────────────────────────────────────────────────────┐
│ Boredom System (FIXED)                                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Idle 5min → fetchBoredomActivities()                        │
│               ↓                                               │
│  Backend returns:                                             │
│    { activity_type: "improve-template",                      │
│      template_id: "some-stale-template",                     │
│      metrics: {...} }                                         │
│               ↓                                               │
│  ✅ Map activity_type to meta-template:                      │
│     "improve-template" → "evolve-activity-self-contained"    │
│               ↓                                               │
│  executeActivityInline(                                       │
│    "evolve-activity-self-contained",                         │
│    { templateId: "some-stale-template",                      │
│      success_rate: 0.45,                                      │
│      failure_patterns: [...] }                                │
│  )                                                            │
│               ↓                                               │
│  evolve-activity fetches template, analyzes metrics,         │
│  generates improvements, creates new version, registers       │
│               ↓                                               │
│  ✅ Template auto-improved!                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Activity Failure (AUTOMATED)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Activity fails → status = 'failed'                          │
│               ↓                                               │
│  ✅ Check failure count (via MCP)                            │
│     getRecentFailures(template_id, 24h)                      │
│               ↓                                               │
│  If failures >= 3:                                            │
│    executeActivityInline(                                     │
│      "debug-activity-self-contained",                        │
│      { executionId: activity.id }                            │
│    )                                                          │
│               ↓                                               │
│  debug-activity uses activity_error_inspector MCP tool       │
│  generates EXECUTION_ANALYSIS.md and FIX_RECOMMENDATIONS.md  │
│               ↓                                               │
│  ✅ Failure analyzed, fixes recommended!                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation Plan

### Test Harness: `activity-lifecycle-tools-automation-harness.ts`

**Test Scenario 1: Boredom System Template Mapping**
1. Create mock stale template with low success rate
2. Mock metabob_fetch_boredom_activities to return improve-template activity
3. Trigger boredom check
4. Verify: evolve-activity-self-contained was executed (not the stale template)
5. Verify: Variables include templateId, success_rate, failure_patterns

**Test Scenario 2: Auto-Debug on Repeated Failures**
1. Create test template
2. Execute it 5 times with forced failures
3. Verify: debug-activity-self-contained auto-triggered after 3rd failure
4. Verify: EXECUTION_ANALYSIS.md created with root cause
5. Verify: FIX_RECOMMENDATIONS.md created with fixes

**Test Scenario 3: Lifecycle Configuration Respected**
1. Set config.metabob.template_lifecycle_automation.auto_debug_on_failure = false
2. Create template and fail it 5 times
3. Verify: No auto-debug triggered
4. Set auto_debug_on_failure = true, failure_threshold_count = 2
5. Fail template 2 times
6. Verify: Auto-debug triggered after 2nd failure

**Test Scenario 4: End-to-End Self-Improvement**
1. Create template with intentional flaw (too low token budget)
2. Execute it 3 times → fails due to token budget
3. Verify: debug-activity triggered → identifies token budget issue
4. Mock boredom system to return improve-template activity
5. Verify: evolve-activity triggered → increases token budget
6. Verify: New version registered with higher budget
7. Execute new version → succeeds

---

## Architectural Notes

### MCP Abstraction ✅
All lifecycle operations correctly use MCP abstraction:
- `metabob_register_activity_template` - Template registration
- `metabob_fetch_boredom_activities` - Boredom system
- `activity_error_inspector` - Failure analysis

**No direct HTTP calls to RPC API** - architectural compliance maintained.

### Bootstrap Templates ✅
Meta-templates are bootstrap templates (embedded in code):
- `evolve-activity-self-contained` (activity-template.ts imports JSON)
- `debug-activity-self-contained` (activity-template.ts imports JSON)

They are **always available** without backend dependency.

### Trailblazing ✅
Meta-templates automatically enable trailblazing mode (activity.ts:975-990):
```typescript
if (ActivityTemplate.isMetaTemplate(template.id) && !trailblazingOptions?.enabled) {
  log.info("auto-enabling trailblazing for meta-template", { templateId: template.id })
  trailblazingOptions = {
    enabled: true,
    maxRecoveryAttempts: 3,
    maxCostPerTask: 1.0,
    maxTotalCost: 5.0,
  }
}
```

---

## Related Specifications

- `boredom-activity-detection-mechanism` - Boredom system infrastructure
- `dynamic-activity-creation-devbob-execution-tracking` - Activity execution tracking
- `template-storage-architecture` - Template storage and retrieval
- `metabob-cli-mcp-backend-communication` - MCP abstraction layer

---

## Impulse Created

**ID**: `trace-activity-lifecycle-tools-automation`  
**Type**: `templateDefinition`  
**Budget**: 5000 tokens  
**Priority**: high  

This impulse contains the full trace analysis and is available for downstream validation and enforcement tasks.

---

**Traced by**: trace-data-flow-single-feature activity  
**Date**: 2026-03-04  
**Status**: Ready for implementation
