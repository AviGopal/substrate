# Distributed Architecture: Client-Side CPG + Server-Side Learning

**Status**: Implementation Ready  
**Created**: January 30, 2026  
**Last Updated**: January 30, 2026  
**Version**: 2.0.0 (REVISED)

## Executive Summary

This document describes the **distributed architecture implementing double-blind learning** where agents make task decisions while the server learns from outcomes without any mixing or bias. The architecture separates concerns cleanly: agents focus on completing tasks effectively using pure CPG analysis, while the RPC API server uses Thompson Sampling and association learning to improve recommendations without exposing internal metrics to agents.

**Core Components**:

1. **metabob-cli MCP Sidecar** (client-side):
   - Runs cpg-inference locally (fast <10ms CPG analysis, 32-dim embeddings)
   - Provides pure MCP interface with NO learning data or similarity scores
   - Computes component embeddings client-side for server synchronization
   - Returns WHAT (component IDs, dependencies) never WHY or confidence scores

2. **metabob-rpc-api** (server-side):
   - Implements double-blind Thompson Sampling for activity variant assignment
   - Vector search for component similarity using 32-dimensional embeddings  
   - Association learning for context selection (component ↔ impulse weights)
   - All learning metrics hidden from agents via minimal API interfaces

3. **All agents** (devbob-opencode, devbob-rpc-api, devbob-cli):
   - Connect to local metabob-cli MCP sidecar for pure CPG analysis
   - Receive recommendations without scores, probabilities, or internal metrics
   - Provide feedback via opaque impression IDs for clean learning signals

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent (devbob-opencode)                      │
│                                                                 │
│  "Fix memory leak in session messages"                         │
└────────────┬────────────────────────────────────────────────────┘
             │ MCP call
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              metabob-cli MCP Sidecar (LOCAL)                    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  CPG Manager (cpg-inference)                              │ │
│  │  - CoChangePredictor (GNN model, 32-dim)                 │ │
│  │  - SQLite storage (persistent cache)                     │ │
│  │  - FAISS index (component similarity)                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  MCP Tools Exposed:                                             │
│  - metabob_search_codebase_issues                              │
│  - metabob_analyze_change_impact                               │
│  - metabob_assess_deletion_safety                              │
│  - metabob_suggest_related_changes                             │
│  - metabob_annotate_component (client-side cache)              │
│  - metabob_list_file_components                                │
│  - metabob_get_component_embeddings (NEW)                      │
└────────────┬────────────────────────────────────────────────────┘
             │ HTTP/REST (for server-side features)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    metabob-rpc-api (SERVER)                     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Text Embedding Service                                   │ │
│  │  - Embed tasks (intent vectors)                           │ │
│  │  - Embed impulses (context vectors)                       │ │
│  │  - Embed annotations (knowledge vectors)                  │ │
│  │  - Use simple text model (sentence-transformers)          │ │
│  │  - Output: 32-dim (same as CPG for compatibility)         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  SurrealDB Storage                                        │ │
│  │  - Annotations (per project, per component)               │ │
│  │  - Component metadata (synced from MCP)                   │ │
│  │  - CPG embeddings (synced from MCP)                       │ │
│  │  - Text embeddings (tasks, impulses, annotations)         │ │
│  │  - Association graph (component↔impulse↔task↔activity)    │ │
│  │  - Co-change patterns                                     │ │
│  │  - Activity variant metrics (Thompson Sampling params)    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Celery Beat (Periodic Tasks)                             │ │
│  │  - Update association weights (hourly)                    │ │
│  │  - Recompute recommendations (daily)                      │ │
│  │  - Prune weak associations (weekly)                       │ │
│  │  - Update activity variant params (on feedback)           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  REST API Endpoints:                                            │
│  - POST /api/v1/annotations/load                               │
│  - POST /api/v1/annotations/update                             │
│  - POST /api/v1/embeddings/text (task, impulse, annotation)    │
│  - POST /api/v1/tasks/decompose (uses MCP + text embeddings)   │
│  - POST /api/v1/activities/recommend (Thompson Sampling)       │
│  - POST /api/v1/feedback/record (triggers Celery task)         │
│  - GET  /api/v1/associations/search (SurrealDB vector search)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Complete Example

### Scenario: Agent Needs to Fix Memory Leak

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Agent → MCP (Get CPG Analysis)                         │
└─────────────────────────────────────────────────────────────────┘

devbob-opencode → metabob-cli MCP sidecar

MCP Call: metabob_search_codebase_issues
{
  "query": "memory leak session messages"
}

MCP Sidecar (local):
1. cpg_inference searches indexed components
2. Returns matches with similarity scores
3. Fast (<10ms, all local)

Response:
{
  "results": [
    {
      "component_id": "src/session/index.ts::messages",
      "similarity": 0.94,
      "file_path": "src/session/index.ts"
    }
  ]
}

┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Agent → MCP (Get Component Embeddings)                 │
└─────────────────────────────────────────────────────────────────┘

MCP Call: metabob_get_component_embeddings (NEW)
{
  "file_path": "src/session/index.ts"
}

MCP Sidecar (local):
1. cpg_inference.get_component_embeddings()
2. Returns 32-dim embeddings from FAISS

Response:
{
  "embeddings": {
    "src/session/index.ts::messages": [0.1, -0.2, ...],  # 32-dim
    "src/session/index.ts::Session": [0.3, 0.1, ...]     # 32-dim
  }
}

┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Agent → RPC API (Sync to SurrealDB)                    │
└─────────────────────────────────────────────────────────────────┘

POST /api/v1/components/sync
{
  "org_id": "org_123",
  "project_id": "project_456",
  "components": [
    {
      "component_id": "src/session/index.ts::messages",
      "embedding": [0.1, -0.2, ...],  # From MCP
      "metadata": {
        "file_path": "src/session/index.ts",
        "type": "function",
        "line": 42
      }
    }
  ]
}

RPC API:
1. Store component metadata in SurrealDB
2. Store CPG embeddings
3. Return acknowledgment

┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Agent → RPC API (Get Recommendations)                  │
└─────────────────────────────────────────────────────────────────┘

POST /api/v1/tasks/decompose
{
  "org_id": "org_123",
  "project_id": "project_456",
  "task_description": "Fix memory leak in session messages",
  "component_ids": ["src/session/index.ts::messages"]
}

RPC API:
1. Embed task text (server-side text embedder)
   task_emb = text_embedder.embed("Fix memory leak...")  # 32-dim
   
2. Query SurrealDB for similar components
   SELECT * FROM components 
   WHERE project_id = 'project_456'
   AND vector::similarity::cosine(embedding, $task_emb) > 0.7
   ORDER BY vector::similarity::cosine(embedding, $task_emb) DESC
   LIMIT 10
   
3. Load annotations for matched components
   
4. Query associations (component↔task historical success)
   
5. Return decomposition

Response:
{
  "impacted_components": [
    {
      "component_id": "src/session/index.ts::messages",
      "match_score": 0.94,
      "match_reason": "CPG similarity + annotation keywords",
      "annotations": [...]
    }
  ],
  "recommended_activity": "fix-bug-complete",
  "optimal_context": {
    "impulses": ["impulse_xyz"],
    "annotations": [...]
  }
}

┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Agent → RPC API (Record Feedback)                      │
└─────────────────────────────────────────────────────────────────┘

POST /api/v1/feedback/record
{
  "org_id": "org_123",
  "project_id": "project_456",
  "validation_result": {
    "success": true,
    "component_ids": ["src/session/index.ts::messages"],
    "task_type": "fix_memory_leak",
    "activity_id": "fix-bug-complete",
    "cost": 0.04,
    "duration": 12000
  }
}

RPC API:
1. Store feedback in SurrealDB
2. Trigger Celery task: update_associations.delay(feedback)
3. Return acknowledgment

Celery Worker (async):
1. Update association weights
2. Update activity variant metrics
3. Refine annotations
4. Prune weak associations
```

---

## MCP Tools (Client-Side)

### Existing Tools (Already Implemented)

```python
# metabob-cli MCP sidecar exposes these tools

@mcp.tool()
async def metabob_search_codebase_issues(query: str, max_results: int = 10):
    """Search for components similar to query using CPG embeddings."""
    # Uses cpg_inference.predict_cochanges()
    pass

@mcp.tool()
async def metabob_analyze_change_impact(file_path: str, component_name: str):
    """Analyze impact of changing a component."""
    # Uses cpg_inference GraphQueryEngine
    pass

@mcp.tool()
async def metabob_assess_deletion_safety(file_path: str, component_name: str):
    """Check if component can be safely deleted."""
    # Uses cpg_inference liveness analysis
    pass

@mcp.tool()
async def metabob_suggest_related_changes(changed_files: list[str]):
    """Suggest related files that may need changes."""
    # Uses cpg_inference co-change prediction
    pass

@mcp.tool()
async def metabob_list_file_components(file_path: str):
    """List all components in a file."""
    # Uses cpg_inference component extraction
    pass
```

### New Tool to Add

```python
# metabob-cli/src/metabob_cli/mcp/tools.py

@mcp.tool()
async def metabob_get_component_embeddings(
    file_path: str,
    component_ids: list[str] | None = None
) -> dict[str, list[float]]:
    """Get CPG embeddings for components.
    
    Args:
        file_path: File to get embeddings from
        component_ids: Optional filter for specific components
        
    Returns:
        Map of component_id → 32-dim embedding vector
    """
    cpg_manager = get_cpg_manager()  # From existing context
    
    # Get embeddings from cpg_inference
    all_files = {file_path: read_file_content(file_path)}
    embeddings = cpg_manager.predictor.get_component_embeddings(
        file_path=file_path,
        files=all_files
    )
    
    # Filter if component_ids provided
    if component_ids:
        embeddings = {
            comp_id: emb
            for comp_id, emb in embeddings.items()
            if comp_id in component_ids
        }
    
    # Convert numpy arrays to lists for JSON serialization
    return {
        comp_id: emb.tolist()
        for comp_id, emb in embeddings.items()
    }
```

---

## RPC API Implementation

### Text Embedding Service (Server-Side)

```python
# server/services/text_embeddings.py

from sentence_transformers import SentenceTransformer
import numpy as np

class TextEmbeddingService:
    """Text embedding service using sentence-transformers.
    
    Outputs 32-dim embeddings to match CPG embedding dimension.
    """
    
    def __init__(self):
        # Use compact model, project to 32-dim to match CPG
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.embedding_dim = 32
        
        # Projection matrix: 384-dim → 32-dim
        # Learned via PCA on sample embeddings or random projection
        self.projection = self._initialize_projection()
    
    def _initialize_projection(self) -> np.ndarray:
        """Initialize projection matrix (384 → 32)."""
        # Simple random projection (could be learned)
        np.random.seed(42)
        return np.random.randn(384, 32) / np.sqrt(384)
    
    def embed_text(self, text: str) -> np.ndarray:
        """Embed text to 32-dim vector.
        
        Args:
            text: Text to embed
            
        Returns:
            32-dim embedding vector
        """
        # Get 384-dim embedding from sentence-transformers
        emb_384 = self.model.encode(text, convert_to_numpy=True)
        
        # Project to 32-dim
        emb_32 = emb_384 @ self.projection
        
        # L2 normalize
        emb_32 = emb_32 / np.linalg.norm(emb_32)
        
        return emb_32
    
    def embed_batch(self, texts: list[str]) -> np.ndarray:
        """Embed multiple texts."""
        embeddings_384 = self.model.encode(texts, convert_to_numpy=True)
        embeddings_32 = embeddings_384 @ self.projection
        # L2 normalize
        norms = np.linalg.norm(embeddings_32, axis=1, keepdims=True)
        embeddings_32 = embeddings_32 / norms
        return embeddings_32

# Global instance
_text_embedder: TextEmbeddingService | None = None

def get_text_embedder() -> TextEmbeddingService:
    global _text_embedder
    if _text_embedder is None:
        _text_embedder = TextEmbeddingService()
    return _text_embedder
```

### REST Endpoints

```python
# server/routes/embeddings.py

from fastapi import APIRouter
from server.services.text_embeddings import get_text_embedder
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/embeddings", tags=["embeddings"])

class TextEmbeddingRequest(BaseModel):
    text: str
    embedding_type: str = "task"  # task, impulse, annotation

@router.post("/text")
async def embed_text_endpoint(request: TextEmbeddingRequest):
    """Embed text to 32-dim vector."""
    embedder = get_text_embedder()
    embedding = embedder.embed_text(request.text)
    
    return {
        "embedding": embedding.tolist(),
        "dimension": 32,
        "type": request.embedding_type
    }

class ComponentSyncRequest(BaseModel):
    org_id: str
    project_id: str
    components: list[dict]  # [{component_id, embedding, metadata}]

@router.post("/components/sync")
async def sync_components_endpoint(
    request: ComponentSyncRequest,
    db: SurrealDBClient = Depends(get_db)
):
    """Sync component embeddings from MCP to SurrealDB."""
    
    # Store in SurrealDB
    for component in request.components:
        await db.query("""
            UPDATE components
            SET 
                embedding = $embedding,
                metadata = $metadata,
                updated_at = time::now()
            WHERE project_id = $project_id
            AND component_id = $component_id
        """, {
            "project_id": request.project_id,
            "component_id": component["component_id"],
            "embedding": component["embedding"],
            "metadata": component.get("metadata", {})
        })
    
    return {
        "synced": len(request.components),
        "project_id": request.project_id
    }
```

---

## SurrealDB Schema with Vector Search

```sql
-- Components table with vector embeddings
DEFINE TABLE components SCHEMAFULL;
DEFINE FIELD org_id ON TABLE components TYPE string;
DEFINE FIELD project_id ON TABLE components TYPE string;
DEFINE FIELD component_id ON TABLE components TYPE string;
DEFINE FIELD embedding ON TABLE components TYPE array<float>;  -- 32-dim vector
DEFINE FIELD metadata ON TABLE components TYPE object;
DEFINE FIELD created_at ON TABLE components TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON TABLE components TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_components_project ON TABLE components COLUMNS project_id, component_id UNIQUE;

-- Vector search (SurrealDB 2.0+ feature)
-- Define embedding dimension for optimized vector search
DEFINE INDEX idx_components_embedding ON TABLE components 
    FIELDS embedding 
    MTREE DIMENSION 32 DISTANCE COSINE;

-- Task embeddings
DEFINE TABLE task_embeddings SCHEMAFULL;
DEFINE FIELD task_type ON TABLE task_embeddings TYPE string;
DEFINE FIELD description ON TABLE task_embeddings TYPE string;
DEFINE FIELD embedding ON TABLE task_embeddings TYPE array<float>;
DEFINE FIELD created_at ON TABLE task_embeddings TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_task_embeddings_type ON TABLE task_embeddings COLUMNS task_type UNIQUE;
DEFINE INDEX idx_task_embeddings_vector ON TABLE task_embeddings 
    FIELDS embedding 
    MTREE DIMENSION 32 DISTANCE COSINE;

-- Impulse embeddings
DEFINE TABLE impulse_embeddings SCHEMAFULL;
DEFINE FIELD impulse_id ON TABLE impulse_embeddings TYPE string;
DEFINE FIELD content ON TABLE impulse_embeddings TYPE string;
DEFINE FIELD embedding ON TABLE impulse_embeddings TYPE array<float>;
DEFINE FIELD created_at ON TABLE impulse_embeddings TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_impulse_embeddings_id ON TABLE impulse_embeddings COLUMNS impulse_id UNIQUE;
DEFINE INDEX idx_impulse_embeddings_vector ON TABLE impulse_embeddings 
    FIELDS embedding 
    MTREE DIMENSION 32 DISTANCE COSINE;

-- Activity variant metrics (for Thompson Sampling)
DEFINE TABLE activity_variants SCHEMAFULL;
DEFINE FIELD variant_id ON TABLE activity_variants TYPE string;
DEFINE FIELD activity_id ON TABLE activity_variants TYPE string;
DEFINE FIELD alpha ON TABLE activity_variants TYPE int DEFAULT 1;  -- successes + 1
DEFINE FIELD beta ON TABLE activity_variants TYPE int DEFAULT 1;   -- failures + 1
DEFINE FIELD impressions ON TABLE activity_variants TYPE int DEFAULT 0;
DEFINE FIELD conversions ON TABLE activity_variants TYPE int DEFAULT 0;
DEFINE FIELD updated_at ON TABLE activity_variants TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_activity_variants ON TABLE activity_variants COLUMNS variant_id UNIQUE;
```

### Vector Search Queries

```sql
-- Search similar components by vector
SELECT 
    component_id,
    metadata,
    vector::similarity::cosine(embedding, $query_embedding) AS similarity
FROM components
WHERE project_id = $project_id
AND vector::similarity::cosine(embedding, $query_embedding) > 0.7
ORDER BY similarity DESC
LIMIT 10;

-- Search similar tasks
SELECT 
    task_type,
    description,
    vector::similarity::cosine(embedding, $query_embedding) AS similarity
FROM task_embeddings
WHERE vector::similarity::cosine(embedding, $query_embedding) > 0.8
ORDER BY similarity DESC
LIMIT 5;

-- Search similar impulses
SELECT 
    impulse_id,
    content,
    vector::similarity::cosine(embedding, $query_embedding) AS similarity
FROM impulse_embeddings
WHERE vector::similarity::cosine(embedding, $query_embedding) > 0.7
ORDER BY similarity DESC
LIMIT 10;
```

---

## Celery Beat Configuration

```python
# server/celery_app.py

from celery import Celery
from celery.schedules import crontab

app = Celery('metabob_rpc_api')

app.conf.beat_schedule = {
    # Update association weights hourly
    'update-associations-hourly': {
        'task': 'server.tasks.learning.update_association_weights',
        'schedule': crontab(minute=0),  # Every hour
    },
    
    # Recompute recommendations daily
    'recompute-recommendations-daily': {
        'task': 'server.tasks.learning.recompute_recommendations',
        'schedule': crontab(hour=2, minute=0),  # 2 AM daily
    },
    
    # Prune weak associations weekly
    'prune-associations-weekly': {
        'task': 'server.tasks.learning.prune_weak_associations',
        'schedule': crontab(hour=3, minute=0, day_of_week=0),  # Sunday 3 AM
    },
}

# server/tasks/learning.py

@app.task
def update_association_weights():
    """Update association weights based on recent feedback."""
    # Query recent feedback
    feedback = query_recent_feedback()
    
    # Update associations
    for fb in feedback:
        update_component_impulse_association(
            component_id=fb.component_id,
            impulse_id=fb.impulse_id,
            success=fb.success
        )
        update_component_task_association(
            component_id=fb.component_id,
            task_type=fb.task_type,
            success=fb.success
        )

@app.task
def recompute_recommendations():
    """Recompute activity recommendations based on updated parameters."""
    # Recompute Thompson Sampling parameters
    variants = query_all_activity_variants()
    
    for variant in variants:
        # Update alpha/beta based on recent conversions
        update_variant_parameters(variant)

@app.task
def prune_weak_associations():
    """Remove associations with low weight and high confidence."""
    # Query weak associations
    weak = query_associations(
        min_confidence=0.7,
        max_weight=0.2
    )
    
    # Delete from database
    for assoc in weak:
        delete_association(assoc.id)
```

---

## Summary

### What's Client-Side (metabob-cli MCP)
✅ CPG inference (cpg-inference module)  
✅ Component embeddings (32-dim from GNN)  
✅ FAISS similarity search  
✅ SQLite storage (persistent cache)  
✅ All metabob_* MCP tools  
**NEW**: `metabob_get_component_embeddings` tool

### What's Server-Side (metabob-rpc-api)
✅ Text embeddings (sentence-transformers → 32-dim)  
✅ SurrealDB storage (all project data)  
✅ SurrealDB vector search (cosine similarity)  
✅ Association graph management  
✅ Activity recommendations (Thompson Sampling)  
✅ Celery Beat (periodic learning updates)  
✅ REST API endpoints

### Benefits
1. **Fast Local CPG Analysis**: <10ms queries (no network)
2. **Scalable Learning**: Server handles heavy computation
3. **Unified Interface**: All agents use MCP tools
4. **Persistent Learning**: SurrealDB stores all knowledge
5. **Continuous Improvement**: Celery Beat updates parameters

---

**Related Documents**:
- [FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md) - Executive overview and 6-week implementation timeline
- [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) - Complete double-blind A/B testing technical design
- [CPG_INTEGRATION_SUMMARY.md](../CPG_INTEGRATION_SUMMARY.md) - CPG analysis integration patterns and vector embeddings
- [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - REST API endpoints and data schemas

**Implementation Status**: Ready for development following double-blind learning principles outlined in FINAL_ARCHITECTURE_SUMMARY.md

**Key Implementation Updates**:
1. **Agent Interface Constraints**: MCP tools return pure data without scores, confidences, or learning metrics
2. **Thompson Sampling Integration**: Bayesian exploration/exploitation through Beta distribution sampling
3. **Opaque Impression Tracking**: Clean feedback loops via impression IDs hidden from agents  
4. **Vector Search Architecture**: 32-dimensional embeddings with SurrealDB vector indexes for component similarity
5. **Association Learning**: Component-impulse weight updates through Celery Beat background processes
6. **Clean Learning Signals**: Outcomes based on actual task success without confounding variables

**Current Development Priority**: Follow 6-week implementation plan starting with RPC API foundation (text embeddings, SurrealDB schema, vector indexes) as detailed in FINAL_ARCHITECTURE_SUMMARY.md.