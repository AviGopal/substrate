# Connection Slots and LLM Proxy: Requirements Specification

## Core Philosophy

> "We are only begrudgingly asking for payment. Our main goal is to collect traces and improve."

This specification reflects a **learning-first** approach where:
1. Trace richness is paramount
2. Execution completion is prioritized over enforcement
3. LLM costs are an investment in learning, not an expense
4. The system should get cheaper over time as it learns

## Connection Slot Requirements

### CS-1: API Key as Billing Entity

**Requirement**: API keys define the billing relationship and connection limits.

| Field | Type | Constraints |
|-------|------|-------------|
| `org_id` | record | Required, links to organization |
| `name` | string | Required, human-readable identifier |
| `max_connections` | int | 1-100, default 1 |
| `tier` | enum | starter, pro, enterprise |
| `llm_budget` | object | Monthly token allocation |

**Rationale**: Customers pay per connection slot, not per API call. This provides predictable costs while allowing heavy usage within their tier.

### CS-2: Connection as Active Session

**Requirement**: Each active session occupies one connection slot.

| Field | Type | Purpose |
|-------|------|---------|
| `session_token` | string | Unique identifier for reconnection |
| `status` | enum | active, grace, disconnected |
| `last_heartbeat` | datetime | Track liveness |
| `current_execution` | record | Link to in-flight activity |
| `grace_until` | datetime | When slot will be freed |

**Rationale**: Connections represent active usage. Grace periods protect in-flight work.

### CS-3: Heartbeat Cadence

**Requirement**: Connections must heartbeat every 30 seconds.

- **Heartbeat interval**: 30 seconds
- **Missed heartbeat detection**: 10 second polling
- **Grace entry**: First missed heartbeat

**Rationale**: 30 seconds balances overhead with responsiveness. Fast enough to detect issues, slow enough to not burden the network.

### CS-4: Grace Period Calculation

**Requirement**: Grace periods MUST allow in-flight executions to complete.

```
if (no_current_execution):
    grace_period = 2 minutes
else:
    remaining = estimated_duration - elapsed_time
    grace_period = min(remaining + 5 minutes, 30 minutes)
```

**Constraints**:
- Minimum grace: 2 minutes (idle)
- Maximum grace: 30 minutes (hard cap for security)
- Execution-aware: Use activity's expected duration

**Rationale**: We want the trace more than we want to enforce limits. Let them finish. But don't wait forever (security).

### CS-5: FIFO Slot Acquisition

**Requirement**: Slot acquisition MUST be FIFO with no slot stealing.

- If `active_connections >= max_connections`: Return 429
- No mechanism to force-disconnect existing connections
- Oldest connection wins in race conditions

**Rationale**: Predictable, fair behavior. Users can rely on their slot not being stolen.

### CS-6: Reconnection Within Grace

**Requirement**: Connections MAY reconnect within their grace period.

- Session token remains valid during grace
- Reconnection restores `active` status
- Current execution state is preserved
- New JWT issued on reconnect

**Rationale**: Network hiccups shouldn't lose work. Reconnection is the happy path.

### CS-7: Orphaned Execution Handling

**Requirement**: If grace expires with active execution, mark trace as `orphaned`.

```typescript
{
  outcome: {
    status: "orphaned",
    error: "Connection lost during execution"
  }
}
```

**Rationale**: Partial traces are still valuable for learning. Don't discard them.

## LLM Proxy Requirements

### LP-1: Tiered Resolution

**Requirement**: Resolve impulses through tiered system, cheapest first.

| Tier | Resolver | Cost | When to Use |
|------|----------|------|-------------|
| 1 | Pattern match | $0 | Exact match, >90% success, >10 executions |
| 2 | Interpolation | $0 | Similar match, >85% success, >5 executions |
| 3 | Haiku | $ | <4K tokens, depth <3 |
| 4 | Sonnet | $$ | <100K tokens, depth <5 |
| 5 | Opus | $$$ | Complex/novel/high-stakes |

**Rationale**: Minimize LLM costs by using learned patterns first.

### LP-2: Rich Trace Capture

**Requirement**: ALL LLM calls MUST capture full trace data.

Required fields for LLM resolutions:
- Complete prompt (system, context, user)
- Complete response (content, thinking if available)
- Token counts (input, output)
- Latency (ms)
- Model used
- Stop reason
- Cost (USD)

**Rationale**: This is the whole point. Without rich traces, we can't learn.

### LP-3: Pattern Extraction Triggers

**Requirement**: Extract patterns after consistent successful resolutions.

Triggers:
- Same `impulse_hash` appears 5+ times
- Success rate >85%
- Result consistency >85%

**Rationale**: Convert expensive LLM calls into free pattern matches.

### LP-4: Token Budget Enforcement

**Requirement**: Enforce monthly token budget per API key.

- Pattern matches (Tier 1-2): Always allowed, cost $0
- LLM calls (Tier 3-5): Require budget
- Budget exceeded → 402 error for LLM, patterns still work

**Rationale**: Predictable costs for users. Pattern matches as safety net.

### LP-5: Model Selection Transparency

**Requirement**: Always report which resolver/model was used.

Response must include:
- `resolver_used`: tier name
- `confidence`: selection confidence
- `cost_usd`: actual cost
- `tokens_used`: input/output counts
- `pattern_id`: if pattern match

**Rationale**: Users understand what they're paying for. System is debuggable.

### LP-6: Budget Sync

**Requirement**: Redis for speed, SurrealDB for persistence.

- Redis: Real-time budget checking (fast path)
- SurrealDB: Authoritative budget state (sync every 5 minutes)
- Monthly reset: First of month, reset tokens_used to 0

**Rationale**: Fast budget checks without database load.

## metabob-mcp Requirements

### MCP-1: Unified Gateway

**Requirement**: metabob-mcp becomes the single integration point.

- Analysis tools (existing): 7 tools
- Activity tools (new): 4 tools
- All routed through connection slot system
- All LLM calls proxied through backend

**Rationale**: One key, one bill, full capabilities.

### MCP-2: No Direct LLM Key Required

**Requirement**: ANTHROPIC_API_KEY should NOT be required.

- METABOB_API_KEY is sufficient for full functionality
- LLM access provided via proxy
- Direct key optional for development/testing only

**Rationale**: Removes adoption friction. Users don't need separate LLM accounts.

### MCP-3: Connection Lifecycle Management

**Requirement**: MCP client manages connection lifecycle transparently.

- Auto-acquire slot on startup
- Heartbeat every 30 seconds
- Auto-reconnect within grace period
- Clean release on shutdown

**Rationale**: User doesn't think about connections. It just works.

### MCP-4: Execution State Tracking

**Requirement**: Report current execution in heartbeats.

When executing an activity:
```typescript
heartbeat({
  current_execution: {
    execution_id: "...",
    activity_id: "...",
    started_at: "...",
    estimated_duration_ms: 300000
  }
})
```

**Rationale**: Enables smart grace period calculation.

## Success Metrics

### Learning Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Pattern match rate | >50% after 30 days | System is learning |
| Avg resolution cost | <$0.005 after 90 days | Patterns replacing LLM |
| Trace completeness | >95% | Rich data for learning |
| Pattern extraction rate | >10/week | Ribosome is working |

### Operational Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Grace period completion | >90% | Executions finishing |
| Orphaned traces | <5% | Connections stable |
| Reconnection success | >95% | Grace periods working |
| Budget exhaustion | <10% of users | Tiers are right-sized |

## Non-Functional Requirements

### NFR-1: Latency

- Slot acquisition: <100ms
- Heartbeat: <50ms
- Pattern match resolution: <20ms
- LLM resolution: Anthropic latency + <100ms overhead

### NFR-2: Availability

- Connection service: 99.9%
- LLM proxy: 99.5% (dependent on Anthropic)
- Pattern store: 99.9%

### NFR-3: Security

- API keys hashed with argon2
- JWT tokens with 24h expiry
- Session tokens with cryptographic randomness
- Connection-scoped access (can't see other connections)

### NFR-4: Scalability

- 1000 concurrent connections per api_key (max tier)
- 10,000 API keys
- 100M resolutions/month
- 1M patterns
