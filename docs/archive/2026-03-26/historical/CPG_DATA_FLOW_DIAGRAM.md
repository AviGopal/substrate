# CPG & Co-Change Data Flow Diagram

**Visual representation of how CPG data flows through the system**

---

## 🔄 Complete Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER WORKFLOW                                 │
└──────────────────────────────────────────────────────────────────────┘
         │
         │ 1. User modifies files in IDE/editor
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    FILE WATCHER (metabob-cli)                        │
│  • Detects file changes via filesystem events                       │
│  • Sends fire-and-forget IPC to analysis worker                     │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 2. IPC: file_update event
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│              CPG MANAGER (analysis_worker.py)                        │
│  • Reads file content                                               │
│  • Calls cpg_inference.CoChangePredictor.update_file()              │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 3. Progressive CPG update
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│         CPG-INFERENCE LIBRARY (cpg_inference package)                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1. Tree-sitter Parsing                                       │  │
│  │    • Extract AST from source code                            │  │
│  │    • Identify functions, classes, methods                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 2. Component Extraction                                      │  │
│  │    • Create CPGComponent objects                             │  │
│  │    • Build component IDs (file::class.method)                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 3. Dependency Resolution                                     │  │
│  │    • Analyze function calls, imports                         │  │
│  │    • Cross-file symbol resolution                            │  │
│  │    • Build dependency edges                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 4. GNN Embedding Generation                                  │  │
│  │    • SimHash fingerprinting (structural similarity)          │  │
│  │    • GNN inference via ONNX (semantic similarity)            │  │
│  │    • 32-dim embedding vectors                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 5. Storage (SQLite or Redis)                                 │  │
│  │    • Cache components table                                  │  │
│  │    • Cache dependencies table                                │  │
│  │    • Cache embeddings (FAISS index)                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 4. Storage written to disk
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│            ~/.metabob/.metabob/cpg_cache.db (SQLite)                │
│  Tables:                                                             │
│   • components (id, file_path, name, type, embedding_vector)        │
│   • dependencies (source_id, target_id, edge_type)                  │
│   • files (path, last_modified, hash)                               │
└──────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                      QUERY WORKFLOW                                   │
└──────────────────────────────────────────────────────────────────────┘
         │
         │ 5. OpenCode agent calls MCP tool
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│               METABOB UTILS (metabob-opencode)                       │
│  • suggestRelatedChanges(changedFiles, options)                     │
│  • analyzeChangeImpact(filePath, componentName, maxDepth)           │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 6. MCP call via stdio/http
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  MCP TOOLS (metabob-cli)                             │
│  • tools.py::suggest_related_changes()                              │
│  • tools.py::analyze_change_impact()                                │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 7. IPC query to analysis worker
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│              CPG MANAGER (analysis_worker.py)                        │
│  • cpg_manager.predict_related_files()                              │
│  • cpg_manager.analyze_change_impact()                              │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 8. Query cpg-inference
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│         CPG-INFERENCE LIBRARY (query operations)                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Co-Change Prediction Flow:                                   │  │
│  │                                                              │  │
│  │  1. Get embedding for changed file                          │  │
│  │  2. FAISS similarity search (top_k similar embeddings)      │  │
│  │  3. Return file_path + cochange_score (0-1)                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Change Impact Analysis Flow:                                 │  │
│  │                                                              │  │
│  │  1. Find component by ID in graph                           │  │
│  │  2. Traverse dependencies (forward)                         │  │
│  │  3. Traverse dependents (backward)                          │  │
│  │  4. Get similar components (embedding)                      │  │
│  │  5. Return aggregated impact data                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 9. Query results
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 CPG MANAGER (format results)                         │
│  • Calculate impact scores (0-1 normalized)                         │
│  • Enrich with issue data (if available)                            │
│  • Format for MCP response                                          │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 10. IPC response
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  MCP TOOLS (return to client)                        │
│  Response format:                                                    │
│  {                                                                   │
│    status: "success",                                               │
│    related_files: [                                                 │
│      {                                                              │
│        file_path: "api/routes.py",                                 │
│        cochange_score: 0.85,                                       │
│        total_issues: 3,                                            │
│        high_severity_issues: 1                                     │
│      }                                                              │
│    ]                                                                │
│  }                                                                   │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 11. MCP response via stdio/http
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               METABOB UTILS (metabob-opencode)                       │
│  • Parse MCP response                                               │
│  • Return to calling code                                           │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 12. Return to agent
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  ACTIVITY EXECUTION                                   │
│  • Agent receives related files list                                │
│  • Decides whether to review them                                   │
│  • Updates activity expectations (cochanges)                        │
└──────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                   LEARNING WORKFLOW (Future)                          │
└──────────────────────────────────────────────────────────────────────┘
         │
         │ 13. Activity completes
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│              ACTIVITY SYSTEM (metabob-opencode)                      │
│  • Compare predicted_cochanges vs actual_changes                    │
│  • Calculate cochange_accuracy (0-1)                                │
│  • Store learning record                                            │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 14. POST to backend
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│              BACKEND API (metabob-rpc-api)                           │
│  • Store in activity_cochange_learning table                        │
│  • Aggregate learning data weekly                                   │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               │ 15. Weekly cron job (future)
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│              MODEL FINE-TUNING PIPELINE                              │
│  • Fetch learning data (last 30 days)                              │
│  • Prepare training pairs (positive/negative)                       │
│  • Fine-tune GNN model                                              │
│  • Deploy new model version                                         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Structures

### CPGComponent
```python
{
  "id": "auth.py::login",              # Unique component ID
  "file_path": "auth.py",              # Source file
  "name": "login",                     # Function/class name
  "type": "function",                  # function, class, method
  "start_line": 42,                    # Location in file
  "end_line": 58,
  "embedding": [0.12, -0.45, ...],     # 32-dim GNN embedding
  "simhash": 123456789012345678        # 128-bit structural hash
}
```

### Dependency Edge
```python
{
  "source_id": "auth.py::login",       # Caller
  "target_id": "db.py::query",         # Callee
  "edge_type": "CALLS",                # CALLS, IMPORTS, INHERITS, DEPENDS
  "line_number": 45                    # Where the call occurs
}
```

### Co-Change Prediction
```typescript
{
  file_path: "api/routes.py",          // File predicted to change
  cochange_score: 0.85,                // Confidence 0-1
  total_issues: 3,                     // Issues in this file
  high_severity_issues: 1,             // Critical issues
  critical_issues: 0,
  recommendation: "Review for consistency"
}
```

### Change Impact Analysis
```typescript
{
  status: "success",
  component_id: "auth.py::login",
  direct_dependencies: 5,              // What this calls directly
  direct_dependents: 12,               // What calls this directly
  transitive_dependencies: 45,         // Transitive closure forward
  transitive_dependents: 120,          // Transitive closure backward
  similar_components: [                // Semantically similar
    "auth.py::logout",
    "api.py::authenticate"
  ],
  graph_forward: [...],                // Full dependency list
  graph_backward: [...]                // Full dependent list
}
```

---

## ⚡ Performance Characteristics

### Update Operations (File Modified)
```
File Change Event
  ↓ (0ms) File watcher detects
  ↓ (1ms) IPC to worker
  ↓ (10-50ms) Tree-sitter parse
  ↓ (20-100ms) CPG update + embeddings
  ↓ (5ms) SQLite write
  = Total: 36-156ms per file
```

### Query Operations (Agent Requests Data)
```
MCP Tool Call
  ↓ (1ms) MCP handler
  ↓ (2ms) IPC to worker
  ↓ (1-10ms) CPG query (cache hit)
  ↓ (2ms) Issue data enrichment
  ↓ (1ms) Format response
  ↓ (2ms) IPC + MCP return
  = Total: 9-19ms per query (typical)
```

### Cold Start (CPG Not Initialized)
```
First Query After Restart
  ↓ (10-50ms) Load GNN model (ONNX)
  ↓ (5-20ms) Load SQLite cache
  ↓ (10-100ms) Rebuild FAISS index
  ↓ (query time)
  = Total: 25-170ms first query
```

---

## 🔄 Update Strategies

### Progressive Updates (Default)
- ✅ Only parse changed files
- ✅ Incremental graph merge
- ✅ Fast (20-100ms per file)
- ✅ Low memory overhead

### Full Rebuild (Rare)
- ⚠️ Parse entire codebase
- ⚠️ Rebuild entire graph
- ⚠️ Slow (minutes for large codebases)
- ✅ Needed after CPG schema changes

### Background Indexing (Startup)
- ✅ Index frequently-accessed files
- ✅ Non-blocking (async)
- ✅ Warm cache for common queries
- ✅ Reduces cold-start latency

---

## 🎯 Optimization Points

### 1. Cache Warming
**Where**: Server startup  
**Impact**: Reduce cold-start latency by 70%  
**Implementation**: Background index of hot files (activity history)

### 2. Redis Backend
**Where**: CPGManager initialization  
**Impact**: Shared cache across multiple servers, faster queries  
**Implementation**: Use RedisStorage instead of SQLiteStorage

### 3. Batch Updates
**Where**: File watcher  
**Impact**: Reduce CPU usage during bulk file operations  
**Implementation**: Debounce file changes (100ms window)

### 4. Embedding Cache TTL
**Where**: cpg-inference service  
**Impact**: Reduce memory for rarely-accessed files  
**Implementation**: LRU cache with 1000-file limit

---

## 📚 Key Takeaways

1. **Progressive CPG updates** = no full rebuilds, always fast
2. **File watcher integration** = automatic, non-blocking indexing
3. **Hybrid analysis** = graph traversal + GNN embeddings
4. **Persistent cache** = SQLite (local) or Redis (distributed)
5. **Sub-20ms queries** = production-ready performance
6. **Graceful degradation** = tools work without CPG, just without predictions

---

**Next**: See `CPG_COCHANGE_MAXIMIZATION_GUIDE.md` for implementation details and code examples.
