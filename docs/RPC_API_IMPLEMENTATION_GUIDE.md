# RPC API Implementation Guide: Annotation-Driven Orchestration

**For**: Backend engineers implementing the learning system in metabob-rpc-api  
**Time**: 6 weeks (2 engineers)  
**Goal**: Central orchestrator for annotation learning + embeddings + co-change

---

## Quick Start: What We're Building

The RPC API becomes the **brain** that:
1. **Stores** annotations/prompts per project in SurrealDB
2. **Computes** embeddings (CPG, task, annotation vectors)
3. **Tracks** co-change patterns (files/components that change together)
4. **Recommends** activities using embeddings + historical success
5. **Learns** from validation feedback (update all systems atomically)

**Flow**:
```
devbob-opencode → RPC API → decompose task → recommend activity → load prompt
                     ↓
               Execute locally
                     ↓
devbob-opencode → RPC API → record feedback → update learning systems
```

---

## Architecture Overview

```
metabob-rpc-api/
  server/
    actions/
      # NEW FILES (Week 1-3)
      annotation_management.py      # Load/save/refine annotations
      prompt_optimization.py        # Generate component-specific prompts
      embedding_service.py          # Compute embeddings (CPG, task, ann)
      cochange_analyzer.py          # Track co-change patterns
      task_decomposition.py         # Decompose using CPG + embeddings
      feedback_processor.py         # Atomic learning updates
      
      # ENHANCED FILES (Week 4-5)
      activity_recommendations.py   # Add embedding search
      activity_learning.py          # Add feedback → learning pipeline
    
    routes/
      # NEW FILES
      annotations.py
      prompts.py
      embeddings.py
      cochange.py
      tasks.py
      feedback.py
    
    models/
      # NEW FILES
      annotation.py                 # Pydantic models
      embedding.py
      cochange.py
    
    services/
      # NEW FILES
      embedding_engine.py           # sentence-transformers wrapper
      learning_orchestrator.py      # Coordinate all updates
```

---

## Week 1: Annotation Storage + Management

### Goal: Store/retrieve annotations per project

### 1.1 Add SurrealDB Schema

```python
# server/actions/init_annotation_schema.py

async def initialize_annotation_schema(db: SurrealDBClient) -> None:
    """Initialize annotation storage schema."""
    
    await db.execute("""
        -- Component annotations table
        DEFINE TABLE component_annotations SCHEMAFULL;
        DEFINE FIELD org_id ON TABLE component_annotations TYPE string;
        DEFINE FIELD project_id ON TABLE component_annotations TYPE string;
        DEFINE FIELD component_id ON TABLE component_annotations TYPE string;
        DEFINE FIELD budget ON TABLE component_annotations TYPE object;
        DEFINE FIELD annotations ON TABLE component_annotations TYPE array;
        DEFINE FIELD refinement_generation ON TABLE component_annotations TYPE int DEFAULT 0;
        DEFINE FIELD created_at ON TABLE component_annotations TYPE datetime DEFAULT time::now();
        DEFINE FIELD updated_at ON TABLE component_annotations TYPE datetime DEFAULT time::now();
        DEFINE INDEX idx_component_annotations_project ON TABLE component_annotations 
            COLUMNS project_id, component_id UNIQUE;
        
        -- Component prompts table
        DEFINE TABLE component_prompts SCHEMAFULL;
        DEFINE FIELD org_id ON TABLE component_prompts TYPE string;
        DEFINE FIELD project_id ON TABLE component_prompts TYPE string;
        DEFINE FIELD component_id ON TABLE component_prompts TYPE string;
        DEFINE FIELD effective_instructions ON TABLE component_prompts TYPE array;
        DEFINE FIELD ineffective_instructions ON TABLE component_prompts TYPE array;
        DEFINE FIELD optimized_prompt ON TABLE component_prompts TYPE string;
        DEFINE FIELD prompt_version ON TABLE component_prompts TYPE int DEFAULT 1;
        DEFINE FIELD created_at ON TABLE component_prompts TYPE datetime DEFAULT time::now();
        DEFINE INDEX idx_component_prompts_project ON TABLE component_prompts 
            COLUMNS project_id, component_id UNIQUE;
    """)
```

### 1.2 Add Pydantic Models

```python
# server/models/annotation.py

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

class Annotation(BaseModel):
    """Single annotation for a component."""
    id: str
    type: Literal["WHY", "CONSTRAINT", "PATTERN", "FAILURE", "SUCCESS"]
    content: str
    tokens: int
    relevance_score: float = Field(ge=0.0, le=1.0)
    success_contributions: int = 0
    failure_correlations: int = 0
    last_used_at: datetime
    created_by: Literal["human", "activity", "validation"]
    created_at: datetime

class AnnotationBudget(BaseModel):
    """Budget constraints for component annotations."""
    max_annotations: int = 5
    max_tokens_per_annotation: int = 500
    total_token_budget: int = 2500

class ComponentAnnotations(BaseModel):
    """All annotations for a component."""
    org_id: str
    project_id: str
    component_id: str
    budget: AnnotationBudget
    annotations: list[Annotation]
    refinement_generation: int = 0
    last_refined_at: datetime
    created_at: datetime
    updated_at: datetime
    
    @property
    def total_tokens(self) -> int:
        return sum(a.tokens for a in self.annotations)
    
    @property
    def budget_used_percent(self) -> float:
        return (self.total_tokens / self.budget.total_token_budget) * 100

class ValidationResult(BaseModel):
    """Validation result from activity execution."""
    success: bool
    component_id: str
    impulse_ids: list[str]
    task_type: str
    cost: float
    duration: int
    insight: Optional[str] = None
    metrics: dict = Field(default_factory=dict)
```

### 1.3 Implement Annotation Actions

```python
# server/actions/annotation_management.py

from server.models.annotation import ComponentAnnotations, ValidationResult, Annotation
from server.utils.surreal_client import SurrealDBClient
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

async def load_annotations(
    db: SurrealDBClient,
    org_id: str,
    project_id: str,
    component_ids: list[str],
) -> dict[str, ComponentAnnotations]:
    """Load annotations for multiple components."""
    
    results = await db.query(
        """
        SELECT * FROM component_annotations 
        WHERE project_id = $project_id 
        AND component_id IN $component_ids
        """,
        {"project_id": project_id, "component_ids": component_ids}
    )
    
    annotations_map = {}
    for result in results:
        comp_ann = ComponentAnnotations(**result)
        annotations_map[comp_ann.component_id] = comp_ann
    
    # Create empty budgets for components without annotations
    for comp_id in component_ids:
        if comp_id not in annotations_map:
            annotations_map[comp_id] = ComponentAnnotations(
                org_id=org_id,
                project_id=project_id,
                component_id=comp_id,
                budget=AnnotationBudget(),
                annotations=[],
                refinement_generation=0,
                last_refined_at=datetime.now(timezone.utc),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
    
    return annotations_map

async def refine_annotations(
    db: SurrealDBClient,
    org_id: str,
    project_id: str,
    component_id: str,
    validation_result: ValidationResult,
) -> ComponentAnnotations:
    """Refine annotations based on validation feedback."""
    
    # Load current annotations
    comp_ann = (await load_annotations(db, org_id, project_id, [component_id]))[component_id]
    
    # Update relevance scores
    for annotation in comp_ann.annotations:
        if validation_result.success:
            # Boost annotations that were in context
            if annotation.id in validation_result.impulse_ids:
                annotation.success_contributions += 1
                annotation.relevance_score *= 1.1
                annotation.relevance_score = min(1.0, annotation.relevance_score)
        else:
            # Penalize misleading annotations
            if annotation.id in validation_result.impulse_ids:
                annotation.failure_correlations += 1
                annotation.relevance_score *= 0.9
        
        # Decay old annotations
        days_since_used = (datetime.now(timezone.utc) - annotation.last_used_at).days
        decay_factor = 2 ** (-days_since_used / 30)  # Half-life: 30 days
        annotation.relevance_score *= decay_factor
    
    # Add new insight if present
    if validation_result.insight:
        new_annotation = Annotation(
            id=f"ann_{datetime.now(timezone.utc).timestamp()}",
            type="SUCCESS" if validation_result.success else "FAILURE",
            content=validation_result.insight,
            tokens=len(validation_result.insight.split()) * 1.3,  # Rough estimate
            relevance_score=1.0,
            success_contributions=1 if validation_result.success else 0,
            failure_correlations=0 if validation_result.success else 1,
            last_used_at=datetime.now(timezone.utc),
            created_by="validation",
            created_at=datetime.now(timezone.utc)
        )
        comp_ann.annotations.append(new_annotation)
    
    # Evict if over budget
    evicted = []
    while comp_ann.total_tokens > comp_ann.budget.total_token_budget and len(comp_ann.annotations) > 1:
        comp_ann.annotations.sort(key=lambda a: a.relevance_score)
        evicted.append(comp_ann.annotations.pop(0))
    
    # Update metadata
    comp_ann.refinement_generation += 1
    comp_ann.last_refined_at = datetime.now(timezone.utc)
    comp_ann.updated_at = datetime.now(timezone.utc)
    
    # Save to database
    await db.query(
        """
        UPDATE component_annotations 
        SET annotations = $annotations,
            refinement_generation = $refinement_generation,
            last_refined_at = $last_refined_at,
            updated_at = $updated_at
        WHERE project_id = $project_id 
        AND component_id = $component_id
        """,
        {
            "project_id": project_id,
            "component_id": component_id,
            "annotations": [a.dict() for a in comp_ann.annotations],
            "refinement_generation": comp_ann.refinement_generation,
            "last_refined_at": comp_ann.last_refined_at,
            "updated_at": comp_ann.updated_at
        }
    )
    
    logger.info(
        f"Refined annotations for {component_id}: "
        f"+{1 if validation_result.insight else 0} added, "
        f"-{len(evicted)} evicted, "
        f"{comp_ann.total_tokens}/{comp_ann.budget.total_token_budget} tokens"
    )
    
    return comp_ann
```

### 1.4 Add REST Endpoints

```python
# server/routes/annotations.py

from fastapi import APIRouter, Depends, HTTPException
from server.actions.annotation_management import load_annotations, refine_annotations
from server.models.annotation import ValidationResult
from server.utils.dependencies import get_db
from server.utils.surreal_client import SurrealDBClient
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/annotations", tags=["annotations"])

class LoadAnnotationsRequest(BaseModel):
    org_id: str
    project_id: str
    component_ids: list[str]

class UpdateAnnotationsRequest(BaseModel):
    org_id: str
    project_id: str
    component_id: str
    validation_result: ValidationResult

@router.post("/load")
async def load_annotations_endpoint(
    request: LoadAnnotationsRequest,
    db: SurrealDBClient = Depends(get_db)
):
    """Load annotations for components."""
    annotations = await load_annotations(
        db=db,
        org_id=request.org_id,
        project_id=request.project_id,
        component_ids=request.component_ids
    )
    return {
        "annotations": {
            comp_id: {
                "budget": ann.budget.dict(),
                "annotations": [a.dict() for a in ann.annotations],
                "total_tokens": ann.total_tokens,
                "budget_used_percent": ann.budget_used_percent
            }
            for comp_id, ann in annotations.items()
        }
    }

@router.post("/update")
async def update_annotations_endpoint(
    request: UpdateAnnotationsRequest,
    db: SurrealDBClient = Depends(get_db)
):
    """Update annotations based on validation feedback."""
    comp_ann = await refine_annotations(
        db=db,
        org_id=request.org_id,
        project_id=request.project_id,
        component_id=request.component_id,
        validation_result=request.validation_result
    )
    return {
        "annotations_updated": {
            "component_id": comp_ann.component_id,
            "total_annotations": len(comp_ann.annotations),
            "total_tokens": comp_ann.total_tokens,
            "budget_used_percent": comp_ann.budget_used_percent,
            "refinement_generation": comp_ann.refinement_generation
        }
    }
```

### 1.5 Register Routes

```python
# server/app.py

from server.routes import annotations  # NEW

app.include_router(annotations.router)  # NEW
```

---

## Week 2: Embedding Service

### Goal: Compute embeddings for CPG, tasks, annotations

### 2.1 Add Dependencies

```bash
# Add to requirements.txt
sentence-transformers>=2.2.2
torch>=2.0.0
numpy>=1.24.0
```

### 2.2 Implement Embedding Engine

```python
# server/services/embedding_engine.py

from sentence_transformers import SentenceTransformer
import numpy as np
from typing import Literal
import logging

logger = logging.getLogger(__name__)

class EmbeddingEngine:
    """Compute embeddings using sentence-transformers."""
    
    def __init__(self, model_name: str = "sentence-transformers/all-mpnet-base-v2"):
        self.model = SentenceTransformer(model_name)
        self.model_name = model_name
        self.embedding_dim = 768
        logger.info(f"Loaded embedding model: {model_name}")
    
    def compute_text_embedding(self, text: str) -> np.ndarray:
        """Compute embedding for text."""
        return self.model.encode(text, convert_to_numpy=True)
    
    def compute_batch_embeddings(self, texts: list[str]) -> np.ndarray:
        """Compute embeddings for multiple texts."""
        return self.model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    
    def compute_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Compute cosine similarity between embeddings."""
        return float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))
    
    def search_similar(
        self,
        query_embedding: np.ndarray,
        candidate_embeddings: np.ndarray,
        top_k: int = 10
    ) -> tuple[np.ndarray, np.ndarray]:
        """Search for similar embeddings."""
        # Compute cosine similarities
        similarities = np.dot(candidate_embeddings, query_embedding) / (
            np.linalg.norm(candidate_embeddings, axis=1) * np.linalg.norm(query_embedding)
        )
        # Get top-k indices
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        top_scores = similarities[top_indices]
        return top_indices, top_scores

# Global instance
_embedding_engine: EmbeddingEngine | None = None

def get_embedding_engine() -> EmbeddingEngine:
    """Get or create embedding engine singleton."""
    global _embedding_engine
    if _embedding_engine is None:
        _embedding_engine = EmbeddingEngine()
    return _embedding_engine
```

### 2.3 Add Embedding Storage Schema

```python
# Add to server/actions/init_annotation_schema.py

await db.execute("""
    -- Component embeddings
    DEFINE TABLE component_embeddings SCHEMAFULL;
    DEFINE FIELD org_id ON TABLE component_embeddings TYPE string;
    DEFINE FIELD project_id ON TABLE component_embeddings TYPE string;
    DEFINE FIELD component_id ON TABLE component_embeddings TYPE string;
    DEFINE FIELD embedding_type ON TABLE component_embeddings TYPE string;
    DEFINE FIELD embedding ON TABLE component_embeddings TYPE array<float>;
    DEFINE FIELD embedding_model ON TABLE component_embeddings TYPE string;
    DEFINE FIELD created_at ON TABLE component_embeddings TYPE datetime DEFAULT time::now();
    DEFINE INDEX idx_component_embeddings ON TABLE component_embeddings 
        COLUMNS project_id, component_id, embedding_type UNIQUE;
    
    -- Task embeddings
    DEFINE TABLE task_embeddings SCHEMAFULL;
    DEFINE FIELD task_type ON TABLE task_embeddings TYPE string;
    DEFINE FIELD task_description ON TABLE task_embeddings TYPE string;
    DEFINE FIELD embedding ON TABLE task_embeddings TYPE array<float>;
    DEFINE FIELD embedding_model ON TABLE task_embeddings TYPE string;
    DEFINE FIELD created_at ON TABLE task_embeddings TYPE datetime DEFAULT time::now();
    DEFINE INDEX idx_task_embeddings ON TABLE task_embeddings COLUMNS task_type UNIQUE;
""")
```

### 2.4 Implement Embedding Actions

```python
# server/actions/embedding_service.py

from server.services.embedding_engine import get_embedding_engine
from server.utils.surreal_client import SurrealDBClient
from server.models.annotation import ComponentAnnotations
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

async def compute_component_embedding(
    db: SurrealDBClient,
    org_id: str,
    project_id: str,
    component_id: str,
    component_annotations: ComponentAnnotations,
) -> list[float]:
    """Compute embedding for component based on its annotations."""
    
    engine = get_embedding_engine()
    
    # Combine annotations into single text
    text_parts = [f"Component: {component_id}"]
    for ann in component_annotations.annotations:
        text_parts.append(f"{ann.type}: {ann.content}")
    combined_text = "\n".join(text_parts)
    
    # Compute embedding
    embedding = engine.compute_text_embedding(combined_text)
    
    # Store in database
    await db.query(
        """
        UPDATE component_embeddings 
        SET embedding = $embedding,
            embedding_model = $embedding_model,
            updated_at = $updated_at
        WHERE project_id = $project_id 
        AND component_id = $component_id 
        AND embedding_type = 'semantic'
        """,
        {
            "project_id": project_id,
            "component_id": component_id,
            "embedding": embedding.tolist(),
            "embedding_model": engine.model_name,
            "updated_at": datetime.now(timezone.utc)
        }
    )
    
    logger.info(f"Computed embedding for {component_id}: {embedding.shape}")
    return embedding.tolist()

async def search_similar_components(
    db: SurrealDBClient,
    project_id: str,
    query_text: str,
    top_k: int = 10,
) -> list[dict]:
    """Search for components similar to query text."""
    
    engine = get_embedding_engine()
    
    # Compute query embedding
    query_embedding = engine.compute_text_embedding(query_text)
    
    # Load all component embeddings for project
    results = await db.query(
        """
        SELECT component_id, embedding, metadata 
        FROM component_embeddings 
        WHERE project_id = $project_id 
        AND embedding_type = 'semantic'
        """,
        {"project_id": project_id}
    )
    
    if not results:
        return []
    
    # Convert to numpy arrays
    component_ids = [r["component_id"] for r in results]
    embeddings = np.array([r["embedding"] for r in results])
    
    # Search
    top_indices, top_scores = engine.search_similar(query_embedding, embeddings, top_k)
    
    # Format results
    similar = []
    for idx, score in zip(top_indices, top_scores):
        similar.append({
            "component_id": component_ids[idx],
            "similarity": float(score),
            "metadata": results[idx].get("metadata", {})
        })
    
    return similar
```

---

## Week 3-6: Continue Implementation

I'll spare you the full code for weeks 3-6, but here's the roadmap:

**Week 3**: Co-change analyzer + task decomposer  
**Week 4**: Enhance activity recommender with embeddings  
**Week 5**: Implement atomic feedback processor  
**Week 6**: Integration testing + performance tuning

---

## Testing Strategy

### Unit Tests

```python
# tests/test_annotation_management.py

import pytest
from server.actions.annotation_management import refine_annotations
from server.models.annotation import ValidationResult

@pytest.mark.asyncio
async def test_refine_annotations_success(test_db):
    """Test annotation refinement on successful validation."""
    
    result = ValidationResult(
        success=True,
        component_id="src/session/index.ts::messages",
        impulse_ids=["impulse_xyz"],
        task_type="fix_memory_leak",
        cost=0.04,
        duration=12000,
        insight="Schema default + runtime fallback required"
    )
    
    comp_ann = await refine_annotations(
        db=test_db,
        org_id="org_test",
        project_id="project_test",
        component_id="src/session/index.ts::messages",
        validation_result=result
    )
    
    # Should have added new annotation
    assert len(comp_ann.annotations) > 0
    assert any(a.type == "SUCCESS" for a in comp_ann.annotations)
    
    # Should be within budget
    assert comp_ann.total_tokens <= comp_ann.budget.total_token_budget
```

---

## Deployment

### Environment Variables

```bash
# .env
EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2
SURREALDB_URL=ws://localhost:8000/rpc
```

### Docker

```dockerfile
# Dockerfile
FROM python:3.11-slim

# Install PyTorch CPU (lighter)
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy code
COPY server/ /app/server/
WORKDIR /app

CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Summary

The RPC API becomes the **central brain** that:
1. ✅ Stores annotations/prompts per project (SurrealDB)
2. ✅ Computes embeddings (sentence-transformers)
3. ✅ Tracks co-change patterns (historical analysis)
4. ✅ Recommends activities (enhanced Thompson Sampling)
5. ✅ Learns from feedback (atomic updates)

**All devbob agents** (opencode, rpc-api, cli, dashboard) call the RPC API to:
- Load optimal context before executing
- Record feedback after executing
- Get activity recommendations
- Decompose complex tasks

**Result**: Distributed learning system with centralized orchestration.

---

**Next**: Implement Week 1 (annotation storage), then continue weekly sprints.
