# Learned Corpus Dashboard - Technical Design

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LEARNED CORPUS DASHBOARD                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend (activity-dashboard)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LearnedCorpus.tsx                                                   │   │
│  │  ├── CorpusStats.tsx (5 metric cards)                               │   │
│  │  ├── ActivityBeliefs.tsx (Thompson Sampling table)                   │   │
│  │  └── ImprovisationCandidates.tsx (pattern detection)                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  useCorpus.ts hook                                                   │   │
│  │  ├── api.listActivityScores()                                        │   │
│  │  └── api.getCorpusSummary()                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backend (metabob-activity-api)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  GET /v2/activities/scores                                           │   │
│  │  GET /v2/activities/corpus-summary                                   │   │
│  │  ├── Uses existing getActivityScores() from paradigm.ts              │   │
│  │  └── Queries v_activity_score computed view                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Database (SurrealDB)                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  v_activity_score (computed view)                                    │   │
│  │  SELECT                                                              │   │
│  │    activity_id, org_id,                                              │   │
│  │    count() AS total_executions,                                      │   │
│  │    count(IF success = true THEN 1 ELSE NONE END) + 1 AS alpha,      │   │
│  │    count(IF success = false THEN 1 ELSE NONE END) + 1 AS beta,      │   │
│  │    ...                                                               │   │
│  │  FROM execution                                                      │   │
│  │  GROUP BY activity_id, org_id                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Interface Definitions

### Backend Types

```typescript
// ActivityScore - from v_activity_score view
interface ActivityScore {
  activity_id: string;
  org_id: string;
  total_executions: number;
  alpha: number;              // Thompson: successes + 1
  beta: number;               // Thompson: failures + 1
  successes: number;
  failures: number;
  avg_duration_ms: number;
  avg_cost_usd: number;
  total_cost_usd: number;
  total_tokens_in: number;
  total_tokens_out: number;
  last_executed_at?: string;
  first_executed_at?: string;
}

// GET /v2/activities/scores response
interface ActivityScoresResponse {
  scores: ActivityScore[];
  total: number;
  path: 'paradigm' | 'legacy';  // Which data source was used
}

// GET /v2/activities/corpus-summary response
interface CorpusSummaryResponse {
  total_activities: number;
  total_executions: number;
  total_successes: number;
  total_failures: number;
  overall_success_rate: number;
  total_cost_usd: number;
  avg_belief: number;           // Mean of all alpha/(alpha+beta)
  exploration_count: number;    // Activities with <5 executions
  exploitation_count: number;   // Activities with >=10 executions
}
```

### Frontend Types

```typescript
// Computed from ActivityScore for UI
interface ActivityBelief {
  activity_id: string;
  alpha: number;
  beta: number;
  mean: number;                 // alpha / (alpha + beta)
  variance: number;             // (alpha * beta) / ((alpha + beta)^2 * (alpha + beta + 1))
  uncertainty: number;          // sqrt(variance) * 100
  executions: number;
  success_rate: number;
  last_executed_at?: string;
}

// Pattern detection for improvisation candidates
interface ImprovisationCandidate {
  activity_id: string;
  pattern: 'high_uncertainty' | 'failing' | 'stagnant' | 'ready_for_specialization';
  priority: 1 | 2 | 3 | 4 | 5;
  reason: string;
  affected_score: ActivityScore;
}
```

## Component Structure

```
src/components/LearnedCorpus/
├── index.ts                      # Barrel export
├── LearnedCorpus.tsx             # Main container with tabs
├── CorpusStats.tsx               # Top metric cards (5 cards)
├── ActivityBeliefs.tsx           # Thompson Sampling table
├── ImprovisationCandidates.tsx   # Pattern detection list
└── utils/
    └── thompson.ts               # Shared calculation utilities
```

## Thompson Sampling Calculations

```typescript
// From LearningSystem.tsx lines 447-489
function computeBeliefMetrics(score: ActivityScore): ActivityBelief {
  const alpha = score.alpha || 1;
  const beta = score.beta || 1;

  // Mean of Beta distribution = alpha / (alpha + beta)
  const mean = alpha / (alpha + beta);

  // Variance of Beta distribution
  const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));

  // Uncertainty as percentage
  const uncertainty = Math.sqrt(variance) * 100;

  return {
    activity_id: score.activity_id,
    alpha,
    beta,
    mean,
    variance,
    uncertainty,
    executions: score.total_executions,
    success_rate: score.successes / score.total_executions,
    last_executed_at: score.last_executed_at,
  };
}
```

## Pattern Detection

```typescript
// Adapted from LearningSystem.tsx lines 120-175
function detectImprovisationCandidates(scores: ActivityScore[]): ImprovisationCandidate[] {
  const candidates: ImprovisationCandidate[] = [];

  for (const score of scores) {
    const belief = computeBeliefMetrics(score);

    // High uncertainty (exploration opportunity)
    if (belief.uncertainty > 15 && score.total_executions >= 3) {
      candidates.push({
        activity_id: score.activity_id,
        pattern: 'high_uncertainty',
        priority: 2,
        reason: `High uncertainty (${belief.uncertainty.toFixed(1)}%) - needs more exploration`,
        affected_score: score,
      });
    }

    // Failing activities (evolution candidate)
    if (score.total_executions >= 10 && belief.success_rate < 0.3) {
      candidates.push({
        activity_id: score.activity_id,
        pattern: 'failing',
        priority: 5,
        reason: `Low success rate (${(belief.success_rate * 100).toFixed(1)}%) after ${score.total_executions} executions`,
        affected_score: score,
      });
    }

    // Ready for specialization
    if (score.total_executions >= 10 && belief.success_rate >= 0.7) {
      candidates.push({
        activity_id: score.activity_id,
        pattern: 'ready_for_specialization',
        priority: 3,
        reason: `High confidence (${(belief.success_rate * 100).toFixed(1)}%) - ready for specialization`,
        affected_score: score,
      });
    }
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}
```

## UI Patterns to Follow

### Metric Cards (from SystemOverview.tsx)
```tsx
<div className="grid gap-4 md:grid-cols-5">
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">Title</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">Subtext</p>
    </CardContent>
  </Card>
</div>
```

### Table with Scrolling (from ActivityLibrary.tsx)
```tsx
<Card>
  <CardHeader>
    <CardTitle>Activity Beliefs</CardTitle>
  </CardHeader>
  <CardContent>
    <ScrollArea className="h-[600px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Activity</TableHead>
            <TableHead>Belief</TableHead>
            <TableHead>Executions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* rows */}
        </TableBody>
      </Table>
    </ScrollArea>
  </CardContent>
</Card>
```

### Badge Variants for Success Rate
```tsx
const getBadgeVariant = (rate: number) => {
  if (rate >= 0.7) return "default";       // Green
  if (rate >= 0.4) return "secondary";     // Yellow
  return "destructive";                     // Red
};
```

## Data Flow

1. **useCorpus hook** calls `api.listActivityScores()` and `api.getCorpusSummary()`
2. **API client** fetches from `/v2/activities/scores` and `/v2/activities/corpus-summary`
3. **Backend routes** query `v_activity_score` view via `getActivityScores()` function
4. **SurrealDB view** computes aggregates from `execution` table on-the-fly
5. **Components** receive data and compute derived values (mean, variance, uncertainty)
6. **Pattern detection** runs client-side on scores array

## Reusable Code

| Source | Reuse In | Pattern |
|--------|----------|---------|
| `LearningSystem.tsx:447-489` | `thompson.ts` | Thompson calculations |
| `LearningSystem.tsx:120-175` | `ImprovisationCandidates.tsx` | Pattern detection |
| `SystemOverview.tsx:119-227` | `CorpusStats.tsx` | Metric cards |
| `ActivityLibrary.tsx:219-355` | `ActivityBeliefs.tsx` | Table display |
| `useTemplates.ts` | `useCorpus.ts` | Hook pattern |

## Gap Analysis

| Gap | Severity | Workaround |
|-----|----------|------------|
| No improvisation field aggregation | Medium | Detect patterns client-side from success rates |
| No edge weight history | Low | Out of scope for v1 |
| No real-time updates | Low | Poll on interval (30s) |
| API returns flat edges, not graph nodes | Medium | Construct nodes client-side (existing pattern) |
