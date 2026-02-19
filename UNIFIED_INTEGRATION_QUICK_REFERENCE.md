# The Four Systems: Quick Integration Reference

**Date**: February 19, 2026  
**Question**: How do embeddings, components, annotations, and impulses relate?  
**Answer**: They're four powerful isolated systems that SHOULD be connected

---

## TL;DR

**You have**:
1. GNN embeddings (component similarity via ML)
2. Component tracking (CPG graph of functions/classes)
3. Annotations (WHY components exist)
4. Impulses (lazy context loading)

**Current state**: Isolated  
**Opportunity**: Connect them for intelligent context selection

---

## The Four Systems

### 1. CPG-Inference Embeddings (ML-Based Similarity)

**What**: 32-dimensional vectors representing code components  
**How**: tree-sitter → SimHash → GNN model → FAISS index  
**Speed**: ~50-100ms per file  
**Storage**: `~/.metabob/cpg_cache.db`

**Example**:
```python
# These get SIMILAR embeddings (similar structure):
def login(user, pwd):          # auth.py
    verify → create_session

def authenticate(email, pwd):  # api.py  
    verify → generate_token

# Embedding similarity: 0.92 (very similar!)
```

### 2. Component Tracking (CPG Extraction)

**What**: Persistent record of all functions/classes  
**Format**: `{file}::{type}::{name}::{line}`  
**Example**: `auth.py::function::login::42`

**Tools**:
- `list_file_components(file)` → All components
- `analyze_change_impact(file, component)` → Dependencies
- `assess_deletion_safety(file, component)` → Dead code check

### 3. Component Annotations (Design Decisions)

**What**: Human/AI explanations of WHY components exist  
**Fields**:
- `reason`: "Refactored to async/await for non-blocking I/O..."
- `pattern_quality`: "exemplar" / "standard" / "legacy"
- `similar_components`: **NOT POPULATED YET** ⚠️
- `consistency_score`: **NOT COMPUTED YET** ⚠️

**Tool**: `metabob_annotate_component(file, component, type, reason)`

### 4. Impulse System (Lazy Context)

**What**: Budget-aware pointers to context  
**Types**: file, component, metabobAnnotation, metabobIssue, etc.  
**Storage**: SurrealDB (`impulse_registry`, `impulse_usage`)  
**Status**: ✅ 95% implemented, 182 tests passing

**Flow**:
```
Memory agent → Create impulses → Resolve within budget → Inject into LLM
```

---

## The Missing Links

### Link 1: Annotations ❌ Embeddings

**Problem**: `ComponentAnnotation.similar_components` is always empty

**Should be**:
```python
annotation = annotate_component(
    file="auth.py",
    component="login",
    reason="Refactored to async/await..."
)
# annotation.similar_components = []  ← EMPTY!
# annotation.consistency_score = None ← NULL!
```

**Should populate via**:
```python
similar = cpg.find_similar_components("auth.py::function::login::42", top_k=5)
# Returns: [
#   ("api.py::authenticate", 0.92),
#   ("session.py::create_session", 0.84),
# ]

annotation.similar_components = [s[0] for s in similar]
annotation.consistency_score = similar[0][1]
```

### Link 2: Impulses ❌ Embeddings

**Problem**: Memory agent doesn't use embeddings for context selection

**Current**:
```typescript
// Heuristic-based (file size, recency, mentions)
createImpulses(["auth.py"])  // Just loads this file
```

**Should be**:
```typescript
// Embedding-guided (structural similarity)
similarComponents = queryCPG("auth.py::login", topK=5)
// Returns: api.py::authenticate (0.92), session.py::create (0.84)

createImpulses([
  "auth.py",           // Direct mention
  "api.py",            // Similar pattern (embedding)
  "session.py",        // Similar pattern (embedding)
])
```

### Link 3: Co-Change ❌ Annotations

**Problem**: Co-change predictions don't include annotation context

**Current**:
```python
suggest_related_changes(["auth.py"])
# Returns: [("session.py", 0.85), ("api.py", 0.72)]
# Just file paths, no design context
```

**Should include**:
```python
suggest_related_changes(["auth.py"], include_annotations=True)
# Returns: [
#   {
#     "file": "session.py", 
#     "similarity": 0.85,
#     "annotations": [
#       {component: "SessionManager", reason: "Centralized session logic..."}
#     ]
#   }
# ]
```

---

## Integration Architecture (Proposed)

```
User Request: "Fix login bug"
  ↓
SESSION MEMORY AGENT
  • Parse: "auth.py::function::login::42"
  ↓
QUERY CPG EMBEDDINGS
  • Find similar: api.py::authenticate (0.92), session.py::create (0.84)
  ↓
FETCH ANNOTATIONS
  • Get design decisions for similar components
  ↓
CREATE IMPULSES (embedding-guided)
  • {type: "file", pointer: {path: "auth.py"}, budget: 2000}
  • {type: "component", pointer: {file: "api.py", component: "authenticate"}, budget: 1500}
  • {type: "metabobAnnotation", pointer: {file: "auth.py", component: "login"}, budget: 500}
  • {type: "metabobAnnotation", pointer: {file: "api.py", component: "authenticate"}, budget: 500}
  ↓
RESOLVE & INJECT CONTEXT
  • Agent sees original code + similar patterns + design decisions
  ↓
ACTIVITY EXECUTION
  • Agent follows established patterns
  • Annotates changes
  ↓
LEARNING LOOP
  • Track: embedding impulses → success correlation
  • Improve future context selection
```

---

## Implementation Plan (4 Weeks)

**Week 1**: Connect annotations to embeddings
- Add `find_similar_components()` to CPGManager
- Populate `ComponentAnnotation.similar_components`
- Update `annotate_component` MCP tool

**Week 2**: Embedding-aware impulse creation
- Memory agent queries CPG for similar components
- Creates impulses for similar components + annotations
- New MCP tool: `find_similar_components` (batch)

**Week 3**: Co-change + annotation integration
- `suggest_related_changes` includes annotations
- Enrich predictions with design context

**Week 4**: Learning loop
- Track embedding impulse → success correlation
- Track annotation usage → success correlation
- Data-driven evidence for value

---

## Expected Benefits

### Smarter Context (37.5% token reduction)

**Before**:
- Load 10 files: 20,000 tokens
- Miss critical similar files

**After**:
- Load 5 most similar: 10,000 tokens
- Include annotations: 2,500 tokens
- Total: 12,500 tokens (37.5% savings)
- Higher quality context

### Pattern Consistency

**Before**:
- Agent doesn't know existing patterns
- Implements new approach (inconsistent)

**After**:
- Embeddings find similar code
- Annotations explain WHY
- Agent follows established pattern

### Learned Optimization

**After 100 executions**:
```sql
-- Which annotations have highest success correlation?
SELECT component_name, AVG(step_succeeded) as success_rate
FROM impulse_usage
WHERE impulse_type = 'metabobAnnotation'
GROUP BY component_name
ORDER BY success_rate DESC;

-- Output:
-- SessionManager:   0.95 (23 uses) ← Prioritize this!
-- authenticate:     0.88 (18 uses)
-- validate_token:   0.82 (15 uses)
```

---

## Performance Impact

**Overhead**:
- Find similar components: ~10-50ms
- Fetch annotations: <1ms
- Total: ~50-100ms per activity (<1% overhead)

**Verdict**: Negligible cost, massive value

---

## Full Details

See comprehensive analysis:
- `EMBEDDINGS_COMPONENTS_ANNOTATIONS_IMPULSES_INTEGRATION.md` (full architecture, examples, code)
- `CPG_COCHANGE_INTEGRATION_ARCHITECTURE.md` (CPG + co-change specifics)

---

**Summary**: You have the infrastructure. Connect the systems. Profit.
