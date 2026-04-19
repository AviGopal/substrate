# State-Aware Activity Selection System

**Design Document**
**Date:** 2026-04-18
**Status:** Proposed Implementation

---

## Motivation

Current Thompson Sampling selects activities based solely on historical success rates (α/β priors). This doesn't consider:
- **When** to use which activity
- **What state** makes an activity appropriate
- **What impulses** are available for the activity to use
- **What activities** were recently executed

We need MiniBob to learn **contextual patterns** like:
- "After running enforcement, validate the changes"
- "When git shows uncommitted changes, run validation"
- "When no recent activity history, start with comprehensive loop"
- "When specific error trace available, run targeted fix"

---

## State Space Components

### 1. Impulse State Space

Track what impulses are available at recommendation time:

```typescript
interface ImpulseStateSpace {
  timestamp: Date
  available_impulses: Array<{
    id: string
    type: string  // file, gitDiff, activityExecutionTrace, etc.
    loaded: boolean
    budget: number
    budget_used: number
    priority: 'high' | 'medium' | 'low'
    metadata_summary: string  // Brief summary of content
  }>

  // Aggregated metrics
  total_impulses: number
  loaded_impulses: number
  total_budget: number
  budget_consumed: number

  // Type distribution
  impulse_types: Record<string, number>  // type -> count
}
```

### 2. Recent Activity History

Track recent executions for pattern detection:

```typescript
interface RecentActivityHistory {
  last_n_executions: Array<{
    activity_id: string
    activity_name: string
    timestamp: Date
    success: boolean
    duration_ms: number
    cost_usd: number
    outcome_summary: string
  }>

  // Pattern detection
  last_activity: string | null
  last_success: boolean | null
  minutes_since_last: number | null
  activities_in_last_hour: string[]
  activities_in_last_day: string[]
}
```

### 3. Changes In Flight

Track uncommitted changes and working directory state:

```typescript
interface ChangesInFlight {
  git_status: {
    branch: string
    modified_files: string[]
    added_files: string[]
    deleted_files: string[]
    untracked_files: string[]
    staged_changes: boolean
    total_changes: number
  }

  working_directory: string

  // Change patterns
  has_code_changes: boolean
  has_test_changes: boolean
  has_config_changes: boolean
  has_activity_changes: boolean
}
```

### 4. Goal Context

User's stated goal and implied requirements:

```typescript
interface GoalContext {
  goal_description: string
  implied_shapes: string[]  // From goal analysis
  required_capabilities: string[]
  goal_type: 'fix' | 'improve' | 'create' | 'analyze' | 'validate'
}
```

---

## Learning Patterns

### Pattern Recognition

The system learns correlations between state patterns and activity outcomes:

```typescript
interface StateActivityPattern {
  pattern_id: string
  pattern_name: string

  // State conditions
  state_conditions: {
    impulse_types_present?: string[]  // e.g., ["gitDiff", "file"]
    recent_activity?: string  // e.g., "enforce-error-handling-pattern"
    git_changes?: boolean
    time_since_last_activity?: {
      min_minutes?: number
      max_minutes?: number
    }
  }

  // Recommended activity
  recommended_activity: string

  // Learning metrics
  times_observed: number
  times_recommended: number
  success_rate: number
  avg_duration_ms: number
  avg_cost_usd: number

  // Thompson Sampling per pattern
  alpha: number  // Successes when this pattern matched
  beta: number   // Failures when this pattern matched
}
```

### Example Patterns

**Pattern 1: Post-Enforcement Validation**
```json
{
  "pattern_id": "post_enforcement_validation",
  "pattern_name": "Validate After Enforcement",
  "state_conditions": {
    "recent_activity": "enforce-error-handling-pattern",
    "git_changes": true,
    "time_since_last_activity": {
      "max_minutes": 60
    }
  },
  "recommended_activity": "validate-specification-enforcement",
  "alpha": 12,
  "beta": 2
}
```

**Pattern 2: Fresh Start Comprehensive Analysis**
```json
{
  "pattern_id": "fresh_start_comprehensive",
  "pattern_name": "Fresh Start → Quality Loop",
  "state_conditions": {
    "impulse_types_present": ["file"],
    "git_changes": false,
    "time_since_last_activity": {
      "min_minutes": 240
    }
  },
  "recommended_activity": "autonomous-code-quality-loop",
  "alpha": 8,
  "beta": 1
}
```

**Pattern 3: Iterative Improvement**
```json
{
  "pattern_id": "iterative_improvement",
  "pattern_name": "Iterate Quality Loop",
  "state_conditions": {
    "recent_activity": "autonomous-code-quality-loop",
    "git_changes": true,
    "impulse_types_present": ["activityExecutionTrace"]
  },
  "recommended_activity": "autonomous-code-quality-loop",
  "alpha": 15,
  "beta": 3
}
```

**Pattern 4: Specific Issue Fix**
```json
{
  "pattern_id": "specific_issue_fix",
  "pattern_name": "Targeted Error Handling Fix",
  "state_conditions": {
    "impulse_types_present": ["activityExecutionTrace"],
    "recent_activity": "autonomous-code-quality-loop"
  },
  "recommended_activity": "enforce-error-handling-pattern",
  "alpha": 10,
  "beta": 2
}
```

---

## Implementation Architecture

### Phase 1: Backend Schema (SurrealDB)

```sql
-- State-aware pattern tracking
DEFINE TABLE state_activity_pattern SCHEMAFULL;

DEFINE FIELD pattern_id ON state_activity_pattern TYPE string;
DEFINE FIELD pattern_name ON state_activity_pattern TYPE string;
DEFINE FIELD state_conditions ON state_activity_pattern TYPE object;
DEFINE FIELD recommended_activity ON state_activity_pattern TYPE string;
DEFINE FIELD times_observed ON state_activity_pattern TYPE int DEFAULT 0;
DEFINE FIELD times_recommended ON state_activity_pattern TYPE int DEFAULT 0;
DEFINE FIELD success_count ON state_activity_pattern TYPE int DEFAULT 0;
DEFINE FIELD failure_count ON state_activity_pattern TYPE int DEFAULT 0;
DEFINE FIELD alpha ON state_activity_pattern TYPE float DEFAULT 1.0;
DEFINE FIELD beta ON state_activity_pattern TYPE float DEFAULT 1.0;
DEFINE FIELD created_at ON state_activity_pattern TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON state_activity_pattern TYPE datetime DEFAULT time::now();

-- Index for pattern lookup
DEFINE INDEX pattern_id_idx ON state_activity_pattern COLUMNS pattern_id UNIQUE;

-- Execution state snapshots (capture state at recommendation time)
DEFINE TABLE execution_state_snapshot SCHEMAFULL;

DEFINE FIELD execution_id ON execution_state_snapshot TYPE string;
DEFINE FIELD timestamp ON execution_state_snapshot TYPE datetime DEFAULT time::now();
DEFINE FIELD impulse_state_space ON execution_state_snapshot TYPE object;
DEFINE FIELD recent_activity_history ON execution_state_snapshot TYPE object;
DEFINE FIELD changes_in_flight ON execution_state_snapshot TYPE object;
DEFINE FIELD goal_context ON execution_state_snapshot TYPE object;
DEFINE FIELD matched_patterns ON execution_state_snapshot TYPE array<string>;
DEFINE FIELD selected_activity ON execution_state_snapshot TYPE string;
DEFINE FIELD selection_reason ON execution_state_snapshot TYPE string;

-- Link to execution trace
DEFINE FIELD trace_id ON execution_state_snapshot TYPE string;
```

### Phase 2: Activity API Endpoints

**POST /v2/activities/state-snapshot**
Capture state before activity selection:

```typescript
{
  impulse_state_space: ImpulseStateSpace,
  recent_activity_history: RecentActivityHistory,
  changes_in_flight: ChangesInFlight,
  goal_context: GoalContext
}
```

**GET /v2/activities/state-patterns**
Retrieve learned patterns:

```typescript
{
  patterns: StateActivityPattern[],
  total_patterns: number
}
```

**POST /v2/activities/recommend-with-state**
Enhanced Thompson Sampling with state awareness:

```typescript
Request:
{
  goal: string,
  state: {
    impulse_state_space: ImpulseStateSpace,
    recent_history: RecentActivityHistory,
    changes_in_flight: ChangesInFlight
  },
  n_recommendations: number
}

Response:
{
  recommendations: Array<{
    activity_id: string,
    activity_name: string,
    score: number,
    matched_patterns: string[],
    reasoning: string,
    thompson_score: number,
    state_bonus: number  // Boost from matching patterns
  }>
}
```

### Phase 3: MiniBob Goal Processor Enhancement

Update `goal-processor.ts` to capture and use state:

```typescript
async function analyzeGoalWithState(goal: string) {
  // 1. Capture impulse state space
  const impulseState = await captureImpulseStateSpace();

  // 2. Get recent activity history
  const recentHistory = await getRecentActivityHistory(limit: 10);

  // 3. Check git status for changes in flight
  const changesInFlight = await getChangesInFlight();

  // 4. Analyze goal for context
  const goalContext = await analyzeGoalContext(goal);

  // 5. Create state snapshot
  const snapshot = {
    impulse_state_space: impulseState,
    recent_activity_history: recentHistory,
    changes_in_flight: changesInFlight,
    goal_context: goalContext,
    timestamp: new Date()
  };

  // 6. Get state-aware recommendations
  const recommendations = await activityApiClient.recommendWithState({
    goal,
    state: snapshot,
    n_recommendations: 5
  });

  // 7. Store snapshot for learning
  await activityApiClient.storeStateSnapshot({
    ...snapshot,
    matched_patterns: recommendations[0].matched_patterns,
    selected_activity: recommendations[0].activity_id,
    selection_reason: recommendations[0].reasoning
  });

  return recommendations;
}
```

### Phase 4: Pattern Learning Loop

After each execution, update pattern statistics:

```typescript
async function updateStatePatterns(
  executionId: string,
  success: boolean
) {
  // 1. Get state snapshot for this execution
  const snapshot = await getStateSnapshot(executionId);

  // 2. Get matched patterns
  const matchedPatterns = snapshot.matched_patterns;

  // 3. Update each pattern's statistics
  for (const patternId of matchedPatterns) {
    const pattern = await getPattern(patternId);

    // Update counts
    pattern.times_observed++;
    if (pattern.recommended_activity === snapshot.selected_activity) {
      pattern.times_recommended++;

      // Update Thompson Sampling priors
      if (success) {
        pattern.alpha += 1;
        pattern.success_count += 1;
      } else {
        pattern.beta += 1;
        pattern.failure_count += 1;
      }
    }

    await updatePattern(pattern);
  }

  // 4. Discover new patterns if needed
  await discoverNewPatterns(snapshot, success);
}
```

---

## State Capture Implementation

### Impulse State Space Capture

```typescript
async function captureImpulseStateSpace(): Promise<ImpulseStateSpace> {
  const impulses = memoryAgent.getAllImpulses();

  const typeCount: Record<string, number> = {};
  let totalBudget = 0;
  let budgetConsumed = 0;
  let loadedCount = 0;

  const impulseDetails = impulses.map(imp => {
    typeCount[imp.pointer.type] = (typeCount[imp.pointer.type] || 0) + 1;
    totalBudget += imp.budget || 0;
    budgetConsumed += imp.resources_consumed || 0;
    if (imp.loaded) loadedCount++;

    return {
      id: imp.id,
      type: imp.pointer.type,
      loaded: imp.loaded,
      budget: imp.budget || 0,
      budget_used: imp.resources_consumed || 0,
      priority: imp.priority || 'medium',
      metadata_summary: imp.metadata?.description || imp.pointer.type
    };
  });

  return {
    timestamp: new Date(),
    available_impulses: impulseDetails,
    total_impulses: impulses.length,
    loaded_impulses: loadedCount,
    total_budget: totalBudget,
    budget_consumed: budgetConsumed,
    impulse_types: typeCount
  };
}
```

### Recent Activity History

```typescript
async function getRecentActivityHistory(
  limit: number = 10
): Promise<RecentActivityHistory> {
  const executions = await activityApiClient.getRecentExecutions({
    limit,
    include_outcome: true
  });

  const lastExecution = executions[0];
  const now = new Date();

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return {
    last_n_executions: executions.map(ex => ({
      activity_id: ex.activity_id,
      activity_name: ex.activity_name,
      timestamp: new Date(ex.timestamp),
      success: ex.success,
      duration_ms: ex.duration_ms,
      cost_usd: ex.cost_usd,
      outcome_summary: ex.outcome?.summary || ''
    })),
    last_activity: lastExecution?.activity_id || null,
    last_success: lastExecution?.success || null,
    minutes_since_last: lastExecution
      ? Math.floor((now.getTime() - new Date(lastExecution.timestamp).getTime()) / 60000)
      : null,
    activities_in_last_hour: executions
      .filter(ex => new Date(ex.timestamp) > oneHourAgo)
      .map(ex => ex.activity_id),
    activities_in_last_day: executions
      .filter(ex => new Date(ex.timestamp) > oneDayAgo)
      .map(ex => ex.activity_id)
  };
}
```

### Changes In Flight

```typescript
async function getChangesInFlight(): Promise<ChangesInFlight> {
  const gitStatus = await execTool('bash', {
    command: 'git status --porcelain && git branch --show-current'
  });

  const lines = gitStatus.stdout.split('\n');
  const branch = lines[lines.length - 1];

  const modified: string[] = [];
  const added: string[] = [];
  const deleted: string[] = [];
  const untracked: string[] = [];
  let hasStaged = false;

  for (const line of lines.slice(0, -1)) {
    if (!line) continue;

    const status = line.substring(0, 2);
    const file = line.substring(3);

    if (status[0] !== ' ') hasStaged = true;

    if (status.includes('M')) modified.push(file);
    if (status.includes('A')) added.push(file);
    if (status.includes('D')) deleted.push(file);
    if (status.includes('?')) untracked.push(file);
  }

  const allFiles = [...modified, ...added, ...deleted, ...untracked];

  return {
    git_status: {
      branch,
      modified_files: modified,
      added_files: added,
      deleted_files: deleted,
      untracked_files: untracked,
      staged_changes: hasStaged,
      total_changes: allFiles.length
    },
    working_directory: process.cwd(),
    has_code_changes: allFiles.some(f => /\.(ts|js|tsx|jsx)$/.test(f)),
    has_test_changes: allFiles.some(f => /\.(test|spec)\.(ts|js)$/.test(f)),
    has_config_changes: allFiles.some(f => /\.(json|yaml|yml)$/.test(f)),
    has_activity_changes: allFiles.some(f => f.includes('activities/'))
  };
}
```

---

## Pattern Matching Algorithm

```typescript
function matchStatePatterns(
  state: {
    impulseState: ImpulseStateSpace,
    recentHistory: RecentActivityHistory,
    changesInFlight: ChangesInFlight
  },
  patterns: StateActivityPattern[]
): Array<{ pattern: StateActivityPattern, match_score: number }> {

  const matches: Array<{ pattern: StateActivityPattern, match_score: number }> = [];

  for (const pattern of patterns) {
    let score = 0;
    let totalConditions = 0;

    const conditions = pattern.state_conditions;

    // Check impulse types present
    if (conditions.impulse_types_present) {
      totalConditions++;
      const presentTypes = Object.keys(state.impulseState.impulse_types);
      const requiredTypes = conditions.impulse_types_present;
      const matchCount = requiredTypes.filter(t => presentTypes.includes(t)).length;
      score += matchCount / requiredTypes.length;
    }

    // Check recent activity
    if (conditions.recent_activity) {
      totalConditions++;
      if (state.recentHistory.last_activity === conditions.recent_activity) {
        score += 1;
      }
    }

    // Check git changes
    if (conditions.git_changes !== undefined) {
      totalConditions++;
      const hasChanges = state.changesInFlight.git_status.total_changes > 0;
      if (hasChanges === conditions.git_changes) {
        score += 1;
      }
    }

    // Check time since last activity
    if (conditions.time_since_last_activity) {
      totalConditions++;
      const minutes = state.recentHistory.minutes_since_last || Infinity;
      const { min_minutes, max_minutes } = conditions.time_since_last_activity;

      if (
        (min_minutes === undefined || minutes >= min_minutes) &&
        (max_minutes === undefined || minutes <= max_minutes)
      ) {
        score += 1;
      }
    }

    // Calculate match percentage
    const matchScore = totalConditions > 0 ? score / totalConditions : 0;

    if (matchScore > 0) {
      matches.push({ pattern, match_score: matchScore });
    }
  }

  // Sort by match score descending
  return matches.sort((a, b) => b.match_score - a.match_score);
}
```

---

## Enhanced Thompson Sampling

```typescript
async function recommendWithState(
  goal: string,
  state: CapturedState,
  nRecommendations: number = 3
): Promise<Recommendation[]> {

  // 1. Get all applicable patterns
  const patterns = await getAllStatePatterns();

  // 2. Match patterns to current state
  const matchedPatterns = matchStatePatterns(state, patterns);

  // 3. Get base Thompson Sampling scores
  const activities = await getAllActivities();
  const thompsonScores = activities.map(activity => ({
    activity,
    score: sampleBeta(activity.alpha, activity.beta)
  }));

  // 4. Boost scores for pattern-matched activities
  const boostedScores = thompsonScores.map(({ activity, score }) => {
    let stateBonus = 0;
    const matchedPatternIds: string[] = [];

    for (const { pattern, match_score } of matchedPatterns) {
      if (pattern.recommended_activity === activity.id) {
        // Boost proportional to pattern match strength and pattern success rate
        const patternSuccessRate = pattern.alpha / (pattern.alpha + pattern.beta);
        stateBonus += match_score * patternSuccessRate * 0.5; // Max 50% boost
        matchedPatternIds.push(pattern.pattern_id);
      }
    }

    return {
      activity_id: activity.id,
      activity_name: activity.name,
      thompson_score: score,
      state_bonus: stateBonus,
      final_score: score + stateBonus,
      matched_patterns: matchedPatternIds,
      reasoning: generateReasoning(activity, matchedPatternIds, match_score)
    };
  });

  // 5. Sort by final score and return top N
  return boostedScores
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, nRecommendations);
}
```

---

## Usage Example

### Before (Simple Thompson Sampling)

```bash
minibob --single "improve code quality"

# Thompson Sampling selects activity based only on α/β
# No consideration of current state
```

### After (State-Aware Selection)

```bash
minibob --single "improve code quality"

# System captures:
# - Impulse state: [file impulses x6, gitDiff x1, activityTrace x0]
# - Recent history: [enforce-error-handling-pattern 15min ago, SUCCESS]
# - Git changes: 3 modified files (src/calculator.ts, etc.)
# - Goal: "improve code quality" → type: improve

# Pattern matching:
# ✓ Pattern "post_enforcement_validation" matches (score: 0.85)
#   - Recent activity: enforce-error-handling-pattern ✓
#   - Git changes: true ✓
#   - Time since last: 15min ✓

# Recommendation:
# 1. validate-specification-enforcement (score: 0.82)
#    - Thompson: 0.65
#    - State bonus: +0.17 (from pattern match)
#    - Reason: "Validation recommended after recent enforcement with changes"
#
# 2. autonomous-code-quality-loop (score: 0.71)
#    - Thompson: 0.71
#    - State bonus: 0
#    - Reason: "Comprehensive analysis suitable for general improvement"

# Selected: validate-specification-enforcement
```

---

## Metrics and Observability

### Dashboard Additions

**State Pattern Performance:**
- Pattern match rate over time
- Pattern success rates
- State bonus impact on selection
- Pattern evolution (new patterns discovered)

**State-Aware Selection Metrics:**
- Recommendation accuracy with vs without state
- Average state bonus magnitude
- Pattern coverage (% executions with matched patterns)
- State feature importance (which features drive selection)

---

## Migration Path

### Stage 1: Data Collection (Week 1)
- Deploy schema changes
- Capture state snapshots for all executions
- No changes to selection yet
- Build initial pattern dataset

### Stage 2: Pattern Discovery (Week 2)
- Analyze collected state snapshots
- Identify common state→activity patterns
- Seed initial pattern definitions
- Deploy pattern matching (read-only)

### Stage 3: Hybrid Selection (Week 3)
- Enable state-aware Thompson Sampling
- Start with small state bonus (10% max)
- Monitor impact on success rates
- Collect pattern match feedback

### Stage 4: Full Deployment (Week 4)
- Increase state bonus to 50% max
- Enable automatic pattern discovery
- Deploy to all MiniBob instances
- Full observability dashboard

---

## Success Criteria

**Quantitative:**
- 15%+ improvement in activity success rate
- 20%+ reduction in unnecessary activity executions
- 80%+ pattern coverage (executions with matched patterns)
- <100ms latency overhead for state capture

**Qualitative:**
- Activities selected feel "contextually appropriate"
- Fewer manual activity selections needed
- Better activity sequencing (enforcement → validation)
- Clearer reasoning in activity recommendations

---

## Next Steps

1. **Schema Design Review**
   - Review SurrealDB schema additions
   - Validate data model with team

2. **Proof of Concept**
   - Implement state capture in MiniBob
   - Mock pattern matching locally
   - Test with 3-5 manual patterns

3. **Backend Implementation**
   - Deploy schema changes
   - Implement /v2/activities/recommend-with-state endpoint
   - Add pattern management endpoints

4. **MiniBob Integration**
   - Update goal processor
   - Add state capture hooks
   - Implement pattern-aware selection

5. **Dashboard Visualization**
   - Add state pattern metrics
   - Show recommendation reasoning
   - Pattern performance tracking

---

**Document Status:** Design Complete - Ready for Implementation
**Owner:** MiniBob Autonomous Development Team
**Priority:** High (Core Learning Loop Enhancement)
