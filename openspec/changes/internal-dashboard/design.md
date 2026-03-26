## Context

**Current State:**
- `repos/metabob-cloud-dashboard` is a conventional React dashboard for external stakeholders
- MiniBob has understanding capabilities (CodeExplorer, ApplicationAnalyzer) but no UI control
- The impulse system manages context pointers but not visual elements
- Internal system observability requires manual kubectl/curl commands

**Constraints:**
- Must integrate with existing MiniBob architecture (not fork)
- Must use existing impulse primitives where possible
- Must deploy alongside other activity-system services
- Must support both local (internal.metabob.local) and cloud (internal.metabob.com) deployments

**Stakeholders:**
- Internal team: Primary users for system exploration
- MiniBob: Backend that processes queries and controls UI

## Goals / Non-Goals

**Goals:**
- Natural language interface to explore system state
- UI components controlled entirely by MiniBob through impulse operations
- Real-time streaming of responses as MiniBob executes
- Query deployment state, data, services, composition graphs
- Minimal UI chrome - just input and MiniBob-rendered content

**Non-Goals:**
- Not a replacement for customer-facing dashboard
- Not implementing fixed dashboards/views (that's what cloud-dashboard does)
- Not exposing to external users (internal only)
- Not building a general-purpose chat UI (focused on system exploration)

## Decisions

### Decision 1: UI Components as Proper Impulse Pointer Type with Metadata

**Choice:** Treat `ui_component` as a proper impulse pointer type following impulse-pointer-mvp patterns. UI impulses reference data impulses via `dataRef` rather than embedding raw data. The dashboard acts as a "visual resolver" for this pointer type.

**Alternatives Considered:**
- React state management (Redux/Zustand): Standard but doesn't leverage impulse architecture
- Embedded data in UI impulses: Simpler but LLM can't reason about data without seeing it all
- iframe embedding: Too isolated, can't share state

**Rationale:**
- Aligns with impulse-pointer-mvp: metadata enables LLM reasoning without loading content
- dataRef pattern separates visual concerns from data concerns
- Dashboard as resolver fits naturally into resolver registry concept
- LLM sees `<impulse_ref>` tags showing what's displayed, not raw pixels or data
- Enables Thompson Sampling for query patterns (which visualizations work best)

**Implementation:**
```typescript
// UI component pointer type
interface UIComponentPointer {
  type: 'ui_component';
  componentType: 'table' | 'graph' | 'json' | 'narrative' | 'action' | 'input' | 'system_health';
  position: { x: number; y: number } | 'center' | 'below-input';
  size: { width: string; height: string } | 'auto';
  dataRef?: string;         // Reference to data impulse (preferred)
  data?: unknown;           // Embedded data (backward compatible)
  props?: Record<string, unknown>;
}

// UI impulse with metadata (follows impulse-pointer-mvp)
interface UIComponentImpulse extends Impulse {
  pointer: UIComponentPointer;
  metadata: {
    componentType: string;         // Visual component type
    position: string;              // Current position
    dataShape: string;             // Shape of data: "array[12]", "graph(5,8)"
    summary: string;               // Human-readable: "Activity executions from last hour"
    dataRefId?: string;            // ID of referenced data impulse
  };
}

// Dashboard renders as: <impulse_ref id="table-001" type="ui_component"
//   component_type="table" data_shape="array[12]"
//   summary="Activity executions from last hour" />
```

**Dashboard as Visual Resolver:**
```
Traditional resolver: pointer → resolve → string content
Visual resolver:      pointer → resolve → React component mounted (visual side-effect)
                      pointer → format  → metadata as <impulse_ref> for LLM context
```

### Decision 2: WebSocket for Real-Time UI Updates

**Choice:** WebSocket connection from dashboard to MiniBob for bidirectional streaming.

**Alternatives Considered:**
- HTTP polling: High latency, poor UX for streaming responses
- Server-Sent Events: One-way only, can't send user input efficiently
- HTTP long-polling: Complex, still has latency issues

**Rationale:**
- MiniBob can push UI updates as it executes
- User queries stream to MiniBob immediately
- Supports partial response rendering (table rows appearing incrementally)
- Fits activity execution model (task completion triggers UI update)

**Protocol:**
```typescript
// Client → MiniBob
{ type: 'query', text: 'Show failed activities' }
{ type: 'action', componentId: 'xxx', action: 'retry' }

// MiniBob → Client
{ type: 'impulse_create', impulse: UIComponentImpulse }
{ type: 'impulse_update', id: string, changes: Partial<UIComponentImpulse> }
{ type: 'impulse_delete', id: string }
{ type: 'thinking', text: 'Querying activity-api...' }
```

### Decision 3: Persistent Query Input

**Choice:** The text input is a special impulse that MiniBob cannot delete (only the user can clear it).

**Alternatives Considered:**
- Fixed React component outside impulse system: Breaks conceptual purity
- MiniBob-deletable input: Could accidentally remove user's ability to interact
- Modal input that appears on demand: Extra friction for rapid queries

**Rationale:**
- Conceptually consistent: Input is an impulse with `deletable: false`
- MiniBob can reposition it but not remove it
- Clear separation: User owns input, MiniBob owns response area

### Decision 4: Component Type Selection by MiniBob

**Choice:** MiniBob decides which component type to render based on data shape and query intent.

**Alternatives Considered:**
- User selects visualization: More control but slower workflow
- Fixed mappings (arrays → tables): Inflexible, misses context
- Ask user each time: Interrupts flow

**Rationale:**
- MiniBob has query context (user asked "show" vs "explain")
- MiniBob knows data shape (array vs object vs scalar)
- MiniBob can adapt: "Show as graph" re-renders same data
- Activity templates can encode visualization preferences

**Component Selection Heuristics:**
- Array of objects → Table
- Nested objects with relationships → Graph
- Single value/explanation → Narrative
- Raw data inspection → JSON
- Actionable item → Action button

### Decision 5: System Introspection via New MiniBob Tools (Including Observation Hierarchy)

**Choice:** Add new tools to MiniBob for querying system state including observation-hierarchy metrics, circuit breaker state, and multi-scale patterns.

**Alternatives Considered:**
- Dashboard queries APIs directly: Bypasses MiniBob, loses natural language
- MCP server for system state: Another service to maintain
- Generic HTTP tool: Too low-level, no semantic understanding

**Rationale:**
- MiniBob already has tool infrastructure
- Tools provide semantic boundaries (query_kubernetes vs query_metrics)
- Tools can be permissioned (internal dashboard gets more tools than external)
- Activity templates can compose tools for complex queries
- Observation-hierarchy integration enables system self-awareness

**New Tools:**
```typescript
// Kubernetes introspection
query_kubernetes({ resource: 'pods', namespace: 'activity-system', selector?: string })

// SurrealDB queries (uses authenticated connection)
query_surrealdb({ query: string, params?: Record<string, unknown> })

// Service health
check_service_health({ services: ['activity-api', 'analysis-api', 'surrealdb'] })

// Observation hierarchy metrics (from observation-hierarchy-foundation)
query_system_health({ window: '1h' | '24h' | '7d' })
// Returns: { overallSuccessRate, templateCreationRate, averageCost, uniqueTemplatesUsed, failureCorrelation, status }

query_tool_patterns({ window: '7d', minFrequency?: number })
// Returns: [{ toolSequence, frequency, successRate }]

query_composition_patterns({ window: '7d' })
// Returns: [{ chain: ['A', 'B', 'C'], frequency, successRate, avgCost }]

query_peer_anomalies({ entityType?: 'resolver' | 'template' })
// Returns: [{ entityId, metric, deviation, peerGroup }]

// Circuit breaker control
get_circuit_breaker_state()
// Returns: { status: 'active' | 'paused', reason?, timestamp, triggeredBy? }

set_circuit_breaker({ action: 'pause' | 'resume', reason?: string })
// Requires authorization

// UI component manipulation (creates dataRef impulses automatically)
create_ui_component({ type, position, size, dataRef?: string, data?: unknown, props })
update_ui_component({ id, changes })
delete_ui_component({ id })
clear_ui_components({ except?: string[] }) // Keep input
```

**Observation Hierarchy Data Flow:**
```
User: "Is the system healthy?"
  ↓
MiniBob calls: query_system_health({ window: '24h' })
  ↓
Backend queries: GET /v2/metrics/system-health?window=24h
  ↓
MiniBob calls: create_ui_component({
  type: 'system_health',
  dataRef: 'health-data-001',  // impulse containing the health data
  position: 'below-input'
})
  ↓
Dashboard resolves dataRef, renders system_health component
  ↓
LLM context shows: <impulse_ref id="health-001" type="ui_component"
                    component_type="system_health"
                    summary="24h health: 78% success, active" />
```

### Decision 6: Integration with Observation Hierarchy Foundation

**Choice:** The internal dashboard provides the primary interface for visualizing observation-hierarchy data: system health, circuit breaker state, multi-scale patterns, and peer anomalies.

**Rationale:**
- Observation-hierarchy-foundation defines the data (metrics, thresholds, anomaly flags)
- Internal dashboard provides the exploration interface
- MiniBob connects them: queries observation APIs, creates appropriate visualizations
- This completes the observation loop: data accumulates → metrics computed → visualized → humans (layer 5+) observe and intervene

**Integration Points:**

| Observation Layer | Data Source | Dashboard Visualization |
|------------------|-------------|------------------------|
| Layer 0: Tool calls | Execution traces | Tool patterns table |
| Layer 1: Task patterns | Task aggregates | Sequence frequency graph |
| Layer 2: Activity outcomes | Thompson scores | Template performance table |
| Layer 3: Composition | Goal chains | Composition graph |
| Layer 4: System health | Health aggregates | System health component |
| Layer 5+: Human | Dashboard | Natural language queries |

**Circuit Breaker Visibility:**
```
Dashboard shows:
┌─────────────────────────────────────────┐
│ System Health (24h)                     │
│ ─────────────────                       │
│ Success Rate:  ████████░░  78%          │
│ Templates:     142 active, 12 pruned    │
│ Anomalies:     2 flagged                │
│                                         │
│ [🟢 ACTIVE] Boredom System              │
│             Last pause: 3 days ago      │
└─────────────────────────────────────────┘
```

When paused:
```
│ [🔴 PAUSED] Boredom System              │
│             Reason: Low success rate    │
│             Since: 2h ago               │
│             [Resume] button             │
```

### Decision 7: MiniBob as In-Process Library (Not Sidecar)

**Choice:** Embed MiniBob as a library within the dashboard server process, not as a separate sidecar container or external service.

**Alternatives Considered:**
- Dedicated MiniBob deployment: Another service to maintain, network latency for WebSocket
- Sidecar container: Coupled lifecycle but inter-container communication overhead
- External MiniBob cluster: Requires routing, session affinity, more complex

**Rationale:**
- Zero network latency for WebSocket messages (same process)
- Direct callback integration for streaming (no serialization boundary)
- Single deployment unit simplifies operations
- Can customize MiniBob capabilities (no boredom, no file writes, query-only)
- Shares codebase with cluster MiniBob via library import

**Implementation:**
```typescript
// internal-dashboard/src/minibob-instance.ts
import { MiniBob } from '@metabob/minibob'

const minibob = new MiniBob({
  auth: { scope: 'system', credentials: process.env.INTERNAL_DASHBOARD_SECRET },
  capabilities: ['query', 'ui_control'],  // No boredom, no file writes
  mcpEndpoint: process.env.ACTIVITY_API_URL,
  onThinking: (msg) => broadcast({ type: 'thinking', text: msg }),
  onToolCall: (tool, status) => broadcast({ type: 'tool_call', tool, status }),
  onImpulseChange: (change) => broadcast(change)
})
```

### Decision 8: System-Scope Authentication for Cross-Org Access

**Choice:** Create a dedicated `system` scope in SurrealDB authentication that grants read access across all organizations, used exclusively by the internal dashboard.

**Alternatives Considered:**
- No cross-org access: Dashboard would be limited to single org, defeating purpose
- Super-admin user: Mixing user auth with system auth, harder to audit
- Separate read replica: Complex infrastructure, data freshness issues

**Rationale:**
- Internal dashboard needs to see all orgs, all executions, all templates
- System scope is clearly distinguishable from user auth in audit logs
- Read-only by default, explicit permission for circuit breaker control
- Credentials stored in Kubernetes secret, not user-accessible

**Implementation:**
```surql
-- SurrealDB access definition
DEFINE ACCESS internal_system ON DATABASE TYPE RECORD
  SIGNIN (
    SELECT * FROM internal_dashboard_credentials
    WHERE id = $credential_id
    AND crypto::argon2::compare(secret_hash, $secret)
  )
  WITH JWT ALGORITHM HS512 KEY $secret_key
  AUTHENTICATE {
    RETURN { scope: 'system', role: 'observer', capabilities: ['read:all', 'write:circuit_breaker'] }
  }
  DURATION FOR TOKEN 1h, FOR SESSION 24h;

-- Modified PERMISSIONS (all tables)
DEFINE TABLE activity_executions PERMISSIONS
  FOR select WHERE org_id = $auth.org_id OR $auth.scope = 'system'
  FOR create, update, delete WHERE org_id = $auth.org_id AND $auth.role = 'admin'
```

### Decision 9: Unbounded Rendering via Composable Primitives

**Choice:** The UI provides low-level rendering primitives (container, text, chart, table, graph, input, button) that MiniBob composes arbitrarily. There are no predefined "component types" - MiniBob describes exactly what to render.

**Alternatives Considered:**
- Predefined component library: Faster to implement but limits MiniBob to anticipated visualizations
- Template-driven rendering: Templates define visualization, but can't handle novel requests
- Query pattern matching: Frontend decides visualization based on keywords, bypasses MiniBob

**Rationale:**
- MiniBob can create ANY visualization it can describe, not just predefined ones
- Novel queries ("show as violin plot", "compare A vs B side by side") don't fail
- Frontend is completely prompt-agnostic - it renders whatever MiniBob sends
- Improvisation is first-class, not a fallback when templates don't match
- System can gain new capabilities without frontend code changes

**Key Primitives:**
```typescript
container   // Layout wrapper (grid, vertical, horizontal, absolute)
text        // Plain, markdown, or code with variants
data-table  // Any columns, any data, sortable/paginated
chart       // bar, line, pie, scatter, area, gauge, sparkline
graph       // nodes/edges with layout options
input       // text, number, date, select, checkbox
button      // Action trigger with optional confirmation
badge       // Status indicator
progress    // Bar, circle, or gauge
code        // Syntax-highlighted with line numbers
image       // Base64 or URL
```

**Example - Novel Dashboard Not Predefined Anywhere:**
```typescript
create_ui_component({
  component: {
    type: 'container',
    layout: 'grid',
    columns: 3,
    children: [
      { type: 'chart', chartType: 'gauge', data: [{ value: 0.73 }] },
      { type: 'chart', chartType: 'sparkline', data: [...] },
      { type: 'data-table', columns: [...], data: [...] }
    ]
  }
})
```

### Decision 10: Query Processing via Goal Processor with Improvisation

**Choice:** All user queries go through MiniBob's goal processor, which either finds a matching template via Thompson Sampling or improvises. Successful improvisations are extracted into templates via Ribosome.

**Alternatives Considered:**
- Pre-defined templates only: Limited to anticipated queries, can't handle novel questions
- Pure improvisation: No learning, expensive, inconsistent results
- Keyword matching: Too rigid, misses intent variations

**Rationale:**
- Thompson Sampling learns which query patterns work best
- Improvisation handles novel queries without manual template creation
- Ribosome automatically captures successful patterns as templates
- Over time, system becomes more efficient (less improvisation, more template hits)
- Aligns with core MiniBob architecture (no special-casing for dashboard)

**Learning Loop:**
```
Query → Thompson Sampling → [Template Found] → Execute → Record Success/Failure
                         ↘ [No Match] → Improvise → [Success] → Ribosome → New Template
                                                  ↘ [Failure] → Log, No Template
```

## Risks / Trade-offs

**Risk: MiniBob rate limiting / cost**
→ Mitigation: Internal dashboard uses same org's API key with internal rate limits. Add query caching for repeated introspection queries.

**Risk: WebSocket connection stability**
→ Mitigation: Implement reconnection with exponential backoff. Show connection status in UI. Queue messages during disconnect.

**Risk: UI state desync between MiniBob and frontend**
→ Mitigation: Frontend is source of truth for rendered state. MiniBob sends full impulse state on reconnect. Use impulse IDs for deterministic updates.

**Risk: Kubernetes API access from MiniBob pod**
→ Mitigation: Use ServiceAccount with limited RBAC (read-only for pods/services in activity-system namespace). Fall back gracefully if access denied.

**Risk: Overwhelming UI with too many components**
→ Mitigation: MiniBob has `clear_ui_components` tool. Activity templates include cleanup. Reasonable defaults for component limits.

**Trade-off: Simplicity vs Flexibility**
- Chose impulse-based UI over traditional React state
- More conceptually elegant but requires new patterns
- Team must learn impulse lifecycle for UI debugging

**Trade-off: MiniBob Control vs User Control**
- MiniBob decides visualization, user can override with follow-up
- Faster default experience, but less direct manipulation
- Acceptable for internal exploration tool
