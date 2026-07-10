# Schema Ownership

This document defines which service owns which tables and the boundaries for data access.

## Ownership Principles

1. **Single Owner**: Each table has exactly one owning service
2. **Read Access**: Services may read from tables they don't own (via APIs preferred)
3. **Write Access**: Only the owner can write to a table
4. **Migrations**: Owner is responsible for schema migrations
5. **PERMISSIONS**: Owner defines PERMISSIONS clauses

## Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SCHEMA OWNERSHIP                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                         metabob-proto (Core)                              │
│  Owner: Shared (managed by metabob-proto migrations)                      │
├───────────────────────────────────────────────────────────────────────────┤
│  organizations    │ users          │ api_keys       │ projects           │
│  project_members  │ subscriptions  │ audit_logs     │ minibob_instance   │
│  schema_version   │                │                │                    │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ metabob-activity-api │ │  analysis-vessel     │ │  metabob-mcp         │
│                      │ │ (fka analysis-api)   │ │  (No owned tables)   │
├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤
│ activity_template    │ │ analysis_problems    │ │ Reads from:          │
│ activity_execution   │ │ code_components      │ │ - activity_template  │
│   _traces            │ │ cochange_patterns    │ │ - analysis_problems  │
│ composition_graph    │ │ impact_relations     │ │ - code_components    │
│ goal_execution_paths │ │ design_patterns      │ │                      │
│ impulse_data         │ │ annotations          │ │ Writes via API only  │
│ tool_usage           │ │ progressive_sync     │ │                      │
│ variant_performance  │ │   _state             │ │                      │
│ dataflows            │ │                      │ │                      │
│ execution_sequences  │ │                      │ │                      │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

## Core Tables (metabob-proto)

These tables are shared infrastructure, managed by metabob-proto migrations.

| Table | Description | Readers | Writers |
|-------|-------------|---------|---------|
| `organizations` | Tenant containers | All services | Dashboard, Admin |
| `users` | User accounts | All services | Dashboard, Admin |
| `api_keys` | API credentials | activity-api, mcp | Dashboard |
| `projects` | Project divisions | All services | Dashboard |
| `project_members` | Project membership | All services | Dashboard |
| `subscriptions` | Billing/features | All services | Billing service |
| `audit_logs` | Security audit | Admin only | All services (append) |
| `minibob_instance` | Vessel instances | activity-api, MiniBob | Admin |
| `schema_version` | Migration tracking | migrate.ts | migrate.ts |

## Activity API Tables

Owned by `metabob-activity-api`. Manages activity definitions, execution traces, and learning data.

| Table | Description | Readers | Writers |
|-------|-------------|---------|---------|
| `activity_template` | Activity definitions | mcp, dashboard, minibob | activity-api |
| `activity_execution_traces` | Execution history | dashboard, minibob | activity-api |
| `composition_graph` | Activity relationships | activity-api | activity-api |
| `goal_execution_paths` | Goal→activity mappings | activity-api | activity-api |
| `impulse_data` | Context data | minibob | activity-api |
| `tool_usage` | Tool call patterns | dashboard | activity-api |
| `variant_performance_metrics` | Template performance | activity-api | activity-api |
| `dataflows` | Data flow patterns | activity-api | activity-api |
| `execution_sequences` | Ordered executions | activity-api | activity-api |

## Analysis Vessel Tables

Owned by `analysis-vessel` (formerly `metabob-analysis-api`). Manages code analysis results and patterns.

| Table | Description | Readers | Writers |
|-------|-------------|---------|---------|
| `analysis_problems` | Detected issues | mcp, dashboard | analysis-vessel |
| `code_components` | Code structure | mcp, dashboard | analysis-vessel |
| `cochange_patterns` | Co-change relations | analysis-vessel | analysis-vessel |
| `impact_relations` | Change impact graph | analysis-vessel | analysis-vessel |
| `design_patterns` | Pattern detection | analysis-vessel | analysis-vessel |
| `annotations` | Human annotations | mcp, dashboard | analysis-vessel |
| `progressive_sync_state` | Sync progress | analysis-vessel | analysis-vessel |

## Cross-Service Data Access

### Preferred: API Access

Services should access other services' data via APIs, not direct DB queries:

```typescript
// metabob-mcp reading from activity-api
const templates = await fetch('http://activity-api/v2/activities/templates', {
  headers: { Authorization: `Bearer ${jwt}` }
}).then(r => r.json());
```

Benefits:
- Owner controls access logic
- PERMISSIONS enforced consistently
- API versioning protects consumers
- Easier to monitor/rate-limit

### Exception: Read-Only Shared Access

For performance-critical reads, direct DB access is allowed with restrictions:

```typescript
// Direct read (with same JWT, same PERMISSIONS)
const templates = await db.query(`
  SELECT * FROM activity_template
  WHERE scope = 'global' AND public = true
`);
```

Rules:
- Only SELECT operations
- Same JWT authentication
- Same PERMISSIONS enforcement
- No schema assumptions (use API types)

## Migration Responsibilities

### Core Schema (metabob-proto)

```bash
cd repos/metabob-proto
bun run surrealdb/lib/migrate.ts
```

Applies:
- `core/001-auth-access.surql`
- `core/002-organizations.surql`
- `core/003-projects.surql`
- `core/004-subscriptions.surql`

### Activity API Schema

```bash
cd repos/activity-api
bun run sql/migrate.ts
```

Applies core schemas first, then:
- `schemas/010-activity-registry.surql`
- `schemas/011-executions.surql`
- `schemas/012-composition.surql`
- `schemas/013-impulse-tool-usage.surql`

### Analysis Vessel Schema

```bash
cd repos/analysis-vessel
bun run sql/migrate.ts
```

Applies core schemas first, then:
- `schemas/020-analysis-problems.surql`
- `schemas/021-patterns.surql`
- `schemas/022-annotations.surql`

## Adding New Tables

1. **Decide owner**: Which service is responsible?
2. **Create schema file**: In owner's `sql/schemas/` directory
3. **Add PERMISSIONS**: Always include org_id isolation
4. **Create indexes**: On org_id and query patterns
5. **Update migrate.ts**: Add new schema file
6. **Document**: Update this file

Example:
```surql
-- In repos/activity-api/sql/schemas/014-new-feature.surql

DEFINE TABLE new_feature SCHEMAFULL
  PERMISSIONS
    FOR select, create, update, delete WHERE org_id = $token.org_id;

DEFINE FIELD org_id ON new_feature TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $token.org_id;

DEFINE FIELD name ON new_feature TYPE string;
DEFINE FIELD created_at ON new_feature TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_new_feature_org ON new_feature FIELDS org_id;
```

## Forbidden Patterns

### Cross-Service Writes

```typescript
// BAD: analysis-api writing to activity_template
await db.query(`INSERT INTO activity_template ...`);

// GOOD: Use API
await fetch('http://activity-api/v2/activities/templates', {
  method: 'POST',
  body: JSON.stringify(template)
});
```

### Schema Assumptions

```typescript
// BAD: Assuming schema structure
await db.query(`SELECT category FROM activity_template`);
// What if activity-api renames this field?

// GOOD: Use typed API response
const templates = await activityApi.getTemplates();
templates.map(t => t.category);  // Type-safe
```

### Bypassing PERMISSIONS

```typescript
// BAD: Using root credentials to bypass PERMISSIONS
const db = new Surreal();
await db.signin({ username: 'root', password: '...' });
await db.query(`SELECT * FROM activity_template`);  // Sees all orgs!

// GOOD: Use authenticated client
const db = await createAuthenticatedClient(jwt);
await db.query(`SELECT * FROM activity_template`);  // PERMISSIONS enforced
```
