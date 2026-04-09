# Canary Database Initialization Audit

**Date:** 2026-04-09
**Environment:** Canary (activity.metabob.com)
**Issue:** Organizations and API keys not properly initialized

---

## Executive Summary

The canary database contains test organizations with random IDs instead of the expected `organizations:metabob` record defined in the Helmfile configuration. This causes authentication failures because API keys reference a non-existent organization.

**Root Cause:** The `init-data` Helm chart likely didn't run successfully during deployment, or the initialization script has issues.

---

## Current State (What IS in the Database)

### Organizations
```sql
SELECT * FROM organizations ORDER BY created_at DESC;
```

**Result:** 7 test organizations with random IDs:
- `organizations:ftwtvhsq1wzx02pv0atb`
- `organizations:vswqsyh7bsumr7w9z9nq`
- `organizations:t6rkqmlphvvqdqb5j79c`
- `organizations:kvz6zy0n5fh0g34wvrmr`
- `organizations:m5hc65oqp06vwqd8dpvy`
- `organizations:gmgb7ky9xzf9sqtfzd74`
- `organizations:tpk9lmrbfk16tz9c5z1w`

**❌ Missing:** `organizations:metabob`

### API Keys
```sql
SELECT id, org_id, user_id, name FROM api_key;
```

**Result:** 5 API keys, all referencing `organizations:metabob`:
- `api_key:c84r7o0xwlk1yytfk6t6` → `organizations:metabob`
- `api_key:p9hwgctcfr2b16jwelxc` → `organizations:metabob`
- `api_key:stldgmcztl31pbmtblwb` → `organizations:metabob`
- `api_key:ydg81p7cq72hkqf9fzl1` → `organizations:metabob`
- `api_key:z6yhdopcwtvd0s3xpvl1` → `organizations:metabob`

**❌ Problem:** All API keys reference an organization that doesn't exist.

### Users
**Result:** 2 users exist:
- `self@metabob.com` (MiniBob Service Account)
- `avi@metabob.com` (Admin)

**✓ Correct:** Users exist as expected.

---

## Expected State (What SHOULD Be in the Database)

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

  - email: avi@metabob.com
    name: Avi
    role: admin
    orgId: metabob
```

### Expected MiniBob Instances (Deprecated)
```yaml
minibobInstances:
  - instanceId: minibob-canary-001
    orgId: metabob
    apiKey: mb_inst_canary_03b4cfa7ef9bf84b90b7a25d74bd91975ba1a5c67e10b7d8220d8b3559d2463e
```

**Note:** MiniBob instance authentication is deprecated. Use API keys instead.

---

## Configuration Flow

### Helmfile Configuration
`repos/deployment/helmfile.yaml.gotmpl` (lines 117-136):

```yaml
- name: init-data
  namespace: activity-system
  chart: ./charts/init-data
  needs:
    - activity-system/surrealdb
  values:
    - surrealdb:
        url: http://surrealdb.activity-system.svc.cluster.local:8000
        namespace: activity-system
        database: learning_loop
        username: root
        password: <from secrets>
    - organizations: {{ .Values | get "initData.organizations" list }}
    - users: {{ .Values | get "initData.users" list }}
    - minibobInstances: {{ .Values | get "initData.minibobInstances" list }}
```

### Init Script Template
`repos/deployment/charts/init-data/templates/configmap.yaml` (lines 10-17):

```sql
{{- range .Values.organizations }}
LET $existing_org = (SELECT VALUE id FROM organizations WHERE id = organizations:{{ .id }} LIMIT 1);
IF !$existing_org THEN
  CREATE organizations:{{ .id }} SET
    name = "{{ .name }}",
    created_at = time::now(),
    updated_at = time::now();
END;
{{- end }}
```

**Expected behavior:**
1. Check if `organizations:metabob` exists
2. If not, create it with `name = "Metabob"`

---

## Root Cause Analysis

### Possible Issues

1. **Init-data job didn't run**
   - Helm hook might have failed
   - Check: `kubectl get jobs -n activity-system -l app.kubernetes.io/component=initialization`

2. **Init-data job ran but failed**
   - SurrealDB authentication issues
   - Wrong namespace/database
   - Check: `kubectl logs -n activity-system -l app.kubernetes.io/component=initialization`

3. **Schema mismatch causing CREATE to fail**
   - The organizations table schema has an `org_id` field
   - This field has `VALUE $before OR $value OR id`
   - May cause issues when creating records

4. **Test data overwriting production data**
   - The `sql/init-test-data.ts` script may have run after init-data
   - This script creates test organizations with random IDs

---

## Organizations Table Schema Issue

From `repos/metabob-activity-api/sql/000-auth-schema.surql`:

```sql
-- Note: This table is owned by identity-vessel, not activity-api
-- This schema definition may be outdated

DEFINE TABLE organizations SCHEMAFULL;

DEFINE FIELD org_id ON organizations TYPE string
  VALUE $before OR $value OR id
  ASSERT $value != NONE;
```

**Problem:** The `org_id` field is redundant with the record `id` and may cause confusion.

**Expected schema** (from identity-vessel):
```sql
DEFINE TABLE organizations SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id OR public = true
    FOR create, update, delete WHERE $auth.role = "admin";

DEFINE FIELD name ON organizations TYPE string ASSERT $value != NONE;
DEFINE FIELD created_at ON organizations TYPE datetime VALUE $value OR time::now();
DEFINE FIELD updated_at ON organizations TYPE datetime VALUE $value OR time::now();
```

---

## Container Image Status

From `repos/deployment/environments/production.canary.values.yaml`:

```yaml
metabob-activity-api:
  image:
    tag: "1.2.10-de3c233"

identity-vessel:
  image:
    tag: "0.1.0-de3c233"

minibob:
  image:
    tag: "0.3.7-de3c233"
```

**Action Required:** Verify these tags are the latest versions.

---

## Resolution Steps

### 1. Verify Cluster Connection

```bash
kubectl get pods -n activity-system
```

If not connected:
```bash
# For canary: Configure kubectl context for production cluster
kubectl config use-context <production-cluster>
```

### 2. Check Init-Data Job Status

```bash
# Check if job ran
kubectl get jobs -n activity-system -l app.kubernetes.io/component=initialization

# Check job logs
kubectl logs -n activity-system -l app.kubernetes.io/component=initialization --tail=100

# If job failed, check events
kubectl describe job init-data -n activity-system
```

### 3. Manually Create Organizations Record

If the job didn't run or failed, create the organization manually:

```bash
# Port-forward to SurrealDB
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system

# Then run this script:
bun run /tmp/create-metabob-org.ts
```

**Script content** (`/tmp/create-metabob-org.ts`):
```typescript
#!/usr/bin/env bun
import { Surreal } from "surrealdb";
import { execSync } from "child_process";

const db = new Surreal();
await db.connect("http://localhost:8000");

// Get password from SOPS
let password = execSync(
  `sops -d repos/deployment/secrets/canary.secrets.yaml 2>/dev/null | awk '/^surrealdb:/{found=1} found && /^    password:/{print $2; exit}'`,
  { encoding: "utf-8" }
).trim();

await db.signin({ username: "root", password });
await db.use({ namespace: "activity-system", database: "learning_loop" });

console.log("Creating organizations:metabob...");

// Check if it exists
const existing = await db.query(`SELECT * FROM organizations WHERE id = organizations:metabob`);
if (existing[0] && (existing[0] as any[]).length > 0) {
  console.log("✓ organizations:metabob already exists");
} else {
  // Create the organization (don't pass org_id, let SurrealDB derive it from record ID)
  const result = await db.query(`
    CREATE organizations:metabob SET
      name = "Metabob",
      created_at = time::now(),
      updated_at = time::now();
  `);

  console.log("✓ Created organizations:metabob");
  console.log(JSON.stringify(result, null, 2));
}

await db.close();
```

### 4. Verify Organization Creation

```bash
bun run /tmp/query-all-orgs.ts
```

Should show `organizations:metabob` in the list.

### 5. Update Local API Key Configuration

The correct API key for canary is in `secrets/canary.secrets.yaml`:

```yaml
secrets:
  metabobApiKey: mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5
```

**Update local configuration:**

```bash
# Option 1: Environment variable (highest priority)
export METABOB_API_KEY="mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5"

# Option 2: User config file
cat > ~/.metabob/config.json <<EOF
{
  "metabob": {
    "apiKey": "mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  }
}
EOF
```

**Verify configuration priority:**

```bash
bun run /tmp/check-metabob-api.ts
```

Should show the canary key being used.

### 6. Re-deploy Init-Data (If Needed)

If the job never ran or needs to be re-run:

```bash
cd repos/deployment

# Delete old job (triggers hook on next helmfile sync)
kubectl delete job init-data -n activity-system

# Re-run helmfile sync (canary environment)
helmfile -e canary sync --selector app.kubernetes.io/component=initialization

# Check logs
kubectl logs -n activity-system -l app.kubernetes.io/component=initialization -f
```

### 7. Verify Image Tags Are Current

Check that container images match the latest builds:

```bash
# Check current tags in canary
kubectl get deployments -n activity-system -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}'

# Compare with values file
cat repos/deployment/environments/production.canary.values.yaml | grep -A 2 "image:"
```

If tags are outdated, trigger CI/CD:

```bash
# Push to dev branch triggers canary deployment
git push origin dev
```

---

## Verification Checklist

After resolution, verify:

- [ ] `organizations:metabob` exists in database
- [ ] API keys reference `organizations:metabob`
- [ ] Users are members of `organizations:metabob`
- [ ] Local machine uses correct API key from secrets
- [ ] MiniBob can authenticate to canary endpoint
- [ ] Container images are up to date

**Test authentication:**

```bash
# Should return 200 with templates list
curl -X GET https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5"
```

---

## Related Files

- **Helmfile:** `repos/deployment/helmfile.yaml.gotmpl`
- **Init chart:** `repos/deployment/charts/init-data/`
- **Secrets:** `repos/deployment/secrets/canary.secrets.yaml`
- **Schema:** `repos/metabob-activity-api/sql/000-auth-schema.surql`
- **CI/CD:** `repos/deployment/.github/workflows/deploy-canary.yml`

---

## Recommendations

### Short Term (Immediate)

1. **Fix the missing organization:** Run the manual creation script
2. **Update local API key:** Use the canary key from secrets
3. **Verify init-data job:** Check if it ran and review logs

### Medium Term (This Week)

1. **Schema alignment:** Ensure identity-vessel schema matches activity-api
2. **Image tag verification:** Automate checking for outdated tags
3. **Init-data idempotency:** Add better error handling and logging

### Long Term (Next Sprint)

1. **Deprecate test data scripts:** Remove `init-test-data.ts` or make it environment-aware
2. **Automated smoke tests:** Add post-deployment verification
3. **Schema ownership documentation:** Clear table ownership in SCHEMA_OWNERSHIP.md
