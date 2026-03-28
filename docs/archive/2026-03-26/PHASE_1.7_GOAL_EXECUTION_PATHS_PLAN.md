# Phase 1.7: Goal Execution Paths - Implementation Plan

**Status:** Planning  
**Depends On:** Phase 1.6 (Execution Sequences) ✅  
**Enables:** Path-level Thompson Sampling, Goal-based recommendations

---

## Overview

Phase 1.7 aggregates activity execution sequences into **goal-based paths** and implements **Thompson Sampling over paths** instead of individual activities.

### Key Concept

Instead of recommending single activities:
```
"For your task, use activity A (80% success rate)"
```

We recommend **proven sequences**:
```
"For goal 'add REST endpoint', execute path:
  1. create-feature-scaffold (90% success)
  2. add-tests (85% success)  
  3. commit-changes (95% success)
Overall path success: 73%"
```

---

## Architecture

### Data Flow

```
User Request → Goal Parser → Path Recommender → Activity Executor
                                    ↓
                          Goal Execution Paths Table
                          (aggregated sequences)
                                    ↓
                          Thompson Sampling Engine
                          (exploration vs exploitation)
```

### What We're Building

1. **Goal Extraction**: Parse user intent into goal strings
2. **Path Recording**: Aggregate sequences by goal
3. **Path Scoring**: Thompson Sampling over paths (not just activities)
4. **Path Recommendation**: Return best path for goal

---

## Implementation Tasks

### Task 1: Database Schema (Backend)

**File:** `repos/metabob-activity-api/sql/003-goal-execution-paths.surql`

**Table:** `goal_execution_paths`

```sql
DEFINE TABLE goal_execution_paths SCHEMAFULL;

-- Goal identification
DEFINE FIELD goal_hash TYPE string;           -- Hash of normalized goal
DEFINE FIELD goal_text TYPE string;           -- Original goal text
DEFINE FIELD goal_category TYPE string;       -- feature/bugfix/refactor/etc

-- Path definition
DEFINE FIELD path_activities TYPE array<string>;  -- ["act1", "act2", "act3"]
DEFINE FIELD path_signature TYPE string;          -- Hash of path_activities

-- Thompson Sampling parameters
DEFINE FIELD total_executions TYPE int;
DEFINE FIELD successful_executions TYPE int;
DEFINE FIELD failed_executions TYPE int;
DEFINE FIELD thompson_alpha TYPE float;        -- successes + 1
DEFINE FIELD thompson_beta TYPE float;         -- failures + 1
DEFINE FIELD success_rate TYPE float;          -- successful / total

-- Performance metrics
DEFINE FIELD avg_duration_ms TYPE float;
DEFINE FIELD avg_cost_usd TYPE float;
DEFINE FIELD avg_token_usage TYPE int;

-- Context
DEFINE FIELD typical_files_modified TYPE array<string>;
DEFINE FIELD typical_tools_used TYPE array<string>;

-- Timestamps
DEFINE FIELD last_executed_at TYPE datetime;
DEFINE FIELD created_at TYPE datetime;
DEFINE FIELD updated_at TYPE datetime;

-- Indexes
DEFINE INDEX idx_goal_paths_hash ON goal_execution_paths FIELDS goal_hash;
DEFINE INDEX idx_goal_paths_category ON goal_execution_paths FIELDS goal_category;
DEFINE INDEX idx_goal_paths_signature ON goal_execution_paths FIELDS goal_hash, path_signature;
DEFINE INDEX idx_goal_paths_success_rate ON goal_execution_paths FIELDS success_rate;
```

### Task 2: Backend Schemas (TypeScript)

**File:** `repos/metabob-activity-api/src/models/schemas.ts`

Add schemas:

```typescript
// Goal Execution Path schemas
export const GoalExecutionPathSchema = z.object({
  goal_hash: z.string(),
  goal_text: z.string(),
  goal_category: z.enum(['feature', 'bugfix', 'refactor', 'tool', 'infrastructure']),
  
  // Path definition
  path_activities: z.array(z.string()),
  path_signature: z.string(),
  
  // Thompson Sampling
  total_executions: z.number().int().default(0),
  successful_executions: z.number().int().default(0),
  failed_executions: z.number().int().default(0),
  thompson_alpha: z.number().default(1.0),
  thompson_beta: z.number().default(1.0),
  success_rate: z.number().min(0).max(1),
  
  // Performance
  avg_duration_ms: z.number().default(0),
  avg_cost_usd: z.number().default(0),
  avg_token_usage: z.number().int().default(0),
  
  // Context
  typical_files_modified: z.array(z.string()).optional(),
  typical_tools_used: z.array(z.string()).optional(),
  
  // Timestamps
  last_executed_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PathRecordRequestSchema = z.object({
  goal_text: z.string(),
  goal_category: z.enum(['feature', 'bugfix', 'refactor', 'tool', 'infrastructure']),
  path_activities: z.array(z.string()).min(1),
  success: z.boolean(),
  duration_ms: z.number().int(),
  cost_usd: z.number(),
  token_usage: z.number().int().optional(),
  files_modified: z.array(z.string()).optional(),
  tools_used: z.array(z.string()).optional(),
});

export const PathRecommendationRequestSchema = z.object({
  goal_text: z.string(),
  goal_category: z.enum(['feature', 'bugfix', 'refactor', 'tool', 'infrastructure']).optional(),
  exploration_rate: z.number().min(0).max(1).default(0.1), // 10% exploration
  top_k: z.number().int().positive().default(3),
});

export const PathRecommendationResponseSchema = z.object({
  goal_hash: z.string(),
  recommended_paths: z.array(z.object({
    path_activities: z.array(z.string()),
    confidence: z.number().min(0).max(1), // Thompson sample score
    success_rate: z.number().min(0).max(1),
    avg_duration_ms: z.number(),
    avg_cost_usd: z.number(),
    total_executions: z.number().int(),
    exploration_bonus: z.number().optional(), // If recommended for exploration
  })),
});

// Type exports
export type GoalExecutionPath = z.infer<typeof GoalExecutionPathSchema>;
export type PathRecordRequest = z.infer<typeof PathRecordRequestSchema>;
export type PathRecommendationRequest = z.infer<typeof PathRecommendationRequestSchema>;
export type PathRecommendationResponse = z.infer<typeof PathRecommendationResponseSchema>;
```

### Task 3: Backend Endpoints

**File:** `repos/metabob-activity-api/src/routes/activities.ts`

#### Endpoint 1: POST /v2/activities/goal-paths

Records execution of a goal-based path.

**Logic:**
1. Normalize goal text (lowercase, trim, remove punctuation)
2. Hash goal → `goal_hash`
3. Hash path_activities → `path_signature`
4. Check if path exists for this goal
5. If exists: update Thompson parameters
6. If new: create with initial Thompson priors

**Aggregation Update:**
```typescript
// Update Thompson Sampling parameters
const newTotalExecutions = (current.total_executions || 0) + 1;
const newSuccessful = (current.successful_executions || 0) + (success ? 1 : 0);
const newFailed = (current.failed_executions || 0) + (success ? 0 : 1);

const thompsonAlpha = newSuccessful + 1;  // Beta prior with α=1
const thompsonBeta = newFailed + 1;       // Beta prior with β=1
const successRate = newSuccessful / newTotalExecutions;

// Update rolling averages
const avgDuration = (current.avg_duration_ms * current.total_executions + duration_ms) / newTotalExecutions;
const avgCost = (current.avg_cost_usd * current.total_executions + cost_usd) / newTotalExecutions;
```

#### Endpoint 2: GET /v2/activities/goal-paths

Query paths for a specific goal.

**Query params:**
- `goal_text` (required)
- `limit` (default: 10)
- `min_executions` (default: 1)

**Returns:** All paths for the goal, sorted by Thompson alpha/(alpha+beta)

#### Endpoint 3: POST /v2/activities/goal-paths/recommend

Thompson Sampling recommendation for a goal.

**Algorithm:**
```typescript
function recommendPath(goal: string, explorationRate: number, topK: number) {
  // 1. Get all paths for this goal
  const paths = await getPathsForGoal(goal);
  
  // 2. Decide: exploration vs exploitation
  const shouldExplore = Math.random() < explorationRate;
  
  if (shouldExplore) {
    // Pick path with LOWEST total_executions (UCB-style)
    paths.sort((a, b) => a.total_executions - b.total_executions);
    return paths.slice(0, topK).map(p => ({
      ...p,
      confidence: 0.5, // Neutral confidence
      exploration_bonus: 1.0 / (p.total_executions + 1),
    }));
  } else {
    // Exploit: sample from Beta distribution
    const samples = paths.map(path => ({
      path,
      sample: sampleBeta(path.thompson_alpha, path.thompson_beta),
    }));
    
    samples.sort((a, b) => b.sample - a.sample);
    
    return samples.slice(0, topK).map(s => ({
      ...s.path,
      confidence: s.sample,
    }));
  }
}
```

#### Endpoint 4: GET /v2/activities/goal-paths/stats

Global statistics on goal paths.

**Returns:**
```json
{
  "total_goals": 45,
  "total_paths": 123,
  "avg_paths_per_goal": 2.7,
  "most_common_goals": [
    {"goal_hash": "...", "goal_text": "add REST endpoint", "path_count": 8},
    {"goal_hash": "...", "goal_text": "fix authentication bug", "path_count": 5}
  ],
  "best_performing_paths": [
    {
      "goal_text": "add REST endpoint",
      "path_activities": ["scaffold-endpoint", "add-tests", "commit"],
      "success_rate": 0.95,
      "executions": 20
    }
  ]
}
```

### Task 4: Minibob Integration

**File:** `repos/minibob/src/activity.ts`

Update activity executor to:

1. **Extract goal from user prompt** (before execution)
2. **Query path recommendations** (via MCP)
3. **Record goal path** (after execution)

```typescript
// Before execution: get recommendation
async function getRecommendedPath(goal: string): Promise<PathRecommendation | null> {
  try {
    const response = await mcp.recommendGoalPath({
      goal_text: goal,
      exploration_rate: 0.1,
      top_k: 3,
    });
    
    return response.recommended_paths[0]; // Best path
  } catch (error) {
    logger.warn('Failed to get path recommendation', { error });
    return null;
  }
}

// After execution: record path
async function recordGoalPath(
  goal: string,
  activities: string[],
  success: boolean,
  metrics: ExecutionMetrics
): Promise<void> {
  try {
    await mcp.recordGoalPath({
      goal_text: goal,
      goal_category: inferCategory(goal),
      path_activities: activities,
      success,
      duration_ms: metrics.duration,
      cost_usd: metrics.cost,
      token_usage: metrics.tokens,
      files_modified: metrics.filesModified,
      tools_used: metrics.toolsUsed,
    });
  } catch (error) {
    logger.error('Failed to record goal path', { error });
  }
}
```

**File:** `repos/minibob/src/mcp.ts`

Add MCP methods:

```typescript
async recommendGoalPath(request: PathRecommendationRequest): Promise<PathRecommendationResponse> {
  const response = await fetch(`${this.endpoint}/v2/activities/goal-paths/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`Path recommendation failed: ${response.statusText}`);
  }
  
  return response.json();
}

async recordGoalPath(request: PathRecordRequest): Promise<void> {
  const response = await fetch(`${this.endpoint}/v2/activities/goal-paths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`Path recording failed: ${response.statusText}`);
  }
}
```

### Task 5: Integration Tests

**File:** `test-goal-paths-integration.ts`

Test scenarios:

1. **Record first path execution**
   - POST goal path
   - Verify created with initial Thompson priors (α=2, β=1 for success)

2. **Record multiple executions of same path**
   - POST same path 5 times (3 success, 2 fail)
   - Verify Thompson parameters: α=4, β=3
   - Verify success_rate = 0.6

3. **Record different paths for same goal**
   - POST 3 different paths for goal "add endpoint"
   - Verify all stored separately

4. **Get path recommendation**
   - POST recommend for goal
   - Verify returns top 3 paths sorted by Thompson sample

5. **Exploration mode**
   - POST recommend with exploration_rate=1.0
   - Verify returns least-executed path

---

## Implementation Order

### Step 1: Database (10 min)
- [ ] Create `003-goal-execution-paths.surql`
- [ ] Apply migration to SurrealDB
- [ ] Verify table created

### Step 2: Backend Schemas (15 min)
- [ ] Add 4 new Zod schemas to `schemas.ts`
- [ ] Export types

### Step 3: Backend Endpoints (60 min)
- [ ] POST /v2/activities/goal-paths (record)
- [ ] GET /v2/activities/goal-paths (query)
- [ ] POST /v2/activities/goal-paths/recommend (Thompson Sampling)
- [ ] GET /v2/activities/goal-paths/stats (analytics)

### Step 4: Minibob Integration (30 min)
- [ ] Add MCP methods to `mcp.ts`
- [ ] Update activity executor to extract goal
- [ ] Call recommend before execution (optional)
- [ ] Call record after execution

### Step 5: Testing (20 min)
- [ ] Write integration tests
- [ ] Run tests locally
- [ ] Verify all 5 scenarios pass

### Step 6: Deployment (10 min)
- [ ] Build Docker image
- [ ] Apply database migration
- [ ] Restart deployment
- [ ] Run tests against api.minibob.local

**Total Estimated Time:** ~2.5 hours

---

## Success Criteria

✅ 1 new database table created  
✅ 4 new backend endpoints working  
✅ Thompson Sampling algorithm implemented  
✅ Minibob integration complete  
✅ 5/5 integration tests passing  
✅ Exploration vs exploitation working  

---

## Example Usage

### Recording a Path
```bash
curl -X POST http://api.minibob.local/v2/activities/goal-paths \
  -H "Content-Type: application/json" \
  -d '{
    "goal_text": "Add REST endpoint for user profiles",
    "goal_category": "feature",
    "path_activities": [
      "scaffold-endpoint",
      "add-validation", 
      "add-tests",
      "commit-changes"
    ],
    "success": true,
    "duration_ms": 45000,
    "cost_usd": 0.12,
    "files_modified": ["src/api/users.ts", "tests/api/users.test.ts"]
  }'
```

### Getting Recommendation
```bash
curl -X POST http://api.minibob.local/v2/activities/goal-paths/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "goal_text": "Add REST endpoint for user profiles",
    "exploration_rate": 0.1,
    "top_k": 3
  }'
```

**Response:**
```json
{
  "goal_hash": "add_rest_endpoint_user_profiles",
  "recommended_paths": [
    {
      "path_activities": ["scaffold-endpoint", "add-validation", "add-tests", "commit-changes"],
      "confidence": 0.87,
      "success_rate": 0.85,
      "avg_duration_ms": 42000,
      "avg_cost_usd": 0.11,
      "total_executions": 15
    },
    {
      "path_activities": ["create-feature-complete"],
      "confidence": 0.72,
      "success_rate": 0.70,
      "avg_duration_ms": 38000,
      "avg_cost_usd": 0.09,
      "total_executions": 10
    }
  ]
}
```

---

## Next Phase Preview

**Phase 1.8: Impulse Relevance Integration**
- Minibob queries impulse relevance metrics before loading
- Only loads impulses with relevance_score > threshold
- Reduces token usage by 30-50%

---

Let's start with **Step 1: Database Schema**!
