# Connection Slots and LLM Proxy: Sustainable Learning Infrastructure

## Problem Statement

MiniBob and metabob-mcp need to call LLMs to execute activities, but there's no straightforward way to obtain API keys from host environments like Claude Code or Cursor. Meanwhile, we need to fund infrastructure while prioritizing **trace collection for learning** over revenue extraction.

### Current State

- **Authentication**: MiniBob uses instance_id + api_key to get JWT tokens (24h)
- **No connection limits**: Unlimited concurrent sessions per API key
- **No LLM access**: Clients must provide their own ANTHROPIC_API_KEY
- **Trace richness gap**: Without controlling LLM calls, we can't capture full execution details

### The Core Tension

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Goal: Collect rich traces for learning                           │
│   Problem: Can't get LLM keys from host environments               │
│   Compromise: "Guided mode" where outer agent runs prompts         │
│   Reality: Guided mode traces are shallow and useless              │
│                                                                     │
│   Therefore: We must proxy LLM calls through our backend           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Connection Slots?

We're "begrudgingly asking for payment" to sustain infrastructure. Connection slots provide:

1. **Fair resource allocation**: Pay per active connection, not per API call
2. **Predictable costs**: Users know what they'll pay
3. **Grace for in-flight work**: Don't kill executions mid-activity
4. **Learning incentive**: More connections = more traces = better system

## Solution Overview

### Two Complementary Systems

**1. Connection Slots** - Metering and access control
- API keys define billing entities with `max_connections`
- Connections are active sessions with heartbeats
- Grace periods protect in-flight executions
- FIFO queue prevents slot stealing

**2. LLM Proxy** - Tiered resolution with learning
- Pattern matching first (cost: $0)
- Small models for simple tasks (cost: $)
- Large models as fallback (cost: $$)
- Every LLM call recorded for pattern extraction

### The Virtuous Cycle

```
We proxy LLM → We pay the cost → Rich traces captured
                                        ↓
              Patterns extracted ← Learning improves
                    ↓
              Deterministic resolvers replace LLM calls
                    ↓
              Cost drops → More margin for learning → More traces...
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Grace periods tied to execution** | We want traces more than enforcement |
| **FIFO, no slot stealing** | Predictable, fair behavior |
| **LLM as resolver tier** | Aligns with foundation: LLMs are tools, not controllers |
| **Pattern extraction from traces** | System improves by learning, not by prompting |
| **metabob-mcp as unified gateway** | Single integration point for all AI agents |

## Success Criteria

1. **Connection slots enforced**: Users limited to `max_connections` concurrent sessions
2. **Grace periods work**: In-flight executions complete before slot is freed
3. **LLM proxy operational**: Requests routed through our backend
4. **Tiered resolution**: Pattern matches bypass LLM entirely
5. **Traces capture LLM details**: Full prompt/response/token data recorded
6. **Cost decreases over time**: Pattern match rate increases with learning

## Out of Scope

- Billing integration (Stripe, etc.) - separate change
- Usage dashboards for customers - separate change
- Custom model selection by users - future enhancement
- Offline/batch execution mode - future enhancement

## Interface Boundaries

| Component | Changes |
|-----------|---------|
| **metabob-activity-api** | New routes: `/v2/connections/*`, LLM proxy endpoints |
| **metabob-mcp** | Connection lifecycle, route LLM through backend |
| **SurrealDB** | New tables: `api_key`, `connection` |
| **Redis** | Fast slot counting, connection state cache |
| **MiniBob** | Use metabob-mcp as gateway (optional direct mode for dev) |

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Heavy users cost more than they pay | Usage caps, throttling, tier limits |
| Grace periods abused | Hard cap (30 min) regardless of execution |
| LLM proxy adds latency | Caching, pattern matching bypasses proxy |
| Pattern extraction quality | Start conservative, iterate with feedback |
