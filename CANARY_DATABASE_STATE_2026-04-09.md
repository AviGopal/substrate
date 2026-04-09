# Canary Database State - 2026-04-09

**Date:** 2026-04-09
**Environment:** Canary (activity.metabob.com)
**Cluster:** metabob-production
**Namespace:** activity-system

---

## Executive Summary

**Problem:** The `organizations:metabob` record does NOT exist in the canary database, but 3 API keys reference it. This causes authentication failures.

**Root Cause:** The init-data job that creates the default organization likely failed or did not run during deployment. The API keys were created with a reference to a non-existent organization.

**Impact:** All API keys referencing `organizations:metabob` cannot authenticate successfully because the org_id foreign key points to a non-existent record.

---

## How to Query the Canary Database

### Prerequisites

1. **kubectl access to production cluster**
   ```bash
   kubectl config use-context metabob-production
   ```

2. **Port-forward to SurrealDB**
   ```bash
   kubectl port-forward svc/surrealdb 8000:8000 -n activity-system
   ```
   Leave this running in a separate terminal.

3. **SOPS password access**
   The scripts automatically load the SurrealDB password from:
   ```
   repos/deployment/secrets/canary.secrets.yaml
   ```
   Using the `sops` command-line tool.

### Quick Commands

```bash
# List all organizations
bun run scripts/commission-canary.ts org list

# List all API keys
bun run scripts/commission-canary.ts apikey list

# List all users
bun run scripts/commission-canary.ts user list

# List MiniBob instances (deprecated, but may still exist)
bun run scripts/commission-canary.ts minibob list
```

### Direct SQL Queries

Create a query script:

```typescript
#!/usr/bin/env bun
import { Surreal } from "surrealdb";
import { execSync } from "child_process";

const db = new Surreal();
await db.connect("http://localhost:8000");

// Get password from SOPS
const password = execSync(
  `sops -d repos/deployment/secrets/canary.secrets.yaml 2>/dev/null | awk '/^surrealdb:/{found=1} found && /^    password:/{print $2; exit}'`,
  { encoding: "utf-8" }
).trim();

await db.signin({ username: "root", password });
await db.use({ namespace: "activity-system", database: "learning_loop" });

// Your queries here
const result = await db.query(`SELECT * FROM organizations WHERE id = organizations:metabob`);
console.log(JSON.stringify(result[0], null, 2));

await db.close();
```

Save as `/tmp/query.ts` and run:
```bash
bun run /tmp/query.ts
```

---

## Current Database State

### Organizations: MISSING `organizations:metabob`

**Query:**
```sql
SELECT * FROM organizations WHERE id = organizations:metabob
```

**Result:** `[]` (EMPTY - does not exist)

**Existing Organizations (sample):**
```json
[
  { "id": "organizations:0i9rgald3fjbgh281ge3", "name": "Test99" },
  { "id": "organizations:33iwgz4mgpznj9d0rifp", "name": "testorg" },
  { "id": "organizations:8pac4o38ncpgf6ux94n8", "name": "Final Test" }
]
```

12 test organizations exist, all with random IDs. None have the ID `metabob`.

---

### API Keys: 3 keys reference `organizations:metabob`

**Query:**
```sql
SELECT id, name, org_id, user_id, scopes FROM api_key WHERE org_id = organizations:metabob
```

**Result:**
```json
[
  {
    "id": "api_key:1dokaymjqnwmjh3opc8p",
    "name": "self-local-dev",
    "org_id": "organizations:metabob",
    "user_id": ["users:tscqwx4ojanixdgnn91w"],
    "scopes": ["activities:read", "activities:write", "templates:read", "templates:write"]
  },
  {
    "id": "api_key:6swvul9che0vf3ni300s",
    "name": "self-canary",
    "org_id": "organizations:metabob",
    "user_id": ["users:tscqwx4ojanixdgnn91w"],
    "scopes": ["activities:read", "activities:write", "templates:read", "templates:write"]
  },
  {
    "id": "api_key:9oqb53cwr2jbi1spvkj9",
    "name": "self-production",
    "org_id": "organizations:metabob",
    "user_id": ["users:tscqwx4ojanixdgnn91w"],
    "scopes": ["activities:read", "activities:write", "templates:read", "templates:write"]
  }
]
```

**Problem:** All 3 API keys reference:
- `org_id = "organizations:metabob"` (does NOT exist)
- `user_id = ["users:tscqwx4ojanixdgnn91w"]` (does NOT exist)

---

### Users: Referenced user does NOT exist

**Query:**
```sql
SELECT * FROM users:tscqwx4ojanixdgnn91w
```

**Result:** `[]` (EMPTY - does not exist)

**Existing `self@metabob.com` user:**
```json
{
  "id": "users:kre88ea3i1vmuj1gd12a",
  "email": "self@metabob.com",
  "name": "MiniBob Service Account",
  "is_active": true,
  "email_verified": true,
  "created_at": "2026-04-09T04:06:43.867288977Z"
}
```

**Problem:** The API keys reference `users:tscqwx4ojanixdgnn91w` but the actual user has ID `users:kre88ea3i1vmuj1gd12a`.

---

### org_members: No members for `organizations:metabob`

**Query:**
```sql
SELECT * FROM org_members WHERE org_id = organizations:metabob
```

**Result:** `[]` (EMPTY)

This is expected since the organization doesn't exist.

---

## Why Keys Are Missing

The API keys exist in the database, but they are **orphaned**:

1. **Organization missing:** `organizations:metabob` does not exist
2. **User ID mismatch:** The API keys reference `users:tscqwx4ojanixdgnn91w`, but the actual user is `users:kre88ea3i1vmuj1gd12a`

This likely happened because:
1. The init-data Helm hook failed or didn't run
2. The API keys were created before/after the organization
3. A schema migration or cleanup operation removed the organization
4. User IDs changed during a database reset

---

## Expected State (From Secrets)

Based on `repos/deployment/secrets/canary.secrets.yaml`:

### Expected Organization
```yaml
initData:
  organizations:
    - id: metabob
      name: Metabob
```

**Should create:** `organizations:metabob` with `name = "Metabob"`

### Expected Users
```yaml
users:
  - email: self@metabob.com
    name: MiniBob Service Account
    role: service
    orgId: metabob
    apiKeys:
      - name: self-canary
        key: mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5
        scopes: [activities:read, activities:write, templates:read, templates:write]
```

**User exists:** `users:kre88ea3i1vmuj1gd12a` (self@metabob.com)
**But:** API keys reference wrong user ID

---

## Resolution Steps

### Option 1: Create the Missing Organization (Quick Fix)

```bash
# Port-forward to SurrealDB
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system

# Create organization
bun run scripts/commission-canary.ts org create \
  --name "Metabob" \
  --admin-email "admin@metabob.com" \
  --tier pro
```

**Important:** Save the generated credentials. The script will:
1. Create `organizations:metabob`
2. Create a new admin user
3. Create a new MiniBob instance
4. Generate new API keys

### Option 2: Fix Existing API Keys (Surgical Fix) ⭐ RECOMMENDED

**This is the recommended approach** - it fixes the issue without creating duplicate resources.

```bash
# Prerequisites: Port-forward to SurrealDB
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system

# Run the fix script (in another terminal)
bun run scripts/fix-canary-metabob-org.ts
```

**What it does:**
1. Creates `organizations:metabob` if missing
2. Updates all API keys referencing `organizations:metabob` to point to the correct user (`users:kre88ea3i1vmuj1gd12a`)
3. Creates `org_members` link between user and organization
4. Verifies all changes

**Script location:** `/home/avi/documents/work/exp-repo/metabob-devbob/scripts/fix-canary-metabob-org.ts`

### Option 3: Re-run Init-Data Job (Proper Fix)

```bash
# Delete old init-data job (if it exists)
kubectl delete job init-data -n activity-system

# Re-deploy the init-data chart
cd repos/deployment
helmfile -e canary sync --selector app.kubernetes.io/component=initialization

# Check logs
kubectl logs -n activity-system -l app.kubernetes.io/component=initialization -f
```

---

## Deployment Configuration Analysis

### What SHOULD Have Been Created

Based on `repos/deployment/secrets/canary.secrets.yaml`:

**Organizations:**
- `organizations:metabob` with `name = "Metabob"`

**Users:**
- `self@metabob.com` (MiniBob Service Account) - ROLE: service
- `avi@metabob.com` (Avi) - ROLE: admin

**API Keys for self@metabob.com:**
- `self-local-dev`: `mb_self_local_1775062469_bf02ae0a191a445881bb2f7887296e1101a4d0cfc11fa70acbdc3c03a419141c`
- `self-canary`: `mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5`
- `self-production`: `mb_self_prod_1775062469_6a0f6ffc1daf92a83f1b091547d5fb4623c015b958fd8f2e0ef2947413ae22a4`

**MiniBob Instances (Deprecated):**
- `minibob-local-001`
- `minibob-canary-001`
- `minibob-production-001`

### Why Init-Data Job Didn't Run

```bash
kubectl get jobs -n activity-system
# Result: No resources found in activity-system namespace.
```

**Root Cause:** The init-data job has NEVER run or was deleted after completion.

Helm hooks are configured with:
```yaml
"helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
```

This means the job is automatically deleted after successful completion. Since no job exists, either:
1. The job succeeded and was auto-deleted (most likely)
2. The job failed and was manually deleted
3. The init-data chart was not deployed

Given that users exist (`self@metabob.com` and `avi@metabob.com`), the job likely ran partially but failed to create the organization.

---

## Verification Commands

After applying the fix, verify:

```bash
# 1. Organization exists
bun run /tmp/query.ts
# Query: SELECT * FROM organizations:metabob
# Expected: Should return 1 record with name "Metabob"

# 2. API keys are valid
bun run scripts/commission-canary.ts apikey list
# Expected: All keys should have valid org_id and user_id

# 3. Test authentication with canary key
curl -X GET https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5"
# Expected: HTTP 200 with templates list
```

---

## Related Files

- **Query script:** `/home/avi/documents/work/exp-repo/metabob-devbob/scripts/commission-canary.ts`
- **Secrets:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment/secrets/canary.secrets.yaml`
- **Init chart:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/deployment/charts/init-data/`
- **Schema:** `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/sql/000-auth-schema.surql`

---

## Summary

| Issue | Status | Fix |
|-------|--------|-----|
| `organizations:metabob` missing | ❌ Does not exist | Create via commission-canary.ts or SQL |
| API keys reference wrong user | ❌ Point to `users:tscqwx4ojanixdgnn91w` | Update to `users:kre88ea3i1vmuj1gd12a` |
| `org_members` link missing | ❌ No records | Create after org creation |
| Init-data job | ⚠️ Unknown status | Check kubectl logs |

**Recommended Action:** Use Option 2 (Surgical Fix) to:
1. Create `organizations:metabob`
2. Update existing API keys to reference correct user
3. Create `org_members` link

This preserves the existing API key secrets defined in the canary secrets file.
