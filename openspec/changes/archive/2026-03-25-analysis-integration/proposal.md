# Analysis System Integration Proposal

## Summary

Integrate the code analysis system (CPG, co-change prediction, problem detection) with the activity system (MiniBob, impulses, composition) to enable agents to use metabob-mcp tools with real data instead of mocks.

## Problem Statement

The analysis system has working components that are disconnected:

1. **cpg-inference-ts** - Works but never receives files to analyze
2. **metabob-analysis-api** - Has endpoints but returns mock data (16+ TODO comments)
3. **OnlineLearningService** - Implemented but never called
4. **metabob-mcp tools** - Well-structured but return generic responses

Agents using metabob-mcp get no real insights about their codebases.

## Proposed Solution

### Phase 1: Enable CPG Population (M1)

Add `/v2/analysis/index` endpoint and `index_codebase` MCP tool so agents can index their codebases into the CPG.

### Phase 2: Replace Mock Data (M2)

Wire analysis endpoints to query the real CPG and `analysis_*` tables instead of returning hardcoded mocks.

### Phase 3: Bridge Analysis to Activities (M3)

Add new impulse pointer types (`analysisResult`, `cochangeSuggestions`, `impactAnalysis`, `codebaseSearch`) so activities can load analysis context.

### Phase 4: Connect Learning Loop (M4)

Forward execution trace file modifications to the learning service to update co-change patterns.

### Phase 5: End-to-End Validation (M5)

Verify full cycle in dashboard: index → analyze → activity → feedback → improved analysis.

## Success Criteria

1. **M1**: Agent can call `index_codebase`, status endpoint returns 'ready'
2. **M2**: `get_priority_issues` returns actual components from indexed codebase
3. **M3**: Activity can load `analysisResult` impulse with real problem data
4. **M4**: Co-change patterns table updates after execution traces
5. **M5**: Dashboard shows analysis metrics, issues visible, patterns tracked

## Scope

### In Scope

- CPG indexing endpoint and MCP tool
- Replacing mock data in 5 analysis endpoints
- 4 new impulse pointer types
- Learning feedback integration
- Dashboard analysis view
- Black-box E2E tests at each milestone

### Out of Scope

- Persistent CPG storage (future P2)
- Cross-project pattern learning (future P3)
- Auto-detection of security vulnerabilities (requires rules engine)
- Real-time file watching (requires daemon)

## Risks

| Risk | Mitigation |
|------|------------|
| CPG memory usage at scale | Session-scoped, cleared on disconnect |
| Learning feedback slows execution | Async/non-blocking with fire-and-forget |
| Analysis API unavailable | Impulse resolution has graceful fallback |
| Breaking existing MCP integrations | All endpoints remain backward compatible |

## Timeline

| Milestone | Estimated Effort | Dependencies |
|-----------|-----------------|--------------|
| M1 | 2-3 days | None |
| M2 | 2-3 days | M1 |
| M3 | 2 days | M2 |
| M4 | 1-2 days | M2 |
| M5 | 2 days | M3, M4 |
| **Total** | **9-12 days** | |

## Artifacts

- [spec.md](./spec.md) - Full technical specification
- [design.md](./design.md) - Architecture and design decisions
- [tasks.md](./tasks.md) - Task breakdown with tests per milestone

## Approval

- [ ] Architecture review
- [ ] Security review (RBAC, input validation)
- [ ] Performance review (CPG memory, impulse latency)
