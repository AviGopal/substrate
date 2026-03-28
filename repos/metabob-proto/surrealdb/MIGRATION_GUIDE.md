# SurrealDB Migration Guide

This guide covers the migration system for deploying and updating SurrealDB schemas across the Metabob ecosystem.

## Overview

The migration system uses versioned `.surql` files with checksums for idempotent deployment:

```
repos/metabob-proto/surrealdb/
├── core/                    # Core multi-tenant schemas
│   ├── 000-schema-version.surql
│   ├── 001-auth-access.surql
│   ├── 002-organizations.surql
│   ├── 003-projects.surql
│   └── 004-subscriptions.surql
├── lib/
│   └── migrate.ts           # Migration runner
└── MIGRATION_GUIDE.md       # This file
```

## Quick Start

### Prerequisites

```bash
# SurrealDB running locally
surreal start --user root --pass root memory

# Or with file persistence
surreal start --user root --pass root file:data.db
```

### Run Migrations

```bash
cd repos/metabob-proto

# Apply all core schemas
bun run surrealdb/lib/migrate.ts

# Dry run (preview without applying)
bun run surrealdb/lib/migrate.ts --dry-run

# Target specific database
SURREALDB_URL=http://localhost:8000 \
SURREALDB_NAMESPACE=production \
SURREALDB_DATABASE=metabob \
bun run surrealdb/lib/migrate.ts
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SURREALDB_URL` | `http://localhost:8000` | SurrealDB server URL |
| `SURREALDB_NAMESPACE` | `activity-system` | Target namespace |
| `SURREALDB_DATABASE` | `learning_loop` | Target database |
| `SURREALDB_USERNAME` | `root` | Auth username |
| `SURREALDB_PASSWORD` | (required) | Auth password |

## Schema Versioning

### Version Table

The `schema_version` table tracks applied migrations:

```surql
DEFINE TABLE schema_version SCHEMAFULL;

DEFINE FIELD filename ON schema_version TYPE string;
DEFINE FIELD checksum ON schema_version TYPE string;
DEFINE FIELD applied_at ON schema_version TYPE datetime;
DEFINE FIELD duration_ms ON schema_version TYPE number;
```

### Checksum Calculation

Each migration file has a SHA-256 checksum:

```typescript
import { createHash } from 'crypto';

function calculateChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
```

### Idempotency

Migrations are only applied if:
1. Not already in `schema_version` table
2. OR checksum has changed (schema modified)

```typescript
const existing = await db.query(`
  SELECT * FROM schema_version
  WHERE filename = $filename
`, { filename });

if (existing[0]?.checksum === currentChecksum) {
  console.log(`Skipping ${filename} (already applied)`);
  return;
}
```

## Writing Migrations

### Naming Convention

```
NNN-description.surql

Examples:
001-auth-access.surql
002-organizations.surql
010-activity-registry.surql  # Service-specific (higher numbers)
```

### File Order

Core schemas: `000-004` (metabob-proto)
Activity API: `010-019`
Analysis API: `020-029`
Future services: `030+`

### Template

```surql
-- Description of what this migration does
-- Author: name
-- Date: YYYY-MM-DD

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

DEFINE TABLE IF NOT EXISTS my_table SCHEMAFULL
  PERMISSIONS
    FOR select, create, update, delete WHERE org_id = $auth.org_id;

-- ============================================================================
-- FIELDS
-- ============================================================================

DEFINE FIELD IF NOT EXISTS org_id ON my_table TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS name ON my_table TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON my_table TYPE datetime DEFAULT time::now();

-- ============================================================================
-- INDEXES
-- ============================================================================

DEFINE INDEX IF NOT EXISTS idx_my_table_org ON my_table FIELDS org_id;
```

### Best Practices

1. **Always use IF NOT EXISTS**: Makes migrations re-runnable
2. **Include PERMISSIONS**: Every multi-tenant table needs org isolation
3. **Add org_id field**: With ASSERT and VALUE clauses
4. **Create indexes**: On org_id and common query patterns
5. **Comment sections**: Makes files easier to navigate

## Service-Specific Migrations

### Activity API

```bash
cd repos/metabob-activity-api
bun run sql/migrate.ts
```

This applies:
1. Core schemas (from @metabob/proto)
2. Activity-specific schemas (sql/schemas/*.surql)

### Analysis API

```bash
cd repos/metabob-analysis-api
bun run sql/migrate.ts
```

## Dry Run

Preview migrations without applying:

```bash
bun run surrealdb/lib/migrate.ts --dry-run
```

Output:
```
[DRY RUN] Would apply: 001-auth-access.surql (checksum: abc123...)
[DRY RUN] Would apply: 002-organizations.surql (checksum: def456...)
[DRY RUN] Would skip: 003-projects.surql (already applied)
```

## Rollback

### Manual Rollback

SurrealDB doesn't support transactional DDL rollback. To rollback:

1. **Identify the migration to undo**
2. **Write a reverse migration**
3. **Apply the reverse migration**

Example reverse migration:
```surql
-- Rollback: remove new_column from my_table
REMOVE FIELD new_column ON my_table;

-- Update schema_version
DELETE schema_version WHERE filename = '015-add-new-column.surql';
```

### Rollback Script

```bash
# Rollback to specific version
bun run surrealdb/lib/migrate.ts --rollback 002

# This will:
# 1. Show what will be rolled back
# 2. Prompt for confirmation
# 3. Execute reverse migrations in order
```

## Data Migrations

For data changes (not schema), create separate scripts:

```typescript
// sql/migrations/backfill-org-id.ts

const db = await connect();

// Backfill org_id for existing records
await db.query(`
  UPDATE activity_template
  SET org_id = $default_org
  WHERE org_id IS NONE
`, { default_org: 'organizations:metabob_internal' });

console.log('Backfill complete');
```

Run with:
```bash
bun run sql/migrations/backfill-org-id.ts
```

## Deployment Strategies

### Development

Apply directly:
```bash
bun run surrealdb/lib/migrate.ts
```

### Staging

1. Take snapshot of production data
2. Restore to staging
3. Apply migrations
4. Run tests

```bash
# Export production
surreal export --conn $PROD_URL --ns production --db metabob backup.surql

# Import to staging
surreal import --conn $STAGING_URL --ns staging --db metabob backup.surql

# Apply migrations
SURREALDB_URL=$STAGING_URL bun run migrate.ts
```

### Production

1. **Blue-green deployment**
2. Keep old tables during transition
3. Verify health checks
4. Cut over traffic

```bash
# 1. Apply schema to production (additive changes only)
bun run migrate.ts

# 2. Deploy new service version
kubectl rollout restart deployment metabob-activity-api

# 3. Verify health
curl http://api.metabob.local/health

# 4. Remove old tables (after validation period)
# Manual step - verify no traffic to old schema
```

## Troubleshooting

### Migration Failed

```
Error: Migration 003-projects.surql failed: Syntax error
```

1. Check the .surql file for syntax errors
2. Test in SurrealDB shell: `surreal sql --conn ... < file.surql`
3. Fix and re-run (idempotent)

### Checksum Mismatch

```
Warning: 002-organizations.surql checksum changed
```

This means the file was modified after initial deployment:
- If intentional: Delete from `schema_version` and re-apply
- If unintentional: Restore original file

### Connection Failed

```
Error: Cannot connect to SurrealDB at http://localhost:8000
```

1. Check SurrealDB is running: `surreal version`
2. Check URL and credentials
3. Check network/firewall

## API Reference

### migrate.ts

```typescript
import { applyCoreSchemas } from '@metabob/proto/surrealdb';

// Apply core schemas
await applyCoreSchemas({
  url: 'http://localhost:8000',
  namespace: 'production',
  database: 'metabob',
  username: 'root',
  password: 'secret',
  dryRun: false,
});
```

### Functions

| Function | Description |
|----------|-------------|
| `applyCoreSchemas(config)` | Apply all core schemas |
| `applyMigration(db, file)` | Apply single migration file |
| `calculateChecksum(content)` | Get SHA-256 hash of content |
| `getMigrationStatus(db)` | List applied migrations |
| `rollbackTo(db, version)` | Rollback to specific version |
