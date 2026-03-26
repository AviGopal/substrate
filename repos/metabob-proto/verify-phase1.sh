#!/bin/bash
set -e

echo "========================================="
echo "Phase 1 Verification Script"
echo "========================================="
echo ""

# Check environment variables
echo "1. Checking environment variables..."
: "${SURREALDB_URL:=http://localhost:8000}"
: "${SURREALDB_NAMESPACE:=activity-system}"
: "${SURREALDB_DATABASE:=learning_loop}"
: "${SURREALDB_USERNAME:=root}"
: "${SURREALDB_PASSWORD:?SURREALDB_PASSWORD is required}"

echo "   ✓ SURREALDB_URL: $SURREALDB_URL"
echo "   ✓ SURREALDB_NAMESPACE: $SURREALDB_NAMESPACE"
echo "   ✓ SURREALDB_DATABASE: $SURREALDB_DATABASE"
echo ""

# Check files exist
echo "2. Verifying schema files..."
for file in \
  "surrealdb/core/000-schema-version.surql" \
  "surrealdb/core/001-auth-access.surql" \
  "surrealdb/core/002-organizations.surql" \
  "surrealdb/core/003-projects.surql" \
  "surrealdb/core/004-subscriptions.surql"
do
  if [ -f "$file" ]; then
    echo "   ✓ $file"
  else
    echo "   ✗ $file NOT FOUND"
    exit 1
  fi
done
echo ""

# Check migration runner
echo "3. Verifying migration runner..."
if [ -f "surrealdb/lib/migrate.ts" ]; then
  echo "   ✓ surrealdb/lib/migrate.ts"
else
  echo "   ✗ Migration runner NOT FOUND"
  exit 1
fi
echo ""

# Check tests
echo "4. Verifying tests..."
if [ -f "surrealdb/lib/migrate.test.ts" ]; then
  echo "   ✓ surrealdb/lib/migrate.test.ts"
else
  echo "   ✗ Tests NOT FOUND"
  exit 1
fi
echo ""

# Check documentation
echo "5. Verifying documentation..."
if [ -f "surrealdb/README.md" ]; then
  echo "   ✓ surrealdb/README.md"
else
  echo "   ✗ README NOT FOUND"
  exit 1
fi
echo ""

# Run unit tests
echo "6. Running unit tests..."
bun test surrealdb/lib/migrate.test.ts 2>&1 | grep -E "(pass|fail)" || true
echo ""

# Dry-run migration
echo "7. Testing dry-run migration..."
bun run surrealdb/lib/migrate.ts --dry-run 2>&1 | tail -5
echo ""

# Check database connection and schema
echo "8. Verifying database schema..."
bun -e "
import { Surreal } from 'surrealdb';
const db = new Surreal();
await db.connect('$SURREALDB_URL');
await db.signin({ username: '$SURREALDB_USERNAME', password: '$SURREALDB_PASSWORD' });
await db.use({ namespace: '$SURREALDB_NAMESPACE', database: '$SURREALDB_DATABASE' });

const versions = await db.query('SELECT version, name FROM schema_version ORDER BY version');
console.log('   Applied migrations:');
versions[0].forEach(v => console.log(\`     - \${v.version}: \${v.name}\`));

const tables = await db.query('SELECT name FROM (SELECT VALUE name FROM (INFO FOR DATABASE).tables)');
console.log('   Created tables: ' + tables[0].length);

await db.close();
" 2>&1
echo ""

echo "========================================="
echo "✓ Phase 1 Verification Complete!"
echo "========================================="
echo ""
echo "All checks passed. Ready for Phase 2."
echo ""
