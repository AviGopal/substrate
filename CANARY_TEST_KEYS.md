# Canary Test API Keys

## Metabob Organization

**Organization ID:** `metabob`
**Admin User:** `self@metabob.com` (`users:kre88ea3i1vmuj1gd12a`)
**Created:** 2026-04-09

## Test API Keys

### 1. Admin Development Key (Full Access)

```
mb_test-metabob-users:kre88ea3i1vmuj1gd12a-key_3K9gkHVhjtQuanRb-e65d59559fcd30902341179137f0208a
```

**Scopes:**
- `activities:read`
- `activities:write`
- `templates:read`
- `templates:write`

**Expires:** 2027-04-09 (365 days)

### 2. Read-Only Key

```
mb_test-metabob-users:kre88ea3i1vmuj1gd12a-key_pdxcMaWJTjNqBhm1-d766abe650ac07366f6ec1b82a8253d8
```

**Scopes:**
- `activities:read`
- `templates:read`

**Expires:** 2027-04-09 (365 days)

## Key Format

Keys now use human-readable HMAC-signed format:

```
mb_{env}-{org_id}-{user_id}-{key_id}-{hmac_signature}
```

Benefits:
- Visible `mb_` prefix at a glance
- No base64 encoding overhead
- HMAC-signed for cryptographic security
- Dash-separated components for easy parsing

## Verification

Both keys have been tested and verified:

✅ **Format validation:** HMAC signature valid
✅ **Org-scoped data access:** Successfully retrieves activity templates
✅ **Multi-tenant isolation:** Only sees metabob org data
✅ **API health:** Activity API responding correctly

### Test Commands

```bash
# Admin key (read + write)
curl -H "Authorization: ApiKey mb_test-metabob-users:kre88ea3i1vmuj1gd12a-key_3K9gkHVhjtQuanRb-e65d59559fcd30902341179137f0208a" \
  https://activity.metabob.com/v2/activities/templates

# Read-only key
curl -H "Authorization: ApiKey mb_test-metabob-users:kre88ea3i1vmuj1gd12a-key_pdxcMaWJTjNqBhm1-d766abe650ac07366f6ec1b82a8253d8" \
  https://activity.metabob.com/v2/activities/templates
```

## MiniBob Configuration

To use these keys with MiniBob, add to `~/.metabob/config.json`:

```json
{
  "metabob": {
    "apiKey": "mb_test-metabob-users:kre88ea3i1vmuj1gd12a-key_3K9gkHVhjtQuanRb-e65d59559fcd30902341179137f0208a",
    "endpoint": "https://activity.metabob.com"
  },
  "vessels": {
    "metabob": {
      "endpoint": "https://activity.metabob.com"
    },
    "identity": {
      "endpoint": "https://identity.metabob.com"
    }
  }
}
```

## Management Scripts

### Create Additional Keys

```bash
bun run scripts/commission-canary.ts apikey create \
  --org-id "metabob" \
  --user-id "users:kre88ea3i1vmuj1gd12a" \
  --name "New Test Key" \
  --scopes "activities:read,activities:write"
```

### Verify Key

```bash
bun run scripts/commission-canary.ts apikey verify \
  --api-key "mb_test-..."
```

### List Organization Members

```bash
bun run scripts/commission-canary.ts member list --org-id "metabob"
```

## Architecture Notes

- **Identity-vessel** manages API key generation and validation
- **Activity-API** uses identity-vessel for authentication
- **Multi-tenant isolation** enforced via SurrealDB PERMISSIONS
- **Automatic fallback** to direct SurrealDB validation if identity-vessel unavailable
- **Org-scoped data** automatically filtered by `$auth.org_id`

## Deployment

These keys are valid for the **canary environment**:
- Activity API: `https://activity.metabob.com`
- Identity Vessel: `https://identity.metabob.com`
- SurrealDB: `https://surql.metabob.com`

Image tag deployed: `0.1.0-08d80d9` (identity-vessel commit `0aff4f0`)
