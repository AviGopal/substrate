# Correct Architecture: Template Distribution via Backend

**Date:** March 2, 2026  
**Issue:** Templates should NOT be stored locally (except cache)  
**Correct Approach:** Backend-centric template distribution via MCP

---

## The Right Architecture

### Clean Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEMPLATE ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────┘

Backend (metabob-proto)
├─ Source of truth for ALL templates
├─ Stores high-quality, vetted templates
├─ Thompson Sampling variant selection
├─ Learning system data collection
└─ Template registry with metrics

        ↓ MCP Protocol

metabob-cli
├─ Fetches templates from backend via MCP
├─ Caches locally for performance
├─ Knows backend URL only
└─ No local template storage (except cache)

        ↓ Template Execution

metabob-opencode
├─ Executes templates provided by CLI
├─ NO knowledge of what templates exist
├─ NO template discovery logic
├─ Pure execution engine
└─ Template-agnostic
```

---

## What Each Component Should Know

### Backend (metabob-proto)

**Responsibilities:**
- Store ALL activity templates
- Version templates
- Track metrics (success rate, cost, duration)
- Implement Thompson Sampling for variant selection
- Provide template registry API

**What it knows:**
```
✓ All available templates
✓ Template metadata (success rates, versions)
✓ Which variants to serve (Thompson Sampling)
✓ Template execution history
✓ Learning data from all executions
```

**What it doesn't know:**
```
✗ How templates are executed (that's OpenCode)
✗ Local file systems
✗ Client configurations
```

**API Endpoints:**
```typescript
GET  /v2/activities/templates              // List all templates
GET  /v2/activities/templates/:id          // Get specific template
GET  /v2/activities/templates/:id/select   // Thompson Sampling selection
POST /v2/activities/templates/:id/metrics  // Report execution results
POST /v2/activities/templates              // Register new template
```

---

### metabob-cli

**Responsibilities:**
- Fetch templates from backend via MCP
- Cache templates locally (cache only, not source of truth)
- Provide templates to OpenCode
- Configure backend URL

**What it knows:**
```
✓ Backend URL (from config)
✓ How to fetch templates (MCP protocol)
✓ Cache location (~/.cache/metabob/templates/)
✓ Cache invalidation strategy
```

**What it doesn't know:**
```
✗ What templates exist (asks backend)
✗ Which template to use (backend decides via Thompson Sampling)
✗ Template execution details (that's OpenCode)
```

**CLI Commands:**
```bash
# Configure backend
metabob-cli config set backend-url https://api.metabob.com

# List available templates (from backend)
metabob-cli templates list

# Fetch specific template (caches locally)
metabob-cli templates get create-activity-template

# Execute activity (fetches template from backend if not cached)
metabob-cli exec activity --template create-activity-template

# Clear cache
metabob-cli cache clear
```

**Configuration:**
```json
{
  "backend": {
    "url": "https://api.metabob.com",
    "timeout": 30000
  },
  "cache": {
    "dir": "~/.cache/metabob/templates",
    "ttl": 3600
  }
}
```

---

### metabob-opencode

**Responsibilities:**
- Execute templates provided to it
- Report execution results back to backend (via MCP)
- Manage activity lifecycle

**What it knows:**
```
✓ How to execute a template (task orchestration)
✓ How to validate results
✓ How to collect metrics
✓ How to report to backend
```

**What it doesn't know:**
```
✗ What templates exist (doesn't care)
✗ Where templates come from (receives them)
✗ Which template variant to use (backend decides)
✗ Template registry (not its concern)
```

**API Surface:**
```typescript
// OpenCode receives templates, doesn't discover them
async function executeActivity(template: ActivityTemplate, variables: any) {
  // Template provided by CLI (which got it from backend)
  const result = await runTemplate(template, variables)
  
  // Report back to backend via MCP
  await reportMetrics(template.id, result)
  
  return result
}
```

---

## Core Templates Required for Basic Operation

These should be in the backend's registry:

### Bootstrap Templates (Must-Have)

1. **create-activity-template**
   - Purpose: Create new activity templates
   - Why: Enables users to build their own templates

2. **hello-world-minimal**
   - Purpose: Test template execution
   - Why: Validates system is working

### Debugging Templates (Essential)

3. **debug-activity-execution-failure**
   - Purpose: Debug failed activities
   - Why: Core use case - learning from failures

4. **evolve-activity-template**
   - Purpose: Improve existing templates
   - Why: Learning system - template evolution

### Data Flow Templates (Essential)

5. **trace-data-flow-single-feature**
   - Purpose: Document data flows
   - Why: Understanding codebase architecture

### Infrastructure Templates (Common)

6. **validate-deployment-constraints**
   - Purpose: Verify deployment readiness
   - Why: Common operational need

7. **deploy-to-environment**
   - Purpose: Deploy applications
   - Why: Core DevOps workflow

---

## Correct Deployment Setup

### What Testing Team Needs

```bash
# 1. Install metabob-cli (only)
curl -fsSL https://install.metabob.com/cli.sh | sh

# 2. Configure backend
metabob-cli config set backend-url https://api.metabob.com

# 3. Verify connection
metabob-cli templates list
# → Shows templates from backend (7-10 core templates)

# 4. Execute activity
metabob-cli exec activity --template create-activity-template
# → CLI fetches from backend, caches, passes to OpenCode
```

**That's it!** No local template management needed.

---

## Cache Strategy

### Cache Location

```
~/.cache/metabob/templates/
├── create-activity-template.json      # Cached from backend
├── debug-activity-execution.json      # Cached from backend
├── .metadata                          # Cache metadata
│   ├── cache-time                     # When cached
│   ├── backend-url                    # Source backend
│   └── ttl                            # Time to live
└── ...
```

### Cache Rules

1. **Fetch from backend first** - Always try backend
2. **Cache on success** - Store locally after fetch
3. **Use cache if backend unavailable** - Offline mode
4. **Respect TTL** - Re-fetch after expiration (default: 1 hour)
5. **Clear on backend change** - New backend = clear cache

### Cache Commands

```bash
# Show cache status
metabob-cli cache status
# Output:
# Cache location: ~/.cache/metabob/templates
# Templates cached: 7
# Last refresh: 2026-03-02 10:30:15
# Backend: https://api.metabob.com

# Clear cache
metabob-cli cache clear

# Refresh cache
metabob-cli cache refresh
```

---

## Template Lifecycle

### 1. Template Discovery

```typescript
// User runs:
metabob-cli templates list

// CLI fetches from backend:
const templates = await fetch(`${backendURL}/v2/activities/templates`)

// Display to user:
console.log("Available templates:")
templates.forEach(t => console.log(`  - ${t.id}: ${t.description}`))
```

### 2. Template Execution

```typescript
// User runs:
metabob-cli exec activity --template create-activity-template

// CLI workflow:
1. Check cache: Does ~/.cache/metabob/templates/create-activity-template.json exist?
   - YES: Check TTL, use if valid
   - NO: Fetch from backend

2. Fetch from backend (if needed):
   const template = await fetch(`${backendURL}/v2/activities/templates/create-activity-template`)
   
3. Cache locally:
   await writeFile(cacheDir + "/create-activity-template.json", JSON.stringify(template))

4. Pass to OpenCode:
   await opencode.executeActivity(template, variables)
```

### 3. Metrics Reporting

```typescript
// After execution, OpenCode reports to backend:
const result = {
  templateId: "create-activity-template",
  success: true,
  duration: 45000,
  cost: 0.0234,
  tokens: { input: 5000, output: 3000, cache: 2000 }
}

// Backend updates Thompson Sampling metrics:
await fetch(`${backendURL}/v2/activities/templates/create-activity-template/metrics`, {
  method: "POST",
  body: JSON.stringify(result)
})
```

---

## Thompson Sampling Integration

### How It Works

```
User requests template: "create-activity-template"
                ↓
CLI asks backend: GET /v2/activities/templates/create-activity-template/select
                ↓
Backend runs Thompson Sampling:
  - Variant A: alpha=10, beta=2  → sample=0.85
  - Variant B: alpha=8,  beta=3  → sample=0.72
  - Variant C: alpha=5,  beta=8  → sample=0.38
                ↓
Backend selects Variant A (highest sample)
                ↓
Backend returns Variant A template
                ↓
CLI caches and passes to OpenCode
                ↓
OpenCode executes Variant A
                ↓
Results reported back to backend
                ↓
Backend updates: alpha_A = 11 (if success) or beta_A = 3 (if failure)
```

### Backend Selection Endpoint

```typescript
// GET /v2/activities/templates/:id/select
async function selectVariant(templateId: string): Promise<ActivityTemplate> {
  const variants = await db.getVariants(templateId)
  
  // Thompson Sampling
  const samples = variants.map(v => ({
    variant: v,
    sample: sampleBeta(v.metrics.alpha, v.metrics.beta)
  }))
  
  // Select highest sample
  const selected = samples.reduce((max, s) => 
    s.sample > max.sample ? s : max
  )
  
  return selected.variant.template
}
```

---

## Migration Plan

### Current State (WRONG)

```
✗ Templates stored in ./templates/ directory (82 files)
✗ Scripts reference local paths
✗ No backend integration
✗ Testing team needs local templates
✗ No Thompson Sampling selection
```

### Target State (RIGHT)

```
✓ Backend stores all templates
✓ CLI fetches via MCP
✓ Local cache only (not source of truth)
✓ Testing team needs backend URL only
✓ Thompson Sampling automatic
```

### Migration Steps

#### Phase 1: Backend Setup (2 hours)

1. **Upload templates to backend**
   ```bash
   # Register core templates with backend
   for template in templates/bootstrap/*.json; do
     metabob-cli templates register --file $template --backend https://api.metabob.com
   done
   ```

2. **Verify backend API**
   ```bash
   curl https://api.metabob.com/v2/activities/templates
   # Should return 7-10 core templates
   ```

#### Phase 2: CLI Implementation (3 hours)

3. **Add backend fetch to CLI**
   ```typescript
   // metabob-cli/lib/template-fetcher.ts
   export async function fetchTemplate(id: string): Promise<ActivityTemplate> {
     // 1. Check cache
     const cached = await loadFromCache(id)
     if (cached && !isExpired(cached)) return cached
     
     // 2. Fetch from backend
     const backend = config.get("backend.url")
     const template = await fetch(`${backend}/v2/activities/templates/${id}`)
     
     // 3. Cache locally
     await saveToCache(id, template)
     
     return template
   }
   ```

4. **Add cache management**
   ```bash
   metabob-cli cache status
   metabob-cli cache clear
   metabob-cli cache refresh
   ```

#### Phase 3: OpenCode Update (1 hour)

5. **Remove template discovery from OpenCode**
   ```typescript
   // REMOVE:
   - search_activities tool (move to CLI)
   - register_activity_template tool (move to CLI)
   - Template file system scanning
   
   // KEEP:
   - activity tool (execute provided template)
   - activity_error_inspector (debugging)
   - activity_replay (learning from failure)
   ```

6. **OpenCode becomes template-agnostic**
   ```typescript
   // OpenCode just executes templates it receives
   async function executeActivity(template: ActivityTemplate, vars: any) {
     // No knowledge of where template came from
     // Just execute it
   }
   ```

#### Phase 4: Testing (2 hours)

7. **Clean environment test**
   ```bash
   # Fresh Ubuntu VM
   docker run -it ubuntu:22.04
   
   # Install CLI only
   curl -fsSL https://install.metabob.com/cli.sh | sh
   
   # Configure backend
   metabob-cli config set backend-url https://api.metabob.com
   
   # List templates (from backend)
   metabob-cli templates list
   # → Should show 7-10 templates
   
   # Execute activity
   metabob-cli exec activity --template create-activity-template
   # → Should work without any local templates
   ```

8. **Validation test update**
   ```bash
   # Update validation scripts to use backend
   # Remove all local template references
   # Verify works on clean environment
   ```

---

## Configuration Examples

### metabob-cli config.json

```json
{
  "backend": {
    "url": "https://api.metabob.com",
    "timeout": 30000,
    "retries": 3
  },
  "cache": {
    "enabled": true,
    "dir": "~/.cache/metabob/templates",
    "ttl": 3600
  },
  "offline": {
    "useCacheIfBackendDown": true,
    "maxCacheAge": 86400
  }
}
```

### Environment Variables

```bash
# Backend URL (overrides config)
export METABOB_BACKEND_URL=https://api.metabob.com

# Cache directory (overrides default)
export METABOB_CACHE_DIR=~/.cache/metabob/templates

# Offline mode (use cache even if backend available)
export METABOB_OFFLINE_MODE=true
```

---

## Benefits of This Architecture

### 1. Clean Separation ✅

- Backend: Template storage and selection
- CLI: Template fetching and caching
- OpenCode: Template execution

### 2. Centralized Learning ✅

- Backend collects ALL execution data
- Thompson Sampling learns globally
- Template improvements benefit everyone

### 3. Simple Deployment ✅

```bash
# Testing team needs:
1. metabob-cli (one install)
2. Backend URL (one config)
3. That's it!
```

### 4. Offline Support ✅

- Cache works when backend unreachable
- Graceful degradation
- No blocking on network

### 5. Automatic Updates ✅

- Templates auto-update (respect TTL)
- No manual template management
- Always latest from backend

---

## Testing Team Setup (CORRECT)

### What They Need

```bash
# Dependencies:
1. metabob-cli installed
2. metabob-opencode fork cloned
3. Backend URL configured

# That's it! No local templates needed.
```

### Setup Steps

```bash
# 1. Install CLI
curl -fsSL https://install.metabob.com/cli.sh | sh

# 2. Clone OpenCode fork
git clone https://github.com/metabob/metabob-opencode
cd metabob-opencode && bun install && bun run build

# 3. Configure backend
metabob-cli config set backend-url https://api.metabob.com

# 4. Verify setup
metabob-cli templates list
# Should show templates from backend

# 5. Run validation
./scripts/validate-core-use-case-e2e.sh
# Should work without any local templates
```

---

## Summary

### What We Were Doing (WRONG) ❌

```
- Storing 82 templates locally
- Hardcoding paths to ./templates/
- Distributing templates with code
- Testing team needs local template setup
```

### What We Should Do (RIGHT) ✅

```
- Backend stores ALL templates
- CLI fetches via MCP (caches locally)
- OpenCode is template-agnostic
- Testing team needs backend URL only
```

### Architecture Principles

1. **Backend is source of truth** - All templates stored there
2. **CLI is fetcher/cacher** - Gets templates from backend
3. **OpenCode is executor** - Runs what it's given
4. **Cache is performance** - Not source of truth
5. **MCP is protocol** - Standard template distribution

### Migration Timeline

- **Phase 1:** Backend setup (2 hours)
- **Phase 2:** CLI implementation (3 hours)
- **Phase 3:** OpenCode cleanup (1 hour)
- **Phase 4:** Testing (2 hours)
- **Total:** 8 hours to correct architecture

### Benefits

✅ Clean separation of concerns  
✅ Centralized learning system  
✅ Simple deployment (backend URL only)  
✅ Automatic template updates  
✅ Offline support via cache  
✅ Thompson Sampling works globally  

**This is the right way.** Let's implement it.

---

**Next Action:** Implement Phase 1 (Backend template registration)
