# Learned Corpus Dashboard

## Summary

Build a dashboard at `graph.metabob.local` to visualize the learned corpus - Thompson Sampling scores, activity beliefs, and improvisation candidates. This provides visibility into what the system has learned from execution traces.

## Problem

The system captures rich execution data (success/failure, cost, duration, tokens) and computes Thompson Sampling parameters, but this learned knowledge is invisible. We cannot:
- See which activities the system believes are effective
- Identify improvisation candidates (activities needing evolution)
- Track how beliefs change as more executions occur
- Understand the exploration vs exploitation balance

## Solution

Create a "Learned Corpus" view in the activity-dashboard that surfaces:

1. **Corpus Statistics** - Aggregate metrics (total activities, executions, success rate, cost)
2. **Activity Beliefs** - Thompson Sampling posteriors (alpha/beta) with visual representation
3. **Improvisation Candidates** - Patterns detected for evolution opportunities

## Data Sources

All data exists in SurrealDB, computed by `v_activity_score` view:
- `alpha`, `beta` - Thompson Sampling parameters (successes+1, failures+1)
- `total_executions`, `successes`, `failures` - Execution counts
- `avg_cost_usd`, `avg_duration_ms` - Performance metrics
- `total_tokens_in`, `total_tokens_out` - Token usage

## Scope

**In scope:**
- Backend: GET /v2/activities/scores endpoint
- Backend: GET /v2/activities/corpus-summary endpoint
- Frontend: LearnedCorpus component with 3 sub-views
- Frontend: useCorpus hook for data fetching
- Integration into App.tsx as new tab

**Out of scope:**
- New database views or tables
- Improvisation field aggregation (future work)
- Edge/composition weight history tracking
- Real-time WebSocket push for score updates

## Success Criteria

- Dashboard loads with real data from v_activity_score
- Thompson Sampling beliefs visualized with progress bars
- Improvisation candidates detected from pattern analysis
- No mock data - all data from database
