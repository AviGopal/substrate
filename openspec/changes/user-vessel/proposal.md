## Why

The cloud dashboard requires user/organization/API key management but calling a missing `metabob-analysis-api` service causes 500 errors. Creating a dedicated user-vessel follows the architectural foundation: resolvers live where data lives, vessels own domains, and services communicate via MCP. This enables proper RBAC enforcement, multi-tenant isolation, and aligned vessel-to-vessel communication patterns.

## What Changes

- Create `repos/user-vessel` service (Bun/Hono/SurrealDB) following concept-db pattern
- Implement HTTP API for cloud-dashboard integration (internal network only)
- Implement MCP tools for vessel-to-vessel communication
- Add SurrealDB schema with RBAC PERMISSIONS enforcement
- Deploy as internal-only service in activity-system namespace
- Update cloud-dashboard backend to proxy `/api/v2/*` to user-vessel instead of missing analysis-api

## Capabilities

### New Capabilities

- `organization-management`: CRUD operations for organizations with seat limits and subscription tiers
- `member-management`: Invite/list/remove members with role-based access (owner/admin/member/viewer)
- `api-key-management`: Create/revoke/list API keys with tier-based quotas and connection limits
- `seat-allocation`: Distribute connection quota across API keys, enforce seat limits
- `user-vessel-mcp`: MCP tools for vessels to query user context, check quotas, record connections

### Modified Capabilities

<!-- No existing capabilities modified - this is net-new vessel -->

## Impact

**New Code:**
- `repos/user-vessel/` - ~1500 LOC vessel implementation
- `helm/charts/user-vessel/` - Helm deployment chart
- `repos/user-vessel/sql/` - SurrealDB schema with RBAC PERMISSIONS

**Modified Code:**
- `repos/metabob-cloud-dashboard/src/index.ts` - Update `/api/v2/*` proxy target from analysis-api to user-vessel
- `repos/metabob-cloud-dashboard/src/pages/` - Remove broken pages (Projects, Issues, Events, Analysis, Value)
- `repos/metabob-cloud-dashboard/src/components/Sidebar.tsx` - Update navigation items

**Deployment:**
- New Kubernetes service: `user-vessel.activity-system.svc.cluster.local:8080` (ClusterIP - internal only)
- No public ingress - accessible only within cluster

**Dependencies:**
- SurrealDB (existing)
- identity-vessel (for JWT validation)
- No external dependencies
