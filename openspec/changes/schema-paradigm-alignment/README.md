# schema-paradigm-alignment

Refactor the activity system database schema from 20+ tables to 4 core tables that strictly align with the impulse/activity/vessel paradigm defined in `IMPULSE_ACTIVITY_FOUNDATION.md`.

## Status

**Phase:** Design Complete, Ready for Implementation
**Created:** 2026-03-26
**Updated:** 2026-03-26 (SurrealDB 3.x implementation research)
**Estimated Duration:** 8 weeks

## Summary

The current schema has evolved organically with naming inconsistencies, denormalization, and conceptual drift. This change refactors to a pure model:

### Current State (20+ tables)
- `activity_template`, `activity_registry` (duplicate concepts)
- `activity_executions`, `activity_execution_traces` (duplicate concepts)
- `variant_performance_metrics` (separate from activities, causes sync bugs)
- `impulse_data`, `impulse_relevance_metrics` (split impulse data)
- `goal_execution_paths` (goals separate from impulses)
- `tool_usage`, `tool_usage_patterns` (tools separate from activities)
- Many unused tables (`activity_dataflows`, `code_variants`, etc.)

### Target State (4 tables + views)

| Table | Purpose | Replaces |
|-------|---------|----------|
| `impulse` | All data with pointer + shape + metadata | impulse_data, goals, traces, errors |
| `activity` | All state transitions with input/output shapes | activity_registry, tool definitions, compositions |
| `execution` | All traces linking inputs to outputs | execution_traces, tool_usage, composition graph |
| `vessel` | Execution environments with resolver capabilities | minibob_instance |

| View | Purpose | Replaces |
|------|---------|----------|
| `v_activity_score` | Thompson Sampling (computed from execution) | variant_performance_metrics |
| `v_impulse_relevance` | Impulse-activity correlation (computed) | impulse_relevance_metrics |
| `v_goal_paths` | Compositions accepting goal impulses | goal_execution_paths |

## Key Insights

1. **Goals ARE impulses** with `shape = 'goal'`
2. **Goal paths ARE activities** with `execution_type = 'composition'`
3. **Tools ARE activities** with `execution_type = 'tool'`
4. **Thompson Sampling** computed from `execution`, not stored separately
5. **Impulse relevance** computed from `execution` traces
6. **No separate tool_usage table** - tool calls are executions with `activity.execution_type = 'tool'`

## Documents

### Core Design
- [proposal.md](./proposal.md) - Why we're doing this and what changes
- [design.md](./design.md) - Technical decisions and schema definitions
- [tasks.md](./tasks.md) - Phases, milestones, and commit checkpoints

### Specifications
- [specs/core-tables.md](./specs/core-tables.md) - 4 core table definitions with RBAC
- [specs/computed-views.md](./specs/computed-views.md) - Thompson Sampling and relevance views
- [specs/migration-strategy.md](./specs/migration-strategy.md) - Dual-write and backfill plan
- [specs/api-changes.md](./specs/api-changes.md) - Backend endpoint updates

### New Specifications (from gap analysis)
- [specs/resolution-protocol.md](./specs/resolution-protocol.md) - Multi-vessel impulse routing
- [specs/shape-matching.md](./specs/shape-matching.md) - Activity selection algorithm
- [specs/composition-semantics.md](./specs/composition-semantics.md) - Nested execution behavior
- [specs/debugging-replay.md](./specs/debugging-replay.md) - Execution trace replay flows
- [specs/surrealdb-3x-implementation.md](./specs/surrealdb-3x-implementation.md) - SurrealDB 3.x patterns and constraints

## Timeline

| Phase | Duration | Commit Milestone |
|-------|----------|------------------|
| P0: Foundation | 1 week | `chore(spec): baseline metrics and specs` |
| P1: Schema Deployment | 1 week | `feat(schema): deploy 4 core tables` |
| P2: API Adaptation | 2 weeks | `feat(api): unified routes with shape matching` |
| P3: MiniBob Integration | 1 week | `feat(minibob): populate unified schema fields` |
| P4: Dual-Write & Migration | 1 week | `feat(migration): dual-write and backfill` |
| P5: Cleanup | 2 weeks | `chore(cleanup): remove legacy schema` |

**Total:** ~8 weeks (includes buffer for risk mitigation)

## Dependencies

- **SurrealDB >= 3.1.0** (for computed views, PERMISSIONS on views)
- **surrealdb-multi-tenant-schema** change (RBAC foundation with org_id/project_id)
- **metabob-proto** core schemas (organizations, users, projects)

## Architecture Alignment

This change directly implements the paradigm from `IMPULSE_ACTIVITY_FOUNDATION.md`:

| Foundation Principle | Implementation |
|---------------------|----------------|
| Impulses are universal data | Single `impulse` table with pointer + shape |
| Activities constrain search | `activity.input_shapes` filters candidates |
| Resolvers live where data lives | `vessel.resolves[]` declares capabilities |
| Record everything | `execution` table captures full traces |
| Learn from traces | `v_activity_score` computed from execution |
| Reserve improvisation | New activities can be extracted via ribosome |

## Interface Boundaries

| Interface | Protocol | Direction |
|-----------|----------|-----------|
| MiniBob → Backend | HTTP REST + JSON | Write executions, read templates |
| Backend → Database | SurrealQL | CRUD with PERMISSIONS |
| MiniBob → Local | Filesystem + Memory | Resolve file/memo impulses |
| Backend → MiniBob | HTTP Response | Template recommendations |

## RBAC Pattern

Universal PERMISSIONS applied to all 4 tables:
```surql
FOR select WHERE org_id = $auth.org_id
  AND (project_id IS NONE OR project_id IN $auth.project_ids)
FOR create WHERE $auth.org_id != NONE
FOR update WHERE org_id = $auth.org_id
  AND ($auth.role = 'admin' OR created_by = $auth.id)
FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin'
```

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Data loss during migration | HIGH | 30-day archive, hourly validation |
| View performance regression | MEDIUM | Baseline metrics, materialize if needed |
| API breaking changes | MEDIUM | Backward-compat views, 30-day deprecation |
| MiniBob disruption | LOW | Feature flags, staged rollout |
