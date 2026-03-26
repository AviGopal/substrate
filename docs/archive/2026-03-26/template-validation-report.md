# Template Validation Report
## File: `create-activity-self-contained.json`
**Generated**: 2024-03-19
**Location**: `./repos/metabob-proto/activities/bootstrap/create-activity-self-contained.json`

---

## ✅ 1. JSON Syntax Validation
**Status**: PASSED ✅

The JSON file is syntactically valid and parseable.

---

## ✅ 2. Required Top-Level Fields
**Status**: PASSED ✅

All required fields present:
- ✓ `activity_id`: "create-activity"
- ✓ `name`: "Create Activity Template"
- ✓ `description`: "Create new activity templates to automate workflows"
- ✓ `category`: "infrastructure" (valid)
- ✓ `tasks`: Array with 4 tasks

**Category Validation**: ✅ "infrastructure" is a valid category (one of: feature, bugfix, refactor, tool, infrastructure)

---

## ✅ 3. Task Dependency Graph (DAG)
**Status**: PASSED ✅

### Dependency Chain:
```
gather-requirements (no dependencies)
    ↓
design-task-graph (depends on: gather-requirements)
    ↓
write-template-json (depends on: design-task-graph)
    ↓
register-with-backend (depends on: write-template-json)
```

### Validation Results:
- ✅ **No cycles detected** - Valid DAG structure
- ✅ **All dependencies reference valid task IDs** - No dangling references
- ✅ **Total tasks**: 4 (optimal range: 3-7)
- ✅ **Pattern**: Linear workflow (sequential execution)

---

## ❌ 4. Prompt Template Variable Validation
**Status**: FAILED ❌

### Issues Found:

#### Task: `gather-requirements` ✅
- **Status**: VALID
- **Variables used**: category, purpose, templateDescription, templateId, templateName
- **All properly declared**: Yes

#### Task: `design-task-graph` ❌
- **Status**: INVALID
- **Undeclared variables**: `templateId`, `templateName`
- **Problem**: Template uses `{{templateId}}` and `{{templateName}}` but variables array is empty `[]`

#### Task: `write-template-json` ❌
- **Status**: INVALID  
- **Undeclared variables**: `category`, `templateDescription`, `templateId`, `templateName`
- **Problem**: Template uses multiple variables but variables array is empty `[]`
- **Note**: `foo`, `variableName` are documentation examples, not actual variables

#### Task: `register-with-backend` ❌
- **Status**: INVALID
- **Undeclared variables**: `category`, `templateId`, `templateName`
- **Problem**: Template uses variables but variables array is empty `[]`

### Critical Issue:
**Only the first task properly declares its variables. Tasks 2-4 all use inherited variables from the activity context but don't declare them in their `prompt.variables` arrays.**

---

## ✅ 5. Task Structure Completeness
**Status**: PASSED ✅

All tasks have required fields:

| Task | description | dependencies | prompt | prompt.template | validation | retry |
|------|-------------|--------------|--------|-----------------|------------|-------|
| gather-requirements | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| design-task-graph | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| write-template-json | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| register-with-backend | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## ✅ 6. Validation Configuration
**Status**: PASSED ✅

Each task has proper validation configuration:

### Task: `gather-requirements`
- Required files: 1 (`/tmp/activity-template-{{templateId}}/REQUIREMENTS.md`)
- Required patterns: 3 (section headers)
- Forbidden patterns: 0
- Commands: 0

### Task: `design-task-graph`
- Required files: 1 (`/tmp/activity-template-{{templateId}}/TASK_GRAPH.md`)
- Required patterns: 3 (section headers)
- Forbidden patterns: 0
- Commands: 0

### Task: `write-template-json`
- Required files: 1 (`/tmp/activity-template-{{templateId}}/{{templateId}}.json`)
- Required patterns: 4 (JSON structure markers)
- Forbidden patterns: 1 (git preChecks detection)
- Commands: 1 (jq validation)

### Task: `register-with-backend`
- Required files: 1 (`/tmp/activity-template-{{templateId}}/SUCCESS.md`)
- Required patterns: 4 (success markers)
- Forbidden patterns: 3 (error markers: ❌, FAILED, ERROR)
- Commands: 0

---

## Summary

### ✅ Passed Checks (5/6):
1. ✅ JSON syntax is valid
2. ✅ All required top-level fields present
3. ✅ Task dependencies form a valid DAG (no cycles)
4. ✅ All task structures complete
5. ✅ Validation configuration properly structured

### ❌ Failed Checks (1/6):
6. ❌ **Prompt template variables not properly declared in tasks 2-4**

---

## Recommendations

### CRITICAL - Fix Variable Declarations:

Tasks 2, 3, and 4 need to declare inherited variables in their `prompt.variables` arrays.

**Common variables needed**:
- `templateId` (string, required)
- `templateName` (string, required)
- `templateDescription` (string, required)
- `category` (string, required)

---

**Overall Assessment**: Template is 83% valid (5/6 checks passed). The structure and logic are sound, but variable declarations need to be fixed for full compliance.
