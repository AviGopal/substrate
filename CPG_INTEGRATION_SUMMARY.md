# CPG Embedding Integration - Executive Summary

**Last Updated**: January 30, 2026

**Question**: How do we use the cpg-inference module for component embeddings and text embeddings for tasks/impulses?

**Answer**: Integrate existing CPG-inference GNN embeddings (32-dim) with new text embedding service and hybrid embeddings (CPG + annotations) within the double-blind learning architecture where agents receive pure CPG analysis without learning metrics.

---

## What You Already Have (cpg-inference module)

✅ **Complete CPG Infrastructure**:
- `CoChangePredictor`: Parse files → extract components → generate embeddings
- GNN Model: Trained model (AUC 0.9999) producing 32-dim structural embeddings
- FAISS Index: Fast similarity search built-in
- SQLite Storage: Component caching for incremental updates
- SimHash Features: 128-bit structural hashing

✅ **API**:
```python
from cpg_inference import CoChangePredictor, InferenceConfig

config = InferenceConfig(
    model_path="models/auc_0.9999_gcn_bce_all_h64_l2_d1_b128_fp32.onnx",
    simhash_bits=128,
    embedding_dim=32
)

predictor = CoChangePredictor(config)

# Parse files and get component embeddings
files = {"src/auth.py": "def login(): ..."}
predictor.update_index(files)

embeddings = predictor.get_component_embeddings(
    file_path="src/auth.py",
    files=files
)
# Result: {"src/auth.py::function::login::10": array([0.1, -0.2, ...], shape=(32,))}
```

---

## What We're Adding

### 1. Text Embedding Service (NEW)

Convert text (tasks, impulses, annotations) to embeddings using the same GNN model:

```python
# server/services/cpg_text_embeddings.py

class CPGTextEmbedder:
    """Embed text using CPG model."""
    
    def embed_text(self, text: str) -> np.ndarray:
        """Convert text to 32-dim embedding.
        
        Strategy:
        1. Text → pseudo-CPG node (single node with text as name)
        2. Pseudo-CPG → SimHash features (128-bit)
        3. SimHash → GNN model → 32-dim embedding
        4. L2 normalize → return
        """
        # Create pseudo-CPG node
        node = CPGNode(
            type=NodeType.FUNCTION,
            name=text[:100],  # Truncate for name
            source_text=text
        )
        
        # Generate SimHash features (same as components)
        features = self._generate_text_features(node)
        
        # Run through GNN (same model as components)
        embedding = self.model.infer(features)
        
        return embedding  # shape: (32,)

# Usage:
embedder = CPGTextEmbedder(cpg_predictor=predictor)

task_emb = embedder.embed_text("Fix memory leak in session messages")
# shape: (32,) - same space as component embeddings!

impulse_emb = embedder.embed_text("Session messages use streaming pattern")
# shape: (32,)
```

**Key Insight**: Use the SAME GNN model for text by converting text → pseudo-CPG → features → embedding. This keeps everything in the same 32-dim embedding space.

### 2. Hybrid Embedding Service (NEW)

Combine CPG structure (code analysis) with annotation semantics (learned knowledge):

```python
# server/services/hybrid_embeddings.py

class HybridEmbeddingService:
    """Combine CPG structural embeddings with annotation semantic embeddings."""
    
    def compute_hybrid_embedding(
        self,
        cpg_embedding: np.ndarray,  # 32-dim from CPG
        annotations: list[dict]     # Annotation text
    ) -> np.ndarray:
        """Hybrid = 70% CPG structure + 30% annotation semantics."""
        
        # Embed annotations using text embedder
        annotation_embeddings = self.text_embedder.embed_batch(
            [ann['content'] for ann in annotations]
        )
        avg_annotation_emb = np.mean(annotation_embeddings, axis=0)
        
        # Weighted combination
        hybrid = 0.7 * cpg_embedding + 0.3 * avg_annotation_emb
        
        # L2 normalize
        hybrid = hybrid / np.linalg.norm(hybrid)
        
        return hybrid  # shape: (32,)

# Usage:
hybrid_service = HybridEmbeddingService(cpg_predictor, text_embedder)

component_id = "src/session/index.ts::messages"
cpg_emb = predictor.get_component_embeddings(...)[component_id]
annotations = [
    {"content": "Streams messages from storage"},
    {"content": "Memory leak fixed by adding default limit"}
]

hybrid_emb = hybrid_service.compute_hybrid_embedding(cpg_emb, annotations)
# shape: (32,) - enhanced with annotation knowledge!
```

**Key Insight**: Hybrid embeddings capture BOTH code structure (CPG) AND learned knowledge (annotations). Components with similar structure AND similar learned patterns will be close in embedding space.

---

## Integration Architecture

```
metabob-rpc-api (Orchestrator)
├── CPG-Inference (existing)
│   ├── Parse files → CPG
│   ├── Extract components
│   ├── Generate SimHash features
│   ├── GNN model → 32-dim embeddings
│   └── FAISS index → similarity search
│
├── Text Embedding Service (NEW)
│   ├── Convert text → pseudo-CPG
│   ├── Generate features (same as components)
│   ├── Use same GNN model
│   └── Output: 32-dim embeddings
│       ├── Task embeddings
│       ├── Impulse embeddings
│       └── Annotation embeddings
│
└── Hybrid Embedding Service (NEW)
    ├── Load CPG embeddings (structure)
    ├── Load annotations (semantics)
    ├── Embed annotations with text embedder
    ├── Combine: 70% CPG + 30% annotations
    └── Output: Enhanced 32-dim embeddings
```

---

## Complete Flow: Task Decomposition with CPG Embeddings

```python
# Step 1: Agent submits task
POST /api/v1/tasks/decompose
{
  "task_description": "Fix memory leak in session messages",
  "files": {"src/session/index.ts": "..."}
}

# RPC API orchestrates:

# 1. Compute task embedding using CPG model
text_embedder = get_text_embedder()
task_emb = text_embedder.embed_text("Fix memory leak in session messages")
# shape: (32,)

# 2. Update CPG index (incremental)
cpg_predictor = get_cpg_predictor()
cpg_predictor.update_index(files)

# 3. Get CPG embeddings for all components
cpg_embeddings = cpg_predictor.get_component_embeddings("src/session/index.ts", files)
# {"src/session/index.ts::messages": array([...], shape=(32,))}

# 4. Load annotations
annotations = await load_annotations(db, project_id, component_ids)

# 5. Compute hybrid embeddings (CPG + annotations)
hybrid_service = get_hybrid_service()
hybrid_embeddings = hybrid_service.compute_batch_hybrid_embeddings(
    component_ids=component_ids,
    cpg_embeddings=cpg_embeddings,
    annotations_map=annotations
)

# 6. Search similar components
similar_components = []
for comp_id, hybrid_emb in hybrid_embeddings.items():
    similarity = cosine_similarity(task_emb, hybrid_emb)
    similar_components.append({
        "component_id": comp_id,
        "similarity": similarity
    })

# Sort by similarity
similar_components.sort(key=lambda x: x['similarity'], reverse=True)

# Top match: src/session/index.ts::messages (similarity: 0.94)
# Reason: High structural similarity (CPG) + annotation matches "memory leak" pattern
```

---

## Key Benefits

### 1. Unified Embedding Space
- Components: 32-dim from GNN
- Tasks: 32-dim from same GNN (via pseudo-CPG)
- Impulses: 32-dim from same GNN
- Annotations: 32-dim from same GNN
- **All comparable via cosine similarity!**

### 2. Structural + Semantic
- **CPG captures**: Code structure, call graphs, dependencies
- **Annotations capture**: Why it exists, what worked, what failed
- **Hybrid combines**: Best of both worlds

### 3. Reuse Existing Infrastructure
- No need for separate text embedding model (e.g., sentence-transformers)
- Reuse CPG parsing, feature generation, FAISS index
- Leverage existing trained model (AUC 0.9999)

### 4. Incremental Updates
- CPG-inference has SQLite caching built-in
- Only reprocess changed files
- 10-1472x faster for incremental updates

---

## Implementation Roadmap (Updated 6-Week Plan)

**Week 1**: RPC API Foundation (Text Embeddings & Database)
- Implement text embedding service (sentence-transformers → 32-dim to match CPG)
- Set up SurrealDB schema (variants, assignments, associations, component embeddings)
- Create vector indexes for component embeddings and text embeddings
- **Double-blind requirement**: Ensure CPG embeddings stored server-side without exposing to agents

**Week 2**: Variant Assignment (Thompson Sampling)
- Implement Thompson Sampling for activity variant selection
- Build context selection system using CPG component-impulse associations  
- Create recommendation endpoint returning only activity + context impulses + impression_id
- **Double-blind requirement**: Hide all similarity scores, probabilities, and variant assignments from agents

**Week 3**: Feedback Processing (Parameter Updates)
- Build feedback endpoint accepting impression_id + outcome
- Implement Thompson parameter updates (alpha/beta) based on success/failure
- Create association weight updates (component ↔ impulse success tracking)
- Integrate Celery task system for background learning
- **Double-blind requirement**: Return simple acknowledgment without internal metrics

**Week 4**: Celery Beat (Background Learning)
- Set up periodic Thompson parameter updates (15-minute cycles)
- Implement association weight recalculation (hourly)  
- Add weak association pruning (weekly)
- Create analytics generation for humans only (daily)
- **Key insight**: All learning happens async, invisible to agents

**Week 5**: Testing (End-to-End Bias Verification)
- Test complete double-blind flow from task to outcome
- Verify agents cannot access internal learning metrics
- Load test recommendation and feedback endpoints
- Validate Thompson Sampling convergence with simulated data
- **Critical**: Confirm no correlation between agent decisions and exposed scores

**Week 6**: Production (Deployment & Monitoring)
- Deploy RPC API with Celery Beat background workers
- Deploy SurrealDB with vector indexes and monitoring
- Create internal dashboard for learning metrics (humans only)
- Monitor Thompson Sampling parameter evolution in production
- Validate clean learning signals from agent outcomes

---

## Files Created

1. **CPG_EMBEDDING_INTEGRATION.md** (15KB)
   - Complete technical design
   - Code examples for text embedder, hybrid embedder
   - Integration with RPC API

2. **docs/CPG_INTEGRATION_SUMMARY.md** (This file)
   - Executive summary
   - Key insights and benefits

3. Plus 7 other docs:
   - RPC_API_ANNOTATION_ORCHESTRATION.md
   - RPC_API_IMPLEMENTATION_GUIDE.md
   - ANNOTATION_DRIVEN_LEARNING_SYSTEM.md
   - SELF_IMPROVING_DEVELOPMENT_SYSTEM.md
   - QUICK_START_LEARNING_SYSTEM.md
   - METABOB_RPC_ORCHESTRATION_SUMMARY.md
   - ANNOTATION_LEARNING_SYSTEM_SUMMARY.md

---

## Key Insight: Why This Works

**Your CPG-inference model is trained on code structure** (CPG graphs with SimHash features). By converting text to pseudo-CPG nodes with the same feature generation pipeline, we get text embeddings in the SAME semantic space as code embeddings.

This means:
- Task description "Fix memory leak" → 32-dim embedding
- Component `Session.messages` → 32-dim embedding
- Cosine similarity → measures how closely the task intent matches the component structure/behavior

**Plus annotations**: Components with similar history (annotations) will be even closer in hybrid embedding space.

**Result**: Unified embedding system using your existing, proven GNN model!

---

**Related Documents**:
- [FINAL_ARCHITECTURE_SUMMARY.md](./FINAL_ARCHITECTURE_SUMMARY.md) - **START HERE**: Complete executive overview and 6-week implementation timeline
- [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./docs/DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) - **RECOMMENDED**: Complete technical design for agent-opaque learning
- [DISTRIBUTED_ARCHITECTURE_FINAL.md](./docs/DISTRIBUTED_ARCHITECTURE_FINAL.md) - Client-server distribution with double-blind updates

**Implementation Status**: Ready for development following double-blind learning architecture where CPG analysis provides pure component data without similarity scores or learning metrics.

**Key Integration Points with Double-Blind Architecture**:
1. **MCP Tools Stay Pure**: CPG-inference provides component IDs and dependencies without confidence scores
2. **Server-Side Vector Search**: 32-dim component embeddings used internally for similarity but not exposed to agents  
3. **Association Learning**: Component-impulse associations weighted by historical success rates (hidden from agents)
4. **Thompson Sampling**: Activity variant selection based on CPG similarity and association weights (opaque to agents)
5. **Clean Learning Signals**: Feedback loops track outcomes through impression IDs without revealing internal metrics

**Next Priority**: Follow Week 1 implementation plan - RPC API foundation with text embeddings and SurrealDB schema as detailed in FINAL_ARCHITECTURE_SUMMARY.md
