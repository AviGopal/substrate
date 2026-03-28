# Devbob Clean Environment - Ready for Testing

**Date**: February 13, 2026  
**Status**: Infrastructure complete, awaiting API key

---

## ✅ Completed Setup

### 1. Container Infrastructure
- ✅ devbob base image built
- ✅ Entrypoint script created
- ✅ Network connectivity verified
- ✅ Backend services running

### 2. Clean Environment Validated
- ✅ Empty workspace (/workspace is clean)
- ✅ No local code mounted
- ✅ metabob-cli configured
- ✅ OpenCode config generated

### 3. Service Health
- ✅ Backend API reachable (http://api-server-dev:8080)
- ✅ SurrealDB data preserved
- ✅ Redis running
- ✅ Container passes health checks

---

## 🔑 Missing: API Key

The container needs `ANTHROPIC_API_KEY` to execute activities.

### To Start with API Key:

```bash
# Export your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-api03-...

# Start devbob-clean container
docker run -d \
  --name devbob-clean \
  --network metabob-network \
  -p 3000:3000 \
  -p 8082:8082 \
  -e CODEBASE_NAME=clean-test \
  -e HOSTNAME=devbob-clean \
  -e REPO_URL="" \
  -e REPO_CHECKOUT_MODE=skip \
  -e ACP_PORT=3000 \
  -e ACP_HOSTNAME=0.0.0.0 \
  -e METABOB_API_URL=http://api-server-dev:8080 \
  -e METABOB_PROJECT_ID=devbob-test \
  -e METABOB_API_KEY=$(cat .metabob_api_key 2>/dev/null || echo "test") \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e LOG_LEVEL=INFO \
  -e WAIT_FOR_BACKEND=true \
  devbob:latest

# Wait for container to be healthy
docker ps --filter "name=devbob-clean"

# Check logs
docker logs devbob-clean
```

---

## 🧪 Testing Plan

Once API key is set:

### Test 1: Submit Activity via ACP Delegation

```javascript
// Using acp_delegate tool
acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Run activity-create",
  prompt: `Execute activity INFRASTRUCTURE-bda5eef0 with variables:
    - template_name: "clean-env-test"
    - template_category: "test"
    - goal: "Verify self-contained execution"`,
  timeout: 600
})
```

### Test 2: Verify Template Persistence

```bash
# Check if template was created in backend
SESSION_TOKEN=$(python3 -c "import json; print(json.load(open('.metabob/state'))['session_metadata']['session_token'])")

curl -H "Authorization: Bearer $SESSION_TOKEN" \
  http://localhost:8080/v2/activities/templates | \
  jq '.templates[] | select(.variant_name | contains("clean-env"))'
```

### Test 3: Validate Self-Containment

**Success Criteria**:
- ✅ Activity executes without filesystem errors
- ✅ Template JSON generated
- ✅ createActivityTemplate called
- ✅ Template persisted to backend database
- ✅ No local file dependencies

---

## 📊 Current Environment

### Running Containers

| Container | Status | Purpose |
|-----------|--------|---------|
| metabob-surreal | Up (healthy) | Database with preserved data |
| metabob-redis | Up (healthy) | Cache and task queue |
| api-server-dev | Up (healthy) | Backend API |
| devbob-clean | Stopped | Awaiting API key |

### Volumes

- `configs_metabob_surreal_data`: SurrealDB data (preserved)
- `metabob_redis_data`: Redis persistence
- `devbob_clean_workspace`: Empty workspace (clean)

### Network

- `metabob-network`: All containers connected

---

## 🎯 Why This Matters

Testing in `devbob-clean` proves:

1. **Self-Containment**: Activities work without local files
2. **Portability**: Can run anywhere with just backend access
3. **Template Quality**: Improved prompts actually work
4. **Persistence**: createActivityTemplate properly called
5. **Production Readiness**: No hidden filesystem dependencies

---

## 📝 What We Built Today

### Smart Variant Update System
- ✅ Templates auto-create variants on content changes
- ✅ API-driven template evolution
- ✅ No code changes or SQL needed

### Improved Activity-Create Template
- ✅ New variant: INFRASTRUCTURE-bda5eef0
- ✅ 1512-character prompt (vs 70 original)
- ✅ createActivityTemplate instructions included
- ✅ Schema provided via impulses

### Profile-Based Docker Architecture
- ✅ Three profiles: stable, devbob, devbob-dev
- ✅ Clean testing environment
- ✅ Codebase management containers
- ✅ Data preservation

### Container Infrastructure
- ✅ devbob base image
- ✅ Entrypoint script with health checks
- ✅ MCP and ACP server setup
- ✅ Network connectivity

---

## 🚀 Next Steps

1. **Set API key** - Export ANTHROPIC_API_KEY
2. **Start container** - Run docker command above
3. **Submit activity** - Use acp_delegate
4. **Verify results** - Check backend for new template
5. **Celebrate** - Self-contained activity system working! 🎉

---

## 💡 Key Insights

**User's Insight**: "Every variant will necessarily have a different hash, we should simply add a non-matching hash as a new variant."
- ✅ Implemented in smart variant update system

**Architecture Insight**: "Agents handle data (code), containers handle execution"
- ✅ Implemented in devbob-dev profile design

**Testing Insight**: "Need clean environment to validate self-containment"
- ✅ Implemented in devbob clean profile

---

**Status**: Ready for final test with API key! 🚀
