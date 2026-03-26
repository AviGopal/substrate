# Activity Requirements: Refactor OpenCode Template Loading to Use MCP Only

## Overview

This activity refactors the OpenCode template loading architecture to eliminate local filesystem template storage and enforce the MCP Gateway pattern. Currently, OpenCode has 17 templates (~4,642 lines) in `templates/built-in/` that duplicate templates stored in metabob-proto and served via metabob-cli's MCP. This refactoring consolidates template management to a single source of truth: the MCP gateway.

**Architecture Change**:
```
BEFORE:
  opencode/templates/built-in/ (17 templates, duplicated)
    ↓
  BootstrapTemplates.registerAll() → local storage
    ↓
  TemplateLibrary.initialize() → loads from filesystem
    ↓
  TemplateLoader queries local storage first

AFTER:
  metabob-proto/activities/bootstrap/ (4 templates, authoritative)
    ↓
  metabob-cli MCP startup → registers with MCP
    ↓
  TemplateLoader queries MCP exclusively
    ↓
  Bootstrap templates available via MCP (no local duplication)
```

**Key Principle**: OpenCode should NEVER load templates directly from filesystem except during initial bootstrap registration at metabob-cli startup. All subsequent queries flow through MCP.

## Workflow Steps

1. **Audit Current Template Loading Flow** (Dependencies: none)
   - Map all code paths that load templates from `templates/built-in/`
   - Identify which components call `ActivityTemplate.load()`, `.list()`, `.save()`
   - Document bootstrap template registration flow in `BootstrapTemplates`
   - Verify metabob-proto bootstrap templates (4 files) match BOOTSTRAP_TEMPLATES set in template-loader.ts

2. **Update BootstrapTemplates to Register with MCP** (Dependencies: Step 1)
   - Modify `bootstrap-templates.ts::registerAll()` to register via TemplateServiceClient (MCP)
   - Remove calls to `ActivityTemplate.save()` (local storage)
   - Add MCP registration call: `TemplateServiceClient.registerTemplate({ template })`
   - Keep bootstrap template loading from metabob-proto (read-only, no local save)
   - Update error handling to distinguish MCP failures vs local failures

3. **Remove templates/built-in/ Directory** (Dependencies: Step 2)
   - Delete `packages/opencode/templates/built-in/` directory (17 template files)
   - Update `.gitignore` if needed
   - Remove template bundling from build scripts (if any reference `templates/built-in/`)
   - Verify dist/ builds don't include removed templates

4. **Update TemplateLibrary.initialize()** (Dependencies: Step 2, Step 3)
   - Remove filesystem template loading from `loadAllBuiltInTemplates()`
   - Change `initialize()` to only sync from MCP (not load from JSON files)
   - Update `installBuiltInTemplates()` to query MCP instead of reading JSON files
   - Remove `loadTemplatesFromCategory()` calls to filesystem
   - Keep Metabob registration logic (templates flow: MCP → cache → optional local backup)

5. **Update TemplateLoader Fallback Logic** (Dependencies: Step 4)
   - Ensure `TemplateLoader.load()` queries MCP first, falls back to local storage only for cached templates
   - Update BOOTSTRAP_TEMPLATES set to match actual IDs from metabob-proto: `["create-activity-self-contained", "debug-activity-self-contained", "evolve-activity-self-contained", "manage-session-memory"]`
   - Remove hardcoded paths to `templates/built-in/` in comments/logs
   - Update `TemplateLoader.list()` to prefer MCP, fallback to local storage only if MCP unavailable

6. **Verify MCP Template Registration Flow** (Dependencies: Step 5)
   - Test that metabob-cli MCP server registers bootstrap templates on startup
   - Verify `TemplateServiceClient` queries return bootstrap templates
   - Confirm `search_activities` tool returns all templates via MCP
   - Validate template caching works correctly (TemplateCache)

7. **Update Documentation and Tests** (Dependencies: Step 6)
   - Update architecture documentation (MCP_GATEWAY_ARCHITECTURE.md)
   - Add notes to TEMPLATE_MANAGEMENT_ARCHITECTURE.md about MCP-only loading
   - Update tests that reference `templates/built-in/` paths
   - Add test for bootstrap template registration via MCP
   - Document bootstrap template source of truth: metabob-proto/activities/bootstrap/

## Input Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| workingDirectory | string | no | . | Root directory of metabob-devbob repo |
| verifyMcpConnection | boolean | no | true | Test MCP connectivity before making changes |
| skipTestUpdates | boolean | no | false | Skip updating test files (faster, but less safe) |
| backupTemplates | boolean | no | true | Create backup of templates/built-in/ before deletion |

## Expected Outputs

- **Deleted**: `repos/metabob-opencode/packages/opencode/templates/built-in/` directory (17 files, ~4,642 lines)
- **Modified Files**:
  - `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts` - Remove local storage save, add MCP registration
  - `repos/metabob-opencode/packages/opencode/src/session/template-library.ts` - Remove filesystem loading
  - `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts` - Update BOOTSTRAP_TEMPLATES set, remove filesystem fallback paths
  - Architecture docs: `MCP_GATEWAY_ARCHITECTURE.md`, `TEMPLATE_MANAGEMENT_ARCHITECTURE.md`
- **Report**: Summary of changes with before/after code snippets
- **State Changes**: 
  - Bootstrap templates now registered with MCP on metabob-cli startup (not local storage)
  - All template queries flow through MCP (no filesystem reads except bootstrap source files)
  - Single source of truth: metabob-proto/activities/bootstrap/

## Validation Criteria

### Per-Step:

**Step 1 (Audit)**:
- File `TEMPLATE_LOADING_AUDIT.md` created with:
  - List of all components that call `ActivityTemplate.load/list/save`
  - Bootstrap template IDs from metabob-proto
  - Current vs. expected BOOTSTRAP_TEMPLATES set
  - Diagram of current loading flow

**Step 2 (Update BootstrapTemplates)**:
- `bootstrap-templates.ts::registerAll()` no longer calls `ActivityTemplate.save()`
- Calls `TemplateServiceClient.registerTemplate()` for each bootstrap template
- Error handling differentiates MCP vs local failures
- Logs indicate "registering with MCP" instead of "saving to local storage"

**Step 3 (Remove Directory)**:
- Directory `templates/built-in/` does not exist
- Backup created at `.archive/templates-built-in-backup-YYYYMMDD/` (if backupTemplates=true)
- No references to deleted templates in build scripts

**Step 4 (Update TemplateLibrary)**:
- `loadAllBuiltInTemplates()` removed or modified to not read filesystem
- `initialize()` calls `TemplateServiceClient.listTemplates()` instead of filesystem operations
- No `fs.readdir()` calls to `templates/built-in/`

**Step 5 (Update TemplateLoader)**:
- BOOTSTRAP_TEMPLATES set matches: `["create-activity-self-contained", "debug-activity-self-contained", "evolve-activity-self-contained", "manage-session-memory"]`
- Comments updated to reflect MCP-first architecture
- No hardcoded paths to `templates/built-in/`

**Step 6 (Verify MCP Flow)**:
- `bun test` passes (or test updates documented if skipped)
- Manual test: `search_activities({ verbose: true })` returns 4+ templates
- Logs show templates loaded from MCP, not filesystem

**Step 7 (Documentation)**:
- Architecture docs mention "MCP-only template loading"
- Bootstrap template source documented: `metabob-proto/activities/bootstrap/`

### Final Validation:

**Files Exist**:
- `REQUIREMENTS.md` (this file)
- `repos/metabob-proto/activities/bootstrap/` (4 template JSON files)
- `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts` (modified)
- `repos/metabob-opencode/packages/opencode/src/session/template-library.ts` (modified)
- `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts` (modified)

**Files/Directories NOT Exist**:
- `repos/metabob-opencode/packages/opencode/templates/built-in/` (deleted)
- `repos/metabob-opencode/packages/opencode/dist/*/templates/built-in/` (not bundled)

**Patterns Present** (grep checks):
- `bootstrap-templates.ts` contains `TemplateServiceClient.registerTemplate` (MCP registration)
- `template-loader.ts` contains correct bootstrap IDs: `create-activity-self-contained`, `debug-activity-self-contained`, `evolve-activity-self-contained`, `manage-session-memory`
- Architecture docs mention "MCP Gateway" and "template loading via MCP"

**Patterns Absent** (no matches):
- No `ActivityTemplate.save()` calls in `bootstrap-templates.ts::registerAll()`
- No `fs.readdir()` calls to `templates/built-in/` in `template-library.ts`
- No references to deleted template files in source code (exclude archives, docs)

**Commands Pass**:
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

## Error Handling

**Common Failures and Solutions**:

1. **MCP Gateway Unavailable**
   - **Symptom**: `TemplateServiceClient.registerTemplate()` fails with connection error
   - **Solution**: Graceful degradation - log warning, bootstrap templates unavailable until MCP starts
   - **Recovery**: Retry registration on next MCP connection (don't block startup)
   - **Strategy**: best-effort registration (don't throw errors)

2. **Bootstrap Templates Missing from metabob-proto**
   - **Symptom**: `BootstrapTemplates.loadAll()` fails to find JSON files
   - **Solution**: Hard error - bootstrap templates are critical for system operation
   - **Recovery**: Check metabob-proto submodule is initialized (`git submodule update --init`)
   - **Strategy**: Fail fast with clear error message

3. **Template ID Mismatch**
   - **Symptom**: BOOTSTRAP_TEMPLATES set doesn't match actual bootstrap template IDs in metabob-proto
   - **Solution**: Update BOOTSTRAP_TEMPLATES set in template-loader.ts to match proto files
   - **Recovery**: Run Step 1 audit to identify mismatch
   - **Strategy**: Automated validation in Step 6

4. **Tests Fail After Directory Deletion**
   - **Symptom**: Tests reference `templates/built-in/` paths that no longer exist
   - **Solution**: Update test fixtures to use MCP mocks or metabob-proto paths
   - **Recovery**: Run tests with `skipTestUpdates=false` to identify failures
   - **Strategy**: Fix tests in Step 7, or document known test gaps

5. **Build Scripts Bundle Deleted Templates**
   - **Symptom**: Build process tries to copy `templates/built-in/` to dist/
   - **Solution**: Remove bundling logic from build scripts
   - **Recovery**: Grep build scripts for `templates/built-in` references
   - **Strategy**: Check in Step 3 validation

6. **Caching Issues**
   - **Symptom**: Old templates cached locally, not reflecting MCP updates
   - **Solution**: Clear template cache (`TemplateCache.invalidate()` for affected IDs)
   - **Recovery**: Add cache invalidation to bootstrap registration flow
   - **Strategy**: Verify cache behavior in Step 6

## Agent Assignment

- **Step 1**: general - File analysis, code search, documentation
- **Step 2**: general - TypeScript refactoring, MCP client integration
- **Step 3**: general - File deletion, backup creation, validation
- **Step 4**: general - TypeScript refactoring, removing filesystem operations
- **Step 5**: general - TypeScript refactoring, updating constants
- **Step 6**: test - Integration testing, MCP connectivity verification
- **Step 7**: docs - Documentation updates, test updates

## Additional Context

### Current Architecture Issues

1. **Duplication**: 17 templates in `opencode/templates/built-in/` duplicate templates in metabob-proto
2. **Inconsistency**: Templates can drift between filesystem and MCP
3. **Violation of MCP Gateway**: OpenCode loads templates from filesystem, bypassing MCP
4. **Bootstrap Confusion**: BOOTSTRAP_TEMPLATES set in template-loader.ts has 3 IDs (`create-activity-template`, `create-subagent`, `debug-activity`), but metabob-proto has 4 different templates

### MCP Gateway Pattern (from MCP_GATEWAY_ARCHITECTURE.md)

**Rules**:
1. OpenCode should ONLY communicate via MCP
2. metabob-cli is the ONLY component that calls backend HTTP API
3. NO direct HTTP calls from OpenCode to backend
4. NO direct filesystem reads for runtime data (templates, configs served via backend)

**Template Flow**:
```
metabob-proto (source files, read-only)
  ↓
metabob-cli MCP startup (registers with backend)
  ↓
OpenCode queries via MCP (metabob_search_activities tool)
  ↓
TemplateCache (local cache for performance)
  ↓
Activity execution (uses cached templates)
```

### Bootstrap Templates

Bootstrap templates are the minimal set needed for cold start (no network connectivity). After this refactoring:

- **Source**: `metabob-proto/activities/bootstrap/` (4 JSON files)
- **Registration**: metabob-cli registers with MCP on startup
- **Loading**: OpenCode queries via `TemplateServiceClient` (MCP)
- **Caching**: TemplateCache stores results locally (ephemeral)
- **No Local Storage**: OpenCode never writes templates to `~/.metabob/activities/` (that's metabob-cli's job)

**Current Bootstrap Templates** (metabob-proto):
1. `create-activity-self-contained.json` - Create new activity templates
2. `debug-activity-self-contained.json` - Debug failed activities
3. `evolve-activity-self-contained.json` - Improve existing templates
4. `manage-session-memory.json` - Session memory management

### Success Criteria

After this refactoring:
- ✅ OpenCode binary size reduced by ~4,642 lines (no bundled templates)
- ✅ Single source of truth: metabob-proto/activities/bootstrap/
- ✅ MCP Gateway pattern enforced (no filesystem template loading)
- ✅ Bootstrap templates available via MCP (no duplication)
- ✅ Template updates flow: metabob-proto → metabob-cli → MCP → OpenCode (one-way)
- ✅ Clear separation: metabob-proto owns templates, metabob-cli serves them, OpenCode consumes them

### Related Files

**OpenCode (to modify)**:
- `packages/opencode/src/session/bootstrap-templates.ts` - Bootstrap template registration
- `packages/opencode/src/session/template-library.ts` - Template initialization
- `packages/opencode/src/session/template-loader.ts` - Template loading logic
- `packages/opencode/src/server/template-service-client.ts` - MCP client (verify usage)

**Metabob-proto (source of truth)**:
- `activities/bootstrap/*.json` - Bootstrap template definitions (4 files)

**Metabob-cli (MCP server)**:
- `src/metabob_cli/mcp/activity_templates.py` - Template storage and retrieval for MCP
- `src/metabob_cli/mcp/activity_template_tools.py` - MCP tool implementations

**Architecture Docs (to update)**:
- `MCP_GATEWAY_ARCHITECTURE.md` - MCP Gateway pattern documentation
- `TEMPLATE_MANAGEMENT_ARCHITECTURE.md` - Template lifecycle documentation

### Constraints

1. **Backward Compatibility**: Existing activities using templates should continue working (templates still available via MCP)
2. **Cold Start**: Bootstrap templates must be available even if MCP connection fails (read from metabob-proto, register when MCP connects)
3. **Performance**: Template caching (TemplateCache) must continue working (no performance regression)
4. **Testing**: MCP integration tests should cover bootstrap template registration
5. **Documentation**: Clear migration guide for developers expecting filesystem templates

### Risk Mitigation

**High Risk**:
- Breaking bootstrap template loading (system won't start) → Test thoroughly in Step 6
- MCP registration failures (templates unavailable) → Graceful degradation in Step 2

**Medium Risk**:
- Test failures due to hardcoded paths → Update tests in Step 7
- Build script breakage → Verify in Step 3

**Low Risk**:
- Documentation gaps → Update in Step 7
- Cache invalidation issues → Verify in Step 6
