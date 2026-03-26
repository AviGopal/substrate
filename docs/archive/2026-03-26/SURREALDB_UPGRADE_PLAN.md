# SurrealDB 3.x Upgrade Plan

## Current State Analysis

### The Problem
You're absolutely right - we're stuck in a cycle of:
1. Using old SurrealDB server (2.3.10) and client (1.0.8)
2. Hitting API limitations and bugs
3. Applying kludgy fixes (raw SQL, HTTP quirks, ConfigMap patches)
4. Accumulating technical debt

### Current Versions
| Component | Current | Target | Status |
|-----------|---------|--------|--------|
| SurrealDB Server | 2.3.10 | 3.0+ | ❌ Outdated |
| Python SDK (surrealdb) | 1.0.8 | Need new SDK | ❌ Incompatible |
| Helm Chart Config | v3.0.0 | - | ⚠️ Not applied |

### Evidence of Issues
Recent commits show pattern of workarounds:
- `d61fa57` - "Use direct SQL INSERT" (workaround for SDK bug)
- `df826f1` - "automatic retry on 401" (connection issues)
- `4711521` - "Fix critical data display bugs" (HTTP API quirks)
- Multiple "Fix SurrealDB" commits

## Root Cause: Python SDK Mismatch

The official `surrealdb` Python package (1.0.8) was built for SurrealDB 1.x:
- Uses HTTP API with quirks (field names in results, etc.)
- Missing features from SurrealDB 2.x and 3.x
- Forces raw SQL workarounds
- No WebSocket support (required for SurrealDB 3.x)

**SurrealDB 3.x requires a different Python SDK approach!**

## Solution: Upgrade to SurrealDB 3.x with Proper SDK

### Option 1: Official surrealdb.py (Recommended if available)
Check if there's a 2.x/3.x compatible version:
```bash
pip search surrealdb  # or check PyPI directly
```

**Current Status**: surrealdb==1.0.8 is latest on PyPI (doesn't support 3.x)

### Option 2: Use surrealist or alternative SDK
SurrealDB 3.x may require different Python binding:
- Check official SurrealDB documentation
- May need to use REST API directly with `httpx`
- Or use WebSocket client manually

### Option 3: Stay on SurrealDB 2.x LTS
If no compatible Python SDK exists for 3.x:
- Upgrade server to latest 2.x (more stable than 2.3.10)
- Wait for official 3.x Python SDK
- Focus on fixing current issues properly

## Upgrade Steps (Assuming SDK is Available)

### Phase 1: Research & Validation
- [ ] Check official SurrealDB docs for Python 3.x SDK
- [ ] Test SDK locally with SurrealDB 3.x server
- [ ] Verify all our query patterns work
- [ ] Check for breaking changes

### Phase 2: Update Dependencies
```toml
# pyproject.toml
dependencies = [
    "surrealdb>=2.0.0",  # or whatever 3.x compatible version
    # ... rest
]
```

### Phase 3: Update Server
```yaml
# helm/charts/surrealdb/values.yaml
image:
  repository: surrealdb/surrealdb
  tag: "v3.0.0"  # Already set, just needs deployment
```

### Phase 4: Code Migration
Update `server/db/surrealdb_client.py`:
1. Remove HTTP API quirk workarounds (field names detection)
2. Use proper SDK methods instead of raw SQL
3. Test all database operations
4. Remove retry logic if SDK handles it

### Phase 5: Test & Deploy
1. Test locally with SurrealDB 3.x
2. Run integration tests
3. Deploy to development environment
4. Validate all endpoints work
5. Deploy to production

## Benefits of Proper Upgrade

### ✅ Eliminates Current Issues
- No more field names in query results
- Proper error handling
- Better connection management
- No raw SQL workarounds needed

### ✅ New Features
- Better performance
- Improved query language
- Modern API design
- Better documentation

### ✅ Reduced Technical Debt
- Remove ConfigMap patches
- Remove HTTP quirk handlers
- Remove custom retry logic
- Cleaner, maintainable code

## Immediate Action Items

### 1. Investigate Python SDK for 3.x
```bash
# Check official sources
curl -s https://surrealdb.com/docs/integration/sdks/python
# Check if there's a beta/alpha version
pip index versions surrealdb --pre
```

### 2. Document Current SQL Usage
```bash
# Find all raw SQL queries
cd repos/metabob-rpc-api
rg "db\.query\(" --type py | wc -l
rg "sql.*=" --type py | wc -l
```

### 3. Create Test Environment
```bash
# Run SurrealDB 3.0 locally
docker run --rm -p 8000:8000 surrealdb/surrealdb:v3.0.0 start

# Test Python SDK compatibility
python -c "from surrealdb import Surreal; print('SDK loaded')"
```

## Alternative: If No 3.x SDK Exists

If there's no Python SDK for SurrealDB 3.x yet:

### Short-term: Upgrade to SurrealDB 2.x Latest
```yaml
image:
  tag: "v2.5.0"  # or latest 2.x
```
This will:
- Fix known bugs in 2.3.10
- Maintain SDK compatibility
- Give us stability while waiting for 3.x SDK

### Long-term: Watch for SDK Release
- Monitor: https://github.com/surrealdb/surrealdb.py
- Subscribe to release notifications
- Plan migration when SDK is ready

## Impact Assessment

### Code Changes Required
| File | Change Type | Complexity |
|------|-------------|------------|
| `server/db/surrealdb_client.py` | Major refactor | High |
| `server/db/operations/*.py` | Remove SQL workarounds | Medium |
| All test files | Update mocks | Medium |
| Helm values | Update version | Low |

### Testing Required
- [ ] All database operations (CRUD)
- [ ] Authentication flow
- [ ] Project listing (our recent fix)
- [ ] Activity tracking
- [ ] API key management
- [ ] User registration/login

### Rollback Plan
1. Keep old image tag available
2. Helm rollback: `helm rollback surrealdb`
3. Revert code to previous commit
4. Document known issues with old version

## Recommendation

**Immediate**: Research official SurrealDB 3.x Python SDK availability
- If available → Full upgrade to 3.x
- If not available → Upgrade server to latest 2.x, wait for SDK

**Do NOT**: Continue with 2.3.10 and kludgy fixes

The technical debt from workarounds (ConfigMaps, raw SQL, HTTP quirks) is 
costing more development time than a proper upgrade would take.

## Next Steps

1. **Research** (30 min): Check SurrealDB docs for Python 3.x SDK status
2. **Decision** (15 min): Choose upgrade path based on SDK availability  
3. **Test** (2 hours): Local testing with target version
4. **Plan** (1 hour): Detailed code migration checklist
5. **Execute** (1 day): Implement upgrade with proper testing

---

**Bottom Line**: You're 100% correct. We need to get off the old versions and 
stop applying band-aids. A proper upgrade to SurrealDB 3.x (or at least latest 
2.x) will eliminate these recurring issues permanently.
