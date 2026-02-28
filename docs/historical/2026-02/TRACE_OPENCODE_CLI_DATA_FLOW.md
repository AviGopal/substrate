# Trace OpenCode → CLI Data Flow & Improvement Plan

**Date:** 2026-02-23  
**Goal:** Use trace-data-flow and develop-multi-repo-feature to improve CLI alignment with activity-based development

---

## Discovery: What We Found

### metabob-cli Current State

**Architecture:**
- **Language:** Python (not TypeScript)
- **Purpose:** CLI tool for code analysis with Metabob backend
- **MCP Integration:** ✅ Already has MCP tools and activity management
- **Activity Support:** ✅ Has ActivityManager for backend API integration

**Key Files:**
```
repos/metabob-cli/
├── src/metabob_cli/
│   ├── __main__.py (entry point)
│   ├── commands.py (CLI commands)
│   ├── mcp/
│   │   └── activity_manager.py (Activity integration!)
│   ├── core/
│   │   ├── session_manager.py
│   │   ├── file_watcher.py
│   │   ├── analysis.py
│   │   └── ...
│   └── ...
```

**Existing MCP Tools in CLI:**
- `search_activities` - Search for activity templates
- `query_high_success_impulses` - Get proven impulses for session
- `query_activity_impulses` - Get activity-specific impulses
- `get_activity` - Get activity metadata
- `register_template` - Register activity templates (CLI command)

---

## Data Flow: OpenCode → CLI

### Current Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    metabob-opencode                           │
│                                                               │
│  ActivitySystem.ts                                           │
│  ├─ ActivityTool (executes activities)                       │
│  ├─ ActivityExecutor (manages execution)                     │
│  └─ ActivityTemplate (template schema)                       │
│                                                               │
│  SessionMemoryAgent                                          │
│  ├─ Pre-turn memory management                               │
│  ├─ Impulse loading via ActivityManager                      │
│  └─ Context optimization                                     │
│                                                               │
│  ImpulseSystem                                               │
│  ├─ Impulse creation and loading                             │
│  ├─ Tag-based filtering                                      │
│  └─ Budget management                                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                         ↓ HTTP API (REST)
┌──────────────────────────────────────────────────────────────┐
│                  metabob-rpc-api (Backend)                    │
│                                                               │
│  /v2/activities/templates/{id}                               │
│  /v2/impulses/for-activity/{variant_id}                      │
│  /v2/impulses/high-success                                   │
│  /v2/activities/search                                       │
│                                                               │
│  Database: SurrealDB                                         │
│  ├─ Activity templates                                       │
│  ├─ Activity executions (metrics)                            │
│  ├─ Impulses (high-success tracking)                         │
│  └─ Session data                                             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                         ↓ HTTP API (REST)
┌──────────────────────────────────────────────────────────────┐
│                      metabob-cli                              │
│                                                               │
│  ActivityManager.py                                          │
│  ├─ search_activities() → Backend API                        │
│  ├─ query_activity_impulses() → Backend API                  │
│  ├─ query_high_success_impulses() → Backend API              │
│  └─ get_activity() → Backend API                             │
│                                                               │
│  MCP Server (embedded)                                       │
│  ├─ Exposes activity management tools                        │
│  ├─ OpenCode connects via MCP                                │
│  └─ Session token authentication                             │
│                                                               │
│  Commands                                                    │
│  ├─ register-template (upload activity templates)            │
│  ├─ analyze (code analysis)                                  │
│  ├─ watch (file watcher)                                     │
│  └─ ...                                                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Current CLI Capabilities

### What CLI Does Well ✅

1. **Activity Management via Backend**
   - Search activities from backend
   - Query proven impulses
   - Session token authentication

2. **MCP Integration**
   - Exposes tools for OpenCode
   - Backend API client with proper auth
   - Impulse querying for pre-initialization

3. **File Watching**
   - Real-time code analysis
   - State tracking
   - Session management

---

## Gaps: What's Missing 🔴

### Gap 1: No Direct Activity Execution

**Current:** CLI can search and query activities, but NOT execute them

**Need:** CLI should be able to execute OpenCode activities directly

**Why:** 
- Users want to run activities from CLI
- Batch processing of activities
- CI/CD integration
- Scriptable workflows

---

### Gap 2: No Safe Self-Development Workflow

**Current:** CLI doesn't use containers for development

**Need:** CLI should develop itself safely using devbob-cli container

**Why:**
- Align with safe self-development architecture
- Never break CLI on host
- Validate changes before incorporating

---

### Gap 3: No Cross-Repo Coordination

**Current:** CLI works independently

**Need:** CLI should coordinate with OpenCode for cross-repo features

**Why:**
- Features often span OpenCode + CLI
- Example: New activity type needs OpenCode (execution) + CLI (registration)
- Shared schema between repos

---

### Gap 4: Limited Activity Template Management

**Current:** `register-template` command uploads to backend

**Need:** 
- Create activity templates via CLI
- Validate templates locally
- Test templates before registering

**Why:**
- Faster iteration
- Local validation
- Better developer experience

---

## Improvement Plan

### Improvement 1: Add Activity Execution to CLI

**Goal:** `metabob activity <template-id>` executes OpenCode activities

**Design:**
```python
# metabob-cli/src/metabob_cli/commands.py

@cli.command()
@click.argument("template_id")
@click.option("--variables", "-v", multiple=True, help="Variable assignments (key=value)")
@click.option("--reason", "-r", required=True, help="Reason for activity execution")
async def activity(template_id: str, variables: tuple, reason: str):
    """Execute an OpenCode activity via ACP delegation.
    
    Examples:
        metabob activity trace-data-flow-single-feature -v featureName=auth -r "Map auth flow"
        metabob activity trace-enforce-validate-loop -v spec=user-validation -r "Add validation"
    """
    # 1. Connect to OpenCode via ACP (localhost or container)
    # 2. Parse variables (key=value pairs)
    # 3. Delegate activity execution to OpenCode
    # 4. Stream progress to terminal
    # 5. Return results
```

**Benefits:**
- Run activities from command line
- Scriptable workflows
- CI/CD integration

---

### Improvement 2: CLI Self-Development via Container

**Goal:** Use devbob-cli for safe CLI development

**Design:**
```bash
# From host (metabob-devbob)
opencode activity develop-with-devbob-container \
  targetRepository=metabob-cli \
  specificationName=activity-execution-command \
  specificationDescription="Add CLI command to execute OpenCode activities" \
  expectedBehavior="metabob activity <id> runs activity via ACP" \
  validationStrategy="Test: metabob activity trace-data-flow --dry-run succeeds"
```

**Flow:**
1. Host delegates to devbob-cli container
2. Container develops new CLI command
3. Container runs tests
4. Container pushes to metabobproject/metabob-cli
5. Host pulls validated changes
6. Host verifies CLI works

**Benefits:**
- Never break CLI on host
- Validated changes only
- Full git history

---

### Improvement 3: Cross-Repo Activity Development

**Goal:** Coordinate OpenCode + CLI for new activity features

**Design:**
```bash
# Example: Add "code review" activity type
opencode activity develop-multi-repo-feature \
  featureName=code-review-activity \
  repositories='[
    {
      "name": "metabob-opencode",
      "specificationDescription": "Add code review activity execution support",
      "targetFiles": ["src/activity/ActivityTool.ts", "src/activity/ActivityExecutor.ts"]
    },
    {
      "name": "metabob-cli",
      "specificationDescription": "Add CLI command for code review activities",
      "targetFiles": ["src/metabob_cli/commands.py", "src/metabob_cli/mcp/activity_manager.py"]
    }
  ]' \
  coordinationStrategy=sequential \
  sharedSpecification="Code review activities analyze code and provide feedback"
```

**Flow:**
1. Develop in OpenCode first (execution engine)
2. Develop in CLI second (command interface)
3. Validate integration
4. Both repos push to their remotes
5. Host pulls both
6. Cross-repo E2E tests

**Benefits:**
- Coordinated development
- Shared specifications
- Integration validation

---

### Improvement 4: Local Template Development

**Goal:** Create and validate activity templates locally before registering

**Design:**
```python
# New CLI commands

@cli.command()
@click.argument("template_file")
@click.option("--validate-only", is_flag=True, help="Only validate, don't register")
async def create_template(template_file: str, validate_only: bool):
    """Create activity template from JSON file.
    
    Validates schema, tests locally if possible, optionally registers with backend.
    """
    # 1. Load JSON file
    # 2. Validate against ActivityTemplate schema
    # 3. If --validate-only: exit
    # 4. Else: Register with backend
    pass

@cli.command()
@click.argument("template_id")
@click.option("--dry-run", is_flag=True)
async def test_template(template_id: str, dry_run: bool):
    """Test activity template execution locally.
    
    Runs template in dry-run mode to verify it works before using in production.
    """
    # 1. Get template from backend
    # 2. Execute with test variables
    # 3. Validate outputs
    # 4. Report success/failure
    pass
```

**Benefits:**
- Faster iteration
- Local validation
- Confidence before registration

---

## Specific Improvements to Implement

### Phase 1: Activity Execution (HIGH PRIORITY)

**Repos:** metabob-cli

**Tasks:**
1. Add `metabob activity` command
2. Implement ACP client in CLI (connect to OpenCode)
3. Parse variable arguments
4. Stream execution progress
5. Handle results

**Activity to Use:**
```bash
opencode activity develop-with-devbob-container \
  targetRepository=metabob-cli \
  specificationName=cli-activity-execution \
  specificationDescription="Add command to execute OpenCode activities from CLI" \
  expectedBehavior="metabob activity <template-id> connects to OpenCode via ACP and executes activity" \
  validationStrategy="Test: metabob activity trace-data-flow-single-feature featureName=test succeeds" \
  workingBranch=self-dev/cli-activity-execution
```

---

### Phase 2: Cross-Repo Schema Sharing (MEDIUM PRIORITY)

**Repos:** metabob-opencode, metabob-cli

**Problem:** Activity template schema duplicated between repos

**Solution:** Shared schema package or proto definitions

**Tasks:**
1. Extract ActivityTemplate schema from OpenCode
2. Create shared schema package (Python + TypeScript)
3. Both repos import shared schema
4. Validate compatibility

**Activity to Use:**
```bash
opencode activity develop-multi-repo-feature \
  featureName=shared-activity-schema \
  repositories='[...]' \
  coordinationStrategy=sequential \
  sharedSpecification="Activity template schema shared between OpenCode and CLI"
```

---

### Phase 3: CLI Self-Development Workflow (MEDIUM PRIORITY)

**Repos:** metabob-cli

**Tasks:**
1. Document CLI development via devbob-cli
2. Test safe development workflow
3. Create CLI-specific activities (if needed)

**Activity to Use:**
```bash
# Already designed: develop-with-devbob-container
# Just use it with targetRepository=metabob-cli
```

---

### Phase 4: Enhanced Activity Management (LOW PRIORITY)

**Repos:** metabob-cli

**Tasks:**
1. `metabob create-template` command
2. `metabob test-template` command
3. Local template validation
4. Template versioning support

**Activity to Use:**
```bash
opencode activity develop-with-devbob-container \
  targetRepository=metabob-cli \
  specificationName=enhanced-template-management \
  ...
```

---

## Next Steps (Immediate)

### Step 1: Trace Data Flow Using Activities

**Use:** `trace-data-flow-single-feature` for both repos

```bash
# Trace OpenCode activity system
opencode activity trace-data-flow-single-feature \
  featureName="activity-execution-system" \
  reason="Map how activities execute before modifying CLI"

# Trace CLI activity manager
opencode activity trace-data-flow-single-feature \
  featureName="cli-activity-manager" \
  reason="Map how CLI queries activities from backend"
```

**Outputs:**
- Data flow diagrams for both
- Component annotations
- Gap analysis
- Design documentation

---

### Step 2: Develop Activity Execution in CLI

**Use:** `develop-with-devbob-container`

```bash
opencode activity develop-with-devbob-container \
  targetRepository=metabob-cli \
  specificationName=cli-activity-execution \
  specificationDescription="Add metabob activity command to execute OpenCode activities via ACP" \
  expectedBehavior="CLI connects to OpenCode (localhost:3000 or container), delegates activity execution, streams progress, returns results" \
  validationStrategy="Test suite: (1) metabob activity trace-data-flow featureName=test, (2) verify ACP connection, (3) verify results returned" \
  targetFiles='["src/metabob_cli/commands.py", "src/metabob_cli/acp_client.py"]' \
  workingBranch=self-dev/cli-activity-execution \
  shareImpulses='["opencode-activity-system-trace"]'
```

**Why This is Perfect:**
- Uses our new safe self-development workflow
- Develops in devbob-cli container (isolated)
- Validates before incorporating to host
- Shares traced data flow as context

---

### Step 3: Validate Cross-Repo

**Use:** `validate-cross-repo-changes`

```bash
opencode activity validate-cross-repo-changes \
  repositories='[
    {
      "name": "metabob-opencode",
      "commitSHA": "HEAD",
      "container": "docker://devbob-opencode"
    },
    {
      "name": "metabob-cli",
      "commitSHA": "HEAD",
      "container": "docker://devbob-cli"
    }
  ]' \
  integrationTests='["test:integration", "test:e2e"]' \
  validationStrategy="Start OpenCode in container, CLI connects and executes activity, verify results"
```

**Why:**
- Ensures CLI can connect to OpenCode
- Validates ACP integration works
- E2E test of full flow

---

## Success Criteria

**CLI Improvement Successful When:**

1. ✅ Data flows traced for OpenCode + CLI
2. ✅ Gaps identified and prioritized
3. ⏳ `metabob activity` command implemented
4. ⏳ CLI can execute activities via ACP
5. ⏳ CLI development uses devbob-cli container
6. ⏳ Cross-repo validation working
7. ⏳ Shared schema between repos
8. ⏳ Enhanced template management

**Metrics:**
- Time to execute activity from CLI: <5 seconds
- Success rate of activity execution: >95%
- CLI development uses safe workflow: 100%

---

## Conclusion

**We have:**
- Discovered CLI already has MCP + activity integration ✅
- Identified data flow from OpenCode → Backend → CLI ✅
- Found gaps in CLI capabilities ✅
- Designed improvements using activity-based workflow ✅

**Next Actions:**
1. Use `trace-data-flow-single-feature` to map both repos
2. Use `develop-with-devbob-container` to add `metabob activity` command
3. Use `validate-cross-repo-changes` to ensure integration works

**Key Insight:** This is exactly what our activity-based, safe self-development system was designed for - coordinated, validated, multi-repo development with zero host breakage risk.

---

**Status:** ✅ Analysis complete, ready to trace and improve  
**Next:** Execute trace-data-flow activities for both repos
