# Analysis System Integration Specification

## Overview

This spec defines the integration between the analysis system (CPG, co-change prediction, problem detection) and the activity system (MiniBob, impulses, composition). The goal is to enable MiniBob to use metabob-mcp tools effectively by populating them with real data.

---

## Current State Analysis

### What Works

| Component | Status | Key Capabilities |
|-----------|--------|------------------|
| **MiniBob Activity Execution** | ✅ Working | Full activity lifecycle, state capture, ribosome extraction |
| **Impulse System** | ✅ Working | Lazy loading, budget management, memo/file pointers |
| **Thompson Sampling** | ✅ Working | Template recommendation, variant metrics |
| **cpg-inference-ts** | ✅ Working | Graph building, embeddings, FAISS search |
| **Dashboard Rendering** | ✅ Working | Primitive-based composition, real-time updates |

### What's Broken

| Component | Status | Issue |
|-----------|--------|-------|
| **metabob-analysis-api** | ❌ Mock Data | 16+ TODO comments, all endpoints return hardcoded data |
| **CPG Population** | ❌ Empty | No mechanism to add files to CPG |
| **Learning Service** | ❌ Disconnected | Implemented but never called |
| **Analysis → Activity Bridge** | ❌ Missing | No impulse types for analysis results |

---

## System Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT LAYER                                       │
│                                                                             │
│   ┌─────────────────────┐              ┌─────────────────────────────────┐ │
│   │    metabob-mcp      │              │   metabob-cloud-dashboard       │ │
│   │   (7 MCP tools)     │              │   (Observability UI)            │ │
│   └──────────┬──────────┘              └──────────────┬──────────────────┘ │
│              │                                        │                     │
└──────────────┼────────────────────────────────────────┼─────────────────────┘
               │ HTTP/REST                              │ HTTP/WS
               │                                        │
┌──────────────┼────────────────────────────────────────┼─────────────────────┐
│              ▼                                        ▼                     │
│   ┌─────────────────────┐              ┌─────────────────────────────────┐ │
│   │ metabob-analysis-api│◄────────────▶│   metabob-activity-api          │ │
│   │                     │   Impulse    │                                 │ │
│   │ - CPG management    │   Proxy      │ - Activity templates            │ │
│   │ - Problem detection │              │ - Impulse resolution            │ │
│   │ - Co-change predict │              │ - Thompson Sampling             │ │
│   │ - Learning service  │              │ - Execution traces              │ │
│   └──────────┬──────────┘              └──────────────┬──────────────────┘ │
│              │                                        │                     │
│   BACKEND    │                                        │                     │
│   LAYER      │                                        │                     │
└──────────────┼────────────────────────────────────────┼─────────────────────┘
               │                                        │
               │ Library                                │ MCP Client
               │                                        │
┌──────────────┼────────────────────────────────────────┼─────────────────────┐
│              ▼                                        ▼                     │
│   ┌─────────────────────┐              ┌─────────────────────────────────┐ │
│   │  cpg-inference-ts   │              │         minibob                 │ │
│   │                     │              │                                 │ │
│   │ - GraphBuilder      │              │ - Activity executor             │ │
│   │ - CoChangePredictor │              │ - Goal processor                │ │
│   │ - FAISSIndex        │              │ - Impulse management            │ │
│   │ - Embeddings        │              │ - Ribosome extraction           │ │
│   └─────────────────────┘              └─────────────────────────────────┘ │
│                                                                             │
│   ENGINE LAYER                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
               │                                        │
               │                                        │
┌──────────────┼────────────────────────────────────────┼─────────────────────┐
│              ▼                                        ▼                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                        SurrealDB                                    │  │
│   │                                                                     │  │
│   │  Core:          Activity:              Analysis:                    │  │
│   │  - organizations - activity_registry   - analysis_problems          │  │
│   │  - users         - execution_traces    - code_components            │  │
│   │  - projects      - composition_graph   - cochange_patterns          │  │
│   │  - api_keys      - impulse_data        - impact_relations           │  │
│   │  - minibob_inst  - tool_usage          - annotations                │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   STORAGE LAYER                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Requirements

### Flow 1: Index Codebase → CPG Ready

```
Agent/MiniBob                    metabob-analysis-api              cpg-inference-ts
     │                                   │                              │
     │ POST /v2/analysis/index           │                              │
     │ { files: { path: content } }      │                              │
     │──────────────────────────────────▶│                              │
     │                                   │ predictor.addFile(path, content)
     │                                   │─────────────────────────────▶│
     │                                   │                              │ Parse AST
     │                                   │                              │ Build graph
     │                                   │                              │ Generate embeddings
     │                                   │                              │ Index in FAISS
     │                                   │◀─────────────────────────────│
     │ { indexed: 50, status: 'ready' }  │                              │
     │◀──────────────────────────────────│                              │
```

### Flow 2: Analysis Query → Real Results

```
metabob-mcp                      metabob-analysis-api              cpg-inference-ts
     │                                   │                              │
     │ get_priority_issues()             │                              │
     │──────────────────────────────────▶│                              │
     │                                   │ Query CPG for complexity hotspots
     │                                   │─────────────────────────────▶│
     │                                   │◀─────────────────────────────│
     │                                   │ Query analysis_problems table │
     │                                   │ (SurrealDB)                   │
     │                                   │                              │
     │ { issues: [...real data...] }     │                              │
     │◀──────────────────────────────────│                              │
```

### Flow 3: Analysis Results → Activity Impulses

```
Activity needs context           metabob-activity-api           metabob-analysis-api
     │                                   │                              │
     │ resolve impulse:                  │                              │
     │ { type: "analysisResult",         │                              │
     │   resultId: "prob_123" }          │                              │
     │──────────────────────────────────▶│                              │
     │                                   │ Proxy to analysis-api         │
     │                                   │ GET /v2/analysis/problems/prob_123
     │                                   │─────────────────────────────▶│
     │                                   │◀─────────────────────────────│
     │                                   │ Format as markdown for LLM    │
     │ { content: "## Problem...\n..." } │                              │
     │◀──────────────────────────────────│                              │
```

### Flow 4: Execution → Learning Feedback

```
MiniBob                          metabob-activity-api           metabob-analysis-api
     │                                   │                              │
     │ POST /v2/activities/execution-traces
     │ { filesModified: [...] }          │                              │
     │──────────────────────────────────▶│                              │
     │                                   │ Store trace                   │
     │                                   │                              │
     │                                   │ Forward co-change event       │
     │                                   │ POST /v2/analysis/learning/cochange
     │                                   │─────────────────────────────▶│
     │                                   │                     Update patterns
     │                                   │                     Increment freq
     │                                   │◀─────────────────────────────│
     │ { stored: true }                  │                              │
     │◀──────────────────────────────────│                              │
```

---

## Database Schema Ownership

### Tables Written by metabob-analysis-api

| Table | Purpose | Population Source |
|-------|---------|-------------------|
| `analysis_problems` | Detected code issues | CPG analysis |
| `code_components` | Parsed code metadata | CPG parsing |
| `cochange_patterns` | File correlation data | Git history + learning |
| `impact_relations` | Dependency relationships | CPG edges |
| `design_patterns` | Recognized patterns | CPG pattern matching |
| `progressive_sync_state` | Analysis sync tracking | Incremental analysis |
| `annotations` | Developer notes | User input + auto-generated |

### Tables Written by metabob-activity-api

| Table | Purpose | Population Source |
|-------|---------|-------------------|
| `activity_registry` | Templates + vessel functions | MiniBob + ribosome |
| `activity_execution_traces` | Execution results | MiniBob executions |
| `activity_composition_graph` | Activity relationships | Composition tracking |
| `impulse_data` | Impulse content storage | MiniBob + resolution |
| `impulse_relevance_metrics` | Impulse effectiveness | Execution correlation |
| `tool_usage` | Tool call patterns | Execution traces |
| `goal_execution_paths` | Goal → activity sequences | Goal processor |

### Shared Tables (Core)

| Table | Writer | Purpose |
|-------|--------|---------|
| `organizations` | Helm init-data | Multi-tenancy |
| `users` | Auth routes | User management |
| `projects` | Admin routes | Project scoping |
| `api_keys` | User routes | API authentication |
| `minibob_instance` | Helm init-data | Vessel registration |

---

## New Impulse Pointer Types

Add to `metabob-activity-api/src/routes/impulses.ts`:

```typescript
// Analysis Result (single problem)
{
  type: "analysisResult",
  resultId: string,        // problem ID
  format?: "full" | "summary"
}

// Co-change Suggestions
{
  type: "cochangeSuggestions",
  componentIds: string[],  // Components being changed
  limit?: number
}

// Impact Analysis
{
  type: "impactAnalysis",
  changedFiles: string[],  // Files being modified
  maxDepth?: number
}

// Codebase Search
{
  type: "codebaseSearch",
  query: string,           // Natural language query
  filters?: {
    severity?: string[],
    category?: string[]
  },
  limit?: number
}
```

---

## New API Endpoints

### metabob-analysis-api

```typescript
// Index codebase files into CPG
POST /v2/analysis/index
Body: {
  files: Record<string, string>,  // path → content
  incremental?: boolean           // update vs replace
}
Response: {
  indexed: number,
  components: number,
  status: 'ready' | 'indexing'
}

// Get CPG status
GET /v2/analysis/status
Response: {
  status: 'uninitialized' | 'indexing' | 'ready',
  filesIndexed: number,
  componentsCount: number,
  lastIndexedAt: string
}

// Learning feedback (called by activity-api)
POST /v2/analysis/learning/cochange
Body: {
  session_id: string,
  changed_files: string[],
  project_id?: string
}
Response: { recorded: true }
```

### metabob-activity-api

```typescript
// Proxy analysis results as impulses
// (Handled in existing /v2/impulses/resolve endpoint)
// New pointer types: analysisResult, cochangeSuggestions,
//                    impactAnalysis, codebaseSearch
```

---

## Pattern Colocation Decisions

### Decision 1: Analysis Results Storage

**Choice**: Store in separate `analysis_*` tables, expose via impulse pointers

**Rationale**:
- Structured querying needs proper tables (severity filtering, metrics)
- LLM context needs formatted markdown (impulse system handles this)
- Separation allows independent scaling of analysis vs activity

### Decision 2: CPG Building

**Choice**: Direct API endpoint in analysis-api, orchestrated by activity

**Rationale**:
- Heavy computation belongs in analysis-api (has cpg-inference-ts)
- Activity orchestration allows flexible triggering (boredom, on-demand)
- Session-scoped CPG avoids cross-tenant contamination

### Decision 3: Learning Feedback

**Choice**: Asynchronous via event forwarding

**Rationale**:
- Synchronous would block activity execution
- Thompson Sampling works with eventual consistency
- Allows batching for efficiency

### Decision 4: Index Location

**Choice**: metabob-analysis-api with `/v2/analysis/index`

**Rationale**:
- Analysis-api owns cpg-inference-ts dependency
- Natural place for CPG session management
- Keeps activity-api focused on execution/learning

---

## Milestone Structure

### M1: CPG Population (Foundation)
Enable indexing codebases into the CPG so analysis has data to work with.

### M2: Real Analysis Data
Replace mock data with actual CPG queries in analysis-api.

### M3: Impulse Bridge
Connect analysis results to the activity system via impulse pointers.

### M4: Learning Loop
Wire execution feedback to the learning service for pattern improvement.

### M5: End-to-End Flow
Full cycle: index → analyze → activity → feedback → improved analysis.

---

## Files to Modify

### metabob-analysis-api

| File | Changes |
|------|---------|
| `src/routes/index.ts` | Add `/v2/analysis/index` route |
| `src/routes/search.ts` | Replace mock with CPG query |
| `src/routes/priority.ts` | Replace mock with DB + CPG query |
| `src/routes/cochange.ts` | Wire to real CPG predictor |
| `src/routes/impact.ts` | Wire to real CPG traversal |
| `src/routes/problems.ts` | Query real `analysis_problems` table |
| `src/services/cpg-service.ts` | Add `addFiles()`, `getStatus()` methods |
| `src/services/learning-service.ts` | Add `/learning/cochange` endpoint handler |

### metabob-activity-api

| File | Changes |
|------|---------|
| `src/routes/impulses.ts` | Add analysis pointer type resolution |
| `src/routes/activities.ts` | Forward co-change events on trace storage |

### metabob-mcp

| File | Changes |
|------|---------|
| `src/tools/index.ts` | Add `index_codebase` tool registration |
| `src/tools/index-codebase.ts` | New tool implementation |

### New Files

| File | Purpose |
|------|---------|
| `metabob-analysis-api/src/routes/indexing.ts` | CPG indexing endpoint |
| `metabob-analysis-api/src/routes/learning.ts` | Learning feedback endpoint |
| `metabob-mcp/src/tools/index-codebase.ts` | New MCP tool |

