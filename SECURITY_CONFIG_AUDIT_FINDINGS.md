# Security & Configuration Audit Findings
**Date:** February 12, 2026  
**Scope:** metabob-cli, metabob-dashboard, metabob-rpc-api

## Executive Summary

Found **CRITICAL** security issues across all three repositories:
- ✗ **8 .env files tracked in git** (should never be committed)
- ✗ **3+ third-party API tokens exposed** (OpenReplay, Mixpanel)
- ✗ **Weak JWT secrets** ("local-dev-secret-key-change-in-production")
- ✗ **77+ hardcoded localhost URLs** (breaks container portability)
- ⚠ **Inconsistent .gitignore** patterns across repos

---

## 1. CRITICAL: Environment Files Tracked in Git

### metabob-dashboard (4 files)
```
.env                    ← Contains OpenReplay + Mixpanel tokens
.env.cloud              ← Contains OpenReplay + Mixpanel tokens  
.env.development        ← Local config
.env.mock               ← Mock config
```

**Exposed Secrets:**
- `REACT_APP_OPENREPLAY_PROJECT_TOKEN='jagYenyC6JmWn1JM6WT4'`
- `REACT_APP_MIXPANEL_TOKEN_DEV='16aa5aedb90009c2d811a882b659dc62'`
- `REACT_APP_MIXPANEL_TOKEN='9b75df0453c34711bdbc54f678dee2b6'`

### metabob-rpc-api (2 files)
```
.env                    ← Contains JWT secrets + DB credentials
.env.example            ← OK (example file)
```

**Exposed Secrets:**
- `JWT_SECRET_KEY=local-dev-secret-key-change-in-production`
- `SECRET_KEY=dev_secret_key_for_testing`
- `SURREAL_PASS=testing`

### metabob-cli (1 file)
```
.metabob-config.json    ← Contains test API key
```

**Exposed:**
- `"api_key": "test-smoke-key"`

---

## 2. HIGH: Hardcoded Localhost/IP Addresses (77 occurrences)

### Pattern: Default fallbacks in code
Most problematic pattern (repeated 20+ times):
```python
# metabob-cli/src/metabob_cli/mcp/tools.py (16 instances)
base_url = config.get("base_url", "http://localhost:8080")

# metabob-cli/src/metabob_cli/commands.py
api_url = base_url or os.environ.get("METABOB_API_URL", "http://localhost:8080")

# metabob-rpc-api/server/config.py
REDIS_URI: str = Field(default="redis://localhost:6379")
SURREAL_URL: str = Field(default="ws://localhost:8000")
```

### Impact
- **Container builds fail** when services use different hostnames (e.g., `redis` in Docker Compose)
- **Cannot override** defaults in production without code changes
- **Tests assume localhost** which breaks in CI/CD environments

---

## 3. MEDIUM: Inconsistent .gitignore Patterns

### metabob-cli/.gitignore ✓ (GOOD)
```
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

### metabob-dashboard/.gitignore ⚠ (PARTIAL)
```
.env.local                      ← .env is NOT ignored!
.env.development.local
.env.test.local
.env.production.local
.env.docker
```

### metabob-rpc-api/.gitignore ⚠ (COMPLEX)
```
.env.*                          ← .env is NOT ignored!
!.env.example
web/.env.development.local
web/.env.production.local
```

---

## 4. Container Portability Issues

### Absolute Paths (None found - ✓ GOOD)
No `/home/`, `/opt/`, or Windows-style paths detected.

### Environment-Specific Config
Current state:
- ✗ `.env.docker` exists but not in .gitignore
- ✗ `.env.devbob` exists but not in .gitignore  
- ✗ Multiple .env variants committed to git

---

## 5. Detailed Inventory by Severity

### 🔴 CRITICAL (Must fix before production)
1. **metabob-dashboard/.env** - Remove from git, add to .gitignore
2. **metabob-dashboard/.env.cloud** - Remove from git, add to .gitignore
3. **metabob-rpc-api/.env** - Remove from git, add to .gitignore
4. **Rotate all exposed tokens** (OpenReplay, Mixpanel)
5. **Generate strong JWT secrets** (replace "local-dev-secret-key")

### 🟠 HIGH (Breaks container portability)
1. **77 localhost URLs** - Replace with environment variables
2. **Hardcoded Redis/SurrealDB defaults** - Use env vars with no defaults
3. **Test files assume localhost** - Use fixtures for URLs

### 🟡 MEDIUM (Best practices)
1. **Standardize .gitignore** across all repos
2. **Create .env.example** templates for all repos
3. **Document required env vars** in READMEs
4. **Add pre-commit hooks** to prevent .env commits

---

## 6. Recommended Remediation Plan

### Phase 1: Stop the Bleeding (CRITICAL)
```bash
# 1. Update .gitignore in all repos
echo ".env" >> repos/metabob-dashboard/.gitignore
echo ".env" >> repos/metabob-rpc-api/.gitignore

# 2. Remove from git (keep local copies)
cd repos/metabob-dashboard && git rm --cached .env .env.cloud .env.development .env.mock
cd repos/metabob-rpc-api && git rm --cached .env
cd repos/metabob-cli && git rm --cached .metabob-config.json

# 3. Rotate exposed tokens immediately
# - OpenReplay: Generate new project token
# - Mixpanel: Rotate tokens
# - Update local .env files only (not in git)
```

### Phase 2: Externalize Configuration (HIGH)
```bash
# 1. Create .env.example templates
# 2. Update all hardcoded URLs to use environment variables
# 3. Remove default values from config classes (fail fast if missing)
# 4. Update documentation
```

### Phase 3: Container Validation (MEDIUM)
```bash
# 1. Test each app builds in clean container
# 2. Verify docker-compose works with .env.example
# 3. Add container build to CI/CD
```

---

## 7. Success Criteria

- [ ] Zero .env files tracked in git (check: `git ls-files | grep \.env`)
- [ ] All tokens rotated (OpenReplay, Mixpanel, JWT secrets)
- [ ] .env.example exists in all repos with all required vars
- [ ] No hardcoded localhost in production code (tests OK with env var defaults)
- [ ] All three repos build in containers with only .env.example + overrides
- [ ] Updated .gitignore prevents future .env commits
- [ ] Documentation includes environment variable reference

---

## 8. Files to Modify

### Configuration Files (8 files)
```
repos/metabob-dashboard/.gitignore              ← Add .env patterns
repos/metabob-rpc-api/.gitignore                ← Add .env patterns  
repos/metabob-cli/.gitignore                    ← Already good, verify

repos/metabob-dashboard/.env.example            ← CREATE (template)
repos/metabob-rpc-api/.env.example              ← UPDATE (add missing vars)
repos/metabob-cli/.metabob-config-example.json  ← Already exists ✓
```

### Source Code (30+ files with localhost)
```
metabob-cli/src/metabob_cli/commands.py         ← 4 occurrences
metabob-cli/src/metabob_cli/mcp/tools.py        ← 16 occurrences
metabob-cli/src/metabob_cli/mcp/server.py       ← 2 occurrences
metabob-cli/src/metabob_cli/mcp/activity_*.py   ← 2 occurrences
metabob-rpc-api/server/config.py                ← 5 occurrences
metabob-rpc-api/tasks/config.py                 ← 2 occurrences
metabob-rpc-api/admin/utils.py                  ← 1 occurrence
... (see full list in discovery output)
```

### Documentation (3 files)
```
repos/metabob-cli/README.md                     ← Add env var reference
repos/metabob-dashboard/README.md               ← Add env var reference
repos/metabob-rpc-api/README.md                 ← Add env var reference
```

---

## 9. Git History Consideration

**Note:** These secrets are already in git history. Options:
1. **Rotate all secrets** (recommended) - Old keys become useless
2. **BFG Repo Cleaner** - Rewrites history (breaks existing clones)
3. **git filter-repo** - Nuclear option (requires force push)

**Recommendation:** Rotate all secrets immediately. History cleanup optional.

---

## Next Steps

1. ✓ Complete discovery phase (THIS DOCUMENT)
2. Execute Phase 1: Stop the bleeding (.gitignore + git rm --cached)
3. Execute Phase 2: Externalize configuration (env vars everywhere)
4. Execute Phase 3: Container validation
5. Document all changes in commit messages
6. Update team on rotated secrets
