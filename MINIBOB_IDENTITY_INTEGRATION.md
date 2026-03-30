# MiniBob Identity Vessel Integration

## Current State

### MiniBob Authentication Flow (as-is)

MiniBob currently authenticates with metabob-activity-api using a **MiniBob-specific endpoint**:

```typescript
// repos/minibob/src/mcp.ts:137
async authenticateInstance(): Promise<string | null> {
  const response = await this.request("POST", "/v2/auth/minibob/signin", {
    instance_id: this.instance.instanceId,
    api_key: this.instance.apiKey,
  })

  const data = await response.json() as { token?: string; org_id?: string }

  if (data.token) {
    this.jwtToken = data.token
    this.instance.orgId = data.org_id
    console.log(`[MCP] ✓ Authenticated as instance ${this.instance.instanceId}`)
  }
}
```

**Configuration** (from `.env`):
```bash
MINIBOB_INSTANCE_ID=minibob-local-001
MINIBOB_INSTANCE_API_KEY=test-api-key-123
ACTIVITY_API_ENDPOINT=http://activity.metabob.local
```

**Authentication Result:**
- Returns JWT token valid for 24 hours
- Token includes `org_id` in `$auth` claims
- Used for all subsequent API calls to activity-api

---

## Identity Vessel Architecture

### What is Identity Vessel?

A **lightweight authentication service** that provides:
- HMAC-based API key generation and validation
- No database storage of keys (only metadata)
- ~2ms validation latency
- Follows the impulse-activity vessel pattern

### Deployment Status

✅ **Already deployed** in the cluster:
```bash
$ kubectl get services -n activity-system
NAME                      TYPE        CLUSTER-IP       PORT(S)
identity-vessel           ClusterIP   10.106.203.215   8080/TCP
```

**Hostname:** `http://identity.metabob.local` (external) or `http://identity-vessel.activity-system.svc.cluster.local:8080` (internal)

### API Key Format

Keys are base64url-encoded:
```
Base64(mb_live-<org_id>-<user_id>-<key_id>-<signature>)
```

**Example (decoded):**
```
mb_test-metabob_com-usr_minibob-key_9KC_OLqqSg5H04U-a0fd09be1769938cf640087c001853d5
```

### Authentication Methods Supported

Identity vessel supports **two authentication methods**:

#### 1. API Key Authentication (for MiniBob)
```typescript
POST /v1/auth/resolve
Content-Type: application/json

{
  "impulse": {
    "type": "authentication",
    "pointer": {
      "type": "apiKey",
      "apiKey": "bWJfdGVzdC1tZXRhYm9iX2NvbS11c3JfbWluaWJvYi1rZXlfOUtDLi4u"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "orgId": "metabob_com",
    "userId": "usr_minibob",
    "keyId": "key_9KC_OLqqSg5H04U",
    "scopes": ["read", "write"]
  }
}
```

#### 2. Session Authentication (for Dashboard Users)
- Handled by metabob-activity-api or metabob-analysis-api
- Email/password login → JWT token (15 min expiry)
- NOT handled by identity vessel

---

## Integration Options

### Option 1: Keep Current MiniBob Auth (Recommended for Now)

**Why:**
- MiniBob auth is working and tested
- Uses RECORD-based authentication with minibob_instance table
- Returns 24-hour JWT tokens
- No migration needed

**What needs to happen:**
- Nothing! Current flow is valid
- Identity vessel is for **API keys** (CLI tools, IDEs)
- MiniBob uses **instance authentication** (different pattern)

**When to use Identity Vessel:**
- When MiniBob needs to **generate API keys for users**
- When MiniBob acts as a **proxy for API key management**
- When we want **programmatic access** to MiniBob from external tools

### Option 2: Migrate MiniBob to API Key Auth (Future)

**Why:**
- Unified authentication across all vessels
- Leverage identity vessel's HMAC validation
- Better key rotation and revocation
- Consistent with other programmatic access

**Migration Steps:**

1. **Generate MiniBob API Key via Identity Vessel**
   ```bash
   # Use identity vessel to generate key for minibob user
   curl -X POST http://identity.metabob.local/v1/keys/generate \
     -H "Authorization: Bearer <admin-key>" \
     -H "Content-Type: application/json" \
     -d '{
       "targetUserId": "usr_minibob",
       "name": "MiniBob Instance: minibob-local-001",
       "scopes": ["read", "write", "activity:execute"],
       "expiresInDays": 365
     }'
   ```

2. **Update MiniBob Configuration**
   ```bash
   # .env changes
   - MINIBOB_INSTANCE_ID=minibob-local-001
   - MINIBOB_INSTANCE_API_KEY=test-api-key-123
   + MINIBOB_API_KEY=bWJfdGVzdC1tZXRhYm9iX2NvbS11c3JfbWluaWJvYi1...
   ```

3. **Update MCP Client Auth**
   ```typescript
   // src/mcp.ts - New method
   async authenticateWithApiKey(): Promise<boolean> {
     // No authentication call needed!
     // API key is validated per-request by activity-api

     // Activity-api middleware calls identity-vessel to validate
     this.apiKey = config.apiKey
     return true
   }
   ```

4. **Update Activity API Middleware**
   ```typescript
   // metabob-activity-api/src/middleware/auth.ts
   app.use('/v2/*', async (c, next) => {
     const authHeader = c.req.header('Authorization')
     const apiKey = authHeader?.replace('Bearer ', '')

     // Call identity vessel to validate
     const response = await fetch('http://identity-vessel:8080/v1/auth/resolve', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         impulse: {
           type: 'authentication',
           pointer: { type: 'apiKey', apiKey }
         }
       })
     })

     const result = await response.json()

     if (!result.success || !result.data.authenticated) {
       return c.json({ error: 'Unauthorized' }, 401)
     }

     c.set('auth', {
       orgId: result.data.orgId,
       userId: result.data.userId,
       keyId: result.data.keyId,
       scopes: result.data.scopes
     })

     await next()
   })
   ```

---

## Recommended Approach

### Phase 1: Parallel Authentication (Current)

**Keep MiniBob's current auth** (`/v2/auth/minibob/signin`)
- No changes needed
- MiniBob continues working
- Identity vessel handles CLI/IDE tools only

**Use Identity Vessel for:**
- metabob-mcp (VS Code extension)
- metabob-cli (command line tool)
- Third-party integrations
- User-generated API keys in dashboard

### Phase 2: Unified Authentication (Future)

**When ready:**
1. Deploy identity-vessel integration to activity-api
2. Generate MiniBob API keys via identity vessel
3. Update MiniBob to use API key auth
4. Migrate all vessels to use identity vessel
5. Deprecate custom auth endpoints

---

## Testing Current Setup

### 1. Verify Identity Vessel is Running

```bash
# Check service
kubectl get pods -n activity-system -l app.kubernetes.io/name=identity-vessel

# Check health
curl http://identity.metabob.local/health

# Check capabilities
curl http://identity.metabob.local/capabilities | jq
```

### 2. Test MiniBob Current Auth

```bash
# Test MiniBob instance authentication
curl -X POST http://api.minibob.local/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "minibob-local-001",
    "api_key": "test-api-key-123"
  }' | jq
```

Expected:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "org_id": "metabob_internal",
  "project_id": "default"
}
```

### 3. Test Identity Vessel API Key Validation

```bash
# First, generate a test API key (requires admin access)
# For now, identity vessel doesn't have bootstrap keys yet

# Once we have a key, test validation:
curl -X POST http://identity.metabob.local/v1/auth/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "impulse": {
      "type": "authentication",
      "pointer": {
        "type": "apiKey",
        "apiKey": "<base64-encoded-key>"
      }
    }
  }' | jq
```

---

## Configuration Files

### MiniBob Current Config
```bash
# repos/minibob/.env
ANTHROPIC_API_KEY=sk-ant-api03-...
ACTIVITY_API_ENDPOINT=http://activity.metabob.local
MINIBOB_INSTANCE_ID=minibob-local-001
MINIBOB_INSTANCE_API_KEY=test-api-key-123
```

### Identity Vessel Config
```bash
# Deployment values (repos/deployment/charts/identity-vessel/values.yaml)
env:
  - name: PORT
    value: "8080"
  - name: NODE_ENV
    value: production
  - name: REDIS_URL
    value: redis://redis-valkey-master.activity-system.svc.cluster.local:6379

secrets:
  apiKeySecret: "dev-secret-change-me"  # HMAC signing secret
```

### Istio Gateway Routing
```yaml
# Should be added to repos/deployment/charts/istio-gateway/values.yaml
identity:
  enabled: true
  host: identity.metabob.local
  service: identity-vessel
  port: 8080
```

---

## Next Steps

### Immediate (No Changes Needed)
1. ✅ Identity vessel is deployed
2. ✅ MiniBob authentication works
3. ✅ Both can coexist

### Short Term (When Needed)
1. Add identity-vessel to Istio gateway for external access
2. Generate bootstrap API key for testing
3. Implement API key management in cloud dashboard

### Long Term (Optional Migration)
1. Add identity-vessel middleware to activity-api
2. Generate API keys for MiniBob instances
3. Migrate MiniBob to use API key authentication
4. Deprecate custom `/v2/auth/minibob/signin` endpoint

---

## Key Insights

### Why Two Auth Methods?

**MiniBob Instance Auth** (current):
- Authenticates the **vessel itself** as a trusted instance
- Uses instance credentials stored in Kubernetes secrets
- Returns long-lived JWT (24 hours)
- Records traces under the instance's identity

**API Key Auth** (identity vessel):
- Authenticates **user actions** via programmatic access
- Uses HMAC-signed keys generated per user
- Validated per-request (<2ms)
- Supports key rotation, revocation, scopes

### Both Are Valid!

MiniBob's current authentication is **correct and appropriate** for vessel-to-vessel communication. Identity vessel is for **user-to-vessel** programmatic access.

**Current architecture is fine as-is.**
