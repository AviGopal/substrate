# API Key Format Migration Plan

**Status**: In Progress (Identity-vessel deployed to canary)
**Created**: 2026-04-09
**Target Completion**: 2026-04-10

## New Format Specification

**Format**: `mb-[base64(payload)]-{signature}`

Where:
- **Prefix**: Always `mb-` (no environment distinction)
- **Payload** (base64url encoded): `{org-id}-{member-id}-{key-id}-{iss}`
- **Signature**: 32-character HMAC-SHA256 truncated hash

**Example**:
```
mb-bWV0YWJvYi11c2Vyczp0ZXN0dXNlci1rZXlfYVRIVWl2M2loUnBLdzVXWi1odHRwczovL2lkZW50aXR5Lm1ldGFib2IuY29t-5d20e324ecae48c586943485bdd685fd
```

**Architectural Alignment**:
- No stable/unstable dichotomy - all keys production-ready
- Accept errors for learning, failover to reliable pathways
- Never lose traces, templates, or execution provenance

## Current Status

### ✅ Completed
1. Identity-vessel implementation (commit `72e9ef8`)
   - Updated `keyGeneration.ts` with custom nanoid (no dashes)
   - Updated `validation.ts` with lastIndexOf parsing
   - All 41 tests passing
   - Deployed to canary (in progress)

### 🔄 In Progress
1. CI/CD deployment to canary
   - Run ID: 24212651665
   - Building Docker images for identity-vessel

### ⏳ Pending
1. Update all vessels using API keys
2. Migrate configuration files
3. Regenerate all API keys
4. Update documentation
5. Update GitHub secrets

## Locations Requiring Updates

### 1. Vessel Code Changes

#### metabob-activity-api
**Files**:
- `src/services/auth.ts` - validateApiKeyViaIdentityVessel (already calls identity-vessel, should work)
- `src/services/auth.ts` - validateApiKeyDirect (fallback, needs format awareness)

**Status**: Likely compatible (delegates to identity-vessel)
**Action**: Verify compatibility, update fallback if needed

#### minibob
**Files**:
- `src/http-client.ts` - Uses API keys in Authorization headers
- `src/config.ts` - Resolves API keys from config/env

**Status**: Should work (just passes keys through)
**Action**: Verify, update any local validation

#### user-vessel
**Files**:
- `src/routes/api-keys.ts` - Delegates to identity-vessel for generation
- `src/services/identity-vessel.ts` - Client for identity-vessel

**Status**: Should work (delegates generation)
**Action**: Verify, ensure proper integration

### 2. Configuration Files

#### Local Development (.env files)
**Files**:
- `repos/deployment/vessels/minibob/.env`
  - METABOB_API_KEY (current: `mb_trial_1775103014_...`)
  - MINIBOB_INSTANCE_API_KEY (current: `mb_inst_local_...`)

**Action**: Regenerate keys with new format

- `repos/deployment/vessels/minibob/.env.test`
  - METABOB_API_KEY (current: `mb_trial_...`)

**Action**: Regenerate keys with new format

- `repos/deployment/vessels/minibob/.env.production.local`
  - MINIBOB_INSTANCE_API_KEY (current: plaintext `mb_prod_avi_local_key_001`)

**Action**: Regenerate with proper format and hashing

#### Encrypted Secrets (SOPS)
**Files**:
- `repos/deployment/secrets/local.secrets.yaml`
  - identityVessel.apiKeySecret (HMAC secret - keep as is)
  - initData.users[0].apiKeys[*] (current: `mb_self_local_...`, `mb_self_canary_...`, `mb_self_prod_...`)
  - initData.minibobInstances[*].apiKey (encrypted instance keys)

**Action**: Decrypt, regenerate all keys, re-encrypt

- `repos/deployment/secrets/canary.secrets.yaml`
  - Same structure as local

**Action**: Decrypt, regenerate all keys, re-encrypt

- `repos/deployment/secrets/production.secrets.yaml`
  - Same structure as local

**Action**: Decrypt, regenerate all keys, re-encrypt

#### GitHub Actions Secrets
**Secrets**:
- `METABOB_API_KEY` (used in terminal-observe-and-learn.yml)
- `INTERNAL_API_KEY` (used in deploy-canary.yml)

**Action**: Generate new keys via identity-vessel API, update GitHub secrets

### 3. Documentation Updates

#### High Priority
1. **`repos/deployment/vessels/identity-vessel/README.md`**
   - Lines 16-40: Update from base64url format to new format
   - Remove references to old encoding

2. **`repos/deployment/TRIAL_API_KEYS.md`**
   - Lines 66-86: Fix authentication header format
   - Update all example keys to new format

3. **`docs/API_KEY_VALIDATION_ENDPOINT.md`**
   - Lines 38, 44, 48: Remove base64 examples
   - Show new human-readable format with base64url encoding

#### Medium Priority
4. **`repos/deployment/LOCAL_DEVELOPMENT_QUICKSTART.md`**
   - Line 137: Update placeholder format
   - Lines 571-576: Remove deprecated MiniBob instance signin references

5. **`repos/deployment/AUTHENTICATION_SETUP.md`**
   - Lines 94-102: Update hardcoded key examples
   - Line 107: Remove `mb_inst_<env>_` format
   - Line 141: Update key generation script

6. **`repos/deployment/vessels/metabob-activity-api/README.md`**
   - Lines 147-158: Update deprecated instance auth section

#### Already Correct
- ✅ `KEY_MANAGEMENT_MIGRATION_PLAN.md`
- ✅ `CANARY_TEST_KEYS.md`
- ✅ `repos/deployment/CANARY_ORG_KEY_STATUS.md`

## Migration Steps

### Phase 1: Verify Identity-Vessel Deployment ✅
- [x] Deploy identity-vessel to canary
- [ ] Verify canary endpoint health
- [ ] Generate test key via canary API
- [ ] Validate new format end-to-end

### Phase 2: Update Vessel Code
- [ ] metabob-activity-api: Test compatibility with new format
- [ ] minibob: Verify no local validation breaks
- [ ] user-vessel: Test key generation delegation

### Phase 3: Regenerate All Keys
- [ ] Generate new admin key via identity-vessel API
- [ ] Generate new MiniBob instance keys
- [ ] Generate new CI/CD keys
- [ ] Update all local .env files
- [ ] Update encrypted secrets (SOPS)
- [ ] Update GitHub secrets

### Phase 4: Update Documentation
- [ ] Update identity-vessel README
- [ ] Update trial API keys guide
- [ ] Update API validation endpoint docs
- [ ] Update quickstart guides
- [ ] Update authentication setup guide

### Phase 5: Validate & Deploy
- [ ] Test all keys in local environment
- [ ] Test all keys in canary environment
- [ ] Promote to production
- [ ] Archive old keys
- [ ] Update rollback procedures

## Key Generation Script

```bash
#!/usr/bin/env bash
# Generate new API key via identity-vessel

IDENTITY_ENDPOINT="${IDENTITY_ENDPOINT:-https://identity.metabob.com}"
ORG_ID="${1:-metabob}"
USER_ID="${2:-users:admin}"
NAME="${3:-Admin API Key}"
SCOPES="${4:-activities:*,templates:*}"

curl -X POST "${IDENTITY_ENDPOINT}/v1/keys/generate" \
  -H "Content-Type: application/json" \
  -d "{
    \"org_id\": \"${ORG_ID}\",
    \"user_id\": \"${USER_ID}\",
    \"name\": \"${NAME}\",
    \"scopes\": $(echo "$SCOPES" | jq -R 'split(",")'),
    \"expires_in_days\": 365
  }" | jq -r '.data.key'
```

## Testing Checklist

- [ ] Generate key via identity-vessel API
- [ ] Parse key locally with validation.ts
- [ ] Authenticate via activity-api
- [ ] Create activity template with new key
- [ ] Store execution trace with new key
- [ ] Verify multi-tenant isolation
- [ ] Test key revocation
- [ ] Test fallback validation (direct SurrealDB)

## Rollback Plan

If issues arise:

1. Identity-vessel supports BOTH formats during transition
2. Old keys remain valid during migration
3. Can revert to previous identity-vessel tag if needed
4. Secrets are encrypted and version-controlled

## Timeline

- **Day 1 (2026-04-09)**: Deploy identity-vessel to canary ✅
- **Day 2 (2026-04-10)**: Regenerate all keys, update configs
- **Day 3 (2026-04-11)**: Update documentation, final testing
- **Day 4 (2026-04-12)**: Production deployment

## Success Criteria

- ✅ All tests passing (41/41 in identity-vessel)
- ⏳ All vessels compatible with new format
- ⏳ All configuration files updated
- ⏳ All documentation accurate
- ⏳ Zero authentication failures post-migration
- ⏳ Canary deployment successful
- ⏳ Production deployment successful
