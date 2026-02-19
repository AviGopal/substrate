# CPG & Co-Change Model Integration Architecture

**Status**: Current State Analysis + Optimization Roadmap  
**Date**: 2026-02-19  
**Purpose**: Document how CPG-inference and co-change models integrate across metabob-cli, metabob-opencode, and metabob-rpc-api to maximize their potential

---

## 🎯 Executive Summary

The CPG (Code Property Graph) and co-change prediction system is **partially integrated** across the stack with **significant untapped potential**. Current usage focuses on metabob-cli MCP tools, with lightweight integration in metabob-opencode. **Key opportunity**: Expand usage to activity execution, impulse system, and proactive code quality workflows.

### Current Integration Level
- **metabob-cli**: ✅ **Full integration** (CPGManager, MCP tools, file watcher)
- **metabob-opencode**: ⚠️ **Partial integration** (activity validation, context scoring)
- **metabob-rpc-api**: ❌ **Not integrated** (currently unused)

### Potential Impact
- **High**: Activity-driven co-change prediction (auto-suggest related files)
- **High**: Impulse context prioritization (CPG impact scores)
- **Medium**: Proactive issue detection (CPG-enhanced priority)
- **Medium**: Test selection (dependency-based test discovery)

---

## 📐 Architecture Overview

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    CPG-Inference Package                    │
│  (repos/cpg-inference - v0.5.2)                            │
│                                                             │
│  • CoChangePredictor: Main service                         │
│  • GraphQueryEngine: Graph traversal                       │
│  • CPGComponentExtractor: AST parsing                      │
│  • SQLiteStorage: Persistent caching                       │
│  • Bundled GNN Model (69KB): Semantic embeddings           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ pip install cpg-inference
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      metabob-cli                            │
│  (MCP Server - Python)                                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ CPGManager (cpg_manager.py)                          │ │
│  │  • Progressive file indexing                          │ │
│  │  • Impact score calculation                           │ │
│  │  • Co-change prediction                               │ │
│  │  • Storage: ~/.metabob/.metabob/cpg_cache.db         │ │
│  └───────────────────────────────────────────────────────┘ │
│                              │                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ MCP Tools (tools.py)                                  │ │
│  │  • analyze_change_impact                              │ │
│  │  • list_file_components                               │ │
│  │  • suggest_related_changes                            │ │
│  │  • get_priority_issues (CPG-enhanced)                 │ │
│  └───────────────────────────────────────────────────────┘ │
│                              │                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ File Watcher (server.py)                              │ │
│  │  • Auto-sync file changes → CPG                       │ │
│  │  • Incremental graph updates                          │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ MCP Protocol (stdio/http)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   metabob-opencode                          │
│  (OpenCode CLI - TypeScript)                                │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Metabob Integration (util/metabob.ts)                 │ │
│  │  • suggestRelatedChanges() → MCP call                 │ │
│  │  • Context scoring with cochange_score                │ │
│  │  • Activity expectation validation                    │ │
│  └───────────────────────────────────────────────────────┘ │
│                              │                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Activity System (session/activity.ts)                 │ │
│  │  • useCochangePrediction: boolean (config)            │ │
│  │  • Expected cochanges tracking                        │ │
│  │  • Cochange accuracy metrics                          │ │
│  └───────────────────────────────────────────────────────┘ │
│                              │                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Context System (session/system.ts)                    │ │
│  │  • Related files with cochange_score                  │ │
│  │  • Context item prioritization                        │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ (Not currently connected)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   metabob-rpc-api                           │
│  (Backend API - Python)                                     │
│                                                             │
│  • cpg-inference installed (.venv/lib/)                    │
│  • ❌ NOT USED: No CPGManager, no endpoints               │
│  • OPPORTUNITY: Expose CPG queries via REST API            │
└─────────────────────────────────────────────────────────────┘
```

