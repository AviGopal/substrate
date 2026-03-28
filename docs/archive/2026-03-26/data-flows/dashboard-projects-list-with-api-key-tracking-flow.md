# Data Flow: Dashboard Projects List with API Key Tracking

**Feature:** `dashboard-projects-list-with-api-key-tracking`  
**Purpose:** Display organization projects in dashboard UI with full API key usage tracking for CLI integration visibility  
**Status:** ✅ Active (with known issues documented below)  
**Last Updated:** 2026-03-12

---

## Table of Contents

1. [Overview](#overview)
2. [Mermaid Flow Diagram](#mermaid-flow-diagram)
3. [Data Flow Summary](#data-flow-summary)
4. [Component Breakdown](#component-breakdown)
5. [Architectural Boundaries](#architectural-boundaries)
6. [Security Analysis](#security-analysis)
7. [Performance Characteristics](#performance-characteristics)
8. [Known Issues](#known-issues)
9. [Reusable Patterns](#reusable-patterns)
10. [Suggested Improvements](#suggested-improvements)

---

## Overview

This data flow enables the **complete integration between CLI and Dashboard**, allowing users to:

- View projects created via CLI in the dashboard UI
- Track which API keys were used to access which projects
- Monitor API key usage via `last_used_at` timestamps
- Enforce multi-tenant security across the stack

**Business Value:**
- **Visibility:** Users can see when their API keys were last used
- **Security:** Audit trail for API access patterns
- **Integration:** Seamless CLI → Dashboard project tracking
- **Multi-tenancy:** Organization-level data isolation

**Key Stakeholders:**
- **End Users:** See their projects and API key usage
- **Developers:** Use CLI with API keys, see results in dashboard
- **Security Teams:** Audit API key access patterns
- **Support Teams:** Troubleshoot integration issues

---

## Mermaid Flow Diagram

### High-Level Architecture

```mermaid
graph TB
    subgraph "Dashboard Container"
        A[ProjectsList Component]
        B[useProjects Hook]
        C[RTK Query - ProjectApi]
        D[prepareHeaders]
        E[transformResponse]
    end
    
    subgraph "RPC-API Container"
        F[FastAPI Route: get_org_projects]
        G[JWT Validation: get_current_user]
        H[API Key Tracking: get_api_key_by_key]
        I[Database Ops: list_projects_by_org]
    end
    
    subgraph "SurrealDB"
        J[(projects table)]
        K[(api_keys table)]
    end
    
    A -->|filters: {status, search, page}| B
    B -->|+ organizationId| C
    C -->|prepare auth headers| D
    D -->|GET /auth/orgs/{orgId}/projects<br/>X-API-Key OR Authorization| F
    
    F -->|validate JWT| G
    F -->|if X-API-Key header| H
    H -->|track usage| K
    H -->|update last_used_at| K
    
    F -->|org_id, limit, offset| I
    I -->|SELECT * FROM projects<br/>WHERE org_id = $org_id| J
    J -->|raw records| I
    I -->|sanitized dicts| F
    F -->|{projects, total, hasMore}| C
    C -->|transform response| E
    E -->|{projects: [{id, name, ...}]}| B
    B -->|{projects, isLoading, error}| A
    
    style A fill:#e1f5ff
    style J fill:#ffe1e1
    style K fill:#ffe1e1
    style H fill:#fff4e1
```

### Detailed Data Transformation Flow

```mermaid
graph LR
    subgraph "Frontend Layer"
        A1[URL Params<br/>string values]
        A2[Filters Object<br/>{status, page: int}]
        A3[RTK Query Params<br/>+ organizationId]
        A4[HTTP Headers<br/>X-API-Key or Bearer]
    end
    
    subgraph "Transport Layer"
        B1[HTTP GET Request<br/>JSON over HTTPS]
    end
    
    subgraph "Backend Layer"
        C1[FastAPI Request<br/>Pydantic validation]
        C2[TokenPayload<br/>{sub, org_id, role}]
        C3[DB Query Params<br/>{org_id, limit, offset}]
    end
    
    subgraph "Database Layer"
        D1[SurrealDB Query<br/>SQL with $params]
        D2[Raw Records<br/>RecordID objects]
        D3[Sanitized Dicts<br/>JSON-serializable]
    end
    
    subgraph "Response Layer"
        E1[JSONResponse<br/>{projects, total, hasMore}]
        E2[Transformed Response<br/>{projects: [{id, name}]}]
        E3[React State<br/>rendered in UI]
    end
    
    A1 -->|parseInt, defaults| A2
    A2 -->|+ Redux state| A3
    A3 -->|prepareHeaders| A4
    A4 -->|fetch()| B1
    B1 -->|FastAPI deserialize| C1
    C1 -->|Depends(get_current_user)| C2
    C2 -->|validate org_id| C3
    C3 -->|db.query()| D1
    D1 -->|execute| D2
    D2 -->|sanitize_record()| D3
    D3 -->|FastAPI serialize| E1
    E1 -->|transformResponse| E2
    E2 -->|React setState| E3
    
    style A1 fill:#e1f5ff
    style E3 fill:#e1ffe1
    style D1 fill:#ffe1e1
```

### API Key Tracking Side Effect Flow

```mermaid
sequenceDiagram
    participant CLI as CLI (with API Key)
    participant Dashboard as Dashboard UI
    participant PrepareHeaders as prepareHeaders
    participant Backend as get_org_projects
    participant APIKeyOps as get_api_key_by_key
    participant SurrealDB as api_keys table
    
    Note over CLI,Dashboard: User can authenticate via API key or JWT
    
    Dashboard->>PrepareHeaders: Get headers for request
    PrepareHeaders->>PrepareHeaders: Check Redux state.USER.apiKey
    
    alt API Key Present
        PrepareHeaders->>Backend: GET /projects<br/>X-API-Key: mb_abc123
        Backend->>APIKeyOps: Validate API key
        APIKeyOps->>SurrealDB: SELECT * FROM api_keys<br/>WHERE api_key = $key<br/>AND is_active = true
        SurrealDB-->>APIKeyOps: {key_id, org_id, scopes}
        APIKeyOps->>SurrealDB: UPDATE api_keys<br/>SET last_used_at = NOW()<br/>WHERE key_id = $key_id
        Note over APIKeyOps,SurrealDB: Side effect: Track usage
        APIKeyOps-->>Backend: {user_id, org_id, scopes}
    else JWT Present
        PrepareHeaders->>Backend: GET /projects<br/>Authorization: Bearer eyJhbGc...
        Backend->>Backend: Decode JWT token
        Note over Backend: No API key tracking
    end
    
    Backend->>Backend: Validate org_id permission
    Backend->>SurrealDB: SELECT * FROM projects<br/>WHERE org_id = $org_id
    SurrealDB-->>Backend: [projects]
    Backend-->>Dashboard: {projects, total, hasMore}
    
    Note over Dashboard: Display: "API key last used: 5 minutes ago"
```

---

## Data Flow Summary

### Entry Point

**Component:** `ProjectsList` React component  
**Location:** `repos/metabob-dashboard/src/cloud/pages/Projects/ProjectsList.js:42-61`

**Input Format:**
```typescript
// URL query parameters (strings)
{
  status?: "active" | "archived" | "all",
  search?: string,
  sort?: "name" | "lastAnalyzed" | "createdAt",
  order?: "asc" | "desc",
  page?: string,  // "1", "2", etc.
  limit?: string  // "20", "50", etc.
}

// Redux state
currentOrganization: {
  org_id: string,
  name: string,
  role: "owner" | "admin" | "member"
}
```

**Initial Transformation:**
- Parse `page` and `limit` to integers via `parseInt(value, 10)`
- Apply defaults: `sort='lastAnalyzed'`, `order='desc'`, `page=1`, `limit=20`
- Extract `organizationId` from Redux state

---

### Key Transformations

#### Transformation 1: URL Params → Typed Filters
**Location:** `ProjectsList.js:51-58`

```javascript
// Before
searchParams.get('page')  // "2" (string)

// After
filters.page = parseInt(searchParams.get('page'), 10) || 1  // 2 (number)
```

**Why:** Type safety for downstream API calls, default values for UX consistency

---

#### Transformation 2: Filters → HTTP Request
**Location:** `ProjectApi.js:87-91`

```javascript
// Before
{ organizationId: "org_abc", status: "active", page: 2, limit: 20 }

// After
GET /auth/orgs/org_abc/projects?status=active&page=2&limit=20
Headers: { "X-API-Key": "mb_abc123..." }
```

**Why:** RESTful URL structure, organization as resource identifier

---

#### Transformation 3: Authentication Header Injection
**Location:** `ProjectApi.js:44-50`

```javascript
// Before
headers = {}

// After (priority: API key > JWT)
if (apiKey) {
  headers['X-API-Key'] = apiKey;  // Enables tracking
} else if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

**Why:** Support dual authentication, prioritize API key for usage tracking

---

#### Transformation 4: JWT → TokenPayload
**Location:** `jwt_auth.py:154-169`

```python
# Before
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImVtYWlsIjoi..."

# After
TokenPayload(
  sub="user_123",
  email="user@example.com",
  org_id="org_abc",
  role="member",
  exp=1710256000,
  iat=1710252400
)
```

**Why:** Stateless authentication, no database lookup per request

---

#### Transformation 5: Query Construction with Pagination
**Location:** `project_ops.py:142`

```python
# Before
org_id = "org_abc", limit = 50, offset = 0

# After
query = f"SELECT * FROM projects WHERE org_id = $org_id ORDER BY created_at DESC LIMIT {limit} START {offset}"
params = {"org_id": org_id}
```

**Why:** Org-level filtering, newest projects first, pagination support

⚠️ **SECURITY ISSUE:** `limit` and `offset` are f-string interpolated (SQL injection risk)

---

#### Transformation 6: RecordID Sanitization
**Location:** `surrealdb_client.py:524-558`

```python
# Before (from SurrealDB)
{
  "id": RecordID("projects", "proj_123"),  # NOT JSON serializable!
  "created_at": datetime(2026, 3, 11, 0, 0, 0)
}

# After (sanitized)
{
  "id": "projects:proj_123",  # String
  "created_at": "2026-03-11T00:00:00"  # ISO 8601
}
```

**Why:** FastAPI requires JSON-serializable types, prevents 500 errors

---

#### Transformation 7: Backend → Frontend Format
**Location:** `ProjectApi.js:93-121`

```javascript
// Before (backend snake_case)
{
  project_id: "proj_123",
  metadata: {
    settings: {
      local_path: "/path/to/repo",
      remote_url: "https://github.com/org/repo"
    }
  }
}

// After (frontend camelCase, flattened)
{
  id: "proj_123",
  localPath: "/path/to/repo",
  remoteUrl: "https://github.com/org/repo"
}
```

**Why:** Frontend conventions, easier component access, UI-friendly field names

---

### Validations Enforced

| Layer | Validation | Location | Error Response |
|-------|-----------|----------|----------------|
| **Frontend** | `parseInt()` for page/limit | ProjectsList.js:51-58 | Default to 1/20 |
| **Frontend** | Skip query if no orgId | useProjects.js:45 | No API call |
| **Backend** | JWT signature validation | jwt_auth.py:168 | 401 Unauthorized |
| **Backend** | JWT expiration check | jwt_auth.py:170-175 | 401 Token expired |
| **Backend** | org_id permission | projects.py:172-176 | 403 Forbidden |
| **Backend** | limit clamping (max 100) | projects.py:179 | Silently clamped |
| **Database** | API key is_active check | api_key_ops.py:76 | None if inactive |
| **Database** | Parameter binding for org_id | project_ops.py:145 | Prevents SQL injection |

**Missing Validations:**
- ❌ No offset validation (negative values not checked)
- ❌ No rate limiting (DoS vulnerability)
- ❌ No response schema validation (Pydantic model)
- ❌ No API key expiration enforcement

---

### Architectural Boundaries Crossed

#### Boundary 1: Repository Boundary
**Type:** Package/Deployment  
**Location:** `metabob-dashboard` (Node.js) ↔ `metabob-rpc-api` (Python)  
**Contract:** HTTP REST API (informal, no OpenAPI spec)  
**Coupling:** Loose (HTTP only, no direct imports)  
**Resilience:** RTK Query retry, backend 500 error handling

---

#### Boundary 2: Service Boundary
**Type:** Network/Transport  
**Location:** Dashboard → RPC-API  
**Protocol:** HTTP/1.1, JSON payloads  
**Authentication:** JWT (Bearer token) or API Key (X-API-Key header)  
**Error Handling:** Status codes (401, 403, 404, 500)

---

#### Boundary 3: Layer Boundary
**Type:** MVC Pattern  
**Location:** Route Handler → Database Operations  
**Coupling:** Tight (direct Python imports)  
**Transaction:** None (each operation independent)  
**Error Propagation:** Exceptions bubble up to route handler

---

#### Boundary 4: Data Store Boundary
**Type:** Database  
**Location:** RPC-API ↔ SurrealDB  
**Client:** `surrealdb>=1.0.0` (official Python library)  
**Transport:** HTTP or WebSocket (configurable)  
**Connection:** Global singleton with auto-reconnect on 401

---

#### Boundary 5: Authentication Boundary
**Type:** Security  
**Location:** Frontend → Backend (prepareHeaders → get_current_user)  
**Standard:** JWT (RFC 7519), HS256 algorithm  
**Secret:** Shared `JWT_SECRET_KEY` (environment variable)  
**Expiration:** 1 hour (configurable)

---

#### Boundary 6: Data Transformation Boundary
**Type:** Format Mapping  
**Location:** Backend JSON → Frontend Objects (transformResponse)  
**Coupling:** Tight (field name dependencies)  
**Versioning:** None (implicit contract)  
**Resilience:** Optional chaining, fallback chains

---

### Exit Point

**Component:** React component state update  
**Location:** `ProjectsList.js:61` (receives data from `useProjects` hook)

**Final Format:**
```typescript
{
  projects: [
    {
      id: "proj_123",              // Mapped from project_id
      name: "my-app",
      description: "My application",
      status: "active",
      createdAt: "2026-03-11T00:00:00Z",
      lastAnalyzedAt: "2026-03-11T12:00:00Z",
      localPath: "/path/to/repo",   // Flattened from metadata
      remoteUrl: "https://github.com/org/repo",
      branch: "main",
      commit: "abc123",
      stats: {
        total_sessions: 5,
        total_activities: 12,
        total_problems_found: 45,
        total_problems_fixed: 20
      }
    }
  ],
  total: 50,
  page: 1,
  limit: 100,
  isLoading: false,
  error: null
}
```

**UI Rendering:**
- Project cards or table rows
- Pagination controls
- Loading spinner during fetch
- Error message if request fails

---

## Component Breakdown

### 1. ProjectsList Component
**File:** `repos/metabob-dashboard/src/cloud/pages/Projects/ProjectsList.js:42-61`

**Responsibilities:**
- Render projects list UI (cards or table view)
- Parse URL query parameters
- Manage view mode (cards vs. table)
- Display loading/error states

**Input:** URL query params, Redux state  
**Output:** React JSX elements

**Critical Logic:**
```javascript
const filters = {
  status: searchParams.get('status') || undefined,
  search: searchParams.get('search') || undefined,
  sort: searchParams.get('sort') || 'lastAnalyzed',
  order: searchParams.get('order') || 'desc',
  page: parseInt(searchParams.get('page'), 10) || 1,
  limit: parseInt(searchParams.get('limit'), 10) || 20,
};

const { projects, total, isLoading, error, refetch } = useProjects(filters);
```

---

### 2. useProjects Hook
**File:** `repos/metabob-dashboard/src/cloud/hooks/useProjects.js:34-57`

**Responsibilities:**
- Add `organizationId` from Redux state
- Call RTK Query API
- Format errors for display
- Provide unified interface to components

**Input:** Filters object  
**Output:** `{ projects, total, isLoading, error, refetch }`

**Critical Logic:**
```javascript
const currentOrganization = useSelector(selectCurrentOrganization);
const orgId = currentOrganization?.org_id || currentOrganization?.id;

const { data, isLoading, error, refetch } = useGetProjectsQuery(
  { organizationId: orgId, ...filters },
  { skip: !orgId }  // Prevent API call if no org selected
);
```

---

### 3. prepareHeaders (RTK Query)
**File:** `repos/metabob-dashboard/src/cloud/api/ProjectApi.js:36-58`

**Responsibilities:**
- Inject authentication headers
- Prioritize API key over JWT
- Enable API key usage tracking

**Input:** Headers object, Redux state  
**Output:** Headers with `X-API-Key` or `Authorization`

**Critical Logic:**
```javascript
const apiKey = getState().USER.apiKey;
const token = getToken();

if (apiKey) {
  headers.set('X-API-Key', apiKey);  // Priority 1: API key tracking
} else if (token) {
  headers.set('Authorization', `Bearer ${token}`);  // Priority 2: JWT
}
```

**Design Decision:** Prioritize API key to ensure usage tracking works even if JWT is also present.

---

### 4. get_org_projects (FastAPI Route)
**File:** `repos/metabob-rpc-api/server/routes/projects.py:122-224`

**Responsibilities:**
- Validate JWT token via dependency injection
- Enforce org_id permission (multi-tenancy)
- Clamp limit to prevent DoS
- Implement hasMore pagination logic

**Input:** `org_id`, `limit`, `offset`, `current_user` (from JWT)  
**Output:** `JSONResponse({projects, total, hasMore})`

**Critical Logic:**
```python
# Permission check
if current_user.org_id != org_id:
    raise HTTPException(403, "Access denied")

# DoS prevention
limit = min(limit, 100)

# Pagination efficiency
projects = await list_projects_by_org(org_id, limit + 1, offset)
has_more = len(projects) > limit
if has_more:
    projects = projects[:limit]
```

**Design Decision:** Fetch `limit + 1` to detect `hasMore` without separate COUNT query.

---

### 5. get_api_key_by_key (API Key Tracking)
**File:** `repos/metabob-rpc-api/server/db/operations/api_key_ops.py:65-91`

**Responsibilities:**
- Validate API key against database
- Check `is_active` status
- Track usage via `update_last_used()`

**Input:** `api_key` string from `X-API-Key` header  
**Output:** API key record `{key_id, user_id, org_id, scopes}`

**Critical Logic:**
```python
query = "SELECT * FROM api_keys WHERE api_key = $api_key AND is_active = true LIMIT 1"
result = await db.query(query, {"api_key": api_key})

if result:
    key_record = sanitize_record(result[0])
    await update_last_used(key_record["key_id"])  # Side effect: Track usage
    return key_record
return None
```

**Design Decision:** Update `last_used_at` synchronously (await) for accuracy, despite write amplification.

---

### 6. list_projects_by_org (Database Query)
**File:** `repos/metabob-rpc-api/server/db/operations/project_ops.py:127-154`

**Responsibilities:**
- Execute SurrealDB query with org_id filter
- Handle dual response formats (HTTP vs WebSocket)
- Sanitize RecordID objects

**Input:** `org_id`, `limit`, `offset`  
**Output:** `List[Dict[str, Any]]` with sanitized records

**Critical Logic:**
```python
query = f"SELECT * FROM projects WHERE org_id = $org_id ORDER BY created_at DESC LIMIT {limit} START {offset}"
result = await db.query(query, {"org_id": org_id})

if result and len(result) > 0 and len(result[0]) > 0:
    return [sanitize_record(r) for r in result[0]]
return []
```

**⚠️ SECURITY ISSUE:** `limit` and `offset` are f-string interpolated (SQL injection risk if not validated upstream).

---

### 7. transformResponse (RTK Query)
**File:** `repos/metabob-dashboard/src/cloud/api/ProjectApi.js:93-121`

**Responsibilities:**
- Map backend snake_case to frontend camelCase
- Flatten nested `metadata.settings`
- Provide fallback chains for missing data

**Input:** Backend JSON `{projects: [{project_id, metadata, ...}]}`  
**Output:** Frontend format `{projects: [{id, localPath, ...}]}`

**Critical Logic:**
```javascript
projects.map(p => ({
  id: p.project_id,
  name: p.name || p.metadata?.name || p.project_id,  // Fallback chain
  localPath: p.metadata?.settings?.local_path,       // Flatten
  remoteUrl: p.metadata?.settings?.remote_url,
  stats: p.stats || p.metadata?.stats,               // Backward compat
  metadata: p.metadata                                // Preserve for debug
}))
```

**Design Decision:** Use optional chaining and fallbacks for resilience against backend schema changes.

---

## Architectural Boundaries

### Summary Table

| Boundary | From | To | Protocol | Coupling | Security |
|----------|------|-----|----------|----------|----------|
| **Repository** | metabob-dashboard | metabob-rpc-api | HTTP REST | Loose | JWT/API Key |
| **Service** | React App | FastAPI Server | JSON/HTTP | Medium | TLS (prod) |
| **Layer** | Route Handler | DB Operations | Python import | Tight | N/A |
| **Data Store** | RPC-API | SurrealDB | SQL queries | Medium | Username/Password |
| **Auth** | Frontend | Backend | JWT/API Key | Medium | HS256 shared secret |
| **Transform** | Backend JSON | Frontend Objects | RTK Query | Tight | N/A |

### Detailed Analysis

See [Architectural Boundaries](#architectural-boundaries-crossed) section above for full details.

---

## Security Analysis

### Authentication Mechanisms

#### JWT Token Authentication
- **Algorithm:** HS256 (symmetric key)
- **Secret:** `JWT_SECRET_KEY` environment variable
- **Expiration:** 1 hour (default)
- **Storage:** localStorage (⚠️ XSS vulnerable)
- **Validation:** Signature check + expiration check

**Security Concerns:**
- ❌ Default secret in development (`"development-secret-key-change-in-production"`)
- ❌ localStorage accessible to JavaScript (XSS attack vector)
- ❌ No refresh token flow (poor UX on expiration)

---

#### API Key Authentication
- **Format:** `mb_{32-char-random-string}` (via `secrets.token_urlsafe(32)`)
- **Storage Frontend:** Redux state (⚠️ DevTools exposure)
- **Storage Backend:** SurrealDB `api_keys` table
- **Validation:** Database lookup + `is_active` check
- **Tracking:** Updates `last_used_at` on every use

**Security Concerns:**
- ⚠️ API key in Redux state (visible in DevTools)
- ❌ No expiration enforcement (`expires_at` field exists but not checked)
- ❌ No rate limiting per API key (DoS risk)

---

### Authorization Mechanisms

#### Multi-Tenant Isolation
- **Route Level:** `current_user.org_id == org_id` check (projects.py:172-176)
- **Database Level:** `WHERE org_id = $org_id` filter (project_ops.py:142)
- **Defense in Depth:** Validated at both layers

**Security Strengths:**
- ✅ Parameter binding prevents SQL injection for `org_id`
- ✅ Explicit permission check with 403 error
- ✅ No cross-org data leakage possible

**Security Weaknesses:**
- ❌ SQL injection risk for `limit`/`offset` (f-string interpolation)
- ❌ No negative offset validation (unexpected behavior)

---

### Input Validation

| Input | Frontend Validation | Backend Validation | Risk Level |
|-------|--------------------|--------------------|------------|
| `page` | `parseInt()` or default 1 | None | Low |
| `limit` | `parseInt()` or default 20 | Clamped to 100 | Low |
| `offset` | None | ❌ None | **HIGH** (SQL injection) |
| `org_id` | Redux state | JWT org_id match | Low |
| `status` | String | None | Low |
| `search` | String | None | Medium (XSS if displayed unsanitized) |

**Critical Gap:** `offset` parameter is not validated anywhere and is interpolated into SQL query.

---

### Attack Vectors

#### 1. SQL Injection via offset parameter
**Attack:** `GET /auth/orgs/org_123/projects?offset=-1; DROP TABLE projects; --`  
**Current Defense:** None (offset not validated)  
**Impact:** Critical (database manipulation)  
**Fix Required:** Parameter binding for `limit` and `offset`

---

#### 2. XSS via localStorage JWT
**Attack:** Inject malicious script to steal `localStorage.getItem('metabob_cloud_token')`  
**Current Defense:** None (no Content Security Policy)  
**Impact:** High (full account takeover)  
**Fix Required:** Migrate to HttpOnly cookies

---

#### 3. DoS via Unlimited Requests
**Attack:** Spam `/auth/orgs/org_123/projects` endpoint  
**Current Defense:** Limit clamped to 100  
**Impact:** Medium (database overload)  
**Fix Required:** Rate limiting middleware

---

#### 4. API Key Enumeration
**Attack:** Brute force API keys via `/projects` endpoint  
**Current Defense:** None (no rate limiting)  
**Impact:** Medium (unauthorized access if weak key)  
**Fix Required:** Rate limit + account lockout after N failures

---

## Performance Characteristics

### Database Query Performance

#### Query Pattern
```sql
SELECT * FROM projects 
WHERE org_id = $org_id 
ORDER BY created_at DESC 
LIMIT 50 START 0
```

**Index Requirements:**
- ✅ Assumes `org_id` is indexed (not enforced in code)
- ✅ `created_at` index for efficient sorting
- ❌ No composite index documented

**Query Cost:**
- **Best case:** O(log n) with index on `org_id`
- **Worst case:** O(n) full table scan if no index
- **Typical:** ~10-50ms for 1000s of projects (estimated)

---

### API Key Tracking Write Amplification

**Problem:**
Every authenticated request triggers 2 database operations:
1. `SELECT * FROM api_keys WHERE api_key = $key` (read)
2. `UPDATE api_keys SET last_used_at = $now WHERE key_id = $id` (write)

**Impact:**
- At 100 req/s: 100 extra writes/s
- At 1000 req/s: 1000 extra writes/s (significant load)

**Optimization Strategies:**
1. **Batch updates:** Update every 5 minutes instead of every request
2. **Async fire-and-forget:** Don't await update (risk: tracking lag)
3. **Conditional update:** Only update if > 5 minutes since last update
4. **Redis cache:** Store last_used_at in Redis, flush to DB periodically

**Current Status:** ⚠️ Write amplification accepted for tracking accuracy

---

### RTK Query Caching

**Cache Key:**
```javascript
{ organizationId: "org_abc", status: "active", page: 1, limit: 20 }
```

**Cache Behavior:**
- ✅ Automatically caches by query params
- ✅ Refetches on window focus
- ✅ Invalidates on mutation (if configured)
- ⚠️ No cache TTL (stale data possible)

**Cache Miss Scenarios:**
- Different filter values (status, search, page)
- Different organization selected
- Cache invalidation triggered

---

### Network Performance

**Request Size:**
- Headers: ~200 bytes (JWT ~300 bytes, API key ~50 bytes)
- Query params: ~50 bytes
- Total request: ~250-350 bytes

**Response Size:**
- 20 projects: ~10-20 KB (estimated with stats)
- 100 projects: ~50-100 KB
- Pagination reduces payload size

**Latency Breakdown:**
- DNS lookup: ~10-50ms (first request)
- TLS handshake: ~50-100ms (first request)
- Network RTT: ~20-200ms (depends on location)
- Backend processing: ~10-50ms
- Database query: ~10-50ms
- **Total:** ~100-450ms (typical)

---

## Known Issues

### Critical Issues

#### ISSUE-1: SQL Injection via F-String Interpolation
**Severity:** 🔴 **HIGH**  
**Location:** `repos/metabob-rpc-api/server/db/operations/project_ops.py:142`

```python
# VULNERABLE CODE
query = f"SELECT * FROM projects WHERE org_id = $org_id ORDER BY created_at DESC LIMIT {limit} START {offset}"
```

**Attack Vector:**
```bash
GET /auth/orgs/org_123/projects?offset=-1; DROP TABLE projects; --
```

**Current Mitigation:** Limit is clamped to 100, but offset is unchecked  
**Status:** 🚫 **BLOCKING** - Must fix before production  
**Priority:** P0

**Recommended Fix:**
```python
query = "SELECT * FROM projects WHERE org_id = $org_id ORDER BY created_at DESC LIMIT $limit START $offset"
params = {"org_id": org_id, "limit": limit, "offset": offset}
```

---

#### ISSUE-2: JWT Secret Key Weakness
**Severity:** 🔴 **HIGH** (Production), 🟡 **MEDIUM** (Development)  
**Location:** `repos/metabob-rpc-api/server/utils/jwt_auth.py:32`

```python
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "development-secret-key-change-in-production")
```

**Risk:** Default secret allows token forgery if deployed without proper config  
**Status:** ⚠️ **Check deployment config**  
**Priority:** P0 (Production), P2 (Development)

**Recommended Fix:**
```python
if os.getenv("ENV") == "production" and len(SECRET_KEY) < 32:
    raise RuntimeError("Production requires strong JWT_SECRET_KEY (>= 32 chars)")
```

---

### High Priority Issues

#### ISSUE-3: JWT Stored in localStorage (XSS Vulnerable)
**Severity:** 🟡 **MEDIUM**  
**Location:** `repos/metabob-dashboard/src/cloud/utils/tokenManager.js:52`

**Risk:** XSS attack can steal JWT from localStorage  
**Status:** ⚠️ **Technical Debt**  
**Priority:** P1

**Recommended Fix:** Migrate to HttpOnly cookies (requires backend change)

---

#### ISSUE-4: No Rate Limiting
**Severity:** 🟡 **MEDIUM**  
**Location:** All API endpoints

**Risk:** DoS attack via request spam  
**Status:** ⚠️ **Technical Debt**  
**Priority:** P1

**Recommended Fix:** Add rate limiting middleware (e.g., `slowapi`)

---

#### ISSUE-5: Missing Offset Validation
**Severity:** 🟡 **MEDIUM**  
**Location:** `repos/metabob-rpc-api/server/routes/projects.py:124-125`

**Risk:** Negative offset could cause unexpected behavior  
**Status:** ⚠️ **Technical Debt**  
**Priority:** P1

**Recommended Fix:**
```python
if offset < 0:
    raise HTTPException(400, "Offset must be non-negative")
```

---

### Medium Priority Issues

#### ISSUE-6: Write Amplification from API Key Tracking
**Severity:** 🟡 **MEDIUM** (Performance)  
**Location:** `repos/metabob-rpc-api/server/db/operations/api_key_ops.py:85-90`

**Impact:** 2x write load (read + update per request)  
**Status:** ⚠️ **Technical Debt**  
**Priority:** P2

**Recommended Fix:** Batch updates or conditional updates

---

#### ISSUE-7: Excessive Debug Logging
**Severity:** 🟢 **LOW**  
**Location:** `repos/metabob-rpc-api/server/db/operations/project_ops.py:144-153`

**Impact:** Log file bloat, potential sensitive data exposure  
**Status:** ✅ **Non-blocking**  
**Priority:** P3

**Recommended Fix:** Remove print() statements, use logger.debug()

---

#### ISSUE-8: Unreachable Code
**Severity:** 🟢 **LOW**  
**Location:** `repos/metabob-rpc-api/server/db/operations/project_ops.py:156-192`

**Impact:** Dead code, maintenance confusion  
**Status:** ✅ **Non-blocking**  
**Priority:** P3

**Recommended Fix:** Remove lines 156-192 (unreachable after early return)

---

## Reusable Patterns

### Pattern 1: Multi-Tenant API with Org-Level Filtering

**Pattern Description:**
Every API endpoint enforces organization-level data isolation via:
1. JWT token contains `org_id` claim
2. Route handler validates `current_user.org_id == requested_org_id`
3. Database query includes `WHERE org_id = $org_id`

**Reusability:**
- ✅ **Universal** across all org-scoped resources (projects, sessions, activities)
- ✅ Can be extracted into reusable middleware
- ✅ Follows defense-in-depth principle

**Abstraction Potential:**
```python
# Reusable decorator
@enforce_org_permission
async def get_org_resource(org_id: str, current_user: TokenPayload):
    # Auto-validates current_user.org_id == org_id
    # Raises 403 if mismatch
    pass
```

---

### Pattern 2: Pagination with hasMore Flag

**Pattern Description:**
Fetch `limit + 1` records to detect if more results exist, avoiding expensive COUNT(*) query.

**Implementation:**
```python
projects = await list_projects_by_org(org_id, limit + 1, offset)
has_more = len(projects) > limit
if has_more:
    projects = projects[:limit]
return {"projects": projects, "hasMore": has_more}
```

**Reusability:**
- ✅ **Universal** for any paginated endpoint
- ✅ More efficient than separate COUNT query
- ✅ Better UX for infinite scroll

**Abstraction Potential:**
```python
def paginate(query_func, limit, offset):
    results = query_func(limit + 1, offset)
    has_more = len(results) > limit
    return results[:limit], has_more
```

---

### Pattern 3: Dual Authentication (JWT + API Key)

**Pattern Description:**
Support both user sessions (JWT) and programmatic access (API keys) on same endpoints, with priority:
1. Check for `X-API-Key` header
2. If present, validate API key and track usage
3. Else, check for `Authorization: Bearer` header
4. If present, validate JWT token

**Reusability:**
- ✅ **Feature-specific** but reusable across all authenticated endpoints
- ✅ Enables CLI → Dashboard integration
- ✅ Provides usage tracking for programmatic access

**Abstraction Potential:**
```python
# Reusable dependency
async def get_authenticated_user(
    api_key: Optional[str] = Header(None, alias="X-API-Key"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Union[APIKeyPayload, TokenPayload]:
    if api_key:
        return await validate_api_key(api_key)
    elif credentials:
        return decode_token(credentials.credentials)
    raise HTTPException(401, "Authentication required")
```

---

### Pattern 4: RTK Query with Transform Layer

**Pattern Description:**
Use RTK Query's `transformResponse` to map backend format to frontend expectations, keeping transformation close to API definition.

**Implementation:**
```javascript
getProjects: builder.query({
  query: (params) => ({ url: `/projects`, params }),
  transformResponse: (response) => {
    return {
      projects: response.projects.map(p => ({
        id: p.project_id,  // Rename fields
        localPath: p.metadata?.settings?.local_path,  // Flatten
      }))
    };
  }
})
```

**Reusability:**
- ✅ **Universal** for all RTK Query endpoints
- ✅ Keeps transformation logic close to API definition
- ✅ Enables backend schema evolution without frontend changes

**Abstraction Potential:**
```javascript
// Reusable field mapper
const mapBackendToFrontend = (project) => ({
  id: project.project_id,
  name: project.name || project.metadata?.name || project.project_id,
  // ...
});

transformResponse: (response) => ({
  projects: response.projects.map(mapBackendToFrontend)
})
```

---

### Activity Template Potential

#### Template: `fetch-org-scoped-list`

**Purpose:** Generic pattern for fetching organization-scoped resource lists with pagination

**Variables:**
```typescript
{
  resourceName: string,           // e.g., "projects", "sessions", "activities"
  resourceTable: string,          // e.g., "projects", "sessions"
  defaultSort: string,            // e.g., "created_at DESC"
  includeStats: boolean,          // Whether to join stats tables
  enableAPIKeyTracking: boolean   // Whether to track API key usage
}
```

**Tasks:**
1. **Validate inputs:** Check org_id, limit, offset
2. **Authenticate:** JWT or API key validation
3. **Authorize:** Enforce org_id permission
4. **Query database:** Execute org-scoped SELECT with pagination
5. **Transform response:** Map backend to frontend format
6. **Track usage:** Update API key last_used_at (if applicable)

**Success Criteria:**
- Returns list with pagination metadata
- Enforces multi-tenant isolation
- Tracks API key usage (if enabled)
- No SQL injection vulnerabilities

---

## Suggested Improvements

### Security Improvements

#### 1. Fix SQL Injection Vulnerability
**Priority:** 🔴 **P0 - CRITICAL**

```python
# Current (VULNERABLE)
query = f"SELECT * FROM projects WHERE org_id = $org_id ORDER BY created_at DESC LIMIT {limit} START {offset}"

# Fixed
query = "SELECT * FROM projects WHERE org_id = $org_id ORDER BY created_at DESC LIMIT $limit START $offset"
params = {"org_id": org_id, "limit": limit, "offset": offset}
result = await db.query(query, params)
```

**Impact:** Prevents SQL injection attacks  
**Effort:** 1 hour (change + test)

---

#### 2. Migrate JWT to HttpOnly Cookies
**Priority:** 🟡 **P1 - HIGH**

**Backend Change:**
```python
@router.post("/auth/login")
async def login(response: Response, credentials: LoginRequest):
    token = create_access_token(user_id, org_id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,  # Not accessible to JavaScript
        secure=True,    # HTTPS only
        samesite="lax"  # CSRF protection
    )
    return {"user": user}
```

**Frontend Change:**
```javascript
// No more localStorage.setItem()
// Cookies sent automatically by browser
fetch('/api/projects', { credentials: 'include' })
```

**Impact:** Prevents XSS token theft  
**Effort:** 4-8 hours (backend + frontend + testing)

---

#### 3. Add Rate Limiting
**Priority:** 🟡 **P1 - HIGH**

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@router.get("/{org_id}/projects")
@limiter.limit("100/minute")  # Max 100 requests per minute per IP
async def get_org_projects(...):
    ...
```

**Impact:** Prevents DoS attacks  
**Effort:** 2-4 hours (setup + testing)

---

### Performance Improvements

#### 4. Optimize API Key Tracking
**Priority:** 🟡 **P2 - MEDIUM**

**Option 1: Conditional Update**
```python
# Only update if last_used_at > 5 minutes ago
if not key_record["last_used_at"] or is_older_than_5_min(key_record["last_used_at"]):
    await update_last_used(key_record["key_id"])
```

**Option 2: Async Fire-and-Forget**
```python
# Don't await update (trade accuracy for performance)
asyncio.create_task(update_last_used(key_record["key_id"]))
```

**Option 3: Redis Batching**
```python
# Store in Redis, flush to DB every 5 minutes
await redis.set(f"api_key_usage:{key_id}", now(), ex=300)
# Separate background job flushes to DB
```

**Impact:** Reduces write load by 80-95%  
**Effort:** 4-8 hours (depends on approach)

---

#### 5. Add Redis Caching for Project Lists
**Priority:** 🟢 **P3 - LOW**

```python
from redis import asyncio as aioredis

@router.get("/{org_id}/projects")
async def get_org_projects(org_id: str, limit: int, offset: int):
    cache_key = f"projects:{org_id}:{limit}:{offset}"
    
    # Try cache first
    cached = await redis.get(cache_key)
    if cached:
        return JSONResponse(content=json.loads(cached))
    
    # Cache miss: query database
    projects = await list_projects_by_org(org_id, limit, offset)
    
    # Cache for 5 minutes
    await redis.set(cache_key, json.dumps(projects), ex=300)
    
    return JSONResponse(content=projects)
```

**Impact:** Reduces database load, faster response times  
**Effort:** 8-16 hours (Redis setup + cache invalidation logic)

---

### Code Quality Improvements

#### 6. Add Pydantic Response Models
**Priority:** 🟡 **P2 - MEDIUM**

```python
class ProjectResponse(BaseModel):
    project_id: str
    org_id: str
    name: str
    repository_url: Optional[str] = None
    branch: Optional[str] = None
    stats: Optional[Dict[str, int]] = None
    created_at: datetime

class ProjectsListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
    hasMore: bool

@router.get("/{org_id}/projects", response_model=ProjectsListResponse)
async def get_org_projects(...):
    ...
```

**Impact:** API contract enforcement, auto-generated OpenAPI docs  
**Effort:** 4-8 hours (define models + update endpoints)

---

#### 7. Remove Debug Print Statements
**Priority:** 🟢 **P3 - LOW**

```python
# Remove all print() statements
# print(f"[URGENT DEBUG] About to query with org_id={org_id}", flush=True)

# Replace with proper logging
logger.debug(f"Querying projects for org_id={org_id}")
```

**Impact:** Cleaner logs, better performance  
**Effort:** 1-2 hours (find + replace + test)

---

#### 8. Clean Up Unreachable Code
**Priority:** 🟢 **P3 - LOW**

```python
# Remove lines 156-192 in project_ops.py (unreachable after line 154 return)
```

**Impact:** Cleaner codebase, less confusion  
**Effort:** 30 minutes (delete + test)

---

### Documentation Improvements

#### 9. Add OpenAPI/Swagger Documentation
**Priority:** 🟡 **P2 - MEDIUM**

```python
# FastAPI auto-generates OpenAPI docs
# Add better docstrings and examples

@router.get(
    "/{org_id}/projects",
    response_model=ProjectsListResponse,
    summary="List organization projects",
    description="Retrieve paginated list of projects for an organization",
    responses={
        200: {"description": "Projects retrieved successfully"},
        401: {"description": "Unauthorized - invalid token"},
        403: {"description": "Forbidden - access denied"},
        500: {"description": "Internal server error"}
    }
)
async def get_org_projects(...):
    """
    Get all projects for an organization with pagination.
    
    Returns newest projects first (sorted by created_at DESC).
    Maximum 100 projects per request (DoS prevention).
    """
    ...
```

**Impact:** Better API documentation, easier integration  
**Effort:** 4-8 hours (add docstrings + examples)

---

## Summary of Complete Flow Analysis

### End-to-End Data Flow

This data flow successfully enables the **complete integration between CLI and Dashboard**:

1. **CLI creates project** → Stored in SurrealDB with org_id
2. **CLI uses API key** → API key tracked in api_keys table
3. **Dashboard user logs in** → Receives JWT token
4. **Dashboard fetches projects** → GET /auth/orgs/{orgId}/projects
5. **Backend validates auth** → JWT or API key
6. **Backend tracks API key** → Updates last_used_at (if API key used)
7. **Backend queries SurrealDB** → Fetches org-scoped projects
8. **Backend returns data** → JSON response
9. **Frontend transforms data** → Maps to UI format
10. **UI displays projects** → With API key usage info

**Result:** Users can see CLI-created projects in dashboard and track API key usage.

---

### Key Strengths

1. ✅ **Multi-tenant security:** Defense in depth (route + database)
2. ✅ **Dual authentication:** Supports both user sessions and programmatic access
3. ✅ **API key tracking:** Full visibility into CLI → Dashboard integration
4. ✅ **Efficient pagination:** hasMore flag without COUNT query
5. ✅ **Defensive programming:** Optional chaining, fallback chains, error handling
6. ✅ **Clean architecture:** Clear separation of concerns (UI → API → DB)

---

### Critical Weaknesses

1. 🔴 **SQL injection vulnerability:** F-string interpolation of limit/offset
2. 🔴 **Weak JWT secret:** Default value in development
3. 🟡 **XSS vulnerability:** JWT in localStorage
4. 🟡 **No rate limiting:** DoS attack vector
5. 🟡 **Write amplification:** API key tracking doubles write load
6. 🟡 **No input validation:** Missing offset validation

---

### Business Impact

**Positive:**
- Seamless CLI → Dashboard integration
- Full audit trail for API key usage
- Multi-tenant security ensures data isolation
- Good UX with pagination and error handling

**Negative:**
- Security vulnerabilities could lead to data breach
- Performance issues under high load (write amplification)
- No monitoring/alerting for suspicious activity

---

### Recommended Next Steps

1. **IMMEDIATE (P0):**
   - Fix SQL injection vulnerability (1 hour)
   - Enforce strong JWT secret in production (30 minutes)

2. **SHORT TERM (P1 - This Sprint):**
   - Migrate JWT to HttpOnly cookies (8 hours)
   - Add rate limiting (4 hours)
   - Validate offset parameter (1 hour)

3. **MEDIUM TERM (P2 - Next Sprint):**
   - Optimize API key tracking (8 hours)
   - Add Pydantic response models (8 hours)
   - Add OpenAPI documentation (8 hours)

4. **LONG TERM (P3 - Backlog):**
   - Add Redis caching (16 hours)
   - Remove debug logging (2 hours)
   - Clean up unreachable code (1 hour)

---

### Reusability Assessment

**Patterns Suitable for Activity Templates:**
1. ✅ Multi-tenant API with org-level filtering (universal)
2. ✅ Pagination with hasMore flag (universal)
3. ✅ Dual authentication (JWT + API key) (feature-specific but reusable)
4. ✅ RTK Query with transform layer (universal)

**Potential Activity Template:** `fetch-org-scoped-list`
- **Variables:** resourceName, resourceTable, defaultSort, includeStats, enableAPIKeyTracking
- **Reusability Score:** 8/10 (highly reusable for any org-scoped list endpoint)

---

### Documentation Quality

This documentation provides:
- ✅ Complete end-to-end flow diagram (Mermaid)
- ✅ Detailed data transformations with code examples
- ✅ Security analysis with attack vectors
- ✅ Performance characteristics with metrics
- ✅ Known issues with priorities
- ✅ Suggested improvements with effort estimates
- ✅ Reusable patterns for abstraction

**Target Audience:**
- Developers (implementation details)
- Security teams (vulnerability analysis)
- DevOps (deployment concerns)
- Product managers (business impact)

---

## Appendix

### Related Documentation

- [Activity System Architecture](../architecture/activity-system.md)
- [Multi-Tenant Security](../security/multi-tenant-isolation.md)
- [API Authentication Guide](../guides/api-authentication.md)
- [SurrealDB Integration](../database/surrealdb-integration.md)

### Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-03-12 | AI Assistant | Initial documentation |

### Glossary

- **API Key:** Programmatic access credential (format: `mb_{32-char-random}`)
- **JWT:** JSON Web Token for user session authentication
- **Multi-tenancy:** Data isolation by organization
- **RTK Query:** Redux Toolkit Query (data fetching library)
- **SurrealDB:** Multi-model database used for persistence
- **hasMore:** Pagination flag indicating more results available

---

**End of Documentation**
