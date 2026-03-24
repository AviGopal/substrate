# Analysis API Extraction - OpenSpec Proposal

**Status:** Draft
**Created:** 2026-03-23
**Author:** System (via Claude Code)
**Type:** Component Extraction

---

## Problem Statement

The current analysis system (`repos/metabob-rpc-api`) presents several challenges:

1. **Complexity:** Mixed Python/Celery architecture with parallel job orchestration
2. **Maintainability:** Aging codebase (~4 years old) with tight coupling
3. **Observability:** Difficult to instrument and monitor with MiniBob
4. **Scalability:** Redis-only storage lacks survivability and learning persistence
5. **Integration:** Hard to extend with new MCP tools and online learning

## Domain Context

This change operates in the **Analysis & Understanding** domain:

**Vessel (Instructional State):**
- Analysis activity templates (`build-cpg.json`, `find-problems.json`, `analyze-impact.json`)
- MCP tool specifications (the 7 tools defined in this proposal)
- CPG query patterns (structural graph queries)

**Becoming (Process-of-Becoming):**
- CPG construction from source files (parsing → graph building)
- LLM reasoning over CPG data (semantic analysis)
- Online learning from analysis results (pattern recognition)
- Co-change model training (Bayesian updates)

**Instance (Functional State):**
- Issues found and stored in `analysis_problems` table
- Annotations created in `component_annotations` table
- Co-change predictions made (specific file suggestions)
- CPG graphs cached (session-specific state)

**What's Learned:**
- Which analysis methods reduce false positives
- Which co-change patterns are reliable
- Which components are frequently problematic
- What annotation styles improve future analysis

This learning loop feeds back into template selection (Thompson Sampling) and improves both the analysis quality and efficiency over time.

**Reference:** See [openspec/meta/domain-mappings.md#analysis-understanding](../../meta/domain-mappings.md#analysis-understanding) for full domain taxonomy.

---

## Proposed Solution

Extract analysis capabilities into **two new TypeScript/Bun components** following the same pattern used for `metabob-activity-api`:

### Component 1: metabob-analysis-api
**Purpose:** Backend orchestration, storage, and online learning
**Size:** ~3,000-5,000 LOC (MiniBob-developable substrate)
**Stack:** TypeScript + Bun + Hono + SurrealDB 3.x

**Responsibilities:**
- Store analysis results, CPG data, and annotations persistently
- Provide HTTP API endpoints for MCP server
- Manage online learning (co-change models, pattern recognition)
- Coordinate CPG operations via cpg-inference-ts library
- Handle org → project → session hierarchy

### Component 2: metabob-mcp
**Purpose:** MCP server exposing analysis tools to AI agents
**Size:** ~1,000-2,000 LOC
**Stack:** TypeScript + Bun + MCP SDK

**Responsibilities:**
- Expose 7 analysis tools to Claude/Cursor/etc.
- Manage session context and authentication
- Transform tool calls into API requests
- Handle errors and rate limiting

### Supporting Component: cpg-inference-ts
**Purpose:** Code Property Graph library (translated from Python)
**Size:** ~4,000-6,000 LOC
**Stack:** TypeScript + tree-sitter + ONNX

**Note:** Translation of existing `repos/cpg-inference`, not greenfield development.

## Integration with MiniBob Library

**Key Insight:** metabob-analysis-api will **use the @metabob/minibob library**, making analysis operations into measured, learnable activities.

**Architecture:**
```typescript
// metabob-analysis-api uses MiniBob library
import { ActivityExecutor } from '@metabob/minibob';

class AnalysisService {
  private executor: ActivityExecutor;

  async buildCPG(sessionId: string, files: string[]): Promise<CPGResult> {
    // Execute build-cpg.json activity (measured, traced, learned from)
    return this.executor.execute({
      templateId: 'build-cpg',
      variables: { sessionId, files },
      impulses: [
        { type: 'file', paths: files, budget: 50000 },
        { type: 'activityMetrics', templateId: 'build-cpg' }
      ]
    });
  }
}
```

**Benefits:**
1. **Thompson Sampling:** Learn which CPG strategies work best
2. **Trace Capture:** Every analysis operation recorded with state
3. **Composition Tracking:** Which tools used together successfully
4. **Ribosome Pattern:** Successful improvised analysis → new templates

**Implementation Details:** See [design.md](./design.md#minibob-library-integration) for complete architecture.

**Reference:** See root [CLAUDE.md](../../CLAUDE.md#minibob-library-integration-pattern) for pattern documentation.

---

## Improvisation Strategy

Analysis doesn't always follow templates. When novel analysis is needed:

**Pure Improvisation:**
- LLM figures out which CPG queries to run step-by-step
- No predefined template for "find SQL injection vulnerabilities in Next.js"
- Agent explores CPG structure, tests queries, refines approach

**Trace → Template:**
- Successful improvisation captured as execution trace
- Ribosome extracts trace into reusable template
- Next similar request uses proven approach

**Goal-Seeking:**
- User provides goal: "Find security issues in auth flow"
- Backend recommends approach based on similar past analyses
- May combine templates: `build-cpg` → `find-problems` → `analyze-impact`

**Search-First:**
- Before rebuilding CPG, check if cached version is fresh
- Before running analysis, check if similar analysis exists
- Optimize for common case (reuse) while supporting novel cases (improvise)

**Reference:** See [openspec/meta/improvisation-spectrum.md](../../meta/improvisation-spectrum.md) for full framework.

---

## Key Design Principles

1. **Clear Boundaries:** Defined contracts between MCP ↔ API ↔ CPG ↔ Storage
2. **MiniBob-Ready:** Small codebases suitable for autonomous development
3. **Shared Infrastructure:** Reuse SurrealDB namespace from metabob-activity-api
4. **Progressive Enhancement:** Start with core features, add online learning iteratively
5. **Hybrid Storage:** Redis (ephemeral caching) + SurrealDB (persistent learning)
6. **Measured Behavior:** Track all operations for continuous improvement
7. **Activity-Based:** Analysis operations are activities (executable, measurable, improvable)

## Scope

### In Scope
- 7 MCP tools: priority issues, search, annotate, co-change prediction, impact analysis, mark complete, generate spec
- CPG building and querying (tree-sitter + graph traversal)
- Embedding generation and similarity search (ONNX + FAISS)
- Component annotation system
- Co-change pattern learning
- SurrealDB schema design
- Helmfile deployment configuration
- Integration tests

### Out of Scope (Phase 1)
- Static analysis engines (defer to future specialized components)
- Bug detection heuristics (use existing metabob-cli patterns as reference)
- MiniBob self-instrumentation (wait for MiniBob maturity)
- Multi-tenant access control (rely on session isolation initially)
- Real-time WebSocket updates (polling sufficient for v1)

### Explicitly Deferred
- Migration of existing analysis jobs from Redis
- Performance optimization beyond baseline targets
- Advanced RBAC and permissions
- Custom embedding model training

## Success Criteria

1. **Functional Parity:** All 7 MCP tools operational with example requests/responses
2. **Performance:** Meet P50/P99 latency targets from spec (100ms-3s depending on tool)
3. **Deployment:** Successfully deploy to Kubernetes via helmfile
4. **Integration:** MiniBob can execute analysis activities using new MCP tools
5. **Persistence:** Analysis data survives pod restarts (SurrealDB validation)
6. **Learning:** Co-change patterns improve over 10+ commits

## Non-Goals

- Not replacing metabob-cli (CLI remains separate)
- Not migrating existing Redis data (fresh start acceptable)
- Not achieving 100% feature parity with Python RPC API (focus on core workflows)
- Not optimizing for <10ms latencies (current targets are acceptable)

## Dependencies

### Required Components
- `repos/cpg-inference` - Source for TypeScript translation
- `repos/metabob-activity-api` - Shared SurrealDB namespace and patterns
- SurrealDB 3.x cluster (existing in activity-system namespace)
- Redis/Valkey cluster (existing)

### External Dependencies
- @tree-sitter/node (TypeScript bindings)
- onnxruntime-node (ONNX model execution)
- faiss-node (vector similarity search)
- hono (HTTP framework)
- @modelcontextprotocol/sdk (MCP server)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tree-sitter performance worse than Python | Medium | Benchmark early, optimize hot paths |
| ONNX model compatibility issues | High | Verify model format before translation starts |
| SurrealDB schema evolution challenges | Medium | Use SCHEMAFULL + migration scripts |
| FAISS bindings unstable in Node.js | High | Test with production-scale indexes early |
| CPG translation introduces bugs | High | Comprehensive test suite with known codebases |
| Online learning diverges from expectations | Low | Track metrics, allow model rollback |

## Timeline Estimate

**Phase 1: Foundation (Weeks 1-2)**
- CPG library translation and testing
- SurrealDB schema creation
- Basic API endpoints (health, sessions)

**Phase 2: Core Tools (Weeks 3-4)**
- Implement get_priority_issues, search_codebase_issues
- Implement annotate_component, mark_problem_complete
- Integration tests

**Phase 3: Advanced Tools (Weeks 5-6)**
- Implement suggest_related_changes (co-change prediction)
- Implement analyze_change_impact (CPG traversal)
- Implement generate_implementation_spec

**Phase 4: MCP Server (Week 7)**
- MCP tool surface implementation
- Error handling and rate limiting
- End-to-end MCP → API → CPG flow

**Phase 5: Deployment (Week 8)**
- Helmfile configuration
- Kubernetes deployment validation
- Integration with existing activity-system namespace

**Phase 6: Learning (Ongoing)**
- Online learning implementation
- Thompson Sampling for tool variants
- Continuous improvement based on usage data

## Open Questions

1. Should we implement custom embedding model training or use bundled ONNX model only?
2. What retention policy for analysis_problems table? (30 days? 90 days? Forever?)
3. Should MCP server run as sidecar or standalone deployment?
4. How to handle cross-session pattern learning? (project-level? org-level?)
5. Do we need real-time WebSocket updates for dashboard integration?

## Alternatives Considered

### Alternative 1: Keep Python RPC API, Add TypeScript Wrapper
**Rejected:** Doesn't reduce complexity, adds another layer

### Alternative 2: Monolithic TypeScript Rewrite
**Rejected:** Too large for MiniBob to self-develop, violates separation of concerns

### Alternative 3: Microservices (separate CPG, embeddings, storage)
**Rejected:** Over-engineered for current scale, adds operational complexity

### Alternative 4: Use External Analysis Service (e.g., CodeQL)
**Rejected:** Loses control over learning loop, embedding customization

## References

- OpenSpec changes: `openspec/changes/analysis-api-extraction/specs/`
- Existing Python RPC: `repos/metabob-rpc-api/`
- CPG source: `repos/cpg-inference/`
- Activity API pattern: `repos/metabob-activity-api/`
- Deployment reference: `helm/activity-system-minimal.yaml.gotmpl`
