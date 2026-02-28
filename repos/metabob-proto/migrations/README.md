# Database Migrations

This directory contains versioned database migrations for SurrealDB.

## Directory Structure

```
migrations/
├── versions/           # Versioned migration files
│   ├── 000_schema_version.sql
│   ├── 001_initial_schema.sql
│   ├── 002_add_failure_patterns.sql
│   └── ...
├── schema.surql       # Generated schema from proto (reference)
├── version.txt        # Current migration version
└── README.md          # This file
```

## Migration Naming Convention

Migrations follow the format: `NNN_description.sql`

- `NNN`: Zero-padded 3-digit version number (000, 001, 002, ...)
- `description`: Snake_case description of the change
- `.sql`: SurrealQL file extension

## Migration File Structure

Each migration file should include:

```sql
-- Migration: NNN
-- Description: Brief description of changes
-- Author: Your name
-- Date: YYYY-MM-DD
-- Depends: Previous migration number (or "None" for first)

USE NS metabob DB devbob;

-- Your schema changes here
DEFINE TABLE ...;
DEFINE FIELD ...;
DEFINE INDEX ...;

-- Record migration
INSERT INTO schema_version (version, applied_by, description, migration_file)
VALUES (NNN, 'migration-runner', 'Description', 'NNN_description.sql');
```

## Creating a New Migration

1. **Determine next version number**:
   ```bash
   ls migrations/versions/ | tail -1  # Check last migration
   ```

2. **Create migration file**:
   ```bash
   vi migrations/versions/003_add_new_feature.sql
   ```

3. **Write migration SQL** following the structure above

4. **Test locally**:
   ```bash
   python scripts/migrate.py --dry-run --target-version 3
   ```

5. **Apply migration**:
   ```bash
   python scripts/migrate.py --apply --target-version 3
   ```

## Generating Schema from Proto

The base schema is generated from proto definitions:

```bash
# Generate full schema from all proto files
python scripts/generate_surreal_schema.py --output migrations/schema.surql

# Apply generated schema directly
python scripts/generate_surreal_schema.py --apply \
  --surreal-url http://localhost:8000 \
  --namespace metabob \
  --database devbob
```

## Migration Runner

Use `scripts/migrate.py` to apply migrations:

```bash
# Check current version
python scripts/migrate.py --status

# Apply all pending migrations
python scripts/migrate.py --apply

# Apply up to specific version
python scripts/migrate.py --apply --target-version 5

# Rollback to specific version
python scripts/migrate.py --rollback --target-version 3

# Dry run (show SQL without executing)
python scripts/migrate.py --dry-run --target-version 5

# Validate current schema
python scripts/migrate.py --validate
```

## Kubernetes Deployment

Migrations are applied automatically during Helm deployment via a Job:

```yaml
# helm/charts/metabob-migrations/templates/job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: metabob-migrations-{{ .Chart.Version }}
  annotations:
    helm.sh/hook: pre-install,pre-upgrade
    helm.sh/hook-weight: "1"
```

The Job:
1. Reads migrations from ConfigMap
2. Checks current schema version
3. Applies pending migrations in order
4. Validates schema after application
5. Fails deployment if migration fails

## Best Practices

### DO ✅
- Always increment version numbers sequentially
- Include descriptive migration names
- Test migrations locally before committing
- Add comments explaining complex changes
- Record migration in schema_version table
- Make migrations idempotent where possible (use IF NOT EXISTS)
- Keep migrations focused (one logical change per migration)

### DON'T ❌
- Skip version numbers
- Modify existing migration files after deployment
- Mix schema and data changes in one migration
- Forget to update schema_version table
- Deploy without testing locally first

## Rollback Strategy

### Safe Rollbacks
Rollbacks work for DDL changes (adding tables, fields, indexes):
- Remove added tables: `DELETE FROM table_name;`
- Remove added fields: SQL doesn't support, but safe to leave
- Remove added indexes: `REMOVE INDEX index_name ON table;`

### Unsafe Rollbacks
Data migrations may not be reversible:
- Deleted data cannot be recovered
- Modified data may lose information
- Consider keeping backup before data migrations

### Rollback Process
1. Identify target version: `python scripts/migrate.py --status`
2. Test rollback locally: `python scripts/migrate.py --rollback --target-version N --dry-run`
3. Apply rollback: `python scripts/migrate.py --rollback --target-version N`
4. Validate schema: `python scripts/migrate.py --validate`

## Schema Version Table

The `schema_version` table tracks applied migrations:

```sql
CREATE schema_version SET
  version = 1,
  applied_at = time::now(),
  applied_by = 'migration-runner',
  description = 'Initial schema',
  migration_file = '001_initial_schema.sql',
  checksum = 'abc123def456'  -- Optional: SHA256 of migration file
;
```

Query current version:
```sql
USE NS metabob DB devbob;
SELECT * FROM schema_version ORDER BY version DESC LIMIT 1;
```

## Integration with Proto

Schema changes should be reflected in proto definitions:

1. Update proto message in `proto/metabob/<domain>/<message>.proto`
2. Regenerate schema: `python scripts/generate_surreal_schema.py`
3. Create migration from diff: Compare generated schema with current
4. Test migration locally
5. Deploy to staging → production

## Troubleshooting

### Migration Failed
1. Check logs: `kubectl logs -n metabob <migration-job-pod>`
2. Check schema version: Query `schema_version` table
3. Fix migration file
4. Re-run: `helmfile sync` will retry

### Schema Drift Detected
1. Compare current schema with migrations:
   ```bash
   python scripts/migrate.py --validate --fix-drift
   ```
2. If unfixable, create corrective migration

### Manual Schema Change Required
1. Never modify database directly in production
2. Always create migration file
3. Test in staging first
4. Apply via migration runner

## Related Documentation

- [Migration Architecture Plan](../../MIGRATION_ARCHITECTURE_PLAN.md)
- [Deployment Architecture](../../DEPLOYMENT_ARCHITECTURE_SUMMARY.md)
- [Proto Schema Generator](../scripts/generate_surreal_schema.py)
