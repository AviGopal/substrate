## Why

The current SurrealDB schema architecture is fragmented across repositories (`metabob-proto`, `metabob-activity-api`, `metabob-analysis-api`) with no unified multi-tenancy model, no RBAC enforcement, and no coordinated migration strategy. This creates security risks (application-level isolation only), operational complexity (manual schema synchronization), and blocks the cloud dashboard SaaS deployment (no org/user/billing tables). We need a unified, database-enforced multi-tenant schema architecture leveraging SurrealDB 3.0 RBAC to enable secure, scalable SaaS operations.

## What Changes

- **Centralize core multi-tenant schemas** in `metabob-proto/surrealdb/` for organizations, users, API keys, projects, subscriptions, and audit logs
- **Implement SurrealDB 3.0 RBAC** with `DEFINE ACCESS` (JWT + RECORD auth) and table-level `PERMISSIONS` for database-enforced isolation
- **Standardize table-level tenancy** using `org_id`/`project_id` fields with indexed filtering across all services
- **Create federated migration system** where each service owns its schemas but imports core multi-tenant schemas
- **Add deployment activities** for stack deploy/rollback/upgrade operations as measured MiniBob activities
- **Define schema ownership boundaries** between activity-api (activity execution data) and analysis-api (code analysis + auth/billing)
- **Establish public template marketplace** with scope-aware permissions (global/org/project) for activity templates

## Capabilities

### New Capabilities

- `multi-tenant-rbac`: SurrealDB 3.0 RBAC with JWT/RECORD authentication, table-level permissions, and org_id/project_id isolation
- `core-schemas`: Shared multi-tenant schemas (organizations, users, api_keys, projects, subscriptions, audit_logs) owned by metabob-proto
- `activity-schemas`: Activity execution schemas (activity_registry, execution_traces, composition_graph, dataflows) owned by activity-api
- `analysis-schemas`: Code analysis schemas (analysis_problems, code_components, annotations, cochange_patterns) owned by analysis-api
- `migration-system`: Coordinated migration tooling with Bun scripts for core, activity, and analysis schema deployment
- `stack-deployment-activities`: MiniBob activities for deploy-from-scratch, rollback, and upgrade operations with validation

### Modified Capabilities

- `activity-template-storage`: Add scope-aware permissions (global/org/project) and public marketplace support to existing activity_template table
- `execution-trace-storage`: Add org_id/project_id fields and RBAC permissions to existing execution trace tables

## Impact

**Code Changes:**
- `repos/metabob-proto/`: Overhaul from protobuf-only to SurrealDB schema definitions + migration tooling
- `repos/metabob-activity-api/`: Migrate existing sql/ files to new structure, add RBAC PERMISSIONS to all tables
- `repos/metabob-analysis-api/`: Create initial schema files with auth/billing tables, add RBAC
- `repos/metabob-cloud-dashboard/`: Unblocked - can now integrate with complete auth/org/billing backend
- `repos/minibob/`: Add RECORD-based authentication for autonomous vessel instances

**API Changes:**
- All services: Add JWT validation middleware using SurrealDB 3.0 ACCESS definitions
- analysis-api: New endpoints for org/user/project/subscription management
- activity-api: New scope filtering on activity template queries

**Deployment:**
- Helm charts: Add migration jobs (pre-install/pre-upgrade hooks) for coordinated schema deployment
- SurrealDB config: Switch from anonymous access to enforced authentication
- Environment variables: Add JWT signing keys, JWKS URLs

**Dependencies:**
- SurrealDB 3.0+ required (for DEFINE ACCESS and PERMISSIONS syntax)
- New dependency: `surrealdb-migrations` (Rust CLI) or custom Bun migration runner
- `metabob-proto` becomes required dependency for activity-api and analysis-api (for core schema imports)

**Breaking Changes:**
- **BREAKING**: Existing activity-api deployments require data migration to add org_id/project_id fields
- **BREAKING**: All API endpoints require authentication (no more anonymous access)
- **BREAKING**: SurrealDB connection strings must include namespace/database in environment config
