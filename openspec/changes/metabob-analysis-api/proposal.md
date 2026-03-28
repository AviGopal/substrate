# metabob-analysis-api - OpenSpec Proposal

**Status:** Draft
**Created:** 2026-03-23
**Author:** System (via Claude Code)
**Type:** Backend Service
**Repo:** `repos/metabob-analysis-api`

---

## Problem Statement

Need a TypeScript/Bun backend to replace `repos/metabob-rpc-api` (Python/Celery) with:

1. **Better Observability:** Instrumented for MiniBob learning loops
2. **Persistent Learning:** SurrealDB storage for patterns and metrics
3. **MiniBob Integration:** Uses `@metabob/minibob` library for activities
4. **Modern Stack:** Bun + Hono for performance and maintainability
5. **MCP Ready:** HTTP API designed for MCP server consumption

## Proposed Solution

Build TypeScript/Bun backend that orchestrates analysis operations as **measured activities**.

**Scope:** ~3,000-5,000 LOC
**Stack:** TypeScript + Bun + Hono + SurrealDB 3.x + cpg-inference-ts

### Core Responsibilities

**1. Analysis Orchestration**
- Execute analysis activities using `@metabob/minibob` library
- Coordinate CPG operations via `cpg-inference-ts`
- Manage session lifecycle and context
- Handle org → project → session hierarchy

**2. Persistent Storage**
- Store analysis results in SurrealDB
- Track problem annotations and completions
- Persist co-change patterns and predictions
- Maintain impact relationship graphs

**3. HTTP API Endpoints**
- `/analysis/priority-issues` - Get prioritized problems
- `/analysis/search` - Search codebase issues
- `/analysis/annotate` - Add component annotations
- `/analysis/cochange` - Predict related changes
- `/analysis/impact` - Analyze change impact
- `/analysis/complete` - Mark problems resolved

**4. Online Learning**
- Thompson Sampling for analysis strategy selection
- Pattern recognition from successful analyses
- Ribosome pattern: ad-hoc analysis → templates
- Co-change model updates from git history

## Dependencies

**Blocked By:**
- `cpg-inference-ts` (MUST complete first)

**Blocks:**
- `metabob-mcp` (needs API endpoints)
- `metabob-cloud-dashboard` (needs analysis data)

**External Dependencies:**
- `@metabob/minibob` (activity execution)
- `cpg-inference-ts` (graph operations)
- `hono` (HTTP framework)
- `@surrealdb/driver` (database client)

## Success Criteria

1. **Functional:** All 6 analysis endpoints operational
2. **Performance:** P50 latency < 500ms, P99 < 3s
3. **Integration:** MiniBob can execute analysis activities
4. **Persistence:** Analysis data survives pod restarts
5. **Learning:** Thompson Sampling improves success rates over time

## Non-Goals

- Not implementing MCP server (that's `metabob-mcp`)
- Not building UI (that's `metabob-cloud-dashboard`)
- Not 100% feature parity with Python RPC API (core workflows only)

## Timeline

**Week 3-4:** Complete backend implementation (25 tasks)
- Week 3: Foundation + storage schema
- Week 4: Analysis endpoints + learning

## References

- Original: `archive/analysis-api-extraction/` (monolithic change)
- Tasks: [tasks.md](./tasks.md)
- Design: [design.md](./design.md)
