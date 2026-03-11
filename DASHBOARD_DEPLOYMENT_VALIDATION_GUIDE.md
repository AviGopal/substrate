# Metabob Dashboard and Deployment Configuration - Validation Guide

**Generated:** 2026-03-11  
**Purpose:** Comprehensive guide to validate organization creation, user registration, and dashboard data viewing capabilities

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Deployment Configuration](#deployment-configuration)
3. [Authentication & User Management](#authentication--user-management)
4. [Organization Management](#organization-management)
5. [Data Flow from CLI to Dashboard](#data-flow-from-cli-to-dashboard)
6. [Validation Procedures](#validation-procedures)
7. [E2E Testing Strategy](#e2e-testing-strategy)

---

## Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Browser                                │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Metabob Dashboard (React)                        │
│  Location: repos/metabob-dashboard/                                 │
│  Deploy: repos/platform/metabob-apps/charts/metabob-dashboard/      │
│                                                                     │
│  • Cloud Mode: /cloud/login, /cloud/dashboard, /cloud/projects     │
│  • Local Mode: /dashboard, /analysis                               │
│  • API Integration: OrganizationApi, CloudAuthApi                  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ /auth/*, /api/* (via Istio)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Metabob RPC API (FastAPI)                        │
│  Location: repos/metabob-rpc-api/                                  │
│  Deploy: repos/platform/metabob-apps/charts/metabob-rpc-api/       │
│                                                                     │
│  Authentication Endpoints:                                          │
│    • POST /auth/register  → Register user + org                    │
│    • POST /auth/login     → Authenticate user                      │
│    • GET  /auth/session   → Validate JWT token                     │
│    • GET  /auth/orgs      → List user's organizations              │
│                                                                     │
│  Organization Endpoints:                                            │
│    • GET    /auth/orgs/{org_id}              → Org details         │
│    • PATCH  /auth/orgs/{org_id}              → Update org          │
│    • GET    /auth/orgs/{org_id}/users        → List members        │
│    • POST   /auth/orgs/{org_id}/users        → Invite member       │
│    • GET    /auth/orgs/{org_id}/stats        → Org statistics      │
│    • GET    /auth/orgs/{org_id}/activity     → Recent activity     │
│                                                                     │
│  Analytics Endpoints (metabob-cli data):                            │
│    • GET  /analytics/executions              → Activity history    │
│    • GET  /analytics/executions/{id}         → Execution details   │
│    • POST /api/parameter-server/outcomes     → CLI metrics         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ SQL Queries
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SurrealDB (Database)                          │
│  Deploy: repos/platform/metabob-apps/charts/surrealdb/              │
│                                                                     │
│  Tables:                                                            │
│    • users                    → User accounts                      │
│    • organizations            → Organization data                  │
│    • user_organizations       → User-org relationships             │
│    • activity_executions      → Activity execution history         │
│    • activity_variants        → Activity templates                 │
│    • projects                 → Project metadata                   │
│    • project_analysis         → Analysis results from CLI          │
│    • impulse_registry         → Impulse data for activities        │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Version | Location |
|-----------|-----------|---------|----------|
| Dashboard Frontend | React 18.3.1 + Material-UI 5 | 2.2.11 | repos/metabob-dashboard/ |
| Backend API | FastAPI + Python 3.11+ | 0.16.0 | repos/metabob-rpc-api/ |
| Database | SurrealDB | 2.3.10 | surrealdb:8000 |
| Cache | Redis | Latest | redis:6379 |
| Service Mesh | Istio | Latest | Istio Gateway |
| Deployment | Kubernetes + Helm | 1.28+ | repos/platform/metabob-apps/ |

---

## Deployment Configuration

### 1. Dashboard Deployment

**Helm Chart:** `repos/platform/metabob-apps/charts/metabob-dashboard/`

**Key Configuration Files:**
```yaml
# repos/platform/metabob-apps/charts/metabob-dashboard/charts/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: metabob-dashboard
  namespace: metabob
spec:
  containers:
    - name: metabob-dashboard
      image: metabobapp/metabob-dashboard:2.2.2
      env:
        - name: REACT_APP_DEPLOYMENT_MODE
          value: "cloud"  # or "local"
        - name: REACT_APP_API_BASE_URL
          value: ""  # Empty = relative paths (Istio handles routing)
        - name: REACT_APP_AUTH_BASE_URL
          value: "/auth"
```

**Values (Integration Environment):**
```yaml
# repos/platform/metabob-apps/charts/metabob-dashboard/values/integration.metabob-dashboard.values.yaml
image:
  tag: 2.2.2

deploymentMode: cloud
apiUrl: ""  # Istio routes /api/* to RPC API
authUrl: "/auth"  # Istio routes /auth/* to RPC API
```

### 2. RPC API Deployment

**Helm Chart:** `repos/platform/metabob-apps/charts/metabob-rpc-api/`

**Key Configuration:**
```yaml
# repos/platform/metabob-apps/charts/metabob-rpc-api/values/integration.metabob-rpc-api.values.yaml
name: rpc-api
namespace: metabob
release: integration

image:
  imageRegistry: metabobapp
  rpc_api:
    repo: metabob-rpc-api
    tag: 0.16.0

workers:
  replicas: 10  # Worker pods for background tasks

service:
  replicas: 16  # API server pods
  workers: 16   # Workers per pod

surrealdb:
  database: integration  # or "production"
```

**Environment Variables:**
```yaml
env:
  - name: SURREALDB_URL
    value: "http://surrealdb:8000"
  - name: SURREALDB_NAMESPACE
    value: "metabob"
  - name: SURREALDB_DATABASE
    value: "integration"
  - name: SURREALDB_USERNAME
    valueFrom:
      secretKeyRef:
        name: surrealdb-credentials
        key: username
  - name: SURREALDB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: surrealdb-credentials
        key: password
  - name: REDIS_URI
    value: "redis://redis:6379"
```

### 3. Istio Routing Configuration

**Service Mesh Routes:**
```yaml
# Istio Gateway routes external traffic to dashboard
# Dashboard at: https://metabob.example.com/
# API routes automatically forwarded by Istio:
#   /auth/* → metabob-rpc-api:8080
#   /api/*  → metabob-rpc-api:8080
```

---

## Authentication & User Management

### Registration Flow

**Endpoint:** `POST /auth/register`

**Implementation:** `repos/metabob-rpc-api/server/routes/cloud_auth.py:418`

**Request Schema:**
```typescript
{
  "email": "user@example.com",
  "password": "SecurePass123!",  // min 8 chars
  "name": "John Doe",
  "org_name": "Acme Corp"
}
```

**Backend Process:**
1. **Validate email uniqueness** (query `users` table)
2. **Hash password** with bcrypt (12 rounds)
3. **Generate UUIDs** for org_id and user_id
4. **Create organization** record in `organizations` table
5. **Create user** record in `users` table (role='owner')
6. **Create junction** record in `user_organizations` table
7. **Generate JWT token** with payload:
   ```json
   {
     "sub": "user_id",
     "email": "user@example.com",
     "org_id": "org_uuid",
     "role": "owner",
     "exp": 1234567890
   }
   ```
8. **Return response:**
   ```typescript
   {
     "token": "eyJhbGc...",
     "user": { user_id, email, name, org_id, role },
     "organization": { org_id, name, display_name, role, created_at }
   }
   ```

**Database Tables Modified:**
- `organizations` → New organization record
- `users` → New user record (org owner)
- `user_organizations` → Junction record (user-org relationship)

**Frontend Implementation:** `repos/metabob-dashboard/src/cloud/pages/CloudLogin/CustomRegister.js`

### Login Flow

**Endpoint:** `POST /auth/login`

**Implementation:** `repos/metabob-rpc-api/server/routes/cloud_auth.py:48`

**Request Schema:**
```typescript
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "org_id": "optional-org-uuid"  // For multi-org users
}
```

**Backend Process:**
1. **Query user** by email (`SELECT * FROM users WHERE email = $email AND is_active = true`)
2. **Verify password** (bcrypt compare with stored hash)
3. **Determine org_id** (use request.org_id or user's primary org)
4. **Generate JWT tokens** (access + refresh)
5. **Store refresh token** in `refresh_tokens` table
6. **Update last_login_at** timestamp
7. **Query organizations** user belongs to (via `user_organizations` junction)
8. **Fetch organization details** for all user's orgs
9. **Return response:**
   ```typescript
   {
     "token": "eyJhbGc...",
     "refresh_token": "refresh_...",
     "user": { user_id, email, name, org_id, role },
     "organizations": [
       { org_id, name, display_name, role, created_at }
     ],
     "expires_in": 3600
   }
   ```

**Frontend Implementation:** `repos/metabob-dashboard/src/cloud/pages/CloudLogin/CustomLogin.js`

**JWT Token Payload:**
```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "org_id": "org_uuid",
  "role": "owner|admin|member",
  "exp": 1234567890,
  "iat": 1234564290
}
```

**Token Storage:**
- **Location:** `localStorage.metabob_cloud_token`
- **Usage:** Sent in `Authorization: Bearer <token>` header
- **Expiration:** 1 hour (3600 seconds)
- **Refresh:** Via `/auth/refresh` endpoint

### Session Validation

**Endpoint:** `GET /auth/session`

**Implementation:** `repos/metabob-rpc-api/server/routes/cloud_auth.py:584`

**Purpose:** Validate current JWT token and return user info

**Response:**
```typescript
{
  "user_id": "user_uuid",
  "email": "user@example.com",
  "org_id": "org_uuid",
  "role": "owner"
}
```

**Frontend Usage:**
- Called on app initialization (CloudApp.js)
- Used to restore authentication state
- Triggers redirect to login if invalid

---

## Organization Management

### List Organizations

**Endpoint:** `GET /auth/orgs`

**Implementation:** `repos/metabob-dashboard/src/cloud/api/OrganizationApi.js:76`

**Authentication:** Required (JWT token)

**Response:**
```typescript
{
  "organizations": [
    {
      "org_id": "uuid",
      "name": "Acme Corp",
      "display_name": "Acme Corp",
      "role": "owner",
      "created_at": "2026-03-11T00:00:00Z"
    }
  ],
  "total": 1
}
```

**Frontend Usage:**
- Called on CloudApp initialization
- Stored in Redux (`organizationsSlice`)
- Used for organization switcher in header

### Get Organization Details

**Endpoint:** `GET /auth/orgs/{org_id}`

**Response:**
```typescript
{
  "org_id": "uuid",
  "name": "Acme Corp",
  "display_name": "Acme Corp",
  "settings": {},
  "metadata": {},
  "created_at": "2026-03-11T00:00:00Z"
}
```

### List Organization Members

**Endpoint:** `GET /auth/orgs/{org_id}/users`

**Implementation:** `repos/metabob-rpc-api/server/routes/cloud_auth.py` (via OrganizationApi)

**Response:**
```typescript
{
  "members": [
    {
      "id": "user_uuid",
      "userId": "user_uuid",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "owner",
      "joinedAt": "2026-03-11T00:00:00Z"
    }
  ],
  "total": 1
}
```

**Frontend Usage:**
- CloudSettings page → Members tab
- Allows viewing/managing organization members

### Invite Organization Member

**Endpoint:** `POST /auth/orgs/{org_id}/users`

**Request:**
```typescript
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "TempPassword123!",
  "role": "member|admin|owner"
}
```

**Frontend Implementation:** CloudSettings → Members tab → "Invite Member" button

---

## Data Flow from CLI to Dashboard

### 1. Activity Execution Flow (CLI → Dashboard)

```
┌──────────────────┐
│  metabob-cli     │
│  (User's laptop) │
└────────┬─────────┘
         │
         │ 1. Execute activity
         │    (opencode activity --template add-feature-complete)
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│  metabob-opencode (Activity Runtime)                       │
│  • Executes activity template                              │
│  • Collects metrics: cost, duration, tokens, success       │
│  • Creates execution record                                │
└────────┬───────────────────────────────────────────────────┘
         │
         │ 2. Store execution
         │    POST /api/activities/executions
         │    (via metabob-cli MCP backend)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Metabob RPC API                                            │
│  Endpoint: POST /api/activities/executions                  │
│  Handler: server/routes/activities.py                       │
└────────┬────────────────────────────────────────────────────┘
         │
         │ 3. Store in SurrealDB
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  SurrealDB → activity_executions table                      │
│  Fields:                                                    │
│    • execution_id                                           │
│    • activity_id                                            │
│    • template_id (e.g., "add-feature-complete")             │
│    • user_id                                                │
│    • org_id    ← CRITICAL: Org isolation                    │
│    • status (success|failed)                                │
│    • start_time                                             │
│    • end_time                                               │
│    • duration_ms                                            │
│    • cost_usd                                               │
│    • tokens_input                                           │
│    • tokens_output                                          │
│    • tokens_cache                                           │
│    • tasks: [                                               │
│        {task_id, status, duration_ms, error}                │
│      ]                                                      │
│    • impulses_used: ["impulse1", "impulse2"]                │
└────────┬────────────────────────────────────────────────────┘
         │
         │ 4. Dashboard queries executions
         │    GET /analytics/executions?org_id=...
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Metabob Dashboard                                          │
│  Page: /cloud/activity (ActivityHistory)                    │
│  Component: repos/metabob-dashboard/src/pages/              │
│             ActivityHistory/ActivityHistory.js              │
│                                                             │
│  Features:                                                  │
│    • Filterable table (template_id, success status)         │
│    • Sortable columns (timestamp, cost, duration)           │
│    • Expandable rows showing:                               │
│      - Task breakdown                                       │
│      - Impulses used                                        │
│      - Error details                                        │
│      - Metrics (cost, duration, tokens)                     │
│    • Pagination                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Organization Activity Feed Flow

```
┌──────────────────┐
│  User Action     │
│  (Dashboard)     │
└────────┬─────────┘
         │
         │ GET /auth/orgs/{org_id}/activity?limit=50
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  RPC API: cloud_auth.py:622                                 │
│  Function: get_organization_activity()                      │
│                                                             │
│  1. Check Redis cache (cache key: org:{org_id}:activity)    │
│     ├─ Cache HIT → Return cached data (<5ms)                │
│     └─ Cache MISS → Query SurrealDB (50-100ms)              │
│                                                             │
│  2. Query activity_executions:                              │
│     SELECT * FROM activity_executions                       │
│     WHERE org_id = $org_id                                  │
│     ORDER BY start_time DESC                                │
│     LIMIT 50                                                │
│                                                             │
│  3. Transform to activity events:                           │
│     - execution → activity event                            │
│     - Add actor attribution (user_id → user name/email)     │
│     - Format for timeline display                           │
│                                                             │
│  4. Cache result in Redis (TTL: 60s)                        │
│                                                             │
│  5. Return JSON response                                    │
└────────┬────────────────────────────────────────────────────┘
         │
         │ Response:
         │ {
         │   "activities": [
         │     {
         │       "id": "activity_execution:abc123",
         │       "type": "analysis_completed",
         │       "actor": {"email": "user@example.com", "name": "John Doe"},
         │       "timestamp": "2026-03-11T12:00:00Z",
         │       "description": "Executed add-feature-complete",
         │       "metadata": {
         │         "activity_id": "act_abc123",
         │         "template_id": "add-feature-complete",
         │         "status": "success",
         │         "duration_ms": 45000,
         │         "cost_usd": 0.022
         │       }
         │     }
         │   ],
         │   "hasMore": false,
         │   "total": 10
         │ }
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Dashboard: CloudDashboard                                  │
│  Component: RecentActivity.js                               │
│                                                             │
│  Renders activity timeline:                                 │
│    • Avatar (user initials)                                 │
│    • Activity description                                   │
│    • Timestamp (relative: "2 hours ago")                    │
│    • Status badge (success/failed)                          │
│    • Metrics (duration, cost)                               │
│                                                             │
│  Auto-refresh: Every 60 seconds                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Project Analysis Flow (CLI → Dashboard)

```
┌──────────────────┐
│  metabob-cli     │
│  analyze project │
└────────┬─────────┘
         │
         │ 1. Analyze code
         │ 2. Submit results
         │    POST /api/projects/{project_id}/analysis
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  RPC API → SurrealDB                                        │
│  Tables:                                                    │
│    • projects → Project metadata                            │
│    • project_analysis → Analysis results                    │
│    • problems → Detected issues                             │
└────────┬────────────────────────────────────────────────────┘
         │
         │ 3. Dashboard queries
         │    GET /api/projects/{project_id}
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Dashboard: ProjectDetail page                              │
│  Features:                                                  │
│    • Statistics (problem counts by severity)                │
│    • Problems list (filterable)                             │
│    • Code viewer with inline annotations                    │
│    • Analysis history timeline                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation Procedures

### Procedure 1: User Registration Validation

**Objective:** Verify users can register, create organizations, and receive JWT tokens

**Prerequisites:**
- RPC API deployed and accessible
- SurrealDB running with correct schema
- Dashboard deployed and accessible

**Steps:**

1. **Navigate to Registration Page**
   ```
   URL: https://dashboard.example.com/cloud/register
   ```

2. **Fill Registration Form**
   ```
   Email: test-user@example.com
   Password: SecureTest123!
   First Name: Test
   Last Name: User
   Organization Name: Test Organization
   ```

3. **Submit Form**
   - Click "Register" button
   - Monitor browser DevTools Network tab

4. **Verify API Request**
   ```
   Request: POST /auth/register
   Payload:
   {
     "email": "test-user@example.com",
     "password": "SecureTest123!",
     "name": "Test User",
     "org_name": "Test Organization"
   }
   ```

5. **Verify API Response (200 OK)**
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "user_id": "550e8400-e29b-41d4-a716-446655440000",
       "email": "test-user@example.com",
       "name": "Test User",
       "org_id": "660e8400-e29b-41d4-a716-446655440000",
       "role": "owner",
       "is_active": true,
       "email_verified": false,
       "created_at": "2026-03-11T12:00:00Z"
     },
     "organization": {
       "org_id": "660e8400-e29b-41d4-a716-446655440000",
       "name": "Test Organization",
       "display_name": "Test Organization",
       "role": "owner",
       "created_at": "2026-03-11T12:00:00Z"
     }
   }
   ```

6. **Verify Redirect**
   - Should redirect to `/cloud/dashboard`
   - JWT token stored in localStorage

7. **Verify Database Records**
   ```sql
   -- Connect to SurrealDB
   USE NS metabob DB integration;
   
   -- Check user record
   SELECT * FROM users WHERE email = "test-user@example.com";
   
   -- Check organization record
   SELECT * FROM organizations WHERE org_id = "660e8400-...";
   
   -- Check user-org junction
   SELECT * FROM user_organizations WHERE user_id = "550e8400-...";
   ```

**Expected Results:**
- ✅ Form submission succeeds
- ✅ API returns 200 with token + user + organization
- ✅ JWT token stored in localStorage
- ✅ Redirect to dashboard occurs
- ✅ Database contains all 3 records (users, organizations, user_organizations)
- ✅ Password is hashed (bcrypt, not plaintext)

**Failure Scenarios:**

| Symptom | Possible Cause | Fix |
|---------|---------------|-----|
| 400 "Email already registered" | Email exists in users table | Use different email |
| 500 Internal Server Error | SurrealDB connection failed | Check SURREALDB_URL env var |
| 401 after redirect | Token not saved | Check tokenManager.js |
| Blank dashboard | Organizations not loaded | Check /auth/orgs endpoint |

### Procedure 2: Login Validation

**Objective:** Verify users can login with existing credentials

**Prerequisites:**
- User registered via Procedure 1

**Steps:**

1. **Navigate to Login Page**
   ```
   URL: https://dashboard.example.com/cloud/login
   ```

2. **Fill Login Form**
   ```
   Email: test-user@example.com
   Password: SecureTest123!
   ```

3. **Submit Form**

4. **Verify API Request**
   ```
   Request: POST /auth/login
   Payload:
   {
     "email": "test-user@example.com",
     "password": "SecureTest123!",
     "org_id": null
   }
   ```

5. **Verify API Response (200 OK)**
   ```json
   {
     "token": "eyJhbGc...",
     "refresh_token": "refresh_...",
     "user": { ... },
     "organizations": [
       { "org_id": "...", "name": "Test Organization", "role": "owner" }
     ],
     "expires_in": 3600
   }
   ```

6. **Verify Dashboard Access**
   - Redirect to `/cloud/dashboard`
   - Organization name displayed in header
   - User can access all protected routes

**Expected Results:**
- ✅ Login succeeds
- ✅ Token stored in localStorage
- ✅ Dashboard shows organization data
- ✅ User role displayed correctly

### Procedure 3: Organization Data Visibility

**Objective:** Verify dashboard displays organization-specific data

**Prerequisites:**
- User logged in

**Steps:**

1. **Navigate to Dashboard**
   ```
   URL: /cloud/dashboard
   ```

2. **Verify Organization Context**
   - Organization name in header: "Test Organization"
   - Organization switcher button visible (if multi-org user)

3. **Check Dashboard Components**
   - [ ] OrganizationStats card displays
   - [ ] ProjectsSummary card displays
   - [ ] RecentActivity timeline displays
   - [ ] TopIssues card displays

4. **Verify API Calls**
   ```
   GET /auth/orgs/{org_id}/stats
   GET /auth/orgs/{org_id}/activity
   GET /api/projects?org_id={org_id}
   ```

5. **Check Network Requests**
   - All requests include `Authorization: Bearer {token}` header
   - All requests filtered by org_id

**Expected Results:**
- ✅ Dashboard loads without errors
- ✅ All API calls include JWT token
- ✅ Data is filtered by organization
- ✅ No data from other organizations visible

### Procedure 4: Activity History Validation (CLI Data)

**Objective:** Verify dashboard displays activity executions from metabob-cli

**Prerequisites:**
- User logged in
- At least one activity executed via metabob-cli

**Steps:**

1. **Execute Activity via CLI**
   ```bash
   cd metabob-cli
   opencode activity \
     --template add-feature-complete \
     --variable featureName="test-feature" \
     --variable files="src/test.js"
   ```

2. **Verify CLI Stores Execution**
   - CLI should POST to `/api/activities/executions`
   - Check CLI output for execution_id

3. **Navigate to Activity History**
   ```
   URL: /cloud/activity
   ```

4. **Verify Table Display**
   - [ ] Activity row appears in table
   - [ ] Columns: Template ID, Status, Start Time, Duration, Cost, Tokens
   - [ ] Expand row shows task breakdown

5. **Check API Request**
   ```
   GET /analytics/executions?org_id={org_id}&limit=50&offset=0
   ```

6. **Verify Response Data**
   ```json
   {
     "executions": [
       {
         "execution_id": "exec_abc123",
         "template_id": "add-feature-complete",
         "status": "success",
         "start_time": "2026-03-11T12:00:00Z",
         "duration_ms": 45000,
         "cost_usd": 0.022,
         "tokens_total": 7500,
         "tasks": [
           {"task_id": "task-1", "status": "success", "duration_ms": 15000}
         ]
       }
     ],
     "total": 1,
     "hasMore": false
   }
   ```

**Expected Results:**
- ✅ CLI execution appears in dashboard
- ✅ All metrics displayed correctly (cost, duration, tokens)
- ✅ Task breakdown visible
- ✅ Data scoped to organization

### Procedure 5: Multi-Tenant Isolation

**Objective:** Verify organization data is properly isolated

**Prerequisites:**
- Two registered users in different organizations

**Steps:**

1. **Create Second User + Org**
   ```
   Email: user2@example.com
   Password: SecureTest456!
   Organization Name: Second Organization
   ```

2. **Execute Activities as User 1**
   ```bash
   # Login as user1@example.com
   opencode activity --template add-feature-complete ...
   ```

3. **Execute Activities as User 2**
   ```bash
   # Login as user2@example.com
   opencode activity --template fix-bug-complete ...
   ```

4. **Verify User 1 Dashboard**
   - Login as user1@example.com
   - Navigate to /cloud/activity
   - Should see ONLY activities from "Test Organization"
   - Should NOT see activities from "Second Organization"

5. **Verify User 2 Dashboard**
   - Login as user2@example.com
   - Navigate to /cloud/activity
   - Should see ONLY activities from "Second Organization"
   - Should NOT see activities from "Test Organization"

6. **Check Database Queries**
   - Monitor RPC API logs
   - Verify all queries include `WHERE org_id = $org_id`

**Expected Results:**
- ✅ User 1 sees only their org's data
- ✅ User 2 sees only their org's data
- ✅ No data leakage between organizations
- ✅ All API queries filtered by org_id

---

## E2E Testing Strategy

### Test Suite Structure

```
repos/metabob-dashboard/tests/e2e/
├── cloud/
│   ├── auth.spec.js          # Login/register/logout tests
│   ├── dashboard.spec.js     # Dashboard component tests
│   ├── fixtures.js           # Test data fixtures
│   └── mockData.js           # Mock API responses
├── local-dashboard.spec.js   # Local mode tests
└── playwright.config.js      # Playwright configuration
```

### Recommended Tests

**Test File:** `repos/metabob-dashboard/tests/e2e/cloud/organization.spec.js` (new)

```javascript
import { test, expect } from '@playwright/test';

test.describe('Organization Management', () => {
  test('should register user and create organization', async ({ page }) => {
    // Navigate to register page
    await page.goto('/cloud/register');
    
    // Fill registration form
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'SecureTest123!');
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="orgName"]', 'Test Org');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/cloud/dashboard');
    
    // Verify organization name in header
    const orgName = await page.textContent('[data-testid="org-name"]');
    expect(orgName).toBe('Test Org');
  });

  test('should display organization activity feed', async ({ page }) => {
    // Login first
    await page.goto('/cloud/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'SecureTest123!');
    await page.click('button[type="submit"]');
    
    // Navigate to dashboard
    await page.waitForURL('/cloud/dashboard');
    
    // Wait for activity feed to load
    await page.waitForSelector('[data-testid="recent-activity"]');
    
    // Verify activity items visible
    const activityItems = await page.locator('[data-testid="activity-item"]').count();
    expect(activityItems).toBeGreaterThan(0);
  });

  test('should filter activity history by template', async ({ page }) => {
    // Login and navigate to activity history
    await page.goto('/cloud/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'SecureTest123!');
    await page.click('button[type="submit"]');
    await page.goto('/cloud/activity');
    
    // Apply filter
    await page.click('[data-testid="filter-button"]');
    await page.fill('[name="template_id"]', 'add-feature-complete');
    await page.click('[data-testid="apply-filter"]');
    
    // Verify filtered results
    const rows = await page.locator('[data-testid="activity-row"]').all();
    for (const row of rows) {
      const templateId = await row.textContent('[data-testid="template-id"]');
      expect(templateId).toBe('add-feature-complete');
    }
  });
});
```

### Running E2E Tests

```bash
cd repos/metabob-dashboard

# Install dependencies
npm install

# Run all tests
npm run test:e2e

# Run specific test file
npm run test:e2e tests/e2e/cloud/organization.spec.js

# Run tests in headed mode (with browser UI)
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug
```

---

## Validation Checklist

### Pre-Deployment Validation

- [ ] **SurrealDB Schema Applied**
  - Tables created: users, organizations, user_organizations, activity_executions
  - Indexes created for performance
  - Credentials configured in Kubernetes secrets

- [ ] **RPC API Deployed**
  - Image tag: 0.16.0+
  - Environment variables set correctly
  - SurrealDB connection working
  - Health check endpoint responding: `GET /`

- [ ] **Dashboard Deployed**
  - Image tag: 2.2.2+
  - REACT_APP_DEPLOYMENT_MODE=cloud
  - API routes accessible via Istio

- [ ] **Istio Gateway Configured**
  - External access configured
  - /auth/* routes to RPC API
  - /api/* routes to RPC API

### Post-Deployment Validation

- [ ] **User Registration Works**
  - Can create new user
  - Organization created automatically
  - JWT token returned
  - Database records created

- [ ] **User Login Works**
  - Can login with valid credentials
  - JWT token returned
  - Organizations list returned
  - Redirect to dashboard

- [ ] **Dashboard Accessible**
  - Can access /cloud/dashboard
  - Organization name displayed
  - Protected routes work
  - API calls succeed

- [ ] **Activity History Works**
  - CLI executions appear in dashboard
  - Filtering works
  - Sorting works
  - Pagination works
  - Task breakdown visible

- [ ] **Organization Isolation Works**
  - Users only see their org's data
  - API queries filtered by org_id
  - No data leakage between orgs

- [ ] **Performance Acceptable**
  - Dashboard loads in <3 seconds
  - API responses in <200ms (with cache)
  - No console errors

---

## Troubleshooting Guide

### Issue: Registration returns 500 error

**Diagnosis:**
```bash
# Check RPC API logs
kubectl logs -n metabob deployment/metabob-rpc-api --tail=100

# Check SurrealDB connection
kubectl exec -n metabob deployment/metabob-rpc-api -- \
  curl http://surrealdb:8000/health
```

**Common Causes:**
1. SurrealDB not accessible
2. Database credentials incorrect
3. Missing database schema

**Fix:**
```bash
# Verify SurrealDB credentials
kubectl get secret -n metabob surrealdb-credentials -o yaml

# Re-apply schema
kubectl apply -f sql/schema.surql
```

### Issue: Login succeeds but dashboard blank

**Diagnosis:**
```javascript
// Open browser DevTools → Console
// Check for errors

// Check localStorage
console.log(localStorage.getItem('metabob_cloud_token'));

// Check API calls
// Network tab → Filter by "orgs"
```

**Common Causes:**
1. Organizations query failing
2. JWT token not stored
3. CORS issues

**Fix:**
```bash
# Check RPC API CORS configuration
# Verify Istio gateway allows cross-origin requests

# Test /auth/orgs endpoint directly
curl -H "Authorization: Bearer <token>" \
  https://api.example.com/auth/orgs
```

### Issue: Activity history empty

**Diagnosis:**
```bash
# Check if executions stored in database
kubectl exec -n metabob deployment/surrealdb -- \
  surreal sql --ns metabob --db integration \
  "SELECT * FROM activity_executions LIMIT 10"

# Check RPC API logs for /analytics/executions calls
kubectl logs -n metabob deployment/metabob-rpc-api | grep executions
```

**Common Causes:**
1. CLI not sending execution data
2. org_id not set in execution records
3. API filtering out all results

**Fix:**
```bash
# Verify CLI configuration
cat ~/.config/metabob-cli/config.json

# Check org_id in executions
SELECT org_id, COUNT() FROM activity_executions GROUP BY org_id;
```

---

## Summary

This guide provides comprehensive validation procedures for:

1. ✅ **User Registration** - Create users + organizations
2. ✅ **Authentication** - Login with JWT tokens
3. ✅ **Organization Management** - View/manage organizations
4. ✅ **Dashboard Data** - View activity history from metabob-cli
5. ✅ **Multi-Tenant Isolation** - Org data separation

**Key Files Reference:**
- Dashboard: `repos/metabob-dashboard/`
- RPC API: `repos/metabob-rpc-api/server/routes/cloud_auth.py`
- Deployment: `repos/platform/metabob-apps/charts/`
- E2E Tests: `repos/metabob-dashboard/tests/e2e/cloud/`

**Next Steps:**
1. Deploy dashboard + RPC API to integration environment
2. Run validation procedures 1-5
3. Execute E2E test suite
4. Verify multi-tenant isolation
5. Load test with multiple users/orgs

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-11  
**Maintained By:** DevBob Team
