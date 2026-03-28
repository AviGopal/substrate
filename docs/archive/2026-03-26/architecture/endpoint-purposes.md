# Backend API Endpoint Purposes

This document clarifies the purposes of different backend API endpoints to prevent confusion about data persistence responsibilities.

## Activity Persistence Endpoints

### `/v2/activities` - Instance-Invariant Storage

**Purpose:** Store complete activity data for cross-instance retrieval

**Specification:** Instance Invariant Storage for Impulses and Activities

**Use Case:** Enable any opencode or metabob-cli instance to access activity data with the same credentials

**Payload:**
- Full activity state (status, metrics, tasks, results)
- Activity ID, project ID, timestamps
- Complete execution context

**Data Flow:**
```
opencode → metabob_activity_save (MCP) → POST /v2/activities → SurrealDB (activity_data table)
```

**Retrieval:**
```
opencode → metabob_activity_load (MCP) → GET /v2/activities/{id} → SurrealDB → Cache locally
```

**Key Features:**
- Instance-invariant: Activity A created on instance 1 is accessible from instance 2
- Multi-tenant isolated: (api_key, project_id) scoping at all layers
- Cache fallback: Local cache first, backend fallback on miss
- Vessel flow compliant: All access through MCP layer

---

### `/api/v1/activity-execution/content` - Execution Learning Metadata

**Purpose:** Store execution metadata for learning loop and template improvement

**Specification:** Activity State Transformation Tracking

**Use Case:** Enable analysis of how activities transform instructional state into functional state

**Payload:**
- Template definition
- Variable bindings
- Initial state (git, files, impulses)
- Reason for execution
- Task sequence

**Data Flow:**
```
opencode → ActivityAPIClient.storeActivityContent() → POST /api/v1/activity-execution/content → SurrealDB (activity_execution table)
```

**Key Features:**
- Learning-focused: Captures execution metadata for template optimization
- State tracking: Before/after snapshots, file changes, impulse deltas
- Independent lifecycle: Persisted even if activity storage fails
- Non-blocking: Errors don't block activity execution

---

## Why Both Endpoints?

### Complementary, Not Duplicate

These endpoints serve **different purposes** and are **complementary**:

| Aspect | `/v2/activities` | `/api/v1/activity-execution` |
|--------|------------------|------------------------------|
| **Purpose** | Cross-instance access | Learning loop data |
| **Use Case** | Distributed debugging, activity upgrades | Template optimization, state analysis |
| **Payload** | Complete activity state | Execution metadata |
| **Retrieval** | Frequent (cache fallback) | Rare (analytics queries) |
| **Lifecycle** | Tied to activity | Independent |
| **Specification** | Instance Invariant Storage | Activity State Transformation Tracking |

### Design Rationale

1. **Separation of Concerns**
   - Instance-invariant storage is a **persistence concern**
   - Learning metadata is an **analytics concern**
   - Mixing these would create tight coupling

2. **Independent Evolution**
   - Storage format can change without affecting learning
   - Learning metadata can expand without affecting retrieval
   - Different retention policies (storage: long-term, learning: archive after analysis)

3. **Performance Optimization**
   - `/v2/activities` optimized for frequent retrieval
   - `/api/v1/activity-execution` optimized for batch analytics
   - Separate indexes, caching strategies, query patterns

4. **Graceful Degradation**
   - Activity storage failure doesn't affect learning metadata collection
   - Learning metadata failure doesn't affect activity retrieval
   - Non-blocking error handling at both layers

---

## Impulse Persistence Endpoints

### `/v2/impulses` - Instance-Invariant Storage

**Purpose:** Store impulse data for cross-instance retrieval

**Specification:** Instance Invariant Storage for Impulses and Activities

**Data Flow:**
```
opencode → metabob_impulse_store (MCP) → POST /v2/impulses → SurrealDB (impulse_data table)
```

**Key Features:**
- Instance-invariant: Impulse created on instance 1 is accessible from instance 2
- Multi-tenant isolated: (api_key, project_id) scoping
- Vessel flow compliant: All access through MCP layer

---

## Session Tracking Endpoints

### MCP Tools: `metabob_record_session_start`, `metabob_record_session_complete`

**Purpose:** Track session lifecycle for analytics and billing

**Specification:** Metabob Session Tracking

**Data Flow:**
```
opencode → Session.createNext() → MetabobTracking.recordSessionStart() → metabob_record_session_start (MCP) → Backend
opencode → Session.close() → MetabobTracking.recordSessionComplete() → metabob_record_session_complete (MCP) → Backend
```

**Key Features:**
- Fire-and-forget: Tracking errors don't block session operations
- Aggregated metrics: Tokens, cost, prompts, tools
- Session lifecycle: Start, complete, duration

---

## Best Practices

### When Adding New Endpoints

1. **Define Clear Purpose**
   - What domain does this endpoint serve?
   - Is it storage, analytics, or coordination?

2. **Check for Overlap**
   - Does an existing endpoint already serve this purpose?
   - If overlap exists, is separation justified?

3. **Document Rationale**
   - Update this document with the new endpoint
   - Explain why it's separate from existing endpoints

4. **Follow Architectural Patterns**
   - Vessel flow: opencode → MCP → rpc-api → DB
   - Multi-tenant isolation: (api_key, project_id) at all layers
   - Non-blocking: Errors don't cascade

### When in Doubt

**Ask:**
- Is this data needed for cross-instance access? → Use `/v2/activities` or `/v2/impulses`
- Is this data for learning/analytics? → Use `/api/v1/activity-execution`
- Is this tracking session lifecycle? → Use MCP session tracking tools

---

## Related Documentation

- [Instance Invariant Storage Specification](../../TRACE_Instance_Invariant_Storage.json)
- [Activity State Transformation Tracking](../../TRACE_ACTIVITY_STATE_TRANSFORMATION_TRACKING.json)
- [Conflict Analysis](../../CONFLICT_ANALYSIS_Instance_Invariant_Storage.json)
- [Validation Harness](../../tests/validation-harnesses/instance-invariant-storage-harness-v2.ts)

---

**Last Updated:** 2026-02-28  
**Maintained By:** Architecture Team  
**Questions?** See conflict analysis or trace documents for full technical details.
