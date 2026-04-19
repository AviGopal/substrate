# State-Aware Activity Selection - Real Implementation

**Date:** 2026-04-18  
**Status:** Ready for Deployment  
**Data:** Real execution data only - NO sample patterns

---

## Overview

This system learns from **real execution traces** to discover which activities work best in which states. No predefined patterns - everything is learned from actual MiniBob executions.

---

## How It Works

### 1. Before Activity Selection (State Capture)

MiniBob captures the current state:

```typescript
const state = {
  impulse_state: {
    total_impulses: 8,
    loaded_impulses: 3,
    impulse_types: {
      "file": 6,
      "gitDiff": 1,
      "activityExecutionTrace": 1
    },
    impulses: [ /* full impulse details */ ]
  },
  
  activity_history: {
    last_activity_id: "activity:⟨enforce-error-handling-pattern⟩",
    last_activity_name: "Enforce Error Handling Pattern",
    last_success: true,
    minutes_since_last: 22,
    activities_last_hour: ["enforce-error-handling-pattern"],
    activities_last_day: ["autonomous-code-quality-loop", "enforce-error-handling-pattern"]
  },
  
  git_state: {
    branch: "feature/state-aware",
    total_changes: 3,
    has_staged: false,
    has_code_changes: true,
    has_test_changes: false,
    has_activity_changes: false
  },
  
  goal_context: {
    goal_description: "validate specification enforcement",
    goal_type: "validate",
    implied_shapes: ["file", "gitDiff"]
  }
};
```

### 2. Pattern Matching

System checks if this state matches any **learned patterns** from previous executions:

```sql
-- Find patterns matching current state signature
SELECT * FROM discovered_state_pattern
WHERE org_id = $org_id 
  AND enabled = true 
  AND confidence > 0.3
ORDER BY observations DESC;
```

Each pattern has a **state signature** (automatically extracted from real executions):

```json
{
  "pattern_id": "pattern_a3f2e1b9c4d5e6f7",
  "state_signature": {
    "impulse_types_present": ["file", "gitDiff"],
    "last_activity_id": "activity:⟨enforce-error-handling-pattern⟩",
    "has_git_changes": true,
    "minutes_since_last_min": 15,
    "minutes_since_last_max": 60,
    "goal_type": "validate"
  },
  "best_activity_id": "activity:⟨validate-specification-enforcement⟩",
  "observations": 12,
  "successes": 10,
  "failures": 2,
  "success_rate": 0.833,
  "confidence": 0.85
}
```

### 3. Enhanced Thompson Sampling

Activities get a **state bonus** if they match learned patterns:

```typescript
for (const activity of activities) {
  // Base Thompson Sampling
  const thompsonScore = sampleBeta(activity.alpha, activity.beta);
  
  // Calculate state bonus from matched patterns
  let stateBonus = 0;
  for (const pattern of matchedPatterns) {
    if (pattern.best_activity_id === activity.id) {
      stateBonus += 
        pattern.match_score *      // How well state matches (0-1)
        pattern.success_rate *     // Pattern's success rate (0-1)
        pattern.confidence *       // Pattern confidence (0-1)
        0.3;                       // Max 30% boost
    }
  }
  
  const finalScore = thompsonScore + stateBonus;
}
```

### 4. Activity Execution

MiniBob executes the top-scored activity.

### 5. Pattern Learning (After Execution)

When execution completes, the system automatically:

**A. Updates State Snapshot with Outcome**
```sql
UPDATE execution_state_snapshot 
SET outcome_success = true,
    outcome_duration_ms = 45230,
    outcome_cost_usd = 0.12
WHERE execution_id = $execution_id;
```

**B. Discovers/Updates Patterns**
```typescript
// Extract state signature from snapshot
const signature = {
  impulse_types_present: ["file", "gitDiff"],
  last_activity_id: "activity:⟨enforce-error-handling-pattern⟩",
  has_git_changes: true,
  minutes_since_last_min: 15,
  minutes_since_last_max: 60,
  goal_type: "validate"
};

// Hash signature for pattern matching
const hash = sha256(signature);

// Update or create pattern
if (pattern_exists(hash)) {
  UPDATE pattern SET 
    observations = observations + 1,
    successes = successes + (outcome.success ? 1 : 0),
    failures = failures + (outcome.success ? 0 : 1),
    success_rate = successes / observations,
    confidence = min(1.0, log10(observations + 1) / 2);
} else {
  CREATE pattern WITH signature, hash, first observation;
}
```

**C. Updates Activity-State Affinity**
```sql
-- Track how each activity performs in each state
UPDATE activity_state_affinity
SET executions = executions + 1,
    successes = successes + $outcome_success,
    success_rate = successes / executions
WHERE activity_id = $activity_id AND state_hash = $state_hash;
```

**D. Updates Feature Importance**
```sql
-- Track which features predict success
UPDATE state_feature_importance
SET observations = observations + 1,
    success_when_present = success_when_present + $outcome_success,
    correlation_score = success_when_present / observations
WHERE feature_name = 'impulse_type:gitDiff';
```

---

## Database Schema (Real Tables)

### execution_state_snapshot
Captures complete state before every activity selection:
- `execution_id` - Unique execution identifier
- `impulse_state` - All available impulses and their status
- `activity_history` - Recent activity executions
- `git_state` - Working directory changes
- `goal_context` - User's goal and type
- `selected_activity_id` - What was selected
- `outcome_success` - Did it succeed? (filled after execution)

### discovered_state_pattern
Automatically learned patterns (NO manual seeding):
- `pattern_hash` - Hash of state signature
- `state_signature` - Conditions that define this pattern
- `best_activity_id` - Which activity performs best in this state
- `observations` - How many times seen
- `success_rate` - Success rate when using best_activity
- `confidence` - Based on observation count

### activity_state_affinity
Tracks every (activity, state) combination:
- `activity_id` + `state_hash` - Unique pair
- `executions` - Times this activity ran in this state
- `success_rate` - Success rate for this combo
- `alpha`, `beta` - Thompson Sampling priors per state

### state_feature_importance
Learns which features matter:
- `feature_name` - e.g., "impulse_type:gitDiff"
- `correlation_score` - How predictive of success
- `observations` - Data points

---

## API Endpoints (Real Implementation)

### POST /v2/activities/recommend-with-state
Get state-aware recommendations:

**Request:**
```json
{
  "goal": "validate specification enforcement",
  "state": {
    "impulse_state": { /* current impulses */ },
    "activity_history": { /* recent activities */ },
    "git_state": { /* git status */ },
    "goal_context": { /* parsed goal */ }
  },
  "n_recommendations": 3
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "activity_id": "activity:⟨validate-specification-enforcement⟩",
      "activity_name": "Validate Specification Enforcement",
      "thompson_score": 0.68,
      "state_bonus": 0.24,
      "final_score": 0.92,
      "matched_patterns": [
        {
          "pattern_id": "pattern_a3f2e1b9c4d5e6f7",
          "match_score": 0.95,
          "observations": 12,
          "success_rate": 0.833
        }
      ],
      "reasoning": "Matched 1 learned pattern(s) (best match: 95%). Following Enforce Error Handling Pattern. Detected 3 uncommitted changes. State bonus: +24.0%",
      "confidence": 0.87
    }
  ],
  "total_patterns_matched": 3,
  "state_aware": true
}
```

### POST /v2/activities/state-snapshot
Store state before execution.

### POST /v2/activities/state-snapshot/:execution_id/outcome
Update with outcome - **triggers automatic pattern learning**.

### GET /v2/activities/state-patterns
View discovered patterns for observability.

### GET /v2/activities/feature-importance
See which features are most predictive.

---

## Learning Lifecycle

### Cold Start (0 executions)
- No patterns discovered yet
- Pure Thompson Sampling (no state bonus)
- Every execution creates state snapshots

### Warming Up (1-20 executions)
- Patterns begin to emerge
- Low confidence (0.3-0.6)
- Small state bonuses (5-10%)

### Learned (20-100 executions)
- Clear patterns discovered
- Medium confidence (0.6-0.8)
- Moderate state bonuses (10-20%)

### Mature (100+ executions)
- Sophisticated pattern recognition
- High confidence (0.8-1.0)
- Strong state bonuses (20-30%)

---

## Pattern Discovery Algorithm

**Fully automatic - NO manual patterns:**

1. **Extract Signature** from each state snapshot
   - Hash impulse types (sorted)
   - Bucket time ranges (0-15min, 15-60min, etc.)
   - Record git state, last activity, goal type

2. **Hash Signature** for pattern matching
   - SHA-256 of canonical JSON
   - Same state → same hash → same pattern

3. **Update Pattern Statistics**
   - Increment observations
   - Track success/failure
   - Update Thompson Sampling priors
   - Recalculate success rate and confidence

4. **Discover Best Activity**
   - Compare all activities in this state
   - Select one with highest success rate
   - Update if new activity performs better

---

## Integration with MiniBob

MiniBob goal processor automatically uses state-aware selection:

```typescript
// 1. Capture state
const state = await captureCurrentState();

// 2. Get recommendations
const recommendations = await activityApi.recommendWithState({
  goal: userGoal,
  state,
  n_recommendations: 3
});

// 3. Select top recommendation
const selected = recommendations[0];

// 4. Store state snapshot
await activityApi.storeStateSnapshot({
  execution_id: generateId(),
  trace_id: traceId,
  ...state,
  selected_activity_id: selected.activity_id,
  selected_activity_name: selected.activity_name,
  selection_method: 'state_aware',
  thompson_score: selected.thompson_score,
  state_bonus: selected.state_bonus,
  final_score: selected.final_score
});

// 5. Execute activity
const outcome = await executeActivity(selected.activity_id);

// 6. Update with outcome (triggers learning)
await activityApi.updateStateOutcome(executionId, {
  success: outcome.success,
  duration_ms: outcome.duration,
  cost_usd: outcome.cost,
  summary: outcome.summary
});
```

---

## Metrics and Observability

### Dashboard Additions

**Pattern Discovery:**
- Total patterns discovered
- Patterns by confidence level
- New patterns per day
- Pattern coverage (% executions with matches)

**State Bonus Impact:**
- Average state bonus magnitude
- Distribution of state bonuses
- Success rate with vs without state awareness

**Feature Importance:**
- Top 10 predictive features
- Feature correlation scores
- Feature observation counts

**Activity-State Matrix:**
- Heatmap of (activity, state) success rates
- Best activities per state signature
- State diversity (unique states seen)

---

## Migration and Deployment

### 1. Deploy Schema (Migration 065)
```bash
cd repos/metabob-activity-api
./scripts/apply-migration.sh 065
```

### 2. Deploy Code
```bash
# Build and deploy activity-api with new routes
cd repos/deployment
./scripts/build_changed.sh --canary
helmfile -e canary apply
```

### 3. Enable in MiniBob
```bash
# Update MiniBob to use /recommend-with-state endpoint
# Falls back to standard Thompson Sampling if patterns not available
```

### 4. Monitor Learning
```bash
# Watch patterns being discovered
curl https://activity.metabob.com/v2/activities/state-patterns | jq

# Check feature importance
curl https://activity.metabob.com/v2/activities/feature-importance | jq
```

---

## Success Criteria

**Learning Metrics:**
- 10+ patterns discovered within first week
- Pattern confidence >0.5 for top 3 patterns
- 50%+ pattern coverage (executions with matches)

**Performance Metrics:**
- 10-15% improvement in activity success rate
- 20%+ reduction in inappropriate activity selections
- <100ms latency overhead for state capture

**Observability:**
- All state snapshots captured
- All patterns visible in dashboard
- Clear reasoning in recommendation responses

---

## Example: Real Learning Scenario

**Day 1:**
- 5 executions
- 0 patterns (cold start)
- Pure Thompson Sampling

**Day 3:**
- 25 executions
- 4 patterns discovered:
  - Pattern A: `last_activity=enforce` + `git_changes=true` → `validate`
  - Pattern B: `no_recent_activity` + `many_file_impulses` → `quality-loop`
  - Pattern C: `trace_impulse=present` + `last=quality-loop` → `enforce`
  - Pattern D: `goal_type=validate` + `git_changes=true` → `validate`

**Day 7:**
- 80 executions
- 12 patterns discovered
- Pattern A has 15 observations, 87% success rate, 0.78 confidence
- State bonuses: 15-25% for matched patterns
- Success rate improved from 68% to 79%

**Day 30:**
- 350 executions
- 28 patterns discovered
- Top 5 patterns have 0.85+ confidence
- 73% pattern coverage
- Success rate: 84%

---

**Status:** Ready for real-world learning  
**Next:** Deploy schema and monitor pattern discovery
