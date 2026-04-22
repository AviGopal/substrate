# API Key Format Compatibility - Quick Summary

**TL;DR:** ✅ Fully compatible. No changes needed in metabob-activity-api.

## Format Change

**Old:** `mb_test_org_user_key_sig`
**New:** `mb-[base64(payload)]-{signature}`

## Why It Works

1. **Activity-API treats keys as opaque strings**
   - Never parses internal structure
   - Only hashes and validates via identity-vessel

2. **SHA-256 hashing is format-agnostic**
   - `hashApiKey()` hashes the entire string
   - Works identically for old and new formats
   - Different formats → different hashes (expected)

3. **Identity-vessel owns format logic**
   - All parsing happens in identity-vessel
   - Activity-API just forwards keys to identity-vessel
   - Fallback path uses hash lookup only

## Code Paths Verified

### Primary: validateApiKeyViaIdentityVessel
```typescript
// Activity-API simply forwards the entire key
fetch('/v1/auth/resolve', {
  body: JSON.stringify({
    impulse: { pointer: { apiKey } }  // ← opaque string
  })
})
```

### Fallback: validateApiKeyDirect
```typescript
// Hash the entire key string (format-agnostic)
const keyHash = await hashApiKey(apiKey);
// Lookup by hash (no parsing)
SELECT * FROM api_key WHERE key_hash = $key_hash
```

### Header Parsing
```typescript
// Extract everything after "ApiKey "
const apiKeyMatch = authHeader.match(/^ApiKey\s+(.+)$/i);
const apiKey = apiKeyMatch[1];  // ← works for both formats
```

## Action Items

- ✅ **Code changes:** NONE required
- ✅ **Deploy:** Safe to deploy identity-vessel with new format
- ⚠️ **Docs:** Update examples to show new format
- ⚠️ **Keys:** Generate new keys for clients

## Test Plan

```bash
# 1. Generate new key via identity-vessel
curl -X POST https://identity.metabob.com/v1/keys/generate

# 2. Test with activity-api (identity-vessel online)
curl https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey mb-<new-key>"

# 3. Test fallback (kill identity-vessel, should still work via SurrealDB)
curl https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey mb-<new-key>"
```

## Risk Assessment

**Risk Level:** 🟢 LOW

**Reasoning:**
- No format-specific logic in activity-api
- Hash-based validation is format-agnostic
- Primary path delegates to identity-vessel
- Fallback path uses opaque hash lookup

**Rollback:** If needed, identity-vessel can support both formats simultaneously.

---

See [API_KEY_FORMAT_COMPATIBILITY_REPORT.md](./API_KEY_FORMAT_COMPATIBILITY_REPORT.md) for full analysis.
