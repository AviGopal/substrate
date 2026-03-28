# Phase 6 Testing Guide

**Purpose:** Validate automated MiniBob instance creation and authentication

**Prerequisites:**
- Docker Desktop with Kubernetes enabled
- Istio installed
- Helm/Helmfile installed
- Images built: metabob-activity-api, minibob, activity-dashboard

## Test Suite

### Test 6.11: Init-Data Job Deployment

**Objective:** Verify the init-data Job runs successfully after helmfile deploy

```bash
# 1. Deploy the stack
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync

# 2. Wait for SurrealDB to be ready
kubectl wait --for=condition=ready pod -l app=surrealdb -n activity-system --timeout=300s

# 3. Check for init-data Job
kubectl get jobs -n activity-system

# Expected output:
# NAME                    COMPLETIONS   DURATION   AGE
# surrealdb-init-data     1/1           15s        2m

# 4. Verify job completed successfully
kubectl get jobs -n activity-system surrealdb-init-data -o jsonpath='{.status.succeeded}'

# Expected: 1
```

**Success Criteria:**
- ✅ Job created with post-upgrade hook
- ✅ Job completes (status.succeeded = 1)
- ✅ No error logs in job output

---

### Test 6.12: Job Logs Captured

**Objective:** Verify job execution logs are accessible via kubectl

```bash
# View job logs
kubectl logs -n activity-system job/surrealdb-init-data

# Expected output should include:
# Connecting to SurrealDB at http://surrealdb.activity-system.svc.cluster.local:8000...
# Signing in as root...
# Using namespace: activity-system, database: learning_loop
# Checking for organization: metabob_internal...
# ✓ Organization metabob_internal [created or already exists]
# Checking for MiniBob instance: minibob-local-001...
# ✓ MiniBob instance minibob-local-001 [created or already exists]
# ✅ Test data initialization complete!
# Configuration:
#   Organization: metabob_internal (Metabob Internal)
#   MiniBob Instance ID: minibob-local-001
#   MiniBob Vessel ID: minibob-cli-local
#   MiniBob API Key: test-api... (for local dev only)
```

**Success Criteria:**
- ✅ Logs show successful connection to SurrealDB
- ✅ Logs show organization creation/verification
- ✅ Logs show instance creation/verification
- ✅ No error messages in logs

---

### Test 6.13: Verify Data Created

**Objective:** Query SurrealDB to confirm organization and instance records exist

```bash
# Create a test query script
cat > /tmp/test-data.ts <<'EOF'
import { Surreal } from 'surrealdb';

const db = new Surreal();
await db.connect(process.env.SURREALDB_URL);
await db.signin({
  username: process.env.SURREALDB_USERNAME,
  password: process.env.SURREALDB_PASSWORD
});
await db.use({
  namespace: process.env.SURREALDB_NAMESPACE,
  database: process.env.SURREALDB_DATABASE
});

console.log('\n=== Organizations ===');
const orgs = await db.query('SELECT * FROM organizations');
console.log(JSON.stringify(orgs, null, 2));

console.log('\n=== MiniBob Instances ===');
const instances = await db.query('SELECT * FROM minibob_instance');
console.log(JSON.stringify(instances, null, 2));

process.exit(0);
EOF

# Run query in cluster
kubectl run test-data-query -n activity-system \
  --image=metabob-activity-api:latest \
  --image-pull-policy=Never \
  --rm -i --restart=Never \
  --env="SURREALDB_URL=http://surrealdb.activity-system.svc.cluster.local:8000" \
  --env="SURREALDB_NAMESPACE=activity-system" \
  --env="SURREALDB_DATABASE=learning_loop" \
  --env="SURREALDB_USERNAME=root" \
  --env="SURREALDB_PASSWORD=surrealdb-local-dev-123" \
  -- sh -c "cat > /tmp/test.ts <<'INNER_EOF'
$(cat /tmp/test-data.ts)
INNER_EOF
bun run /tmp/test.ts"
```

**Expected Output:**

```json
=== Organizations ===
[
  [
    {
      "id": "organizations:metabob_internal",
      "name": "Metabob Internal",
      "created_at": "2026-03-24T...",
      "updated_at": "2026-03-24T..."
    }
  ]
]

=== MiniBob Instances ===
[
  [
    {
      "id": "minibob_instance:...",
      "instance_id": "minibob-local-001",
      "org_id": "organizations:metabob_internal",
      "project_id": null,
      "api_key_hash": "$argon2...",
      "vessel_id": "minibob-cli-local",
      "is_active": true,
      "created_at": "2026-03-24T...",
      "last_active_at": "2026-03-24T..."
    }
  ]
]
```

**Success Criteria:**
- ✅ Organization record exists with correct ID and name
- ✅ MiniBob instance record exists with correct instance_id
- ✅ instance.org_id references the organization
- ✅ instance.api_key_hash is an argon2 hash
- ✅ instance.is_active = true

---

### Test 6.B.10: MiniBob Authentication End-to-End

**Objective:** Test the complete authentication flow from instance credentials to JWT token

**Step 1: Test auth endpoint directly**

```bash
# Test signin endpoint
curl -X POST http://api.minibob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "minibob-local-001",
    "api_key": "test-api-key-123"
  }' | jq

# Expected response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "org_id": "metabob_internal",
#   "project_id": null
# }

# Save token for next test
TOKEN=$(curl -s -X POST http://api.minibob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"minibob-local-001","api_key":"test-api-key-123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"
```

**Step 2: Verify token**

```bash
curl -X POST http://api.minibob.local/v2/auth/minibob/verify \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\"}" | jq

# Expected response:
# {
#   "valid": true,
#   "org_id": "metabob_internal",
#   "project_id": null,
#   "instance_id": "minibob-local-001"
# }
```

**Step 3: Use token in API call**

```bash
# Try to register an activity template with the token
curl -X POST http://api.minibob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "variant_id": "test-activity-001",
    "activity_id": "test-activity",
    "variant_name": "Test Activity",
    "description": "Test authentication",
    "category": "test",
    "task_steps": [],
    "scope": "org"
  }' | jq

# Expected: Success (200 OK) or 409 Conflict if already exists
# Should NOT get RBAC error about missing org_id
```

**Success Criteria:**
- ✅ Signin returns JWT token
- ✅ Token verification succeeds with correct claims
- ✅ API calls with token succeed (no RBAC errors)
- ✅ Backend populates org_id from token

---

### Test 6.B.11: MiniBob Helm Chart with Secrets

**Objective:** Verify MiniBob deployment mounts instance credentials correctly

**Check current deployment:**

```bash
# Check if MiniBob deployment has secret mount
kubectl get deployment -n activity-system minibob -o yaml | grep -A 10 "volumes:"

# Check if secret exists
kubectl get secret -n activity-system minibob-instance-credentials
```

**Update MiniBob Helm chart** (if not already done):

`helm/charts/devbob/templates/deployment.yaml`:

```yaml
spec:
  containers:
    - name: minibob
      env:
        - name: MINIBOB_INSTANCE_ID
          value: "minibob-local-001"
        - name: MINIBOB_INSTANCE_API_KEY
          valueFrom:
            secretKeyRef:
              name: minibob-instance-credentials
              key: api-key
        - name: MINIBOB_MCP_ENDPOINT
          value: "http://metabob-activity-api.activity-system.svc.cluster.local:8080"
```

**Redeploy and verify:**

```bash
# Redeploy MiniBob
helmfile -f helm/activity-system-minimal.yaml.gotmpl apply --selector name=devbob

# Check environment variables
kubectl get pods -n activity-system -l app.kubernetes.io/name=minibob -o jsonpath='{.items[0].metadata.name}' | \
  xargs -I {} kubectl exec -n activity-system {} -- env | grep MINIBOB

# Expected:
# MINIBOB_INSTANCE_ID=minibob-local-001
# MINIBOB_INSTANCE_API_KEY=test-api-key-123
# MINIBOB_MCP_ENDPOINT=http://...
```

**Success Criteria:**
- ✅ Secret mounted correctly
- ✅ Environment variables set
- ✅ MiniBob can read instance credentials

---

### Test 6.B.12: Activity Execution with Authenticated Instance

**Objective:** Run an activity template end-to-end with authenticated MiniBob

**Setup:**

```bash
cd repos/minibob

# Set environment variables
export MINIBOB_INSTANCE_ID=minibob-local-001
export MINIBOB_INSTANCE_API_KEY=test-api-key-123
export MINIBOB_MCP_ENDPOINT=http://api.minibob.local
export ANTHROPIC_API_KEY=<your-key>
```

**Run simple activity:**

```bash
# Create a minimal test activity
cat > /tmp/test-auth-activity.json <<'EOF'
{
  "id": "test-auth",
  "name": "Test Authentication",
  "description": "Verify MiniBob can authenticate and execute",
  "category": "test",
  "tasks": [
    {
      "id": "hello",
      "description": "Print hello message",
      "prompt": {
        "template": "Print 'Hello from authenticated MiniBob!' using bash echo command.",
        "variables": []
      },
      "validation": {
        "requireOutput": true
      }
    }
  ]
}
EOF

# Run the activity
bun run index.ts run /tmp/test-auth-activity.json
```

**Expected output:**

```
minibob Configuration:
  ...

Initializing MCP client: http://api.minibob.local
Authenticating instance: minibob-local-001
✓ Instance authenticated

Running activity: /tmp/test-auth-activity.json
...
[Activity executes successfully]

=== Activity Result ===
Status: completed
Duration: ...ms
Tokens: ...
Cost: $...
```

**Check backend received authenticated request:**

```bash
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=50 | grep -i "template\|auth"
```

**Success Criteria:**
- ✅ MiniBob authenticates successfully
- ✅ Activity executes without RBAC errors
- ✅ Backend logs show authenticated requests
- ✅ Template registration succeeds with org_id

---

### Test 6.14: Documentation

**Objective:** Create comprehensive documentation for init-data job

Create `helm/charts/surrealdb/README.md`:

```markdown
# SurrealDB Helm Chart

Deploys SurrealDB 3.0 with automated data initialization.

## Features

- Persistent storage with StatefulSet
- Automated schema initialization via init-data Job
- Default organization and MiniBob instance creation
- RBAC-ready with DEFINE ACCESS support

## Configuration

### Basic deployment

\`\`\`yaml
surrealdb:
  persistence:
    enabled: true
    size: 10Gi
  auth:
    username: root
    password: changeme
  initData:
    enabled: true
\`\`\`

### Init-Data Configuration

The init-data Job runs after schema migrations to create:
- Default organization (configurable)
- MiniBob instance with RECORD authentication

\`\`\`yaml
initData:
  enabled: true
  backoffLimit: 3  # Retry limit
  defaultOrg:
    id: metabob_internal
    name: "Metabob Internal"
  minibob:
    instanceId: minibob-local-001
    vesselId: minibob-cli-local
    secretName: minibob-instance-credentials
    secretKey: api-key
\`\`\`

## Secrets

### SurrealDB Credentials

Auto-created unless `existingSecret` is specified:

\`\`\`yaml
auth:
  existingSecret: ""  # Leave empty to auto-create
  username: root
  password: changeme
\`\`\`

### MiniBob Instance Credentials

Auto-created for local development:

\`\`\`bash
kubectl get secret -n activity-system minibob-instance-credentials -o yaml
\`\`\`

**Production:** Use secure random API key and rotate regularly.

## Init-Data Job

### How it works

1. Runs as post-install/post-upgrade Helm hook
2. Executes after schema migrations (hook-weight: 10)
3. Idempotent - safe to run multiple times
4. Creates organization and instance if they don't exist

### Troubleshooting

**Job failed:**

\`\`\`bash
kubectl logs -n activity-system job/surrealdb-init-data
\`\`\`

Common issues:
- SurrealDB not ready → Job retries automatically
- Schema not migrated → Run migrations first
- Wrong credentials → Check surrealdb-credentials secret

**Verify data created:**

\`\`\`bash
kubectl run test-query -n activity-system \
  --image=metabob-activity-api:latest \
  --rm -i --restart=Never \
  -- bun -e "SELECT * FROM organizations; SELECT * FROM minibob_instance;"
\`\`\`

## Development vs Production

### Development (default)

- Uses default credentials
- API key: "test-api-key-123"
- Auto-creates secrets

### Production

Override with secure values:

\`\`\`yaml
auth:
  existingSecret: "surrealdb-prod-creds"

initData:
  minibob:
    secretName: "minibob-prod-credentials"
\`\`\`

Create secrets manually:

\`\`\`bash
kubectl create secret generic surrealdb-prod-creds \
  --from-literal=username=root \
  --from-literal=password=<secure-random-password>

kubectl create secret generic minibob-prod-credentials \
  --from-literal=api-key=<secure-random-key>
\`\`\`
```

---

## Test Results Template

After running all tests, document results:

```markdown
# Phase 6 Test Results

**Date:** 2026-03-24
**Tester:** <name>

## Test 6.11: Init-Data Job Deployment
- [ ] Job created
- [ ] Job completed successfully
- [ ] No errors in logs

## Test 6.12: Job Logs
- [ ] Logs accessible via kubectl
- [ ] Shows organization creation
- [ ] Shows instance creation
- [ ] No error messages

## Test 6.13: Data Verification
- [ ] Organization record exists
- [ ] Instance record exists
- [ ] Correct org_id reference
- [ ] API key hash present

## Test 6.B.10: Authentication Flow
- [ ] Signin returns JWT
- [ ] Token verification works
- [ ] API calls succeed
- [ ] No RBAC errors

## Test 6.B.11: Helm Secrets
- [ ] Secret mounted correctly
- [ ] Environment variables set
- [ ] MiniBob reads credentials

## Test 6.B.12: Activity Execution
- [ ] MiniBob authenticates
- [ ] Activity executes
- [ ] Template registers
- [ ] No RBAC errors

## Test 6.14: Documentation
- [ ] README created
- [ ] Configuration documented
- [ ] Troubleshooting included
- [ ] Examples provided

## Issues Found

<list any issues>

## Recommendations

<any recommendations>
```

---

## Quick Test Script

Run all tests in sequence:

```bash
#!/bin/bash
set -e

echo "=== Phase 6 Testing Suite ==="

echo "\n1. Deploying stack..."
cd helm && helmfile -f activity-system-minimal.yaml.gotmpl sync

echo "\n2. Waiting for SurrealDB..."
kubectl wait --for=condition=ready pod -l app=surrealdb -n activity-system --timeout=300s

echo "\n3. Checking init-data job..."
kubectl get jobs -n activity-system surrealdb-init-data

echo "\n4. Viewing job logs..."
kubectl logs -n activity-system job/surrealdb-init-data

echo "\n5. Testing authentication..."
curl -X POST http://api.minibob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"minibob-local-001","api_key":"test-api-key-123"}' | jq

echo "\n✅ All tests complete!"
```

Save as `test-phase6.sh` and run with `bash test-phase6.sh`.
