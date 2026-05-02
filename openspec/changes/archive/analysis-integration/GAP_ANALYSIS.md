# metabob-analysis-api Gap Analysis

> **Purpose**: Point-by-point analysis of what metabob-analysis-api currently does vs. what it should do per the Impulse-Activity Foundation.
>
> **Source Documents**:
> - `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` (canonical reference)
> - Current implementation in `repos/metabob-analysis-api/src/`

---

## Executive Summary

metabob-analysis-api is a legacy code analysis backend that should evolve to serve as a **specialized impulse resolver** and **supplementary data source** within the Impulse-Activity architecture. Currently, it embeds hardcoded detection logic and siloed learning mechanisms that should instead be expressed as activities with recorded traces.

**Desired Role**:
- Legacy offering that metabob-mcp sends data to for dashboard display
- Provides non-essential but helpful services for code development
- Proposes problems via LLM interpolation of suspicious locations
- Problem detection should be learned via activities, not hardcoded

---

## Gap Analysis by Component

### 1. Problem Detection System

| Aspect | CURRENT | DESIRED (per Foundation) | GAP | CHANGE NEEDED |
|--------|---------|--------------------------|-----|---------------|
| **Detection Logic** | Hardcoded in `problems.ts` - reads from `analysis_problems` table that gets populated by external indexing | Problems should be proposed by activities that use LLM reasoning on suspicious code patterns | Detection logic is static, not learned | Convert problem detection into an activity template `propose-code-problems` that takes file impulses and outputs problem impulses |
| **Problem Source** | Problems stored in SurrealDB with fixed schema (category, severity, impact_score) | Problems should be output impulses from detection activities with shape metadata | Schema is rigid, not impulse-shaped | Wrap problem records as impulses with `shape: "code_problem"`, include metadata like `availableOps: ["investigate", "fix", "ignore"]` |
| **LLM Usage** | No LLM involved - problems are pre-computed | LLM should reason about suspicious patterns identified by deterministic analysis | Missing LLM reasoning layer | Add activity tasks that use LLM resolver to interpret CPG anomalies and propose problems with confidence |
| **Learning** | No learning for problem detection accuracy | Thompson Sampling should rank detection strategies by accuracy over time | No feedback loop | Record problem proposal traces, track which problems get fixed vs ignored, feed back to improve detection templates |

### 2. CPG (Code Property Graph) Service

| Aspect | CURRENT | DESIRED (per Foundation) | GAP | CHANGE NEEDED |
|--------|---------|--------------------------|-----|---------------|
| **Lifecycle** | Session-scoped CPG instances in `CPGService` | CPG is a resolver that lives where the data is (vessel level) | CPG state management is API-side | CPG should be managed by the vessel (metabob-mcp or IDE); API provides persistence and historical access |
| **Role** | Full CPG management: parsing, indexing, traversal, prediction | Specialized resolver for `cpg_analysis` impulse types | Too much responsibility | Split: CPG parsing/indexing stays in vessel; API stores CPG snapshots and serves as trace store |
| **Data Exposure** | Direct API endpoints (`/v2/analysis/index`, `/v2/analysis/impact`) | Expose as impulse resolver types via `/v2/traces/query` | Not impulse-native | Create impulse types: `cpgSnapshot`, `impactGraph`, `componentDependencies` |
| **Session Isolation** | Uses `X-Session-ID` header, stores in memory Map | Sessions are vessel concern; API is stateless trace store | Stateful session management | Remove session-scoped CPG management; vessel sends CPG data as impulses for storage |

### 3. Co-change Prediction

| Aspect | CURRENT | DESIRED (per Foundation) | GAP | CHANGE NEEDED |
|--------|---------|--------------------------|-----|---------------|
| **Algorithm** | Hybrid: CPG embeddings + historical patterns with configurable weights | Should be an activity that gets selected via Thompson Sampling | Algorithm is hardcoded | Create activity templates for different co-change strategies; let Thompson Sampling pick the best |
| **Learning Service** | `OnlineLearningService` with Bayesian updates for pattern confidence | Learning should happen from execution traces, not parallel system | Duplicates trace-based learning | Migrate pattern learning to use `metabob-activity-api` Thompson Sampling; record predictions as traces |
| **Prediction Output** | Returns `CochangeSuggestion[]` with confidence scores | Should return impulses with shape `co_change_prediction` | Not impulse-shaped | Wrap predictions as impulses with metadata (confidence, reason, historical_frequency) |
| **Feedback Loop** | `recordFeedback()` tracks accuracy, triggers model updates | Feedback should be outcome recording on traces | Separate feedback system | Remove dedicated feedback; use trace success/failure to update activity template scores |

### 4. Impact Analysis

| Aspect | CURRENT | DESIRED (per Foundation) | GAP | CHANGE NEEDED |
|--------|---------|--------------------------|-----|---------------|
| **Invocation** | Direct API call with diff/changed_files | Should be activity task using `cpg_traversal` resolver | Direct call bypasses activity system | Wrap as activity `analyze-change-impact` with CPG input impulses |
| **Output** | `ImpactAnalysisResult` with dependencies, tests, risk level | Output impulses with shape `impact_analysis` | Not impulse-shaped | Return impulses with metadata summary for LLM reasoning |
| **Risk Computation** | Hardcoded thresholds in `computeRiskLevel()` | Risk assessment could be learned activity | Static heuristics | Create activity variants for risk assessment; learn which thresholds work best |

### 5. Annotations System

| Aspect | CURRENT | DESIRED (per Foundation) | GAP | CHANGE NEEDED |
|--------|---------|--------------------------|-----|---------------|
| **Storage** | `component_annotations` table with CRUD endpoints | Annotations are impulses with shape `annotation` | Separate data model | Unify with impulse system - annotations become impulses attached to component impulses |
| **Creation** | Auto-created when problems resolved | Should be output of `resolve-problem` activity | Not activity-driven | Problem resolution is an activity; annotations are output impulses |
| **Retrieval** | Via `/v2/analysis/annotations` endpoint | Via impulse resolution: `{ type: "annotations", componentId: "..." }` | Not impulse-resolvable | Add annotation resolver to traces/query endpoint |

### 6. API Structure

| Aspect | CURRENT | DESIRED (per Foundation) | GAP | CHANGE NEEDED |
|--------|---------|--------------------------|-----|---------------|
| **Endpoint Design** | Many specialized endpoints (`/index`, `/impact`, `/cochange`, `/problems`, etc.) | Minimal API: `/v2/traces`, `/v2/traces/query`, `/v2/activities/recommend` | Too many endpoints | Consolidate to trace-centric API; specialized queries become impulse resolution types |
| **State Management** | Session-scoped services, in-memory caches | Backend is stateless; state lives in traces | Stateful backend | Remove session state; all data flows through trace storage |
| **Auth Model** | `X-Session-ID` header, JWT middleware | Auth is vessel concern; backend authenticates traces | Session-based auth | Use trace provenance for auth; vessel sends signed traces |

### 7. Learning Mechanisms

| Aspect | CURRENT | DESIRED (per Foundation) | GAP | CHANGE NEEDED |
|--------|---------|--------------------------|-----|---------------|
| **Pattern Storage** | `cochange_patterns` table with frequency/confidence | Patterns extracted from execution traces | Parallel storage | Store patterns as derived data from trace analysis |
| **Confidence Updates** | Bayesian updates in `OnlineLearningService` | Thompson Sampling on activity variants | Different algorithm | Use Thompson Sampling; Bayesian confidence becomes one input to activity selection |
| **Feedback Recording** | `prediction_feedback` table | Trace outcome (success/failure) | Separate feedback | Remove prediction_feedback; use trace outcomes |
| **Model Triggers** | Low accuracy triggers `updateModels()` | Continuous learning from every trace | Manual triggers | Remove triggers; learning is continuous via trace recording |

---

## Summary of Required Changes

### Phase 1: Impulse-Native Data
1. Wrap all output types (problems, predictions, impact) as impulses with metadata
2. Add impulse resolution types to query endpoint
3. Remove direct-response endpoints in favor of impulse patterns

### Phase 2: Activity-Driven Detection
1. Convert problem detection to activity template `propose-code-problems`
2. Convert co-change prediction to activity template `predict-co-changes`
3. Convert impact analysis to activity template `analyze-change-impact`
4. Use LLM resolver for reasoning tasks; deterministic resolvers for CPG operations

### Phase 3: Unified Learning
1. Remove `OnlineLearningService` parallel learning system
2. Record all operations as traces to `metabob-activity-api`
3. Use Thompson Sampling from activity-api for template selection
4. Migrate pattern extraction to ribosome-based activity creation

### Phase 4: Stateless Backend
1. Remove session-scoped CPG service
2. Remove in-memory caches
3. Move CPG management to vessel (metabob-mcp)
4. API becomes pure trace store and resolver

---

## Foundation Alignment Checklist

For metabob-analysis-api to align with the Impulse-Activity Foundation:

- [ ] Data treated as impulses with metadata? **NO** - returns raw domain objects
- [ ] Uses activities to constrain search space? **NO** - hardcoded logic
- [ ] Resolvers live where data is? **PARTIAL** - CPG should be vessel-side
- [ ] Records traces for learning? **NO** - has parallel learning system
- [ ] Avoids unnecessary LLM usage? **YES** - no LLM currently (but should add where needed)
- [ ] Allows improvisation with recording? **NO** - fixed algorithms
- [ ] Backend limited to trace storage and pattern learning? **NO** - does computation
- [ ] Can patterns be extracted and reused? **NO** - patterns are internal

---

## Recommended Migration Path

### Immediate (Legacy Mode)
Keep current API surface but add:
- Impulse wrapper layer for responses
- Trace recording to metabob-activity-api for all operations
- Bridge endpoints that map to impulse resolution

### Medium-term (Hybrid)
- Convert detection/prediction to activity templates
- Keep CPG service but record traces
- Deprecate direct endpoints in favor of impulse resolution

### Long-term (Foundation-Native)
- Remove all session state
- API becomes pure specialized resolver
- All "intelligence" lives in activities selected by Thompson Sampling
- metabob-mcp owns CPG lifecycle; API stores snapshots

---

## Key Insight

The fundamental shift is from **"API that does analysis"** to **"API that stores what happened and resolves historical data"**. The analysis itself should happen in vessels via activities. metabob-analysis-api becomes a specialized trace store that understands code analysis domain types, not an analysis engine.

This is the difference between:
- **Current**: `POST /impact → compute → return results`
- **Desired**: `Activity executes → uses cpg resolver → stores trace → API serves trace as impulse`
