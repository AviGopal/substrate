# metabob-* Vessel Migration

**Status**: ACTIVE  
**Opened**: 2026-05-25  
**Operator direction**: Replace metabob-* scoped vessels with ias-executor-ts standard vessels

## Context

The metabob-* vessels predate the ias-executor-ts standard vessel pattern. They carry:
- Helm-managed deployment complexity
- Per-vessel SurrealDB schemas that overlap with activity-api's learning store
- Discovery registration bolted on after the fact (not the primary interface)
- Kubernetes-native assumptions that conflict with the local substrate model

The ias-executor-ts standard vessel pattern (as demonstrated by goal-host-vessel, local-tools-vessel, llm-resolver-vessel, ribosome-vessel, boredom-vessel) provides:
- Substrate-native deployment (systemd unit, no Helm chart)
- Discovery-first registration (vessel identity = discovery advertised shapes)
- No private SurrealDB schema (state lives in the learning store via standard write resolvers)
- ias-executor-ts execution context (GoalHost, HttpLLMPort, adapters)

## Vessels to Migrate

| Vessel | Shapes | Complexity | Priority | Notes |
|--------|--------|------------|----------|-------|
| `metabob-analysis-api` | 6 | LOW | 1 | problem_detection, error_log, source_code, code_quality, code_annotation, cpg_query_result — no SurrealDB schema ownership, uses CPG library |
| `metabob-activity-api` | 53 | HIGH | LAST | Core learning store — shapes must be decomposed into dedicated vessels |
| `metabob-cloud-dashboard` | UI only | MEDIUM | 2 | Browser app; no impulse shapes — "migration" = retire or fold into workbench |
| `metabob-internal-dashboard` | UI only | LOW | 3 | Operator-facing; retire when workbench covers the surface |
| `metabob-dashboard` | UI only | LOW | 3 | Legacy; retire |

## Phase 1: analysis-vessel (replaces metabob-analysis-api)

### Target shapes

`problem_detection`, `error_log`, `source_code`, `code_quality`, `code_annotation`, `cpg_query_result`

### Migration approach

Create `repos/analysis-vessel/` as a standard ias-executor-ts vessel:

```
repos/analysis-vessel/
├── src/
│   ├── index.ts          # Hono server + discovery registration loop
│   ├── config.ts         # Config (port, discovery, shapes list)
│   ├── routes/
│   │   └── impulses.ts   # POST /v2/impulses/resolve dispatcher
│   └── resolvers/
│       ├── problem-detection.ts   # Calls cpg-inference-ts
│       ├── source-code.ts         # Filesystem access
│       ├── error-log.ts           # Log parsing
│       └── code-quality.ts        # Metrics
├── package.json          # Depends on cpg-inference-ts (local path)
└── CLAUDE.md
```

Key differences from metabob-analysis-api:
- No SurrealDB dependency (no local schema)
- No Redis cache (use activity-api's learning store for repeat-resolution caching)
- Discovery client from `@avigopal/ias-executor-ts` (same as other substrate vessels)
- Registered as `analysis-vessel-local` in substrate, `analysis-vessel-{hostname}` in Helm

### Acceptance gates

- [ ] `analysis-vessel` registers in discovery with all 6 shapes
- [ ] `POST /v2/impulses/resolve` returns correct content for `problem_detection` with a real file path
- [ ] `POST /v2/impulses/resolve` returns `source_code` content for a known file
- [ ] `GET /health` returns 200 with discovery.registered=true
- [ ] systemd unit `analysis-vessel.service` added to `scripts/substrate/units/`
- [ ] `metabob-analysis-api` systemd unit (if present) removed or disabled

## Phase 2: activity-api decomposition

The 53 shapes in metabob-activity-api break into natural groupings:

| New vessel | Shape family | Rationale |
|-----------|--------------|-----------|
| `learning-store-vessel` | activityExecutionTrace*, activityTemplate*, activityMetrics*, variantMetrics*, goalPath* | Core Thompson sampling + trace storage — keep together |
| `impulse-relevance-vessel` | impulseRelevance*, impulseRelevanceMetrics | Could be inline in learning-store or separate |
| `audit-vessel` | templateAuditReport, activityAuditLog | Read-only audit surface |
| `cost-metrics-vessel` | executionCostSummary, resolverCostAnalysis, vesselPerformanceMetrics, costByActivity | Read-only cost analytics |

Alternatively, keep `learning-store-vessel` as the single replacement for all 53 shapes, following the principle that the learning store is a coherent whole (Thompson posteriors, traces, templates, and relevance are all co-dependent).

**Decision deferred** until analysis-vessel migration is complete. The operator will steer decomposition granularity after seeing Phase 1 in practice.

## What does NOT change

- `development-vessel` — already a standard vessel
- `goal-host-vessel`, `llm-resolver-vessel`, `local-tools-vessel`, `ribosome-vessel`, `boredom-vessel` — already standard
- `discovery-vessel`, `identity-vessel`, `user-vessel`, `concept-db` — core infrastructure, separate migration if ever

## Migration criterion

Each migrated vessel must:
1. Register in discovery within 30s of startup
2. Successfully resolve all advertised shapes under harness
3. Not require any changes to minibob or goal-host-vessel (discovery-generic path handles routing)
4. Former metabob-* counterpart deregisters from discovery within 5min of new vessel coming live

## Out of scope

- Canary/production Helm chart updates (substrate-only first; Helm after 3 successful substrate runs)
- Data migration (trace history stays in SurrealDB; new vessel reads same tables via activity-api write resolvers)
- UI vessels (metabob-cloud-dashboard etc.) — separate workbench consolidation track
