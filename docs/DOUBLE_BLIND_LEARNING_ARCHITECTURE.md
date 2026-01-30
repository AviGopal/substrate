# Double-Blind Learning Architecture

**Status**: Implementation Ready  
**Created**: January 30, 2026  
**Last Updated**: January 30, 2026  
**Version**: 3.0.0 (FINAL)

## Executive Summary

This document describes the **double-blind A/B testing architecture** where agents make task decisions while the server learns from outcomes without any mixing or bias. The architecture separates concerns cleanly: agents focus on completing tasks effectively using pure CPG analysis, while the RPC API server uses Thompson Sampling and association learning to improve recommendations without exposing internal metrics to agents.

**Core Architecture Components**:
1. **metabob-cli MCP sidecar** - Local CPG analysis via cpg-inference (<10ms response time)
2. **metabob-rpc-api server** - Thompson Sampling for variant assignment, SurrealDB for learning state  
3. **Celery Beat** - Background parameter updates and association learning
4. **SurrealDB** - Vector search for component similarity, all learning metrics hidden from agents

**Key Principle**: Agents should not know WHY something was recommended, only WHAT to do. All metrics hidden from agents - recommendations include activity + context impulses + opaque impression_id for feedback tracking.

---

## Architecture: Agent-Opaque Learning

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent (devbob-opencode)                      │
│                                                                 │
│  Agent sees:                                                    │
│  - Task to complete                                            │
│  - Available activities (ranked, no scores shown)              │
│  - Context to include (impulses, no metadata)                  │
│  - Validation results (pass/fail only)                         │
│                                                                 │
│  Agent does NOT see:                                           │
│  - Why activity was recommended                                │
│  - Similarity scores, weights, probabilities                   │
│  - Variant assignments (A vs B)                                │
│  - Historical success rates                                    │
│  - Learning parameters (alpha, beta, weights)                  │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ MCP tools (pure CPG analysis)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              metabob-cli MCP Sidecar (UNCHANGED)                │
│                                                                 │
│  Tools provided (no learning data):                             │
│  - metabob_search_codebase_issues(query)                       │
│    → Returns: [{component_id, file_path}]                      │
│    → NO similarity scores                                      │
│                                                                 │
│  - metabob_analyze_change_impact(file, component)             │
│    → Returns: {dependencies, dependents}                       │
│    → NO impact scores                                          │
│                                                                 │
│  - metabob_suggest_related_changes(changed_files)             │
│    → Returns: [related_file_paths]                            │
│    → NO confidence scores                                      │
│                                                                 │
│  Pure CPG analysis, no learning influence                      │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTP/REST (for recommendations)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    metabob-rpc-api (SERVER)                     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Variant Assignment Service (Double-Blind)                │ │
│  │                                                             │ │
│  │  POST /api/v1/recommendations/get                         │ │
│  │  {                                                         │ │
│  │    "task": "Fix memory leak",                             │ │
│  │    "component_ids": [...]                                 │ │
│  │  }                                                         │ │
│  │                                                             │ │
│  │  Server internally:                                        │ │
│  │  1. Compute embeddings (task, components)                 │ │
│  │  2. Query associations (historical success)               │ │
│  │  3. Run Thompson Sampling (exploration/exploitation)      │ │
│  │  4. Assign variant (A: activity X, B: activity Y)         │ │
│  │  5. Log assignment (for later analysis)                   │ │
│  │                                                             │ │
│  │  Response to agent (NO INTERNAL DATA):                    │ │
│  │  {                                                         │ │
│  │    "recommended_activity": "fix-bug-complete",            │ │
│  │    "context_impulses": ["impulse_xyz"],                   │ │
│  │    "impression_id": "imp_abc123"                          │ │
│  │  }                                                         │ │
│  │  ^^^ No scores, no reasons, no metrics                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Feedback Collection (Outcome Recording)                  │ │
│  │                                                             │ │
│  │  POST /api/v1/feedback/record                             │ │
│  │  {                                                         │ │
│  │    "impression_id": "imp_abc123",                         │ │
│  │    "outcome": "success" | "failure",                      │ │
│  │    "metrics": {cost, duration, ...}                       │ │
│  │  }                                                         │ │
│  │                                                             │ │
│  │  Server internally:                                        │ │
│  │  1. Look up variant assignment by impression_id           │ │
│  │  2. Record outcome (conversion or not)                    │ │
│  │  3. Trigger Celery task: update_parameters.delay()        │ │
│  │  4. Update Thompson Sampling alpha/beta                   │ │
│  │  5. Update association weights                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Internal Data (Hidden from Agents)                       │ │
│  │                                                             │ │
│  │  SurrealDB Tables:                                        │ │
│  │  - variant_assignments (impression → variant → outcome)   │ │
│  │  - activity_variants (alpha, beta, impressions)           │ │
│  │  - associations (weights, confidences)                    │ │
│  │  - embeddings (vectors)                                   │ │
│  │                                                             │ │
│  │  Celery Beat:                                             │ │
│  │  - Update Thompson Sampling params (hourly)               │ │
│  │  - Recompute association weights (hourly)                 │ │
│  │  - Prune weak associations (weekly)                       │ │
│  │  - Generate analytics reports (daily)                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent-Visible API (Minimal, No Internal Data)

### 1. Get Recommendations (No Scores, No Reasons)

```python
# What agent calls:
POST /api/v1/recommendations/get
{
  "org_id": "org_123",
  "project_id": "project_456",
  "task": "Fix memory leak in session messages",
  "component_ids": ["src/session/index.ts::messages"],
  "consumer_id": "agent_hash_xyz"  # For consistent variant assignment
}

# What agent receives (NO INTERNAL DATA):
{
  "recommended_activity": "fix-bug-complete",
  "context_impulses": [
    {
      "impulse_id": "impulse_xyz",
      "type": "pattern",
      "content": "Session messages use streaming pattern with async generators..."
    },
    {
      "impulse_id": "impulse_abc", 
      "type": "constraint",
      "content": "Must preserve message order (reverse at end)"
    }
  ],
  "related_components": [
    "src/session/message.ts::MessageV2"
  ],
  "impression_id": "imp_abc123"  # Opaque ID for feedback
}

# What agent does NOT see:
# - similarity_score: 0.94
# - variant: "A"
# - success_probability: 0.85
# - reasoning: "High historical success rate"
# - alpha: 24, beta: 4
# - exploration_bonus: 0.05
```

**Key Points**:
- Agent gets a single recommended activity (not ranked list with scores)
- Context impulses are provided without explanation of WHY
- `impression_id` is opaque - agent doesn't know it's for A/B tracking
- No similarity scores, probabilities, or internal metrics

### 2. Record Feedback (Simple Outcome Only)

```python
# What agent calls:
POST /api/v1/feedback/record
{
  "impression_id": "imp_abc123",
  "outcome": "success",  # or "failure"
  "metrics": {
    "cost": 0.04,
    "duration": 12000,
    "memory_reduction_mb": 15905
  }
}

# What agent receives:
{
  "recorded": true,
  "feedback_id": "fb_def456"
}

# What agent does NOT see:
# - variant_updated: true
# - alpha_updated: 24 → 25
# - beta_updated: 4 → 4
# - new_success_rate: 0.862
# - association_weights_updated: 4
```

**Key Points**:
- Agent only reports outcome (success/failure) + metrics
- No visibility into what parameters were updated
- No confirmation of variant assignment
- Simple acknowledgment only

---

## Server-Side Variant Assignment (Hidden from Agent)

### Thompson Sampling with Logging

```python
# server/services/variant_assigner.py

from dataclasses import dataclass
import numpy as np

@dataclass
class VariantAssignment:
    impression_id: str
    variant_id: str
    activity_id: str
    context_impulses: list[str]
    sampled_theta: float  # Hidden from agent
    assigned_at: datetime

class VariantAssigner:
    """Assign variants using Thompson Sampling (double-blind)."""
    
    async def assign_variant(
        self,
        db: SurrealDBClient,
        consumer_id: str,
        task: str,
        component_ids: list[str],
    ) -> dict:
        """Assign variant and return agent-visible recommendation.
        
        Returns ONLY what agent should see, logs everything else internally.
        """
        # Step 1: Get candidate activities (based on embeddings, associations)
        candidates = await self._get_candidate_activities(
            db, task, component_ids
        )
        
        # Step 2: Run Thompson Sampling
        selected = self._thompson_sample(candidates)
        
        # Step 3: Select optimal context (based on associations)
        context_impulses = await self._select_context(
            db, component_ids, selected.activity_id
        )
        
        # Step 4: Generate impression ID
        impression_id = f"imp_{generate_unique_id()}"
        
        # Step 5: LOG EVERYTHING INTERNALLY (hidden from agent)
        assignment = VariantAssignment(
            impression_id=impression_id,
            variant_id=selected.variant_id,
            activity_id=selected.activity_id,
            context_impulses=[imp.impulse_id for imp in context_impulses],
            sampled_theta=selected.sampled_theta,
            assigned_at=datetime.now()
        )
        
        await db.query("""
            CREATE variant_assignments CONTENT {
                impression_id: $impression_id,
                variant_id: $variant_id,
                activity_id: $activity_id,
                consumer_id: $consumer_id,
                task: $task,
                component_ids: $component_ids,
                context_impulses: $context_impulses,
                sampled_theta: $sampled_theta,
                assigned_at: $assigned_at,
                outcome: null  -- Will be filled in by feedback
            }
        """, assignment.__dict__)
        
        # Step 6: Return ONLY agent-visible data (no internal metrics)
        return {
            "recommended_activity": selected.activity_id,
            "context_impulses": [
                {
                    "impulse_id": imp.impulse_id,
                    "type": imp.type,
                    "content": imp.content
                }
                for imp in context_impulses
            ],
            "related_components": selected.related_components,
            "impression_id": impression_id
        }
        # NO scores, NO probabilities, NO reasoning
    
    def _thompson_sample(self, candidates: list[ActivityVariant]) -> ActivityVariant:
        """Sample using Thompson Sampling (Beta distribution).
        
        This is HIDDEN from agent - they just get the selected activity.
        """
        samples = []
        for candidate in candidates:
            # Sample from Beta(alpha, beta)
            theta = np.random.beta(candidate.alpha, candidate.beta)
            samples.append((theta, candidate))
        
        # Select max sampled value (exploration/exploitation)
        sampled_theta, selected = max(samples, key=lambda x: x[0])
        selected.sampled_theta = sampled_theta
        
        # Log internally
        logger.info(
            f"Thompson Sampling: selected {selected.activity_id} "
            f"(theta={sampled_theta:.3f}, alpha={selected.alpha}, beta={selected.beta})"
        )
        
        return selected
```

### Feedback Processing (Updates Hidden Parameters)

```python
# server/services/feedback_processor.py

async def process_feedback(
    db: SurrealDBClient,
    impression_id: str,
    outcome: str,
    metrics: dict
) -> dict:
    """Process feedback and update internal parameters (hidden from agent)."""
    
    # Step 1: Look up variant assignment
    assignment = await db.query("""
        SELECT * FROM variant_assignments
        WHERE impression_id = $impression_id
    """, {"impression_id": impression_id})
    
    if not assignment:
        raise ValueError(f"Unknown impression_id: {impression_id}")
    
    assignment = assignment[0]
    
    # Step 2: Update variant parameters (Thompson Sampling)
    success = (outcome == "success")
    
    await db.query("""
        UPDATE activity_variants
        SET 
            alpha = alpha + $success,
            beta = beta + $failure,
            impressions = impressions + 1,
            conversions = conversions + $success,
            updated_at = time::now()
        WHERE variant_id = $variant_id
    """, {
        "variant_id": assignment["variant_id"],
        "success": 1 if success else 0,
        "failure": 0 if success else 1
    })
    
    # Step 3: Update association weights
    for comp_id in assignment["component_ids"]:
        for impulse_id in assignment["context_impulses"]:
            await update_association_weight(
                db, comp_id, impulse_id, success
            )
    
    # Step 4: Record outcome in assignment
    await db.query("""
        UPDATE variant_assignments
        SET outcome = $outcome, metrics = $metrics
        WHERE impression_id = $impression_id
    """, {"impression_id": impression_id, "outcome": outcome, "metrics": metrics})
    
    # Step 5: Trigger async learning (Celery)
    update_parameters.delay(impression_id)
    
    # Step 6: Return simple acknowledgment (NO INTERNAL DATA)
    return {
        "recorded": true,
        "feedback_id": f"fb_{generate_unique_id()}"
    }
    # NO variant info, NO parameter updates, NO metrics
```

---

## SurrealDB Schema (Internal Only)

```sql
-- Variant assignments (impression tracking)
DEFINE TABLE variant_assignments SCHEMAFULL;
DEFINE FIELD impression_id ON TABLE variant_assignments TYPE string;
DEFINE FIELD variant_id ON TABLE variant_assignments TYPE string;
DEFINE FIELD activity_id ON TABLE variant_assignments TYPE string;
DEFINE FIELD consumer_id ON TABLE variant_assignments TYPE string;
DEFINE FIELD task ON TABLE variant_assignments TYPE string;
DEFINE FIELD component_ids ON TABLE variant_assignments TYPE array<string>;
DEFINE FIELD context_impulses ON TABLE variant_assignments TYPE array<string>;
DEFINE FIELD sampled_theta ON TABLE variant_assignments TYPE float;  -- Thompson sample
DEFINE FIELD outcome ON TABLE variant_assignments TYPE string;  -- null, "success", "failure"
DEFINE FIELD metrics ON TABLE variant_assignments TYPE object;
DEFINE FIELD assigned_at ON TABLE variant_assignments TYPE datetime;
DEFINE INDEX idx_variant_assignments ON TABLE variant_assignments COLUMNS impression_id UNIQUE;

-- Activity variants (Thompson Sampling parameters)
DEFINE TABLE activity_variants SCHEMAFULL;
DEFINE FIELD variant_id ON TABLE activity_variants TYPE string;
DEFINE FIELD activity_id ON TABLE activity_variants TYPE string;
DEFINE FIELD alpha ON TABLE activity_variants TYPE int DEFAULT 1;  -- successes + 1 (prior)
DEFINE FIELD beta ON TABLE activity_variants TYPE int DEFAULT 1;   -- failures + 1 (prior)
DEFINE FIELD impressions ON TABLE activity_variants TYPE int DEFAULT 0;
DEFINE FIELD conversions ON TABLE activity_variants TYPE int DEFAULT 0;
DEFINE FIELD created_at ON TABLE activity_variants TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON TABLE activity_variants TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_activity_variants ON TABLE activity_variants COLUMNS variant_id UNIQUE;

-- Association weights (component ↔ impulse effectiveness)
DEFINE TABLE component_impulse_associations SCHEMAFULL;
DEFINE FIELD org_id ON TABLE component_impulse_associations TYPE string;
DEFINE FIELD project_id ON TABLE component_impulse_associations TYPE string;
DEFINE FIELD component_id ON TABLE component_impulse_associations TYPE string;
DEFINE FIELD impulse_id ON TABLE component_impulse_associations TYPE string;
DEFINE FIELD success_count ON TABLE component_impulse_associations TYPE int DEFAULT 0;
DEFINE FIELD failure_count ON TABLE component_impulse_associations TYPE int DEFAULT 0;
DEFINE FIELD weight ON TABLE component_impulse_associations TYPE float;  -- success / (success + failure)
DEFINE FIELD confidence ON TABLE component_impulse_associations TYPE float;  -- min(1.0, total / 10)
DEFINE FIELD updated_at ON TABLE component_impulse_associations TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_comp_impulse ON TABLE component_impulse_associations 
    COLUMNS project_id, component_id, impulse_id UNIQUE;

-- Embeddings (for similarity search)
DEFINE TABLE component_embeddings SCHEMAFULL;
DEFINE FIELD project_id ON TABLE component_embeddings TYPE string;
DEFINE FIELD component_id ON TABLE component_embeddings TYPE string;
DEFINE FIELD embedding ON TABLE component_embeddings TYPE array<float>;
DEFINE FIELD metadata ON TABLE component_embeddings TYPE object;
DEFINE FIELD updated_at ON TABLE component_embeddings TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_comp_embeddings ON TABLE component_embeddings 
    COLUMNS project_id, component_id UNIQUE;
DEFINE INDEX idx_comp_embeddings_vector ON TABLE component_embeddings 
    FIELDS embedding 
    MTREE DIMENSION 32 DISTANCE COSINE;
```

---

## Celery Beat Tasks (Background Learning)

```python
# server/celery_config.py

from celery.schedules import crontab

beat_schedule = {
    # Update Thompson Sampling parameters based on recent outcomes
    'update-thompson-params': {
        'task': 'server.tasks.learning.update_thompson_parameters',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    
    # Recompute association weights
    'update-associations': {
        'task': 'server.tasks.learning.update_association_weights',
        'schedule': crontab(minute=0),  # Every hour
    },
    
    # Prune weak associations
    'prune-associations': {
        'task': 'server.tasks.learning.prune_weak_associations',
        'schedule': crontab(hour=3, minute=0, day_of_week=0),  # Sunday 3 AM
    },
    
    # Generate analytics report (for humans, not agents)
    'generate-analytics': {
        'task': 'server.tasks.analytics.generate_learning_report',
        'schedule': crontab(hour=8, minute=0),  # Daily at 8 AM
    },
}

# server/tasks/learning.py

@celery_app.task
def update_thompson_parameters():
    """Update alpha/beta based on recent outcomes."""
    
    # Query recent assignments with outcomes
    recent = db.query("""
        SELECT * FROM variant_assignments
        WHERE outcome IS NOT null
        AND updated_at > time::now() - 15m
    """)
    
    # Group by variant
    variant_outcomes = {}
    for assignment in recent:
        variant_id = assignment["variant_id"]
        if variant_id not in variant_outcomes:
            variant_outcomes[variant_id] = {"success": 0, "failure": 0}
        
        if assignment["outcome"] == "success":
            variant_outcomes[variant_id]["success"] += 1
        else:
            variant_outcomes[variant_id]["failure"] += 1
    
    # Update alpha/beta
    for variant_id, outcomes in variant_outcomes.items():
        db.query("""
            UPDATE activity_variants
            SET 
                alpha = alpha + $success,
                beta = beta + $failure,
                updated_at = time::now()
            WHERE variant_id = $variant_id
        """, {
            "variant_id": variant_id,
            "success": outcomes["success"],
            "failure": outcomes["failure"]
        })
    
    logger.info(f"Updated Thompson parameters for {len(variant_outcomes)} variants")

@celery_app.task
def update_association_weights():
    """Update component ↔ impulse association weights."""
    
    # Query recent assignments with outcomes
    recent = db.query("""
        SELECT * FROM variant_assignments
        WHERE outcome IS NOT null
        AND updated_at > time::now() - 1h
    """)
    
    # Update associations
    for assignment in recent:
        success = (assignment["outcome"] == "success")
        
        for comp_id in assignment["component_ids"]:
            for impulse_id in assignment["context_impulses"]:
                # Increment success/failure count
                db.query("""
                    UPDATE component_impulse_associations
                    SET 
                        success_count = success_count + $success,
                        failure_count = failure_count + $failure,
                        weight = success_count::float / (success_count + failure_count),
                        confidence = math::min(1.0, (success_count + failure_count)::float / 10.0),
                        updated_at = time::now()
                    WHERE project_id = $project_id
                    AND component_id = $component_id
                    AND impulse_id = $impulse_id
                """, {
                    "project_id": assignment["project_id"],
                    "component_id": comp_id,
                    "impulse_id": impulse_id,
                    "success": 1 if success else 0,
                    "failure": 0 if success else 1
                })
    
    logger.info(f"Updated associations for {len(recent)} recent assignments")
```

---

## Analytics Dashboard (Humans Only)

```python
# server/routes/analytics.py (NOT exposed to agents)

@router.get("/analytics/variants")
@require_admin  # Only humans with admin access
async def get_variant_analytics():
    """Get variant performance analytics (NOT for agents)."""
    
    variants = await db.query("""
        SELECT 
            variant_id,
            activity_id,
            alpha,
            beta,
            impressions,
            conversions,
            conversions::float / impressions AS conversion_rate,
            alpha::float / (alpha + beta) AS estimated_success_rate
        FROM activity_variants
        ORDER BY impressions DESC
    """)
    
    return {
        "variants": variants,
        "total_impressions": sum(v["impressions"] for v in variants),
        "total_conversions": sum(v["conversions"] for v in variants)
    }

@router.get("/analytics/associations")
@require_admin
async def get_association_analytics():
    """Get association strength analytics (NOT for agents)."""
    
    associations = await db.query("""
        SELECT 
            component_id,
            impulse_id,
            success_count,
            failure_count,
            weight,
            confidence
        FROM component_impulse_associations
        WHERE confidence > 0.5
        ORDER BY weight DESC, confidence DESC
        LIMIT 100
    """)
    
    return {
        "top_associations": associations,
        "avg_weight": sum(a["weight"] for a in associations) / len(associations)
    }
```

---

## Summary: Double-Blind Learning

### What Agents See (Minimal)
✅ Recommended activity (single choice, no ranking)  
✅ Context impulses (no explanation of why)  
✅ Related components (from CPG analysis)  
✅ Impression ID (opaque, for feedback)

### What Agents Do NOT See
❌ Similarity scores, probabilities, confidence  
❌ Variant assignments (A vs B)  
❌ Thompson Sampling parameters (alpha, beta)  
❌ Association weights  
❌ Historical success rates  
❌ Reasoning or explanations

### What Server Tracks (Hidden)
✅ Variant assignments (impression → variant → outcome)  
✅ Thompson Sampling parameters (alpha, beta)  
✅ Association weights (component ↔ impulse)  
✅ Embeddings (for similarity)  
✅ All outcomes and metrics

### Why This Works
1. **No bias**: Agents can't game the system by preferring high-scoring activities
2. **Pure outcomes**: Learning based on actual task success, not agent behavior
3. **Exploration**: Thompson Sampling ensures trying new variants
4. **Clean data**: No confounding variables from showing internal metrics

---

**Key Insight**: The agent's job is to complete tasks. The server's job is to learn what works. Keeping these separate produces cleaner learning signals.

---

**Related Documents**:
- [FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md) - Executive overview and implementation timeline
- [DISTRIBUTED_ARCHITECTURE_FINAL.md](./DISTRIBUTED_ARCHITECTURE_FINAL.md) - Client-server architecture details
- [RPC_API_ANNOTATION_ORCHESTRATION.md](./architecture/RPC_API_ANNOTATION_ORCHESTRATION.md) - RPC API design
- [CPG_INTEGRATION_SUMMARY.md](../CPG_INTEGRATION_SUMMARY.md) - CPG analysis integration patterns

**Implementation Status**: Ready for development with 6-week implementation plan outlined in FINAL_ARCHITECTURE_SUMMARY.md

**Current Priority Tasks**:
1. **Week 1**: RPC API foundation (text embeddings, SurrealDB schema, vector indexes)
2. **Week 2**: Variant assignment (Thompson Sampling, context selection, recommendation endpoint)
3. **Week 3**: Feedback processing (outcome tracking, parameter updates, Celery integration)
4. **Week 4**: Celery Beat (periodic updates, batch processing, association pruning)
5. **Week 5**: Testing (end-to-end flow, bias verification, load testing)
6. **Week 6**: Production (deployment, monitoring, validation)

**Vector Search & Association Learning**: Utilizes 32-dimensional embeddings with SurrealDB vector search for component similarity matching and Bayesian exploration/exploitation through Thompson Sampling.

---

## Template Registration & Validation Integration

The template registration and validation system is **orthogonal** to the double-blind learning architecture, ensuring data integrity without affecting learning outcomes.

### Integration Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Double-Blind Learning Flow                   │
│                                                                 │
│  1. Server recommends activity (Thompson Sampling)             │
│     → Returns: "fix-bug-complete" + impression_id               │
│                                                                 │
│  2. Template validation ensures latest version ✅               │
│     → Checks: cache, Metabob, local storage                    │
│     → Returns: template v1.2.3 (freshest version)              │
│                                                                 │
│  3. Agent executes template (blind to variant assignment)      │
│     → Uses: validated latest template version                   │
│     → Tracks: impression_id for outcome feedback               │
│                                                                 │
│  4. Feedback recorded (learning continues)                     │
│     → Updates: Thompson parameters (alpha/beta)                │
│     → Agent never sees: learning metrics or reasons            │
└─────────────────────────────────────────────────────────────────┘
```

### Template Validation Tool

**Purpose**: Ensure agents execute with the most up-to-date template versions while maintaining learning system integrity.

**Implementation**: `validate_template_registration` tool (Production Ready)

```bash
# Validate template before execution
opencode run "validate_template_registration({ templateId: 'fix-bug-complete', fix_issues: true })"

# Execute activity with validated template
opencode run "activity({ templateId: 'fix-bug-complete', variables: {...} })"
```

### Why This Integration Works

**✅ No Learning Interference**:
- Template validation is transparent to variant assignment
- Server still controls which activity is recommended
- Agent gets latest version of recommended activity
- Learning signals remain clean and unbiased

**✅ Data Integrity Benefits**:
- Eliminates noise from template version inconsistencies  
- Ensures reproducible execution across environments
- Reduces outcome variance due to stale templates
- Improves learning signal quality

**✅ Agent Blindness Preserved**:
- Validation happens after recommendation
- Agent doesn't see why template was selected
- No exposure to learning parameters or scores
- Focus remains on task completion

### Validation Checks (Orthogonal to Learning)

1. **Template Existence**: ✅ Available in at least one backend
2. **Version Consistency**: ✅ Same version across cache/Metabob/local  
3. **Cache Freshness**: ✅ Not stale (< 5 minutes)
4. **Content Integrity**: ✅ No corruption or drift
5. **Backend Connectivity**: ✅ Metabob MCP accessible (optional)

### Auto-Fix Capabilities

When `fix_issues: true`:
- **Stale Cache**: Automatically invalidated and refreshed
- **Version Mismatch**: Cache cleared, re-synced from authoritative source
- **Content Drift**: Template re-registered from source of truth

### Learning System Impact: None

- **Agent Perspective**: Still blind to learning metrics
- **Server Perspective**: Continues variant assignment and outcome tracking
- **Data Quality**: Improved due to consistent template versions
- **Exploration**: Thompson Sampling unaffected by validation

**Key Insight**: Template validation ensures execution integrity while preserving the double-blind learning architecture. Agents get fresh templates without gaining insight into why they were recommended.