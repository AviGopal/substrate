# RPC API Annotation & Orchestration Architecture

**Status**: Design Phase  
**Created**: January 30, 2026  
**Version**: 1.0.0

## Executive Summary

This document describes how **metabob-rpc-api** orchestrates the annotation-driven learning system using:

1. **CPG Embeddings**: Vector representations of code structure for similarity matching
2. **Task Embeddings**: Vector representations of task intent for semantic search
3. **Co-change Analysis**: Historical change patterns to predict related components
4. **Annotation Storage**: Per-project annotation budgets and prompt profiles
5. **Recommendation Engine**: Multi-armed bandit algorithms for activity selection

The RPC API becomes the **central orchestrator** that:
- Stores and retrieves annotations per project
- Computes embeddings for components, tasks, and activities
- Tracks co-change patterns across executions
- Recommends activities based on learned associations
- Updates learning graphs from validation feedback

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    metabob-rpc-api (Orchestrator)               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   Storage Layer (SurrealDB)                │ │
│  │                                                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │ Annotations  │  │   Prompts    │  │ Associations │    │ │
│  │  │  (per proj)  │  │  (per comp)  │  │   (graph)    │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  │                                                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │  Embeddings  │  │  Co-change   │  │  Activities  │    │ │
│  │  │(CPG+Task+Ann)│  │   Patterns   │  │  (outcomes)  │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Orchestration Services                  │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Annotation Manager                                  │ │ │
│  │  │  - Load/save annotation budgets per project         │ │ │
│  │  │  - Refine based on validation feedback              │ │ │
│  │  │  - Compute annotation embeddings                    │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Prompt Optimizer                                    │ │ │
│  │  │  - Generate component-specific prompts              │ │ │
│  │  │  - Track effective/ineffective instructions         │ │ │
│  │  │  - Version prompts per component                    │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Embedding Service                                   │ │ │
│  │  │  - CPG embeddings (code structure)                  │ │ │
│  │  │  - Task embeddings (intent vectors)                 │ │ │
│  │  │  - Annotation embeddings (semantic content)         │ │ │
│  │  │  - Similarity search (cosine/euclidean)             │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Co-change Analyzer                                  │ │ │
│  │  │  - Track files changed together                     │ │ │
│  │  │  - Build co-change graph                            │ │ │
│  │  │  - Predict related components                       │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Activity Recommender (existing)                     │ │ │
│  │  │  - Thompson Sampling / UCB / Epsilon-Greedy         │ │ │
│  │  │  - Enhanced with embeddings                         │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  Task Decomposer                                     │ │ │
│  │  │  - Use CPG to identify impacted components          │ │ │
│  │  │  - Use embeddings to match task → activity          │ │ │
│  │  │  - Use co-change to predict related components      │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                      REST API Endpoints                    │ │
│  │                                                             │ │
│  │  POST /api/v1/annotations/load                            │ │
│  │  POST /api/v1/annotations/update                          │ │
│  │  POST /api/v1/prompts/optimize                            │ │
│  │  POST /api/v1/embeddings/compute                          │ │
│  │  POST /api/v1/embeddings/search                           │ │
│  │  POST /api/v1/cochange/analyze                            │ │
│  │  POST /api/v1/cochange/predict                            │ │
│  │  POST /api/v1/tasks/decompose                             │ │
│  │  POST /api/v1/activities/recommend (enhanced)             │ │
│  │  POST /api/v1/feedback/record                             │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenCode Clients (devbob agents)             │
│                                                                 │
│  devbob-opencode → Load annotations → Execute → Record feedback│
│  devbob-rpc-api  → Load annotations → Execute → Record feedback│
│  devbob-cli      → Load annotations → Execute → Record feedback│
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Schemas (SurrealDB)

### 1. Annotation Storage

```sql
-- Component annotations (per project, per component)
DEFINE TABLE component_annotations SCHEMAFULL;
DEFINE FIELD org_id ON TABLE component_annotations TYPE string;
DEFINE FIELD project_id ON TABLE component_annotations TYPE string;
DEFINE FIELD component_id ON TABLE component_annotations TYPE string;
DEFINE FIELD budget ON TABLE component_annotations TYPE object;
DEFINE FIELD budget.max_annotations ON TABLE component_annotations TYPE int DEFAULT 5;
DEFINE FIELD budget.max_tokens_per_annotation ON TABLE component_annotations TYPE int DEFAULT 500;
DEFINE FIELD budget.total_token_budget ON TABLE component_annotations TYPE int DEFAULT 2500;
DEFINE FIELD annotations ON TABLE component_annotations TYPE array;
DEFINE FIELD annotations.* ON TABLE component_annotations TYPE object;
DEFINE FIELD annotations.*.id ON TABLE component_annotations TYPE string;
DEFINE FIELD annotations.*.type ON TABLE component_annotations TYPE string; -- WHY, CONSTRAINT, PATTERN, FAILURE, SUCCESS
DEFINE FIELD annotations.*.content ON TABLE component_annotations TYPE string;
DEFINE FIELD annotations.*.tokens ON TABLE component_annotations TYPE int;
DEFINE FIELD annotations.*.relevance_score ON TABLE component_annotations TYPE float;
DEFINE FIELD annotations.*.success_contributions ON TABLE component_annotations TYPE int;
DEFINE FIELD annotations.*.failure_correlations ON TABLE component_annotations TYPE int;
DEFINE FIELD annotations.*.last_used_at ON TABLE component_annotations TYPE datetime;
DEFINE FIELD annotations.*.created_by ON TABLE component_annotations TYPE string;
DEFINE FIELD annotations.*.created_at ON TABLE component_annotations TYPE datetime;
DEFINE FIELD refinement_generation ON TABLE component_annotations TYPE int DEFAULT 0;
DEFINE FIELD last_refined_at ON TABLE component_annotations TYPE datetime;
DEFINE FIELD created_at ON TABLE component_annotations TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON TABLE component_annotations TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_component_annotations_project ON TABLE component_annotations COLUMNS project_id, component_id UNIQUE;

-- Component prompt profiles (per project, per component)
DEFINE TABLE component_prompts SCHEMAFULL;
DEFINE FIELD org_id ON TABLE component_prompts TYPE string;
DEFINE FIELD project_id ON TABLE component_prompts TYPE string;
DEFINE FIELD component_id ON TABLE component_prompts TYPE string;
DEFINE FIELD effective_instructions ON TABLE component_prompts TYPE array;
DEFINE FIELD effective_instructions.* ON TABLE component_prompts TYPE object;
DEFINE FIELD effective_instructions.*.text ON TABLE component_prompts TYPE string;
DEFINE FIELD effective_instructions.*.success_rate ON TABLE component_prompts TYPE float;
DEFINE FIELD effective_instructions.*.usage_count ON TABLE component_prompts TYPE int;
DEFINE FIELD effective_instructions.*.avg_cost ON TABLE component_prompts TYPE float;
DEFINE FIELD effective_instructions.*.avg_duration ON TABLE component_prompts TYPE int;
DEFINE FIELD ineffective_instructions ON TABLE component_prompts TYPE array;
DEFINE FIELD ineffective_instructions.* ON TABLE component_prompts TYPE object;
DEFINE FIELD required_context ON TABLE component_prompts TYPE array<string>;
DEFINE FIELD optional_context ON TABLE component_prompts TYPE array<string>;
DEFINE FIELD unnecessary_context ON TABLE component_prompts TYPE array<string>;
DEFINE FIELD known_pitfalls ON TABLE component_prompts TYPE array<string>;
DEFINE FIELD successful_approaches ON TABLE component_prompts TYPE array<string>;
DEFINE FIELD optimized_prompt ON TABLE component_prompts TYPE string;
DEFINE FIELD prompt_version ON TABLE component_prompts TYPE int DEFAULT 1;
DEFINE FIELD last_updated_at ON TABLE component_prompts TYPE datetime;
DEFINE FIELD created_at ON TABLE component_prompts TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_component_prompts_project ON TABLE component_prompts COLUMNS project_id, component_id UNIQUE;
```

### 2. Embedding Storage

```sql
-- Component embeddings (CPG-based)
DEFINE TABLE component_embeddings SCHEMAFULL;
DEFINE FIELD org_id ON TABLE component_embeddings TYPE string;
DEFINE FIELD project_id ON TABLE component_embeddings TYPE string;
DEFINE FIELD component_id ON TABLE component_embeddings TYPE string;
DEFINE FIELD embedding_type ON TABLE component_embeddings TYPE string; -- cpg, semantic, hybrid
DEFINE FIELD embedding ON TABLE component_embeddings TYPE array<float>; -- 768-dim vector
DEFINE FIELD embedding_model ON TABLE component_embeddings TYPE string; -- e.g., "sentence-transformers/all-mpnet-base-v2"
DEFINE FIELD embedding_version ON TABLE component_embeddings TYPE string;
DEFINE FIELD metadata ON TABLE component_embeddings TYPE object;
DEFINE FIELD metadata.file_path ON TABLE component_embeddings TYPE string;
DEFINE FIELD metadata.line_number ON TABLE component_embeddings TYPE int;
DEFINE FIELD metadata.component_type ON TABLE component_embeddings TYPE string;
DEFINE FIELD metadata.dependencies ON TABLE component_embeddings TYPE array<string>;
DEFINE FIELD created_at ON TABLE component_embeddings TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON TABLE component_embeddings TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_component_embeddings_project ON TABLE component_embeddings COLUMNS project_id, component_id, embedding_type UNIQUE;

-- Task embeddings (intent-based)
DEFINE TABLE task_embeddings SCHEMAFULL;
DEFINE FIELD task_type ON TABLE task_embeddings TYPE string; -- "fix_memory_leak", "add_feature", etc.
DEFINE FIELD task_description ON TABLE task_embeddings TYPE string;
DEFINE FIELD embedding ON TABLE task_embeddings TYPE array<float>;
DEFINE FIELD embedding_model ON TABLE task_embeddings TYPE string;
DEFINE FIELD created_at ON TABLE task_embeddings TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_task_embeddings_type ON TABLE task_embeddings COLUMNS task_type UNIQUE;

-- Annotation embeddings (semantic content)
DEFINE TABLE annotation_embeddings SCHEMAFULL;
DEFINE FIELD annotation_id ON TABLE annotation_embeddings TYPE string;
DEFINE FIELD component_id ON TABLE annotation_embeddings TYPE string;
DEFINE FIELD project_id ON TABLE annotation_embeddings TYPE string;
DEFINE FIELD embedding ON TABLE annotation_embeddings TYPE array<float>;
DEFINE FIELD annotation_type ON TABLE annotation_embeddings TYPE string;
DEFINE FIELD created_at ON TABLE annotation_embeddings TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_annotation_embeddings_id ON TABLE annotation_embeddings COLUMNS annotation_id UNIQUE;
```

### 3. Co-change Patterns

```sql
-- Co-change patterns (files that change together)
DEFINE TABLE cochange_patterns SCHEMAFULL;
DEFINE FIELD org_id ON TABLE cochange_patterns TYPE string;
DEFINE FIELD project_id ON TABLE cochange_patterns TYPE string;
DEFINE FIELD file_a ON TABLE cochange_patterns TYPE string;
DEFINE FIELD file_b ON TABLE cochange_patterns TYPE string;
DEFINE FIELD cochange_count ON TABLE cochange_patterns TYPE int DEFAULT 1;
DEFINE FIELD total_changes ON TABLE cochange_patterns TYPE int; -- Total changes to file_a
DEFINE FIELD confidence ON TABLE cochange_patterns TYPE float; -- cochange_count / total_changes
DEFINE FIELD last_changed_together ON TABLE cochange_patterns TYPE datetime;
DEFINE FIELD created_at ON TABLE cochange_patterns TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON TABLE cochange_patterns TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_cochange_project ON TABLE cochange_patterns COLUMNS project_id, file_a, file_b UNIQUE;

-- Component co-change (component-level granularity)
DEFINE TABLE component_cochange SCHEMAFULL;
DEFINE FIELD org_id ON TABLE component_cochange TYPE string;
DEFINE FIELD project_id ON TABLE component_cochange TYPE string;
DEFINE FIELD component_a ON TABLE component_cochange TYPE string;
DEFINE FIELD component_b ON TABLE component_cochange TYPE string;
DEFINE FIELD cochange_count ON TABLE component_cochange TYPE int DEFAULT 1;
DEFINE FIELD confidence ON TABLE component_cochange TYPE float;
DEFINE FIELD activity_ids ON TABLE component_cochange TYPE array<string>; -- Activities that changed both
DEFINE FIELD last_changed_together ON TABLE component_cochange TYPE datetime;
DEFINE FIELD created_at ON TABLE component_cochange TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_component_cochange_project ON TABLE component_cochange COLUMNS project_id, component_a, component_b UNIQUE;
```

### 4. Association Graph

```sql
-- Component-Impulse associations
DEFINE TABLE component_impulse_associations SCHEMAFULL;
DEFINE FIELD org_id ON TABLE component_impulse_associations TYPE string;
DEFINE FIELD project_id ON TABLE component_impulse_associations TYPE string;
DEFINE FIELD component_id ON TABLE component_impulse_associations TYPE string;
DEFINE FIELD impulse_id ON TABLE component_impulse_associations TYPE string;
DEFINE FIELD success_count ON TABLE component_impulse_associations TYPE int DEFAULT 0;
DEFINE FIELD failure_count ON TABLE component_impulse_associations TYPE int DEFAULT 0;
DEFINE FIELD weight ON TABLE component_impulse_associations TYPE float; -- success_count / (success_count + failure_count)
DEFINE FIELD confidence ON TABLE component_impulse_associations TYPE float; -- min(1.0, total_count / 10)
DEFINE FIELD last_updated_at ON TABLE component_impulse_associations TYPE datetime;
DEFINE FIELD created_at ON TABLE component_impulse_associations TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_comp_impulse_project ON TABLE component_impulse_associations COLUMNS project_id, component_id, impulse_id UNIQUE;

-- Component-Task associations
DEFINE TABLE component_task_associations SCHEMAFULL;
DEFINE FIELD org_id ON TABLE component_task_associations TYPE string;
DEFINE FIELD project_id ON TABLE component_task_associations TYPE string;
DEFINE FIELD component_id ON TABLE component_task_associations TYPE string;
DEFINE FIELD task_type ON TABLE component_task_associations TYPE string;
DEFINE FIELD success_count ON TABLE component_task_associations TYPE int DEFAULT 0;
DEFINE FIELD failure_count ON TABLE component_task_associations TYPE int DEFAULT 0;
DEFINE FIELD weight ON TABLE component_task_associations TYPE float;
DEFINE FIELD confidence ON TABLE component_task_associations TYPE float;
DEFINE FIELD avg_cost ON TABLE component_task_associations TYPE float;
DEFINE FIELD avg_duration ON TABLE component_task_associations TYPE int;
DEFINE FIELD last_updated_at ON TABLE component_task_associations TYPE datetime;
DEFINE FIELD created_at ON TABLE component_task_associations TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_comp_task_project ON TABLE component_task_associations COLUMNS project_id, component_id, task_type UNIQUE;

-- Task-Activity associations
DEFINE TABLE task_activity_associations SCHEMAFULL;
DEFINE FIELD task_type ON TABLE task_activity_associations TYPE string;
DEFINE FIELD activity_id ON TABLE task_activity_associations TYPE string;
DEFINE FIELD success_count ON TABLE task_activity_associations TYPE int DEFAULT 0;
DEFINE FIELD failure_count ON TABLE task_activity_associations TYPE int DEFAULT 0;
DEFINE FIELD weight ON TABLE task_activity_associations TYPE float;
DEFINE FIELD confidence ON TABLE task_activity_associations TYPE float;
DEFINE FIELD projects_used ON TABLE task_activity_associations TYPE array<string>; -- Which projects used this combo
DEFINE FIELD last_updated_at ON TABLE task_activity_associations TYPE datetime;
DEFINE FIELD created_at ON TABLE task_activity_associations TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_task_activity ON TABLE task_activity_associations COLUMNS task_type, activity_id UNIQUE;
```

---

## API Endpoints

### 1. Annotation Management

```python
# POST /api/v1/annotations/load
{
  "org_id": "org_123",
  "project_id": "project_456",
  "component_ids": ["src/session/index.ts::messages", "src/activity/activity.ts::Activity"]
}

# Response:
{
  "annotations": {
    "src/session/index.ts::messages": {
      "budget": {
        "max_annotations": 5,
        "total_token_budget": 2500
      },
      "annotations": [
        {
          "id": "ann_abc123",
          "type": "SUCCESS",
          "content": "Memory leak fixed by adding default limit...",
          "relevance_score": 0.95,
          "tokens": 85
        }
      ],
      "total_tokens": 450,
      "budget_used_percent": 18
    }
  }
}

# POST /api/v1/annotations/update
{
  "org_id": "org_123",
  "project_id": "project_456",
  "component_id": "src/session/index.ts::messages",
  "validation_result": {
    "success": true,
    "insight": "Schema default + runtime fallback both required",
    "cost": 0.04,
    "duration": 12000,
    "impulse_ids": ["impulse_xyz"]
  }
}

# Response:
{
  "annotations_updated": {
    "added": [
      {
        "id": "ann_def456",
        "type": "SUCCESS",
        "content": "...",
        "relevance_score": 1.0
      }
    ],
    "evicted": [
      {
        "id": "ann_old789",
        "reason": "Low relevance (0.12)"
      }
    ],
    "boosted": ["ann_abc123"],
    "total_tokens": 1850,
    "budget_used_percent": 74
  },
  "prompt_updated": {
    "component_id": "src/session/index.ts::messages",
    "version": 3,
    "effective_instructions_added": 1,
    "ineffective_instructions_added": 0
  },
  "associations_updated": {
    "edges_updated": 4,
    "edges_created": 2,
    "edges_pruned": 1
  }
}
```

### 2. Prompt Optimization

```python
# POST /api/v1/prompts/optimize
{
  "org_id": "org_123",
  "project_id": "project_456",
  "component_id": "src/session/index.ts::messages",
  "task_type": "fix_memory_leak"
}

# Response:
{
  "optimized_prompt": "Fix memory leak in Session.messages\n\n✅ EFFECTIVE (87% success):\n- Add schema default + runtime fallback\n\n❌ AVOID (23% success):\n- Creating manager classes\n- Adding LRU caches\n\n⚠️ PITFALL: Schema default alone insufficient",
  "prompt_version": 3,
  "effective_instructions": [
    {
      "text": "Add schema default and runtime fallback",
      "success_rate": 0.87,
      "usage_count": 15
    }
  ],
  "ineffective_instructions": [
    {
      "text": "Add LRU cache",
      "success_rate": 0.23,
      "usage_count": 7
    }
  ],
  "required_context": ["src/session/message.ts", "tests/session.test.ts"],
  "optimal_impulses": [
    {
      "impulse_id": "impulse_xyz",
      "score": 0.92,
      "tokens": 800,
      "reason": "Helped in 11/12 previous fixes"
    }
  ]
}
```

### 3. Embedding Search

```python
# POST /api/v1/embeddings/search
{
  "org_id": "org_123",
  "project_id": "project_456",
  "query": {
    "type": "task",
    "text": "Fix memory leak where messages accumulate unbounded"
  },
  "search_type": "component",  # or "task", "annotation", "activity"
  "top_k": 10
}

# Response:
{
  "results": [
    {
      "component_id": "src/session/index.ts::messages",
      "similarity": 0.94,
      "metadata": {
        "file_path": "src/session/index.ts",
        "line_number": 42,
        "component_type": "function"
      },
      "reason": "High semantic similarity to 'unbounded message accumulation'"
    },
    {
      "component_id": "src/activity/activity.ts::save",
      "similarity": 0.76,
      "metadata": {...},
      "reason": "Similar pattern: unbounded array growth"
    }
  ],
  "query_embedding": [0.12, -0.34, ...],  # 768-dim vector
  "search_metadata": {
    "embedding_model": "sentence-transformers/all-mpnet-base-v2",
    "search_time_ms": 45,
    "total_components": 1523
  }
}
```

### 4. Co-change Analysis

```python
# POST /api/v1/cochange/predict
{
  "org_id": "org_123",
  "project_id": "project_456",
  "changed_files": ["src/session/index.ts"],
  "min_confidence": 0.5
}

# Response:
{
  "related_files": [
    {
      "file_path": "src/session/message.ts",
      "confidence": 0.87,
      "cochange_count": 23,
      "last_changed_together": "2026-01-15T10:30:00Z",
      "reason": "Changed together in 87% of session-related activities"
    },
    {
      "file_path": "tests/session.test.ts",
      "confidence": 0.92,
      "cochange_count": 31,
      "last_changed_together": "2026-01-20T14:22:00Z",
      "reason": "Test file - changed with index.ts in 92% of activities"
    }
  ],
  "related_components": [
    {
      "component_id": "src/session/message.ts::MessageV2",
      "confidence": 0.78,
      "reason": "Called by Session.messages, changed together 15 times"
    }
  ]
}

# POST /api/v1/cochange/record
{
  "org_id": "org_123",
  "project_id": "project_456",
  "activity_id": "activity_abc123",
  "changed_files": [
    "src/session/index.ts",
    "src/session/message.ts",
    "tests/session.test.ts"
  ],
  "changed_components": [
    "src/session/index.ts::messages",
    "src/session/message.ts::MessageV2"
  ]
}

# Response:
{
  "patterns_updated": 3,
  "new_patterns": 1,
  "confidence_increased": [
    {
      "file_a": "src/session/index.ts",
      "file_b": "tests/session.test.ts",
      "old_confidence": 0.88,
      "new_confidence": 0.92
    }
  ]
}
```

### 5. Task Decomposition

```python
# POST /api/v1/tasks/decompose
{
  "org_id": "org_123",
  "project_id": "project_456",
  "task_description": "Fix memory leak in session messages",
  "task_type": "fix_memory_leak",
  "use_cpg": true,
  "use_embeddings": true,
  "use_cochange": true
}

# Response:
{
  "decomposition": {
    "impacted_components": [
      {
        "component_id": "src/session/index.ts::messages",
        "impact_type": "modify",
        "impact_reason": "Root cause - no default limit",
        "confidence": 0.95,
        "source": "cpg_analysis"
      }
    ],
    "related_components": [
      {
        "component_id": "src/session/message.ts::MessageV2",
        "relationship": "dependency",
        "confidence": 0.78,
        "source": "cochange_pattern"
      }
    ],
    "change_sequence": [
      {
        "step": 1,
        "components": ["src/session/index.ts::messages"],
        "rationale": "Add default limit to prevent unbounded growth",
        "validation_criteria": ["Memory < 100MB after 1000 operations"]
      }
    ],
    "recommended_activities": [
      {
        "activity_id": "fix-bug-complete",
        "confidence": 0.88,
        "reason": "High success rate (85%) for similar memory leak fixes",
        "source": "embedding_match + historical_success"
      }
    ],
    "optimal_context": {
      "annotations": [
        {
          "annotation_id": "ann_abc123",
          "component_id": "src/session/index.ts::messages",
          "relevance_score": 0.95,
          "tokens": 85
        }
      ],
      "impulses": [
        {
          "impulse_id": "impulse_xyz",
          "score": 0.92,
          "tokens": 800,
          "reason": "Helped in 11/12 similar fixes"
        }
      ],
      "total_tokens": 2400,
      "budget_used": "48%"
    }
  },
  "analysis_metadata": {
    "cpg_components_analyzed": 47,
    "embedding_similarity_threshold": 0.7,
    "cochange_patterns_found": 12,
    "total_analysis_time_ms": 234
  }
}
```

### 6. Enhanced Activity Recommendation

```python
# POST /api/v1/activities/recommend
{
  "org_id": "org_123",
  "project_id": "project_456",
  "consumer_id": "consumer_hash",
  "intent": "Fix memory leak in session messages",
  "context": {
    "task_type": "fix_memory_leak",
    "impacted_components": ["src/session/index.ts::messages"],
    "project_domain": "backend-nodejs"
  },
  "algorithm": "thompson_sampling",
  "exploration_rate": 0.1,
  "use_embeddings": true
}

# Response:
{
  "recommendations": [
    {
      "activity_id": "fix-bug-complete",
      "score": 0.88,
      "confidence": 0.92,
      "reasoning": {
        "historical_success": 0.85,  # 85% success rate for this task type
        "embedding_similarity": 0.94,  # High semantic similarity
        "cochange_alignment": 0.76,  # Components frequently change together
        "exploration_bonus": 0.05  # Thompson sampling exploration
      },
      "expected_cost": 0.04,
      "expected_duration": 12000,
      "success_probability": 0.85,
      "impression_id": "imp_abc123"
    },
    {
      "activity_id": "fix-memory-leak-specialized",
      "score": 0.82,
      "confidence": 0.67,
      "reasoning": {...},
      "expected_cost": 0.06,
      "expected_duration": 18000,
      "success_probability": 0.78,
      "impression_id": "imp_def456"
    }
  ],
  "algorithm_metadata": {
    "algorithm": "thompson_sampling",
    "exploration_rate": 0.1,
    "sampled_values": {...},
    "variants_considered": 15,
    "embeddings_used": true
  }
}
```

### 7. Feedback Recording

```python
# POST /api/v1/feedback/record
{
  "org_id": "org_123",
  "project_id": "project_456",
  "activity_id": "activity_abc123",
  "validation_result": {
    "success": true,
    "component_ids": ["src/session/index.ts::messages"],
    "impulse_ids": ["impulse_xyz", "impulse_abc"],
    "task_type": "fix_memory_leak",
    "cost": 0.04,
    "duration": 12000,
    "metrics": {
      "memory_before": 16000,
      "memory_after": 95,
      "reduction_percent": 99.4
    },
    "insight": "Schema default + runtime fallback both required"
  },
  "changed_files": ["src/session/index.ts"],
  "changed_components": ["src/session/index.ts::messages"]
}

# Response:
{
  "annotations_updated": true,
  "prompts_updated": true,
  "associations_updated": true,
  "cochange_recorded": true,
  "activity_variant_updated": true,
  "updates": {
    "annotations": {
      "components_updated": 1,
      "annotations_added": 1,
      "annotations_evicted": 0
    },
    "prompts": {
      "components_updated": 1,
      "version_incremented": true,
      "new_version": 3
    },
    "associations": {
      "edges_updated": 4,
      "edges_created": 2,
      "edges_pruned": 1
    },
    "cochange": {
      "patterns_updated": 3,
      "new_patterns": 0
    },
    "activity_variant": {
      "variant_id": "variant_abc123",
      "conversions_incremented": true,
      "new_success_rate": 0.86
    }
  }
}
```

---

## Orchestration Flow: Complete Example

### Scenario: Agent Requests Fix for Memory Leak

```python
# ============================================================================
# Step 1: Agent submits task
# ============================================================================

POST /api/v1/tasks/decompose
{
  "org_id": "org_123",
  "project_id": "project_456",
  "task_description": "Fix memory leak in session messages",
  "task_type": "fix_memory_leak"
}

# RPC API orchestrates:
# 1. Compute task embedding (intent vector)
# 2. Search component embeddings (find similar components)
# 3. Query co-change patterns (find related components)
# 4. Load annotations for matched components
# 5. Select optimal context (knapsack algorithm)
# 6. Generate change sequence

# Response: TaskDecomposition (see above)

# ============================================================================
# Step 2: Agent requests activity recommendation
# ============================================================================

POST /api/v1/activities/recommend
{
  "org_id": "org_123",
  "project_id": "project_456",
  "intent": "Fix memory leak in session messages",
  "context": {
    "task_type": "fix_memory_leak",
    "impacted_components": ["src/session/index.ts::messages"]
  },
  "use_embeddings": true
}

# RPC API orchestrates:
# 1. Load component-task associations (which activities worked before)
# 2. Compute embedding similarity (task → activity)
# 3. Check co-change alignment (activity components vs. target components)
# 4. Run Thompson Sampling (exploration/exploitation)
# 5. Rank activities by expected value

# Response: ActivityRecommendations (see above)

# ============================================================================
# Step 3: Agent loads optimal prompt
# ============================================================================

POST /api/v1/prompts/optimize
{
  "org_id": "org_123",
  "project_id": "project_456",
  "component_id": "src/session/index.ts::messages",
  "task_type": "fix_memory_leak"
}

# RPC API orchestrates:
# 1. Load component prompt profile
# 2. Load effective/ineffective instructions
# 3. Load known pitfalls
# 4. Generate optimized prompt template
# 5. Include optimal impulses from associations

# Response: OptimizedPrompt (see above)

# ============================================================================
# Step 4: Agent executes fix (locally)
# ============================================================================

# Agent uses optimized prompt + context to execute fix
# (This happens in opencode, not in RPC API)

# ============================================================================
# Step 5: Agent records feedback
# ============================================================================

POST /api/v1/feedback/record
{
  "org_id": "org_123",
  "project_id": "project_456",
  "activity_id": "activity_abc123",
  "validation_result": {
    "success": true,
    "component_ids": ["src/session/index.ts::messages"],
    "impulse_ids": ["impulse_xyz"],
    "task_type": "fix_memory_leak",
    "cost": 0.04,
    "duration": 12000,
    "insight": "Schema default + runtime fallback both required"
  }
}

# RPC API orchestrates (atomically):
# 1. Update annotations (refine scores, add new, evict old)
# 2. Update prompt profile (move instructions, add pitfall, version++)
# 3. Update associations (boost helpful, prune unhelpful)
# 4. Record co-change (increment patterns)
# 5. Update activity variant (increment conversions)
# 6. Compute new embeddings (if annotations changed significantly)

# Response: FeedbackRecorded (see above)

# ============================================================================
# Result: System has learned
# ============================================================================

# Next time similar task is submitted:
# - Decomposition will find component faster (embedding similarity)
# - Recommendation will rank correct activity higher (historical success)
# - Prompt will guide toward effective solution (learned instructions)
# - Context will include helpful impulses (association strength)
# - Co-change will predict related components (pattern confidence)
```

---

## Implementation in metabob-rpc-api

### New Modules to Add

```
server/
  actions/
    annotation_management.py       # NEW: CRUD for annotations
    prompt_optimization.py         # NEW: Generate optimized prompts
    embedding_service.py           # NEW: Compute/search embeddings
    cochange_analyzer.py           # NEW: Track/predict co-change
    task_decomposition.py          # NEW: Decompose tasks using all signals
    feedback_processor.py          # NEW: Process validation feedback
  
  routes/
    annotations.py                 # NEW: /api/v1/annotations/*
    prompts.py                     # NEW: /api/v1/prompts/*
    embeddings.py                  # NEW: /api/v1/embeddings/*
    cochange.py                    # NEW: /api/v1/cochange/*
    tasks.py                       # NEW: /api/v1/tasks/*
  
  services/
    embedding_engine.py            # NEW: Vector embedding service
    learning_orchestrator.py       # NEW: Coordinate learning updates
```

### Integration with Existing Code

**Enhance `activity_recommendations.py`**:
```python
async def get_recommendations(
    db: SurrealDBClient,
    request: RecommendationRequest,
) -> RecommendationResponse:
    """Enhanced with embeddings and associations."""
    
    # NEW: Load task embedding
    task_embedding = await compute_task_embedding(request.intent)
    
    # NEW: Search similar activities by embedding
    similar_activities = await search_activities_by_embedding(
        db=db,
        query_embedding=task_embedding,
        project_id=request.project_id,
        top_k=20
    )
    
    # NEW: Filter by co-change alignment
    if request.context.get("impacted_components"):
        similar_activities = await filter_by_cochange_alignment(
            db=db,
            activities=similar_activities,
            target_components=request.context["impacted_components"]
        )
    
    # Existing: Run Thompson Sampling
    recommendations = await thompson_sampling(
        db=db,
        variants=similar_activities,
        consumer_id=request.consumer_id,
        exploration_rate=request.exploration_rate
    )
    
    # NEW: Enrich with association data
    for rec in recommendations:
        rec.reasoning["embedding_similarity"] = ...
        rec.reasoning["cochange_alignment"] = ...
        rec.reasoning["historical_success"] = ...
    
    return RecommendationResponse(recommendations=recommendations)
```

**Enhance `activity_learning.py`**:
```python
async def record_activity_feedback(
    db: SurrealDBClient,
    feedback: ActivityExecutionFeedback,
) -> None:
    """Enhanced with annotation/prompt/association updates."""
    
    # Existing: Update activity metrics
    await update_activity_metrics(db, feedback)
    
    # NEW: Update annotations
    await update_annotations(
        db=db,
        org_id=feedback.org_id,
        project_id=feedback.project_id,
        component_ids=feedback.component_ids,
        validation_result=feedback.validation_result
    )
    
    # NEW: Update prompt profiles
    await optimize_prompts(
        db=db,
        org_id=feedback.org_id,
        project_id=feedback.project_id,
        component_ids=feedback.component_ids,
        validation_result=feedback.validation_result
    )
    
    # NEW: Update associations
    await update_associations(
        db=db,
        org_id=feedback.org_id,
        project_id=feedback.project_id,
        feedback=feedback
    )
    
    # NEW: Record co-change
    await record_cochange(
        db=db,
        org_id=feedback.org_id,
        project_id=feedback.project_id,
        activity_id=feedback.activity_id,
        changed_files=feedback.changed_files,
        changed_components=feedback.changed_components
    )
    
    # NEW: Update embeddings (if annotations changed significantly)
    if feedback.validation_result.has_new_insight:
        await recompute_embeddings(
            db=db,
            component_ids=feedback.component_ids,
            annotation_ids=feedback.new_annotation_ids
        )
```

---

## Next Steps

1. **Week 1**: Implement schemas + annotation management endpoints
2. **Week 2**: Implement embedding service (CPG, task, annotation vectors)
3. **Week 3**: Implement co-change analyzer + task decomposer
4. **Week 4**: Enhance activity recommender with embeddings
5. **Week 5**: Implement feedback processor (update all systems atomically)
6. **Week 6**: Integration testing + performance tuning

---

**Status**: Ready for Implementation  
**Dependencies**: SurrealDB, sentence-transformers, metabob CPG API  
**Estimated Effort**: 6 weeks (2 backend engineers)
