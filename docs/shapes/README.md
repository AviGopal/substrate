# Impulse Shape Definitions

This directory contains shape definitions for the impulse system. Each document defines:

- **Shape metadata structure**: What reasoners see before loading content
- **Pointer structure**: How to reference this data type
- **Data structure**: What the resolved content looks like
- **Budget guidelines**: Resource limits for this shape
- **Resolver assignment**: Which vessel resolves this shape

## Shape Design Principles

Following [IMPULSE_ACTIVITY_FOUNDATION.md](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md):

1. **Metadata first, content later**: Shapes include `summary`, `sample`, and `availableOps` for reasoning
2. **Resolvers live where data lives**: Shape definitions specify which vessel has the data
3. **Shapes are universal**: Any vessel (dashboard, CLI, activities) can request these shapes
4. **Resource budgets**: Every shape respects budget limits (row count, bytes, time)

## Shape Categories

### Cost and Metrics Shapes

[COST_METRICS_SHAPES.md](./COST_METRICS_SHAPES.md) - Cost, token consumption, and usage metrics

**Shapes defined**:
- `execution_cost_summary` - Aggregated cost metrics over time window
- `token_consumption_timeline` - Time-series token consumption
- `cost_breakdown_by_activity` - Per-activity cost distribution
- `cost_breakdown_by_user` - Per-user cost and usage
- `cost_breakdown_by_api_key` - Per-API-key usage tracking
- `resolver_cost_breakdown` - Cost by resolver type (LLM vs deterministic)
- `activity_usage_metrics` - Activity execution frequency

**Resolver**: `activity-api` (has execution trace data)

### Activity Learning Shapes

Canonical source of truth for advertised shapes: [`repos/metabob-activity-api/src/config.ts`](../../repos/metabob-activity-api/src/config.ts) (`discovery.shapes`). Case handlers live in `repos/metabob-activity-api/src/routes/impulses.ts`. Do not advertise a shape here that has no `case` in that router.

**Read shapes** (v1.5.5):
- `activityExecutionTrace` - Full execution trace with state transitions
- `activityTemplate` - Activity template definitions
- `activityMetrics` - Thompson Sampling statistics
- `executionTraceList` - Paginated execution list (browse/inspect)
- `variantMetricsSummary` - Thompson Sampling summary per variant
- `activityTemplateRecommendation` - Recommendation output of the recommend path
- `activityTemplatesByMetrics` - Templates filtered/ordered by performance
- `executionTraces` - Query-able slice of execution trace rows
- `goal` - Goal records used by orchestrator / goal-seeking flows
- `toolRiskProfile` - Per-tool risk signals extracted from traces
- `compositionSuccess` - Composition-edge success stats (**renamed** from `activityCompositionGraph`)
- `impulseRelevance` - Impulse relevance scores (**renamed** from `impulseRelevanceMetrics`)
- `preValidationResult` - Pattern-based pre-validation verdicts for tool arguments
- `templateAuditReport` - Per-template deficiency reports (missing shapes, weak descriptions, alias clusters); descriptive, writes nothing. See [`../guides/TEMPLATE_UPKEEP.md`](../guides/TEMPLATE_UPKEEP.md).

**Write shapes** (v1.5.0+) — see [`../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`](../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md):
- 14 `*_write` shapes (e.g. `activityExecutionTrace_write`, `activityFeedback_write`, `impulseRelevance_write`) that delegate to REST endpoints so activities can invoke learning-loop writes through `POST /v2/impulses/resolve` without hardcoding routes.

**Destructive shapes** (admin-only, emit `upkeepAuditLog`):
- `activityTemplate_update` / `activityTemplate_deprecate` — see [`../guides/ACTIVITY_LIFECYCLE_DEPRECATION.md`](../guides/ACTIVITY_LIFECYCLE_DEPRECATION.md)
- `activityExecutionTrace_delete` — hard delete, audited.

**Resolver**: `activity-api`

**Renamed shapes (2026-04)**: `activityCompositionGraph` → `compositionSuccess`; `impulseRelevanceMetrics` → `impulseRelevance`; `toolUsagePatterns` → (internal `toolUsage` table, no longer advertised as a read shape — use the `toolRiskProfile` aggregate or the `toolUsage_write` resolver). The legacy names remain defined in older migrations for back-compat but are not in the discovery advertisement.

### Code Analysis Shapes

(Not yet documented)

**Shapes in use** (from analysis-api):
- `problem_detection` - Code quality issues
- `error_log` - Error log analysis
- `source_code` - Source code content
- `code_quality` - Quality metrics

**Resolver**: `analysis-api`

**TODO**: Document these shapes in `CODE_ANALYSIS_SHAPES.md`

### Local Filesystem Shapes

(Not yet documented)

**Shapes in use** (from MiniBob):
- `file` - File content from filesystem
- `directoryTree` - Directory structure
- `gitDiff` - Git diff output
- `memo` - Embedded text content

**Resolver**: Local vessel (MiniBob, OpenCode)

**TODO**: Document these shapes in `FILESYSTEM_SHAPES.md`

## Adding New Shapes

When defining new impulse shapes:

1. **Create shape document** in this directory (e.g., `NEW_CATEGORY_SHAPES.md`)
2. **Follow the template**:
   - Purpose and use cases
   - Metadata structure with all fields
   - Pointer structure with parameters
   - Data structure when loaded
   - Budget guidelines
   - Resolver assignment
   - Implementation examples
3. **Specify resolver location**: Which vessel owns this data?
4. **Provide metadata examples**: What does reasoning context look like?
5. **Document budget considerations**: Row limits, byte limits, query time
6. **Align with foundation**: Check against principles in IMPULSE_ACTIVITY_FOUNDATION.md

## Shape Naming Conventions

- Use snake_case: `execution_cost_summary`, not `ExecutionCostSummary`
- Be descriptive: `token_consumption_timeline`, not `tokens`
- Indicate data type: `_summary`, `_timeline`, `_breakdown`, `_metrics`
- Avoid redundancy: `cost_breakdown_by_activity`, not `activity_cost_breakdown_by_activity`

## Cross-Vessel Shapes

Some shapes require data from multiple vessels:

**Example**: `cost_breakdown_by_user`
- Cost data from `activity-api` (execution traces)
- User email from `identity-vessel` (user records)

**Resolution strategies**:
1. **Primary resolver coordinates**: Activity-API queries identity-vessel for user data
2. **Client-side join**: Dashboard requests two impulses and joins locally
3. **Denormalization**: Store redundant data (not recommended)

See [COST_METRICS_SHAPES.md](./COST_METRICS_SHAPES.md) Phase 2 for implementation patterns.

## Discovery Integration

Vessels advertise shapes via discovery-vessel registration:

```typescript
// activity-api registration
{
  vesselId: 'activity-api-pod-1',
  shapes: [
    'execution_cost_summary',
    'token_consumption_timeline',
    'cost_breakdown_by_activity',
    'activityExecutionTrace',
    'activityTemplate',
    // ... etc
  ]
}
```

Clients discover shapes via discovery-vessel query:

```typescript
// Find vessels that can resolve cost summaries
const vessels = await discovery.resolve({
  requiredShapes: ['execution_cost_summary']
});
```

## Implementation Checklist

When implementing a new shape:

- [ ] Define shape in shape document with all required fields
- [ ] Implement resolver in appropriate vessel
- [ ] Register shape with discovery-vessel (if using discovery)
- [ ] Add tests for resolver implementation
- [ ] Update vessel CLAUDE.md with shape list
- [ ] Document budget behavior and query performance
- [ ] Provide usage examples for dashboard/CLI/activities

## Future Work

### Planned Shape Categories

- **Identity shapes** (`user_profile`, `org_settings`, `api_key_metadata`)
- **Infrastructure shapes** (`vessel_health`, `deployment_status`, `resource_utilization`)
- **Learning shapes** (`thompson_sampling_state`, `pattern_recognition_results`)
- **Workflow shapes** (`ci_pipeline_result`, `deployment_trace`, `validation_result`)

### Shape Evolution

Shapes evolve as the system learns:

- New fields discovered through execution
- Metadata becomes richer (better summaries, samples)
- `availableOps` expands as resolvers learn new operations
- Budget recommendations improve based on usage patterns

This is expected and encouraged - shapes are living specifications, not rigid contracts.
