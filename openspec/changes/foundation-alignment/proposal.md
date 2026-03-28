# Foundation Alignment

> **Status**: Proposed
> **Scope**: Cross-repository alignment to Impulse-Activity Foundation
> **Repositories**: metabob-mcp, metabob-activity-api, metabob-analysis-api, minibob, metabob-cloud-dashboard, metabob-internal-dashboard

---

## Why

The Impulse-Activity Foundation defines a coherent model where: (1) impulses are pointers to data with metadata describing shape, (2) activities constrain the search space via input/output schemas, (3) vessels resolve impulses where data lives, (4) everything is traced for learning, and (5) improvisation is recorded for ribosome extraction.

Six repository gap analyses reveal systematic deviation from this foundation:

| Repository | Alignment | Critical Gaps |
|------------|-----------|---------------|
| metabob-mcp | 0/5 | No trace recording, no impulse abstraction, no activities |
| metabob-activity-api | 3/5 | ~20 single-use endpoints should be pointer types, proxies to analysis-api |
| metabob-analysis-api | 1/5 | Hardcoded detection should be activities, parallel learning duplicates trace-based learning |
| minibob | 4/5 | No mandatory metadata, no input/output schemas, improvisation missing impulse tracking |
| metabob-cloud-dashboard | 4/5 | Missing execution detail with impulse flow, Thompson Sampling visibility |
| metabob-internal-dashboard | 4/8 | No activity templates, no trace recording, no Thompson Sampling |

**The core problem:** Each repository implements its own version of data fetching, execution, and learning. This creates:
- Duplicated logic (learning happens in both activity-api and analysis-api)
- Lost data (MCP executions are not traced)
- Rigid integration (adding new data sources requires code changes)
- No cross-repo learning (what MCP learns cannot help minibob)

**The solution:** Align all repositories to use impulses for data, activities for execution, and traces for learning. The backend becomes a pure trace store with query capabilities.

---

## What Changes

### Grouped Changes

Changes are grouped by theme, ordered by dependency:

#### Group 1: Impulse Metadata (Foundation)

Make impulse metadata mandatory and consistent across all repositories.

**Affected repos:** minibob, metabob-mcp, metabob-analysis-api

```typescript
// REQUIRED metadata fields (no longer optional)
interface ImpulseMetadata {
  shape: string           // semantic type (e.g., "error_log", "source_code")
  producedBy?: string     // lineage - what created this
  summary?: string        // human/LLM readable description
  rowCount?: number       // for collections
  columns?: string[]      // for tabular data
}
```

**Changes:**
- minibob: Make `metadata.shape` required on all impulses
- metabob-mcp: Add impulse abstraction layer wrapping all data
- metabob-analysis-api: Return impulses instead of raw objects

#### Group 2: Input/Output Schemas (Activity Matching)

Enable automatic activity matching based on input impulse shapes.

**Affected repos:** minibob, metabob-activity-api

```typescript
interface Activity {
  // NEW: Schema for automatic matching
  inputSchema: {
    required: ImpulseShape[]   // must have these shapes
    optional?: ImpulseShape[]  // may have these shapes
  }
  outputSchema: {
    produces: ImpulseShape[]   // will create these shapes
  }
}
```

**Changes:**
- minibob: Parse inputSchema/outputSchema in activity templates
- minibob: Match activities by input impulse shapes before Thompson Sampling
- metabob-activity-api: Store and query by schemas

#### Group 3: Trace Recording (Universal)

Every execution must be traced, regardless of source.

**Affected repos:** metabob-mcp, metabob-internal-dashboard

**Changes:**
- metabob-mcp: Wrap all operations in trace recording
  - Input: User request as impulse
  - Steps: Each tool call recorded
  - Output: Result as impulse
  - Send to backend: `POST /v2/traces`
- metabob-internal-dashboard: Record queries and UI operations as traces
  - Input: Natural language query as impulse
  - Steps: MiniBob tool calls
  - Output: UI components as impulses

#### Group 4: Activity Wrapping (MCP + Dashboard)

Convert imperative operations to activity-based execution.

**Affected repos:** metabob-mcp, metabob-internal-dashboard

**Changes:**
- metabob-mcp: Create activity templates for common operations
  - `mcp-analyze-code`: Wrapper for code analysis
  - `mcp-generate-fix`: Wrapper for fix generation
  - `mcp-explain-issue`: Wrapper for explanations
- metabob-internal-dashboard: Create activity templates for queries
  - `dashboard-explore-data`: Generic data exploration
  - `dashboard-system-health`: Health check queries
- Both: Use Thompson Sampling for variant selection
- Both: Ribosome extraction for successful improvisations

#### Group 5: Backend Consolidation (API Simplification)

Collapse ~20 single-use endpoints into the query system.

**Affected repos:** metabob-activity-api

**Current state:** Separate endpoints for:
- `/v2/activities/execution-traces`
- `/v2/activities/composition`
- `/v2/activities/tool-usage`
- `/v2/activities/impulse-relevance`
- `/v2/activities/execution-sequences`
- ... (15+ more)

**Target state:**
```
POST /v2/traces              # Store any trace
POST /v2/traces/query        # Resolve any pointer type
POST /v2/activities/recommend # Thompson-sampled recommendations
```

**Changes:**
- metabob-activity-api: Convert endpoints to pointer types
  - `{ type: "executionTrace", traceId: "..." }` -> replaces GET endpoint
  - `{ type: "compositionGraph", limit: N }` -> replaces composition endpoint
  - `{ type: "toolUsagePatterns", activityId: "..." }` -> replaces tool-usage endpoint
- metabob-activity-api: Remove proxy to analysis-api (vessel responsibility)
- Vessels: Use `/v2/traces/query` with pointer types

#### Group 6: Improvisation Tracking (Learning Completeness)

Track which impulses were loaded during improvisation for ribosome extraction.

**Affected repos:** minibob

**Changes:**
- minibob: Record `impulses_loaded` in improvisation traces
- minibob: Pass impulse history to ribosome for inputSchema inference
- minibob: Track impulse relevance during improvisation (loaded vs not-loaded correlation with success)

#### Group 7: Learning Visibility (Dashboards)

Surface learning state in user interfaces.

**Affected repos:** metabob-cloud-dashboard, metabob-internal-dashboard

**Changes:**
- metabob-cloud-dashboard:
  - Add Thompson Sampling scores to template list
  - Add execution trace detail view with impulse flow
  - Add template evolution timeline (variant creation history)
- metabob-internal-dashboard:
  - Add activity template browser
  - Add trace recording for all queries
  - Show Thompson Sampling in activity selection

---

## Milestones

### Milestone 1: Trace Recording Everywhere

**Goal:** All execution paths record traces to the backend.

**Scope:**
- Group 3: Trace Recording (metabob-mcp, internal-dashboard)
- Dependency: None

**Definition of Working:**
1. metabob-mcp: Every tool call appears in `/v2/traces` within 1s
2. internal-dashboard: Every query appears in `/v2/traces` within 1s
3. Backend: Can query recent traces from any source
4. Test: Execute same goal via MCP and minibob, both traces visible

**Acceptance Criteria:**
```bash
# MCP trace recorded
curl -X POST $MCP_URL/tools/analyze -d '{"code": "..."}'
curl $ACTIVITY_API/v2/traces?source=mcp | jq '.[0].source' # "mcp"

# Dashboard trace recorded
# (submit query via UI)
curl $ACTIVITY_API/v2/traces?source=dashboard | jq '.[0].source' # "dashboard"
```

### Milestone 2: Impulse Metadata Standard

**Goal:** All data exchanges use impulse format with required metadata.

**Scope:**
- Group 1: Impulse Metadata (minibob, metabob-mcp, analysis-api)
- Dependency: Milestone 1

**Definition of Working:**
1. minibob: All impulses have `metadata.shape`
2. metabob-mcp: All responses wrapped as impulses
3. metabob-analysis-api: All responses wrapped as impulses
4. Test: Query any data source, response includes shape metadata

**Acceptance Criteria:**
```typescript
// Every impulse has shape
const impulse = await loadImpulse(pointer);
assert(impulse.metadata.shape !== undefined);
assert(typeof impulse.metadata.shape === 'string');
```

### Milestone 3: Activity Matching by Schema

**Goal:** Activities are selected by matching input impulse shapes, then ranked by Thompson Sampling.

**Scope:**
- Group 2: Input/Output Schemas (minibob, activity-api)
- Dependency: Milestone 2

**Definition of Working:**
1. minibob: Activities have inputSchema/outputSchema
2. minibob: Given impulses, filter activities by schema match
3. metabob-activity-api: Query activities by required shapes
4. Test: Submit goal with specific impulse shapes, only matching activities considered

**Acceptance Criteria:**
```bash
# Activity with inputSchema
curl $ACTIVITY_API/v2/activities/templates | jq '.[0].inputSchema'
# { "required": [{"shape": "error_log"}, {"shape": "source_code"}] }

# Query by shape
curl "$ACTIVITY_API/v2/activities/recommend?shapes=error_log,source_code" | jq
# Returns only activities whose inputSchema.required is subset of provided shapes
```

### Milestone 4: Backend Consolidation

**Goal:** Single query endpoint replaces multiple specialized endpoints.

**Scope:**
- Group 5: Backend Consolidation (activity-api)
- Dependency: Milestone 1

**Definition of Working:**
1. metabob-activity-api: `/v2/traces/query` accepts all pointer types
2. Old endpoints deprecated (still work, log warning)
3. Test: All existing queries work via `/v2/traces/query`

**Acceptance Criteria:**
```bash
# Old way (deprecated)
curl $ACTIVITY_API/v2/activities/execution-traces?id=123

# New way
curl -X POST $ACTIVITY_API/v2/traces/query \
  -d '{"type": "executionTrace", "traceId": "123"}'

# Both return same data
```

### Milestone 5: Activity Wrapping

**Goal:** MCP and internal dashboard use activities for execution.

**Scope:**
- Group 4: Activity Wrapping (mcp, internal-dashboard)
- Dependency: Milestone 3

**Definition of Working:**
1. metabob-mcp: Common operations use activity templates
2. internal-dashboard: Queries use activity templates
3. Thompson Sampling applied to variant selection
4. Test: Same query executed multiple times, different variants selected based on sampling

**Acceptance Criteria:**
```bash
# MCP uses activities
curl $ACTIVITY_API/v2/traces?source=mcp | jq '.[0].activity_id'
# "mcp-analyze-code" (not null)

# Thompson Sampling active
curl $ACTIVITY_API/v2/activities/templates?name=mcp-analyze-code | jq '.[].thompson'
# { "alpha": N, "beta": M }
```

### Milestone 6: Improvisation with Impulse Tracking

**Goal:** Improvisation records which impulses were loaded for ribosome extraction.

**Scope:**
- Group 6: Improvisation Tracking (minibob)
- Dependency: Milestone 2

**Definition of Working:**
1. minibob: Improvisation traces include `impulses_loaded`
2. minibob: Ribosome infers inputSchema from loaded impulses
3. Test: Improvise, extract template, template has inputSchema

**Acceptance Criteria:**
```typescript
// Improvisation trace
const trace = await executeImprovisation(goal, impulses);
assert(trace.improvisation.impulses_loaded.length > 0);

// Ribosome extraction
const template = await ribosome.extract(trace);
assert(template.inputSchema.required.length > 0);
```

### Milestone 7: Learning Visibility

**Goal:** Dashboards show learning state and evolution.

**Scope:**
- Group 7: Learning Visibility (cloud-dashboard, internal-dashboard)
- Dependency: Milestone 5

**Definition of Working:**
1. cloud-dashboard: Thompson scores visible on templates
2. cloud-dashboard: Execution trace detail shows impulse flow
3. internal-dashboard: Activity template browser functional
4. Test: Execute activity, observe Thompson score update in UI

**Acceptance Criteria:**
- Screenshot: Template list with Thompson Sampling columns
- Screenshot: Execution trace with impulse flow diagram
- Video: Execute activity, watch Thompson score change

---

## Dependencies

```
                    +-----------------------+
                    | M1: Trace Recording   |
                    +-----------+-----------+
                                |
              +-----------------+------------------+
              |                                    |
              v                                    v
+-------------+-----------+         +--------------+------------+
| M2: Impulse Metadata    |         | M4: Backend Consolidation |
+-------------+-----------+         +---------------------------+
              |
              v
+-------------+-----------+
| M3: Activity Schemas    |
+-------------+-----------+
              |
    +---------+---------+
    |                   |
    v                   v
+---+---+         +-----+-----+
| M5:   |         | M6:       |
| Wrap  |         | Improv    |
+---+---+         +-----------+
    |
    v
+---+---+
| M7:   |
| UI    |
+-------+
```

**Critical path:** M1 -> M2 -> M3 -> M5 -> M7

**Parallel work:**
- M4 (Backend Consolidation) can proceed in parallel with M2/M3
- M6 (Improvisation Tracking) can proceed after M2

---

## Impact

### Code Changes by Repository

**metabob-mcp:**
- Add trace recording wrapper (~200 LOC)
- Add impulse abstraction layer (~150 LOC)
- Create activity templates (5-10 templates, ~500 LOC)
- Integrate Thompson Sampling selection (~100 LOC)

**metabob-activity-api:**
- Add `/v2/traces/query` unified endpoint (~300 LOC)
- Deprecate old endpoints (add warnings)
- Add inputSchema/outputSchema to activity_template table
- Add schema-based activity matching query

**metabob-analysis-api:**
- Wrap responses as impulses (~100 LOC)
- No structural changes (analysis is a resolver, not activity)

**minibob:**
- Make metadata.shape required (~50 LOC)
- Add inputSchema/outputSchema parsing (~100 LOC)
- Add schema-based activity filtering (~150 LOC)
- Add impulse tracking to improvisation (~100 LOC)
- Pass impulse history to ribosome (~50 LOC)

**metabob-cloud-dashboard:**
- Add Thompson Sampling columns to template list (~100 LOC)
- Add execution trace detail view (~300 LOC)
- Add template evolution timeline (~200 LOC)

**metabob-internal-dashboard:**
- Add trace recording to queries (~150 LOC)
- Add activity template browser (~300 LOC)
- Add Thompson Sampling visibility (~100 LOC)

### Database Changes

**activity_template table:**
```sql
ALTER TABLE activity_template ADD input_schema OBJECT;
ALTER TABLE activity_template ADD output_schema OBJECT;
```

**execution_trace table:**
```sql
-- Already exists, ensure fields:
-- input_impulses, output_impulses, tasks, state_transition
-- Add if missing:
ALTER TABLE execution_trace ADD impulses_loaded ARRAY;
```

### API Changes

**New endpoint:**
```
POST /v2/traces/query
  Body: { type: string, ...params }
  Returns: Resolved impulse content
```

**Deprecated endpoints:** (still functional, emit warning)
- `GET /v2/activities/execution-traces/:id`
- `GET /v2/activities/composition/graph`
- `GET /v2/activities/tool-usage`
- `GET /v2/activities/impulse-relevance`
- `GET /v2/activities/execution-sequences`

---

## Risks

### Technical Risks

1. **Migration complexity:** Existing traces may lack required metadata
   - Mitigation: Backfill shape from heuristics, mark as `shape: "legacy"`

2. **Performance regression:** Unified query may be slower than specialized
   - Mitigation: Add query type hints, optimize hot paths

3. **Breaking changes:** Clients depend on deprecated endpoints
   - Mitigation: 6-month deprecation window, warnings before removal

### Process Risks

1. **Scope creep:** Each milestone reveals more needed changes
   - Mitigation: Strictly scope each milestone, defer discoveries to new proposals

2. **Coordination:** Changes span 6 repositories
   - Mitigation: Explicit dependency ordering, milestone gates

---

## Success Criteria

**Overall success:** A trace from any source (MCP, minibob, dashboard) can be used to:
1. Recommend activities for similar goals (Thompson Sampling)
2. Determine which impulses are relevant (relevance learning)
3. Extract new activity templates (ribosome)

**Quantitative metrics:**
- 100% of executions traced (up from ~60% currently)
- All impulses have metadata.shape (up from ~30% currently)
- Activity matching by schema reduces search space by >50%
- Single query endpoint handles >80% of data access

---

## Timeline Estimate

| Milestone | Effort | Dependencies | Calendar Time |
|-----------|--------|--------------|---------------|
| M1: Trace Recording | 3 days | None | Week 1 |
| M2: Impulse Metadata | 2 days | M1 | Week 1-2 |
| M3: Activity Schemas | 3 days | M2 | Week 2 |
| M4: Backend Consolidation | 4 days | M1 | Week 1-2 (parallel) |
| M5: Activity Wrapping | 4 days | M3 | Week 3 |
| M6: Improvisation Tracking | 2 days | M2 | Week 2 (parallel) |
| M7: Learning Visibility | 3 days | M5 | Week 4 |

**Total:** ~3-4 weeks with parallelization

---

## References

- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Canonical foundation document
- `docs/architecture/ONTOLOGY_OF_BECOMING.md` - Three-state model
- `RIBOSOME_ARCHITECTURE.md` - Activity extraction from traces
- `UNIFIED_IMPULSE_DRIVEN_ARCHITECTURE.md` - Impulse system details
