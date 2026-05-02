## Context

The metabob-activity-api uses Zod for request validation and SurrealDB as the database. Over time, the Zod schemas evolved with stricter validation (nested object structures, additional fields) while the SurrealDB schema remained simpler (flexible arrays, string IDs).

### Interface Boundaries (from analysis)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INTERFACE BOUNDARIES                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MiniBob                 metabob-activity-api              SurrealDB │
│  ┌─────────┐            ┌─────────────────┐            ┌──────────┐ │
│  │ tasks   │──transform─▶│ task_steps     │───INSERT───▶│task_steps│ │
│  │ (array) │            │ (Zod validated) │            │(option)  │ │
│  └─────────┘            └─────────────────┘            └──────────┘ │
│                                │                            │       │
│                                │ MISMATCH                   │       │
│                                ▼                            │       │
│                    ┌──────────────────────┐                 │       │
│                    │ Zod requires:        │                 │       │
│                    │ - id (required)      │                 │       │
│                    │ - subagent (required)│                 │       │
│                    │ - description (req)  │                 │       │
│                    │ - dependencies (req) │                 │       │
│                    │ - prompt (req)       │                 │       │
│                    └──────────────────────┘                 │       │
│                              VS                              │       │
│                    ┌──────────────────────┐                 │       │
│                    │ SurrealDB accepts:   │◀────────────────┘       │
│                    │ - Any array of       │                         │
│                    │   objects            │                         │
│                    │ - option<array>      │                         │
│                    └──────────────────────┘                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Current State

**Working Flows:**
- Template listing (`GET /v2/activities/templates`)
- Execution recording (`POST /v2/activities/execution-traces`)
- Metrics aggregation (Thompson α/β parameters computed)
- Recommendation endpoint (Beta sampling implementation)

**Broken Flows:**
- ~~Line 1598: `beta` undefined in selection_metadata~~ (FIXED in M1)
- Template creation fails with "field doesn't exist" for nested task_steps

**Partial Flows:**
- Ribosome pattern (can't create templates from executions due to schema mismatch)
- org_id handling (works but not enforced everywhere)

### Schema Ownership

| Table | Owner Service | Readers |
|-------|--------------|---------|
| activity_template | metabob-activity-api | dashboard, minibob |
| variant_performance_metrics | metabob-activity-api | dashboard |
| activity_executions | metabob-activity-api | dashboard |
| execution_traces | metabob-activity-api | ribosome, dashboard |

**Constraints:**
- SCHEMAFULL tables require all fields to be defined or use flexible types
- API must remain backwards-compatible with existing clients
- Execution trace structure is what matters for learning (not template structure)

## Goals / Non-Goals

**Goals:**
- Template creation works end-to-end via the API
- Thompson Sampling integration tests can run
- API validation matches what the database accepts
- Black-box tests validate each milestone

**Non-Goals:**
- Enforcing strict task_steps structure (keep flexible - execution traces capture what matters)
- Adding new capabilities to templates
- Migrating existing data

## Decisions

### Decision 1: Fix critical beta variable bug first

**Choice:** Change `beta` to `beta: betaVal` at line 1598 in activities.ts

**Rationale:** This is a one-line fix that unblocks recommendation metadata. The sampling itself works correctly, only the response metadata was broken.

**Status:** ✅ COMPLETED

### Decision 2: Relax Zod validation for task_steps

**Choice:** Change `TemplateTaskSchema` to use `z.object({}).passthrough()` or `z.record(z.any())`

**Rationale:** The SurrealDB schema uses `option<array>` without nested type definitions. Strict Zod validation creates a mismatch. The execution trace (which captures actual task results) is what matters for the learning loop, not the template structure.

**Alternatives Considered:**
- Add nested DEFINE FIELD statements to SurrealDB → Requires migration, more complexity
- Keep strict Zod and fix DB → Too many interdependencies

### Decision 3: Strip undefined fields before INSERT

**Choice:** Create a utility to filter objects to only known fields before SurrealDB INSERT

**Rationale:** SCHEMAFULL tables reject unknown fields. The API should only send fields that exist in the database schema.

**Alternatives Considered:**
- Use SCHEMALESS table → Loses validation benefits
- Add all API fields to DB schema → Unnecessary bloat

### Decision 4: String org_id everywhere

**Choice:** Keep `org_id` as `option<string>` (already correct in SurrealDB schema)

**Rationale:** The API layer shouldn't need to construct SurrealDB record references. Using plain string IDs is simpler and consistent with how the API handles other entity references.

## Risks / Trade-offs

**[Risk] Loose validation may accept invalid task_steps data**
- Mitigation: Application logic validates task structure at execution time, not storage time
- The execution trace captures what actually happened, enabling learning even from poorly-structured templates

**[Risk] Schema drift may recur**
- Mitigation: Document the alignment requirement; black-box tests at each milestone catch drift early

**[Trade-off] Flexibility vs type safety**
- We choose flexibility for task_steps since the structure varies by template type
- Type safety is enforced at execution time where it matters

## Test Architecture

Each milestone has black-box tests that:
1. Run against deployed services (not mocks)
2. Use direct API calls to `api.minibob.local`
3. Validate via Playwright MCP for dashboard (Milestone 5)
4. Are idempotent (use timestamped test data)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BLACK-BOX TEST ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Test Runner                                                        │
│  ┌─────────┐                                                        │
│  │ bash/   │                                                        │
│  │ curl    │──────┐                                                 │
│  └─────────┘      │                                                 │
│                   ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Kubernetes Cluster (docker-desktop)             │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │                 activity-system namespace            │    │   │
│  │  │                                                      │    │   │
│  │  │  ┌──────────────┐    ┌──────────────┐               │    │   │
│  │  │  │metabob-      │◀───│ SurrealDB    │               │    │   │
│  │  │  │activity-api  │    │              │               │    │   │
│  │  │  └──────────────┘    └──────────────┘               │    │   │
│  │  │         ▲                                           │    │   │
│  │  │         │ /v2/activities/*                          │    │   │
│  │  └─────────┼───────────────────────────────────────────┘    │   │
│  │            │                                                 │   │
│  │  ┌─────────┴─────────┐                                      │   │
│  │  │ Istio Gateway     │ api.minibob.local                    │   │
│  │  └───────────────────┘                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Playwright MCP (Milestone 5)                                       │
│  ┌─────────┐                                                        │
│  │mcp__    │                                                        │
│  │playwright│────▶ dashboard.minibob.local                          │
│  └─────────┘                                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
