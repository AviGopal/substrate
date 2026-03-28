# Activity Templates - Quick Reference Card

**Last Updated**: 2026-02-16  
**Architecture Status**: ✅ Backend-only (enforced)

---

## 🏗️ Architecture (One Diagram to Rule Them All)

```
metabob-proto/activities/templates/*.json
    ↓ (bootstrap script)
metabob-rpc-api (SurrealDB + HTTP API)
    ↓ (GET /v2/activities/templates)
metabob-cli (MCP server with cache)
    ↓ (search_activities tool)
metabob-opencode (TemplateProvider)
    ↓ (Activity execution)

🚫 NO LOCAL STORAGE IN OPENCODE
```

---

## 🔧 Quick Commands

### Check Backend Status
```bash
curl http://localhost:8080/health
# {"status":"ok",...}
```

### List Templates
```bash
export METABOB_API_KEY='<token>'
curl -s http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $METABOB_API_KEY" | jq '.templates | length'
```

### Get Template Details
```bash
curl -s http://localhost:8080/v2/activities/templates/<template-id> \
  -H "Authorization: Bearer $METABOB_API_KEY" | jq '.'
```

### Bootstrap Templates (If Empty)
```bash
cd repos/metabob-rpc-api
python scripts/create_bootstrap_session.py  # Get token
export METABOB_API_KEY='<token-from-above>'
python scripts/bootstrap_templates.py       # Load 16 proto templates
```

### Rebuild OpenCode
```bash
cd repos/metabob-opencode/packages/opencode
bun run build
# Output: "skipping template bundling (backend-only architecture)"
```

---

## 📊 Current Template Inventory

| Category | Count | Examples |
|----------|-------|----------|
| feature | 6 | feature-impl-v1, add-rest-endpoint-v1 |
| bugfix | 1 | bug-fix-v1 |
| refactor | 1 | refactor-v1 |
| code-analysis | 1 | code-analysis-v1 |
| infrastructure | 4 | activity-create-v1, activity-debug-v1 |
| other | 7 | (needs cleanup) |
| **TOTAL** | **20** | |

---

## 🚨 Troubleshooting

### "Template not found"
```bash
# 1. Check backend is running
cd repos/metabob-rpc-api && docker compose ps

# 2. Verify API key
curl http://localhost:8080/v2/activities/templates -H "Authorization: Bearer $METABOB_API_KEY"

# 3. Bootstrap if empty
python scripts/bootstrap_templates.py
```

### "Build failed - template directory not found"
```bash
# Pull latest changes (build.ts updated to skip bundling)
cd repos/metabob-opencode && git pull
```

### "Duplicate template" during bootstrap
```bash
# Expected - templates already exist in backend
# This is correct behavior (idempotency check)
```

---

## 📝 Code Patterns

### Access Templates (OpenCode)
```typescript
import { TemplateProvider } from "./session/template-provider"

// Search templates
const templates = await TemplateProvider.search({
  category: "feature",
  verbose: false
})

// Get specific template
const template = await TemplateProvider.get("feature-b2fd98e6")
```

### Execute Activity
```typescript
import { Activity } from "./session/activity"

const activity = await Activity.create(sessionID, {
  templateId: "feature-impl-v1",
  variables: {
    feature_name: "User Authentication",
    feature_description: "Add JWT-based auth",
    target_location: "src/auth/"
  }
})

await activity.execute()
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `BACKEND_TEMPLATES_ARCHITECTURE_COMPLETE.md` | Full architecture docs |
| `BACKEND_TEMPLATES_TEST_PLAN.md` | Comprehensive test plan |
| `SESSION_SUMMARY_BACKEND_TEMPLATES_FEB16.md` | Session record |
| `TEMPLATES_QUICK_REFERENCE.md` | This quick reference |

---

## ✅ What's Done

- ✅ Local template directory removed
- ✅ Build process updated (no bundling)
- ✅ Code deprecated with warnings
- ✅ Backend verified (20 templates)
- ✅ Documentation complete

## 🔄 What's Next

- 🔄 End-to-end execution test
- 🔄 Error handling verification
- 🔄 Cache performance test
- 🔄 Category field cleanup (7 "other" templates)

---

## 🎯 Key Files

| Component | File Path |
|-----------|-----------|
| Template Provider | `packages/opencode/src/session/template-provider.ts` |
| Template Library (deprecated) | `packages/opencode/src/session/template-library.ts` |
| Activity Executor | `packages/opencode/src/session/template-executor.ts` |
| Build Script | `packages/opencode/script/build.ts` |
| Bootstrap Script | `repos/metabob-rpc-api/scripts/bootstrap_templates.py` |

---

## 🔗 Related Systems

| System | Port | Purpose |
|--------|------|---------|
| metabob-rpc-api | 8080 | Backend API + SurrealDB |
| metabob-cli (MCP) | - | MCP server (stdio) |
| SurrealDB | 8000 | Database (internal) |
| Redis | 6379 | Cache (internal) |

---

**For Next Session**: Start with Test 3 & 4 from `BACKEND_TEMPLATES_TEST_PLAN.md`
