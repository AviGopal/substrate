#!/usr/bin/env bun

import { Impulse } from "./repos/metabob-opencode/packages/opencode/src/memory/impulse"
import { Storage } from "./repos/metabob-opencode/packages/opencode/src/utils/storage"

const impulseContent = `# Dashboard Data Flow to SurrealDB - Complete Trace

## Specification
The metabob-dashboard (repos/metabob-dashboard) is a React-based cloud dashboard that provides organization, project, and developer productivity insights. It communicates with metabob-rpc-api backend to fetch and display data stored in SurrealDB. The dashboard serves dual purposes:
1. Organization productivity view - current status, upcoming activities, learnings, and metrics organized by project
2. API key and developer management - one-to-one mapping of API keys to developers (human or AI) with breakdown of their work and learnings

## Current State vs Desired State

### FRONTEND (Complete ✅)

**File:** repos/metabob-dashboard/src/cloud/api/OrganizationApi.js:1-310
**Component:** OrganizationApi (RTK Query)
**Current:** Makes HTTP requests to /auth/orgs endpoints expecting organization data, member management, stats, and activity tracking
**Desired:** Successfully fetches organization data from metabob-rpc-api which queries SurrealDB
**Gap:** Backend routes don't exist - all requests will return 404

**File:** repos/metabob-dashboard/src/cloud/api/ProjectApi.js:1-596
**Component:** ProjectApi (RTK Query)
**Current:** Makes HTTP requests to /auth/orgs/:orgId/projects and /api/projects/:projectId/* endpoints for project CRUD, stats, problems, metrics, annotations
**Desired:** Successfully fetches project data, metrics history, problems, and annotations from SurrealDB
**Gap:** Backend routes don't exist - requests will fail

**File:** repos/metabob-dashboard/src/cloud/api/ApiKeyApi.js:1-163
**Component:** ApiKeyApi (RTK Query)
**Current:** Makes HTTP requests to /auth/orgs/:orgId/api-keys for API key CRUD and one-to-one developer mapping
**Desired:** Successfully manages API keys and developer assignments stored in SurrealDB
**Gap:** Backend routes don't exist - API key management unavailable

### BACKEND (Missing ❌)

**File:** repos/metabob-rpc-api/server/app.py:55-84
**Component:** FastAPI Application
**Current:** Registers activity, session, learning_loop, and impulse routers. No organization/project/api-key routes
**Desired:** Includes organization_router, project_router, api_key_router for cloud dashboard endpoints
**Gap:** Need to create repos/metabob-rpc-api/server/routes/organizations.py, projects.py, api_keys.py and register them in app.py

**File:** repos/metabob-rpc-api/server/db/surrealdb_client.py:1-100
**Component:** AsyncSurrealDBClient
**Current:** Provides async query/create/update/delete methods. Currently used for activity templates and metrics
**Desired:** Also handles organization, project, session, developer, api_key tables
**Gap:** Client is ready but needs SurrealDB schema definition

**File:** repos/metabob-rpc-api/server/db/operations/ (missing files)
**Component:** Database Operations Layer
**Current:** Has template_metrics.py and failure_pattern.py for activity data
**Desired:** Includes organization_ops.py, project_ops.py, session_ops.py, api_key_ops.py for CRUD operations
**Gap:** Need to implement database operation modules for each entity type

### UI COMPONENTS (Needs Cloud Mode ⚠️)

**File:** repos/metabob-dashboard/src/pages/Dashboard/Dashboard.js:1-150
**Component:** Dashboard UI Component
**Current:** Renders repository stats from Redux state (local mode data structure)
**Desired:** Renders organization productivity view with projects, current status, upcoming activities, learnings organized by project
**Gap:** Component designed for local mode. Needs cloud mode variant using OrganizationApi and ProjectApi hooks

**File:** repos/metabob-dashboard/src/pages/Settings/Settings.js:1-100
**Component:** Settings UI Component
**Current:** Only handles GitHub OAuth connection
**Desired:** Includes API key management section showing developer mappings and key generation
**Gap:** Missing API key management UI. Needs to integrate ApiKeyApi hooks

## Data Flow Analysis

### Current Flow (Broken)
\`\`\`
UI Component → RTK Query API → HTTP Request → 404 Not Found
\`\`\`

### Desired Flow (Complete End-to-End)
\`\`\`
UI Component (Dashboard.js) 
  → RTK Query Hook (useGetOrganizationsQuery)
  → HTTP Request with Bearer Token
  → FastAPI Route Handler (organizations.py)
  → Auth Middleware (extract org_id from JWT)
  → Database Operations (organization_ops.py)
  → SurrealDB Query (SELECT * FROM organizations WHERE org_id = $org_id)
  → Response Chain Back
  → Redux Cache Update
  → UI Re-render
\`\`\`

## Missing Links

1. **Backend Routes** (/auth/orgs/*, /api/projects/*, /auth/orgs/:orgId/api-keys)
   - organizations.py - CRUD for organizations, member management, stats, activity feed
   - projects.py - CRUD for projects, metrics history, problems, annotations
   - api_keys.py - CRUD for API keys, developer assignments

2. **Database Operations Layer**
   - organization_ops.py - async CRUD with SurrealDB queries
   - project_ops.py - project and session data queries
   - session_ops.py - session tracking and activity execution history
   - api_key_ops.py - API key management and developer mapping

3. **SurrealDB Schema**
   - organizations table (org_id, name, metadata, created_at)
   - projects table (project_id, org_id, name, settings, stats)
   - sessions table (session_id, project_id, user_id, start_time, end_time)
   - developers table (user_id, name, email, org_id)
   - api_keys table (key_id, user_id, org_id, scopes, is_active)

4. **Cloud-Mode UI Components**
   - OrganizationDashboard.js - multi-project view
   - ProjectView.js - single project drill-down
   - ApiKeyManagement.js - key generation and developer assignment

## Architecture Insights

**Frontend:** Complete API layer exists using RTK Query with proper endpoint definitions, authentication headers, response transformations, and cache invalidation. Ready to use once backend exists.

**Backend:** Activity template system is implemented with SurrealDB but organization/project/developer management is completely missing. Need to extend existing patterns to new domain entities.

**Database:** SurrealDB client is ready (AsyncSurrealDBClient with proper async/await, connection pooling, and parameter binding). Just needs schema definition and operation functions.

**Authentication:** Frontend prepares JWT Bearer tokens and X-API-Key headers. Backend needs to validate these and extract org_id, user_id for multi-tenant query filtering.

## Implementation Priority

1. **Priority 1:** Define SurrealDB schema for organizations, projects, sessions, developers, api_keys
   - Reason: Foundation for all other work - defines data structure
   - Files: sql/migrations/006-dashboard-tables.surql

2. **Priority 2:** Implement database operations layer
   - Reason: Provides async CRUD functions for routes to call
   - Files: server/db/operations/organization_ops.py, project_ops.py, session_ops.py, api_key_ops.py

3. **Priority 3:** Create backend route handlers
   - Reason: Connects frontend API calls to database operations
   - Files: server/routes/organizations.py, projects.py, api_keys.py
   - Register in: server/app.py

4. **Priority 4:** Update Dashboard UI for cloud mode
   - Reason: UI changes can only happen after backend endpoints exist
   - Files: src/pages/Dashboard/CloudDashboard.js

5. **Priority 5:** Add API key management to Settings page
   - Reason: Final feature after all infrastructure is in place
   - Files: src/pages/Settings/ApiKeyManagement.js

## Summary

**What exists:** Frontend API layer (complete), SurrealDB client (ready), Activity template patterns (reference implementation)

**What's missing:** Backend routes, database operations, SurrealDB schema, cloud-mode UI components

**Blocker:** Backend implementation is blocking entire dashboard feature. Frontend is waiting for endpoints to exist.

**Next Step:** Start with Priority 1 (SurrealDB schema) to establish data foundation.
`;

async function createImpulse() {
  const storage = new Storage();

  const impulse = new Impulse({
    id: "trace-dashboard-data-flow-to-surrealdb",
    type: "memo",
    pointer: {
      type: "memo",
      content: impulseContent,
      source: "trace-data-flow-single-feature activity"
    },
    budget: 5000,
    metadata: {
      specification: "dashboard-data-flow-to-surrealdb",
      purpose: "Document current vs desired state for dashboard data flow implementation",
      createdBy: "trace-data-flow-single-feature",
      componentCount: 8,
      gapCount: 8,
      implementationPriorities: 5
    }
  });

  await storage.saveImpulse(impulse);
  console.log("✅ Trace impulse created successfully");
  console.log(`   ID: ${impulse.id}`);
  console.log(`   Type: ${impulse.type}`);
  console.log(`   Budget: ${impulse.budget} tokens`);
  console.log(`   Components traced: 8`);
  console.log(`   Implementation priorities: 5`);
  console.log(`\nImpulse saved to: ${storage.getImpulsePath(impulse.id)}`);
}

createImpulse().catch(console.error);
