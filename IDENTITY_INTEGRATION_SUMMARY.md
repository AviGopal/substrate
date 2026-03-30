# Identity Vessel Integration - Summary

## What We Found

✅ **Identity Vessel**: Deployed and working at `http://identity.metabob.local`  
✅ **Activity API**: Running with auth endpoints at `http://activity.metabob.local`  
⚠️  **Integration Gap**: The two systems don't talk to each other yet

## The Problem

Currently there are **two separate API key systems**:

### System 1: Identity Vessel (HMAC-based)
- Generates API keys with HMAC-SHA256 signatures
- Validates keys in <2ms (no database)
- Keys format: `Base64(mb_live-org-user-keyid-signature)`
- **Not currently used by activity-api**

### System 2: Activity API SurrealDB (Database-based)
- Stores API keys in SurrealDB with argon2 hashes
- Validates via SurrealDB RECORD access
- Endpoint: `POST /v2/auth/apikey`
- **Currently what activity-api uses**

**These are incompatible!** Keys from identity-vessel won't work with activity-api's current auth endpoint.

---

## The Solution

Make activity-api delegate API key validation to identity-vessel:

```
User/CLI
  ↓ (sends API key)
Activity API (/v2/auth/apikey)
  ↓ (HTTP call to validate)
Identity Vessel (/v1/auth/resolve)
  ↓ (validates HMAC signature)
Returns { authenticated: true, orgId, userId, scopes }
  ↓
Activity API (generates JWT token)
  ↓ (returns to client)
JWT Token
```

### Benefits

1. **Unified Key Management**: One place to generate, revoke, and manage all API keys
2. **Fast Validation**: <2ms vs database queries
3. **No Dual Storage**: Keys exist only as HMAC signatures (never stored)
4. **Backward Compatible**: Can fallback to SurrealDB for existing keys during migration
5. **Scalable**: Stateless validation, Redis revocation cache

---

## Implementation Status

### ✅ Created Documentation
- [IDENTITY_VESSEL_INTEGRATION_PLAN.md](./IDENTITY_VESSEL_INTEGRATION_PLAN.md) - Complete integration plan
- [auth-identity-vessel-integration.ts](./repos/metabob-activity-api/src/routes/auth-identity-vessel-integration.ts) - Updated auth route
- [test-identity-vessel-integration.sh](./test-identity-vessel-integration.sh) - Integration test script

### 📋 What Needs to Happen

1. **Generate Bootstrap Admin Key** (5 min)
   ```bash
   cd repos/identity-vessel
   bun run scripts/generate-bootstrap-key.ts
   export ADMIN_API_KEY=<generated-key>
   ```

2. **Update Activity API Auth Route** (30 min)
   - Replace `/v2/auth/apikey` implementation in `repos/metabob-activity-api/src/routes/auth.ts`
   - Use code from `auth-identity-vessel-integration.ts`
   - Add environment variable: `IDENTITY_VESSEL_URL`

3. **Deploy Changes** (30 min)
   ```bash
   # Build activity-api with new code
   cd repos/deployment
   ./scripts/build-vessel.sh metabob-activity-api
   
   # Deploy via helmfile
   cd helm
   helmfile -e local sync
   ```

4. **Test Integration** (15 min)
   ```bash
   ./test-identity-vessel-integration.sh
   ```

5. **Create Dashboard UI** (2-3 hours)
   - Add API key management page
   - Generate keys button
   - Revoke keys button
   - List active keys with metadata

**Total Time: ~4-5 hours for complete integration**

---

## Testing the Integration

Once implemented, the flow will be:

### 1. Generate API Key
```bash
curl -X POST http://identity.metabob.local/v1/keys/generate \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUserId": "usr_test",
    "name": "CLI Tool Key",
    "scopes": ["read", "write"]
  }'
```

Returns:
```json
{
  "success": true,
  "data": {
    "key": "bWJfbGl2ZS1tZXRhYm9iX2NvbS11c3JfdGVzdC1rZXlfeDEyMy1hYmMxMjMuLi4=",
    "keyId": "key_x123"
  }
}
```

### 2. Authenticate with Activity API
```bash
curl -X POST http://activity.metabob.local/v2/auth/apikey \
  -H "Content-Type: application/json" \
  -d '{"api_key": "bWJfbGl2ZS1tZXRhYm9iX2NvbS11c3JfdGVzdC1rZXlfeDEyMy1hYmMxMjMuLi4="}'
```

Returns:
```json
{
  "token": "eyJhbGci...",
  "expires_in": 900,
  "org_id": "metabob_com",
  "user_id": "usr_test",
  "scopes": ["read", "write"],
  "source": "identity-vessel"  // Indicates which system validated
}
```

### 3. Use JWT for API Calls
```bash
curl -X GET http://activity.metabob.local/v2/activities/templates \
  -H "Authorization: Bearer eyJhbGci..."
```

### 4. Revoke Key
```bash
curl -X POST http://identity.metabob.local/v1/keys/revoke/key_x123 \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

---

## Migration Strategy

### Phase 1: Dual Support (Recommended Start)
- Identity-vessel validation first
- SurrealDB fallback for existing keys
- No breaking changes

### Phase 2: Gradual Migration
- Dashboard UI for new keys
- Email users about migration
- Monitor usage of both paths

### Phase 3: Deprecate Legacy
- Remove SurrealDB fallback
- Only identity-vessel keys accepted
- Clean up old code

---

## Key Files

### Documentation
- `IDENTITY_VESSEL_INTEGRATION_PLAN.md` - Detailed plan with code examples
- `IDENTITY_INTEGRATION_SUMMARY.md` - This file (overview)
- `AUTHENTICATION_STATUS.md` - Current auth status
- `MINIBOB_IDENTITY_INTEGRATION.md` - MiniBob-specific integration

### Implementation
- `repos/metabob-activity-api/src/routes/auth-identity-vessel-integration.ts` - Updated auth route
- `test-identity-vessel-integration.sh` - Integration test script

### Deployment
- `repos/deployment/charts/identity-vessel/` - Identity vessel Helm chart
- `repos/deployment/charts/metabob-activity-api/` - Activity API Helm chart

---

## Next Steps

**Immediate (to enable integration):**
1. [ ] Create bootstrap admin key script for identity-vessel
2. [ ] Update activity-api auth.ts with identity-vessel delegation
3. [ ] Add `IDENTITY_VESSEL_URL` to activity-api environment
4. [ ] Deploy and test end-to-end

**Short-term (within 1 week):**
1. [ ] Add API key management UI to dashboard
2. [ ] Document API key usage for CLI/IDE tools
3. [ ] Create migration guide for existing keys
4. [ ] Set up monitoring for auth failures

**Long-term (within 1 month):**
1. [ ] Migrate all users to identity-vessel keys
2. [ ] Remove SurrealDB API key system
3. [ ] Add key rotation automation
4. [ ] Implement usage analytics

---

## Questions?

**Q: Will this break existing API keys?**  
A: No! The implementation falls back to SurrealDB for existing keys. Migration is gradual.

**Q: What about MiniBob authentication?**  
A: MiniBob uses a separate `/v2/auth/minibob/signin` endpoint for instance auth. That stays unchanged. This integration is for user API keys only.

**Q: How do we generate the first admin key?**  
A: We need to create a bootstrap script that generates an admin key using the HMAC secret. This key is then used to generate all other keys.

**Q: What if identity-vessel is down?**  
A: The fallback to SurrealDB ensures service continuity during migration. Once fully migrated, we'd need high availability for identity-vessel (multiple replicas, load balancing).

**Q: Can we use the same key for multiple services?**  
A: Yes! That's the whole point. One API key from identity-vessel works for activity-api, concept-db, and any other service that delegates to identity-vessel.

---

## Success Criteria

- [ ] Keys generated by identity-vessel work with activity-api
- [ ] Activity-api returns JWT tokens for validated keys
- [ ] JWT tokens work for all protected endpoints
- [ ] Key revocation works end-to-end
- [ ] Performance: <5ms total (2ms identity-vessel + 3ms JWT generation)
- [ ] Backward compatibility maintained
- [ ] Zero downtime during rollout

---

## References

- Identity Vessel Documentation: `repos/identity-vessel/README.md`
- Identity Vessel Architecture: `repos/identity-vessel/ARCHITECTURE.md`
- Activity API Auth Routes: `repos/metabob-activity-api/src/routes/auth.ts`
- Deployment Guide: `repos/deployment/README.md`

