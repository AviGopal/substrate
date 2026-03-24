# metabob-mcp - OpenSpec Proposal

**Status:** Draft
**Created:** 2026-03-23
**Author:** System (via Claude Code)
**Type:** MCP Server
**Repo:** `repos/metabob-mcp`

---

## Problem Statement

AI agents (Claude, Cursor, etc.) need access to Metabob analysis capabilities through MCP protocol:

1. **No MCP Interface:** Current Python RPC API doesn't speak MCP
2. **Tool Discovery:** Agents can't discover available analysis tools
3. **Session Management:** No context tracking for multi-turn analysis
4. **Error Handling:** Need graceful degradation and rate limiting
5. **Type Safety:** MCP tool schemas need validation

## Proposed Solution

Build lightweight MCP server that exposes 7 analysis tools to AI agents.

**Scope:** ~1,000-2,000 LOC
**Stack:** TypeScript + Bun + @modelcontextprotocol/sdk

### MCP Tools

**1. get_priority_issues** - Fetch high-priority problems for current codebase
**2. search_codebase_issues** - Semantic search through detected issues
**3. annotate_component** - Add human annotations to code components
**4. suggest_related_changes** - Co-change prediction for current change
**5. analyze_change_impact** - Graph-based impact analysis
**6. mark_problem_complete** - Mark issues as resolved
**7. generate_implementation_spec** - Create implementation specs from analysis

### Architecture

```
AI Agent (Claude/Cursor)
         ↓ MCP Protocol
   metabob-mcp (this server)
         ↓ HTTP/JSON
   metabob-analysis-api
         ↓
   cpg-inference-ts
```

### Core Responsibilities

**1. MCP Protocol Implementation**
- Tool registration and discovery
- Request validation and parsing
- Response formatting
- Error handling

**2. Session Management**
- Track analysis context across tool calls
- Maintain codebase state
- Cache recent results
- Clean up expired sessions

**3. API Translation**
- Transform MCP tool calls → API requests
- Map API responses → MCP tool results
- Handle authentication and authorization
- Rate limiting and quota management

## Dependencies

**Blocked By:**
- `metabob-analysis-api` (MUST complete first)

**Blocks:**
- None (leaf node in dependency graph)

**External Dependencies:**
- `@modelcontextprotocol/sdk` (MCP server framework)
- `hono` (HTTP client for API calls)
- `zod` (schema validation)

## Success Criteria

1. **Tool Discovery:** All 7 tools visible in MCP client
2. **Functionality:** Each tool executes and returns valid results
3. **Error Handling:** Graceful failures with helpful error messages
4. **Performance:** Tool execution latency < API latency + 50ms
5. **Integration:** Works with Claude Desktop, Cursor, etc.

## Non-Goals

- Not implementing analysis logic (that's `metabob-analysis-api`)
- Not building custom MCP protocol extensions
- Not supporting non-standard MCP clients

## Timeline

**Week 5:** Complete MCP server (10 tasks)
- Days 1-2: MCP server setup + tool registration
- Days 3-4: Implement 7 tool handlers
- Day 5: Testing and integration

## References

- Original: `archive/analysis-api-extraction/` (Phase 5)
- MCP Spec: https://modelcontextprotocol.io/
- Tasks: [tasks.md](./tasks.md)
- Design: [design.md](./design.md)
