# Activity Template A/B Testing System Design

**Status:** Design Proposal  
**Date:** 2026-02-18  
**Author:** Activity Mode Analysis

---

## Executive Summary

**Problem:** Activity templates currently lack a systematic way to test improvements and measure their impact. When we create an improved version of a template, we have no mechanism to:
1. A/B test the new version against the stable version
2. Automatically promote better-performing variants
3. Prune unsuccessful experimental branches
4. Track improvement gradients over time

**Solution:** Implement a **stable/candidate** branching system with automated A/B testing, promotion, and pruning based on statistical significance.

---

## Current State Analysis

### What We Have
✅ Template genealogy tracking (`parentTemplateId`, `version`, `evolutionReason`)  
✅ Execution metrics (success rate, cost, duration, task-level stats)  
✅ Local storage of all templates and executions  
✅ Activity error inspector and replay tools  
✅ Improvement gradient analysis script  

### What's Missing
❌ Stable vs. candidate designation system  
❌ A/B test allocation strategy  
❌ Statistical significance testing  
❌ Automated promotion/pruning logic  
❌ Dashboard for monitoring A/B tests  
❌ Rollback mechanism for bad promotions  

---

## Design Principles

1. **Conservative by Default:** Stable templates are the default; candidates must prove themselves
2. **Statistical Rigor:** Promotion requires statistical significance (p < 0.05)
3. **Multi-Metric:** Consider success rate, cost, and duration together
4. **Graceful Degradation:** Failed candidates don't affect stable template users
5. **Transparent:** All A/B test results visible to users
6. **Reversible:** Promotions can be rolled back if problems emerge

---

## Architecture

### 1. Template Status Model

```typescript
enum TemplateStatus {
  STABLE = "stable",        // Production-ready, default for users
  CANDIDATE = "candidate",  // Testing phase, allocated to subset of users
  ARCHIVED = "archived",    // Pruned or replaced, no longer allocated
  DEPRECATED = "deprecated" // Stable but superseded, graceful sunset
}

interface TemplateMetadata {
  id: string
  name: string
  status: TemplateStatus
  
  // Stable/Candidate Relationship
  stableVariantId?: string   // If candidate, points to stable version
  candidateIds: string[]     // If stable, lists active candidates
  
  // A/B Testing
  allocationWeight: number   // 0.0-1.0, controls traffic split
  abTestStartedAt?: Date
  abTestSampleSize: number   // Min samples before promotion decision
  
  // Performance Tracking
  executions: number
  successRate: number
  avgCost: number
  avgDuration: number
  
  // Lifecycle
  createdAt: Date
  promotedAt?: Date
  archivedAt?: Date
  
  // Genealogy (existing)
  parentTemplateId?: string
  version: {
    generation: number
    variantHash: string
  }
  evolutionReason: EvolutionReason
  evolutionNotes: string
}
```

### 2. A/B Test Allocation Strategy

```typescript
interface AllocationStrategy {
  // Default: 90% stable, 10% candidate
  stableWeight: number    // 0.9
  candidateWeight: number // 0.1 (split among multiple candidates)
  
  // Minimum sample size before promotion decision
  minSampleSize: number   // e.g., 20 executions per variant
  
  // Statistical confidence level
  confidenceLevel: number // 0.95 (p < 0.05)
  
  // Promotion criteria
  promotionThresholds: {
    successRateDelta: number  // +5% improvement required
    costDeltaPct: number      // -10% cost reduction OR neutral
    durationDeltaPct: number  // -10% duration reduction OR neutral
  }
  
  // Pruning criteria
  pruningThresholds: {
    minExecutions: number    // 10 minimum before pruning
    maxFailureRate: number   // 70% failure rate = prune
    noImprovementAfter: number // 50 executions with no improvement
  }
}
```

### 3. Template Selection Algorithm

```typescript
function selectTemplate(baseTemplateId: string, userId?: string): string {
  // 1. Load stable template
  const stable = TemplateRegistry.get(baseTemplateId)
  if (stable.status !== TemplateStatus.STABLE) {
    throw new Error("Base template must be stable")
  }
  
  // 2. Get active candidates
  const candidates = stable.candidateIds
    .map(id => TemplateRegistry.get(id))
    .filter(t => t.status === TemplateStatus.CANDIDATE)
  
  // 3. If no candidates, return stable
  if (candidates.length === 0) {
    return stable.id
  }
  
  // 4. A/B test allocation
  const strategy = ABTestConfig.get(stable.id)
  const roll = Math.random()
  
  // Stable gets majority of traffic
  if (roll < strategy.stableWeight) {
    return stable.id
  }
  
  // Candidates split remaining traffic
  const candidateTraffic = 1.0 - strategy.stableWeight
  const perCandidateWeight = candidateTraffic / candidates.length
  
  const candidateRoll = (roll - strategy.stableWeight) / candidateTraffic
  const selectedIndex = Math.floor(candidateRoll / perCandidateWeight)
  
  return candidates[selectedIndex]?.id || stable.id
}
```

### 4. Promotion Decision Logic

```typescript
interface PromotionDecision {
  action: "PROMOTE" | "CONTINUE_TESTING" | "PRUNE"
  reason: string
  confidence: number
  comparison: ComparisonMetrics
}

function evaluatePromotion(
  stableId: string,
  candidateId: string
): PromotionDecision {
  const stable = TemplateRegistry.get(stableId)
  const candidate = TemplateRegistry.get(candidateId)
  const strategy = ABTestConfig.get(stableId)
  
  // 1. Check minimum sample size
  if (candidate.executions < strategy.minSampleSize) {
    return {
      action: "CONTINUE_TESTING",
      reason: `Insufficient data (${candidate.executions}/${strategy.minSampleSize})`,
      confidence: 0.0,
      comparison: {} as any
    }
  }
  
  // 2. Calculate metrics
  const successDelta = candidate.successRate - stable.successRate
  const costDelta = ((candidate.avgCost - stable.avgCost) / stable.avgCost) * 100
  const durationDelta = ((candidate.avgDuration - stable.avgDuration) / stable.avgDuration) * 100
  
  // 3. Statistical significance testing (Chi-square for success rate)
  const pValue = chiSquareTest(
    [stable.executions * stable.successRate, candidate.executions * candidate.successRate],
    [stable.executions, candidate.executions]
  )
  
  const comparison = {
    successDelta,
    costDelta,
    durationDelta,
    pValue
  }
  
  // 4. Pruning checks (fail fast)
  if (candidate.executions >= strategy.pruningThresholds.minExecutions) {
    if (candidate.successRate < (1 - strategy.pruningThresholds.maxFailureRate)) {
      return {
        action: "PRUNE",
        reason: `High failure rate (${candidate.successRate.toFixed(1)}%)`,
        confidence: 1.0 - pValue,
        comparison
      }
    }
    
    if (candidate.executions >= strategy.pruningThresholds.noImprovementAfter &&
        successDelta < 0 && pValue < strategy.confidenceLevel) {
      return {
        action: "PRUNE",
        reason: `Statistically worse than stable (p=${pValue.toFixed(3)})`,
        confidence: 1.0 - pValue,
        comparison
      }
    }
  }
  
  // 5. Promotion checks
  const meetsSuccessThreshold = successDelta >= strategy.promotionThresholds.successRateDelta
  const meetsCostThreshold = costDelta <= strategy.promotionThresholds.costDeltaPct
  const meetsDurationThreshold = durationDelta <= strategy.promotionThresholds.durationDeltaPct
  const isSignificant = pValue < (1 - strategy.confidenceLevel)
  
  if (meetsSuccessThreshold && meetsCostThreshold && meetsDurationThreshold && isSignificant) {
    return {
      action: "PROMOTE",
      reason: `Significant improvement: +${successDelta.toFixed(1)}% success, ${costDelta.toFixed(1)}% cost, ${durationDelta.toFixed(1)}% duration (p=${pValue.toFixed(3)})`,
      confidence: 1.0 - pValue,
      comparison
    }
  }
  
  // 6. Continue testing
  return {
    action: "CONTINUE_TESTING",
    reason: `Needs more data or improvements not significant (p=${pValue.toFixed(3)})`,
    confidence: 1.0 - pValue,
    comparison
  }
}
```

### 5. Promotion & Pruning Workflow

```typescript
async function promoteCandidate(candidateId: string): Promise<void> {
  const candidate = TemplateRegistry.get(candidateId)
  const stable = TemplateRegistry.get(candidate.stableVariantId!)
  
  // 1. Archive current stable
  stable.status = TemplateStatus.DEPRECATED
  stable.deprecatedAt = new Date()
  stable.replacedBy = candidateId
  await TemplateRegistry.save(stable)
  
  // 2. Promote candidate to stable
  candidate.status = TemplateStatus.STABLE
  candidate.promotedAt = new Date()
  candidate.stableVariantId = undefined
  candidate.candidateIds = []
  await TemplateRegistry.save(candidate)
  
  // 3. Update base template pointer (if exists)
  // Users who reference "fix-bug-complete" should now get the new promoted version
  await TemplateRegistry.updateAlias(stable.name, candidateId)
  
  // 4. Notify users
  await NotificationService.send({
    type: "TEMPLATE_PROMOTED",
    templateName: candidate.name,
    oldVersion: stable.version.generation,
    newVersion: candidate.version.generation,
    improvements: `+${(candidate.successRate - stable.successRate).toFixed(1)}% success rate`
  })
  
  // 5. Archive other active candidates (optional)
  for (const otherId of stable.candidateIds.filter(id => id !== candidateId)) {
    await pruneCandidate(otherId, "Superseded by promoted candidate")
  }
}

async function pruneCandidate(candidateId: string, reason: string): Promise<void> {
  const candidate = TemplateRegistry.get(candidateId)
  const stable = TemplateRegistry.get(candidate.stableVariantId!)
  
  // 1. Mark as archived
  candidate.status = TemplateStatus.ARCHIVED
  candidate.archivedAt = new Date()
  candidate.archiveReason = reason
  await TemplateRegistry.save(candidate)
  
  // 2. Remove from stable's candidate list
  stable.candidateIds = stable.candidateIds.filter(id => id !== candidateId)
  await TemplateRegistry.save(stable)
  
  // 3. Log for analysis
  await AnalyticsService.log({
    type: "CANDIDATE_PRUNED",
    candidateId,
    reason,
    metrics: {
      executions: candidate.executions,
      successRate: candidate.successRate,
      avgCost: candidate.avgCost
    }
  })
}
```

---

## Implementation Plan

### Phase 1: Schema & Core Logic (Week 1)

**Tasks:**
1. ✅ Add `status`, `stableVariantId`, `candidateIds`, `allocationWeight` to template schema
2. ✅ Implement `selectTemplate()` function with A/B allocation
3. ✅ Add `TemplateStatus` enum to codebase
4. ✅ Create `ABTestConfig` storage

**Deliverables:**
- Updated `ActivityTemplate.Schema` with new fields
- Template selection function in `template-executor.ts`
- Database migration script

### Phase 2: Metrics & Decision Engine (Week 2)

**Tasks:**
1. ✅ Implement `evaluatePromotion()` with statistical testing
2. ✅ Add Chi-square test library or simple implementation
3. ✅ Create promotion/pruning automation scripts
4. ✅ Add lifecycle methods (`promoteCandidate()`, `pruneCandidate()`)

**Deliverables:**
- Promotion decision engine
- Automated promotion/pruning cron job
- Unit tests for statistical tests

### Phase 3: Tooling & CLI (Week 3)

**Tasks:**
1. ✅ Create `create-candidate-template` activity
2. ✅ Add CLI commands:
   - `opencode template create-candidate <stable-id>`
   - `opencode template list-candidates <stable-id>`
   - `opencode template evaluate <candidate-id>`
   - `opencode template promote <candidate-id>`
   - `opencode template prune <candidate-id>`
3. ✅ Build A/B test dashboard (text-based or web UI)

**Deliverables:**
- CLI commands for template lifecycle management
- Dashboard showing active A/B tests
- Documentation for workflow

### Phase 4: Integration & Monitoring (Week 4)

**Tasks:**
1. ✅ Integrate with existing `activity` tool
2. ✅ Add metrics collection to activity execution
3. ✅ Create automated evaluation cron job (daily)
4. ✅ Add rollback mechanism for bad promotions
5. ✅ User notifications for template changes

**Deliverables:**
- Fully integrated A/B testing system
- Monitoring and alerting
- Rollback procedures
- User communication plan

---

## Example Workflow

### Scenario: Improving `fix-bug-complete` Template

#### Step 1: Create Candidate

```bash
# Analyze current stable performance
opencode template analyze fix-bug-complete
# Output:
# fix-bug-complete (STABLE)
#   Executions: 150
#   Success Rate: 72%
#   Avg Cost: $0.0234
#   Avg Duration: 45s
#   
#   Issues identified:
#   - 28% failure rate in task-2 (implement-fix)
#   - Common error: "context truncated"
#   
#   Recommendation: Increase impulse budget for errorContext

# Create candidate with improvements
opencode template create-candidate fix-bug-complete \
  --changes "Increased errorContext budget from [2000,4000] to [3000,6000]" \
  --reason "Address context truncation in task-2"

# Output:
# ✅ Created candidate: fix-bug-complete-candidate-1 (CANDIDATE)
#    Parent: fix-bug-complete (STABLE)
#    A/B Test: 10% traffic allocated to candidate
#    Status: Testing (0/20 executions needed)
```

#### Step 2: Monitor A/B Test

```bash
# Check progress
opencode template status fix-bug-complete

# Output:
# fix-bug-complete (STABLE) - 90% traffic
#   Executions: 150 → 168 (+18 since candidate created)
#   Success Rate: 72% (current window: 70%)
#   
# fix-bug-complete-candidate-1 (CANDIDATE) - 10% traffic
#   Executions: 0 → 12 (+12)
#   Success Rate: 83% ⬆️ +11%
#   Avg Cost: $0.0256 (+9%)
#   Avg Duration: 48s (+7%)
#   
#   Status: CONTINUE_TESTING (12/20 executions)
#   Decision: Insufficient data, trending positive
```

#### Step 3: Automated Evaluation (Cron Job)

```bash
# Runs daily: opencode template evaluate-all

# After 20 executions:
# 
# fix-bug-complete-candidate-1 (CANDIDATE)
#   Executions: 20
#   Success Rate: 85% vs 72% (+13%, p=0.03) ✅
#   Avg Cost: $0.0245 vs $0.0234 (+4.7%) ✅
#   Avg Duration: 47s vs 45s (+4.4%) ✅
#   
#   🎯 DECISION: PROMOTE
#   Reason: Significant improvement (+13% success, p=0.03)
#   Confidence: 97%
#   
#   Action: Promote to stable, archive current stable
```

#### Step 4: Promotion

```bash
# Manual confirmation or auto-promote
opencode template promote fix-bug-complete-candidate-1 --confirm

# Output:
# ✅ Promoted fix-bug-complete-candidate-1 to STABLE
#    New version: fix-bug-complete v2
#    Archived: fix-bug-complete v1 (DEPRECATED)
#    
#    Improvements:
#    - Success rate: 72% → 85% (+13%)
#    - Task-2 failures: 28% → 12% (-16%)
#    
#    Users will receive new version on next execution.
#    Rollback available for 30 days.
```

#### Step 5: Rollback (If Needed)

```bash
# If promoted version has issues
opencode template rollback fix-bug-complete --to-version 1

# Output:
# ⚠️  Rolling back fix-bug-complete to v1
#    Current v2 will be archived
#    v1 will be restored as STABLE
#    
#    Reason: Manual rollback requested
#    Confirm? (y/n): y
#    
# ✅ Rollback complete. v1 is now STABLE.
```

---

## Metrics & Monitoring

### Dashboard View

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTIVE A/B TESTS                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ fix-bug-complete                                                │
│ ├─ STABLE (v1) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 90%         │
│ │  Executions: 168  Success: 72%  Cost: $0.0234  Duration: 45s │
│ └─ CANDIDATE (v2) ━━━━ 10%                                      │
│    Executions: 20   Success: 85% ⬆️  Cost: $0.0245  Duration: 47s│
│    Status: READY FOR PROMOTION (p=0.03, confidence 97%)         │
│                                                                 │
│ add-feature-complete                                            │
│ ├─ STABLE (v3) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 90%         │
│ │  Executions: 89   Success: 81%  Cost: $0.0456  Duration: 67s │
│ ├─ CANDIDATE (v4a) ━━━━ 5%                                      │
│ │  Executions: 8    Success: 88% ⬆️  Cost: $0.0423  Duration: 64s│
│ │  Status: CONTINUE_TESTING (8/20)                              │
│ └─ CANDIDATE (v4b) ━━━━ 5%                                      │
│    Executions: 6    Success: 67% ⬇️  Cost: $0.0389  Duration: 58s│
│    Status: PRUNE_RECOMMENDED (low success rate)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Metrics Collected

```typescript
interface ABTestMetrics {
  // Per-template
  templateId: string
  templateName: string
  status: TemplateStatus
  
  // Traffic allocation
  allocationPct: number
  executionsToday: number
  executionsTotal: number
  
  // Performance
  successRate: number
  successRateCI: [number, number] // 95% confidence interval
  avgCost: number
  avgDuration: number
  
  // Comparison (for candidates)
  vsStable?: {
    successDelta: number
    successDeltaPValue: number
    costDelta: number
    durationDelta: number
  }
  
  // Decision state
  recommendedAction: "PROMOTE" | "CONTINUE" | "PRUNE" | "NONE"
  actionReason: string
  confidence: number
  
  // Timestamp
  evaluatedAt: Date
}
```

---

## Configuration

### Default A/B Test Config

```json
{
  "allocationStrategy": {
    "stableWeight": 0.9,
    "candidateWeight": 0.1,
    "minSampleSize": 20,
    "confidenceLevel": 0.95
  },
  "promotionThresholds": {
    "successRateDelta": 0.05,
    "costDeltaPct": 10,
    "durationDeltaPct": 10
  },
  "pruningThresholds": {
    "minExecutions": 10,
    "maxFailureRate": 0.7,
    "noImprovementAfter": 50
  },
  "automation": {
    "autoPromote": false,
    "autoPrune": true,
    "evaluationCron": "0 */6 * * *",
    "notifyOnPromotion": true
  }
}
```

### Per-Template Overrides

```json
{
  "templateId": "fix-bug-complete",
  "allocationStrategy": {
    "candidateWeight": 0.2,
    "minSampleSize": 30
  },
  "promotionThresholds": {
    "successRateDelta": 0.10
  }
}
```

---

## Edge Cases & Considerations

### Multiple Candidates

**Scenario:** Stable template has 3 active candidates

**Solution:**
- Split candidate traffic equally (e.g., 90% stable, 3.33% each candidate)
- Evaluate each independently
- Promote best performer, prune others
- Or continue testing if no clear winner

### Low Traffic Templates

**Scenario:** Template rarely used (<5 executions/day)

**Solution:**
- Increase `minSampleSize` to account for variance
- Extend evaluation window (weekly instead of daily)
- Consider higher candidate traffic allocation (20% instead of 10%)

### Rollback After Promotion

**Scenario:** Promoted template shows issues in production

**Solution:**
- Immediate rollback available for 30 days
- Deprecated stable kept in storage
- Single command: `opencode template rollback <template-id>`
- Archive problematic promoted version

### Chain of Candidates

**Scenario:** Create candidate from a candidate

**Solution:**
- Disallow: Candidates can only branch from stable
- Enforce: If you want to improve a candidate, edit it directly
- Exception: If candidate gets promoted, then new candidates can branch from it

---

## Success Metrics

### System Health

- **Promotion Rate:** 20-30% of candidates promoted (not too aggressive, not too conservative)
- **Pruning Rate:** 30-40% of candidates pruned (healthy experimentation with failing fast)
- **Average Time to Decision:** 3-7 days (fast feedback, enough data)
- **False Promotions:** <5% (promoted but later rolled back)

### Template Quality

- **Overall Success Rate:** Trending upward over time
- **Cost Efficiency:** Stable or decreasing
- **User Satisfaction:** Measured by template usage and feedback

---

## Migration Path

### Existing Templates

1. **Mark all existing templates as STABLE**
2. **Set `candidateIds = []`** for all
3. **Backfill execution metrics** from activity storage
4. **Identify templates needing improvement** (success rate < 80%)
5. **Create candidates** for top-priority templates

### Gradual Rollout

- **Week 1:** Internal testing only (devbob contributors)
- **Week 2:** Opt-in for early adopters
- **Week 3:** Default for new templates
- **Week 4:** Full rollout to all templates

---

## Open Questions

1. **Should we support multi-armed bandit allocation?**
   - Dynamically adjust traffic based on performance
   - More efficient than fixed 90/10 split
   - More complex to implement

2. **How to handle breaking changes in candidates?**
   - Template schema changes
   - Variable renames
   - Task reordering

3. **Should candidates automatically prune after X days of inactivity?**
   - Avoid zombie candidates

4. **Integration with impulse budget optimization?**
   - Candidates could auto-adjust budgets

---

## Next Steps

1. **Review this design** with team
2. **Prioritize Phase 1** implementation
3. **Create POC** for template selection algorithm
4. **Build out schema changes** in opencode repo
5. **Test with 2-3 real templates** before full rollout

---

## References

- [Activity Debug Implementation Status](./ACTIVITY_DEBUG_IMPLEMENTATION_STATUS.md)
- [Template Performance Analysis](./template_performance_analysis.json)
- [Activity Template Evolution Summary](./ACTIVITY_TEMPLATE_EVOLUTION_SUMMARY.md)

---

**Status:** Ready for implementation  
**Estimated Effort:** 4 weeks (1 week per phase)  
**Risk Level:** Medium (existing templates unaffected, gradual rollout)
