# Create Activity Template Improvements

**Date**: 2026-02-19  
**Issue**: The create-activity-template workflow incorrectly required clean git state and created files in the working directory

## Problem Statement

The `create-activity-self-contained` template had two architectural issues:

1. **Git State Dependency**: Required clean git state, which doesn't make sense for a template creation workflow that shouldn't modify functional code
2. **File Location**: Wrote temporary files (REQUIREMENTS.md, TASK_GRAPH.md, template JSON) to the working directory instead of a temporary location
3. **Backend Registration**: Instructions were unclear about using metabob-cli backend for template storage

## Changes Made

### 1. Removed Git State Requirements

**Before**:
- Template schema examples included `"preChecks": ["git status"]` in integration section
- This blocked template creation when working directory had uncommitted changes

**After**:
- Explicitly documented: **NO GIT CHECKS** in template
- Added forbidden pattern: `"preChecks": ["git"` to catch accidental git checks
- Updated schema documentation to leave `preChecks` and `postChecks` empty arrays

**Rationale**: Activity template creation is a meta-operation that produces no functional state changes. It only creates a new workflow definition in the backend. Git state is irrelevant.

### 2. Changed File Location to /tmp

**Before**:
- Files written to current working directory:
  - `REQUIREMENTS.md`
  - `TASK_GRAPH.md`
  - `{{templateId}}.json`
  - `SUCCESS.md`

**After**:
- All files written to `/tmp/activity-template-{{templateId}}/`:
  - `/tmp/activity-template-{{templateId}}/REQUIREMENTS.md`
  - `/tmp/activity-template-{{templateId}}/TASK_GRAPH.md`
  - `/tmp/activity-template-{{templateId}}/{{templateId}}.json`
  - `/tmp/activity-template-{{templateId}}/SUCCESS.md`

**Rationale**: 
- Avoids polluting the working repository with temporary files
- Makes it clear these are transient artifacts
- Template is permanently stored in backend, not in these temp files
- Aligns with the principle of not relying on local files

### 3. Backend Registration via MCP Tool

**Before**:
- Unclear instructions about template registration
- Agents might try to write directly to `.metabob/activities/`

**After**:
- Added explicit task: `register-with-backend`
- Task calls `metabob_register_activity_template` MCP tool
- Tool registers template to metabob-cli backend (~/.metabob/activities/)
- Clear documentation that temp files are transient, backend is source of truth

**Workflow**:
```
1. gather-requirements → write REQUIREMENTS.md to /tmp
2. design-task-graph → write TASK_GRAPH.md to /tmp
3. write-template-json → write {{templateId}}.json to /tmp
4. register-with-backend → call metabob_register_activity_template MCP tool
                         → backend stores in ~/.metabob/activities/
                         → write SUCCESS.md to /tmp
```

### 4. Updated Template Locations

Updated the template in three locations:
1. `.metabob/activities/create-activity-self-contained.json` (primary)
2. `repos/metabob-proto/activities/bootstrap/create-activity-self-contained.json` (bootstrap)
3. `repos/metabob-cli/.metabob/activities/create-activity-self-contained.json` (CLI local cache)

## Architecture Benefits

### 1. Backend-First Approach
- Templates are registered directly to metabob-cli backend
- No reliance on local file system for template storage
- Agents interact with templates via MCP tools only

### 2. Clean Separation of Concerns
- **Temporary artifacts**: `/tmp/activity-template-{{templateId}}/` (transient)
- **Permanent storage**: `~/.metabob/activities/` (backend managed)
- **Working directory**: Remains untouched (no pollution)

### 3. No Git State Coupling
- Template creation works in any git state (clean, dirty, no git)
- Removes unnecessary constraint
- Aligns with the fact that template creation creates no functional changes

### 4. Agent Simplicity
- Agent writes files to single temp directory
- Agent calls one MCP tool for registration
- Agent doesn't need to understand storage architecture

## Implementation Notes

### Template Schema Changes

**Added to `write-template-json` task**:
```json
{
  "forbidden_patterns": [
    {
      "pattern": "\"preChecks\": [\"git",
      "description": "Must not include git status checks"
    }
  ]
}
```

**Added to all prompts**:
- Explicit mention of `/tmp/activity-template-{{templateId}}/` path
- Clear statement that NO git checks should be included
- Documentation that temp files are transient

### Registration Task Details

The `register-with-backend` task:
1. Validates the generated template JSON
2. Reads template content from `/tmp/activity-template-{{templateId}}/{{templateId}}.json`
3. Calls `metabob_register_activity_template` MCP tool with template object
4. Creates SUCCESS.md documenting the registration
5. Reports completion with template ID

### MCP Tool Integration

The `metabob_register_activity_template` tool (in metabob-cli):
- Accepts template object (JSON)
- Converts to snake_case for storage
- Generates template ID if not present
- Saves to `~/.metabob/activities/{{templateId}}.json`
- Returns success/error status

## Testing Recommendations

1. **Test with dirty git state**: Verify template creation works with uncommitted changes
2. **Verify /tmp usage**: Check that files are written to `/tmp/activity-template-*/`
3. **Verify backend registration**: Check that template appears in `~/.metabob/activities/`
4. **Verify no repo pollution**: Confirm working directory is clean after execution
5. **Verify template execution**: Use newly created template to ensure it works

## Future Considerations

### Potential Enhancements

1. **Agent File Access Control**: Consider disabling agent access to local template caches entirely, forcing all template operations through MCP tools
2. **Temp Directory Cleanup**: Add automatic cleanup of `/tmp/activity-template-*` directories after successful registration
3. **Template Validation**: Add more comprehensive schema validation in the MCP tool
4. **Version Control**: Add template versioning support in backend storage

### Local Cache Debate

**Current State**: Agents can still read from `.metabob/activities/` if they try

**Options**:
1. **Status Quo**: Agents can access local cache, but shouldn't (by convention)
2. **Block Access**: Modify agent permissions to prevent reading local cache directories
3. **Remove Cache**: Eliminate local file cache entirely, use backend-only storage

**Recommendation**: Start with status quo. The template prompts now guide agents to use MCP tools. If agents still try to access local files, implement access controls.

## Summary

The create-activity-template workflow is now:
- ✅ Git-state independent (no git status checks required)
- ✅ Repository clean (temp files in /tmp, not working directory)
- ✅ Backend-first (registers via MCP tool to metabob-cli)
- ✅ Self-contained (no local file dependencies for template storage)
- ✅ Clear architecture (temp artifacts vs. permanent storage)

These changes align with the stated goals:
1. No functional state transformations in working repo
2. No reliance on locally available files for templates
3. All activity template interactions through metabob-cli backend
