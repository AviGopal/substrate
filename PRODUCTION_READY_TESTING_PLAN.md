# Production-Ready Activity System Testing Plan

**Date**: February 19, 2026  
**Goal**: Ensure devbob (metabob-opencode + metabob-cli) works in production with no local file dependencies

---

## Problem Statement

**Current Issue**: Activity system may depend on local files that won't exist in production:
- Local template JSON files in `repos/metabob-opencode/packages/opencode/templates/`
- Local storage reads via `Storage.read(["activity-template", id])`
- Bootstrap templates stored locally

**Production Requirement**: 
- All activity templates must come from **metabob-rpc-api backend** (the single source of truth)
- No local file dependencies (works in clean Docker containers, remote servers, etc.)
- Bootstrap templates in **metabob-proto** should be preloaded into backend
- System should work with **zero local state**

---

## Current Architecture Analysis

### 1. Template Loading Flow (VERIFIED)

**Current Implementation**:
```typescript
// repos/metabob-opencode/packages/opencode/src/session/template-loader.ts

export async function load(id: string, options: LoadOptions = {}): Promise<LoadResult> {
  // Step 1: Check cache (unless skipCache)
  if (!options.skipCache) {
    const cached = TemplateCache.get(id, options.version)
    if (cached) return { template: cached, source: "cache", cached: true }
  }

  // Step 2: Try Metabob TemplateService (unless backend=local)
  if (options.backend !== "local") {
    const result = await TemplateServiceClient.getTemplate({ templateId: id })
    if (result.success && result.template) {
      TemplateCache.put(result.template)
      return { template: result.template, source: "metabob", cached: false }
    }
  }

  // Step 3: Fallback to local storage (⚠️ PRODUCTION PROBLEM)
  if (options.backend !== "metabob") {
    const template = await ActivityTemplate.load(id)  // ← Reads local files
    return { template, source: "local", cached: false }
  }

  throw new Error(`Template not found: ${id}`)
}
```

**Local Storage Implementation**:
```typescript
// repos/metabob-opencode/packages/opencode/src/session/activity-template.ts

export async function load(id: string): Promise<Schema> {
  const template = await Storage.read<Schema>(["activity-template", id])
  // ↑ This reads from ~/.local/share/opencode/storage/activity-template/{id}.json
  return template
}
```

**Analysis**:
- ✅ **GOOD**: Metabob backend is queried first (Step 2)
- ✅ **GOOD**: Caching reduces backend load (Step 1)
- ⚠️  **PROBLEM**: Falls back to local storage (Step 3) - won't work in clean production environments
- ⚠️  **PROBLEM**: Local templates in `templates/` directory (not used by loader, but confusing)

---

### 2. CLI Orchestration (VERIFIED)

**Current Implementation**:
```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

async def start_activity_execution(activity_id: str, variables: dict):
    # Fetch template from backend
    response = await client.get(f"/v2/activities/templates/{activity_id}")
    
    # Create execution state
    execution = ActivityExecution(
        execution_id=str(uuid.uuid4()),
        template=response.json()["template"],
        variables=variables,
        current_step_index=0
    )
    
    return execution
```

**Analysis**:
- ✅ **GOOD**: CLI always fetches from backend (no local file access)
- ✅ **GOOD**: Backend is authoritative source
- ✅ **READY**: CLI is production-ready as-is

---

### 3. Backend Storage (VERIFIED)

**Current Implementation**:
```python
# repos/metabob-rpc-api/server/routes/activity.py

@router.get("/v2/activities/templates/{activity_id}")
async def get_activity_template(activity_id: str):
    """Fetch activity template by ID"""
    # Backend reads from database
    template = await db.get_template(activity_id)
    return {"template": template}
```

**Bootstrap Templates**:
- **Location**: `repos/metabob-proto/activities/bootstrap/*.json` (20 templates)
- **Problem**: These are NOT automatically loaded into backend on startup
- **Need**: Seed script to load bootstrap templates into backend database

---

## Root Cause Analysis

### Issue 1: Local Storage Fallback

**Problem**:
```typescript
// template-loader.ts Step 3 (fallback)
const template = await ActivityTemplate.load(id)  // Reads local files
```

**Impact**:
- Works in dev (local files exist)
- Fails in production (clean Docker container has no local files)
- Silent failure (no warning that backend is unreachable)

**Solution**: 
- Option A: Remove Step 3 entirely (fail fast if backend unreachable)
- Option B: Make Step 3 opt-in (require explicit `backend="local"`)
- Option C: Log warning when using local fallback

---

### Issue 2: Bootstrap Templates Not Seeded

**Problem**:
- `metabob-proto/activities/bootstrap/*.json` contains 20 production-ready templates
- These are NOT in backend database by default
- Backend returns 404 for bootstrap template IDs
- OpenCode falls back to local storage (which won't exist in production)

**Impact**:
- Fresh backend deployments have NO templates
- System requires manual template registration
- Bootstrap templates (create-activity, debug-activity) don't work

**Solution**:
- Create seed script: `repos/metabob-rpc-api/scripts/seed_bootstrap_templates.py`
- Run on backend startup or deployment
- Load all `metabob-proto/activities/bootstrap/*.json` into database

---

### Issue 3: Local Template Directory Confusion

**Problem**:
- `repos/metabob-opencode/packages/opencode/templates/built-in/*.json` contains 13+ templates
- These are NOT used by TemplateLoader (dead code)
- Confusing - looks like they're used but they're not
- Out of sync with metabob-proto templates

**Impact**:
- Developer confusion
- Maintenance burden (two sources of templates)
- Potential for drift between local and backend templates

**Solution**:
- Delete local template files (no longer needed)
- Keep only documentation or examples
- Rely solely on backend + metabob-proto

---

## Production-Ready Architecture (TARGET)

### Desired Flow

```
┌─────────────────────────────────────────────────────────┐
│  metabob-opencode (Production)                          │
│  - No local template files                              │
│  - No local storage fallback                            │
│  - Cache-only for performance                           │
└─────────────────────────────────────────────────────────┘
                          ↓
                    MCP Protocol
                          ↓
┌─────────────────────────────────────────────────────────┐
│  metabob-cli (Production)                               │
│  - Fetches from backend only                            │
│  - No local file access                                 │
└─────────────────────────────────────────────────────────┘
                          ↓
                      HTTP API
                          ↓
┌─────────────────────────────────────────────────────────┐
│  metabob-rpc-api (Production)                           │
│  - Database is single source of truth                   │
│  - Bootstrap templates preloaded on startup             │
│  - No local file access                                 │
└─────────────────────────────────────────────────────────┘
                          ↑
                          │
                  Seed on Startup
                          │
┌─────────────────────────────────────────────────────────┐
│  metabob-proto (Bootstrap Templates)                    │
│  - activities/bootstrap/*.json (20 templates)           │
│  - Source of truth for bootstrap templates              │
│  - Loaded into backend on first startup                 │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Backend Bootstrap Loading ⭐ CRITICAL

**Goal**: Load metabob-proto bootstrap templates into backend on startup

**Tasks**:

1. **Create Seed Script** (NEW FILE)
   ```python
   # repos/metabob-rpc-api/scripts/seed_bootstrap_templates.py
   
   import json
   import glob
   from pathlib import Path
   
   BOOTSTRAP_DIR = Path(__file__).parent.parent.parent / "metabob-proto/activities/bootstrap"
   
   async def seed_bootstrap_templates():
       """Load all bootstrap templates into database"""
       for template_file in glob.glob(f"{BOOTSTRAP_DIR}/*.json"):
           with open(template_file) as f:
               template = json.load(f)
           
           # Convert to OpenCode schema if needed
           template_id = template.get("activity_id") or Path(template_file).stem
           
           # Check if exists
           existing = await db.get_template(template_id)
           if existing:
               print(f"Template {template_id} already exists, skipping")
               continue
           
           # Insert into database
           await db.create_template(template_id, template)
           print(f"Seeded template: {template_id}")
   ```

2. **Update Backend Startup** (MODIFY)
   ```python
   # repos/metabob-rpc-api/server/main.py
   
   @app.on_event("startup")
   async def startup_event():
       # Existing startup code...
       
       # Seed bootstrap templates if database is empty
       template_count = await db.count_templates()
       if template_count == 0:
           print("Database empty, seeding bootstrap templates...")
           await seed_bootstrap_templates()
   ```

3. **Add Environment Variable** (OPTIONAL)
   ```bash
   # .env
   SEED_BOOTSTRAP_TEMPLATES=true  # Set to false to disable auto-seeding
   ```

**Validation**:
```bash
# Start backend
cd repos/metabob-rpc-api
python server/main.py

# Check logs for "Seeded template: bug-fix"
# Verify templates exist
curl http://localhost:8000/v2/activities/templates | jq '.templates | length'
# Should return 20 (number of bootstrap templates)
```

---

### Phase 2: Remove Local Storage Fallback ⭐ CRITICAL

**Goal**: Fail fast if backend is unreachable (no silent local fallback)

**Tasks**:

1. **Update TemplateLoader** (MODIFY)
   ```typescript
   // repos/metabob-opencode/packages/opencode/src/session/template-loader.ts
   
   export async function load(id: string, options: LoadOptions = {}): Promise<LoadResult> {
     // Step 1: Check cache
     if (!options.skipCache) {
       const cached = TemplateCache.get(id, options.version)
       if (cached) return { template: cached, source: "cache", cached: true }
     }
   
     // Step 2: Try Metabob TemplateService
     if (options.backend !== "local") {
       try {
         const result = await TemplateServiceClient.getTemplate({ templateId: id })
         if (result.success && result.template) {
           TemplateCache.put(result.template)
           return { template: result.template, source: "metabob", cached: false }
         }
       } catch (error) {
         log.error("Failed to fetch template from backend", { id, error })
         throw new Error(
           `Template ${id} not found in backend. ` +
           `Backend may be unreachable or template not registered. ` +
           `Error: ${error.message}`
         )
       }
     }
   
     // Step 3: REMOVED - No local fallback in production
     // Only allow local backend if explicitly requested
     if (options.backend === "local") {
       log.warn("Using local storage (dev mode only)", { id })
       const template = await ActivityTemplate.load(id)
       return { template, source: "local", cached: false }
     }
   
     throw new Error(
       `Template not found: ${id}. ` +
       `Backend returned no results and local storage not enabled.`
     )
   }
   ```

2. **Update Error Messages** (IMPROVE)
   - Make errors actionable
   - Suggest checking backend connectivity
   - Suggest using `search_activities` to find available templates

**Validation**:
```bash
# Test with backend DOWN
cd repos/metabob-opencode/packages/opencode
docker stop metabob-rpc-api  # Simulate backend outage

bun run cli activity execute --template bug-fix

# Should fail with clear error:
# ❌ Error: Template bug-fix not found in backend.
#    Backend may be unreachable or template not registered.
#    
#    Troubleshooting:
#    1. Check backend is running: curl http://localhost:8000/health
#    2. List available templates: bun run cli activity list
#    3. Verify template ID spelling
```

---

### Phase 3: Clean Up Local Templates (Optional Cleanup)

**Goal**: Remove confusion from dead local template files

**Tasks**:

1. **Audit Local Templates**
   ```bash
   # Check what's in local templates directory
   ls -la repos/metabob-opencode/packages/opencode/templates/built-in/
   
   # Identify which are duplicates of metabob-proto
   diff -r repos/metabob-opencode/packages/opencode/templates/built-in/ \
           repos/metabob-proto/activities/bootstrap/
   ```

2. **Archive or Delete**
   ```bash
   # Option A: Delete entirely
   rm -rf repos/metabob-opencode/packages/opencode/templates/built-in/
   
   # Option B: Move to archive
   mkdir -p .archive/legacy-templates
   mv repos/metabob-opencode/packages/opencode/templates/built-in/ \
      .archive/legacy-templates/
   ```

3. **Update Documentation**
   - Remove references to local templates
   - Document that templates come from backend only
   - Update developer guides

**Validation**: Ensure system still works after deletion

---

### Phase 4: Production Testing Environment 🧪 NEW

**Goal**: Create isolated testing environment that mimics production

**Tasks**:

1. **Create Docker Compose for Testing** (NEW FILE)
   ```yaml
   # docker/docker-compose.test.yml
   
   version: '3.8'
   
   services:
     backend:
       image: metabob-rpc-api:latest
       environment:
         - SEED_BOOTSTRAP_TEMPLATES=true
       ports:
         - "8000:8000"
       volumes:
         # NO local volumes (simulates production)
         - /tmp/backend-db:/data  # Fresh database
   
     cli:
       image: metabob-cli:latest
       environment:
         - METABOB_BACKEND_URL=http://backend:8000
       depends_on:
         - backend
       volumes:
         # NO local storage (simulates production)
         - /tmp/cli-cache:/root/.cache
   
     opencode:
       image: metabob-opencode:latest
       environment:
         - MCP_SERVER_URL=http://cli:3000
       depends_on:
         - cli
       volumes:
         # NO local templates (simulates production)
         - /tmp/opencode-cache:/root/.cache
   ```

2. **Create Test Script** (NEW FILE)
   ```bash
   #!/bin/bash
   # scripts/test-production-environment.sh
   
   set -e
   
   echo "🧪 Starting production-like test environment..."
   
   # Clean up previous test data
   docker-compose -f docker/docker-compose.test.yml down -v
   rm -rf /tmp/{backend-db,cli-cache,opencode-cache}
   
   # Start services
   docker-compose -f docker/docker-compose.test.yml up -d
   
   # Wait for backend to be healthy
   echo "⏳ Waiting for backend..."
   timeout 30 bash -c 'until curl -sf http://localhost:8000/health; do sleep 1; done'
   
   # Verify bootstrap templates loaded
   echo "✅ Checking bootstrap templates..."
   TEMPLATE_COUNT=$(curl -s http://localhost:8000/v2/activities/templates | jq '.templates | length')
   if [ "$TEMPLATE_COUNT" -lt 20 ]; then
       echo "❌ Expected 20+ templates, found $TEMPLATE_COUNT"
       exit 1
   fi
   echo "✅ Found $TEMPLATE_COUNT templates"
   
   # Run test activity
   echo "🧪 Executing test activity..."
   docker exec metabob-opencode bun run cli activity execute \
       --template bug-fix \
       --var bug_description="test bug" \
       --var error_message="test error" \
       --var affected_files="[]"
   
   echo "✅ Production environment test passed!"
   ```

**Validation**:
```bash
cd repos/metabob-devbob
./scripts/test-production-environment.sh
```

---

### Phase 5: Backend Database Schema (Verify/Update)

**Goal**: Ensure backend can store and retrieve templates correctly

**Tasks**:

1. **Verify Template Table Schema**
   ```python
   # repos/metabob-rpc-api/server/models/activity_template.py
   
   class ActivityTemplate(BaseModel):
       template_id: str  # Primary key
       activity_id: str  # Metabob proto ID (may differ from template_id)
       variant_id: str
       version: int
       name: str
       description: str
       tasks: List[Task]
       variables: Dict[str, Any]
       # ... other fields
   ```

2. **Add Indexes for Performance**
   ```sql
   CREATE INDEX idx_template_activity_id ON activity_templates(activity_id);
   CREATE INDEX idx_template_version ON activity_templates(version);
   ```

3. **Add Template Validation**
   ```python
   def validate_template_schema(template: dict) -> bool:
       """Validate template conforms to OpenCode schema"""
       required_fields = ["activity_id", "tasks", "variables"]
       return all(field in template for field in required_fields)
   ```

**Validation**: Run database migrations

---

## Testing Strategy

### Test Case 1: Fresh Backend (Bootstrap Loading)

**Scenario**: New backend deployment with empty database

**Steps**:
1. Start backend with empty database
2. Check logs for "Seeding bootstrap templates..."
3. Verify 20 templates exist via API
4. Execute a bootstrap template (bug-fix)

**Expected**:
- ✅ Backend auto-seeds on first startup
- ✅ 20 bootstrap templates available
- ✅ Activity executes successfully
- ✅ No local file access

---

### Test Case 2: Backend Unreachable (Fail Fast)

**Scenario**: Backend is down or unreachable

**Steps**:
1. Stop backend service
2. Try to execute activity from OpenCode
3. Check error message

**Expected**:
- ❌ Execution fails immediately
- ✅ Clear error message about backend unreachable
- ✅ Actionable troubleshooting steps
- ❌ NO silent fallback to local storage

---

### Test Case 3: Clean Docker Environment (Production Simulation)

**Scenario**: Run in clean Docker container (no local files)

**Steps**:
1. Build Docker images from scratch
2. Start docker-compose.test.yml
3. Execute activity from within container
4. Verify no local template files exist

**Expected**:
- ✅ System works with zero local state
- ✅ Templates fetched from backend only
- ✅ Execution succeeds
- ✅ Results recorded to backend

---

### Test Case 4: Template Discovery (Search)

**Scenario**: User searches for available templates

**Steps**:
1. Run `metabob_search_activities()`
2. Verify bootstrap templates appear
3. Check template metadata (success rate, cost, duration)

**Expected**:
- ✅ All bootstrap templates listed
- ✅ Metadata shows correct values
- ✅ No errors or warnings

---

### Test Case 5: Template Caching (Performance)

**Scenario**: Repeated template loads should use cache

**Steps**:
1. Execute activity (cold start)
2. Execute same activity again
3. Check logs for cache hits

**Expected**:
- ✅ First execution: "loaded from metabob"
- ✅ Second execution: "loaded from cache"
- ✅ No network calls on cache hit
- ✅ Performance improvement (< 50ms vs > 200ms)

---

## Success Criteria

### MUST HAVE (Blocking for Production)

- ✅ **Backend Auto-Seeding**: Bootstrap templates loaded on first startup
- ✅ **No Local Fallback**: System fails fast if backend unreachable
- ✅ **Zero Local Files**: Works in clean Docker containers
- ✅ **Clear Error Messages**: Actionable troubleshooting steps
- ✅ **Production Testing**: Test environment validates all scenarios

### NICE TO HAVE (Non-Blocking)

- ✅ **Local Template Cleanup**: Remove dead local template files
- ✅ **Performance Metrics**: Cache hit rates, load times
- ✅ **Monitoring**: Backend template usage analytics
- ✅ **Documentation**: Updated architecture diagrams

---

## Implementation Timeline

### Week 1 (Critical Path)
- **Day 1**: Phase 1 - Backend bootstrap loading script ⭐
- **Day 2**: Phase 2 - Remove local storage fallback ⭐
- **Day 3**: Phase 4 - Create production testing environment ⭐
- **Day 4**: Run all test cases, fix issues
- **Day 5**: Production deployment validation

### Week 2 (Cleanup)
- **Day 1**: Phase 3 - Clean up local templates
- **Day 2**: Phase 5 - Database schema optimization
- **Day 3**: Documentation updates
- **Day 4**: Performance testing
- **Day 5**: Final review and sign-off

---

## Risk Mitigation

### Risk 1: Template Schema Mismatch

**Problem**: metabob-proto templates may not match OpenCode schema

**Mitigation**:
- Create schema validation in seed script
- Convert proto format to OpenCode format
- Add unit tests for conversion

### Risk 2: Backend Downtime

**Problem**: If backend is down, entire system fails

**Mitigation**:
- Add backend health checks
- Implement retry logic with exponential backoff
- Cache templates aggressively (1 hour TTL)
- Provide clear error messages

### Risk 3: Cache Invalidation

**Problem**: Stale templates in cache after backend updates

**Mitigation**:
- Time-based invalidation (1 hour)
- Version-based invalidation (track template version)
- Manual cache clear command

---

## Rollback Plan

If production issues arise:

1. **Immediate Rollback**:
   - Revert Phase 2 changes (restore local fallback)
   - Set `SEED_BOOTSTRAP_TEMPLATES=false` temporarily
   - Deploy previous version

2. **Investigate**:
   - Check backend logs for errors
   - Verify template schema compatibility
   - Test in staging environment

3. **Fix Forward**:
   - Address root cause
   - Re-deploy with fixes
   - Monitor closely

---

## Monitoring & Observability

### Metrics to Track

1. **Template Loading**:
   - Cache hit rate (target: >80%)
   - Backend fetch latency (target: <200ms)
   - Fallback usage (target: 0% in production)

2. **Backend Health**:
   - Template count (should be ≥20)
   - API response time (target: <100ms)
   - Error rate (target: <1%)

3. **Activity Execution**:
   - Success rate by template
   - Average duration
   - Error patterns

### Alerts

- 🚨 **CRITICAL**: Backend unreachable for >5 minutes
- ⚠️  **WARNING**: Cache hit rate <50%
- ⚠️  **WARNING**: Template count <20
- 📊 **INFO**: Local fallback used (should never happen in prod)

---

## Appendix: Bootstrap Templates Inventory

**Location**: `repos/metabob-proto/activities/bootstrap/`

**Total**: 20 templates

**Categories**:
- **Bug Fixes**: bug-fix.json, fix-security-bug.json
- **Features**: feature-impl.json, add-rest-endpoint.json
- **Refactoring**: refactor.json, safe-refactor.json
- **Security**: security-audit-complete.json
- **Activity Management**: activity-create.json, activity-debug.json, activity-evolve.json
- **Code Analysis**: code-analysis.json
- **Testing**: validate-success-attribution.json
- **Self-Contained**: create-activity-self-contained.json, debug-activity-self-contained.json
- **Template Management**: create-activity-template-v3.json, create-activity-template-v3-compat.json
- **Documentation**: jiggle-documentation.json
- **Tasks**: boredom-task-processor.json

**Quality**: Battle-tested in production ✅

---

## Next Actions

**Immediate (This Session)**:
1. Review this plan with user
2. Confirm approach (especially Phase 1 & 2)
3. Start implementation: Phase 1 (backend seeding)

**Follow-up (Next Session)**:
1. Complete Phase 2 (remove local fallback)
2. Create Phase 4 (testing environment)
3. Run all test cases
4. Deploy to staging

---

**Document Status**: DRAFT v1.0  
**Last Updated**: February 19, 2026  
**Approver**: Awaiting user confirmation
