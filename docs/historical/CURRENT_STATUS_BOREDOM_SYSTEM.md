# Boredom Activity System - Current Status

**Date**: 2026-02-21  
**Phase**: Between Phase 1 (Complete ✅) and Phase 2 (Ready to Start)

---

## Phase 1: COMPLETE ✅

### What Was Done

**Metrics Enhancement Implementation:**
- ✅ Frontend failure capture (`getFailureDetails()` in activity.ts)
- ✅ Type definitions extended (template-metrics.ts)
- ✅ Backend storage enhanced (activity_templates.py)
  - `categorize_trend()` helper
  - `improvement_gradient` calculation
  - `failure_patterns` aggregation
  - `performance_trends` tracking
- ✅ Documentation updated (flow doc v2, architecture doc)

**Key Capabilities Enabled:**
- Templates can be ranked by quality (improvement_gradient: 0.0-1.0)
- Systematic failures are tracked (failure_patterns array)
- Performance regressions are detected (performance_trends)
- Recent execution history available for analysis

**Code Status:**
- All code committed: `0945fc2 Complete boredom activity system Phase 1 documentation`
- Working tree clean (no uncommitted changes)
- Tests passing (8 backend tests)
- Backward compatible (all new fields optional)

---

## Phase 2: READY TO START 🚀

### What Needs to Be Done

**Goal:** Create API for fetching boredom activities and implement idle detection

### Step 1: Implement Boredom Activities API (4-6 hours)

**Backend Tool: `metabob_fetch_boredom_activities`**

Location: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py`

Function signature:
```python
@server.call_tool()
async def metabob_fetch_boredom_activities(
    activity_type: Optional[str] = None,  # Filter by type
    min_gradient: float = 0.0,            # Minimum quality threshold
    max_results: int = 10                 # Limit results
) -> list[dict]:
    """
    Fetch activity improvement opportunities for boredom system.
    
    Returns prioritized list of activities that need improvement.
    Sorted by improvement_gradient (ascending = worst quality first).
    """
```

Return format:
```json
[
  {
    "activity_type": "improve-template",
    "priority": 1,
    "template_id": "add-rest-endpoint",
    "improvement_gradient": 0.45,
    "reason": "Success rate degrading (60%), 2 systematic validation failures",
    "estimated_effort": "medium",
    "data": {
      "success_rate": 0.6,
      "failure_patterns": [...],
      "performance_trends": {...}
    }
  },
  ...
]
```

**Activity Types to Support:**
1. `improve-template` - Fix templates with low gradient (<0.6)
2. `debug-failures` - Fix templates with systematic failures
3. `optimize-performance` - Fix templates with degrading trends
4. `refine-impulses` - Improve impulse quality (future)
5. `merge-similar` - Combine duplicate templates (future)

**Implementation Tasks:**
- [ ] Add tool definition to activity_templates.py
- [ ] Implement prioritization logic (sort by gradient)
- [ ] Implement activity type categorization
- [ ] Add effort estimation logic
- [ ] Write tests for API

### Step 2: Implement Idle Detection (2-3 hours)

**Frontend Class: `BoredomManager`**

Location: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts` (new file)

Class design:
```typescript
export class BoredomManager {
  private idleThresholdMs = 5 * 60 * 1000  // 5 minutes
  private lastUserActivityTime: number
  private boredomTimer?: NodeJS.Timeout
  private currentBoredomActivity?: Activity
  
  startMonitoring(session: Session): void
  onUserActivity(): void
  private async fetchAndExecuteBoredomActivity(): Promise<void>
  cancelCurrentActivity(): void
}
```

**Implementation Tasks:**
- [ ] Create BoredomManager class
- [ ] Integrate with Session lifecycle
- [ ] Add user activity detection hooks
- [ ] Add cancellation on user return
- [ ] Write tests for idle detection

### Step 3: Create First Boredom Activity Template (3-4 hours)

**Template: `improve-activity-template`**

Location: `templates/boredom/improve-activity-template.json`

Template design:
```json
{
  "name": "Improve Activity Template",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "analyze-failures",
      "description": "Analyze failure patterns and identify root causes",
      "prompt": "Review failure patterns for {{template_id}}:\n{{failure_patterns}}\n\nIdentify systematic issues..."
    },
    {
      "id": "propose-fixes",
      "description": "Propose concrete improvements",
      "prompt": "Based on failures, propose fixes..."
    },
    {
      "id": "implement-fixes",
      "description": "Implement the fixes",
      "prompt": "Apply the fixes to {{template_file}}..."
    },
    {
      "id": "test-improvements",
      "description": "Test the improved template",
      "prompt": "Execute the improved template and verify..."
    }
  ]
}
```

**Implementation Tasks:**
- [ ] Design template structure
- [ ] Write task prompts
- [ ] Add validation rules
- [ ] Test on a real underperforming template
- [ ] Document usage

---

## Recommended Approach

**Option A: Full Phase 2 Implementation** (12-15 hours)
- Complete all 3 steps above
- End-to-end working boredom system
- Requires significant time investment

**Option B: Incremental MVP** (6-8 hours) ⭐ RECOMMENDED
1. Implement boredom API (4-6 hours)
2. Test API manually with sample queries
3. Verify data quality and prioritization
4. **STOP HERE** and validate approach
5. Continue with idle detection and templates in next session

**Option C: Use Existing Activities** (2 hours) 🚀 FASTEST
- Don't build custom boredom system yet
- Use existing `trace-data-flow-single-feature` to document Phase 2 implementation plan
- Use existing `propagate-change-through-flow` to implement boredom API
- Leverage proven activity templates to build the boredom system itself!

---

## Recommendation

**I recommend Option C** for the following reasons:

1. **Proven Pattern**: We successfully used activities to implement Phase 1 (metrics enhancement)
2. **Faster**: 2 hours vs 6-15 hours
3. **Higher Quality**: Activity templates enforce systematic approach
4. **Self-Demonstrating**: Using activities to build boredom system proves the vision
5. **Documented**: Automatic documentation via activity artifacts

**Next Commands:**
```bash
# Step 1: Trace the boredom API implementation path (20 min, ~$2)
activity({
  templateId: "trace-data-flow-single-feature",
  variables: {
    featureName: "Boredom Activities API (metabob_fetch_boredom_activities)",
    entryPoint: "repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py",
    description: "MCP tool that queries activity templates by improvement_gradient and returns prioritized boredom activities"
  },
  reason: "Map complete implementation path for boredom API before coding"
})

# Step 2: Implement the API using propagation (16 min, ~$1.70)
activity({
  templateId: "propagate-change-through-flow",
  variables: {
    flowDocPath: "docs/data-flows/boredom-activities-api-flow.md",
    changeType: "addTool",
    changeDescription: "Add metabob_fetch_boredom_activities MCP tool with gradient-based prioritization"
  },
  reason: "Systematically implement boredom API following traced data flow"
})
```

---

## Questions to Resolve

1. **Should we proceed with Option C (activity-based implementation)?**
   - Pro: Fast, proven, self-demonstrating
   - Con: Slightly meta (using activities to build activity system)

2. **What's the priority: speed vs custom implementation?**
   - Speed: Use activities (Option C) - 2 hours
   - Custom: Manual implementation (Option B) - 6-8 hours

3. **Should we test metrics in production first?**
   - Pro: Validate data quality before building API
   - Con: Delays Phase 2 implementation

---

## Success Criteria

**Phase 2 Complete When:**
- ✅ `metabob_fetch_boredom_activities` tool implemented and tested
- ✅ Returns prioritized activities based on improvement_gradient
- ✅ Categorizes activities by type (improve-template, debug-failures, etc.)
- ✅ Integration tested with real activity metrics
- ✅ Documentation updated

**Phase 3 (Idle Detection) Complete When:**
- ✅ BoredomManager class implemented
- ✅ Idle detection working (5-minute threshold)
- ✅ Cancellation on user activity working
- ✅ First boredom activity executes successfully

---

## Current Decision Point

**What should we do next?**

A. Implement boredom API manually (6-8 hours)  
B. Use activity templates to implement API (2 hours) ⭐  
C. Test metrics in production first (1 hour validation)  
D. Something else?

Please advise!
