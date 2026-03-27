# Learned Corpus Dashboard - Task List

## Commit Milestones

| Milestone | Description | Testable State |
|-----------|-------------|----------------|
| **M1** | Backend endpoints | `curl` returns valid JSON |
| **M2** | Frontend API integration | TypeScript compiles |
| **M3** | useCorpus hook | Hook can fetch data |
| **M4** | LearnedCorpus components | Components render with data |
| **M5** | Dashboard integration | Full tab navigation works |
| **M6** | Polish | Sorting, filtering, loading states |

---

## Phase 1: Backend Endpoints

### Task 1.1: Add types to schemas.ts
- [ ] Add `ActivityScoreSchema` Zod schema
- [ ] Add `ActivityScoresResponseSchema`
- [ ] Add `CorpusSummaryResponseSchema`
- [ ] Export types

**File:** `repos/metabob-activity-api/src/models/schemas.ts`

**Checkpoint:** `bun typecheck`

---

### Task 1.2: Add GET /v2/activities/scores
- [ ] Add route handler in activities.ts
- [ ] Support query params: `limit`, `min_executions`
- [ ] Use existing `getActivityScores()` from paradigm.ts
- [ ] Return `{ scores, total, path }`
- [ ] Add OpenAPI doc comment

**File:** `repos/metabob-activity-api/src/routes/activities.ts`

**Pattern:** Follow GET /templates (lines 570-700)

**Checkpoint:**
```bash
curl "http://activity.metabob.local/v2/activities/scores?limit=10" | jq .
```

---

### Task 1.3: Add GET /v2/activities/corpus-summary
- [ ] Add route handler
- [ ] Query aggregate metrics from v_activity_score
- [ ] Compute exploration/exploitation counts
- [ ] Return CorpusSummaryResponse

**File:** `repos/metabob-activity-api/src/routes/activities.ts`

**SQL:**
```sql
SELECT
  count() AS total_activities,
  math::sum(total_executions) AS total_executions,
  math::sum(successes) AS total_successes,
  math::sum(failures) AS total_failures,
  math::sum(total_cost_usd) AS total_cost_usd,
  math::mean(<float> alpha / (<float> alpha + <float> beta)) AS avg_belief,
  count(IF total_executions < 5 THEN 1 ELSE NONE END) AS exploration_count,
  count(IF total_executions >= 10 THEN 1 ELSE NONE END) AS exploitation_count
FROM v_activity_score
WHERE org_id = $org_id
GROUP ALL
```

**Checkpoint:**
```bash
curl "http://activity.metabob.local/v2/activities/corpus-summary" | jq .
```

---

### COMMIT M1
```
feat(activity-api): add learned corpus endpoints

- GET /v2/activities/scores returns Thompson Sampling data
- GET /v2/activities/corpus-summary returns aggregate metrics
- Uses existing v_activity_score computed view
```

**Files:**
- `repos/metabob-activity-api/src/models/schemas.ts`
- `repos/metabob-activity-api/src/routes/activities.ts`

---

## Phase 2: Frontend API Integration

### Task 2.1: Add types to types.ts
- [ ] Add `ActivityScore` interface
- [ ] Add `ActivityScoresResponse` interface
- [ ] Add `CorpusSummary` interface
- [ ] Add `CorpusSummaryResponse` interface

**File:** `repos/activity-dashboard/src/lib/types.ts`

**Types:**
```typescript
export interface ActivityScore {
  activity_id: string;
  org_id: string;
  total_executions: number;
  alpha: number;
  beta: number;
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

export interface ActivityScoresResponse {
  scores: ActivityScore[];
  total: number;
  path: 'paradigm' | 'legacy';
}

export interface CorpusSummary {
  total_activities: number;
  total_executions: number;
  total_successes: number;
  total_failures: number;
  overall_success_rate: number;
  total_cost_usd: number;
  avg_belief: number;
  exploration_count: number;
  exploitation_count: number;
}

export interface CorpusSummaryResponse extends CorpusSummary {}
```

---

### Task 2.2: Add methods to api-client.ts
- [ ] Add `listActivityScores()` method
- [ ] Add `getCorpusSummary()` method
- [ ] Add to convenience `api` object

**File:** `repos/activity-dashboard/src/lib/api-client.ts`

**Pattern:** Follow `listCodeVariants()` (lines 373-425)

---

### COMMIT M2
```
feat(dashboard): add API client for learned corpus endpoints
```

**Files:**
- `repos/activity-dashboard/src/lib/types.ts`
- `repos/activity-dashboard/src/lib/api-client.ts`

---

## Phase 3: Data Hook

### Task 3.1: Create useCorpus.ts
- [ ] Create hook file
- [ ] Define `UseCorpusOptions` and `UseCorpusResult` interfaces
- [ ] Implement data fetching with useState/useEffect
- [ ] Add auto-refresh with interval
- [ ] Add refresh() callback
- [ ] Handle loading and error states

**File:** `repos/activity-dashboard/src/hooks/useCorpus.ts`

**Pattern:** Follow `useTemplates.ts` exactly

**Interface:**
```typescript
export interface UseCorpusOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;  // default 30000ms
  limit?: number;            // default 100
  minExecutions?: number;    // optional filter
}

export interface UseCorpusResult {
  scores: ActivityScore[];
  summary: CorpusSummary | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}
```

---

### COMMIT M3
```
feat(dashboard): add useCorpus hook for data fetching
```

**Files:**
- `repos/activity-dashboard/src/hooks/useCorpus.ts`

---

## Phase 4: Components

### Task 4.1: Create component structure
- [ ] Create `src/components/LearnedCorpus/` directory
- [ ] Create `index.ts` with barrel exports

**File:** `repos/activity-dashboard/src/components/LearnedCorpus/index.ts`

---

### Task 4.2: Create thompson.ts utilities
- [ ] Create utility file
- [ ] Implement `computeBeliefMetrics()` function
- [ ] Implement `detectImprovisationCandidates()` function
- [ ] Export types: `ActivityBelief`, `ImprovisationCandidate`

**File:** `repos/activity-dashboard/src/components/LearnedCorpus/thompson.ts`

**From:** LearningSystem.tsx lines 447-489 (calculations) and 120-175 (patterns)

---

### Task 4.3: Create CorpusStats.tsx
- [ ] Create component
- [ ] Grid of 5 metric cards
- [ ] Cards: Activities, Executions, Success Rate, Exploration, Exploitation
- [ ] Use Progress bar for success rate
- [ ] Use Badge for phase counts

**File:** `repos/activity-dashboard/src/components/LearnedCorpus/CorpusStats.tsx`

**Props:**
```typescript
interface CorpusStatsProps {
  summary: CorpusSummary | null;
  loading?: boolean;
}
```

**Icons:** Brain, Activity, TrendingUp, Search, Target

---

### Task 4.4: Create ActivityBeliefs.tsx
- [ ] Create component
- [ ] Table with columns: Activity, α, β, Belief (bar), Uncertainty, Executions, Success Rate
- [ ] Progress bar for belief mean
- [ ] Badge variants based on success rate
- [ ] ScrollArea wrapper
- [ ] Sort by belief/executions/success rate

**File:** `repos/activity-dashboard/src/components/LearnedCorpus/ActivityBeliefs.tsx`

**Props:**
```typescript
interface ActivityBeliefsProps {
  scores: ActivityScore[];
  loading?: boolean;
}
```

---

### Task 4.5: Create ImprovisationCandidates.tsx
- [ ] Create component
- [ ] Use `detectImprovisationCandidates()` from thompson.ts
- [ ] Display pattern cards with priority badges
- [ ] Group by pattern type
- [ ] Show affected activity details

**File:** `repos/activity-dashboard/src/components/LearnedCorpus/ImprovisationCandidates.tsx`

**Props:**
```typescript
interface ImprovisationCandidatesProps {
  scores: ActivityScore[];
  loading?: boolean;
}
```

---

### Task 4.6: Create LearnedCorpus.tsx
- [ ] Create main container
- [ ] Header with title and refresh button
- [ ] CorpusStats always visible at top
- [ ] Tabs: Beliefs / Improvisation / Raw Scores
- [ ] Use useCorpus hook for data
- [ ] Handle loading/error states

**File:** `repos/activity-dashboard/src/components/LearnedCorpus/LearnedCorpus.tsx`

---

### COMMIT M4
```
feat(dashboard): add LearnedCorpus components

- CorpusStats: metric cards for corpus summary
- ActivityBeliefs: Thompson Sampling table with visualization
- ImprovisationCandidates: pattern detection for evolution opportunities
- LearnedCorpus: main container with tabs
```

**Files:**
- `repos/activity-dashboard/src/components/LearnedCorpus/index.ts`
- `repos/activity-dashboard/src/components/LearnedCorpus/thompson.ts`
- `repos/activity-dashboard/src/components/LearnedCorpus/CorpusStats.tsx`
- `repos/activity-dashboard/src/components/LearnedCorpus/ActivityBeliefs.tsx`
- `repos/activity-dashboard/src/components/LearnedCorpus/ImprovisationCandidates.tsx`
- `repos/activity-dashboard/src/components/LearnedCorpus/LearnedCorpus.tsx`

---

## Phase 5: Integration

### Task 5.1: Add tab to App.tsx
- [ ] Import LearnedCorpus component
- [ ] Add TabsTrigger with Brain icon
- [ ] Add TabsContent for corpus
- [ ] Update grid-cols-5 to grid-cols-6

**File:** `repos/activity-dashboard/src/App.tsx`

---

### COMMIT M5
```
feat(dashboard): integrate LearnedCorpus tab
```

**Files:**
- `repos/activity-dashboard/src/App.tsx`

**Verification:**
- Navigate to http://graph.metabob.local
- Click Corpus tab
- Verify data loads from API

---

## Phase 6: Polish

### Task 6.1: Add loading skeletons
- [ ] Add skeleton variants for CorpusStats
- [ ] Add skeleton rows for ActivityBeliefs table
- [ ] Add skeleton cards for ImprovisationCandidates

**Files:** All LearnedCorpus components

---

### Task 6.2: Add sorting to ActivityBeliefs
- [ ] Clickable column headers
- [ ] Sort by: belief mean, executions, success rate, uncertainty
- [ ] Visual sort indicator (arrow icon)

**File:** `repos/activity-dashboard/src/components/LearnedCorpus/ActivityBeliefs.tsx`

---

### Task 6.3: Add error handling
- [ ] Error boundary component
- [ ] Retry button on error
- [ ] Empty state when no scores

**Files:** LearnedCorpus.tsx, ActivityBeliefs.tsx

---

### COMMIT M6
```
feat(dashboard): add sorting, loading states, error handling to LearnedCorpus
```

**Files:**
- All LearnedCorpus components

---

## Dependency Graph

```
1.1 ──▶ 1.2 ──▶ 1.3 ──▶ [M1]
                          │
                          ▼
              2.1 ──▶ 2.2 ──▶ [M2]
                               │
                               ▼
                      3.1 ──▶ [M3]
                               │
                               ▼
              4.1 ──┬──▶ 4.2 ──┬──▶ 4.6 ──▶ [M4]
                   │           │
                   ├──▶ 4.3 ───┤
                   │           │
                   ├──▶ 4.4 ───┤
                   │           │
                   └──▶ 4.5 ───┘
                               │
                               ▼
                      5.1 ──▶ [M5]
                               │
                               ▼
              6.1 ──┬──▶ [M6]
                   │
              6.2 ──┤
                   │
              6.3 ──┘
```

---

## Testing Checkpoints

| After | Test |
|-------|------|
| M1 | `curl` both endpoints, verify JSON structure |
| M2 | `bun typecheck` in activity-dashboard |
| M3 | Import useCorpus in test file, verify no runtime error |
| M4 | Render components with mock data in Storybook/test |
| M5 | Full navigation test, data loads in browser |
| M6 | Click all sort buttons, verify loading states appear |

---

## Files Summary

**Backend (metabob-activity-api):**
- `src/models/schemas.ts` - Add types
- `src/routes/activities.ts` - Add 2 endpoints

**Frontend (activity-dashboard):**
- `src/lib/types.ts` - Add types
- `src/lib/api-client.ts` - Add methods
- `src/hooks/useCorpus.ts` - New hook
- `src/components/LearnedCorpus/index.ts` - Barrel export
- `src/components/LearnedCorpus/thompson.ts` - Utilities
- `src/components/LearnedCorpus/CorpusStats.tsx` - Metric cards
- `src/components/LearnedCorpus/ActivityBeliefs.tsx` - Table
- `src/components/LearnedCorpus/ImprovisationCandidates.tsx` - Patterns
- `src/components/LearnedCorpus/LearnedCorpus.tsx` - Main component
- `src/App.tsx` - Add tab

**Total:** 12 files, 6 commits
