# Fixing the Insanity Loop & Category Problem

## Problem Discovered

When using the goal tool, MiniBob was stuck in an **insanity loop**:
- Same activities recommended repeatedly
- All activities failing immediately (0 tokens, ~1 second each)
- No reflection on why they failed
- No attempt to improvise
- Iteration after iteration of the same failures

This violates the definition of insanity: **doing the same thing repeatedly and expecting different results**.

## Root Causes

### 1. **No Tracking of Failed Attempts**
The GoalProcessor didn't remember which templates had already failed, so:
- Backend recommended the SAME activities every iteration
- Loop would try activity A, fail, try activity B, fail, try activity C, fail
- Next iteration: try activity A again, fail, try activity B again, fail...
- Insanity!

### 2. **Immediate Activity Failures**
All activities failed with 0 tokens before reaching the LLM, suggesting:
- ActivityExecutor can't connect to LLM
- OR activities are failing validation
- OR tool/environment setup issue
- Need to investigate actual failure reasons

### 3. **Improvisation Never Triggered**
The old improvisation logic had fatal flaws:
- Only checked `i < maxActivities - 1` (never improvised on last iteration)
- Checked if "all executions failed" but by then it had already tried everything
- By the time improvisation condition was true, the loop moved on

## Fixes Applied

### Fix 1: Track Failed Attempts (Anti-Insanity)
```typescript
// Track failed templates to avoid retrying
const failedTemplateIds = new Set<string>()

// Filter recommendations to exclude already-tried activities
const untriedRecommendations = recommendations.filter(
  rec => !failedTemplateIds.has(rec.templateId)
)

// After failure, mark as failed
if (execution.status === "failed") {
  failedTemplateIds.add(topRecommendation.templateId)
  console.log(`Marked ${topRecommendation.templateId} as failed. Will try different approach.`)
}
```

### Fix 2: Improvise When No Untried Recommendations
```typescript
if (untriedRecommendations.length === 0) {
  if (hasAttemptedImprovisation) {
    console.warn("No untried recommendations and already improvised. Giving up.")
    break
  }
  
  console.log("No untried recommendations. Improvising new activity...")
  // Create new activity via MCPActivityBridge
  hasAttemptedImprovisation = true
}
```

### Fix 3: Removed Insane Alternative-Trying Logic
Old code tried alternatives from THE SAME recommendation list in a nested loop. This was redundant since the main loop already handles trying different activities.

## Still Unresolved: The Category Problem

As the user correctly pointed out:

> "We shouldn't really have all these hardcoded categories, since an activity could be any workflow or process that we can automate by running some sequence of code."

**Current Problem:**
- Hardcoded categories: `feature | bugfix | refactor | infrastructure | tool | other`
- Rigid keyword matching in parseGoal()
- Backend recommendation uses exact category match

**Desired Behavior:**
- Type field + goal text = **keywords for semantic search**
- Combine with Thompson Sampling scores
- Weight by activity execution graph (which activities work well together)
- No restrictions on what an activity can be

## Next Steps

1. **Fix the 0-token failures** - Investigate why activities fail immediately without executing
2. **Remove category enum** - Make type a flexible keyword field
3. **Implement semantic search** - Match goal keywords to activity descriptions
4. **Enhance recommendation endpoint** - Combine:
   - Keyword similarity scores
   - Thompson Sampling (exploration/exploitation)
   - Execution graph weights (successful composition patterns)
5. **Test the anti-insanity logic** - Verify it stops retrying failed activities

## Key Insight

The LLM provides **ductility and robustness** to otherwise brittle conventional software. We use it to:
- Choose between execution forks
- Improvise when plans fail
- Add flexibility to deterministic workflows

But the workflow orchestration itself (tracking failures, avoiding insanity, learning from outcomes) must be **reliable conventional software**.

**We can't use unreliable LLM calls to fix unreliable LLM-based systems.**
