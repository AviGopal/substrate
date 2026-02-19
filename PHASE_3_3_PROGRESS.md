# Phase 3.3 OpenCode Integration - IN PROGRESS

**Date:** 2026-02-18  
**Status:** 🔄 40% COMPLETE  
**Goal:** Integrate MCP metrics tools into metabob-opencode TypeScript codebase

---

## ✅ Completed (2 of 5 tasks)

### 1. **TypeScript Interfaces** ✅ DONE
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts`

Created complete type definitions:
- `ActivityExecutionData` - Data structure for reporting executions
- `TemplateMetrics` - Aggregated metrics (executions, success_rate, avg_cost, etc.)
- `PromotionRecommendation` - Recommendation response (PROMOTE/KEEP_TESTING/PRUNE)
- `PromotionRequest` - Request to promote a candidate
- `PromotionResponse` - Response from promotion operation  
- `TemplateMetricsResponse` - Response with stable + candidate metrics

**Lines:** 77 lines of TypeScript interfaces  
**Status:** Complete, ready to use

### 2. **MCP Client Wrapper** ✅ DONE
**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

Created `TemplateMetricsClient` namespace with methods:
- `reportExecution()` - Report activity execution (non-blocking, graceful degradation)
- `getTemplateMetrics()` - Get stable + candidate metrics
- `getRecommendation()` - Get promotion recommendation
- `promoteTemplate()` - Promote candidate to stable
- `isAvailable()` - Check if metrics service available

**Architecture:**
- Uses `MetabobCLI.execute()` to call MCP tools
- Comprehensive error handling with graceful degradation
- Non-blocking metrics reporting (failures logged, not thrown)
- Proper logging at all levels (debug, warn, info, error)

**Lines:** 214 lines of TypeScript  
**Status:** Complete, tested patterns match existing code

---

## ⏳ Remaining (3 of 5 tasks)

### 3. **Activity Execution Integration** (Next)
**File:** `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**What needs to be done:**
1. Import the metrics client:
   ```typescript
   import { TemplateMetricsClient } from "./template-metrics-client"
   ```

2. In the `complete()` function (around line 546), after activity completes:
   ```typescript
   // Report execution metrics (non-blocking)
   if (activity.templateId) {
     TemplateMetricsClient.reportExecution({
       activity_id: activity.id,
       template_id: activity.templateId,
       success: activity.status === "done",
       duration: activity.stats.duration,
       cost: activity.stats.cost.total,
       tokens: {
         input: activity.stats.tokens.input,
         output: activity.stats.tokens.output,
         cache: activity.stats.tokens.cache || 0,
       },
     }).catch(() => {
       // Silent failure - metrics not critical path
     })
   }
   ```

**Estimated Time:** 15-20 minutes  
**Complexity:** Low (simple integration point)

---

### 4. **CLI Commands** (After Task 3)
**File:** `repos/metabob-opencode/packages/opencode/src/cli/cmd/activity-metrics.ts` (NEW)

**What needs to be done:**
Create CLI commands for querying and managing metrics:

```typescript
import { program } from "commander"
import { TemplateMetricsClient } from "../../session/template-metrics-client"
import { Log } from "../../util/log"

const log = Log.create({ service: "cli:activity-metrics" })

// opencode activity metrics <template-id>
program
  .command("metrics <templateId>")
  .description("View metrics for an activity template")
  .action(async (templateId: string) => {
    const metrics = await TemplateMetricsClient.getTemplateMetrics(templateId)
    if (!metrics) {
      console.error("Failed to fetch metrics")
      return
    }
    
    // Format and display metrics
    console.log(`\nMetrics for ${templateId}:`)
    console.log(`  Executions: ${metrics.stable.executions}`)
    console.log(`  Success Rate: ${(metrics.stable.success_rate * 100).toFixed(1)}%`)
    console.log(`  Avg Cost: $${metrics.stable.avg_cost.toFixed(4)}`)
    console.log(`  Avg Duration: ${(metrics.stable.avg_duration / 1000).toFixed(1)}s`)
    
    if (metrics.candidates.length > 0) {
      console.log(`\nCandidates: ${metrics.candidates.length}`)
      // Display candidate info
    }
  })

// opencode activity recommend <template-id>
program
  .command("recommend <templateId>")
  .description("Get promotion recommendation")
  .action(async (templateId: string) => {
    const rec = await TemplateMetricsClient.getRecommendation(templateId)
    if (!rec) {
      console.error("Failed to get recommendation")
      return
    }
    
    console.log(`\nRecommendation: ${rec.action}`)
    console.log(`Reason: ${rec.reason}`)
    if (rec.candidate_id) {
      console.log(`Candidate: ${rec.candidate_id}`)
    }
  })

// opencode activity promote <candidate-id>
program
  .command("promote <candidateId>")
  .description("Promote a candidate template to stable")
  .option("-r, --reason <reason>", "Reason for promotion")
  .action(async (candidateId: string, options: { reason?: string }) => {
    const result = await TemplateMetricsClient.promoteTemplate({
      candidate_id: candidateId,
      reason: options.reason,
    })
    
    if (!result) {
      console.error("Failed to promote template")
      return
    }
    
    console.log(`\n✓ Template promoted successfully!`)
    console.log(`New Stable: ${result.new_stable_id}`)
    console.log(`Old Stable: ${result.old_stable_id}`)
  })
```

**Then register in:** `repos/metabob-opencode/packages/opencode/src/cli/cmd/cmd.ts` or main CLI file

**Estimated Time:** 30-45 minutes  
**Complexity:** Medium (need to understand CLI structure)

---

### 5. **Testing & Verification** (Final)
**What needs to be done:**

1. **Unit Tests:**
   - Mock MetabobCLI.execute() responses
   - Test TemplateMetricsClient methods
   - Test activity integration (metrics reporting)

2. **Integration Tests:**
   - Run full activity with metrics reporting
   - Verify metrics appear in backend (via MCP → backend)
   - Test CLI commands with real data

3. **Error Handling Tests:**
   - Test graceful degradation when MCP unavailable
   - Test partial failures (some metrics succeed, some fail)
   - Verify logging at all error points

**Test Files to Create:**
- `repos/metabob-opencode/packages/opencode/src/session/__tests__/template-metrics-client.test.ts`
- `repos/metabob-opencode/packages/opencode/src/session/__tests__/activity-metrics-integration.test.ts`

**Estimated Time:** 45-60 minutes  
**Complexity:** Medium-High (end-to-end testing)

---

## Architecture Status

### Phase Progress:
- **Phase 3.1** (MCP Gateway): ✅ 100% COMPLETE
- **Phase 3.2** (Backend Endpoints): ✅ 100% COMPLETE  
- **Phase 3.3** (OpenCode Integration): 🔄 40% COMPLETE (2/5 tasks)
  - Task 1: TypeScript Interfaces ✅
  - Task 2: MCP Client Wrapper ✅
  - Task 3: Activity Integration ⏳ Next
  - Task 4: CLI Commands ⏳ Pending
  - Task 5: Testing ⏳ Pending

### Data Flow (Ready):
```
Activity Execution (TypeScript)
    ↓
TemplateMetricsClient.reportExecution()
    ↓
MetabobCLI.execute("metabob_report_execution")
    ↓
MCP Gateway (metabob-cli Python)
    ↓
HTTP POST /api/activity-execution
    ↓
MetricsAggregator (metabob-rpc-api)
    ↓
Redis Storage
```

**Status:** 🟢 TypeScript client ready, awaiting activity integration

---

## Files Created This Session

1. ✅ `repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts` (77 lines)
2. ✅ `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts` (214 lines)
3. ⏳ `repos/metabob-opencode/packages/opencode/src/cli/cmd/activity-metrics.ts` (pending)

---

## Next Actions

### Immediate (Task 3 - 15 min):
1. Read `activity.ts` to understand completion flow
2. Add `TemplateMetricsClient` import
3. Add metrics reporting after activity completes
4. Test import/compile

### After Task 3 (Task 4 - 45 min):
1. Create `activity-metrics.ts` CLI command file
2. Implement 3 commands (metrics, recommend, promote)
3. Register commands in main CLI
4. Manual test via CLI

### After Task 4 (Task 5 - 60 min):
1. Create unit tests for metrics client
2. Create integration tests for activity reporting
3. Test error handling and graceful degradation
4. Verify end-to-end flow

---

## Success Criteria

✅ **Task 1-2:** TypeScript interfaces and client implemented  
⏳ **Task 3:** Activity executions automatically report metrics  
⏳ **Task 4:** CLI commands work for viewing/managing metrics  
⏳ **Task 5:** Tests pass, error handling verified  
⏳ **Overall:** End-to-end metrics flow working from activity → backend

---

## Estimated Completion

- **Tasks 3-5 remaining:** ~2 hours  
- **Total Phase 3.3:** ~3 hours (1 hour done, 2 hours remaining)
- **Expected completion:** Next session

---

## References

- **Phase 3.1:** `PHASE_3_1_COMPLETE.md` - MCP tools in metabob-cli
- **Phase 3.2:** `PHASE_3_2_COMPLETE.md` - Backend endpoints in metabob-rpc-api
- **Phase 3.3 Plan:** `PHASE_3_3_NEXT_STEPS.md` - Full implementation guide
- **Session Summary:** `SESSION_SUMMARY_PHASE_3_2.md` - Previous session work
