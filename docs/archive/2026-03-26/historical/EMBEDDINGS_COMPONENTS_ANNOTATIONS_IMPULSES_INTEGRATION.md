# Embeddings, Components, Annotations & Impulses: The Complete Integration

**Date**: February 19, 2026  
**Status**: Four distinct systems with massive integration opportunities  

---

## Executive Summary

You have **four powerful systems** that are **barely connected** today:

1. **CPG-Inference Embeddings** (GNN-based component similarity)
2. **Component Tracking** (CPG extraction + metabob-cli storage)
3. **Component Annotations** (human/AI design decisions)
4. **Impulse System** (lazy-loaded context management)

**Current State**: Each system works independently  
**Opportunity**: Connect them for **intelligent, learned context selection**

---

## The Four Systems Explained

### 1. CPG-Inference Embeddings (GNN Co-Change Prediction)

**What it is**: Machine learning model that embeds code components into 32-dimensional vectors

**How it works**:
```python
# Step 1: Parse code with tree-sitter
ast_nodes = tree_sitter.parse(source_code)

# Step 2: Extract CPG components
components = [
  {id: "auth.py::function::login::42", type: "function", name: "login"},
  {id: "auth.py::class::User::10", type: "class", name: "User"},
]

# Step 3: Generate structural SimHash features (k-hop neighborhoods)
for component in components:
    subtree = extract_k_hop_neighborhood(component, k=2)
    features = extract_structural_features(subtree)  # Node types, edge types, patterns
    simhash = compute_simhash(features)  # 64-bit hash

# Step 4: Run GNN model inference
node_features = create_feature_matrix(simhash_values)
embeddings = onnx_model.infer(node_features)  # [num_components, 32]

# Step 5: Store in FAISS index
faiss_index.add(embeddings)

# Step 6: Query for similar components
query_embedding = embeddings[component_id]
similar_components = faiss_index.search(query_embedding, k=10)
# Returns: [(component_id, similarity_score), ...]
```

**Key insight**: Components with similar **structure** get similar embeddings, even if names differ

**Example**:
```python
# These get SIMILAR embeddings (both are authentication functions):
def login(username, password):  # auth.py
    user = User.find(username)
    if user.verify_password(password):
        return create_session(user)
    raise AuthError()

def authenticate(email, pwd):  # api.py
    account = Account.lookup(email)
    if account.check_password(pwd):
        return generate_token(account)
    raise InvalidCredentials()
```

**Performance**:
- Parse file: ~10ms (tree-sitter)
- GNN inference: ~50ms per batch (10 components)
- FAISS search: <1ms
- Total: ~60-100ms per file (incremental)

**Storage**: 
- SQLite: `~/.metabob/cpg_cache.db`
- Schema: `components` table (id, file_path, component_name, type, embedding_vector)

---

### 2. Component Tracking (CPG Extraction)

**What it is**: Persistent record of all functions/classes/methods in your codebase

**How it works**:
```python
# CPG Manager extracts components during file indexing
components = cpg_manager.extract_components("auth.py")

# Example output:
[
  {
    "id": "auth.py::function::login::42",
    "name": "login",
    "type": "function",
    "line": 42,
    "file_path": "auth.py",
  },
  {
    "id": "auth.py::class::User::10",
    "name": "User",
    "type": "class",
    "line": 10,
    "file_path": "auth.py",
  },
]
```

**Component ID format**: `{file}::{type}::{name}::{line}`
- Example: `auth.py::function::login::42`
- Globally unique identifier for graph queries

**Component types tracked**:
- `function` - Standalone functions
- `class` - Class definitions
- `method` - Class methods (uses dot notation: `User.save`)
- `module` - Module-level code
- `file` - Entire file (for file-level annotations)

**Storage**: 
- In-memory graph (NetworkX)
- Persistent cache (SQLite or Redis)

**Exposed via MCP tools**:
- `list_file_components(file_path)` → Get all components in file
- `analyze_change_impact(file, component)` → Find dependencies
- `assess_deletion_safety(file, component)` → Check if dead code

---

### 3. Component Annotations (Design Decisions)

**What it is**: Human/AI explanations of WHY components exist or were changed

**Schema**:
```python
@dataclass
class ComponentAnnotation:
    # Core identification
    component_name: str        # "User", "login", "SessionManager"
    file_path: str             # Absolute path
    component_type: str        # "class", "function", "method", "module", "file"
    
    # Annotation metadata
    annotated_at: str          # ISO timestamp
    reason: str                # WHY: "Created UserValidator to centralize..."
    annotated_by: str          # Session ID or agent
    
    # Pattern quality tracking
    pattern_quality: str?      # "exemplar", "standard", "legacy", "cruft"
    alternatives_rejected: list[str]?  # "Why not use ORM? Performance-critical"
    deprecation_notes: str?    # "Being replaced by v2 authentication system"
    
    # CPG-computed similarity (OPPORTUNITY: not populated yet!)
    consistency_score: float?  # How well this matches similar code (0.0-1.0)
    pattern_exemplar: str?     # "Most similar to: auth/session.py::SessionManager"
    similar_components: list[str]?  # Components following same pattern
```

**Purpose**: Prevent regressions and provide context for future changes

**Example annotation**:
```python
file_state.annotate_component(
    file_path="src/auth.py",
    component_name="login",
    component_type="function",
    reason="""
    Refactored authenticate() to use async/await because sync version blocked
    event loop for 200ms. Matches pattern established in payment_service.py.
    Considered using threading but async is standard across our API layer.
    """,
    pattern_quality="exemplar",
)
```

**Storage**:
- metabob-cli: `FileStateManager.annotations` (in-memory + persistent state file)
- Format: `Dict[file_path, List[ComponentAnnotation]]`

**Exposed via MCP tool**:
- `metabob_annotate_component(file, component, type, reason)`

**Current limitation**: 
- ❌ `consistency_score` and `similar_components` are **NOT populated** yet
- ❌ No connection to CPG embeddings
- ❌ No automatic pattern detection

---

### 4. Impulse System (Lazy Context Management)

**What it is**: Budget-aware pointer system for loading context on-demand

**How it works**:
```typescript
// Step 1: Memory agent creates impulses (pointers to context)
const impulses = await sessionMemoryAgent.analyzeIntent(userRequest);
// Returns: [
//   {id: "imp_001", type: "file", pointer: {path: "auth.py"}, budget: 2000},
//   {id: "imp_002", type: "metabobAnnotation", pointer: {file: "auth.py", component: "login"}, budget: 500},
// ]

// Step 2: Impulse resolver loads content within budget
const context = await impulseResolver.resolve(impulses, maxBudget=10000);

// Step 3: Context injected into LLM prompt
const prompt = buildPrompt(userRequest, context);

// Step 4: Track usage for learning
await impulseUsageTracker.record(execution_id, impulse_id, step_succeeded=true);
```

**Impulse types** (12 total):

| Type | Pointer | Content Loaded |
|------|---------|----------------|
| `memo` | `{content: string}` | Inline text (errors, notes) |
| `file` | `{path, offset?, limit?}` | Source code |
| `component` | `{file, component_name}` | Specific function/class |
| `commit` | `{hash}` | Git diff |
| `metabobIssue` | `{issueId}` | Code quality issue |
| **`metabobAnnotation`** | **`{file, component}`** | **Design decision** |
| `activityOutput` | `{activityId, taskId}` | Activity result |
| `bashOutput` | `{command}` | Command output |
| `templateDefinition` | `{definition}` | Activity template |
| `activityRecommendation` | `{context, limit}` | Suggested activities |
| `remoteSession` | `{sessionId}` | Remote agent context |
| `custom` | `{resolver, data}` | Extensible |

**Storage**: SurrealDB
```sql
-- Impulse registry (metadata)
CREATE TABLE impulse_registry (
  impulse_id STRING,
  impulse_type STRING,
  pointer OBJECT,
  budget INT,
  actual_tokens INT,
  usage_count INT,
  success_rate FLOAT,  -- Learning metric
  created_by STRING,
  session_id STRING
);

-- Usage tracking (learning loop)
CREATE TABLE impulse_usage (
  execution_id STRING,
  step_id STRING,
  impulse_id STRING,
  usage_type STRING,  -- loaded/created/referenced
  step_succeeded BOOL,  -- Correlation with success
  tokens_used INT
);
```

**Learning query**:
```sql
-- Which impulses correlate with successful steps?
SELECT impulse_id, AVG(step_succeeded) as success_rate
FROM impulse_usage
GROUP BY impulse_id
ORDER BY success_rate DESC;
```

**Status**: ✅ 95% implemented, 182 tests passing

---

## The Missing Integration

### Problem: Four Isolated Systems

```
┌─────────────────────┐
│  CPG Embeddings     │  ← Knows component similarity
│  (GNN vectors)      │  ← NOT used for annotation search
└─────────────────────┘

┌─────────────────────┐
│  Component Tracking │  ← Knows dependencies
│  (CPG graph)        │  ← NOT linked to annotations
└─────────────────────┘

┌─────────────────────┐
│  Annotations        │  ← Knows WHY components exist
│  (design decisions) │  ← consistency_score NOT populated
└─────────────────────┘  ← similar_components NOT computed

┌─────────────────────┐
│  Impulse System     │  ← Loads context on-demand
│  (lazy pointers)    │  ← NOT embedding-aware
└─────────────────────┘
```

**Result**: Manual, heuristic-based context selection instead of learned, embedding-guided selection

---

## The Integration Architecture

### Unified Vision: Embedding-Guided Context

```
┌──────────────────────────────────────────────────────────────┐
│                    USER REQUEST                               │
│  "Fix authentication bug in login function"                   │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              SESSION MEMORY AGENT                             │
│  • Parse intent → "fixing login function in auth.py"         │
│  • Extract components → ["auth.py::function::login::42"]     │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│         EMBEDDING-ENHANCED CONTEXT SELECTION                  │
│                                                               │
│  1. QUERY CPG EMBEDDINGS:                                    │
│     similar = cpg.find_similar_components(                   │
│       component_id="auth.py::function::login::42",           │
│       top_k=10,                                               │
│       min_similarity=0.7                                      │
│     )                                                         │
│     # Returns: [                                              │
│     #   ("api.py::function::authenticate::15", 0.92),        │
│     #   ("session.py::function::create_session::88", 0.84),  │
│     # ]                                                       │
│                                                               │
│  2. FETCH ANNOTATIONS FOR SIMILAR COMPONENTS:                │
│     annotations = file_state.get_annotations(                │
│       component_ids=similar_component_ids                    │
│     )                                                         │
│     # Returns design decisions for structurally similar code │
│                                                               │
│  3. QUERY DEPENDENCY GRAPH:                                  │
│     dependencies = cpg.analyze_change_impact(                │
│       component_id="auth.py::function::login::42"            │
│     )                                                         │
│     # Returns: {                                              │
│     #   direct_dependencies: ["User", "create_session"],     │
│     #   direct_dependents: ["api_handler", "cli_login"],     │
│     # }                                                       │
│                                                               │
│  4. CREATE IMPULSES (context pointers):                      │
│     impulses = [                                              │
│       {type: "file", pointer: {path: "auth.py"}, budget: 2000},                │
│       {type: "component", pointer: {file: "api.py", component: "authenticate"}, budget: 1500},  │
│       {type: "metabobAnnotation", pointer: {file: "auth.py", component: "login"}, budget: 500}, │
│       {type: "metabobAnnotation", pointer: {file: "api.py", component: "authenticate"}, budget: 500}, │
│     ]                                                         │
│                                                               │
│  5. RESOLVE WITHIN BUDGET:                                   │
│     context = impulseResolver.resolve(impulses, maxBudget=10000)  │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              ACTIVITY EXECUTION                               │
│  • Agent gets enriched context (similar patterns + annotations) │
│  • Makes informed change (follows established patterns)      │
│  • Annotates new code (documents decision)                   │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              LEARNING LOOP                                    │
│  • Track which impulses were used                            │
│  • Correlate with step success                               │
│  • Update impulse success_rate                               │
│  • Improve future context selection                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Connect Annotations to Embeddings (Week 1)

**Goal**: Populate `ComponentAnnotation.similar_components` using CPG embeddings

**Changes**:

**A. Enhance `annotate_component` in metabob-cli**:
```python
# file_state.py
def annotate_component(
    self,
    file_path: str,
    component_name: str,
    component_type: str,
    reason: str,
    cpg_manager: CPGManager | None = None,  # NEW parameter
) -> ComponentAnnotation:
    """Annotate component with CPG-computed similarity."""
    
    # Create base annotation
    annotation = ComponentAnnotation(
        component_name=component_name,
        file_path=file_path,
        component_type=component_type,
        reason=reason,
        annotated_at=datetime.now().isoformat(),
        annotated_by=self.session_id or "unknown",
    )
    
    # NEW: Compute similarity metrics if CPG available
    if cpg_manager and cpg_manager.is_initialized():
        try:
            # Find similar components using embeddings
            component_id = f"{file_path}::{component_type}::{component_name}"
            similar = cpg_manager.find_similar_components(
                component_id=component_id,
                top_k=5,
                min_similarity=0.7
            )
            
            # Populate CPG-computed fields
            if similar:
                annotation.similar_components = [s["component_id"] for s in similar]
                annotation.pattern_exemplar = similar[0]["component_id"]  # Most similar
                annotation.consistency_score = similar[0]["similarity"]
        except Exception as e:
            logger.warning(f"Could not compute similarity for {component_name}: {e}")
    
    # Store annotation
    if file_path not in self.annotations:
        self.annotations[file_path] = []
    self.annotations[file_path].append(annotation)
    
    return annotation
```

**B. Add `find_similar_components` to CPGManager**:
```python
# cpg_manager.py
def find_similar_components(
    self,
    component_id: str,
    top_k: int = 5,
    min_similarity: float = 0.7
) -> list[dict]:
    """Find similar components using GNN embeddings.
    
    Returns:
        [
          {"component_id": "...", "similarity": 0.92, "file_path": "...", "name": "..."},
          ...
        ]
    """
    if not self.predictor:
        return []
    
    # Query FAISS index for similar embeddings
    results = self.predictor.search_similar(
        component_id=component_id,
        top_k=top_k,
        min_similarity=min_similarity
    )
    
    return results
```

**C. Update MCP tool to pass CPG reference**:
```python
# tools.py
@mcp.tool(name="annotate_component")
async def annotate_component(
    file_path: str,
    component_name: str,
    component_type: str,
    reason: str,
) -> dict:
    """Annotate component with design decisions."""
    
    # Get CPG manager from worker
    cpg_manager = watcher.cpg_manager if hasattr(watcher, "cpg_manager") else None
    
    # Annotate with similarity computation
    annotation = file_state.annotate_component(
        file_path=file_path,
        component_name=component_name,
        component_type=component_type,
        reason=reason,
        cpg_manager=cpg_manager,  # NEW: pass CPG reference
    )
    
    # Return enriched annotation
    return {
        "status": "success",
        "annotation": annotation.to_dict(),
    }
```

**Result**: Annotations now include `similar_components` and `consistency_score`

---

### Phase 2: Embedding-Aware Impulse Creation (Week 2)

**Goal**: Memory agent creates impulses for similar components automatically

**Changes**:

**A. Enhance memory agent impulse creation**:
```typescript
// memory-agent.ts
async function createImpulsesForIntent(
  intent: UserIntent,
  components: string[]  // e.g., ["auth.py::function::login::42"]
): Promise<Impulse[]> {
  const impulses: Impulse[] = [];
  
  // 1. Add impulses for directly mentioned components
  for (const componentId of components) {
    const [file, type, name, line] = parseComponentId(componentId);
    
    impulses.push({
      id: generateId(),
      type: "component",
      pointer: { file, componentName: name },
      budget: 1500,
    });
  }
  
  // 2. NEW: Query CPG for similar components
  const similarComponents = await queryCPGForSimilar(components, topK=5);
  
  for (const similar of similarComponents) {
    // Add impulse for similar component
    impulses.push({
      id: generateId(),
      type: "component",
      pointer: { 
        file: similar.file_path, 
        componentName: similar.component_name 
      },
      budget: 1000,  // Lower budget (secondary context)
    });
    
    // 3. NEW: Add impulse for annotation of similar component
    impulses.push({
      id: generateId(),
      type: "metabobAnnotation",
      pointer: { 
        file: similar.file_path, 
        component: similar.component_name 
      },
      budget: 500,
    });
  }
  
  return impulses;
}

async function queryCPGForSimilar(
  componentIds: string[],
  topK: number
): Promise<SimilarComponent[]> {
  // Call CPG via MCP tool
  const results = await callMCPTool("metabob_find_similar_components", {
    component_ids: componentIds,
    top_k: topK,
    min_similarity: 0.7,
  });
  
  return results.similar_components || [];
}
```

**B. Add new MCP tool for batch similarity search**:
```python
# tools.py
@mcp.tool(name="find_similar_components")
async def find_similar_components(
    component_ids: list[str],
    top_k: int = 5,
    min_similarity: float = 0.7,
) -> dict:
    """Find similar components for multiple components."""
    
    if not watcher.cpg_manager or not watcher.cpg_manager.is_initialized():
        return {"status": "cpg_unavailable", "similar_components": []}
    
    all_similar = []
    for component_id in component_ids:
        similar = watcher.cpg_manager.find_similar_components(
            component_id=component_id,
            top_k=top_k,
            min_similarity=min_similarity
        )
        all_similar.extend(similar)
    
    # Deduplicate and sort by similarity
    unique_similar = {s["component_id"]: s for s in all_similar}
    sorted_similar = sorted(
        unique_similar.values(),
        key=lambda x: x["similarity"],
        reverse=True
    )
    
    return {
        "status": "success",
        "similar_components": sorted_similar[:top_k],
    }
```

**Result**: Impulse system automatically includes similar components and their annotations

---

### Phase 3: Co-Change + Annotation Integration (Week 3)

**Goal**: Combine co-change predictions with annotation search

**Enhancement**: When suggesting related changes, also suggest related annotations

```python
# cpg_manager.py
def predict_related_files_with_annotations(
    self,
    changed_file: str,
    top_k: int = 5
) -> dict:
    """Predict co-change files AND fetch their annotations."""
    
    # Step 1: Co-change prediction (existing)
    predictions = self.predictor.predict_cochanges(
        changed_files=[changed_file],
        all_files=self.all_files,
        top_k=top_k
    )
    
    # Step 2: For each predicted file, fetch annotations
    enriched_predictions = []
    for pred in predictions:
        file_path = pred["file_path"]
        
        # Query annotations
        annotations = file_state.get_annotations(file_path)
        
        enriched_predictions.append({
            **pred,
            "annotations": [a.to_dict() for a in annotations.get(file_path, [])],
            "has_design_context": len(annotations.get(file_path, [])) > 0,
        })
    
    return {
        "predictions": enriched_predictions,
        "annotation_coverage": sum(1 for p in enriched_predictions if p["has_design_context"]) / len(enriched_predictions) if enriched_predictions else 0,
    }
```

**MCP tool enhancement**:
```python
@mcp.tool(name="suggest_related_changes")
async def suggest_related_changes(
    changed_files: list[str],
    top_k: int = 5,
    include_annotations: bool = True,  # NEW parameter
) -> dict:
    """Suggest related files with optional annotation context."""
    
    # ... existing co-change prediction ...
    
    if include_annotations:
        # Enrich with annotations
        result = cpg_manager.predict_related_files_with_annotations(
            changed_files[0], top_k
        )
    else:
        # Just co-change (existing behavior)
        result = cpg_manager.predict_related_files(changed_files[0], top_k)
    
    return result
```

**Result**: Co-change suggestions include design context from annotations

---

### Phase 4: Learning Loop Integration (Week 4)

**Goal**: Track which impulses (embeddings + annotations) correlate with success

**Schema enhancement**:
```sql
-- Add to impulse_usage table
ALTER TABLE impulse_usage 
ADD COLUMN embedding_similarity FLOAT,  -- If impulse was embedding-based
ADD COLUMN annotation_used BOOL,        -- If annotation was loaded
ADD COLUMN pattern_match BOOL;          -- If similar pattern was followed
```

**Tracking code**:
```typescript
// impulse-usage-tracker.ts
async function recordImpulseUsage(
  executionId: string,
  stepId: string,
  impulse: Impulse,
  stepSucceeded: boolean,
  metadata: {
    embeddingSimilarity?: number,
    annotationUsed?: boolean,
    patternMatch?: boolean,
  }
) {
  await db.insert("impulse_usage", {
    execution_id: executionId,
    step_id: stepId,
    impulse_id: impulse.id,
    usage_type: "loaded",
    step_succeeded: stepSucceeded,
    tokens_used: impulse.actual_tokens,
    embedding_similarity: metadata.embeddingSimilarity,
    annotation_used: metadata.annotationUsed,
    pattern_match: metadata.patternMatch,
  });
}
```

**Learning query**:
```sql
-- Do embedding-based impulses improve success rate?
SELECT 
  CASE 
    WHEN embedding_similarity IS NOT NULL THEN 'embedding-based'
    ELSE 'non-embedding'
  END as impulse_type,
  AVG(step_succeeded) as success_rate,
  COUNT(*) as sample_size
FROM impulse_usage
GROUP BY impulse_type;

-- Output:
-- impulse_type      | success_rate | sample_size
-- embedding-based   | 0.82         | 127
-- non-embedding     | 0.68         | 243

-- Do annotations improve success rate?
SELECT 
  annotation_used,
  AVG(step_succeeded) as success_rate,
  COUNT(*) as sample_size
FROM impulse_usage
GROUP BY annotation_used;

-- Output:
-- annotation_used | success_rate | sample_size
-- true            | 0.85         | 98
-- false           | 0.71         | 272
```

**Result**: Data-driven evidence for embedding + annotation value

---

## Integration Benefits

### 1. Smarter Context Selection

**Before** (heuristic-based):
```
User: "Fix login bug"
Memory Agent: "Load auth.py (mentioned), session.py (recent), utils.py (large)"
→ Misses api.py which has similar authentication pattern
```

**After** (embedding-guided):
```
User: "Fix login bug"
Memory Agent: 
  1. Parse: "auth.py::function::login::42"
  2. Query embeddings: find similar → api.py::function::authenticate (0.92 similarity)
  3. Create impulses:
     - auth.py (direct mention)
     - api.py (similar pattern)
     - annotation: auth.py::login (design context)
     - annotation: api.py::authenticate (pattern reference)
→ Agent sees both implementations + design decisions
```

### 2. Pattern Consistency

**Scenario**: Agent adds new authentication endpoint

**Before**:
- Agent doesn't know existing patterns
- Implements new approach
- Inconsistent with codebase

**After**:
- Embeddings find similar components (login, authenticate)
- Annotations explain WHY those patterns were chosen
- Agent follows established pattern
- Annotates new component with same reasoning

### 3. Learned Context

**After 100 activity executions**:
```sql
-- Query: Which annotation impulses have highest success correlation?
SELECT 
  pointer->>'component' as component_name,
  AVG(step_succeeded) as success_rate,
  COUNT(*) as usage_count
FROM impulse_usage
WHERE impulse_type = 'metabobAnnotation'
GROUP BY component_name
ORDER BY success_rate DESC, usage_count DESC
LIMIT 10;

-- Output:
-- component_name   | success_rate | usage_count
-- SessionManager   | 0.95         | 23  ← Load this annotation more often!
-- authenticate     | 0.88         | 18
-- validate_token   | 0.82         | 15
```

**Action**: Memory agent prioritizes high-success annotations in future context selection

---

## Performance Impact

### Token Budget Optimization

**Before** (no embeddings):
- Load 10 random files: 10 × 2000 tokens = 20,000 tokens
- Miss critical similar files: wasted tokens

**After** (embedding-guided):
- Load 5 most similar files: 5 × 2000 = 10,000 tokens
- Include annotations: 5 × 500 = 2,500 tokens
- Total: 12,500 tokens (37.5% reduction)
- Higher quality context (similar patterns)

### Inference Overhead

| Operation | Latency | When |
|-----------|---------|------|
| Find similar components (CPG) | ~10-50ms | Per component query |
| Fetch annotations (in-memory) | <1ms | Per file |
| Total overhead | ~50-100ms | Once per activity |

**Verdict**: Negligible overhead (<1% of activity execution time)

---

## Example End-to-End Flow

### Scenario: Fix Authentication Bug

**User request**: "Fix the authentication bug in login function"

**Step 1: Memory agent analyzes intent**
```typescript
const intent = await analyzeIntent("Fix the authentication bug in login function");
// Output: {
//   action: "fix",
//   components: ["auth.py::function::login::42"],
//   context_needed: ["authentication patterns", "similar implementations"]
// }
```

**Step 2: Query CPG embeddings for similar components**
```typescript
const similar = await queryCPG("auth.py::function::login::42", topK=5);
// Output: [
//   {id: "api.py::function::authenticate::15", similarity: 0.92},
//   {id: "session.py::function::create_session::88", similarity: 0.84},
// ]
```

**Step 3: Fetch annotations for similar components**
```typescript
const annotations = await fetchAnnotations([
  "auth.py::function::login::42",
  "api.py::function::authenticate::15"
]);
// Output: [
//   {
//     component: "login",
//     reason: "Refactored to async/await for non-blocking I/O. Matches API layer pattern.",
//     similar_components: ["authenticate", "verify_credentials"],
//     consistency_score: 0.89
//   },
//   {
//     component: "authenticate",
//     reason: "Created authenticate() to centralize JWT validation. Uses bcrypt for hashing.",
//     pattern_quality: "exemplar"
//   }
// ]
```

**Step 4: Create embedding-guided impulses**
```typescript
const impulses = [
  {type: "file", pointer: {path: "auth.py"}, budget: 2000},
  {type: "component", pointer: {file: "api.py", component: "authenticate"}, budget: 1500},
  {type: "metabobAnnotation", pointer: {file: "auth.py", component: "login"}, budget: 500},
  {type: "metabobAnnotation", pointer: {file: "api.py", component: "authenticate"}, budget: 500},
  {type: "metabobIssue", pointer: {issueId: "AUTH_001"}, budget: 800},
];
```

**Step 5: Resolve impulses and inject context**
```markdown
# Context for Activity

## Primary Component
### auth.py::function::login (line 42)
```python
async def login(username, password):
    user = User.find(username)
    if user.verify_password(password):
        return create_session(user)
    raise AuthError()
```

**Design Decision** (annotated by session_abc123):
Refactored to async/await for non-blocking I/O. Matches API layer pattern.
Similar to: api.py::authenticate (consistency: 0.89)

## Similar Patterns (embedding similarity: 0.92)
### api.py::function::authenticate (line 15)
```python
async def authenticate(email, pwd):
    account = Account.lookup(email)
    if account.check_password(pwd):
        return generate_token(account)
    raise InvalidCredentials()
```

**Design Decision** (annotated by session_xyz456):
Created authenticate() to centralize JWT validation. Uses bcrypt for hashing.
Pattern quality: exemplar

## Code Quality Issue
**AUTH_001**: Missing rate limiting on login attempts (HIGH severity)
```

**Step 6: Activity execution**
- Agent sees both implementations
- Agent sees design decisions (async pattern, bcrypt hashing)
- Agent sees issue (missing rate limiting)
- Agent fixes bug following established pattern
- Agent adds rate limiting (addresses issue)
- Agent annotates changes

**Step 7: Learning**
```typescript
await recordUsage({
  execution_id: "act_123",
  step_id: "step_1",
  impulses_used: [
    {id: "imp_001", type: "file", embedding_similarity: null, annotation_used: false},
    {id: "imp_002", type: "component", embedding_similarity: 0.92, annotation_used: false},
    {id: "imp_003", type: "metabobAnnotation", embedding_similarity: null, annotation_used: true},
    {id: "imp_004", type: "metabobAnnotation", embedding_similarity: 0.92, annotation_used: true},
  ],
  step_succeeded: true,
});
```

**Result**: 
- Bug fixed using pattern from similar component
- Rate limiting added (issue resolved)
- Changes annotated for future reference
- Learning data: embedding impulses + annotations → success

---

## Summary: The Integration Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUEST                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              SESSION MEMORY AGENT                            │
│  • Analyzes intent                                           │
│  • Extracts components                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         CPG EMBEDDINGS (Similarity Search)                   │
│  • Query: "Find similar to auth.py::login"                  │
│  • Returns: [(api.py::authenticate, 0.92), ...]             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         COMPONENT ANNOTATIONS (Design Context)               │
│  • Fetch annotations for similar components                 │
│  • Returns: [{reason: "...", pattern_quality: "exemplar"}]  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         IMPULSE SYSTEM (Context Management)                  │
│  • Create impulses for files + components + annotations     │
│  • Resolve within budget                                     │
│  • Inject into LLM prompt                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ACTIVITY EXECUTION                              │
│  • Agent gets embedding-guided context                       │
│  • Follows similar patterns                                  │
│  • Annotates changes                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              LEARNING LOOP                                   │
│  • Track impulse→success correlation                        │
│  • Improve future context selection                         │
│  • Optimize embedding queries                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Metrics to Track

### Context Quality
- **Annotation coverage**: % of impulses with annotations
- **Embedding relevance**: Average similarity score of loaded components
- **Token efficiency**: Tokens used / context quality

### Success Correlation
- **Embedding success rate**: Success rate when embedding impulses used
- **Annotation success rate**: Success rate when annotations loaded
- **Pattern consistency**: % of changes following similar patterns

### Performance
- **Query latency**: Time to find similar components
- **Resolution time**: Time to resolve impulses
- **Total overhead**: % of activity time spent on context

---

## Next Steps

**Week 1**: Connect annotations to embeddings  
**Week 2**: Embedding-aware impulse creation  
**Week 3**: Co-change + annotation integration  
**Week 4**: Learning loop implementation

**Expected Impact**:
- ⬆️ **+15-25% template success rate** (better context)
- ⬆️ **+20-30% pattern consistency** (embedding-guided)
- ⬇️ **-20-30% token usage** (smarter selection)
- ⬆️ **Learned improvement** (continuous optimization)

---

**End of Document**
