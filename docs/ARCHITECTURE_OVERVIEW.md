# Architecture Overview: Annotation-Driven Double-Blind Learning System

**Status**: Current Architecture (Jan 30, 2026)  
**Version**: 3.0.0 - Double-Blind Learning

---

## Quick Navigation

**Start Here**:
1. [FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md) - **Executive summary** - Read this first!
2. [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) - **Core design** - How agents stay unbiased

**Detailed Technical Docs**:
3. [DISTRIBUTED_ARCHITECTURE_FINAL.md](./DISTRIBUTED_ARCHITECTURE_FINAL.md) - Client-server distribution
4. [CPG_INTEGRATION_SUMMARY.md](../CPG_INTEGRATION_SUMMARY.md) - Embedding integration with cpg-inference
5. [RPC_API_ANNOTATION_ORCHESTRATION.md](./architecture/RPC_API_ANNOTATION_ORCHESTRATION.md) - Server-side orchestration
6. [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - Implementation steps
7. [architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md](./architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md) - Learning system details

**Quick Starts**:
8. [QUICK_START_LEARNING_SYSTEM.md](./QUICK_START_LEARNING_SYSTEM.md) - Getting started guide
9. [SELF_IMPROVING_DEVELOPMENT_SYSTEM.md](./SELF_IMPROVING_DEVELOPMENT_SYSTEM.md) - System overview with examples

---

## Architecture at a Glance

### Core Principle
**Agents make task decisions. Server learns from outcomes. No mixing.**

### The Stack

```
┌─────────────────────────────────────────────────────────────┐
│ Agents (devbob-opencode, devbob-rpc-api, devbob-cli)       │
│ - Make task-based decisions                                │
│ - Call MCP tools for CPG analysis                          │
│ - Call RPC API for recommendations                         │
│ - NO ACCESS to learning metrics                            │
└────────┬────────────────────────────────────────────────────┘
         │
         ├─ MCP Protocol ─────────────────────────────┐
         │                                             │
         ▼                                             │
┌────────────────────────────────┐                    │
│ metabob-cli MCP Sidecar (LOCAL)│                    │
│ - cpg-inference (32-dim GNN)   │                    │
│ - FAISS similarity search      │                    │
│ - SQLite component cache       │                    │
│ - Pure CPG analysis            │                    │
│ - NO learning data exposed     │                    │
└────────────────────────────────┘                    │
                                                       │
         ├─ HTTP/REST ──────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ metabob-rpc-api (SERVER)                                    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Variant Assignment (Thompson Sampling)                  │ │
│ │ - Embed task text → 32-dim vector                       │ │
│ │ - Search similar components (SurrealDB vector search)   │ │
│ │ - Sample from Beta(alpha, beta) per variant             │ │
│ │ - Log assignment + outcome                              │ │
│ │ - Return recommendation (NO SCORES/REASONS)             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SurrealDB (Internal Storage)                            │ │
│ │ - Component embeddings (32-dim from MCP)                │ │
│ │ - Variant assignments (impression tracking)             │ │
│ │ - Thompson Sampling parameters (alpha, beta)            │ │
│ │ - Association weights (component ↔ impulse)             │ │
│ │ - Vector indexes for similarity search                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Celery Beat (Background Learning)                       │ │
│ │ - Update Thompson parameters (15 min)                   │ │
│ │ - Update association weights (hourly)                   │ │
│ │ - Prune weak associations (weekly)                      │ │
│ │ - Generate analytics (daily, humans only)               │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Decisions

### 1. Double-Blind A/B Testing ✅ **NEW (v3.0.0)**

**Why**: Showing agents similarity scores, confidence, or success rates biases their decisions and produces confounded learning signals.

**How**:
- Agents receive single recommendation (no ranking, no scores)
- Context impulses provided without explanation
- Opaque `impression_id` for feedback tracking
- All learning metrics hidden from agents

**Benefit**: Clean experimental outcomes, no bias, better learning convergence.

### 2. Client-Side CPG Inference ✅

**Why**: CPG analysis is fast (<10ms) and doesn't need server round-trip.

**How**:
- metabob-cli runs cpg-inference locally
- 32-dim GNN embeddings computed on-device
- FAISS index for similarity search
- SQLite cache for persistence

**Benefit**: Fast local queries, no network latency, works offline.

### 3. Server-Side Learning ✅

**Why**: Learning requires aggregating data across all agents and projects.

**How**:
- RPC API assigns variants via Thompson Sampling
- SurrealDB stores all learning state
- Celery Beat updates parameters periodically
- Vector search for component similarity

**Benefit**: Centralized learning, scalable, continuous improvement.

### 4. Thompson Sampling for Exploration ✅

**Why**: Need to balance trying new variants (exploration) vs. using known-good ones (exploitation).

**How**:
- Each activity variant has Beta(alpha, beta) distribution
- Sample θ ~ Beta(alpha, beta) per variant
- Select max sampled θ
- Update alpha/beta based on outcome

**Benefit**: Automatic exploration/exploitation, Bayesian inference, regret bounds.

### 5. Association Learning ✅

**Why**: Not all context is equally helpful for all components/tasks.

**How**:
- Track success/failure for each (component, impulse) pair
- Weight = success_count / (success_count + failure_count)
- Confidence = min(1.0, total_count / 10)
- Prune weak associations (weight < 0.2, confidence > 0.7)

**Benefit**: Context selection improves over time, removes unhelpful associations.

---

## Data Flow Example

```
1. Agent: "Fix memory leak in session messages"
    ↓
2. Agent → MCP: metabob_search_codebase_issues("memory leak")
   MCP → Agent: [{component_id: "src/session/index.ts::messages"}]
   (Pure CPG analysis, NO scores)
    ↓
3. Agent → RPC: POST /recommendations/get {task, component_ids}
   RPC internally:
     - Embed task → 32-dim
     - Search SurrealDB (vector similarity)
     - Load associations (component ↔ impulse weights)
     - Thompson Sample: Beta(24, 4) → θ=0.87
     - Select "fix-bug-complete"
     - Generate impression_id
     - LOG EVERYTHING
   RPC → Agent: {activity, context, impression_id}
   (NO scores, NO reasons)
    ↓
4. Agent: Execute fix
    ↓
5. Agent → RPC: POST /feedback/record {impression_id, outcome}
   RPC internally:
     - Look up variant assignment
     - Update: alpha=24→25, beta=4→4
     - Update associations
     - Trigger Celery task
   RPC → Agent: {recorded: true}
   (NO metrics shown)
    ↓
6. Celery (background): Batch update parameters
```

---

## Evolution of Architecture

### v1.0.0: Annotation-Driven Learning (Deprecated)
- Agents had access to similarity scores and success rates
- **Problem**: Agents biased toward high-scoring activities
- **Problem**: No proper exploration, stuck in local optima

### v2.0.0: Distributed Architecture (Superseded)
- Added client-side CPG inference (metabob-cli MCP)
- Added server-side learning (RPC API + SurrealDB)
- **Problem**: Still exposed learning metrics to agents

### v3.0.0: Double-Blind Learning (Current) ✅
- Agents see NO internal metrics
- Thompson Sampling handles exploration
- Clean experimental outcomes
- **Result**: Unbiased learning, better convergence

---

## Implementation Status

### Completed ✅
- [x] Architecture design documents
- [x] Data schemas (SurrealDB)
- [x] API contracts (agent-visible endpoints)
- [x] Learning algorithms (Thompson Sampling, associations)

### In Progress 🔄
- [ ] Text embedding service (RPC API)
- [ ] SurrealDB with vector indexes
- [ ] Variant assignment service
- [ ] Celery Beat configuration

### Not Started ⏳
- [ ] End-to-end testing
- [ ] Production deployment
- [ ] Analytics dashboard (humans only)

---

## Metrics & Success Criteria

### Learning Quality
- **Variant convergence**: Thompson Sampling parameters stabilize after ~100 impressions per variant
- **Association quality**: Top-weighted associations have >0.8 success rate
- **Exploration rate**: ~10-20% of recommendations are exploratory (lower θ)

### System Performance
- **MCP latency**: <10ms for CPG queries (local)
- **RPC latency**: <100ms for recommendations (network + DB)
- **Learning latency**: <1s for feedback recording (async)
- **Celery throughput**: Handle 1000+ updates/hour

### Agent Behavior
- **Bias check**: Agent choices independent of hidden metrics (verified by A/B test)
- **Task success**: Overall success rate improves over time
- **Context quality**: Selected impulses have increasing relevance

---

## FAQ

**Q: Why double-blind? Can't agents be trusted?**  
A: It's not about trust—it's about clean experimental design. Showing scores creates confounders (agents prefer high-scoring activities → circular reasoning → biased learning).

**Q: Won't hiding metrics make agents less effective?**  
A: No—agents get the SAME recommendations, just without the "why." Thompson Sampling ensures optimal exploration/exploitation automatically.

**Q: How do we know the system is learning?**  
A: Internal analytics dashboard (humans only) shows variant convergence, association weights, success rates over time.

**Q: What if the recommended activity is wrong?**  
A: That's exploration! Thompson Sampling ensures trying new things. Failed attempts update parameters → better future recommendations.

**Q: Can we override recommendations for specific tasks?**  
A: Yes—but overrides don't contribute to learning (no impression tracking). Use sparingly.

---

## Related Documents

### Architecture
- [FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md) - Executive summary
- [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) - Core design
- [DISTRIBUTED_ARCHITECTURE_FINAL.md](./DISTRIBUTED_ARCHITECTURE_FINAL.md) - Client-server details

### Implementation
- [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - 6-week implementation plan
- [RPC_API_ANNOTATION_ORCHESTRATION.md](./architecture/RPC_API_ANNOTATION_ORCHESTRATION.md) - Server-side details
- [CPG_INTEGRATION_SUMMARY.md](../CPG_INTEGRATION_SUMMARY.md) - Embedding integration

### Learning Systems
- [architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md](./architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md) - Learning algorithms
- [SELF_IMPROVING_DEVELOPMENT_SYSTEM.md](./SELF_IMPROVING_DEVELOPMENT_SYSTEM.md) - System overview
- [QUICK_START_LEARNING_SYSTEM.md](./QUICK_START_LEARNING_SYSTEM.md) - Getting started

---

**Last Updated**: January 30, 2026  
**Current Version**: 3.0.0 (Double-Blind Learning)  
**Status**: Design Complete, Implementation Ready
