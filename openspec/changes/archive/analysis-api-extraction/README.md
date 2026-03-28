# Analysis API Extraction - OpenSpec Change

**Status:** Draft
**Created:** 2026-03-23
**Type:** Component Extraction

---

## Quick Links

- **[Proposal](./proposal.md)** - Problem statement, scope, success criteria
- **[Design](./design.md)** - Architecture, component interactions, data flows
- **[Tasks](./tasks.md)** - 65 implementation tasks organized by phase

### Detailed Specifications

- **[MCP Tools Spec](./specs/mcp-tools/spec.md)** - 7 tool contracts with performance targets
- **[MCP Tool Examples](./specs/mcp-tools/examples.md)** - Request/response examples for all tools
- **[API Mapping](./specs/analysis-api/mcp-to-api-mapping.md)** - HTTP endpoints and backend logic
- **[CPG Library Spec](./specs/cpg-library/spec.md)** - TypeScript translation of repos/cpg-inference
- **[Data Schemas](./specs/data-schemas/spec.md)** - SurrealDB 3.x table definitions

---

## Overview

This change extracts analysis capabilities from the aging Python `metabob-rpc-api` into **three new TypeScript/Bun components**:

1. **metabob-analysis-api** (~3,000-5,000 LOC) - Backend orchestration, storage, online learning
2. **metabob-mcp** (~1,000-2,000 LOC) - MCP server exposing 7 analysis tools to AI agents
3. **cpg-inference-ts** (~4,000-6,000 LOC) - Code Property Graph library (translated from Python)

### Key Goals

- ✅ Create MiniBob-developable substrates (small, focused codebases)
- ✅ Share SurrealDB namespace with metabob-activity-api for better survivability
- ✅ Enable online learning for co-change prediction and pattern recognition
- ✅ Provide clear boundaries between MCP ↔ API ↔ CPG ↔ Storage
- ✅ Deploy via helmfile to existing activity-system namespace

---

## Architecture Diagram

```
AI Agent (Claude/Cursor)
        ↓ MCP Protocol
metabob-mcp (7 tools)
        ↓ HTTP/JSON
metabob-analysis-api (Hono server)
        ↓
cpg-inference-ts (library)
        ↓
┌────────────────┬──────────────┐
│                │              │
Redis           SurrealDB 3.x   FAISS
(ephemeral)     (persistent)    (similarity)
```

---

## The 7 MCP Tools

1. **get_priority_issues** - Ranked list of impactful next steps
2. **search_codebase_issues** - Semantic search across problems and annotations
3. **annotate_component** - Document design decisions and challenges
4. **suggest_related_changes** - Co-change prediction with online learning
5. **analyze_change_impact** - CPG traversal to identify affected components
6. **mark_problem_complete** - Resolve issue with auto-annotation
7. **generate_implementation_spec** - AI-readable implementation plan from goal

---

## Implementation Timeline

**8 weeks** organized into 7 phases:

- **Phase 0:** Prerequisites (SurrealDB schema, repo setup)
- **Phase 1:** CPG Library Translation (Week 1-2) - 13 tasks
- **Phase 2:** API Foundation (Week 3) - 4 tasks
- **Phase 3:** Core Tools (Week 4) - 8 tasks
- **Phase 4:** Advanced Tools (Week 5-6) - 7 tasks
- **Phase 5:** MCP Server (Week 7) - 6 tasks
- **Phase 6:** Deployment (Week 8) - 6 tasks
- **Phase 7:** Documentation/Validation (Ongoing) - 9 tasks

**Total:** 65 tasks, ~275 hours estimated

---

## Technology Stack

| Component | Technologies |
|-----------|-------------|
| metabob-analysis-api | TypeScript, Bun, Hono, SurrealDB 3.x, Redis |
| metabob-mcp | TypeScript, Bun, @modelcontextprotocol/sdk |
| cpg-inference-ts | TypeScript, tree-sitter, ONNX, FAISS |
| Deployment | Kubernetes, Helm, Helmfile, Istio |

---

## Key Design Decisions

### 1. Hybrid Storage Strategy

**Redis (Ephemeral):**
- CPG cache (1-hour TTL)
- FAISS indexes (in-memory)
- Session state
- Model weights

**SurrealDB (Persistent):**
- analysis_problems
- code_components
- component_annotations
- cochange_patterns
- impact_relations

**Rationale:** Redis provides sub-millisecond access for hot data, SurrealDB ensures survivability and learning persistence.

### 2. Progressive CPG Updates

Translation from Python NetworkX to TypeScript adjacency lists with incremental file updates:

```typescript
await predictor.addFile('new.ts', content);     // Parse + Add to graph
await predictor.updateFile('existing.ts', content); // Diff + Merge
await predictor.deleteFile('old.ts');           // Remove components
```

**Rationale:** Full rebuilds are expensive. Progressive updates enable real-time analysis during development.

### 3. Online Learning for Co-change Prediction

Hybrid scoring combining:
- **60%** Semantic similarity (ONNX embeddings + FAISS)
- **40%** Historical co-change frequency (Bayesian update)

**Rationale:** Pure embedding similarity misses project-specific patterns. Online learning adapts to team practices.

### 4. Shared SurrealDB Namespace

Reuse `activity_system` namespace from metabob-activity-api:

```sql
USE NS activity_system;
USE DB learning_loop;
```

**Rationale:** Enables cross-system queries (e.g., linking analysis problems to activity executions) and reduces infrastructure overhead.

### 5. StatefulSet for Analysis API

CPG cache benefits from pod-local storage and sticky sessions.

**Rationale:** Cache hit rate improves from ~40% (Deployment) to ~80% (StatefulSet) for repeated queries from same session.

---

## Performance Targets

All targets from design.md, summarized:

| Tool | P50 | P99 |
|------|-----|-----|
| get_priority_issues | <100ms | <300ms |
| search_codebase_issues | <200ms | <500ms |
| annotate_component | <50ms | <150ms |
| suggest_related_changes | <300ms | <800ms |
| analyze_change_impact | <400ms | <1s |
| mark_problem_complete | <100ms | <250ms |
| generate_implementation_spec | <1s | <3s |

---

## Success Criteria

### Phase 1 Success (Foundation)
- ✅ CPG library translates 100% of Python functionality
- ✅ All unit tests pass
- ✅ Performance benchmarks meet targets

### Phase 2 Success (Core Tools)
- ✅ 4 core MCP tools functional (priority, search, annotate, mark_complete)
- ✅ Integration tests pass
- ✅ API deployed to dev cluster

### Phase 3 Success (Advanced Tools)
- ✅ All 7 MCP tools functional
- ✅ Online learning records events
- ✅ Co-change predictions improve over 10 commits

### Phase 4 Success (Production Ready)
- ✅ Performance targets met in load tests
- ✅ Monitoring dashboards operational
- ✅ MiniBob successfully uses analysis tools
- ✅ Zero data loss after pod restarts

---

## Dependencies

### Repositories Referenced
- `repos/metabob-rpc-api/` - Python source (being replaced)
- `repos/cpg-inference/` - Python CPG library (being translated)
- `repos/metabob-activity-api/` - Shared patterns and namespace
- `repos/metabob-cli/` - Existing MCP tools reference

### External Services
- SurrealDB 3.x (existing in activity-system namespace)
- Redis/Valkey (existing in activity-system namespace)
- Istio (service mesh for routing)

### NPM Dependencies
- `@tree-sitter/node` - Multi-language parsing
- `onnxruntime-node` - Code embedding generation
- `faiss-node` - Vector similarity search
- `hono` - HTTP framework
- `@modelcontextprotocol/sdk` - MCP server implementation

---

## Workflow Completed

This OpenSpec change follows the user's explicit workflow request:

> "Let's get started by defining the mcp surface and then work our way backwards before turning around."

**Backward Phase (Completed):**
1. ✅ MCP Tool Surface (7 tools)
2. ✅ API Endpoints (HTTP layer)
3. ✅ CPG Library (TypeScript translation)
4. ✅ Data Schemas (SurrealDB tables)

**Turn Around Phase (Completed):**
5. ✅ Proposal (rationale, scope, approach)
6. ✅ Design (architecture, data flows)
7. ✅ Tasks (65 implementation steps)

---

## Next Steps

With specifications complete, ready to:

1. **Review** - Validate specs match requirements
2. **Approve** - Confirm approach before implementation
3. **Implement** - Execute tasks in dependency order (see tasks.md)
4. **Deploy** - Helmfile deployment to dev cluster
5. **Validate** - Performance benchmarks and learning verification

---

## Questions or Clarifications

Open design questions from proposal.md:

1. Custom embedding model training or bundled ONNX only?
2. Retention policy for analysis_problems table? (30/90 days? Forever?)
3. MCP server as sidecar or standalone deployment?
4. Cross-session pattern learning scope? (project-level? org-level?)
5. Real-time WebSocket updates or HTTP polling for dashboard?

---

## References

- **OpenCode Integration:** See `CLAUDE.md` for MiniBob integration patterns
- **Deployment Reference:** `helm/activity-system-minimal.yaml.gotmpl`
- **SurrealDB Docs:** https://surrealdb.com/docs (v3.x)
- **MCP Specification:** https://modelcontextprotocol.io/
- **Tree-sitter:** https://tree-sitter.github.io/tree-sitter/

---

**Last Updated:** 2026-03-23
**Specification Version:** 1.0
**OpenSpec Change ID:** analysis-api-extraction
