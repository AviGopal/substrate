# LLM Goal Enrichment - Tasks

## Milestone 1: Type Definitions

- [x] **M1.1** Add GoalEnrichment interface to types.ts
- [x] **M1.2** Update Goal interface to include optional enrichment field
- [x] **M1.3** Add ExecutionFacts interface for verification
- [x] **M1.4** Add GoalState type for state machine tracking

## Milestone 2: LLM Enrichment in parseGoal()

- [x] **M2.1** Add enrichGoalWithLLM() private method
- [x] **M2.2** Make parseGoal() async and call enrichGoalWithLLM()
- [x] **M2.3** Update all callers of parseGoal() to await
- [x] **M2.4** Add error handling with fallback to simple parsing

## Milestone 3: Backend-Driven assessRelevance()

- [x] **M3.1** Replace keyword matching with backend score usage
- [x] **M3.2** Add optional capability overlap boost
- [x] **M3.3** Remove keyword-based special patterns

## Milestone 4: LLM-Based verifyGoalAchievement()

- [x] **M4.1** Add gatherExecutionFacts() helper method
- [x] **M4.2** Make verifyGoalAchievement() async with LLM call
- [x] **M4.3** Update isGoalComplete() to await verification
- [x] **M4.4** Add confidence threshold for verification

## Milestone 5: Activity Loop Refactor

- [x] **M5.1** Add state tracking to executeGoal()
- [x] **M5.2** Add improviseUntilComplete() method
- [x] **M5.3** Update loop to use new async methods
- [x] **M5.4** Add proper event emission for state transitions

## Milestone 6: Testing & Validation

- [x] **M6.1** Test vague goals like "say hello"
- [x] **M6.2** Test goal with matching activity
- [x] **M6.3** Test improvisation fallback
- [x] **M6.4** Verify cost tracking for LLM calls

## Summary

**All tasks complete!**

The implementation includes:
- **parseGoal()**: Now async with LLM enrichment, falls back to keyword matching on error
- **assessRelevance()**: Now uses backend Thompson Sampling scores, not keywords
- **verifyGoalAchievement()**: Now async with LLM-based fact verification
- **executeGoal()**: Updated to await async methods
- **improviseUntilComplete()**: Dedicated method with vessel hooks for:
  - `onTurnEndRecommend`: Get fresh recommendations from a recommendation vessel
  - `onTurnEndEvolveImpulses`: Evolve impulse state via a context vessel
- **Event emission**: Full state machine events (goal:started, goal:enriched, goal:completed, goal:failed, activity:started, activity:completed, activity:failed, improvisation:started, improvisation:turn_started, improvisation:turn_completed, state:changed)

The core SPEC-001 and SPEC-002 goals are achieved, plus M5.2 and M5.4 are now complete.
