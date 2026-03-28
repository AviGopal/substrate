# Backend-First Activity Template Architecture

**Date**: 2026-02-19  
**Status**: ✅ IMPLEMENTED (template updated, documentation complete)

## Core Principle

**All activity template interactions MUST go through metabob-cli backend via MCP tools.**  
No manual file copying. No local file dependencies. Everything through the backend.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Activity Template Lifecycle              │
└─────────────────────────────────────────────────────────────┘

1. CREATION (via create-activity-self-contained)
   ┌──────────────────────────────────────┐
   │  Agent Executes Template Creation    │
   │  - Writes to /tmp (transient)        │
   │  - NO git state required             │
   │  - NO working directory pollution    │
   └──────────┬───────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────┐
   │  Agent Calls MCP Tool                │
   │  metabob_register_activity_template  │
   │  - Sends template JSON object        │
   │  - Backend validates & stores        │
   └──────────┬───────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────┐
   │  metabob-cli Backend Storage         │
   │  ~/.metabob/activities/              │
   │  - Central source of truth           │
   │  - Persists across sessions          │
   └──────────────────────────────────────┘

2. DISCOVERY (via search_activities or metabob_search_activities)
   ┌──────────────────────────────────────┐
   │  Agent Needs Template                │
   │  search_activities({ category })     │
   └──────────┬───────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────┐
   │  OpenCode Activity Repository        │
   │  - Queries local + backend           │
   │  - Returns unified results           │
   └──────────┬───────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────┐
   │  metabob-cli MCP Tool                │
   │  metabob_search_activities           │
   │  - Lists backend templates           │
   │  - Includes metrics & status         │
   └──────────────────────────────────────┘

3. EXECUTION (via activity tool)
   ┌──────────────────────────────────────┐
   │  Agent Executes Activity             │
   │  activity({ templateId, variables }) │
   └──────────┬───────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────┐
   │  Activity Executor                   │
   │  - Fetches template from backend     │
   │  - Interpolates variables            │
   │  - Runs tasks sequentially           │
   └──────────────────────────────────────┘

4. SYNC (automated via hooks) - INTENDED BEHAVIOR
   ┌──────────────────────────────────────┐
   │  OpenCode Lifecycle Hooks            │
   │  - Pre-turn: Sync templates          │
   │  - Post-activity: Report metrics     │
   └──────────┬───────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────┐
   │  metabob-cli Backend                 │
   │  - Receives execution metrics        │
   │  - Updates success rates             │
   │  - Tracks template performance       │
   └──────────────────────────────────────┘
```

## Components

### 1. metabob-cli MCP Server

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/`

**Storage Path**: `~/.metabob/activities/*.json`

**MCP Tools**:
- `metabob_search_activities` - List templates by category
- `metabob_get_activity_template` - Get full template by ID
- `metabob_register_activity_template` - Register new template (CRITICAL for creation)
- `metabob_list_activity_templates` - List all templates (non-agentic)
- `metabob_post_activity_result` - Report execution results

**Key Functions** (`activity_templates.py`):
```python
def list_templates(category=None) -> list[dict]:
    """List templates from ~/.metabob/activities/"""
    
def get_template(template_id) -> dict | None:
    """Get template by ID from storage"""
    
def save_template(template: dict) -> str:
    """Save template to ~/.metabob/activities/{id}.json"""
    # Converts camelCase → snake_case for storage
    # Generates ID if not present
    # Returns template_id
```

### 2. OpenCode Activity System

**Location**: `repos/metabob-opencode/packages/opencode/src/`

**Key Modules**:
- `session/activity-template-repository.ts` - Template discovery (local + backend)
- `tool/activity.ts` - Activity execution tool
- `tool/search-activities.ts` - Template search tool
- `tool/register-activity-template.ts` - Registration wrapper

**Discovery Strategy**:
1. Search local storage (`~/.local/share/opencode/storage/activity-template/`)
2. Query metabob-cli backend via MCP (`~/.metabob/activities/`)
3. Merge & deduplicate results
4. Return unified list to agent

### 3. create-activity-self-contained Template

**Location**: `.metabob/activities/create-activity-self-contained.json`

**Key Changes (2026-02-19)**:
- ✅ Removed git state dependency (`preChecks: []`, `postChecks: []`)
- ✅ Uses `/tmp/activity-template-{id}/` for all temporary files
- ✅ Explicit backend registration via `metabob_register_activity_template`
- ✅ Forbidden pattern: `"preChecks": ["git"` to prevent accidental git checks
- ✅ Clear documentation that temp files are transient, backend is permanent

**Workflow**:
```
1. gather-requirements → /tmp/activity-template-{id}/REQUIREMENTS.md
2. design-task-graph → /tmp/activity-template-{id}/TASK_GRAPH.md
3. write-template-json → /tmp/activity-template-{id}/{id}.json
4. register-with-backend → metabob_register_activity_template(template)
                         → ~/.metabob/activities/{id}.json (backend)
                         → /tmp/activity-template-{id}/SUCCESS.md
```

## Intended Behavior (Automated via Hooks)

### Hook 1: Template Bootstrap

**When**: OpenCode starts in a new environment (devbob container, clean install)

**What Should Happen**:
1. OpenCode checks if local template cache is empty
2. Queries metabob-cli backend for available templates
3. Syncs frequently-used templates to local cache
4. Agent can immediately discover and use templates

**Implementation** (TODO):
```typescript
// In opencode initialization or pre-turn hook
async function syncTemplatesFromBackend() {
  const mcp = getMCPClient('metabob');
  const backendTemplates = await mcp.call('metabob_list_activity_templates');
  
  for (const template of backendTemplates.top25 /* or similar */) {
    await cacheTemplateLocally(template);
  }
}
```

### Hook 2: Activity Execution Reporting

**When**: Activity completes (success or failure)

**What Should Happen**:
1. Activity executor captures execution metrics
2. Calls `metabob_post_activity_result` with results
3. Backend updates template metrics (success rate, avg cost, avg duration)
4. Future agents see updated metrics when searching

**Implementation** (TODO):
```typescript
// In activity executor post-execution
async function reportActivityResult(activityId, result) {
  const mcp = getMCPClient('metabob');
  await mcp.call('metabob_post_activity_result', {
    activityId,
    result: {
      success: result.success,
      duration: result.durationMs,
      cost: result.cost,
      tokens: result.tokens
    }
  });
}
```

### Hook 3: Template Auto-Registration (Bootstrap Templates)

**When**: OpenCode starts for the first time OR detects missing critical templates

**What Should Happen**:
1. Check if critical templates exist in backend (create-activity-self-contained, etc.)
2. If missing, register from bootstrap templates in `repos/metabob-proto/activities/bootstrap/`
3. Ensures every environment has core templates

**Implementation** (TODO):
```typescript
// In opencode initialization
async function ensureBootstrapTemplates() {
  const criticalTemplates = [
    'create-activity-self-contained',
    'fix-bug-complete',
    'add-feature-complete'
  ];
  
  const mcp = getMCPClient('metabob');
  const existing = await mcp.call('metabob_list_activity_templates');
  const existingIds = new Set(existing.map(t => t.id));
  
  for (const templateId of criticalTemplates) {
    if (!existingIds.has(templateId)) {
      const template = loadBootstrapTemplate(templateId);
      await mcp.call('metabob_register_activity_template', { template });
    }
  }
}
```

## Benefits of This Architecture

### 1. No File System Dependencies
- ✅ Agents don't need access to local template directories
- ✅ Works in containerized environments with no mounted volumes
- ✅ Works in remote environments with no local filesystem access

### 2. Centralized Management
- ✅ Single source of truth: `~/.metabob/activities/`
- ✅ Templates shared across all OpenCode instances connecting to same backend
- ✅ Easy backup: Just backup `~/.metabob/activities/`

### 3. Git State Independence
- ✅ Template creation doesn't require clean git state
- ✅ Template creation doesn't modify working directory
- ✅ Temporary files in `/tmp` are automatically cleaned up

### 4. Metrics & Learning
- ✅ Backend tracks execution metrics per template
- ✅ Success rates inform template quality
- ✅ Agents can choose templates based on proven success

### 5. Scalability
- ✅ Multiple agents can share templates via same backend
- ✅ Template library grows organically as agents create new templates
- ✅ No manual distribution of template files

## Implementation Checklist

### ✅ Completed (2026-02-19)

- [x] Updated `create-activity-self-contained` template
  - [x] Removed git state requirements
  - [x] Changed file locations to `/tmp`
  - [x] Added backend registration task
  - [x] Added forbidden pattern for git checks
- [x] Updated template in 3 locations:
  - [x] `.metabob/activities/create-activity-self-contained.json`
  - [x] `repos/metabob-proto/activities/bootstrap/create-activity-self-contained.json`
  - [x] `repos/metabob-cli/.metabob/activities/create-activity-self-contained.json`
- [x] Documented architecture and flow
- [x] Created `BACKEND_FIRST_TEMPLATE_ARCHITECTURE.md`

### 🚧 TODO (Hook Implementation)

- [ ] Implement template bootstrap hook in OpenCode initialization
  - [ ] Check for critical templates on startup
  - [ ] Auto-register from bootstrap directory if missing
  - [ ] Log sync status
- [ ] Implement activity result reporting hook
  - [ ] Capture execution metrics
  - [ ] Call `metabob_post_activity_result` after each activity
  - [ ] Update template success rates
- [ ] Implement template sync hook (pre-turn)
  - [ ] Query backend for new/updated templates
  - [ ] Sync to local cache for performance
  - [ ] Use local cache with fallback to backend
- [ ] Add configuration for template sync behavior
  - [ ] Enable/disable auto-sync
  - [ ] Configure sync frequency
  - [ ] Configure which templates to cache locally

### 🔍 Testing TODO

- [ ] Test template creation in clean devbob container (no git, no volumes)
- [ ] Verify template registered to backend
- [ ] Verify newly created template is immediately usable
- [ ] Test template execution in different container
- [ ] Verify metrics are reported after execution
- [ ] Test template sync across multiple agents

## Proof of Concept Test Plan

### Test 1: Clean Container Template Creation

**Setup**:
- devbob-clean container (✅ already running and healthy)
- No git repository in /workspace (✅ verified)
- No mounted volumes (✅ verified)

**Steps**:
1. Ensure `create-activity-self-contained` is available in backend
2. Execute template creation via agent prompt
3. Verify temp files created in `/tmp/activity-template-*/`
4. Verify template registered to `~/.metabob/activities/`
5. Verify no files created in `/workspace` (working directory clean)

**Expected Outcome**:
- ✅ Template created successfully without git state
- ✅ Template registered to backend
- ✅ Working directory remains clean
- ✅ Template immediately discoverable via `search_activities`

### Test 2: Cross-Container Template Usage

**Setup**:
- Template created in devbob-clean
- Execute template in different container (devbob-rpc-api or new container)

**Steps**:
1. Create template in devbob-clean (Test 1)
2. Start/use different devbob container
3. Search for template via `search_activities`
4. Execute template to verify it works

**Expected Outcome**:
- ✅ Template discoverable in second container (via backend)
- ✅ Template executes successfully
- ✅ Proves backend-first architecture works

## Troubleshooting

### Issue: Template not found after registration

**Possible Causes**:
1. Template registered to wrong location (should be `~/.metabob/activities/`)
2. MCP client not connecting to metabob-cli backend
3. Template ID mismatch (generated ID vs. provided ID)

**Debug**:
```bash
# Check backend storage
ls -la ~/.metabob/activities/

# Check OpenCode MCP configuration
cat ~/.config/opencode/opencode.json | jq '.mcp.metabob'

# Test MCP connection
# (use OpenCode's MCP test tools)
```

### Issue: Agent still trying to write to working directory

**Possible Causes**:
1. Using old template version (before 2026-02-19 update)
2. Agent not following template instructions
3. Template prompt ambiguous about file locations

**Fix**:
- Ensure template has been updated and registered
- Check template prompts explicitly mention `/tmp/activity-template-*/`
- Update template if instructions are unclear

### Issue: Git state still required

**Possible Causes**:
1. Template still has `preChecks: ["git status"]`
2. Old template cached locally
3. Bootstrap templates not updated

**Fix**:
- Verify template JSON has `"preChecks": []` and `"postChecks": []`
- Clear local template cache: `rm -rf ~/.local/share/opencode/storage/activity-template/*`
- Update all template locations (see "Implementation Checklist")

## Next Steps

1. **Implement Hooks**: Add the TODO hooks listed above to automate template sync and metrics reporting
2. **Test in Clean Environment**: Execute Test 1 to prove template creation works without git/files
3. **Test Cross-Container**: Execute Test 2 to prove backend-first architecture enables template sharing
4. **Monitor & Iterate**: Track template usage and success rates, improve templates based on data

## References

- `CREATE_ACTIVITY_TEMPLATE_IMPROVEMENTS.md` - Detailed changes to create-activity-self-contained
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py` - MCP tool implementations
- `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py` - Backend storage logic
- `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts` - Registration tool
- `.metabob/activities/create-activity-self-contained.json` - Updated template (source of truth)
