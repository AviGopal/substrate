# cpg-inference-ts - OpenSpec Proposal

**Status:** Draft
**Created:** 2026-03-23
**Author:** System (via Claude Code)
**Type:** Library Translation
**Repo:** `repos/cpg-inference-ts`

---

## Problem Statement

The current CPG library (`repos/cpg-inference`) is written in Python, which:

1. **Blocks TypeScript Integration:** Cannot be imported directly by TypeScript backends
2. **Deployment Complexity:** Requires Python runtime alongside Bun services
3. **Performance:** Python CPG parsing is slower than native tree-sitter bindings
4. **Maintenance:** Python codebase (~4 years old) harder to evolve with MiniBob
5. **Type Safety:** Lacks compile-time type checking for graph operations

## Proposed Solution

Translate `repos/cpg-inference` to TypeScript, creating a **foundation library** that unblocks all analysis work.

**Scope:** ~4,000-6,000 LOC TypeScript library
**Stack:** TypeScript + tree-sitter + ONNX + FAISS

### Core Components

**1. Graph Engine**
- Parse source files with tree-sitter
- Build Code Property Graphs (nodes + edges)
- Query engine for graph traversal
- Cache graphs for performance

**2. Embedding Service**
- ONNX model for code embeddings
- FAISS index for similarity search
- Batch embedding generation
- Vector storage and retrieval

**3. Co-Change Predictor**
- Bayesian model for co-change patterns
- Learning from git history
- Confidence scoring
- Pattern persistence

## Dependencies

**Blocked By:** None (foundation layer)
**Blocks:**
- `metabob-analysis-api` (needs CPG library)
- `metabob-mcp` (indirectly, via analysis-api)

**External Dependencies:**
- `@tree-sitter/node` (TypeScript bindings)
- `onnxruntime-node` (ONNX model execution)
- `faiss-node` (vector similarity search)
- `better-sqlite3` (graph caching)

## Success Criteria

1. **Functional Parity:** All Python CPG features work in TypeScript
2. **Performance:** CPG build time ≤ Python version
3. **Type Safety:** Zero TypeScript errors
4. **Test Coverage:** >80% coverage on core graph operations
5. **Integration:** `metabob-analysis-api` can import and use library

## Non-Goals

- Not adding new CPG features (translation only)
- Not optimizing beyond Python performance (match is sufficient)
- Not supporting languages beyond what Python version supports

## Timeline

**Week 1-2:** Complete library translation (14 tasks)
- Week 1: Core types + Graph engine
- Week 2: Embedding service + Co-change predictor

## References

- Source: `repos/cpg-inference/` (Python implementation)
- Tasks: [tasks.md](./tasks.md)
- Design: [design.md](./design.md)
