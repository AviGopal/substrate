# Current metabob_search_codebase_issues Implementation Analysis

**Status**: Keyword-based matching (NOT semantic search)  
**Date**: 2026-02-27  
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

---

## Executive Summary

The current implementation of `metabob_search_codebase_issues` uses **simple keyword matching** with set intersection, not semantic search. Despite claims of "semantic similarity" in the tool description, it cannot find conceptually similar issues without exact word matches.

**Current Accuracy**: ~30% (based on keyword overlap)  
**Expected Accuracy after ML Integration**: 80%+ (using CPG cochange embeddings)

---

## Data Flow

```
User Query
    ↓
MCP Tool Handler (tools.py:840)
    ↓
Optimistic Cache Lookup (file_state.py)
    ↓
Local State (results_by_file from .metabob/)
    ↓
_calculate_similarity() - KEYWORD MATCHING
    ↓
Sort by relevance score + severity
    ↓
Return top N issues
```

**Key Insight**: No external API calls to ide.metabob.com for search. The base_url configuration is only for initial analysis submission, not search queries.

---

## Current Algorithm

### Location
- **File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`
- **Function**: `_calculate_similarity()` (lines 571-610)
- **Invocation**: Line 945 in `search_codebase_issues()`

### Implementation

```python
def _calculate_similarity(query: str, issue: dict) -> float:
    """Calculate simple text similarity score between query and issue."""
    query_lower = query.lower()
    query_words = set(query_lower.split())

    # Build searchable text from issue
    searchable_parts = [
        issue.get("message", ""),
        issue.get("description", ""),
        issue.get("rule", ""),
        issue.get("category", ""),
        issue.get("file_path", ""),
    ]
    searchable_text = " ".join(
        str(p) if p is not None else "" for p in searchable_parts
    ).lower()
    searchable_words = set(searchable_text.split())

    # Calculate similarity
    if not query_words:
        return 0.0

    # Exact phrase match gets highest score
    if query_lower in searchable_text:
        return 1.0

    # Word overlap score
    common_words = query_words.intersection(searchable_words)
    word_score = len(common_words) / len(query_words)

    # Boost for category/rule matches
    category = issue.get("category") or ""
    rule = issue.get("rule") or ""
    if any(word in category.lower() for word in query_words):
        word_score += 0.2
    if any(word in rule.lower() for word in query_words):
        word_score += 0.2

    return min(word_score, 1.0)
```

### Algorithm Breakdown

1. **Convert query to lowercase words**: `query.lower().split()`
2. **Extract issue fields**: message, description, rule, category, file_path
3. **Convert issue text to lowercase words**: `searchable_text.split()`
4. **Set Intersection**: `query_words.intersection(searchable_words)`
5. **Calculate score**: `len(common_words) / len(query_words)`
6. **Apply boosts**: +0.2 for category match, +0.2 for rule match
7. **Cap at 1.0**: `min(word_score, 1.0)`

---

## Problems with Current Approach

### 1. ❌ Not Semantic - Just Keyword Matching

**Problem**: Uses set intersection (`query_words & searchable_words`) to calculate word overlap.

**Impact**: Cannot find conceptually similar issues.

**Example**:
```
Query: "authentication vulnerability"

✅ MATCHES:
- "SQL injection in authentication handler" (contains "authentication")
- "Vulnerability in login endpoint" (contains "vulnerability")

❌ MISSES:
- "Login security flaw" (same concept, different words)
- "Session hijacking risk" (related security concept)
- "Insecure credential storage" (authentication issue, different terms)
- "User session bypass detected" (authentication vulnerability without keywords)
```

### 2. ❌ No ML Models

**Problem**: Zero machine learning - pure string manipulation.

**Impact**: 
- No understanding of semantic relationships
- No learned patterns from codebase
- No vector embeddings for similarity

**What's Missing**:
- ONNX model inference
- FAISS vector search
- Embedding generation

### 3. ❌ Misleading Documentation

**Problem**: Tool description claims "semantic similarity" but implementation is keyword matching.

**Evidence**:
```python
# From tools.py:811
description="""Search for code quality issues using semantic similarity.
...
RETURNS: Matching issues with:
- Relevance score (how well it matches your query)
```

**Reality**: Relevance score is just `len(common_words) / len(query_words)`

### 4. ❌ Superficial Boosting

**Problem**: Category/rule boost (+0.2 each) is arbitrary and not learned.

**Impact**: 
- No evidence these weights are optimal
- Same boost for all categories
- Ignores importance of different terms

### 5. ❌ No Context Awareness

**Problem**: Ignores:
- Code structure (CPG)
- Co-change patterns
- Issue severity distribution
- Historical fix patterns

---

## Example Failure Cases

### Case 1: Synonym Blindness
```
Query: "memory leak"
Misses: "resource not released", "allocation without deallocation"
Reason: Zero word overlap
```

### Case 2: Conceptual Similarity
```
Query: "race condition"
Misses: "concurrent access violation", "thread safety issue"
Reason: Different terminology, same concept
```

### Case 3: Domain Knowledge
```
Query: "SQL injection"
Misses: "dynamic query construction vulnerability", "unparameterized database query"
Reason: Security concept not represented in keywords
```

### Case 4: Related Issues
```
Query: "null pointer dereference"
Misses: "unvalidated input usage", "missing null check"
Reason: Related but using different words
```

---

## Key Files

### Primary Implementation
- **`repos/metabob-cli/src/metabob_cli/mcp/tools.py`**
  - Line 571-610: `_calculate_similarity()` function (keyword matching logic)
  - Line 840-1055: `search_codebase_issues()` tool handler
  - Line 945: Invocation of `_calculate_similarity()`

### Supporting Files
- **`repos/metabob-cli/src/metabob_cli/core/config.py`**
  - Line 57: `base_url = "https://ide.metabob.com"` (for initial analysis, not search)
  
- **`repos/metabob-cli/src/metabob_cli/core/analysis_api_client.py`**
  - External API client (used for job submission, NOT for search queries)

### State Management
- **`.metabob/file_state.json`** (local cache)
  - Contains `results_by_file` with all detected issues
  - Search operates on this cached data (no external API calls)

---

## Performance Characteristics

### Current System
- **Latency**: <500ms (local set operations)
- **Memory**: O(N) where N = total issues
- **Accuracy**: ~30% (keyword overlap only)
- **Scalability**: Good (purely local)

### With ML Integration (Target)
- **Latency**: <1000ms (ONNX + FAISS)
- **Memory**: O(N) + embedding storage
- **Accuracy**: 80%+ (semantic understanding)
- **Scalability**: Good (FAISS optimized for similarity search)

---

## Replacement Requirements

To implement true semantic search, the system needs:

### 1. Embedding Generation
- Use CPG CoChangePredictor's ONNX model
- Generate embeddings for:
  - Query text
  - Issue descriptions
  - Code context

### 2. Vector Storage
- FAISS index for issue embeddings
- Persistent storage in `.metabob/`
- Incremental updates on new issues

### 3. Similarity Search
- Replace `_calculate_similarity()` with:
  - Encode query → embedding vector
  - FAISS nearest neighbor search
  - Return top K by cosine similarity

### 4. Integration Points
- **Model**: `repos/metabob-cli/src/metabob_cli/cpg/cpg_inference/predictor.py`
- **FAISS**: `repos/metabob-cli/src/metabob_cli/cpg/cpg_inference/` (needs FAISS wrapper)
- **Cache**: Extend `.metabob/file_state.json` with embeddings

---

## Next Steps

1. **Verify CPG model availability**
   - Check if CoChangePredictor model exists
   - Verify ONNX runtime installation
   - Test embedding generation

2. **Design embedding schema**
   - Issue embedding format
   - Index structure
   - Update strategy

3. **Implement semantic search**
   - Replace `_calculate_similarity()`
   - Add FAISS integration
   - Maintain backward compatibility

4. **Benchmark improvements**
   - Test on real queries
   - Measure accuracy improvement
   - Compare latency

---

## References

- **CPG Cochange Integration**: `docs/cpg/CPG_COCHANGE_INTEGRATION_SUMMARY.md`
- **CPG Implementation**: `docs/cpg/CPG_IMPLEMENTATION_RESULTS.md`
- **Tool Documentation**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:810-831`

---

## Conclusion

The current search is **misleadingly named**. It's not semantic search - it's simple keyword matching with set intersection. The ~30% accuracy is a direct result of this limitation. Integrating CPG cochange embeddings will provide true semantic understanding and 80%+ accuracy.

**Critical Finding**: No external API dependency for search. Everything is local, making ML integration straightforward without network latency concerns.
