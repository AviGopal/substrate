# Canary Setup Guide

**Quick reference for setting up local development against the canary deployment at `activity.metabob.com`.**

---

## TL;DR - Quick Setup

```bash
# 1. Port-forward to canary SurrealDB (in separate terminal)
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system

# 2. Create the metabob organization (if missing)
bun run /tmp/create-metabob-org.ts

# 3. Configure your API key
export METABOB_API_KEY="mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5"

# 4. Verify setup
/tmp/verify-canary-setup.sh
```

---

## Prerequisites

1. **Kubectl access to production cluster**
   ```bash
   kubectl get pods -n activity-system
   ```

2. **SOPS configured with Age key**
   ```bash
   sops -d repos/deployment/secrets/canary.secrets.yaml | head
   ```

3. **Bun installed**
   ```bash
   bun --version
   ```

---

## Step 1: Connect to Canary SurrealDB

The canary database runs in Kubernetes at `surrealdb.activity-system.svc.cluster.local:8000`.

**Port-forward (in a separate terminal):**
```bash
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system
```

**Verify connection:**
```bash
curl http://localhost:8000/health
# Should return: OK
```

---

## Step 2: Check Database State

**List organizations:**
```bash
bun run /tmp/query-all-orgs.ts
```

**Expected output:**
- Should show `organizations:metabob`
- If it shows only test orgs with random IDs, the init-data job didn't run

**List API keys:**
```bash
bun run scripts/commission-canary.ts apikey list
```

**Expected output:**
- Should show API keys for `organizations:metabob`
- Should include `self-canary` key

---

## Step 3: Fix Missing Organization

If `organizations:metabob` doesn't exist:

```bash
bun run /tmp/create-metabob-org.ts
```

This script:
1. Connects to local port-forward (localhost:8000)
2. Gets SurrealDB password from SOPS secrets
3. Creates `organizations:metabob` if it doesn't exist
4. Verifies API keys and users

---

## Step 4: Configure Local API Key

The correct API key for canary is defined in `secrets/canary.secrets.yaml`:

```yaml
secrets:
  metabobApiKey: mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5
```

### Option 1: Environment Variable (Recommended)

```bash
export METABOB_API_KEY="mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5"
```

Add to `~/.bashrc` or `~/.zshrc` for persistence.

### Option 2: Config File

```bash
mkdir -p ~/.metabob

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

**Note:** Environment variable takes precedence over config file.

---

## Step 5: Verify Setup

Run the comprehensive verification script:

```bash
/tmp/verify-canary-setup.sh
```

**Checks performed:**
1. ✓ SurrealDB connection (localhost:8000)
2. ✓ `organizations:metabob` exists
3. ✓ API keys reference correct org
4. ✓ Local API key configured
5. ✓ API authentication works

**Expected output:**
```
========================================
Canary Setup Verification
========================================

[1/5] Testing SurrealDB connection...
✓ SurrealDB accessible at localhost:8000

[2/5] Checking organizations:metabob exists...
✓ organizations:metabob exists

[3/5] Checking API keys...
✓ Found 3 API keys for organizations:metabob

[4/5] Checking local API key configuration...
✓ API key matches expected canary key

[5/5] Testing API authentication...
✓ API authentication successful (HTTP 200)

========================================
Summary
========================================

✓ All checks passed!

Your local machine is properly configured for canary.
```

---

## Step 6: Test MiniBob

Once setup is complete, test MiniBob against canary:

```bash
# Check vessels
minibob doctor

# Test goal processing
minibob --single "list all available activity templates"
```

---

## Troubleshooting

### Issue: "organizations:metabob does NOT exist"

**Cause:** Init-data Helm job didn't run or failed during deployment.

**Fix:**
```bash
bun run /tmp/create-metabob-org.ts
```

### Issue: "API authentication failed (HTTP 401)"

**Causes:**
1. Wrong API key configured
2. API key not in database
3. Organization doesn't exist

**Diagnosis:**
```bash
# Check which key is being used
bun run /tmp/check-metabob-api.ts

# Check if key exists in database
bun run scripts/commission-canary.ts apikey list | grep "mb_self_canary"
```

**Fix:**
```bash
# Use the correct canary API key
export METABOB_API_KEY="mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5"
```

### Issue: "SurrealDB not accessible"

**Cause:** Port-forward not running.

**Fix:**
```bash
# In separate terminal
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system
```

### Issue: API keys reference wrong organization

**Cause:** Init-data script ran with wrong organization ID.

**Fix:**
1. Check `secrets/canary.secrets.yaml`:
   ```bash
   sops -d repos/deployment/secrets/canary.secrets.yaml | grep -A 5 "organizations:"
   ```

2. Should show:
   ```yaml
   organizations:
     - id: metabob
       name: Metabob
   ```

3. If wrong, update secrets and re-run init-data:
   ```bash
   kubectl delete job init-data -n activity-system
   cd repos/deployment
   helmfile -e canary sync --selector app.kubernetes.io/component=initialization
   ```

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `secrets/canary.secrets.yaml` | SOPS-encrypted secrets including API keys |
| `environments/production.canary.values.yaml` | Canary-specific values (image tags, replicas) |
| `helmfile.yaml.gotmpl` | Main deployment configuration |
| `charts/init-data/` | Database initialization Helm chart |
| `~/.metabob/config.json` | Local MiniBob configuration |

---

## API Key Details

### Service Account: `self@metabob.com`

**Purpose:** MiniBob and automated services

**API Keys:**
- `self-local-dev`: For local development
- `self-canary`: For canary environment **(use this)**
- `self-production`: For production environment

**Scopes:**
- `activities:read`
- `activities:write`
- `templates:read`
- `templates:write`

### Canary Key

```
mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5
```

**Format:** `mb_self_{environment}_{timestamp}_{hex}`

**Organization:** `organizations:metabob`

---

## Re-deploying Init-Data

If the init-data job needs to be re-run:

```bash
cd repos/deployment

# Delete existing job
kubectl delete job init-data -n activity-system

# Re-run helmfile sync (triggers post-install hook)
helmfile -e canary sync --selector app.kubernetes.io/component=initialization

# Check logs
kubectl logs -n activity-system -l app.kubernetes.io/component=initialization -f
```

---

## Deployment Workflow

### Normal Development Flow

1. **Make changes locally**
   ```bash
   cd repos/metabob-activity-api
   # Edit code
   bun test
   ```

2. **Sync to deployment repo**
   ```bash
   cd repos/deployment
   rsync -av ../metabob-activity-api/src/ vessels/metabob-activity-api/src/
   ```

3. **Push to dev branch** (triggers CI/CD)
   ```bash
   git add vessels/metabob-activity-api
   git commit -m "feat: add new feature"
   git push origin dev
   ```

4. **CI/CD automatically:**
   - Builds container image
   - Runs tests and linting
   - Deploys to canary
   - Updates image tag in `production.canary.values.yaml`

5. **Validate canary**
   - Check dashboard: https://internal.metabob.com
   - Run smoke tests
   - Wait 24-48h soak period

6. **Promote to production** (manual or scheduled)
   ```bash
   ./scripts/promote-canary-to-production.sh
   ```

---

## Related Documentation

- **Detailed Audit:** `CANARY_DATABASE_AUDIT.md` - Full analysis of current state vs expected
- **Deployment Workflow:** `repos/deployment/DEPLOYMENT_WORKFLOW.md` - CI/CD process
- **Root CLAUDE.md:** Main development guidelines
- **Schema Ownership:** `docs/SCHEMA_OWNERSHIP.md` - Table ownership by service

---

## Quick Reference Commands

```bash
# Check canary status
kubectl get pods -n activity-system
kubectl get jobs -n activity-system

# View logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f

# Port-forward SurrealDB
kubectl port-forward svc/surrealdb 8000:8000 -n activity-system

# Query database
bun run /tmp/query-all-orgs.ts
bun run scripts/commission-canary.ts org list
bun run scripts/commission-canary.ts apikey list

# Test API
curl https://activity.metabob.com/health
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates

# Re-deploy init-data
kubectl delete job init-data -n activity-system
cd repos/deployment && helmfile -e canary sync --selector app.kubernetes.io/component=initialization
```
