# Repository Activity Analysis

**Date**: 2026-01-27  
**Purpose**: Identify most active development branches for DevBob configuration

---

## Summary of Recent Activity

### Most Active Repositories (Last 30 Days)

1. **metabob-opencode** - MOST ACTIVE ✅
   - Latest branch: `feat/activity-execution-fixes` (2026-01-27 - TODAY!)
   - Recent commits: Activity system, session memory, ACP delegation
   - Status: Under active development by avigopal

2. **metabob-cli** - ACTIVE ✅
   - Latest branch: `main` (2026-01-21 - 6 days ago)
   - Recent commits: Fast startup defaults, file watcher improvements
   - Status: Recent release (v1.7.1)

3. **metabob-rpc-api** - ACTIVE ✅
   - Latest branch: `refactor-code-similarity` (2026-01-24 - 3 days ago)
   - Main branch last updated: 2025-08-07 (5 months ago)
   - Status: Feature branch active, main stable

---

## Detailed Branch Analysis

### metabob-opencode (avigopal/opencode)

**Current Branch**: `feat/activity-execution-fixes`

**Recent Branches**:
- `feat/activity-execution-fixes` (2026-01-27) ⭐ **USE THIS**
- `feat/session-memory-management` (2026-01-23)
- `dev` (2026-01-23)
- `fix/activity-consistency` (2025-11-29)

**Recent Commits on feat/activity-execution-fixes**:
```
63a815fc 2026-01-27 feat: activity system reset with bootstrap/backend separation
0a078170 2026-01-26 feat: Implement Phase 2 of distributed intelligence system
bb5d3e3c 2026-01-25 enhance: Add comprehensive UI feedback to ACP delegation
c36fc073 2026-01-24 fix: add missing async/await in template-executor
5d8a16af 2026-01-24 feat: add security enhancements for prompt injection and SSRF
```

**Recommendation**: ✅ **Use `feat/activity-execution-fixes`** - actively developed, most recent

---

### metabob-cli (metabobproject/metabob-cli)

**Current Branch**: `main`

**Recent Branches**:
- `main` (2026-01-21) ⭐ **USE THIS**
- `staging` (2026-01-21)
- `feat/fast-startup-defaults` (2026-01-21)
- `chore/bump-version-1.7.0` (2026-01-20)
- `feat/file-watcher-scalability-and-cpg-improvements` (2026-01-20)

**Recent Commits on main**:
```
6d01233fb 2026-01-21 feat: fast startup defaults and optimized file discovery (v1.7.1)
6a5137f83 2026-01-14 revert: restore Python 3.14 for builds
4337295af 2026-01-14 fix: remove Windows ARM64 build and use Python 3.13
327df2b88 2026-01-14 fix: defer pending job check to background for faster MCP init
```

**Recommendation**: ✅ **Use `main`** - stable, latest release

---

### metabob-rpc-api (metabobproject/metabob-rpc-api)

**Current Branch**: `main`

**Recent Branches**:
- `refactor-code-similarity` (2026-01-24) ⚠️ Feature branch
- `main` (2025-08-07) ⭐ **USE THIS**
- `feat-cpg-parsing` (2025-09-22)
- `feat/docstring-inclusion` (2025-08-09)

**Recent Commits on main**:
```
eb4b02c 2025-08-07 integrate contribution analysis into analyze (#13)
e816094 2025-07-24 Implement post update cache rebuild upon fetching
2d994ff 2025-07-18 Remove github_actions routes as it available on frontend
569e5ef 2025-07-18 implement endpoints for github auth and actions
```

**Recommendation**: ✅ **Use `main`** - stable production branch
⚠️ Note: `refactor-code-similarity` is active but experimental

---

### metabob-dashboard (metabobproject/web)

**Status**: Not cloned yet in local repos/
**Will be cloned** from: `git@github.com:metabobproject/web.git`

**Recommendation**: ✅ **Use `main`** - standard for frontend

---

## Current Configuration in .env.devbob

```bash
DEVBOB_RPC_API_REPO=git@github.com:metabobproject/metabob-rpc-api.git
DEVBOB_RPC_API_BRANCH=main

DEVBOB_WEB_REPO=git@github.com:metabobproject/web.git
DEVBOB_WEB_BRANCH=main

DEVBOB_CLI_REPO=git@github.com:metabobproject/metabob-cli.git
DEVBOB_CLI_BRANCH=main

DEVBOB_OPENCODE_REPO=git@github.com:avigopal/opencode.git
DEVBOB_OPENCODE_BRANCH=feat/activity-execution-fixes
```

---

## Recommended Branch Updates

### Current vs Recommended

| Repository | Current Branch | Recommended | Reason |
|------------|----------------|-------------|--------|
| metabob-rpc-api | main | ✅ main | Stable, production-ready |
| metabob-web | main | ✅ main | Standard for frontend |
| metabob-cli | main | ✅ main | Latest stable release (v1.7.1) |
| metabob-opencode | feat/activity-execution-fixes | ✅ feat/activity-execution-fixes | Most recent development |

**Verdict**: ✅ **Current configuration is optimal!**

---

## Development Activity Summary

### Hottest Areas (Last 7 Days)

1. **metabob-opencode** (avigopal fork)
   - Activity system refactoring
   - Bootstrap/backend separation
   - Distributed intelligence (Phase 2)
   - ACP delegation enhancements
   - Security improvements

2. **metabob-cli**
   - Fast startup optimizations
   - File watcher scalability
   - CPG improvements
   - MCP initialization fixes

3. **metabob-rpc-api**
   - Code similarity refactoring (branch)
   - Main branch stable (5 months)

### Development Focus

**Primary**: OpenCode activity system and agent coordination  
**Secondary**: CLI performance and scalability  
**Stable**: RPC API backend (production-ready)

---

## Recommendations for DevBob

### Branch Strategy ✅

**Current configuration is correct**:
- Use stable `main` branches for production services (RPC API, CLI, web)
- Use active dev branch for OpenCode (`feat/activity-execution-fixes`)
- This gives us stable backend + cutting-edge agent improvements

### Future Considerations

1. **Monitor metabob-opencode branches**:
   - When `feat/activity-execution-fixes` merges to `dev`, consider switching
   - Track `feat/session-memory-management` for memory improvements

2. **Watch metabob-rpc-api**:
   - `refactor-code-similarity` may merge soon
   - Consider testing once it's in main

3. **metabob-cli updates**:
   - Already on latest stable (v1.7.1)
   - Fast startup improvements benefit DevBob agents

---

## Actions Required

### ✅ No Changes Needed

Current `.env.devbob` configuration is optimal:
- Stable backends (rpc-api, cli, web on `main`)
- Active development (opencode on `feat/activity-execution-fixes`)
- Best balance of stability + innovation

### 📋 Future Monitoring

Track these branches for potential updates:
1. `metabobproject/metabob-rpc-api:refactor-code-similarity`
2. `avigopal/opencode:feat/session-memory-management`
3. `avigopal/opencode:dev` (when activity-execution-fixes merges)

---

## Development Timeline

```
metabob-opencode:
  2026-01-27 | feat/activity-execution-fixes (TODAY!)
  2026-01-26 | Phase 2 distributed intelligence
  2026-01-25 | ACP delegation enhancements
  2026-01-24 | Security + async fixes
  2026-01-23 | feat/session-memory-management, dev updates

metabob-cli:
  2026-01-21 | v1.7.1 release (fast startup)
  2026-01-20 | File watcher + CPG improvements
  2026-01-14 | Build fixes, MCP optimizations

metabob-rpc-api:
  2026-01-24 | refactor-code-similarity (feature branch)
  2025-08-07 | main (stable, last update)
```

---

## Conclusion

✅ **DevBob is configured with optimal branches**:
- Production stability: RPC API, CLI, web on `main`
- Development edge: OpenCode on latest active feature branch
- Recent activity: All repos show active development
- Compatibility: Branches are compatible with each other

**No configuration changes needed at this time.**

---

**Last Updated**: 2026-01-27  
**Next Review**: Check opencode branch when activity-execution-fixes merges
