# Task Graph: Refactor OpenCode Template Loading to Use MCP Only

## Overview
- Total tasks: 6
- Execution pattern: Linear with parallel validation
- Estimated duration: 35-45 minutes
- Estimated cost: $0.80-1.20 USD

## Task Breakdown

### Task 1: audit-template-loading-flow
- **Description**: Analyze and document current template loading architecture, identify all filesystem template loading code paths, and verify bootstrap template IDs
- **Agent**: general
- **Dependencies**: none
- **Token Budget**: 12000
- **What it does**:
  - Search for all calls to `ActivityTemplate.load()`, `.list()`, `.save()`
  - Map `BootstrapTemplates.registerAll()` flow
  - List metabob-proto bootstrap templates (4 JSON files)
  - Compare BOOTSTRAP_TEMPLATES set in template-loader.ts vs actual proto template IDs
  - Document current flow in `TEMPLATE_LOADING_AUDIT.md`
- **Validation**:
  - Required files: 
    - `TEMPLATE_LOADING_AUDIT.md`
  - Required patterns:
    - Document contains "ActivityTemplate.load"
    - Document contains "bootstrap-templates.ts"
    - Document contains all 4 bootstrap template IDs
    - Document contains current vs. expected BOOTSTRAP_TEMPLATES comparison
  - Forbidden patterns: []
  - Commands:
    ```bash
    test -f TEMPLATE_LOADING_AUDIT.md
    grep -q "ActivityTemplate.load" TEMPLATE_LOADING_AUDIT.md
    grep -q "create-activity-self-contained" TEMPLATE_LOADING_AUDIT.md
    grep -q "debug-activity-self-contained" TEMPLATE_LOADING_AUDIT.md
    grep -q "evolve-activity-self-contained" TEMPLATE_LOADING_AUDIT.md
    grep -q "manage-session-memory" TEMPLATE_LOADING_AUDIT.md
    ```
- **Retry Strategy**: progressive-context

### Task 2: refactor-bootstrap-and-library
- **Description**: Update BootstrapTemplates to register with MCP instead of local storage, and refactor TemplateLibrary to query MCP instead of reading from filesystem
- **Agent**: general
- **Dependencies**: audit-template-loading-flow
- **Token Budget**: 16000
- **What it does**:
  - Modify `bootstrap-templates.ts::registerAll()`:
    - Remove `ActivityTemplate.save()` calls
    - Add `TemplateServiceClient.registerTemplate()` for each bootstrap template
    - Update error handling for MCP failures (graceful degradation)
    - Update logs to say "registering with MCP" not "saving to local storage"
  - Modify `template-library.ts`:
    - Remove filesystem reads from `loadAllBuiltInTemplates()`
    - Update `initialize()` to sync from MCP (call `TemplateServiceClient.listTemplates()`)
    - Remove `loadTemplatesFromCategory()` filesystem calls
    - Remove `fs.readdir()` calls to `templates/built-in/`
- **Validation**:
  - Required files:
    - `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts` (modified)
    - `repos/metabob-opencode/packages/opencode/src/session/template-library.ts` (modified)
  - Required patterns:
    - `bootstrap-templates.ts` contains "TemplateServiceClient.registerTemplate"
    - `template-library.ts` contains "TemplateServiceClient.listTemplates"
  - Forbidden patterns:
    - `bootstrap-templates.ts` must NOT contain "ActivityTemplate.save" in registerAll()
    - `template-library.ts` must NOT contain "fs.readdir" with "templates/built-in"
  - Commands:
    ```bash
    grep -q "TemplateServiceClient.registerTemplate" repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts
    ! grep "ActivityTemplate.save" repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts | grep -v "^\s*//"
    grep -q "TemplateServiceClient" repos/metabob-opencode/packages/opencode/src/session/template-library.ts
    ! grep -q 'fs.readdir.*templates/built-in' repos/metabob-opencode/packages/opencode/src/session/template-library.ts
    ```
- **Retry Strategy**: progressive-context

### Task 3: backup-and-delete-builtin-templates
- **Description**: Create backup of templates/built-in/ directory, delete it from opencode repository, and verify build scripts don't reference deleted templates
- **Agent**: general
- **Dependencies**: refactor-bootstrap-and-library
- **Token Budget**: 10000
- **What it does**:
  - Create backup: `.archive/templates-built-in-backup-$(date +%Y%m%d)/`
  - Copy `repos/metabob-opencode/packages/opencode/templates/built-in/` to backup
  - Delete `repos/metabob-opencode/packages/opencode/templates/built-in/` directory
  - Search build scripts (package.json, tsconfig.json, build scripts) for `templates/built-in` references
  - Remove any template bundling logic found
  - Update `.gitignore` if needed
- **Validation**:
  - Required files:
    - Backup directory exists: `.archive/templates-built-in-backup-*/` (glob pattern)
  - Required patterns: []
  - Forbidden patterns:
    - Directory must NOT exist: `repos/metabob-opencode/packages/opencode/templates/built-in/`
  - Commands:
    ```bash
    test ! -d repos/metabob-opencode/packages/opencode/templates/built-in/
    test -d .archive/templates-built-in-backup-*/
    ls -la .archive/templates-built-in-backup-*/ | grep -q ".json"
    ! grep -r "templates/built-in" repos/metabob-opencode/packages/opencode/package.json || echo "No references found (expected)"
    ```
- **Retry Strategy**: simple

### Task 4: update-template-loader-bootstrap-ids
- **Description**: Update TemplateLoader to use correct bootstrap template IDs from metabob-proto and remove filesystem fallback paths
- **Agent**: general
- **Dependencies**: backup-and-delete-builtin-templates
- **Token Budget**: 10000
- **What it does**:
  - Update BOOTSTRAP_TEMPLATES set in `template-loader.ts` to:
    ```typescript
    const BOOTSTRAP_TEMPLATES = new Set([
      "create-activity-self-contained",
      "debug-activity-self-contained", 
      "evolve-activity-self-contained",
      "manage-session-memory"
    ]);
    ```
  - Update `TemplateLoader.load()` to query MCP first, fallback to local cache only
  - Update `TemplateLoader.list()` to prefer MCP, fallback to local storage if unavailable
  - Remove hardcoded paths to `templates/built-in/` in comments and logs
  - Update comments to reflect "MCP-first architecture"
- **Validation**:
  - Required files:
    - `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts` (modified)
  - Required patterns:
    - Contains `"create-activity-self-contained"`
    - Contains `"debug-activity-self-contained"`
    - Contains `"evolve-activity-self-contained"`
    - Contains `"manage-session-memory"`
  - Forbidden patterns:
    - No hardcoded paths containing `templates/built-in` (except in old comments marked as "BEFORE:")
  - Commands:
    ```bash
    grep -q '"create-activity-self-contained"' repos/metabob-opencode/packages/opencode/src/session/template-loader.ts
    grep -q '"debug-activity-self-contained"' repos/metabob-opencode/packages/opencode/src/session/template-loader.ts
    grep -q '"evolve-activity-self-contained"' repos/metabob-opencode/packages/opencode/src/session/template-loader.ts
    grep -q '"manage-session-memory"' repos/metabob-opencode/packages/opencode/src/session/template-loader.ts
    ```
- **Retry Strategy**: simple

### Task 5: verify-mcp-integration
- **Description**: Test MCP template registration flow, verify bootstrap templates are available via MCP, and validate template caching works correctly
- **Agent**: test
- **Dependencies**: update-template-loader-bootstrap-ids
- **Token Budget**: 12000
- **What it does**:
  - Check metabob-proto bootstrap templates exist (4 JSON files)
  - Verify metabob-cli MCP has template registration logic
  - Test `TemplateServiceClient` can query templates (if MCP available)
  - Run existing tests: `cd repos/metabob-opencode/packages/opencode && bun test` (or document failures)
  - Create simple integration test for bootstrap template registration via MCP
  - Verify template caching (TemplateCache) still works
  - Log findings about MCP connectivity and template availability
- **Validation**:
  - Required files:
    - `repos/metabob-proto/activities/bootstrap/create-activity-self-contained.json`
    - `repos/metabob-proto/activities/bootstrap/debug-activity-self-contained.json`
    - `repos/metabob-proto/activities/bootstrap/evolve-activity-self-contained.json`
    - `repos/metabob-proto/activities/bootstrap/manage-session-memory.json`
  - Required patterns:
    - Verification report documents MCP connectivity test results
    - Report documents bootstrap template availability
  - Forbidden patterns: []
  - Commands:
    ```bash
    test -f repos/metabob-proto/activities/bootstrap/create-activity-self-contained.json
    test -f repos/metabob-proto/activities/bootstrap/debug-activity-self-contained.json
    test -f repos/metabob-proto/activities/bootstrap/evolve-activity-self-contained.json
    test -f repos/metabob-proto/activities/bootstrap/manage-session-memory.json
    ```
- **Retry Strategy**: progressive-context

### Task 6: update-documentation
- **Description**: Update architecture documentation to reflect MCP-only template loading, document bootstrap template source of truth, and update any tests referencing deleted templates
- **Agent**: docs
- **Dependencies**: verify-mcp-integration
- **Token Budget**: 10000
- **What it does**:
  - Update `MCP_GATEWAY_ARCHITECTURE.md`:
    - Add section on "Template Loading via MCP"
    - Document that OpenCode never loads templates from filesystem (except bootstrap source)
    - Explain template flow: metabob-proto → metabob-cli → MCP → OpenCode
  - Update `TEMPLATE_MANAGEMENT_ARCHITECTURE.md`:
    - Document MCP-only loading architecture
    - Specify bootstrap template source: `metabob-proto/activities/bootstrap/`
    - Note that 17 built-in templates were removed (now served via MCP)
  - Search for tests referencing `templates/built-in/` and update them:
    - Use MCP mocks instead of filesystem paths
    - Reference `metabob-proto/activities/bootstrap/` for bootstrap template tests
  - Create summary report of all changes
- **Validation**:
  - Required files:
    - `MCP_GATEWAY_ARCHITECTURE.md` (modified)
    - `TEMPLATE_MANAGEMENT_ARCHITECTURE.md` (modified)
  - Required patterns:
    - `MCP_GATEWAY_ARCHITECTURE.md` contains "template loading" or "Template Loading"
    - `MCP_GATEWAY_ARCHITECTURE.md` contains "MCP"
    - `TEMPLATE_MANAGEMENT_ARCHITECTURE.md` contains "metabob-proto/activities/bootstrap"
    - `TEMPLATE_MANAGEMENT_ARCHITECTURE.md` contains "MCP-only" or "MCP only"
  - Forbidden patterns: []
  - Commands:
    ```bash
    grep -i -q "template.*loading" MCP_GATEWAY_ARCHITECTURE.md
    grep -q "metabob-proto/activities/bootstrap" TEMPLATE_MANAGEMENT_ARCHITECTURE.md
    ```
- **Retry Strategy**: simple

## Dependency Graph (ASCII)

```
audit-template-loading-flow
         |
         v
refactor-bootstrap-and-library
         |
         v
backup-and-delete-builtin-templates
         |
         v
update-template-loader-bootstrap-ids
         |
         v
verify-mcp-integration
         |
         v
update-documentation
```

**Execution Pattern**: Linear (sequential)

**Reasoning**: 
- Each task builds on the previous one's output
- Task 2 needs audit results to understand what to refactor
- Task 3 must wait for Task 2 to avoid breaking code before refactoring
- Task 4 requires templates to be deleted to verify no filesystem dependencies
- Task 5 validates all changes work together
- Task 6 documents the final state

**No Parallelism**: While Tasks 2-4 could theoretically run in parallel, they modify related files and have semantic dependencies (e.g., deleting templates before updating references could cause confusion). Sequential execution provides better safety and debuggability.

## Token Budget Summary
- Task 1 (audit-template-loading-flow): 12,000 tokens
- Task 2 (refactor-bootstrap-and-library): 16,000 tokens (complex, multi-file refactoring)
- Task 3 (backup-and-delete-builtin-templates): 10,000 tokens
- Task 4 (update-template-loader-bootstrap-ids): 10,000 tokens
- Task 5 (verify-mcp-integration): 12,000 tokens
- Task 6 (update-documentation): 10,000 tokens
- **Total**: 70,000 tokens (~$0.80-1.20 USD at $0.015/1K input + $0.075/1K output)

## Agent Distribution
- **general**: 4 tasks (audit, refactor, backup/delete, update IDs)
- **test**: 1 task (verify integration)
- **docs**: 1 task (update documentation)

## Risk Assessment

**High Confidence Tasks** (unlikely to fail):
- Task 1: Audit (read-only analysis)
- Task 3: Backup and delete (straightforward file operations)
- Task 6: Documentation (low technical complexity)

**Medium Confidence Tasks** (may need retry):
- Task 2: Refactor bootstrap and library (complex TypeScript refactoring)
- Task 4: Update template loader (requires understanding MCP client API)

**Low Confidence Tasks** (may fail, graceful degradation):
- Task 5: Verify MCP integration (depends on MCP server availability)
  - If MCP unavailable: Document that verification requires running MCP server
  - Validation can still verify bootstrap template files exist in metabob-proto

## Validation Strategy

**Per-Task Validation**:
- File existence checks (required files created/modified)
- Pattern matching (grep for required code patterns)
- Forbidden pattern checks (grep for anti-patterns that must not exist)
- Command execution (bash commands that must pass)

**Final Validation** (from REQUIREMENTS.md):
```bash
# Verify directory deleted
test ! -d repos/metabob-opencode/packages/opencode/templates/built-in/

# Verify bootstrap templates exist in proto
test -f repos/metabob-proto/activities/bootstrap/create-activity-self-contained.json
test -f repos/metabob-proto/activities/bootstrap/debug-activity-self-contained.json
test -f repos/metabob-proto/activities/bootstrap/evolve-activity-self-contained.json
test -f repos/metabob-proto/activities/bootstrap/manage-session-memory.json

# Verify MCP registration in bootstrap
grep -q "TemplateServiceClient.registerTemplate" repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts

# Verify no local save in bootstrap
! grep -q "ActivityTemplate.save" repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts

# Verify correct bootstrap IDs
grep -q '"create-activity-self-contained"' repos/metabob-opencode/packages/opencode/src/session/template-loader.ts
grep -q '"debug-activity-self-contained"' repos/metabob-opencode/packages/opencode/src/session/template-loader.ts
grep -q '"evolve-activity-self-contained"' repos/metabob-opencode/packages/opencode/src/session/template-loader.ts
grep -q '"manage-session-memory"' repos/metabob-opencode/packages/opencode/src/session/template-loader.ts
```

## Recovery Strategies

**If Task 2 fails** (refactor bootstrap and library):
- Retry with progressive-context (add more code context)
- Break into subtasks: refactor bootstrap first, then library
- Manual intervention: Provide specific code snippets to modify

**If Task 3 fails** (backup and delete):
- Retry with simple strategy (likely transient filesystem error)
- Verify backup was created before retrying delete
- Manual recovery: Use git to restore if deletion went wrong

**If Task 5 fails** (verify MCP integration):
- Graceful degradation: Document that MCP server must be running
- Validate file existence only (bootstrap templates in metabob-proto)
- Skip integration test, rely on manual testing after deployment

**If Task 6 fails** (update documentation):
- Retry with simple strategy
- Acceptable partial failure: Core refactoring (Tasks 1-5) still successful
- Manual intervention: Update docs manually post-activity

## Success Metrics

**Primary Goals** (must achieve):
- ✅ `templates/built-in/` directory deleted (4,642 lines removed)
- ✅ Bootstrap templates registered via MCP (not local storage)
- ✅ TemplateLibrary queries MCP (not filesystem)
- ✅ BOOTSTRAP_TEMPLATES set updated with correct IDs

**Secondary Goals** (nice to have):
- ✅ All tests pass
- ✅ Documentation fully updated
- ✅ MCP integration verified with live tests

**Minimum Viable Success**:
- Tasks 1-4 complete (audit, refactor, delete, update IDs)
- Task 5 documents MCP verification strategy (even if MCP unavailable)
- Task 6 creates basic documentation updates

## Architecture Impact

**Before**:
```
OpenCode Repository Size: ~X MB
Template Loading: Filesystem → Local Storage → Query
Bootstrap Templates: Duplicated in opencode/templates/built-in/
```

**After**:
```
OpenCode Repository Size: ~X - 0.5 MB (4,642 lines removed)
Template Loading: MCP Query → Cache → Fallback
Bootstrap Templates: Single source in metabob-proto/activities/bootstrap/
```

**Benefits**:
1. **Reduced Duplication**: 17 templates → 4 bootstrap templates (single source of truth)
2. **MCP Gateway Compliance**: All template queries flow through MCP
3. **Simplified Maintenance**: Template updates only in metabob-proto
4. **Better Separation**: metabob-proto owns templates, metabob-cli serves them, OpenCode consumes them
5. **Smaller Binary**: OpenCode doesn't bundle template JSON files

**Risks**:
1. **MCP Dependency**: OpenCode now requires MCP for template access (mitigated by bootstrap templates in metabob-proto)
2. **Cold Start**: First query slower (MCP roundtrip) (mitigated by TemplateCache)
3. **Testing Complexity**: Tests need MCP mocks (addressed in Task 6)
