# cpg-inference-ts - Implementation Tasks

**Status:** Draft
**Created:** 2026-03-23
**Repo:** `repos/cpg-inference-ts`

---

## Task Organization

Tasks organized by component. Each task includes:
- **ID:** Unique identifier
- **Depends On:** Prerequisites (by task ID)
- **Estimate:** Rough time estimate
- **Acceptance Criteria:** How to verify completion

**Total Tasks:** 14
**Timeline:** Week 1-2

---

## Phase 0: Prerequisites (Before Week 1)

### PREREQ-1: Repository Setup
**Depends On:** None
**Estimate:** 30 minutes

**Description:**
Initialize TypeScript project with Bun configuration.

**Acceptance Criteria:**
- [ ] `repos/cpg-inference-ts/` directory exists
- [ ] `package.json` configured with dependencies:
  - `@tree-sitter/node`
  - `onnxruntime-node`
  - `faiss-node`
  - `better-sqlite3`
- [ ] `tsconfig.json` with strict mode
- [ ] `bun test` runs (even with no tests)
- [ ] `bun run typecheck` passes

**Commands:**
```bash
cd repos/cpg-inference-ts
bun install
bun run typecheck
```

---

## Phase 1: Core Types and Graph Engine (Week 1)

### CPG-1: Core Type Definitions
**Depends On:** PREREQ-1
**Estimate:** 3 hours

**Description:**
Translate Python type hints to TypeScript interfaces.

**Acceptance Criteria:**
- [ ] `src/types.ts` created with core interfaces:
  - `GraphNode`, `GraphEdge`, `CodePropertyGraph`
  - `TreeSitterNode`, `LanguageConfig`
  - `QueryResult`, `TraversalPath`
- [ ] All types exported from index
- [ ] Zero TypeScript errors

**Reference:**
- Source: `repos/cpg-inference/cpg/types.py`

---

### CPG-2: Tree-Sitter Parser
**Depends On:** CPG-1
**Estimate:** 4 hours

**Description:**
Implement source file parsing with tree-sitter.

**Acceptance Criteria:**
- [ ] `src/parser.ts` implements parsing
- [ ] Supports TypeScript, JavaScript, Python
- [ ] Returns normalized AST
- [ ] Test: Parse sample files successfully

**Commands:**
```bash
bun test src/parser.test.ts
```

---

### CPG-3: Graph Builder
**Depends On:** CPG-2
**Estimate:** 6 hours

**Description:**
Build CPG from tree-sitter AST.

**Acceptance Criteria:**
- [ ] `src/graph-builder.ts` converts AST → CPG
- [ ] Creates nodes for: functions, classes, variables, imports
- [ ] Creates edges for: calls, contains, references
- [ ] Test: Build graph from sample codebase

---

### CPG-4: Query Engine
**Depends On:** CPG-3
**Estimate:** 5 hours

**Description:**
Implement graph traversal and query operations.

**Acceptance Criteria:**
- [ ] `src/query-engine.ts` implements queries
- [ ] Support: findByName, findCallers, findCallees
- [ ] Support: DFS, BFS traversal
- [ ] Test: Query operations return correct results

---

### CPG-5: Graph Caching
**Depends On:** CPG-3
**Estimate:** 3 hours

**Description:**
Cache CPGs in SQLite for performance.

**Acceptance Criteria:**
- [ ] `src/cache.ts` implements caching
- [ ] Store graphs keyed by file hash
- [ ] Invalidate on file changes
- [ ] Test: Cache hit/miss works correctly

---

## Phase 2: Embedding Service (Week 2)

### CPG-6: ONNX Model Loader
**Depends On:** CPG-1
**Estimate:** 4 hours

**Description:**
Load and execute ONNX embedding model.

**Acceptance Criteria:**
- [ ] `src/embedding-model.ts` loads ONNX model
- [ ] Model file bundled or downloaded
- [ ] Generates 768-dim embeddings
- [ ] Test: Embedding generation works

**Reference:**
- Source: `repos/cpg-inference/embedding/model.py`

---

### CPG-7: FAISS Index
**Depends On:** CPG-6
**Estimate:** 4 hours

**Description:**
Build FAISS index for similarity search.

**Acceptance Criteria:**
- [ ] `src/faiss-index.ts` creates index
- [ ] Add/remove embeddings
- [ ] KNN search implemented
- [ ] Test: Search returns similar codes

---

### CPG-8: Batch Embedding
**Depends On:** CPG-6, CPG-7
**Estimate:** 3 hours

**Description:**
Generate embeddings for multiple code snippets efficiently.

**Acceptance Criteria:**
- [ ] `src/batch-embed.ts` processes batches
- [ ] Configurable batch size
- [ ] Progress tracking
- [ ] Test: Batch 100+ snippets

---

## Phase 3: Co-Change Predictor (Week 2)

### CPG-9: Bayesian Model
**Depends On:** CPG-1
**Estimate:** 5 hours

**Description:**
Implement Bayesian co-change prediction.

**Acceptance Criteria:**
- [ ] `src/cochange-model.ts` implements model
- [ ] Learn patterns from git history
- [ ] Confidence scoring
- [ ] Test: Predictions match known patterns

**Reference:**
- Source: `repos/cpg-inference/cochange/predictor.py`

---

### CPG-10: Pattern Persistence
**Depends On:** CPG-9
**Estimate:** 3 hours

**Description:**
Store and load co-change patterns.

**Acceptance Criteria:**
- [ ] Patterns stored in SQLite
- [ ] Incremental updates
- [ ] Pattern decay over time
- [ ] Test: Load persisted patterns

---

## Phase 4: Integration and Testing (Week 2)

### CPG-11: Library API
**Depends On:** CPG-3, CPG-7, CPG-9
**Estimate:** 4 hours

**Description:**
Create unified library API.

**Acceptance Criteria:**
- [ ] `src/index.ts` exports main API
- [ ] Factory functions for components
- [ ] Documentation in README
- [ ] Examples in examples/

---

### CPG-12: Integration Tests
**Depends On:** CPG-11
**Estimate:** 4 hours

**Description:**
End-to-end tests with real codebases.

**Acceptance Criteria:**
- [ ] Test full pipeline: parse → build → query
- [ ] Test embedding search
- [ ] Test co-change prediction
- [ ] Test: Run on minibob codebase

---

### CPG-13: Performance Benchmarks
**Depends On:** CPG-11
**Estimate:** 3 hours

**Description:**
Benchmark against Python implementation.

**Acceptance Criteria:**
- [ ] `benchmarks/` directory created
- [ ] Measure: parse time, graph build time, query time
- [ ] Results: ≤ Python performance
- [ ] Document results in README

---

### CPG-14: Documentation
**Depends On:** CPG-11
**Estimate:** 2 hours

**Description:**
Complete API documentation.

**Acceptance Criteria:**
- [ ] README with usage examples
- [ ] API reference in docs/
- [ ] Migration guide from Python
- [ ] Performance characteristics documented

---

## Validation Commands

```bash
# Full test suite
bun test

# Type checking
bun run typecheck

# Integration test
bun run test:integration

# Benchmarks
bun run benchmarks

# Build check
bun run build && ls dist/
```

## References

- Original: `archive/analysis-api-extraction/tasks.md` (Phase 0-1)
- Source: `repos/cpg-inference/` (Python implementation)
- Design: [design.md](./design.md)
