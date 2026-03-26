# metabob-mcp E2E Demo - Design

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI Agent / IDE                                  │
│                         (Claude Code, VS Code, etc.)                         │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ MCP Protocol (stdio)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             metabob-mcp                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ index_      │  │ get_        │  │ search_     │  │ analyze_    │         │
│  │ codebase    │  │ priority_   │  │ codebase    │  │ change_     │         │
│  │             │  │ issues      │  │             │  │ impact      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ suggest_    │  │ annotate_   │  │ mark_       │  │ generate_   │         │
│  │ related_    │  │ component   │  │ problem_    │  │ impl_       │         │
│  │ changes     │  │             │  │ complete    │  │ spec        │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                    │                                         │
│  [Rate Limiter] [Circuit Breaker] [Session Manager] [API Client]            │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTP/REST + JWT
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          metabob-analysis-api                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Routes: /v2/analysis/                                                │    │
│  │ index | priority | search | annotations | cochange | impact |       │    │
│  │ problems | specs | learning                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Management: /v2/                                                     │    │
│  │ auth | orgs | users | projects | subscriptions | api-keys            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  [CPGService]  [Auth Middleware]  [Rate Limit]  [Scope Resolution]          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
           ┌────────────┐   ┌────────────┐   ┌────────────┐
           │ SurrealDB  │   │   Redis    │   │ CPG        │
           │ (persist)  │   │  (cache)   │   │ (in-mem)   │
           └────────────┘   └────────────┘   └────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        metabob-cloud-dashboard                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │Overview │  │Projects │  │ Issues  │  │Analysis │  │API Keys │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                    │                                         │
│  [useMetrics] [useAuth] [ConnectionStatus] [API Client]                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Status

### metabob-mcp (95% complete)
**8 MCP tools fully implemented:**
| Tool | Status | API Endpoint |
|------|--------|--------------|
| `index_codebase` | ✅ Complete | POST /v2/analysis/index |
| `get_priority_issues` | ✅ Complete | GET /v2/analysis/priority |
| `search_codebase` | ✅ Complete | POST /v2/analysis/search |
| `analyze_change_impact` | ✅ Complete | POST /v2/analysis/impact |
| `suggest_related_changes` | ✅ Complete | POST /v2/analysis/cochange/suggest |
| `annotate_component` | ✅ Complete | POST /v2/analysis/annotations |
| `mark_problem_complete` | ✅ Complete | PATCH /v2/analysis/problems/:id |
| `generate_implementation_spec` | ✅ Complete | POST /v2/analysis/specs |

**Infrastructure:**
- Rate limiter: 60 req/min per session
- Circuit breaker: Opens after 5 failures, 60s reset
- Session manager: Usage tracking, 1hr timeout
- Health server: HTTP health checks on port 8080
- Authentication: API key → JWT exchange with auto-refresh

### metabob-analysis-api (100% complete)
**All routes implemented with Hono:**
- 9 analysis routes under /v2/analysis/*
- 6 management routes under /v2/*
- CPGService with CoChangePredictor integration
- SurrealDB client for persistence
- Redis client for caching
- Auth/scope/rate-limit middleware

### metabob-cloud-dashboard (70% complete)
**Pages implemented:**
- Overview with metrics grid ✅
- Projects list ✅
- Issues list ✅
- Analysis view ✅
- API Keys ✅

**Gaps:**
- useMetrics hook needs live API integration
- ActivityTimeline needs real data
- WebSocket for real-time updates not connected

## Data Flow

### 1. Indexing Flow (Agent → CPG)
```
Agent: index_codebase(files: {"src/auth.ts": "..."})
  └─► MCP validates request
      └─► POST /v2/analysis/index
          └─► CPGService.addFiles()
              └─► tree-sitter AST parsing
                  └─► Component extraction
                      └─► FAISS embedding index
                          └─► Session metadata updated
```

### 2. Analysis Flow (Agent → Insights)
```
Agent: get_priority_issues(limit: 10)
  └─► MCP rate limit check
      └─► GET /v2/analysis/priority
          └─► Query SurrealDB analysis_problems
              └─► Fallback: CPG complexity analysis
                  └─► Return prioritized issues
```

### 3. Learning Flow (Execution → Dashboard)
```
Agent executes activity
  └─► Activity completes
      └─► MiniBob stores execution trace
          └─► POST /v2/activities/execution-traces
              └─► Thompson Sampling update
                  └─► Dashboard polls metrics
                      └─► GET /v2/metrics/overview
```

## Database Schema (Key Tables)

### Multi-tenant Tables (org_id scoped)
```sql
-- Analysis data (per session/project)
analysis_problems     -- Detected code issues
component_annotations -- Developer notes
cochange_patterns     -- Historical co-change data
implementation_specs  -- Generated specs

-- Organization data
organizations         -- Tenant root
projects              -- Code repositories
api_keys              -- Developer credentials
users                 -- Team members

-- Activity data (from activity-api)
activity_template     -- Reusable templates
activity_execution    -- Execution traces
activity_metrics      -- Performance data
```

### Session-scoped (CPG in-memory)
```
CPG nodes            -- AST components
CPG edges            -- Relationships (CALLS, DEPENDS)
FAISS index          -- Embedding vectors
Session metadata     -- Files indexed, component count
```

## Authentication Flow

```
1. API Key Auth (for MCP/IDE integrations):
   Client ──[API Key]──► POST /v2/auth/apikey
                              │
                              ▼
                         Validate key (argon2 hash)
                         Lookup org_id, user_id, scopes
                         Generate JWT (15 min)
                              │
                              ▼
   Client ◄──[JWT Token]─────┘

   Response: { token, expires_at, expires_in, org_id, user_id, scopes, project_ids }

2. User Login (for dashboard):
   Browser ──[email/pass]──► POST /v2/auth/login
                                   │
                                   ▼
                              Verify credentials
                              Generate JWT (15 min)
                                   │
                                   ▼
   Browser ◄──[JWT Token]─────────┘

3. Auto-refresh (before expiry):
   MCP API Client ──► Background refresh (80% of TTL)
                          │
                          ▼
                     POST /v2/auth/refresh
                          │
                          ▼
   MCP API Client ◄── New JWT
```

## Test Strategy

### Black-box E2E Tests (Playwright MCP)
Each milestone verifies the full stack works by:
1. Calling MCP tools directly (not mocking)
2. Validating API responses
3. Checking dashboard reflects changes

### Test Data
- Sample TypeScript files for indexing
- Pre-created problems for priority queries
- Historical co-change patterns for suggestions

### Milestones

**M1: Health & Auth** - Services respond, authentication works
**M2: Indexing** - CPG builds from file content
**M3: Analysis** - Priority issues and search return results
**M4: Predictions** - Co-change and impact analysis work
**M5: Full Flow** - End-to-end agent workflow completes

## Configuration

### Helm Deployment
```yaml
# activity-system-minimal.yaml.gotmpl
releases:
  - redis (valkey)
  - surrealdb
  - metabob-analysis-api
  - metabob-mcp
  - metabob-cloud-dashboard
  - istio-gateway
```
