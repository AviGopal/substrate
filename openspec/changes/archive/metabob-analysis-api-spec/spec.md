# metabob-analysis-api Specification

## Executive Summary

**metabob-analysis-api** is the backend service that provides code analysis, pattern learning, and data persistence for the metabob ecosystem. It serves as the stateful brain behind metabob-mcp, handling:

1. **Code Property Graph (CPG) Management** - In-memory session-scoped code analysis
2. **Learning System** - Co-change pattern recognition with Bayesian confidence updates
3. **Data Persistence** - SurrealDB storage with RBAC isolation
4. **Authentication** - JWT token issuance and API key validation

Unlike metabob-mcp (which is a stateless protocol bridge), metabob-analysis-api owns the data and learning algorithms.

---

## Why It Exists

### The Problem

AI-assisted development tools need:
- **Persistent knowledge** about codebases across sessions
- **Learning from usage** to improve recommendations
- **Multi-tenant isolation** for enterprise deployment
- **Semantic understanding** beyond text search

### The Solution

metabob-analysis-api provides:

| Capability | Implementation | Consumer |
|-----------|----------------|----------|
| Code graph analysis | `cpg-inference-ts` + tree-sitter | metabob-mcp tools |
| Co-change prediction | Bayesian learning from git history | `suggest_related_changes` |
| Impact analysis | Graph traversal with depth control | `analyze_change_impact` |
| Problem tracking | SurrealDB with status workflow | `get_priority_issues` |
| Semantic search | (Mock) Embedding similarity | `search_codebase` |
| Authentication | JWT + API keys + RBAC | All API consumers |

---

## Responsibilities vs metabob-mcp

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RESPONSIBILITY BOUNDARY                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  metabob-mcp (Vessel)              metabob-analysis-api (Backend)   │
│  ─────────────────────             ──────────────────────────────   │
│  Protocol translation              Data persistence                 │
│  Tool registration                 Authentication/RBAC              │
│  Rate limiting (client)            Rate limiting (server)           │
│  Circuit breaker                   Business logic                   │
│  Session tracking (transient)      Learning algorithms              │
│  HTTP client with retry            CPG management                   │
│  Zod validation (tools)            Zod validation (routes)          │
│  Response formatting               Query execution                  │
│                                                                     │
│  DOES NOT:                         DOES NOT:                        │
│  - Store data                      - Understand MCP protocol        │
│  - Own learning                    - Format for AI consumption      │
│  - Manage auth tokens              - Know about tool structure      │
│  - Execute CPG analysis            - Track client sessions          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Interface Contract

metabob-mcp calls metabob-analysis-api via these endpoints:

| MCP Tool | API Endpoint | Method | Purpose |
|----------|--------------|--------|---------|
| (auth) | `/v2/auth/apikey` | POST | Exchange API key for JWT |
| `get_priority_issues` | `/v2/analysis/priority` | GET | Fetch high-severity problems |
| `search_codebase` | `/v2/analysis/search` | POST | Semantic code search |
| `annotate_component` | `/v2/analysis/annotations` | POST | Create annotation |
| `suggest_related_changes` | `/v2/analysis/cochange/suggest` | POST | Co-change prediction |
| `analyze_change_impact` | `/v2/analysis/impact` | POST | Dependency graph traversal |
| `mark_problem_complete` | `/v2/analysis/problems/:id/complete` | PUT | Resolve problem |
| `generate_implementation_spec` | `/v2/analysis/specs/generate` | POST | Goal → implementation plan |

All requests include:
- `Authorization: Bearer {jwt}` - RBAC enforcement
- `X-Session-ID: {sessionId}` - CPG session scoping

---

## Architecture

### Service Layer

```
src/
├── index.ts                 # Hono server, middleware setup
├── routes/
│   ├── auth.ts              # Authentication (5 endpoints)
│   ├── orgs.ts              # Organization management (4 endpoints)
│   ├── users.ts             # User management (3 endpoints)
│   ├── projects.ts          # Project management (4 endpoints)
│   ├── subscriptions.ts     # Billing (3 endpoints)
│   ├── api-keys.ts          # API key management (4 endpoints)
│   ├── indexing.ts          # CPG indexing (3 endpoints)
│   ├── priority.ts          # Priority issues (1 endpoint)
│   ├── search.ts            # Semantic search (1 endpoint)
│   ├── annotations.ts       # Annotations (1 endpoint) [STUB]
│   ├── cochange.ts          # Co-change suggestions (1 endpoint)
│   ├── impact.ts            # Impact analysis (1 endpoint)
│   ├── problems.ts          # Problem management (4 endpoints)
│   ├── specs.ts             # Spec generation (1 endpoint)
│   └── learning.ts          # Learning endpoints (5 endpoints)
├── services/
│   ├── cpg-service.ts       # CPG wrapper (in-memory, session-scoped)
│   ├── learning-service.ts  # Bayesian pattern learning
│   ├── embedding-service.ts # Embedding generation [MOCK]
│   └── pattern-service.ts   # Design pattern detection
├── middleware/
│   ├── auth.ts              # JWT validation
│   ├── scope.ts             # Org/project context extraction
│   ├── rate-limit.ts        # Server-side rate limiting
│   └── error-handler.ts     # Global error handling
└── models/
    ├── schemas.ts           # Zod validation schemas
    └── types.ts             # TypeScript interfaces
```

### Data Flow

```
                          ┌──────────────────┐
                          │   metabob-mcp    │
                          │  (MCP Protocol)  │
                          └────────┬─────────┘
                                   │ HTTP + JWT
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                     metabob-analysis-api                         │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Routes    │───▶│  Services   │───▶│    CPG / Learning   │  │
│  │ (Hono HTTP) │    │ (Business)  │    │    (Algorithms)     │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│         │                  │                     │               │
│         ▼                  ▼                     ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  SurrealDB  │    │    Redis    │    │   cpg-inference-ts  │  │
│  │ (Persisted) │    │  (Cache)    │    │   (In-Memory CPG)   │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Ownership

metabob-analysis-api owns these tables (defined in `sql/schemas/`):

### Analysis Tables (020-022)

| Table | Purpose | Populated | Write Paths |
|-------|---------|-----------|-------------|
| `analysis_problems` | Code issues | Via import/detection | `problems.ts:375` UPDATE |
| `code_components` | CPG component metadata | Not populated | None (schema exists) |
| `cochange_patterns` | File correlation patterns | Learning service | `learning-service.ts:132` |
| `impact_relations` | Dependency edges | Not populated | None (schema exists) |
| `design_patterns` | Detected patterns | Not populated | None (schema exists) |
| `annotations` | Developer notes | **STUB** | None (TODO at line 64) |
| `progressive_sync_state` | File sync tracking | Not populated | None (schema exists) |

### Management Tables (shared schemas)

| Table | Purpose | Owner |
|-------|---------|-------|
| `organizations` | Multi-tenancy root | Core schemas |
| `projects` | Project scoping | Core schemas |
| `users` | User accounts | Auth schemas |
| `api_keys` | API authentication | Auth schemas |
| `subscriptions` | Billing | Core schemas |

---

## Current State Analysis

### What Works (Real Value)

| Component | Evidence | Notes |
|-----------|----------|-------|
| Authentication | `auth.ts` creates JWT with claims | 15-min expiry, auto-refresh at 80% |
| API Key Auth | `api-keys.ts` validates and exchanges | Used by metabob-mcp |
| Problem Status Update | `problems.ts:375-389` | Marks resolved, creates annotation |
| Co-change Pattern Learning | `learning-service.ts:64-149` | Bayesian confidence updates |
| Pattern Retrieval | `learning.ts:125-146` | SELECT from cochange_patterns |
| Feedback Recording | `learning-service.ts:270-289` | Stores prediction accuracy |
| CPG Session Management | `cpg-service.ts` | In-memory per-session graphs |

### What's Broken or Stubbed

| Component | Issue | Location | Impact |
|-----------|-------|----------|--------|
| Annotation persistence | TODO comment | `annotations.ts:64` | Data lost |
| Embedding generation | Mock with PRNG | `embedding-service.ts:66-67` | Fake similarity |
| Semantic search | Falls back to substring | `search.ts` | Not semantic |
| CPG auto-indexing | Manual only | `indexing.ts` | Empty graphs |
| Problem creation | No INSERT route | `problems.ts` | Empty table |
| code_components | No write path | Schema only | Unused table |
| impact_relations | No write path | Schema only | Unused table |
| design_patterns | No write path | Schema only | Unused table |

### Route-by-Route Persistence Analysis

| Route | Database Operation | Persists? |
|-------|-------------------|-----------|
| POST `/v2/auth/signup` | INSERT users, INSERT organizations | Yes |
| POST `/v2/auth/login` | UPDATE users.last_login_at | Yes |
| POST `/v2/auth/apikey` | SELECT api_keys, validate | Read-only |
| POST `/v2/analysis/index` | None (in-memory CPG) | No |
| GET `/v2/analysis/priority` | SELECT analysis_problems | Read-only |
| POST `/v2/analysis/search` | SELECT analysis_problems | Read-only |
| POST `/v2/analysis/annotations` | **None (TODO)** | **No - STUB** |
| POST `/v2/analysis/cochange/suggest` | SELECT cochange_patterns | Read-only |
| POST `/v2/analysis/impact` | None (CPG traversal) | No |
| PUT `/v2/analysis/problems/:id/complete` | UPDATE + INSERT | **Yes** |
| POST `/v2/analysis/specs/generate` | None (CPG + heuristics) | No |
| POST `/v2/analysis/learning/cochange` | CREATE + UPSERT | **Yes** |
| POST `/v2/analysis/learning/feedback` | CREATE | **Yes** |
| POST `/v2/analysis/learning/update-models` | UPDATE | **Yes** |

---

## RBAC Model

### Permission Pattern (All Analysis Tables)

```sql
PERMISSIONS
  FOR select WHERE org_id = $auth.org_id
    AND (project_id IN $auth.project_ids OR role IN ['admin', 'owner']),
  FOR create WHERE org_id = $auth.org_id
    AND project_id IN $auth.project_ids,
  FOR update WHERE org_id = $auth.org_id
    AND (assigned_to = $auth.id OR role IN ['admin', 'owner']),
  FOR delete WHERE org_id = $auth.org_id
    AND role IN ['admin', 'owner'];
```

### JWT Claims Structure

```typescript
{
  iss: 'https://metabob.com',
  sub: user_id,           // User identifier
  org_id: org_id,         // Primary org (mandatory)
  project_ids: string[],  // Accessible projects
  role: 'admin'|'member'|'owner',
  scopes: string[],       // API scopes (optional)
  exp: number,            // 15 min from issue
  iat: number,
  nbf: number
}
```

### Isolation Guarantees

| Level | Enforcement | Cross-boundary Query |
|-------|-------------|---------------------|
| Organization | SurrealDB PERMISSIONS | Returns empty |
| Project | JWT project_ids check | Returns empty |
| Session | X-Session-ID header | Separate CPG instances |
| User | $auth.id for ownership | Only own resources |

---

## Learning System

### Co-change Pattern Learning

The learning service implements Bayesian confidence updates:

```
P(file_b | file_a changed) = prior × likelihood

Confidence = cochange_count / total_commits_touching_file_a
```

**Data Flow:**

1. **Record Event** (`POST /learning/cochange`)
   - Receives changed files from commit
   - Extracts all file pairs (n*(n-1)/2)
   - Updates `cochange_patterns` with UPSERT

2. **Retrieve Patterns** (`GET /learning/patterns`)
   - Returns patterns above confidence threshold
   - Sorted by confidence descending

3. **Record Feedback** (`POST /learning/feedback`)
   - Stores prediction vs actual accuracy
   - Triggers model update if accuracy < 30%

4. **Update Models** (`POST /learning/update-models`)
   - Recalculates confidence scores using Bayesian formula
   - Batch updates all patterns for project

### Integration with metabob-mcp

```
suggest_related_changes → POST /cochange/suggest
                              │
                              ├─ CPG embedding similarity (60%)
                              └─ Historical patterns (40%)
                              │
                              ▼
                         Hybrid score returned
                              │
                              ▼ (async, non-blocking)
                         POST /learning/cochange
                              │
                              ▼
                         Pattern frequencies updated
```

---

## Relationship to Vessel Spec

From the metabob-mcp vessel spec, the analysis API handles:

### Milestone 1 Tasks (Analysis API)

| Task | metabob-analysis-api Work |
|------|--------------------------|
| 1.1 Annotation Persistence | Uncomment INSERT at `annotations.ts:64` |
| 1.2 Spec Response Types | Fix `specs.ts` to return `steps[]` |
| 1.3 Problem Creation | Add POST `/v2/analysis/problems` route |

### Milestone 2 Tasks (Analysis API)

| Task | metabob-analysis-api Work |
|------|--------------------------|
| 2.1 File Indexing | Complete `indexing.ts` POST route |
| 2.3 Progressive Sync | Track file hashes in `progressive_sync_state` |

### Milestone 3 Tasks (Analysis API)

| Task | metabob-analysis-api Work |
|------|--------------------------|
| 3.1 ONNX Integration | Replace mock in `embedding-service.ts` |
| 3.2 Real Semantic Search | Use FAISS in `search.ts` |
| 3.3 Hybrid Scoring | Combine in `cochange.ts` |

### Milestone 4 Tasks (Analysis API)

| Task | metabob-analysis-api Work |
|------|--------------------------|
| 4.2 Prediction Tracking | New table + endpoints |

### Milestone 6 Tasks (Analysis API)

| Task | metabob-analysis-api Work |
|------|--------------------------|
| 6.1 Project-Scoped Filtering | Update PERMISSIONS |
| 6.2 Public Template Sharing | Add `public=true` support |

---

## API Endpoint Reference

### Authentication (5 endpoints)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v2/auth/signup` | None | Create account |
| POST | `/v2/auth/login` | None | Get JWT |
| POST | `/v2/auth/refresh` | JWT | Refresh token |
| GET | `/v2/auth/me` | JWT | Get profile |
| POST | `/v2/auth/apikey` | API Key | Exchange for JWT |

### Analysis (13 endpoints)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v2/analysis/index` | JWT | Index files to CPG |
| GET | `/v2/analysis/index/status` | JWT | Indexing progress |
| DELETE | `/v2/analysis/index` | JWT | Clear session CPG |
| GET | `/v2/analysis/priority` | JWT | High-priority issues |
| POST | `/v2/analysis/search` | JWT | Semantic search |
| POST | `/v2/analysis/annotations` | JWT | Create annotation [STUB] |
| POST | `/v2/analysis/cochange/suggest` | JWT | Co-change prediction |
| POST | `/v2/analysis/impact` | JWT | Impact analysis |
| GET | `/v2/analysis/problems` | JWT | List problems |
| GET | `/v2/analysis/problems/:id` | JWT | Get problem |
| PUT | `/v2/analysis/problems/:id/complete` | JWT | Mark resolved |
| POST | `/v2/analysis/problems/impulse` | JWT | Problems as impulse |
| POST | `/v2/analysis/specs/generate` | JWT | Generate spec |

### Learning (5 endpoints)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v2/analysis/learning/cochange` | JWT | Record co-change |
| GET | `/v2/analysis/learning/patterns` | JWT | Get patterns |
| POST | `/v2/analysis/learning/feedback` | JWT | Record feedback |
| GET | `/v2/analysis/learning/metrics` | JWT | Get metrics |
| POST | `/v2/analysis/learning/update-models` | JWT | Trigger update |

### Management (18 endpoints)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/v2/orgs` | JWT | List/create orgs |
| GET/PUT | `/v2/orgs/:id` | JWT | Get/update org |
| GET/POST | `/v2/users` | JWT | List/create users |
| DELETE | `/v2/users/:id` | JWT | Delete user |
| GET/POST | `/v2/projects` | JWT | List/create projects |
| PUT/DELETE | `/v2/projects/:id` | JWT | Update/delete project |
| GET/POST | `/v2/subscriptions` | JWT | Get/create subscription |
| PUT | `/v2/subscriptions/:id` | JWT | Update subscription |
| GET/POST | `/v2/api-keys` | JWT | List/create keys |
| DELETE | `/v2/api-keys/:id` | JWT | Revoke key |
| POST | `/v2/api-keys/validate` | Internal | Validate key |

---

## Configuration

### Environment Variables

```bash
# Server
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=info
LOG_FORMAT=json

# SurrealDB
SURREALDB_URL=ws://surrealdb:8000
SURREALDB_NAMESPACE=activity-system
SURREALDB_DATABASE=learning_loop
SURREALDB_USERNAME=root
SURREALDB_PASSWORD=<secret>

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=<must-change-in-production>
JWT_EXPIRY=900  # 15 minutes

# CORS
CORS_ORIGINS=*

# Rate Limiting
RATE_LIMIT_REQUESTS=60
RATE_LIMIT_WINDOW=60
```

---

## Summary

**metabob-analysis-api is:**
- The stateful backend for metabob-mcp
- Owner of analysis data (problems, annotations, patterns)
- Implementer of learning algorithms (Bayesian co-change)
- Enforcer of RBAC via SurrealDB PERMISSIONS
- Manager of in-memory CPG sessions

**metabob-analysis-api is NOT:**
- An MCP server
- A protocol translator
- A UI service
- Stateless

**Current Status:**
- Authentication: Working
- Learning system: Working
- Problem tracking: Working (update only)
- Analysis endpoints: Read-only or stubbed
- CPG indexing: Manual, session-scoped, non-persistent
