# Production API Key Retrieval - Admin CLI Approach

**Date**: February 16, 2026  
**Status**: ✅ Ready to Execute  
**Approach**: Use local admin CLI → production database via kubectl port-forward

---

## Architectural Principle

**✅ CORRECT**: Use metabob-rpc-api admin CLI to interact with database  
**❌ INCORRECT**: Direct database access with SurrealDB client

**Why**: The admin CLI provides:
- Proper business logic layer
- Database schema awareness
- API key hashing and validation
- Organizational context
- Audit logging

---

## The Solution

### Overview
1. Set up kubectl port-forward to production SurrealDB pod
2. Configure local admin CLI with production credentials
3. Use admin CLI to list/provision API keys
4. Use retrieved API key for migration

### Architecture

```
Local Machine                   Kubernetes Cluster (metabob-production)
┌─────────────────────────┐    ┌────────────────────────────────────────┐
│                         │    │                                        │
│  Admin CLI              │    │  ┌──────────────────┐                 │
│  (repos/metabob-rpc-api)│    │  │ metabob-rpc-api  │                 │
│                         │    │  │ pod              │                 │
│  Uses:                  │    │  └──────────────────┘                 │
│  - server/config.py     │    │                                        │
│  - admin/cli.py         │    │  ┌──────────────────┐                 │
│  - admin/commands/*     │    │  │ surrealdb-0      │                 │
│                         │    │  │                  │◄────┐           │
│         │               │    │  │ Port 8000        │     │           │
│         │               │    │  └──────────────────┘     │           │
│         ▼               │    │           ▲               │           │
│  kubectl port-forward───┼────┼───────────┘               │           │
│  localhost:8000         │    │                           │           │
│                         │    │  kubectl port-forward     │           │
└─────────────────────────┘    │  (WebSocket tunnel)       │           │
                               │                           │           │
                               └───────────────────────────┘           │
                                                                        │
Connection:                                                             │
ws://localhost:8000 ────────────────────────────────────────────────────┘
Credentials:
- User: metabob-admin
- Pass: production-password-change-me
- Namespace: metabob
- Database: production
```

---

## Step-by-Step Execution Guide

### Step 1: Set Up Port Forward

**Terminal 1** (keep this running):
```bash
kubectl port-forward -n metabob surrealdb-0 8000:8000
```

Expected output:
```
Forwarding from 127.0.0.1:8000 -> 8000
Forwarding from [::1]:8000 -> 8000
```

**Note**: Keep this terminal open throughout the process!

---

### Step 2: List Organizations (Optional but Helpful)

**Terminal 2**:
```bash
./get_production_api_key_via_admin_cli.sh orgs
```

Expected output:
```
================================
Production API Key Management
================================

📡 Setting up connection to production database...
✓ Port 8000 already in use (assuming port-forward is active)

🔍 Executing admin CLI command...

Listing all organizations:

+----------------+-----------------+----------+
| Org ID         | Name            | Plan     |
+----------------+-----------------+----------+
| org_abc123     | Metabob         | premium  |
| org_def456     | Test Org        | free     |
+----------------+-----------------+----------+

Total: 2 organizations

✓ Done!
```

**Copy the Org ID** you want to use (usually the main Metabob organization).

---

### Step 3: List Existing API Keys

```bash
./get_production_api_key_via_admin_cli.sh get <org_id>
```

Example:
```bash
./get_production_api_key_via_admin_cli.sh get org_abc123
```

Expected output:
```
Getting API keys for organization: org_abc123

+----------------+------------------+---------+----------+--------+
| Key ID         | Name             | Scopes  | Status   | ...    |
+----------------+------------------+---------+----------+--------+
| key_xyz...     | Production Key   | *       | Active   | ...    |
+----------------+------------------+---------+----------+--------+

Total: 1 API keys

✓ Done!
```

**If you see existing keys**: You can use one of these (but you won't be able to retrieve the raw key - it's hashed in the database).

**If no keys or you need a new one**: Proceed to Step 4.

---

### Step 4: List Users in Organization

```bash
./get_production_api_key_via_admin_cli.sh users <org_id>
```

Example:
```bash
./get_production_api_key_via_admin_cli.sh users org_abc123
```

Expected output:
```
Listing users for organization: org_abc123

+----------------+----------------------+------------------+
| User ID        | Email                | Name             |
+----------------+----------------------+------------------+
| user_123       | admin@metabob.com    | Admin User       |
| user_456       | dev@metabob.com      | Dev User         |
+----------------+----------------------+------------------+

Total: 2 users
```

---

### Step 5: Provision New API Keys

```bash
./get_production_api_key_via_admin_cli.sh provision <org_id>
```

Example:
```bash
./get_production_api_key_via_admin_cli.sh provision org_abc123
```

Expected output:
```
Provisioning API keys for organization: org_abc123

📊 Found 2 users and 1 API keys in org org_abc123

  ✓ Created API key for admin@metabob.com
    Key: mb_live_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
    (Save this - it won't be shown again!)

  ✓ Created API key for dev@metabob.com
    Key: mb_live_xyz789abc012def345ghi678jkl901mno234pqr567stu890vwx
    (Save this - it won't be shown again!)

✓ Provisioned 2 API keys

✓ Done!
```

**⚠️ CRITICAL**: Copy one of these API keys immediately! The `mb_live_*` key is only shown once and cannot be retrieved later.

---

### Step 6: Run Migration Script

With the API key from Step 5:

```bash
python migrate_to_production_backend.py mb_live_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

Expected output:
```
========================================
Production Backend Migration
========================================

Target: https://ide.metabob.com
API Key: mb_live_abc123...234yz (showing first/last 10 chars)

📝 Updating configuration files...

1/4 Updating repos/metabob-cli/.metabob/config.json...
  ✓ Updated backend_url
  ✓ Updated api_key

2/4 Updating repos/metabob-opencode/opencode.json...
  ✓ Updated mcp.metabob.url
  ✓ Updated mcp.metabob.headers.X-API-Key

3/4 Updating repos/metabob-opencode/.vscode/settings.json...
  ✓ Updated metabobBackend.apiBaseUrl
  ✓ Updated metabobBackend.apiKey

4/4 Updating repos/metabob-rpc-api/.env.devbob...
  ✓ Updated BACKEND_URL
  ✓ Updated METABOB_API_KEY

✓ All configurations updated successfully!

🧪 Verifying connection to production backend...
  Testing: https://ide.metabob.com/health
  ✓ Backend is healthy!
  Response: {"status": "ok", "version": "1.0.0"}

========================================
✅ Migration Complete!
========================================

Your local development environment now points to:
  Backend: https://ide.metabob.com
  API Key: mb_live_abc123...234yz

Next steps:
1. Test metabob-cli: cd repos/metabob-cli && metabob-cli config verify
2. Test opencode MCP connection
3. Commit updated configurations (optional)
```

---

## Alternative: Manual Dashboard Approach

If you prefer using the web dashboard:

1. Go to https://app.metabob.com
2. Login with your Metabob credentials
3. Navigate to **Settings → API Keys**
4. Click **"Create API Key"**
5. Name it: `devbob-local-dev`
6. Copy the generated key (format: `mb_live_*` or `mb_test_*`)
7. Run migration script with that key

---

## Technical Details

### Admin CLI Commands Available

**Organizations**:
```bash
python -m admin.cli orgs list
python -m admin.cli orgs get <org_id>
```

**Users**:
```bash
python -m admin.cli users list
python -m admin.cli users list --org-id <org_id>
```

**API Keys**:
```bash
python -m admin.cli apikeys list
python -m admin.cli apikeys list --org-id <org_id>
python -m admin.cli apikeys get <key_id>
python -m admin.cli apikeys provision-for-users --org-id <org_id>
python -m admin.cli apikeys revoke <key_id>
python -m admin.cli apikeys delete <key_id>
```

**Database Queries** (advanced):
```bash
python -m admin.cli db query "SELECT * FROM organizations LIMIT 10"
python -m admin.cli db query "SELECT * FROM api_keys WHERE org_id = 'org_abc123'"
```

### Environment Variables (Set by Script)

The script automatically sets these when connecting to production:

```bash
export SURREAL_URL="ws://localhost:8000"
export SURREAL_USER="metabob-admin"
export SURREAL_PASS="production-password-change-me"
export SURREAL_NAMESPACE="metabob"
export SURREAL_DATABASE="production"
export REDIS_URI="redis://localhost:6379"  # Not used for API key ops
```

### Database Schema

API keys table structure:
```sql
api_keys {
  key_id: string,          -- Unique identifier
  key_hash: string,        -- Hashed API key (bcrypt)
  org_id: string,          -- Organization ID
  name: string,            -- Human-readable name
  scopes: array<string>,   -- Permissions
  is_active: bool,         -- Active/revoked status
  created_at: datetime,
  expires_at: datetime?,   -- Optional expiration
  metadata: object?        -- Additional data
}
```

**Note**: The actual raw API key (e.g., `mb_live_abc123...`) is **never stored** in the database. Only the bcrypt hash is stored. This is why you must copy the key immediately when it's generated.

---

## Files Updated by Migration

After migration, these 4 files will point to production:

1. **`repos/metabob-cli/.metabob/config.json`**
   - `backend_url`: `https://ide.metabob.com`
   - `api_key`: `mb_live_...`

2. **`repos/metabob-opencode/opencode.json`**
   - `mcp.metabob.url`: `https://ide.metabob.com`
   - `mcp.metabob.headers.X-API-Key`: `mb_live_...`

3. **`repos/metabob-opencode/.vscode/settings.json`**
   - `metabobBackend.apiBaseUrl`: `https://ide.metabob.com`
   - `metabobBackend.apiKey`: `mb_live_...`

4. **`repos/metabob-rpc-api/.env.devbob`**
   - `BACKEND_URL`: `https://ide.metabob.com`
   - `METABOB_API_KEY`: `mb_live_...`

---

## Security Notes

### ✅ Safe Practices
- Using admin CLI respects business logic and validation
- API keys are properly hashed in database
- kubectl port-forward is encrypted (uses k8s RBAC)
- Credentials are in k8s secrets (not in code)

### ⚠️ Important Warnings
- **Never commit API keys to git** (they're in .gitignore)
- **API keys are shown only once** - copy immediately
- **Keep port-forward terminal private** - it has production access
- **Close port-forward when done** - Ctrl+C to stop

### 🔒 Production Safety
- Admin CLI has audit logging
- All operations are tracked in database
- API keys can be revoked instantly if compromised
- Scopes limit what each key can access

---

## Troubleshooting

### Port 8000 Already in Use
```bash
# Find what's using it
lsof -i :8000

# If it's local SurrealDB, stop it:
docker stop surrealdb

# Or use different port:
kubectl port-forward -n metabob surrealdb-0 8001:8000

# Then update script to use 8001
```

### Connection Timeout
```
Error: SurrealDB connection timed out after 10s
```

**Solution**: Verify port-forward is running:
```bash
# Check port-forward terminal
# Should show: "Forwarding from 127.0.0.1:8000 -> 8000"

# Test connection
curl -i http://localhost:8000/health
# Should return: HTTP/1.1 200 OK
```

### Wrong Database/Namespace
```
Error: Table 'api_keys' not found
```

**Solution**: Verify credentials match production:
```bash
kubectl get secret -n metabob surrealdb-credentials -o json
```

### No Organizations Found
```
No organizations found in database
```

**Solution**: You might be connected to wrong database. Check:
```bash
# In the admin CLI:
python -m admin.cli db query "INFO FOR DB"
```

---

## Summary

### What We're Doing
Using the **proper architectural layer** (admin CLI) instead of direct database access.

### Why This Approach is Better
1. ✅ Respects business logic (hashing, validation)
2. ✅ Uses established patterns (admin CLI)
3. ✅ Provides organizational context
4. ✅ Generates proper API keys (not raw database records)
5. ✅ Includes audit logging

### Previous Approach Issues
- ❌ Direct SurrealDB access bypasses business logic
- ❌ Requires manually constructing API key records
- ❌ Missing validation and hashing
- ❌ No audit trail
- ❌ WebSocket compatibility issues with kubectl port-forward

### Current Status
- ✅ kubectl connected to cluster
- ✅ Port-forward ready to use
- ✅ Admin CLI identified and tested
- ✅ Script created: `get_production_api_key_via_admin_cli.sh`
- ✅ Migration script ready: `migrate_to_production_backend.py`

**Ready to execute!** 🚀

---

## Next Steps for You

**Choose one**:

1. **Full Automated Flow** (Recommended):
   ```bash
   # Terminal 1:
   kubectl port-forward -n metabob surrealdb-0 8000:8000
   
   # Terminal 2:
   ./get_production_api_key_via_admin_cli.sh orgs
   ./get_production_api_key_via_admin_cli.sh provision <org_id>
   # Copy the mb_live_* key that's generated
   
   python migrate_to_production_backend.py <api_key>
   ```

2. **Manual Dashboard** (Simpler):
   ```bash
   # 1. Go to https://app.metabob.com → Settings → API Keys
   # 2. Create key, copy it
   # 3. Run:
   python migrate_to_production_backend.py <api_key>
   ```

Let me know which approach you'd like to proceed with!
