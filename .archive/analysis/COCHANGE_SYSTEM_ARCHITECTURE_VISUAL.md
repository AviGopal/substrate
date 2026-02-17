# Cochange System Architecture - Visual Guide

**Visual diagrams showing how cochange embeddings, impulses, and activity learning integrate**

---

## System Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         CODE CHANGES DETECTED                           │
│                         (git diff, file watch)                         │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             ↓
┌────────────────────────────────────────────────────────────────────────┐
│                      COCHANGE ANALYSIS ENGINE                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  CPG Inference (cpg-inference Python package)                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │ Tree-sitter  │→ │ CPG Builder  │→ │ SimHash      │          │  │
│  │  │ Parsing      │  │ (dependencies)│  │ Features     │          │  │
│  │  └──────────────┘  └──────────────┘  └──────┬───────┘          │  │
│  │                                              ↓                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │ ONNX GNN     │→ │ 32-dim       │→ │ FAISS        │          │  │
│  │  │ Model        │  │ Embeddings   │  │ Index        │          │  │
│  │  └──────────────┘  └──────────────┘  └──────┬───────┘          │  │
│  │                                              ↓                   │  │
│  │                          ┌──────────────────────────┐            │  │
│  │                          │ Similarity Search        │            │  │
│  │                          │ (top-k most similar)     │            │  │
│  │                          └──────────┬───────────────┘            │  │
│  └─────────────────────────────────────┼──────────────────────────┘  │
└────────────────────────────────────────┼───────────────────────────────┘
                                         │
                                         ↓
┌────────────────────────────────────────────────────────────────────────┐
│                        METABOB CLI MCP TOOLS                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ suggest_related_changes(changed_files, top_k)                   │  │
│  │  ↓                                                               │  │
│  │  1. Call CPG inference predict_cochanges()                      │  │
│  │  2. Get similar files from FAISS index                          │  │
│  │  3. Enrich with issue data from cache                           │  │
│  │  4. Return ranked suggestions                                   │  │
│  │                                                                  │  │
│  │ Output: [{file_path, issues, severity, recommendation}]         │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────────────┐
│                         IMPULSE CREATION                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Memory Agent creates impulse from cochange data:                │  │
│  │                                                                  │  │
│  │  type: "memo" | "bashOutput"                                    │  │
│  │  content: {                                                     │  │
│  │    cochange_predictions: [...],                                 │  │
│  │    related_files: [...],                                        │  │
│  │    component_annotations: [...],                                │  │
│  │    priority_issues: [...]                                       │  │
│  │  }                                                              │  │
│  │  budget: 2000 tokens                                            │  │
│  │                                                                  │  │
│  │ Stored in: Session.impulse.create(sessionID, impulse)           │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────────────┐
│                       ACTIVITY EXECUTION                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Activity Template with Cochange Context                         │  │
│  │                                                                  │  │
│  │ Agent Prompt:                                                   │  │
│  │  <system>Activity instructions...</system>                      │  │
│  │  <session_memory>                                               │  │
│  │    <impulse id="cochange-context">                              │  │
│  │      Files that change together:                                │  │
│  │      - auth-utils.ts (12 issues, 2 HIGH)                        │  │
│  │      - session.ts (5 issues)                                    │  │
│  │    </impulse>                                                   │  │
│  │  </session_memory>                                              │  │
│  │  <user>Fix authentication bug</user>                            │  │
│  │                                                                  │  │
│  │ Agent Decisions (tracked):                                      │  │
│  │  1. Fix primary bug in auth.ts                                  │  │
│  │  2. Check auth-utils.ts (from cochange hint) ✓                  │  │
│  │  3. Update session.ts (from cochange hint) ✓                    │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────────────┐
│                      OUTCOME RECORDING                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ActivityOutcomeRecorder.recordOutcome({                         │  │
│  │   activityId: "act_123",                                        │  │
│  │   templateId: "fix-bug-v1",                                     │  │
│  │   expectation: {                                                │  │
│  │     predictedCochanges: ["auth.ts", "auth-utils.ts", "..."]    │  │
│  │   },                                                            │  │
│  │   result: {                                                     │  │
│  │     actualFiles: ["auth.ts", "auth-utils.ts", "api/users.ts"]  │  │
│  │   },                                                            │  │
│  │   comparison: {                                                 │  │
│  │     cochangeAccuracy: 0.66,  // 2/3 correct                    │  │
│  │     missedFiles: ["session.ts"],                               │  │
│  │     extraFiles: ["api/users.ts"]                               │  │
│  │   }                                                             │  │
│  │ })                                                              │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTED LEARNING (Backend)                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ DistributedTemplateFeedback receives outcome                    │  │
│  │                                                                  │  │
│  │ Analyzes:                                                       │  │
│  │  • Cochange accuracy trends                                     │  │
│  │  • Frequently missed files                                      │  │
│  │  • Template performance by file type                            │  │
│  │                                                                  │  │
│  │ Actions:                                                        │  │
│  │  1. Update embedding weights (auth → api cochange)              │  │
│  │  2. Evolve template (add "check API files" step)                │  │
│  │  3. Commission variant if accuracy < 60%                        │  │
│  │  4. Route future auth tasks to best-performing container        │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
                              ↓
                    ┌─────────────────────┐
                    │  IMPROVED TEMPLATES  │
                    │  BETTER PREDICTIONS  │
                    └─────────────────────┘
```

---

## Data Flow Through Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Layer 1: Code Analysis                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input:  File content (auth.py)                                     │
│    ↓                                                                 │
│  [Tree-sitter Parse] → AST                                          │
│    ↓                                                                 │
│  [CPG Builder] → Dependency graph                                   │
│    ↓                                                                 │
│  [SimHash] → 128-bit structural fingerprint                         │
│    ↓                                                                 │
│  [GNN Model] → 32-dimensional embedding vector                      │
│    ↓                                                                 │
│  Output: [0.12, -0.45, 0.89, ..., 0.34]  (32 floats)               │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 2: Similarity Search                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input:  Query embedding [0.12, -0.45, ...]                        │
│    ↓                                                                 │
│  [FAISS Index] → Nearest neighbor search                            │
│    ↓                                                                 │
│  Output: [(file_id, similarity_score), ...]                         │
│          [("auth-utils.ts", 0.89),                                  │
│           ("session.ts", 0.78),                                     │
│           ("api/users.ts", 0.71)]                                   │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   Layer 3: Context Enrichment                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input:  Similar files with scores                                  │
│    ↓                                                                 │
│  [Issue Cache Lookup] → Add issue counts                            │
│    ↓                                                                 │
│  [Annotation Lookup] → Add component context                        │
│    ↓                                                                 │
│  [Priority Calculation] → Rank by importance                        │
│    ↓                                                                 │
│  Output: Enriched suggestions:                                      │
│          [{                                                          │
│            file: "auth-utils.ts",                                   │
│            similarity: 0.89,                                         │
│            issues: 12,                                               │
│            high_severity: 2,                                         │
│            components: ["hashPassword", "validateToken"],           │
│            recommendation: "⚠️ High priority"                        │
│          }]                                                          │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 4: Impulse Synthesis                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input:  Enriched suggestions                                       │
│    ↓                                                                 │
│  [Format as Memo] → Human-readable context                          │
│    ↓                                                                 │
│  [Token Budget] → Allocate 2000 tokens                              │
│    ↓                                                                 │
│  [Session Store] → Save to session memory                           │
│    ↓                                                                 │
│  Output: Impulse object stored in session                           │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   Layer 5: Activity Execution                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input:  Activity request + session memory (with impulses)          │
│    ↓                                                                 │
│  [Load Template] → Get activity definition                          │
│    ↓                                                                 │
│  [Inject Impulses] → Add to agent prompt                            │
│    ↓                                                                 │
│  [Execute Tasks] → Agent makes decisions                            │
│    ↓                                                                 │
│  [Track Decisions] → Record what agent chose                        │
│    ↓                                                                 │
│  Output: Modified files + decision log                              │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 6: Learning & Evolution                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input:  Execution outcome (predicted vs actual)                    │
│    ↓                                                                 │
│  [Compare] → Calculate accuracy metrics                             │
│    ↓                                                                 │
│  [Aggregate] → Combine with historical data                         │
│    ↓                                                                 │
│  [Analyze Patterns] → Find systematic errors                        │
│    ↓                                                                 │
│  [Update Model] → Adjust embedding weights                          │
│    ↓                                                                 │
│  [Evolve Template] → Add missing steps                              │
│    ↓                                                                 │
│  Output: Improved template + better embeddings                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Timing Breakdown (Typical Workflow)

```
Total: ~500-800ms from code change to enriched suggestions

┌─────────────────────────────────────────────────────────────┐
│ CPG Analysis (Background, non-blocking)         ~60-110ms   │
│  ├─ Tree-sitter parse                           ~20-30ms    │
│  ├─ CPG construction                            ~15-25ms    │
│  ├─ Feature generation (SimHash)                ~10-20ms    │
│  ├─ GNN inference (ONNX)                        ~10-25ms    │
│  └─ FAISS index update                          ~5-10ms     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Cochange Query (On-demand)                      ~50-200ms   │
│  ├─ FAISS similarity search                     ~10-50ms    │
│  ├─ Issue cache lookup                          ~20-80ms    │
│  ├─ Annotation retrieval                        ~10-40ms    │
│  └─ Priority calculation                        ~10-30ms    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Impulse Creation                                 ~50-100ms   │
│  ├─ Format synthesis                            ~20-40ms    │
│  ├─ Token counting                              ~10-30ms    │
│  └─ Session storage write                       ~20-30ms    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Activity Execution                               30-120s     │
│  ├─ Template loading                            ~100-200ms  │
│  ├─ Impulse injection                           ~50-100ms   │
│  ├─ Agent execution (LLM calls)                 30-120s     │
│  └─ Outcome recording                           ~100-300ms  │
└─────────────────────────────────────────────────────────────┘
```

---

## Memory & Storage Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    In-Memory (Fast Access)                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FAISS Index (Embeddings)                        ~50-200 MB    │
│   └─ All component embeddings for fast search                  │
│                                                                 │
│  CPG Cache (Component Metadata)                  ~10-50 MB     │
│   └─ Component IDs, names, types, locations                    │
│                                                                 │
│  Issue Cache (Optimistic)                        ~5-20 MB      │
│   └─ Recent code quality issues by file                        │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                   Persistent Storage (Disk)                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Session Database (~/.local/share/opencode/storage/)           │
│   ├─ session/[project]/[session-id].json                       │
│   ├─ message/[session-id]/[msg-id].json                        │
│   ├─ part/[msg-id]/[part-id].json                              │
│   └─ impulse/[session-id]/[impulse-id].json                    │
│                                                                 │
│  Metabob State (.metabob/)                                     │
│   ├─ state (session token, config)                             │
│   ├─ cache/ (analysis results)                                 │
│   └─ embeddings.faiss (FAISS index file)                       │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                  Backend API (Distributed)                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Activity Outcomes Database                                    │
│   └─ Execution results, cochange accuracy, decisions           │
│                                                                 │
│  Template Evolution Store                                      │
│   └─ Template versions, variants, performance metrics          │
│                                                                 │
│  Embedding Training Data                                       │
│   └─ Historical cochange patterns for model retraining         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Integration Points Summary

| Component | Provides | Consumes | Performance |
|-----------|----------|----------|-------------|
| **CPG Inference** | Embeddings, cochange predictions | File content | 60-110ms parse, <200ms query |
| **Metabob CLI** | MCP tools, enriched suggestions | CPG predictions + issue cache | <500ms typical |
| **Impulse System** | Contextual memory for agents | Cochange data + annotations | <100ms creation |
| **Activity Templates** | Structured workflows | Impulses in session memory | 30-120s execution |
| **Outcome Recorder** | Learning data | Execution results | <300ms recording |
| **Backend API** | Template evolution | Aggregated outcomes | Async, non-blocking |

---

## Key Files to Reference

```
repos/
├── cpg-inference/
│   └── cpg_inference/
│       ├── service.py                    # CoChangePredictor.predict_cochanges()
│       ├── index_manager.py              # FAISS similarity search
│       └── models.py                     # CoChangePrediction model
│
├── metabob-cli/
│   └── src/metabob_cli/mcp/
│       ├── tools.py                      # suggest_related_changes()
│       ├── cpg_manager.py                # CPG lifecycle management
│       └── analysis_worker.py            # Background analysis worker
│
└── metabob-opencode/
    └── packages/opencode/src/
        ├── session/
        │   ├── activity-outcome-recorder.ts    # Record cochange accuracy
        │   ├── distributed-template-feedback.ts # Learning system
        │   └── impulse-*.ts                    # Impulse management
        └── util/
            ├── metabob.ts                      # CLI integration
            └── metabob-api.ts                  # Backend API client
```

---

## Metrics Dashboard (Ideal)

```
┌─────────────────────────────────────────────────────────────────┐
│                   Cochange System Health                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Cochange Accuracy (Last 24h)           ████████░░   82%        │
│  Query Response Time (p95)                           <250ms     │
│  Background Analysis Lag                             <30s       │
│  FAISS Index Size                                    127 MB     │
│  Impulse Creation Success Rate           ██████████  98%        │
│  Activity Execution with Context         ████████░░   85%       │
│                                                                  │
│  Top Cochange Pairs:                                            │
│   • auth.ts ↔ auth-utils.ts             89% confidence          │
│   • session.ts ↔ auth.ts                78% confidence          │
│   • api/users.ts ↔ auth.ts              71% confidence          │
│                                                                  │
│  Templates by Cochange Accuracy:                                │
│   1. fix-bug-complete-v1                92%  ⭐⭐⭐⭐⭐          │
│   2. refactor-with-tests                87%  ⭐⭐⭐⭐            │
│   3. add-feature-complete               76%  ⭐⭐⭐             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

This architecture provides:

✅ **Real-time cochange prediction** via CPG + GNN embeddings  
✅ **Context-aware activity execution** via impulse system  
✅ **Continuous learning** via outcome recording and feedback  
✅ **Performance optimization** via caching and async processing  
✅ **Distributed evolution** via backend API and template variants  

**Result**: Activities that get smarter over time by learning which files change together and using that knowledge to provide better context and make better decisions.
