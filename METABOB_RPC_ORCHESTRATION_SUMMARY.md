# Metabob RPC API Orchestration - Executive Summary

**Question**: How can we track annotations per project with metabob-rpc-api and have it orchestrate development using CPG embeddings, annotations, task embeddings, co-change, and activity recommendations?

**Answer**: The RPC API becomes the central orchestrator that stores, computes, and serves learning data to all devbob agents.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   metabob-rpc-api (Orchestrator)                │
│                                                                 │
│  Storage (SurrealDB):                                           │
│  - Annotations per (project, component) → bounded budgets       │
│  - Prompt profiles per component → versioned                   │
│  - Embeddings (CPG, task, annotation) → 768-dim vectors        │
│  - Co-change patterns → historical correlations                │
│  - Associations (component↔impulse↔task↔activity) → weights    │
│                                                                 │
│  Services:                                                      │
│  - Annotation Manager → refine based on validation             │
│  - Prompt Optimizer → generate component-specific prompts      │
│  - Embedding Engine → sentence-transformers                    │
│  - Co-change Analyzer → track files/components changed together│
│  - Task Decomposer → CPG + embeddings → component-targeted     │
│  - Activity Recommender → Thompson Sampling + embeddings       │
│  - Feedback Processor → atomic learning updates                │
│                                                                 │
│  API Endpoints:                                                 │
│  - POST /api/v1/annotations/load                               │
│  - POST /api/v1/annotations/update                             │
│  - POST /api/v1/prompts/optimize                               │
│  - POST /api/v1/embeddings/search                              │
│  - POST /api/v1/cochange/predict                               │
│  - POST /api/v1/tasks/decompose                                │
│  - POST /api/v1/activities/recommend                           │
│  - POST /api/v1/feedback/record                                │
└─────────────────────────────────────────────────────────────────┘
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               OpenCode Clients (devbob agents)                  │
│                                                                 │
│  devbob-opencode  → Load context → Execute → Record feedback   │
│  devbob-rpc-api   → Load context → Execute → Record feedback   │
│  devbob-cli       → Load context → Execute → Record feedback   │
│  devbob-dashboard → Load context → Execute → Record feedback   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow: Annotations ↔ Task Embeddings ↔ Co-change ↔ Activities

### Step 1: Task Decomposition (CPG + Embeddings)

```python
# Agent submits task
POST /api/v1/tasks/decompose
{
  "task_description": "Fix memory leak in session messages",
  "task_type": "fix_memory_leak"
}

# RPC API orchestrates:
# 1. Compute task embedding (intent vector: 768-dim)
task_emb = embedding_engine.encode("Fix memory leak in session messages")

# 2. Search component embeddings (find similar components)
similar_components = search_similar(
    query_embedding=task_emb,
    candidate_embeddings=all_component_embeddings,
    top_k=10
)
# Result: [
#   {component_id: "src/session/index.ts::messages", similarity: 0.94},
#   {component_id: "src/activity/activity.ts::save", similarity: 0.76}
# ]

# 3. Query co-change patterns (files that change together)
related_files = query_cochange(
    changed_files=["src/session/index.ts"],
    min_confidence=0.5
)
# Result: [
#   {file: "src/session/message.ts", confidence: 0.87},
#   {file: "tests/session.test.ts", confidence: 0.92}
# ]

# 4. Load annotations for matched components
annotations = load_annotations(
    component_ids=["src/session/index.ts::messages"]
)
# Result: {
#   annotations: [
#     {type: "SUCCESS", content: "Fixed by adding default limit", score: 0.95},
#     {type: "FAILURE", content: "LRU cache didn't work", score: 0.78}
#   ]
# }

# 5. Return decomposition
{
  "impacted_components": ["src/session/index.ts::messages"],
  "related_components": ["src/session/message.ts::MessageV2"],
  "change_sequence": [...]
}
```

### Step 2: Activity Recommendation (Embeddings + Co-change + Historical Success)

```python
# Agent requests recommendation
POST /api/v1/activities/recommend
{
  "intent": "Fix memory leak in session messages",
  "context": {
    "impacted_components": ["src/session/index.ts::messages"]
  }
}

# RPC API orchestrates:
# 1. Load component-task associations (historical success)
associations = query_associations(
    component_id="src/session/index.ts::messages",
    task_type="fix_memory_leak"
)
# Result: {
#   "fix-bug-complete": {success_rate: 0.85, weight: 0.88},
#   "fix-memory-leak-specialized": {success_rate: 0.78, weight: 0.67}
# }

# 2. Compute embedding similarity (task → activity)
task_emb = compute_task_embedding("Fix memory leak...")
activity_embeddings = load_activity_embeddings()
similarities = cosine_similarity(task_emb, activity_embeddings)

# 3. Check co-change alignment
# Does activity's typical component set overlap with target components?
activity_cochange_score = check_cochange_overlap(
    activity_components=["src/session/*", "src/activity/*"],
    target_components=["src/session/index.ts::messages"]
)

# 4. Run Thompson Sampling (exploration/exploitation)
recommendations = thompson_sampling(
    candidates=[
        {
            id: "fix-bug-complete",
            historical_success: 0.85,
            embedding_similarity: 0.94,
            cochange_alignment: 0.76,
            exploration_bonus: 0.05
        }
    ]
)

# 5. Return ranked recommendations
{
  "recommendations": [
    {
      "activity_id": "fix-bug-complete",
      "score": 0.88,
      "expected_cost": 0.04,
      "success_probability": 0.85
    }
  ]
}
```

### Step 3: Prompt Optimization (Component-Specific)

```python
# Agent requests optimized prompt
POST /api/v1/prompts/optimize
{
  "component_id": "src/session/index.ts::messages",
  "task_type": "fix_memory_leak"
}

# RPC API orchestrates:
# 1. Load prompt profile (versioned, with learned patterns)
profile = load_prompt_profile("src/session/index.ts::messages")
# {
#   effective_instructions: [
#     {text: "Add schema default + fallback", success_rate: 0.87}
#   ],
#   ineffective_instructions: [
#     {text: "Add LRU cache", success_rate: 0.23}
#   ],
#   known_pitfalls: ["Schema default alone insufficient"]
# }

# 2. Load optimal impulses (from associations)
optimal_impulses = select_optimal_context(
    component_id="src/session/index.ts::messages",
    task_type="fix_memory_leak",
    token_budget=5000
)
# Knapsack algorithm: maximize score within budget
# Result: [
#   {impulse_id: "impulse_xyz", score: 0.92, tokens: 800},
#   {impulse_id: "impulse_abc", score: 0.88, tokens: 1200}
# ]

# 3. Generate optimized prompt
prompt = generate_prompt(profile, optimal_impulses)

# 4. Return
{
  "optimized_prompt": "...",
  "prompt_version": 3,
  "optimal_impulses": [...]
}
```

### Step 4: Execution (Agent-Local)

```python
# Agent executes using optimized prompt + context
# (This happens in opencode, not in RPC API)
result = execute_fix_locally(prompt, context)
```

### Step 5: Feedback Recording (Atomic Learning Updates)

```python
# Agent records feedback
POST /api/v1/feedback/record
{
  "validation_result": {
    "success": true,
    "component_ids": ["src/session/index.ts::messages"],
    "impulse_ids": ["impulse_xyz"],
    "task_type": "fix_memory_leak",
    "insight": "Schema default + runtime fallback both required"
  },
  "changed_files": ["src/session/index.ts"]
}

# RPC API orchestrates (ATOMIC TRANSACTION):
# 1. Update annotations
annotations = refine_annotations(
    component_id="src/session/index.ts::messages",
    validation_result=...
)
# - Add SUCCESS annotation (insight)
# - Boost scores for annotations in context
# - Evict low-scoring if over budget

# 2. Update prompt profile
prompts = optimize_prompts(
    component_id="src/session/index.ts::messages",
    validation_result=...
)
# - Move "schema default + fallback" to effective (success_rate++)
# - Prompt version: 2 → 3

# 3. Update associations
associations = update_associations(
    component_id="src/session/index.ts::messages",
    impulse_ids=["impulse_xyz"],
    task_type="fix_memory_leak",
    activity_id="fix-bug-complete",
    success=true
)
# - Boost edge weight: component↔impulse_xyz (0.82 → 0.88)
# - Boost edge weight: component↔fix_memory_leak (0.45 → 0.58)
# - Boost edge weight: fix_memory_leak↔fix-bug-complete (0.67 → 0.72)
# - Prune weak edges (< 0.2 weight)

# 4. Record co-change
cochange = record_cochange(
    activity_id="activity_abc123",
    changed_files=["src/session/index.ts"]
)
# - Increment pattern: (index.ts, message.ts) confidence 0.87 → 0.89

# 5. Update activity variant (existing system)
variant = update_activity_variant(
    activity_id="fix-bug-complete",
    success=true
)
# - Conversions++, success_rate 0.85 → 0.86

# 6. Recompute embeddings (if annotations changed significantly)
if has_significant_change:
    embeddings = recompute_embeddings(
        component_id="src/session/index.ts::messages",
        annotations=updated_annotations
    )

# Return
{
  "annotations_updated": true,
  "prompts_updated": true,
  "associations_updated": true,
  "cochange_recorded": true,
  "embeddings_recomputed": true
}
```

---

## Data Flow: Annotations → Embeddings → Recommendations

```
Annotations (semantic content)
    ↓ sentence-transformers
Annotation Embeddings (768-dim vectors)
    ↓ cosine similarity
Similar Annotations / Components
    ↓
    ├→ Task Embeddings (intent matching)
    ├→ Co-change Patterns (historical correlation)
    └→ Association Graph (component↔impulse↔task↔activity)
         ↓
Activity Recommendations (Thompson Sampling)
    ↓ select optimal context
Optimized Prompts + Impulses
    ↓ execute locally
Validation Results
    ↓ feedback loop
Updated Annotations / Prompts / Associations / Embeddings
```

---

## Key Benefits

### 1. **Centralized Storage** (SurrealDB)
- All projects store annotations in one place
- Per-project, per-component annotation budgets
- Versioned prompts with learned patterns
- Persistent association graph

### 2. **Semantic Search** (Embeddings)
- Task → Component matching (find root cause)
- Task → Activity matching (find effective solution)
- Annotation → Annotation matching (find similar patterns)

### 3. **Historical Learning** (Co-change + Associations)
- Files that change together (predict related work)
- Components that work together (predict dependencies)
- Impulses that help components (optimize context)
- Activities that work for tasks (predict success)

### 4. **Intelligent Recommendations** (Enhanced Multi-Armed Bandits)
- Thompson Sampling: balance exploration/exploitation
- Enhanced with embeddings: semantic relevance
- Enhanced with co-change: structural alignment
- Enhanced with associations: historical success

### 5. **Continuous Improvement** (Feedback Loop)
- Every execution improves annotations
- Every execution refines prompts
- Every execution strengthens associations
- Every execution updates embeddings

---

## Implementation Roadmap (6 Weeks)

**Week 1**: Annotation storage + management endpoints  
**Week 2**: Embedding service (sentence-transformers)  
**Week 3**: Co-change analyzer + task decomposer  
**Week 4**: Enhance activity recommender with embeddings  
**Week 5**: Implement atomic feedback processor  
**Week 6**: Integration testing + performance tuning

---

## Documents Created

1. **RPC_API_ANNOTATION_ORCHESTRATION.md** (23KB)
   - Complete architecture with schemas, APIs, flows
   
2. **RPC_API_IMPLEMENTATION_GUIDE.md** (18KB)
   - Practical implementation guide (Week 1-6)
   - Code examples, testing, deployment

3. **ANNOTATION_DRIVEN_LEARNING_SYSTEM.md** (35KB)
   - Core learning system design

4. **SELF_IMPROVING_DEVELOPMENT_SYSTEM.md** (26KB)
   - Overall system with memory leak example

5. **QUICK_START_LEARNING_SYSTEM.md** (14KB)
   - Quick start guide for developers

---

## Key Insight

**The RPC API is the "brain"** that:
- Stores all learning data (annotations, prompts, embeddings, co-change, associations)
- Orchestrates decomposition (CPG + embeddings + co-change)
- Recommends activities (Thompson Sampling + embeddings + associations)
- Provides optimal context (association-driven impulse selection)
- Learns from feedback (atomic updates to all systems)

**All devbob agents** (opencode, rpc-api, cli, dashboard) are "clients" that:
- Call RPC API before executing (get decomposition, recommendations, context)
- Execute locally (using provided prompts + impulses)
- Call RPC API after executing (record feedback for learning)

**Result**: Distributed execution, centralized learning.

---

**Next Step**: Implement Week 1 (annotation storage) in metabob-rpc-api.
