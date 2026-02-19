# Phase 3.3 - OpenCode Integration: Next Steps

**Status:** ⏳ READY TO START  
**Previous:** Phase 3.2 COMPLETE (Backend endpoints implemented)  
**Goal:** Integrate MCP metrics tools into metabob-opencode TypeScript codebase

---

## Quick Start

### 1. Install Backend Dependencies
```bash
cd repos/metabob-rpc-api
pip-compile --output-file=requirements.txt pyproject.toml
pip install -r requirements.txt
```

### 2. Verify Backend Works
```bash
cd repos/metabob-rpc-api
python3 -c "from server.app import create_app; app = create_app(); print('✓ Backend ready')"
```

### 3. Create TypeScript Interfaces
```bash
cd repos/metabob-opencode
# Create packages/opencode/src/session/template-metrics.ts
```

---

## Implementation Tasks

### Task 1: TypeScript Interfaces (30 min)

**File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts`

```typescript
/**
 * Types for activity template metrics and promotion system
 */

export interface ActivityExecutionData {
  activity_id: string;
  template_id: string;
  success: boolean;
  duration: number;  // milliseconds
  cost: number;      // USD
  tokens?: {
    input: number;
    output: number;
    cache: number;
  };
}

export interface TemplateMetrics {
  template_id: string;
  executions: number;
  success_rate: number;
  avg_cost: number;
  avg_duration: number;
  avg_tokens?: {
    input: number;
    output: number;
    cache: number;
  };
}

export interface PromotionRecommendation {
  template_id: string;
  action: 'PROMOTE' | 'KEEP_TESTING' | 'PRUNE' | 'NO_CANDIDATES';
  reason: string;
  candidate_id?: string;
  confidence?: number;
  metrics?: {
    stable: TemplateMetrics;
    candidate?: TemplateMetrics;
  };
}

export interface PromotionRequest {
  candidate_id: string;
  reason?: string;
}

export interface PromotionResponse {
  success: boolean;
  message: string;
  new_stable_id?: string;
  old_stable_id?: string;
}
```

---

### Task 2: MCP Client Integration (45 min)

**File:** `repos/metabob-opencode/packages/opencode/src/session/metrics-client.ts`

```typescript
/**
 * Client for interacting with activity metrics via MCP
 */

import type {
  ActivityExecutionData,
  TemplateMetrics,
  PromotionRecommendation,
  PromotionRequest,
  PromotionResponse,
} from './template-metrics.js';

export class ActivityMetricsClient {
  /**
   * Report activity execution to backend
   */
  async reportExecution(data: ActivityExecutionData): Promise<void> {
    try {
      const result = await (window as any).metabob_report_execution({
        activity_id: data.activity_id,
        template_id: data.template_id,
        success: data.success,
        duration: data.duration,
        cost: data.cost,
        tokens: data.tokens,
      });
      
      if (!result.success) {
        console.warn('Failed to report execution:', result.error);
      }
    } catch (error) {
      console.warn('Metrics reporting failed (graceful degradation):', error);
    }
  }

  /**
   * Get metrics for a template (stable + candidates)
   */
  async getTemplateMetrics(templateId: string): Promise<{
    stable: TemplateMetrics;
    candidates: TemplateMetrics[];
  } | null> {
    try {
      const result = await (window as any).metabob_get_template_metrics({
        template_id: templateId,
      });
      
      if (!result.success) {
        console.warn('Failed to get metrics:', result.error);
        return null;
      }
      
      return result.data;
    } catch (error) {
      console.warn('Metrics fetch failed (graceful degradation):', error);
      return null;
    }
  }

  /**
   * Get promotion recommendation for a template
   */
  async getRecommendation(templateId: string): Promise<PromotionRecommendation | null> {
    try {
      const result = await (window as any).metabob_get_promotion_recommendation({
        template_id: templateId,
      });
      
      if (!result.success) {
        console.warn('Failed to get recommendation:', result.error);
        return null;
      }
      
      return result.data;
    } catch (error) {
      console.warn('Recommendation fetch failed (graceful degradation):', error);
      return null;
    }
  }

  /**
   * Promote a candidate template to stable
   */
  async promoteTemplate(request: PromotionRequest): Promise<PromotionResponse | null> {
    try {
      const result = await (window as any).metabob_promote_template({
        candidate_id: request.candidate_id,
        reason: request.reason,
      });
      
      if (!result.success) {
        console.error('Failed to promote template:', result.error);
        return null;
      }
      
      return result.data;
    } catch (error) {
      console.error('Template promotion failed:', error);
      return null;
    }
  }
}

// Export singleton instance
export const activityMetrics = new ActivityMetricsClient();
```

---

### Task 3: Activity Execution Integration (30 min)

**File:** `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Changes needed:**

1. Import metrics client:
```typescript
import { activityMetrics } from './metrics-client.js';
```

2. After activity execution completes (search for activity completion logic):
```typescript
// After execution completes successfully or fails
const executionData = {
  activity_id: activity.id,
  template_id: activity.templateId,
  success: activity.status === 'completed',
  duration: activity.endTime - activity.startTime,
  cost: calculateCost(activity.tokens),  // Use existing cost calculation
  tokens: activity.tokens,
};

// Report to backend (non-blocking, graceful degradation)
activityMetrics.reportExecution(executionData).catch(() => {
  // Silent failure, metrics are not critical path
});
```

---

### Task 4: CLI Commands (45 min)

**File:** `repos/metabob-opencode/packages/opencode/src/cli/commands/activity-metrics.ts` (new file)

```typescript
import { Command } from 'commander';
import { activityMetrics } from '../../session/metrics-client.js';

export function createActivityMetricsCommand(): Command {
  const cmd = new Command('metrics')
    .description('View and manage activity template metrics');

  // View metrics command
  cmd
    .command('view <template-id>')
    .description('View metrics for a template')
    .action(async (templateId: string) => {
      const metrics = await activityMetrics.getTemplateMetrics(templateId);
      
      if (!metrics) {
        console.error('Failed to fetch metrics');
        return;
      }

      console.log('\nTemplate Metrics:');
      console.log('─────────────────────────────────────');
      console.log(`Stable Template: ${templateId}`);
      console.log(`  Executions: ${metrics.stable.executions}`);
      console.log(`  Success Rate: ${(metrics.stable.success_rate * 100).toFixed(1)}%`);
      console.log(`  Avg Cost: $${metrics.stable.avg_cost.toFixed(4)}`);
      console.log(`  Avg Duration: ${(metrics.stable.avg_duration / 1000).toFixed(1)}s`);

      if (metrics.candidates.length > 0) {
        console.log('\nCandidate Templates:');
        metrics.candidates.forEach((candidate, i) => {
          console.log(`\n  Candidate ${i + 1}: ${candidate.template_id}`);
          console.log(`    Executions: ${candidate.executions}`);
          console.log(`    Success Rate: ${(candidate.success_rate * 100).toFixed(1)}%`);
          console.log(`    Avg Cost: $${candidate.avg_cost.toFixed(4)}`);
        });
      }
    });

  // Recommendation command
  cmd
    .command('recommend <template-id>')
    .description('Get promotion recommendation')
    .action(async (templateId: string) => {
      const rec = await activityMetrics.getRecommendation(templateId);
      
      if (!rec) {
        console.error('Failed to get recommendation');
        return;
      }

      console.log('\nPromotion Recommendation:');
      console.log('─────────────────────────────────────');
      console.log(`Action: ${rec.action}`);
      console.log(`Reason: ${rec.reason}`);
      
      if (rec.candidate_id) {
        console.log(`Candidate: ${rec.candidate_id}`);
      }
    });

  // Promote command
  cmd
    .command('promote <candidate-id>')
    .description('Promote a candidate template to stable')
    .option('-r, --reason <reason>', 'Reason for promotion')
    .action(async (candidateId: string, options: { reason?: string }) => {
      const result = await activityMetrics.promoteTemplate({
        candidate_id: candidateId,
        reason: options.reason,
      });
      
      if (!result) {
        console.error('Failed to promote template');
        return;
      }

      console.log('\nTemplate Promoted Successfully!');
      console.log('─────────────────────────────────────');
      console.log(`New Stable: ${result.new_stable_id}`);
      console.log(`Old Stable: ${result.old_stable_id}`);
    });

  return cmd;
}
```

**File:** `repos/metabob-opencode/packages/opencode/src/cli/index.ts`

Add metrics command registration:
```typescript
import { createActivityMetricsCommand } from './commands/activity-metrics.js';

// In CLI setup:
program.addCommand(createActivityMetricsCommand());
```

---

### Task 5: Error Handling & Testing (30 min)

1. **Graceful Degradation:**
   - All MCP calls wrapped in try/catch
   - Silent failures for non-critical metrics
   - Logging for debugging without blocking execution

2. **Unit Tests:**
   - Test metrics client with mocked MCP calls
   - Test activity integration (execution reporting)
   - Test CLI commands with mocked client

3. **Integration Tests:**
   - Run full activity with metrics reporting
   - Verify metrics appear in backend
   - Test recommendation flow

---

## Verification Checklist

### Backend Verification:
- [ ] scipy installed (`pip list | grep scipy`)
- [ ] Backend starts without errors
- [ ] All 4 endpoints registered (`/docs`)
- [ ] Health check passes

### OpenCode Verification:
- [ ] TypeScript compiles without errors
- [ ] Metrics client can be imported
- [ ] Activity execution reports metrics
- [ ] CLI commands work
- [ ] Graceful degradation when MCP unavailable

### End-to-End Verification:
- [ ] Run activity, see metrics in backend
- [ ] Query metrics via CLI
- [ ] Get recommendation
- [ ] Test promotion (MVP stub)

---

## Expected Timeline

- **Task 1 (Interfaces):** 30 min
- **Task 2 (Client):** 45 min
- **Task 3 (Integration):** 30 min
- **Task 4 (CLI):** 45 min
- **Task 5 (Testing):** 30 min

**Total: ~3 hours**

---

## Success Criteria

✅ Activity executions automatically report metrics  
✅ CLI commands query and display metrics  
✅ Graceful degradation when backend unavailable  
✅ End-to-end metrics flow working  
✅ Ready for Phase 3.4 (validation)

---

## Next Phase: 3.4 - Validation

After Phase 3.3 complete:
- Run `validate-architecture-compliance` activity
- Verify 100% compliance (13/13 criteria)
- Update MCP_GATEWAY_ARCHITECTURE.md with results
- Begin Phase 3.5 (E2E testing)
