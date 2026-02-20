# Quick Action Plan - Next Steps

**Date**: 2026-02-20  
**Context**: System 75% operational, 2 critical blockers identified  
**Goal**: Reach 100% operational status

---

## 🔥 CRITICAL: Fix Agent Spawn Issue (4-6 hours)

### Problem
Templates with `tools.required` don't spawn agents:
- evolve-activity: needs `write`, `bash`
- debug-activity: needs `activity_error_inspector`, `write`

### Investigation Steps

1. **Reproduce with minimal template** (30 min)
   ```typescript
   // Create test template with single required tool
   {
     "id": "test-agent-spawn",
     "tasks": [{
       "id": "task-1",
       "subagent": "general",
       "tools": { "required": ["write"] },
       "prompt": { "template": "Write 'hello' to test.txt" }
     }]
   }
   ```

2. **Check pre-flight validation** (1 hour)
   ```bash
   cd repos/metabob-opencode
   rg "tools.*required" packages/opencode/src/session/template-executor.ts -A 20
   ```
   - Where is validation happening?
   - What happens when validation fails?
   - Why is there no error message?

3. **Test without tools.required** (30 min)
   ```json
   // Remove from evolve-activity temporarily
   {
     "tools": null  // Was: { "required": ["write", "bash"] }
   }
   ```
   - Does agent spawn?
   - Does execution work?

4. **Add error logging** (1 hour)
   ```typescript
   // In pre-flight validation
   if (toolValidationFails) {
     log.error("tool validation failed", {
       required: task.tools.required,
       available: availableTools,
       missing: missingTools
     })
     throw new Error(`Missing required tools: ${missingTools.join(', ')}`)
   }
   ```

5. **Fix validation or remove requirement** (1-2 hours)
   - Option A: Fix validation logic
   - Option B: Remove tools.required (lose validation benefit)
   - Option C: Make tools.required advisory (warn, don't block)

### Success Criteria
- ✅ evolve-activity spawns agent and executes
- ✅ debug-activity spawns agent and executes
- ✅ Error messages clear when validation fails

---

## ⚡ MEDIUM: Add Automatic Metrics Reporting (2-3 hours)

### Location
`repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

### Implementation

```typescript
// After line ~152 (activity execution completes)
import { TemplateMetricsClient } from './template-metrics-client'

// Report execution to backend
try {
  await TemplateMetricsClient.reportExecution({
    execution_id: activity.id,
    variant_id: template.id,
    success: result.success,
    cost: result.totalCost,
    duration_ms: result.totalDuration,
    tokens: {
      input: result.totalTokens.input,
      output: result.totalTokens.output,
      cache: result.totalTokens.cache
    }
  })
  
  log.info("execution metrics reported", {
    activityId: activity.id,
    templateId: template.id,
    success: result.success
  })
} catch (error) {
  // Non-fatal: log but don't block
  log.warn("failed to report execution metrics", {
    activityId: activity.id,
    error: error instanceof Error ? error.message : String(error)
  })
}
```

### Testing

```bash
# 1. Execute an activity
cd repos/metabob-opencode && bun run dev
> activity({ templateId: "create-activity-template-(self-contained)", ... })

# 2. Check backend received metrics
curl http://localhost:8081/v2/activities/stats/create-activity-template-(self-contained)

# 3. Verify Thompson Sampling updated
# Should see alpha or beta increment
```

### Success Criteria
- ✅ Metrics automatically reported after each execution
- ✅ Backend receives correct data
- ✅ Thompson Sampling updates correctly
- ✅ Errors handled gracefully (non-fatal)

---

## 🎯 HIGH: Test Full Learning Loop (2-3 hours)

### Prerequisites
- ✅ Agent spawn fixed
- ✅ Automatic metrics reporting added

### Test Procedure

1. **Create baseline variant** (30 min)
   ```typescript
   activity({
     templateId: "create-activity-template-(self-contained)",
     variables: {
       templateName: "Test Template Alpha",
       ...
     },
     reason: "Create baseline variant for learning test"
   })
   ```

2. **Execute multiple times** (30 min)
   ```bash
   # Run 5-10 executions
   for i in {1..5}; do
     # Execute activity
     # Record success/failure
     # Check backend stats
   done
   ```

3. **Create improved variant** (30 min)
   ```typescript
   activity({
     templateId: "evolve-activity-self-contained",
     variables: {
       templateId: "test-template-alpha"
     },
     reason: "Evolve baseline variant based on metrics"
   })
   ```

4. **Test variant selection** (30 min)
   ```bash
   # Execute both variants multiple times
   # Verify Thompson Sampling selects better variant
   # Measure convergence time
   ```

5. **Verify learning** (30 min)
   ```bash
   # Check final stats
   curl http://localhost:8081/v2/activities/stats/test-template-alpha
   
   # Verify:
   # - Success rates tracked
   # - Alpha/beta updated correctly
   # - Best variant selected more often
   ```

### Success Criteria
- ✅ Multiple variants created
- ✅ All executions tracked
- ✅ Thompson Sampling converges to best
- ✅ Learning loop operational end-to-end

---

## 🔧 MEDIUM: Optimize Logging (2-3 hours)

### Current Problem
- Verbose debug logs in production
- Performance impact unknown
- Hard to find important logs

### Implementation

1. **Add debug flag** (30 min)
   ```typescript
   // In util/log.ts
   const DEBUG_MEMORY = process.env.OPENCODE_DEBUG_MEMORY === "true"
   const DEBUG_LIFECYCLE = process.env.OPENCODE_DEBUG_LIFECYCLE === "true"
   
   // In session-memory.ts
   if (DEBUG_MEMORY) {
     log.debug("verbose memory diagnostic", { ... })
   }
   ```

2. **Categorize logs** (1 hour)
   - **KEEP**: Critical lifecycle events (hook execution, errors)
   - **GATE**: Verbose diagnostics (impulse loading, transfers)
   - **REMOVE**: Redundant logs (duplicate information)

3. **Update documentation** (30 min)
   ```markdown
   # Debugging
   
   Enable verbose logging:
   ```bash
   export OPENCODE_DEBUG_MEMORY=true
   export OPENCODE_DEBUG_LIFECYCLE=true
   bun run dev
   ```
   ```

4. **Test performance** (30 min)
   - Measure with debug enabled
   - Measure with debug disabled
   - Verify no critical logs lost

### Success Criteria
- ✅ Production logs clean and readable
- ✅ Debug flags enable verbose logging
- ✅ No performance impact
- ✅ Documentation updated

---

## 📊 Priority Order

### Week 1 (Now)
1. 🔥 **Fix agent spawn issue** (4-6 hours)
2. ⚡ **Add automatic metrics reporting** (2-3 hours)
3. 🎯 **Test full learning loop** (2-3 hours)

**Total**: 8-12 hours  
**Outcome**: System 100% operational

### Week 2
4. 🔧 **Optimize logging** (2-3 hours)
5. 📈 **Budget allocation (Milestone 2)** (15-20 hours)

**Total**: 17-23 hours  
**Outcome**: Production-ready with visibility

### Week 3
6. 📊 **Execution graph visualization (Milestone 3)** (10-15 hours)
7. 📚 **Documentation** (8-10 hours)

**Total**: 18-25 hours  
**Outcome**: Complete system with debugging tools

---

## 🎯 Success Definition

**After Week 1** (8-12 hours):
- ✅ Agent spawn issue fixed
- ✅ Automatic metrics reporting working
- ✅ Learning loop operational end-to-end
- ✅ System 100% operational

**After Week 2** (25-35 hours):
- ✅ Logging optimized
- ✅ Budget allocation tracking
- ✅ Production-ready

**After Week 3** (43-60 hours):
- ✅ Execution graph visualization
- ✅ Complete documentation
- ✅ Fully operational self-improving system

---

## 🚀 Let's Start

**First Action**: Fix agent spawn issue

```bash
cd repos/metabob-opencode
rg "tools.*required" packages/opencode/src/session/template-executor.ts -A 20
```

**Question**: Where is tool validation happening, and why does it fail silently?

---

**Ready to proceed?**
