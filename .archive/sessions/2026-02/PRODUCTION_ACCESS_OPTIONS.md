# Production Backend Access Options

**Date**: February 16, 2026  
**Status**: kubectl connectivity blocked - exploring alternatives  
**Goal**: Obtain production API key for backend migration

---

## Current Situation

### ✅ What's Working
- Production backend is healthy: `https://ide.metabob.com/health` → HTTP 200
- Local migration script is ready: `migrate_to_production_backend.py`
- gcloud CLI configured with `metabob` project
- kubectl context set to `metabob-production`

### ❌ Current Blocker
- kubectl commands timing out when connecting to GKE cluster
- Cluster endpoint: `https://34.102.74.217`
- Error: Cannot connect to cluster

### 🎯 What We Need
- Production API key with format: `mb_live_*` or `mb_test_*`
- For organization: `devbob` (or equivalent)
- With scopes: `read`, `write`, `admin`

---

## Option 1: Fix kubectl Connectivity (RECOMMENDED)

### Problem Analysis
```bash
# Current state
kubectl config current-context
# → metabob-production

kubectl cluster-info
# → Timeout connecting to https://34.102.74.217
```

### Possible Causes
1. **GKE auth plugin not configured** - Need to install/configure gke-gcloud-auth-plugin
2. **Expired credentials** - gcloud credentials may need refresh
3. **Network/firewall** - Cluster may have IP restrictions
4. **Cluster location mismatch** - Cluster may be in different region

### Troubleshooting Steps

#### Step 1: Check GKE Auth Plugin
```bash
# Check if plugin is installed
gke-gcloud-auth-plugin --version

# If not installed:
# For Debian/Ubuntu:
sudo apt-get install google-cloud-sdk-gke-gcloud-auth-plugin

# For other systems:
gcloud components install gke-gcloud-auth-plugin
```

#### Step 2: Refresh Credentials
```bash
# List available clusters
gcloud container clusters list --project metabob

# Get fresh credentials (replace region if different)
gcloud container clusters get-credentials production \
  --region us-west2 \
  --project metabob

# Test connection
kubectl cluster-info
```

#### Step 3: Verify Cluster Access
```bash
# Check current user permissions
kubectl auth can-i --list

# Try to list namespaces (basic permission test)
kubectl get namespaces

# If successful, list backend pods
kubectl get pods -n metabob -l app=metabob-rpc-api
```

#### Step 4: Access Admin CLI (once kubectl works)
```bash
# Find backend pod
POD_NAME=$(kubectl get pods -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')

# List organizations
kubectl exec -n metabob $POD_NAME -- python -m admin.cli orgs list

# List API keys for devbob org
kubectl exec -n metabob $POD_NAME -- python -m admin.cli apikeys list --org-id devbob

# Create new API key (if needed)
kubectl exec -n metabob $POD_NAME -- python -m admin.cli apikeys create \
  --org-id devbob \
  --name "devbob-local-dev" \
  --scopes read,write,admin
```

---

## Option 2: Use Production Dashboard UI

### Access via Web Browser

1. **Navigate to**: `https://app.metabob.com`

2. **Login** with production credentials

3. **Navigate to API Keys**:
   - Settings → API Keys
   - Organization Settings → API Keys
   - Profile → Developer Settings → API Keys

4. **Create or Retrieve Key**:
   - Click "Create API Key" or "New API Key"
   - Name: `devbob-local-development`
   - Scopes: `read`, `write`, `admin`
   - Organization: Select `devbob` or equivalent
   - Copy key (format: `mb_live_xxxxxxxxxxxxxxxxxxxx`)

5. **Provide to Migration**:
   ```bash
   python migrate_to_production_backend.py \
     --url "https://ide.metabob.com" \
     --api-key "mb_live_YOUR_KEY_HERE" \
     --dry-run
   ```

### Pros
- ✅ No command-line tools needed
- ✅ Visual interface, easy to navigate
- ✅ Can manage all API keys in one place

### Cons
- ❌ Need dashboard credentials
- ❌ May not have devbob org in production yet

---

## Option 3: Direct Database Connection

### If You Have Production Database Credentials

The production backend connects to SurrealDB at `ws://surrealdb:8000` (internal cluster DNS).

If you have external access to the production database:

```bash
cd repos/metabob-rpc-api

# Set production database credentials
export SURREAL_URL="<production-external-db-url>"
export SURREAL_USER="<admin-username>"
export SURREAL_PASS="<admin-password>"
export SURREAL_NAMESPACE="metabob"
export SURREAL_DATABASE="production"

# List API keys
./admin-cli.sh apikeys list --org-id devbob

# Create API key
./admin-cli.sh apikeys create \
  --org-id devbob \
  --name "devbob-local-dev" \
  --scopes read,write,admin
```

### Pros
- ✅ Direct database access
- ✅ Full admin CLI capabilities
- ✅ No kubernetes needed

### Cons
- ❌ Need production database credentials
- ❌ Database may not be externally accessible
- ❌ Security concern (direct DB access)

---

## Option 4: Port-Forward via kubectl (If Partial kubectl Works)

If kubectl connection is slow but functional:

```bash
# Port-forward to backend pod
kubectl port-forward -n metabob \
  deployment/metabob-rpc-api \
  8080:8080

# In another terminal, use local admin CLI with port-forward
cd repos/metabob-rpc-api

# Configure to use port-forward
export SURREAL_URL="ws://localhost:8000"  # Won't work without DB port-forward too

# This option requires BOTH backend AND database port-forwards
```

### Limitation
This still requires working kubectl connection and database access.

---

## Option 5: Request API Key from Team

### If Admin Access Not Available

Contact team member with production admin access to:

1. Create API key for `devbob` organization
2. Provide key in secure manner
3. Specify key details:
   - Organization: `devbob`
   - Scopes: `read`, `write`, `admin`
   - Name: `devbob-local-development`

---

## Recommended Approach

### Priority Order:

1. **Fix kubectl connectivity** (most direct, full control)
   - Troubleshoot auth plugin
   - Refresh credentials
   - Test cluster access

2. **Use dashboard UI** (if kubectl troubleshooting takes too long)
   - Quick alternative
   - Visual and user-friendly

3. **Request from team** (if no admin access available)
   - Last resort
   - Depends on team availability

---

## After Obtaining API Key

Once you have the production API key:

### Step 1: Test API Key
```bash
# Test session creation
curl -X POST https://ide.metabob.com/v2/session \
  -H "X-API-Key: mb_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "default"}'

# Should return HTTP 200 with session token
```

### Step 2: Dry Run Migration
```bash
python migrate_to_production_backend.py \
  --url "https://ide.metabob.com" \
  --api-key "mb_live_YOUR_KEY" \
  --dry-run
```

### Step 3: Execute Migration
```bash
python migrate_to_production_backend.py \
  --url "https://ide.metabob.com" \
  --api-key "mb_live_YOUR_KEY"
```

### Step 4: Verify MCP Integration
```bash
cd repos/metabob-cli
metabob-cli mcp --transport stdio

# Test with OpenCode
# Should see production activity templates
```

---

## Files Modified by Migration

The migration script will update these files:

1. `repos/metabob-cli/.metabob/config.json`
2. `repos/metabob-opencode/.metabob/config.json`
3. `repos/metabob-opencode/packages/opencode/.metabob/config.json`
4. `opencode.json` (MCP server configuration)

All will point to:
```json
{
  "base_url": "https://ide.metabob.com",
  "api_key": "mb_live_YOUR_KEY",
  "state_directory": ".metabob"
}
```

---

## Next Steps

**Choose your path and let me know**:

- **"Fix kubectl"** → I'll help troubleshoot GKE connectivity
- **"Use dashboard"** → I'll guide you through the UI
- **"Have API key"** → Provide it and we'll proceed with migration
- **"Request from team"** → I'll document the key requirements

**Current recommendation**: Try fixing kubectl first (Option 1) as it provides the most control and future flexibility.
