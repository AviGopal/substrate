# Running Phase 4 Tests: MiniBob Instance Authentication

Quick reference for testing MiniBob RECORD authentication.

## Prerequisites

1. **SurrealDB 3.0+ running** with Phase 1 core schemas deployed:
   ```bash
   # Check SurrealDB is running
   curl http://localhost:8000/health

   # Verify namespace exists
   surreal sql --endpoint http://localhost:8000 --user root --pass changeme
   INFO FOR NS production;
   ```

2. **Bun installed** (for running test scripts):
   ```bash
   bun --version  # Should be 1.0+
   ```

3. **Environment variables** set:
   ```bash
   export SURREALDB_URL=http://localhost:8000
   export SURREALDB_NAMESPACE=production
   export SURREALDB_DATABASE=metabob
   export SURREALDB_USERNAME=root
   export SURREALDB_PASSWORD=changeme
   ```

## Run Automated Tests

```bash
cd openspec/changes/surrealdb-multi-tenant-schema/specs/multi-tenant-rbac

# Install dependencies if needed
bun install surrealdb

# Run test suite
bun test-instance-auth.ts
```

**Expected output**:
```
Starting MiniBob RECORD authentication tests...

=== Test 4.11: MiniBob instance signup ===
✓ Instance 1 created
✓ Instance 2 created
✓ Test 4.11 PASSED: MiniBob instances created successfully

=== Test 4.12: MiniBob instance signin ===
✓ Instance authenticated successfully
✓ Token received: YES
✓ Test 4.12 PASSED: RECORD authentication works

=== Test 4.13: Org/project isolation ===
Instance 1 can see instances: [...]
Instance 2 can see instances: [...]
✓ Test 4.13 PASSED: Instances are isolated by PERMISSIONS

=== Test 4.14: Boredom activity execution with RBAC ===
Instance 1 can access template: [...]
Instance 2 can access template: []
✓ Test 4.14 PASSED: Activity templates are isolated by org

=== Cleanup ===
✓ Test data cleaned up

✓ All tests PASSED
```

## Manual Testing

### Step 1: Create Test Organization and Project

```sql
-- Connect to SurrealDB
surreal sql --endpoint http://localhost:8000 \
  --namespace production --database metabob \
  --user root --pass changeme

-- Create org
CREATE organizations:test_org SET
  name = 'Test Organization',
  seat_limit = 5,
  seat_usage = 0,
  created_at = time::now(),
  updated_at = time::now();

-- Create project
CREATE projects:test_project SET
  name = 'Test Project',
  org_id = organizations:test_org,
  created_at = time::now(),
  updated_at = time::now();
```

### Step 2: Generate API Key and Create Instance

```sql
-- Generate API key hash (replace 'my-secret-key' with actual secret)
RETURN crypto::argon2::generate('my-secret-key');

-- Copy the hash output, then create instance
CREATE minibob_instance SET
  instance_id = 'manual-test-instance',
  org_id = organizations:test_org,
  project_id = projects:test_project,
  api_key_hash = '<paste-hash-here>',
  vessel_id = 'test-vessel',
  is_active = true,
  created_at = time::now();

-- Verify instance created
SELECT * FROM minibob_instance WHERE instance_id = 'manual-test-instance';
```

### Step 3: Test Authentication from TypeScript

```typescript
// test-manual-auth.ts
import { Surreal } from 'surrealdb';

async function testAuth() {
  const db = new Surreal();
  await db.connect('http://localhost:8000');

  // Set namespace/database BEFORE signin
  await db.use({
    namespace: 'production',
    database: 'metabob',
  });

  // Sign in with RECORD access
  try {
    const token = await db.signin({
      access: 'minibob_record',
      variables: {
        instance_id: 'manual-test-instance',
        api_key: 'my-secret-key',
      },
    });

    console.log('✓ Authentication successful');
    console.log('Token:', token);

    // Test query
    const result = await db.query('SELECT * FROM minibob_instance');
    console.log('Visible instances:', result);

  } catch (error) {
    console.error('✗ Authentication failed:', error);
  } finally {
    await db.close();
  }
}

testAuth();
```

Run test:
```bash
bun test-manual-auth.ts
```

### Step 4: Test Org/Project Isolation

```typescript
// test-isolation.ts
import { Surreal } from 'surrealdb';

async function testIsolation() {
  // Create second org/project/instance
  const rootDb = new Surreal();
  await rootDb.connect('http://localhost:8000');
  await rootDb.signin({ username: 'root', password: 'changeme' });
  await rootDb.use({ namespace: 'production', database: 'metabob' });

  // Create org2
  await rootDb.query(`
    CREATE organizations:test_org_2 SET
      name = 'Test Organization 2',
      seat_limit = 5,
      seat_usage = 0,
      created_at = time::now(),
      updated_at = time::now();
  `);

  // Create project2
  await rootDb.query(`
    CREATE projects:test_project_2 SET
      name = 'Test Project 2',
      org_id = organizations:test_org_2,
      created_at = time::now(),
      updated_at = time::now();
  `);

  // Create instance2
  const hash2 = await rootDb.query(`RETURN crypto::argon2::generate('secret-2')`);
  await rootDb.query(`
    CREATE minibob_instance SET
      instance_id = 'manual-test-instance-2',
      org_id = organizations:test_org_2,
      project_id = projects:test_project_2,
      api_key_hash = '${hash2[0]}',
      is_active = true,
      created_at = time::now();
  `);

  await rootDb.close();

  // Test instance 1 can't see instance 2's data
  const db1 = new Surreal();
  await db1.connect('http://localhost:8000');
  await db1.use({ namespace: 'production', database: 'metabob' });
  await db1.signin({
    access: 'minibob_record',
    variables: {
      instance_id: 'manual-test-instance',
      api_key: 'my-secret-key',
    },
  });

  const instances1 = await db1.query('SELECT * FROM minibob_instance');
  console.log('Instance 1 sees:', instances1);
  // Should only see its own record

  await db1.close();
}

testIsolation();
```

## Troubleshooting

### Test Fails: "Cannot access namespace"

**Cause**: Namespace doesn't exist or core schemas not deployed

**Fix**:
```bash
# Deploy Phase 1 core schemas
cd repos/metabob-proto
bun surrealdb/lib/migrate.ts
```

### Test Fails: "SIGNIN failed: invalid credentials"

**Cause**: API key doesn't match hash

**Fix**:
```sql
-- Regenerate hash with correct key
RETURN crypto::argon2::generate('my-secret-key');

-- Update instance with new hash
UPDATE minibob_instance SET
  api_key_hash = '<new-hash>'
WHERE instance_id = 'manual-test-instance';
```

### Test Fails: "Access definition not found"

**Cause**: `minibob_record` ACCESS not defined

**Fix**:
```bash
# Re-run Phase 1 core schema: 001-auth-access.surql
cd repos/metabob-proto
surreal sql --endpoint http://localhost:8000 \
  --namespace production --database metabob \
  --user root --pass changeme < surrealdb/core/001-auth-access.surql
```

### Empty Query Results

**Cause**: PERMISSIONS filtering data

**Debug**:
```sql
-- Check what $auth contains
SELECT $auth;

-- Check instance org/project
SELECT * FROM minibob_instance WHERE instance_id = 'manual-test-instance';

-- Verify templates exist with matching org_id
SELECT * FROM activity_registry WHERE org_id = organizations:test_org;
```

## Cleanup

After testing, remove test data:

```sql
-- Delete test instances
DELETE minibob_instance WHERE instance_id IN ['manual-test-instance', 'manual-test-instance-2'];

-- Delete test projects
DELETE projects:test_project;
DELETE projects:test_project_2;

-- Delete test orgs
DELETE organizations:test_org;
DELETE organizations:test_org_2;
```

## Next Steps

After all tests pass:

1. **Stage deployment** (Task 4.15):
   ```bash
   # Build updated images
   cd repos/metabob-activity-api
   docker build -t metabob-activity-api:rbac-phase4 .

   cd ../minibob
   docker build -t minibob:rbac-phase4 .

   # Deploy to staging
   cd ../../helm
   helmfile -f activity-system-minimal.yaml.gotmpl \
     --environment staging sync
   ```

2. **Production deployment** (Task 4.16):
   ```bash
   helmfile -f activity-system-minimal.yaml.gotmpl \
     --environment production sync
   ```

3. **Monitor authentication**:
   ```bash
   # Watch MiniBob logs
   kubectl logs -n activity-system -l app=minibob -f | grep -i auth

   # Check activity-api logs
   kubectl logs -n activity-system -l app=metabob-activity-api -f | grep -i instance
   ```

## References

- [Phase 4 Implementation Summary](./PHASE4_IMPLEMENTATION_SUMMARY.md)
- [Instance Auth Guide](./INSTANCE_AUTH_GUIDE.md)
- [RBAC Specification](./spec.md)
