# Quick Start: SurrealDB Multi-Tenant Schema Migration

## Installation

```bash
cd repos/metabob-proto
bun install
```

## Environment Setup

Create a `.env` file or export variables:

```bash
export SURREALDB_URL="http://localhost:8000"
export SURREALDB_NAMESPACE="production"
export SURREALDB_DATABASE="metabob"
export SURREALDB_USERNAME="root"
export SURREALDB_PASSWORD="your-secure-password"
```

## Common Operations

### Apply Migrations

```bash
# Apply all pending migrations
bun run migrate

# Dry-run first to preview changes
bun run migrate:dry-run

# Verbose output
bun run surrealdb/lib/migrate.ts --verbose
```

### Check Status

```bash
# See which migrations are applied
bun -e "
import { Surreal } from 'surrealdb';
const db = new Surreal();
await db.connect(process.env.SURREALDB_URL);
await db.signin({ username: 'root', password: process.env.SURREALDB_PASSWORD });
await db.use({ namespace: 'production', database: 'metabob' });
const result = await db.query('SELECT version, name, applied_at FROM schema_version ORDER BY version');
console.table(result[0]);
await db.close();
"
```

### Rollback

```bash
# Preview rollback
bun run surrealdb/lib/migrate.ts --dry-run --rollback 002

# Actually rollback
bun run surrealdb/lib/migrate.ts --rollback 002
```

## Programmatic Usage

```typescript
import { applyCoreSchemas, createDbConnection } from '@metabob/proto/surrealdb';

async function migrate() {
  const db = await createDbConnection();

  await applyCoreSchemas(db, {
    dryRun: false,
    verbose: true
  });

  await db.close();
}

migrate();
```

## Testing

```bash
# Run unit tests
bun test surrealdb/lib/migrate.test.ts

# Run with SurrealDB instance for integration tests
export TEST_SURREALDB_URL="http://localhost:8000"
bun test surrealdb/lib/migrate.test.ts
```

## Troubleshooting

### Connection Refused

```
Error: Connection refused at localhost:8000
```

**Solution:** Start SurrealDB locally:
```bash
docker run -d -p 8000:8000 \
  surrealdb/surrealdb:3.0 start \
  --user root --pass your-password
```

### Namespace Not Found

```
Error: The namespace 'production' does not exist
```

**Solution:** Create namespace first:
```bash
bun -e "
import { Surreal } from 'surrealdb';
const db = new Surreal();
await db.connect('http://localhost:8000');
await db.signin({ username: 'root', password: 'your-password' });
await db.query('DEFINE NAMESPACE IF NOT EXISTS production');
await db.close();
"
```

### Checksum Mismatch

```
Error: Checksum mismatch for migration 001!
```

**Solution:** Never modify applied migration files. Create a new migration instead.

## File Structure

```
surrealdb/
├── core/
│   ├── 000-schema-version.surql     # Migration tracking
│   ├── 001-auth-access.surql        # JWT + RECORD auth
│   ├── 002-organizations.surql      # Org, users, API keys
│   ├── 003-projects.surql           # Projects, members
│   └── 004-subscriptions.surql      # Billing, audit logs
├── lib/
│   ├── migrate.ts                   # Migration runner
│   └── migrate.test.ts              # Tests
└── README.md                        # Full documentation
```

## Next Steps

- See `surrealdb/README.md` for comprehensive documentation
- See `PHASE_1_CORE_SCHEMAS_COMPLETE.md` for implementation details
- Proceed to Phase 2: Migrate Activity API schemas
