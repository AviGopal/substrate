# Final Architecture Summary: Double-Blind Learning System

**Created**: January 30, 2026  
**Status**: Implementation Ready

---

## The Complete Picture

### Core Principle
**Agents make task decisions. Server learns from outcomes. No mixing.**

---

## Architecture Components

### 1. metabob-cli MCP Sidecar (LOCAL, UNCHANGED)

**What it does**:
- Runs cpg-inference locally (fast, <10ms)
- Provides pure CPG analysis via MCP tools
- No learning data, no internal metrics

**MCP Tools (keep as-is)**:
```python
metabob_search_codebase_issues(query)
  → Returns: [{component_id, file_path}]
  → NO similarity scores

metabob_analyze_change_impact(file, component)
  → Returns: {dependencies, dependents}
  → NO impact scores

metabob_suggest_related_changes(changed_files)
  → Returns: [file_paths]
  → NO confidence scores

metabob_assess_deletion_safety(file, component)
  → Returns: {safe: bool, reason: str}
  → NO liveness scores

metabob_list_file_components(file)
  → Returns: [component_ids]
  → Pure list, no metadata
```

**Key**: All tools return WHAT, never WHY or HOW GOOD.

---

### 2. metabob-rpc-api (SERVER)

**What it does**:
- Assigns activity variants (double-blind A/B testing)
- Tracks impressions and outcomes
- Updates learning parameters (background)
- Provides recommendations without exposing internals

**Agent-Visible Endpoints** (minimal data):

```python
# Get recommendation (no scores, no reasons)
POST /api/v1/recommendations/get
{
  "task": "Fix memory leak",
  "component_ids": [...]
}
→ Response:
{
  "recommended_activity": "fix-bug-complete",
  "context_impulses": [{impulse_id, type, content}],
  "impression_id": "imp_abc123"  # Opaque
}

# Record feedback (simple outcome)
POST /api/v1/feedback/record
{
  "impression_id": "imp_abc123",
  "outcome": "success",
  "metrics": {cost, duration}
}
→ Response:
{
  "recorded": true
}
```

**Internal Services** (hidden from agents):

```python
# Variant Assignment (Thompson Sampling)
- Query embeddings (CPG + text)
- Query associations (historical success)
- Sample from Beta(alpha, beta) per variant
- Select max sampled value
- Log assignment + sampled_theta
- Return activity + context (NO SCORES)

# Feedback Processing
- Look up variant by impression_id
- Update alpha/beta (Thompson Sampling)
- Update association weights
- Trigger Celery task
- Return simple ack (NO METRICS)

# Celery Beat (periodic learning)
- Update Thompson parameters (15 min)
- Update association weights (hourly)
- Prune weak associations (weekly)
- Generate analytics (daily, humans only)
```

---

### 3. SurrealDB (INTERNAL STORAGE)

**What it stores** (all hidden from agents):

```sql
-- Variant assignments (impression tracking)
CREATE variant_assignments {
  impression_id: "imp_abc123",
  variant_id: "variant_A",
  activity_id: "fix-bug-complete",
  consumer_id: "agent_hash",
  sampled_theta: 0.87,  -- Thompson sample
  outcome: "success",    -- Filled by feedback
  metrics: {...}
}

-- Activity variants (Thompson Sampling)
CREATE activity_variants {
  variant_id: "variant_A",
  activity_id: "fix-bug-complete",
  alpha: 24,  -- successes + 1
  beta: 4,    -- failures + 1
  impressions: 27,
  conversions: 23
}

-- Association weights
CREATE component_impulse_associations {
  component_id: "src/session/index.ts::messages",
  impulse_id: "impulse_xyz",
  success_count: 11,
  failure_count: 1,
  weight: 0.92,  -- 11 / 12
  confidence: 1.0  -- min(1.0, 12 / 10)
}

-- Component embeddings (32-dim, from MCP)
CREATE component_embeddings {
  component_id: "src/session/index.ts::messages",
  embedding: [0.1, -0.2, ...],  -- 32-dim
  metadata: {file, line, type}
}
```

**Vector Search** (SurrealDB 2.0+):
```sql
-- Find similar components
SELECT * FROM component_embeddings
WHERE vector::similarity::cosine(embedding, $query) > 0.7
ORDER BY vector::similarity::cosine(embedding, $query) DESC
```

---

## Data Flow Example

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Agent: "Fix memory leak in session messages"                │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Agent → MCP: metabob_search_codebase_issues("memory leak")  │
│    MCP → Agent: [{component_id: "src/session/index.ts::messages"}] |
│    (NO scores, pure CPG analysis)                               │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Agent → RPC API: POST /recommendations/get                   │
│    {task, component_ids}                                        │
│                                                                 │
│    RPC internally:                                              │
│    - Embed task text → 32-dim vector                           │
│    - Search similar components (SurrealDB vector search)       │
│    - Load associations (component ↔ impulse weights)           │
│    - Get activity variants (alpha, beta)                       │
│    - Thompson Sample: Beta(24, 4) → θ = 0.87                   │
│    - Select activity "fix-bug-complete"                        │
│    - Select context impulses (top weighted)                    │
│    - Generate impression_id                                    │
│    - LOG EVERYTHING                                            │
│                                                                 │
│    RPC → Agent:                                                │
│    {                                                            │
│      "recommended_activity": "fix-bug-complete",               │
│      "context_impulses": [{impulse_id, content}],              │
│      "impression_id": "imp_abc123"                             │
│    }                                                            │
│    (NO scores, NO reasons, NO metrics)                         │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Agent executes fix using activity + context                 │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Agent → RPC API: POST /feedback/record                       │
│    {impression_id: "imp_abc123", outcome: "success"}           │
│                                                                 │
│    RPC internally:                                              │
│    - Look up assignment by impression_id                       │
│    - variant_id = "variant_A"                                  │
│    - activity_id = "fix-bug-complete"                          │
│    - Update: alpha = 24 → 25, beta = 4 → 4                    │
│    - Update associations: impulse weights++                    │
│    - Trigger Celery: update_parameters.delay()                 │
│                                                                 │
│    RPC → Agent:                                                │
│    {"recorded": true}                                          │
│    (NO variant info, NO updates shown)                         │
└─────────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Celery Beat (background, every 15 min)                      │
│    - Batch update Thompson parameters                          │
│    - Batch update association weights                          │
│    - Prune weak associations                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why This Works

### 1. No Bias
- Agents can't game system by choosing high-scoring activities
- Pure task-based decisions
- No preference for exploration vs exploitation

### 2. Clean Learning Signal
- Outcomes based on actual task success
- No confounding variables from showing metrics
- Thompson Sampling handles exploration automatically

### 3. Double-Blind
- Agent doesn't know variant assignment (A vs B)
- Agent doesn't see probabilities or confidence
- Pure recommendation without reasoning

### 4. Separation of Concerns
- **Agent**: Complete tasks effectively
- **Server**: Learn what works
- **MCP**: Provide pure analysis
- **Celery**: Update parameters in background

---

## Implementation Checklist

### Week 1: RPC API Foundation
- [ ] Text embedding service (sentence-transformers → 32-dim)
- [ ] SurrealDB schema (variants, assignments, associations)
- [ ] Vector indexes (component embeddings)

### Week 2: Variant Assignment
- [ ] Thompson Sampling implementation
- [ ] Context selection (association-based)
- [ ] Impression tracking
- [ ] Recommendation endpoint (agent-visible)

### Week 3: Feedback Processing
- [ ] Feedback endpoint (agent-visible)
- [ ] Parameter updates (Thompson alpha/beta)
- [ ] Association weight updates
- [ ] Celery task integration

### Week 4: Celery Beat
- [ ] Periodic parameter updates
- [ ] Batch processing for efficiency
- [ ] Association pruning
- [ ] Analytics generation (humans only)

### Week 5: Testing
- [ ] End-to-end flow testing
- [ ] Verify agent sees no internal data
- [ ] Verify learning parameters update correctly
- [ ] Load testing

### Week 6: Production
- [ ] Deploy RPC API with Celery
- [ ] Deploy SurrealDB with vector indexes
- [ ] Monitor learning metrics (internal dashboard)
- [ ] Validate Thompson Sampling convergence

---

## Key Insights

1. **MCP tools stay pure** - No changes needed, they provide CPG analysis without learning bias

2. **Agent sees minimal data** - Only what's needed to complete tasks, no internal metrics

3. **Server tracks everything** - All decisions, outcomes, parameters logged internally

4. **Learning happens async** - Celery Beat updates parameters without blocking agents

5. **Double-blind A/B testing** - Clean experimental design produces better learning

---

## Documents Created

1. **DOUBLE_BLIND_LEARNING_ARCHITECTURE.md** - Complete technical design
2. **FINAL_ARCHITECTURE_SUMMARY.md** - This document
3. Plus 8 supporting docs on learning systems, embeddings, RPC integration

**Total**: 10 comprehensive architecture documents

---

**Result**: A clean, double-blind learning system where agents focus on tasks and the server learns from outcomes without bias.

**Next Step**: Implement Week 1 (RPC API foundation with text embeddings and SurrealDB).
