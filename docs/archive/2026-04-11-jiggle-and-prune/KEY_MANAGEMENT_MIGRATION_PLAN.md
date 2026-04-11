# API Key Management Migration Plan

## Current Problem

**Inconsistent key formats across environments:**
```
mb_live_1775604106145_a9b6cd5b1e9aaf06c2ad0b96362341dbff397453655d3012b2d31ee12b07a7f3
mb_self_canary_1775062469_0b62423d2d188fee369e66a1ed8f0990e1f1832e57765d6c4fb5b9fadd9e62f5
mb_inst_canary_03b4cfa7ef9bf84b90b7a25d74bd91975ba1a5c67e10b7d8220d8b3559d2463e
```

**Problems:**
- Keys manually created, hardcoded in SOPS secrets
- No standard format (some have timestamps, some don't)
- No rotation mechanism
- No audit trail
- Scattered across deployment configs

## Solution: Use Identity-Vessel API

Identity-vessel **already implements** a complete key management API:

### API Endpoints (Already Deployed)

```bash
# Generate new API key
POST https://identity.metabob.com/v1/keys/generate
{
  "org_id": "metabob",
  "user_id": "users:abc123",
  "name": "Canary Dashboard Key",
  "scopes": ["activities:read", "activities:write"],
  "expires_in_days": 365
}

# Response
{
  "success": true,
  "data": {
    "key": "bWJfbGl2ZS1tZXRhYm9iLXVzZXJzOmFiYzEyMy1rZXlfYWJjZGVmLTEyMzQ1...",
    "key_id": "key_abc123def456",
    "prefix": "mb_live",
    "expires_at": "2027-04-09T...",
    "metadata": { /* for storage */ }
  }
}

# Validate API key
POST https://identity.metabob.com/v1/keys/validate
{
  "api_key": "bWJfbGl2ZS1tZXRhYm9iLXVzZXJzOmFiYzEyMy1rZXlfYWJjZGVmLTEyMzQ1..."
}

# Revoke API key
POST https://identity.metabob.com/v1/keys/revoke
{
  "key_id": "key_abc123def456"
}
```

### Standard Key Format (HMAC-signed, Human-Readable)

```
Format: mb_{env}-{org_id}-{user_id}-{key_id}-{hmac_signature}

Example:
mb_live-metabob-users:kre88ea3i1vmuj1gd12a-key_n1eskHEbDDAFM1zw-12e8146c1fc103ab91bc9757bdeaccd0

Benefits:
✓ Clear mb_ prefix visible at a glance
✓ No encoding/decoding overhead
✓ HMAC-signed for cryptographic security
✓ Dash-separated components for easy parsing
✓ Environment indicator (live vs test)
```

## Migration Steps

### Phase 1: Canary Environment (Immediate)

1. **Generate new keys via identity-vessel API:**
```bash
# User key for dashboard/CLI
curl -X POST https://identity.metabob.com/v1/keys/generate \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "metabob",
    "user_id": "users:kre88ea3i1vmuj1gd12a",
    "name": "Canary User Key",
    "scopes": ["activities:read", "activities:write", "templates:read", "templates:write"],
    "expires_in_days": 365
  }'

# MiniBob instance key
curl -X POST https://identity.metabob.com/v1/keys/generate \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "metabob",
    "user_id": "users:kre88ea3i1vmuj1gd12a",
    "name": "MiniBob Canary Instance",
    "scopes": ["activities:*", "templates:*"],
    "expires_in_days": 365
  }'
```

2. **Update secrets file:**
```yaml
# repos/deployment/secrets/canary.secrets.yaml
secrets:
  metabobApiKey: {new_key_from_identity_vessel}
```

3. **Encrypt and deploy:**
```bash
sops -e -i secrets/canary.secrets.yaml
helmfile -e canary sync
```

### Phase 2: Init-Data Chart Update (This Week)

**Remove hardcoded keys** from init-data chart:

```yaml
# OLD: repos/deployment/secrets/canary.secrets.yaml
initData:
  users:
    - email: self@metabob.com
      apiKeys:  # REMOVE THIS - keys generated via API instead
        - name: self-canary
          key: mb_self_canary_...
```

**NEW: Generate at runtime**:

```typescript
// repos/deployment/charts/init-data/templates/job.yaml
// Add post-install hook to generate keys via identity-vessel

async function provisionKeys() {
  for (const user of users) {
    const { data } = await fetch('https://identity.metabob.com/v1/keys/generate', {
      method: 'POST',
      body: JSON.stringify({
        org_id: user.orgId,
        user_id: user.id,
        name: `${user.name} - ${environment}`,
        scopes: user.scopes,
        expires_in_days: 365
      })
    });
    
    // Store metadata in SurrealDB api_key table
    await db.create('api_key', data.metadata);
    
    // Return key to user (one-time display)
    console.log(`Generated key for ${user.email}: ${data.key}`);
  }
}
```

### Phase 3: Self-Service Key Management (Next Week)

**Add UI to dashboard:**

```typescript
// Activity Dashboard → Settings → API Keys

function APIKeyManager() {
  const generateKey = async () => {
    const response = await fetch('https://identity.metabob.com/v1/keys/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userJwtToken}` },
      body: JSON.stringify({
        org_id: currentOrg.id,
        user_id: currentUser.id,
        name: keyName,
        scopes: selectedScopes,
        expires_in_days: 365
      })
    });
    
    const { data } = await response.json();
    
    // Show key ONCE, user must copy it
    showModal(`Your API Key: ${data.key}\n\nThis will only be shown once!`);
  };
  
  return (
    <div>
      <button onClick={generateKey}>Generate New API Key</button>
      <KeyList keys={userKeys} onRevoke={revokeKey} />
    </div>
  );
}
```

### Phase 4: Automated Rotation (Next Month)

**Add rotation script:**

```typescript
// scripts/rotate-keys.ts

import { Surreal } from 'surrealdb';

async function rotateExpiredKeys() {
  const db = new Surreal();
  await db.connect(SURREALDB_URL);
  await db.use({ namespace, database });
  
  // Find keys expiring in < 30 days
  const expiringKeys = await db.query(`
    SELECT * FROM api_key 
    WHERE expires_at < time::now() + 30d
    AND is_active = true
  `);
  
  for (const key of expiringKeys[0]) {
    // Generate new key via identity-vessel
    const response = await fetch('https://identity.metabob.com/v1/keys/generate', {
      method: 'POST',
      body: JSON.stringify({
        org_id: key.org_id,
        user_id: key.user_id,
        name: `${key.name} (rotated)`,
        scopes: key.scopes,
        expires_in_days: 365
      })
    });
    
    const { data } = await response.json();
    
    // Store new key metadata
    await db.create('api_key', data.metadata);
    
    // Notify user
    await sendEmail(key.user_id, {
      subject: 'API Key Expiring Soon',
      body: `Your key "${key.name}" expires in 30 days. New key: ${data.key}`
    });
    
    // Revoke old key after 7 day grace period
    setTimeout(() => revokeKey(key.key_id), 7 * 24 * 60 * 60 * 1000);
  }
}

// Run daily via cron
schedule.every('1d').at('02:00').run(rotateExpiredKeys);
```

## Benefits

1. **Consistent format**: All keys use identity-vessel's HMAC format
2. **Centralized management**: Single source of truth
3. **Self-service**: Users generate their own keys
4. **Audit trail**: All operations logged
5. **Automatic rotation**: Keys expire and rotate automatically
6. **Revocation**: Instant key revocation via Redis
7. **Security**: HMAC signatures prevent forgery

## Timeline

- **Week 1** (This week): Generate new canary keys via API
- **Week 2**: Update init-data chart to use API
- **Week 3**: Add UI for self-service key management
- **Week 4**: Implement automated rotation

## Migration Checklist

- [ ] Generate new canary user key via identity-vessel
- [ ] Generate new canary MiniBob instance key
- [ ] Update repos/minibob/.env with new key
- [ ] Update canary.secrets.yaml with new keys
- [ ] Deploy updated secrets to canary
- [ ] Verify authentication works
- [ ] Document new key generation process
- [ ] Remove hardcoded keys from init-data chart
- [ ] Add self-service key management UI
- [ ] Implement automated rotation script
- [ ] Set up monitoring/alerting for key expiration

