# SurrealDB Multi-Tenant Schema System

This directory contains the core multi-tenant schemas and migration tooling for the Metabob ecosystem using SurrealDB 3.0 RBAC.

## Overview

The schema system implements:

- **Database-enforced multi-tenancy** using SurrealDB 3.0 RBAC with `org_id`/`project_id` isolation
- **Dual authentication**: JWT (external users) and RECORD (MiniBob instances)
- **Table-level permissions** for automatic row-level filtering
- **Versioned migrations** with checksum validation and rollback support
- **Idempotent deployment** - safe to run multiple times

## Directory Structure

```
surrealdb/
├── core/                       # Core multi-tenant schema files
│   ├── 000-schema-version.surql    # Migration tracking table
│   ├── 001-auth-access.surql       # JWT and RECORD authentication
│   ├── 002-organizations.surql     # Organizations, users, api_keys, minibob_instance
│   ├── 003-projects.surql          # Projects and project_members
│   └── 004-subscriptions.surql     # Subscriptions and audit_logs
├── lib/                        # Migration runner utilities
│   ├── migrate.ts                  # Main migration runner
│   └── migrate.test.ts             # Unit tests
└── README.md                   # This file
```

## Core Tables

### Authentication & Access

- **schema_version**: Tracks applied migrations with checksums
- **JWT access** (`jwt_external`): 15m tokens, 12h sessions for external users
- **RECORD access** (`minibob_record`): 24h tokens, 7d sessions for MiniBob instances

### Organizations

- **organizations**: Org-level metadata (name, Stripe customer ID, seat limits)
- **users**: Org members with email, password_hash, role (admin/member)
- **api_keys**: API key credentials with scopes and expiration
- **minibob_instance**: MiniBob vessel instances with org/project scoping

### Projects

- **projects**: Code repositories within organizations
- **project_members**: User membership in projects (owner/maintainer/developer/viewer)

### Billing & Auditing

- **subscriptions**: Stripe subscription tracking (plan, status, billing period)
- **audit_logs**: Immutable security event logs (login, create, update, delete, etc.)

## RBAC Permissions Model

All tables enforce organization-level isolation using PERMISSIONS clauses:

```sql
PERMISSIONS
  FOR select WHERE org_id = $auth.org_id
  FOR create, update WHERE $auth.role = 'admin' AND org_id = $auth.org_id
  FOR delete NONE;
```

### JWT Claims Structure

```json
{
  "iss": "https://metabob.com",
  "sub": "user:alice",
  "org_id": "organization:acme",
  "project_ids": ["project:backend", "project:frontend"],
  "role": "admin",
  "user_id": "user:alice",
  "exp": 1234567890,
  "iat": 1234567890
}
```

### MiniBob RECORD Authentication

MiniBob instances authenticate using:
- `instance_id`: Unique instance identifier
- `api_key`: Hashed with argon2 in `minibob_instance.api_key_hash`
- Scoped to single org/project (cannot access other projects)

## Migration Runner Usage

### Environment Variables

```bash
export SURREALDB_URL="http://localhost:8000"
export SURREALDB_NAMESPACE="production"
export SURREALDB_DATABASE="metabob"
export SURREALDB_USERNAME="root"
export SURREALDB_PASSWORD="your-secure-password"
```

### Apply Migrations

```bash
# Apply all pending migrations
cd repos/metabob-proto
bun run migrate

# Dry-run mode (preview changes without applying)
bun run migrate:dry-run

# Verbose output
bun run surrealdb/lib/migrate.ts --verbose

# Apply to specific namespace/database
SURREALDB_NAMESPACE=staging bun run migrate
```

### Rollback Migrations

```bash
# Rollback to version 002 (removes 003, 004 records)
bun run migrate:rollback 002

# Dry-run rollback
bun run surrealdb/lib/migrate.ts --dry-run --rollback 002
```

**⚠️ Warning**: Rollback removes migration records from `schema_version` but does NOT undo schema changes. You must manually drop/alter tables if needed.

### Programmatic Usage

```typescript
import { applyCoreSchemas, createDbConnection } from '@metabob/proto/surrealdb';

// Create connection
const db = await createDbConnection();

// Apply migrations
await applyCoreSchemas(db, {
  dryRun: false,
  verbose: true
});

// Close connection
await db.close();
```

### From Other Services

```typescript
// repos/metabob-activity-api/sql/migrate.ts
import { applyCoreSchemas } from '@metabob/proto/surrealdb';
import Surreal from 'surrealdb.js';

async function migrate() {
  const db = new Surreal();
  await db.connect(process.env.SURREALDB_URL);
  await db.signin({ username: 'root', password: process.env.SURREALDB_PASSWORD });
  await db.use({ namespace: 'production', database: 'metabob' });

  // Apply core schemas first
  await applyCoreSchemas(db);

  // Then apply service-specific schemas
  await applyActivitySchemas(db);

  await db.close();
}
```

## Migration Features

### Idempotency

Migrations are idempotent and can be safely run multiple times:

- Already applied migrations are skipped
- Checksums validated to detect file modifications
- Safe to deploy in CI/CD pipelines

### Checksum Validation

Each migration file has a SHA256 checksum stored in `schema_version`:

- Prevents accidental modification of applied migrations
- Throws error if migration file changes after being applied
- Ensures consistency across environments

### Version Tracking

The `schema_version` table tracks:

- `version`: Migration version (e.g., "001", "002")
- `name`: Migration name (e.g., "auth_access")
- `checksum`: SHA256 hash of file content
- `applied_at`: Timestamp of application
- `migration_type`: "core", "activity", or "analysis"

### Dry-Run Mode

Preview migrations without applying:

```bash
bun run migrate:dry-run
```

Shows:
- Which migrations will be applied
- Content of each migration file
- Checksums and metadata

### Rollback Support

Rollback to a specific version:

```bash
bun run surrealdb/lib/migrate.ts --rollback 002
```

Removes migration records for versions > 002, but does NOT execute SQL to undo changes.

## Testing

Run unit tests with Bun:

```bash
cd repos/metabob-proto
bun test surrealdb/lib/migrate.test.ts
```

Tests cover:
- Checksum calculation
- Migration file loading
- Database operations (record, retrieve, remove)
- Idempotency
- Dry-run mode
- Checksum mismatch detection

## Deployment

### Local Development

```bash
# Start SurrealDB locally
docker run -d -p 8000:8000 \
  surrealdb/surrealdb:3.0 start \
  --user root --pass surrealdb-local-dev-123

# Apply migrations
export SURREALDB_PASSWORD="surrealdb-local-dev-123"
bun run migrate
```

### Kubernetes (Helm)

Migrations run as Helm pre-install/pre-upgrade hooks:

```yaml
# helm/charts/metabob-migrations/templates/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "metabob-migrations.fullname" . }}
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation
spec:
  template:
    spec:
      containers:
      - name: migrate
        image: metabob-migrations:latest
        command: ["bun", "run", "migrate"]
        env:
        - name: SURREALDB_URL
          value: "http://surrealdb.production.svc.cluster.local:8000"
        - name: SURREALDB_NAMESPACE
          value: "production"
        - name: SURREALDB_DATABASE
          value: "metabob"
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
      restartPolicy: Never
```

### CI/CD Integration

```bash
#!/bin/bash
# .github/workflows/deploy.yml

# Run migrations in staging first
SURREALDB_NAMESPACE=staging bun run migrate

# Run integration tests
bun test

# Deploy to production if tests pass
SURREALDB_NAMESPACE=production bun run migrate
```

## Schema Ownership

- **Core schemas** (`metabob-proto/surrealdb/core/`): Organizations, users, projects, auth
  - Shared across all services
  - Owned by platform team

- **Activity schemas** (`metabob-activity-api/sql/schemas/`): Activity execution data
  - Owned by activity-api service
  - Imports core schemas

- **Analysis schemas** (`metabob-analysis-api/sql/schemas/`): Code analysis data
  - Owned by analysis-api service
  - Imports core schemas

## Troubleshooting

### Checksum Mismatch Error

```
Error: Checksum mismatch for migration 001!
  Expected: abc123...
  Actual:   def456...
```

**Cause**: Migration file was modified after being applied.

**Solution**: Never modify applied migration files. Create a new migration instead.

### Connection Refused

```
Error: Connection refused at localhost:8000
```

**Cause**: SurrealDB is not running or wrong URL.

**Solution**: Verify SurrealDB is running and `SURREALDB_URL` is correct.

### Authentication Failed

```
Error: Authentication failed
```

**Cause**: Incorrect username/password.

**Solution**: Verify `SURREALDB_USERNAME` and `SURREALDB_PASSWORD` are correct.

### No Migrations Found

```
Found 0 migration file(s)
```

**Cause**: Running from wrong directory or core/ directory is empty.

**Solution**: Run from `repos/metabob-proto/` or verify files exist in `surrealdb/core/`.

## Best Practices

1. **Never modify applied migrations** - Create new migration files instead
2. **Test in staging first** - Use staging namespace before production
3. **Use dry-run mode** - Preview changes before applying
4. **Keep migrations small** - One logical change per file
5. **Document breaking changes** - Add comments explaining schema changes
6. **Version bump** - Increment package version when adding new migrations

## Next Steps

See the main implementation plan:
- [Design Document](../../../openspec/changes/surrealdb-multi-tenant-schema/design.md)
- [Tasks](../../../openspec/changes/surrealdb-multi-tenant-schema/tasks.md)

Phase 2: Migrate Activity API schemas
Phase 3: Create Analysis API schemas
Phase 4: Add MiniBob RECORD authentication
Phase 5: Deployment activities
