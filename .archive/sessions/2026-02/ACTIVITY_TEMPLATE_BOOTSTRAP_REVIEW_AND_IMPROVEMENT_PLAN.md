# Activity Template Bootstrap System: Review & Improvement Plan

**Date**: February 16, 2026  
**Objective**: Ensure activity management templates in metabob-proto bootstrap set are reliable, generalizable, and work anywhere (not repository-dependent)

---

## Executive Summary

### Current State Assessment

**Bootstrap System Location**: 
- Code: `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts`
- Templates: `repos/metabob-proto/activities/bootstrap/`
- Loading: Cold start loads 3 hardcoded templates from metabob-proto

**Critical Finding**: Bootstrap templates are **NOT repository-agnostic** and have **multiple quality issues**:

❌ **Repository Dependencies**: Templates reference specific file paths from metabob-proto  
❌ **Format Inconsistency**: Mix of old schema (Group B) and proto-aligned (Group A)  
❌ **Limited Bootstrap Set**: Only 3 templates hardcoded for cold start  
❌ **Missing Activity Management**: No complete, reliable activity creation template in bootstrap  
❌ **Untested Templates**: No evidence of execution validation for bootstrap templates  

### Recommendations

**Priority 1 (Immediate)**:
1. Create repository-agnostic versions of core activity management templates
2. Validate templates work in clean environments without filesystem dependencies
3. Expand bootstrap set to include all essential activity management templates

**Priority 2 (Short-term)**:
4. Review historical executions and incorporate learnings
5. Add execution tests to CI/CD to prevent regressions
6. Document template design patterns for future template authors

---

## Bootstrap System Architecture

### Current Implementation

```typescript
// repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts

const BOOTSTRAP_DIR = "../../../../proto/proto/activity/bootstrap"

const TEMPLATE_FILES = {
  "create-activity-template": path.join(__dirname, BOOTSTRAP_DIR, "create-activity-template.json"),
  "create-subagent": path.join(__dirname, BOOTSTRAP_DIR, "create-subagent.json"),
  "debug-activity": path.join(__dirname, BOOTSTRAP_DIR, "debug-activity.json"),
}
```

**Problem**: This assumes:
- metabob-proto repository exists at specific path
- Bootstrap JSON files exist in metabob-proto
- Files contain valid proto format

### How Cold Start Works

1. **Binary Startup** → `BootstrapTemplates.registerAll()` called
2. **Template Loading** → Reads JSON from hardcoded file paths
3. **Proto Conversion** → Converts proto JSON to ActivityTemplate.Schema
4. **Registration** → Saves to local storage for search_activities

**Critical Dependency Chain**:
```
OpenCode binary startup
  ↓
BootstrapTemplates.loadAll()
  ↓
Read from metabob-proto/activities/bootstrap/*.json
  ↓
convertProtoToSchema() - convert proto format
  ↓
ActivityTemplate.save() - store locally
  ↓
Templates available for search/execution
```

---

## Template Inventory & Quality Assessment

### Templates in metabob-proto/activities/bootstrap/

| Template | Version | Format | Tasks | Status | Issues |
|----------|---------|--------|-------|--------|--------|
| **activity-create.json** | v1 | Old | 7 | ⚠️ Obsolete | Uses `step_id`, flat structure, missing fields |
| **activity-create-v2.json** | v2 | Proto-aligned | 7 | ✅ Good | Working, tested, has hooks and validation |
| **activity-debug.json** | v1 | Old | ? | ⚠️ Obsolete | Old format |
| **activity-evolve.json** | v1 | Old | ? | ⚠️ Obsolete | Old format |
| **create-activity-template-v3.json** | v3 | Mixed | 1 | ⚠️ Incomplete | Only 1 task, truncated prompts |
| **create-activity-template-v3-compat.json** | v3 | Mixed | 1 | ⚠️ Incomplete | Only 1 task |
| **feature-impl.json** | ? | Proto-aligned | ? | 🟡 Needs Review | Missing subagent, impulse_refs |
| **bug-fix.json** | ? | Proto-aligned | ? | 🟡 Needs Review | Missing subagent, impulse_refs |
| **jiggle-documentation.json** | ? | Proto-aligned | ? | 🟡 Needs Review | Missing impulse_refs, metrics |
| **boredom-task-processor.json** | v1 | Old | ? | ⚠️ Obsolete | Old format |
| **code-analysis.json** | v1 | Old | ? | ⚠️ Obsolete | Old format |
| **refactor.json** | v1 | Old | ? | ⚠️ Obsolete | Old format |
| **add-rest-endpoint.json** | ? | Unknown | ? | 🔍 Needs Inspection | Not in bootstrap loading |
| **fix-security-bug.json** | ? | Unknown | ? | 🔍 Needs Inspection | Not in bootstrap loading |
| **safe-refactor.json** | ? | Unknown | ? | 🔍 Needs Inspection | Not in bootstrap loading |
| **security-audit-complete.json** | ? | Unknown | ? | 🔍 Needs Inspection | Not in bootstrap loading |

**Key**: ✅ Production Ready | 🟡 Needs Fixes | ⚠️ Obsolete | 🔍 Unknown

### Templates in metabob-opencode/templates/built-in/

| Template | Purpose | Status | Repository Dependencies? |
|----------|---------|--------|-------------------------|
| **create-activity-template.json** | Primary activity creation | ✅ Validated | ⚠️ **YES** - references project paths |
| **improve-bootstrap-template.json** | Template improvement | 🟡 Complex | ⚠️ **YES** - reads from templates/ dir |
| cleanup-docs-tests.json | Documentation cleanup | 🔍 Unknown | Likely repo-dependent |
| create-subagent-template.json | Subagent creation | 🔍 Unknown | Likely repo-dependent |
| diagnose-startup-issues.json | Debugging | 🔍 Unknown | Likely repo-dependent |
| fix-bug-with-impulses.json | Bug fixing | 🔍 Unknown | Likely repo-dependent |

**Critical Issue**: **Most templates assume they're running in a specific repository with specific file structures**

---

## Repository Dependency Analysis

### Problem: Templates Reference Specific Paths

Example from `create-activity-template.json`:

```json
{
  "contextRequirements": [
    {
      "key": "templateExamples",
      "hint": "Provide 2-3 existing activity templates as examples. Search for *.json files in your project's activity template directory (common locations: templates/, .opencode/templates/, config/templates/)",
      "impulseTypes": ["file", "bashOutput"],
      "required": true
    }
  ]
}
```

**Issues**:
1. ❌ Assumes templates exist in filesystem
2. ❌ Requires user to locate and provide template files
3. ❌ Can't work in clean/empty workspace
4. ❌ Manual context gathering (not automated)

### Solution: Embedded Examples

Templates should be **self-contained** with examples in prompts:

```json
{
  "tasks": [
    {
      "id": "design-template",
      "prompt": {
        "template": "Create an activity template following this structure:\n\n**Example Template Structure**:\n```json\n{\n  \"name\": \"Add REST Endpoint\",\n  \"tasks\": [...]\n}\n```\n\n**Your template**: {{templateName}}\n**Requirements**: {{requirements}}"
      }
    }
  ]
}
```

**Benefits**:
- ✅ Works in any workspace (no file dependencies)
- ✅ Examples always available (embedded in template)
- ✅ No manual context gathering required
- ✅ Generalizable across projects

---

## Historical Execution Analysis

### Evidence Found

1. **ACTIVITY_SYSTEM_VALIDATED_FEB15.md**:
   - ✅ `create-activity-template` (infrastructure-1eddde23) executed successfully
   - 4 tasks, 7.6 minutes, $0.0095
   - Tasks: analyze-examples → design-task-graph → write-template-json → register-template
   - **Limitation**: Required example templates as context

2. **ACTIVITY_CREATE_TESTING_PLAN_WITH_TRACING.md**:
   - Detailed test plan for activity-create-v2
   - 7 steps: identify-pattern → define-scope → design-steps → create-template → validate-schema → test-execute → create-summary
   - **Not clear if tests were executed**

3. **No Evidence of**:
   - Sterile environment testing (clean workspace with no files)
   - Cross-repository execution (different project structures)
   - Failure mode analysis (what breaks and why)
   - Edge case handling (vague input, missing context, etc.)

### Gaps in Validation

❌ **No test coverage for**:
- Templates working without filesystem dependencies
- Templates handling missing/invalid context
- Templates recovering from validation failures
- Templates working in non-metabob repositories
- Templates working with different project structures

---

## Improvement Plan

### Phase 1: Make Bootstrap Templates Repository-Agnostic (Week 1)

**Goal**: Core activity management templates work anywhere

#### 1.1 Create Self-Contained Activity Creation Template

**File**: `repos/metabob-proto/activities/bootstrap/create-activity-self-contained.json`

**Design Requirements**:
- ✅ No filesystem dependencies
- ✅ Examples embedded in prompts
- ✅ Works in empty workspace
- ✅ Generates valid ActivityTemplate.Schema
- ✅ Self-validates before completion
- ✅ Creates README with usage instructions

**Structure**:
```json
{
  "name": "Create Activity Template (Self-Contained)",
  "version": 3,
  "description": "Create activity templates without requiring example files or specific project structure",
  "category": "infrastructure",
  "contextRequirements": [],  // NONE - fully self-contained
  "tasks": [
    {
      "id": "gather-requirements",
      "description": "Extract requirements from user input",
      "prompt": {
        "template": "You are creating an activity template.\n\nUser wants to create: {{templateName}}\nDescription: {{templateDescription}}\nCategory: {{category}}\n\n**Your task**: Clarify requirements by asking:\n1. What steps should this activity perform?\n2. What inputs does it need?\n3. What outputs should it produce?\n4. What validation ensures success?\n\nCreate a REQUIREMENTS.md file with structured requirements."
      }
    },
    {
      "id": "design-task-graph",
      "description": "Design task breakdown and dependencies",
      "prompt": {
        "template": "Based on REQUIREMENTS.md, design 3-5 atomic tasks.\n\n**Example Task Design**:\n```\nTask 1: Setup environment (no dependencies)\nTask 2: Process input (depends on Task 1)\nTask 3: Validate output (depends on Task 2)\n```\n\n**Principles**:\n- Each task has ONE clear purpose\n- Dependencies form a DAG (no cycles)\n- Tasks are independently testable\n\nCreate TASK_GRAPH.md with task breakdown."
      }
    },
    {
      "id": "write-template",
      "description": "Generate ActivityTemplate.Schema JSON",
      "prompt": {
        "template": "Create activity template JSON following this EXACT structure:\n\n```json\n{\n  \"name\": \"{{templateName}}\",\n  \"version\": 1,\n  \"description\": \"{{templateDescription}}\",\n  \"category\": \"{{category}}\",\n  \"tasks\": [\n    {\n      \"id\": \"task-1\",\n      \"subagent\": \"general\",\n      \"description\": \"Clear task description\",\n      \"dependencies\": [],\n      \"prompt\": {\n        \"template\": \"Task instructions with {{variables}}\",\n        \"maxTokens\": 8000,\n        \"compressionStrategy\": \"filter\",\n        \"variables\": [\n          {\"name\": \"variableName\", \"type\": \"string\", \"required\": true, \"description\": \"What this variable is for\"}\n        ]\n      },\n      \"validation\": {\n        \"requiredFiles\": [],\n        \"requiredPatterns\": [],\n        \"forbiddenPatterns\": [],\n        \"commands\": []\n      },\n      \"retry\": {\"maxAttempts\": 2, \"strategy\": \"simple\"},\n      \"metrics\": {\"successRate\": 0, \"avgTokens\": 0, \"avgDuration\": 0, \"commonFailures\": []}\n    }\n  ],\n  \"contextRequirements\": [],\n  \"integration\": {\"preChecks\": [], \"postChecks\": [], \"qualityGates\": []},\n  \"metabob\": {\"enabled\": false, \"learningMode\": true, \"targetContextTokens\": 5000, \"annotationStrategy\": \"key-components\"}\n}\n```\n\n**CRITICAL RULES**:\n1. Use task IDs from TASK_GRAPH.md\n2. Set realistic maxTokens (8000-12000 for most tasks)\n3. Include validation for tasks that create files\n4. Use \"filter\" compression strategy\n5. Declare ALL variables used in prompt templates\n\nWrite to: {{templateId}}.json"
      }
    },
    {
      "id": "validate-and-register",
      "description": "Validate schema and register template",
      "prompt": {
        "template": "Validate and register the template:\n\n1. **JSON Validation**: Run `cat {{templateId}}.json | jq empty`\n2. **Schema Validation**: Check all required fields present\n3. **Self-Test**: Can this template be executed with test variables?\n\nIf validation passes, create SUCCESS.md documenting:\n- Template ID: {{templateId}}\n- Task count: X\n- Variables: list\n- Example usage: activity({ activityId: '{{templateId}}', variables: {...}, reason: '...' })\n\nIf validation fails, fix errors and retry."
      }
    }
  ]
}
```

**Variables**:
- `templateName`: Human-readable name (e.g., "Add REST Endpoint")
- `templateDescription`: One-sentence description
- `category`: One of: feature, bugfix, refactor, tool, infrastructure
- `templateId`: Kebab-case ID (e.g., "add-rest-endpoint")

**Testing**:
```bash
# Test in clean workspace
mkdir -p /tmp/activity-test && cd /tmp/activity-test
opencode activity \
  --activityId create-activity-self-contained \
  --variables '{"templateName":"Deploy App","templateDescription":"Deploy application to production","category":"infrastructure","templateId":"deploy-app"}' \
  --reason "Test self-contained template creation"

# Expected: Creates deploy-app.json with valid schema
# Expected: No errors about missing files or context
# Expected: SUCCESS.md created with usage instructions
```

#### 1.2 Create Activity Debug Template (Self-Contained)

**File**: `repos/metabob-proto/activities/bootstrap/debug-activity-self-contained.json`

**Purpose**: Debug failed activity executions without filesystem dependencies

**Key Features**:
- Takes execution ID as input (from activity() error messages)
- Queries backend for execution details
- Analyzes failure patterns
- Suggests fixes
- NO dependency on log files or local state

#### 1.3 Create Activity Evolution Template (Self-Contained)

**File**: `repos/metabob-proto/activities/bootstrap/evolve-activity-self-contained.json`

**Purpose**: Improve existing templates based on execution metrics

**Key Features**:
- Queries backend for template metrics (success rate, common failures)
- Identifies improvement opportunities
- Generates new template variant
- Tests variant in isolation
- NO dependency on git history or local files

### Phase 2: Validate Templates in Sterile Environments (Week 2)

**Goal**: Prove templates work anywhere

#### 2.1 Create Sterile Test Suite

**File**: `tests/activity-bootstrap-sterile.test.ts`

```typescript
describe("Bootstrap Templates - Sterile Environment", () => {
  test("create-activity-self-contained works in empty directory", async () => {
    const tmpDir = await createTempDir()
    
    const result = await executeActivity({
      activityId: "create-activity-self-contained",
      variables: {
        templateName: "Test Template",
        templateDescription: "A test template",
        category: "feature",
        templateId: "test-template"
      },
      workingDirectory: tmpDir  // No files present
    })
    
    expect(result.status).toBe("completed")
    expect(result.outputs).toContainFile("test-template.json")
    expect(result.outputs).toContainFile("SUCCESS.md")
    
    // Validate generated template
    const template = JSON.parse(result.outputs["test-template.json"])
    expect(template.name).toBe("Test Template")
    expect(template.tasks.length).toBeGreaterThan(0)
  })
  
  test("debug-activity-self-contained works without log files", async () => {
    // Simulate a failed execution
    const failedExecution = await createFailedExecution()
    
    const result = await executeActivity({
      activityId: "debug-activity-self-contained",
      variables: {
        executionId: failedExecution.id
      },
      workingDirectory: "/tmp/empty"  // No logs
    })
    
    expect(result.status).toBe("completed")
    expect(result.outputs).toContainFile("DIAGNOSIS.md")
    expect(result.outputs["DIAGNOSIS.md"]).toContain("Root Cause:")
    expect(result.outputs["DIAGNOSIS.md"]).toContain("Suggested Fix:")
  })
})
```

#### 2.2 Test in Multiple Environments

**Environments**:
1. **Docker (Alpine)**: Minimal environment
2. **Docker (Ubuntu)**: Standard environment
3. **macOS**: Different filesystem
4. **GitHub Actions**: CI environment

**Test Command**:
```bash
# Run in each environment
docker run --rm -v $(pwd):/workspace alpine:latest sh -c "
  cd /workspace && \
  bun test tests/activity-bootstrap-sterile.test.ts
"
```

### Phase 3: Update Bootstrap Loading (Week 2)

**Goal**: Use new self-contained templates in cold start

#### 3.1 Update bootstrap-templates.ts

```typescript
const TEMPLATE_FILES = {
  // Primary activity management (self-contained)
  "create-activity-template": path.join(__dirname, BOOTSTRAP_DIR, "create-activity-self-contained.json"),
  "debug-activity": path.join(__dirname, BOOTSTRAP_DIR, "debug-activity-self-contained.json"),
  "evolve-activity": path.join(__dirname, BOOTSTRAP_DIR, "evolve-activity-self-contained.json"),
  
  // Core workflow templates
  "feature-impl": path.join(__dirname, BOOTSTRAP_DIR, "feature-impl.json"),
  "bug-fix": path.join(__dirname, BOOTSTRAP_DIR, "bug-fix.json"),
  "refactor": path.join(__dirname, BOOTSTRAP_DIR, "refactor.json"),
}
```

**Changes**:
1. Expand from 3 to 6 bootstrap templates
2. Use self-contained versions for activity management
3. Include core workflow templates (feature/bug/refactor)

#### 3.2 Add Bootstrap Validation

```typescript
export async function validateBootstrap(): Promise<{
  valid: boolean
  errors: Array<{ template: string; error: string }>
}> {
  const templates = await loadAll()
  const errors: Array<{ template: string; error: string }> = []
  
  for (const template of templates) {
    // Check: No filesystem dependencies
    if (hasFilesystemDependencies(template)) {
      errors.push({
        template: template.id,
        error: "Template requires filesystem dependencies (not self-contained)"
      })
    }
    
    // Check: All required fields present
    if (!validateSchema(template)) {
      errors.push({
        template: template.id,
        error: "Template schema validation failed"
      })
    }
    
    // Check: Variables declared for all placeholders
    if (!validateVariables(template)) {
      errors.push({
        template: template.id,
        error: "Template uses undeclared variables"
      })
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

function hasFilesystemDependencies(template: ActivityTemplate.Schema): boolean {
  // Check contextRequirements for file/bashOutput impulses that assume specific paths
  for (const req of template.contextRequirements || []) {
    if (req.impulseTypes.includes("file") || req.impulseTypes.includes("bashOutput")) {
      // If hint mentions specific paths, it's not generalizable
      if (req.hint.match(/templates\/|\.opencode\/|config\//)) {
        return true
      }
    }
  }
  
  // Check validation commands for hardcoded paths
  for (const task of template.tasks) {
    for (const cmd of task.validation.commands || []) {
      if (cmd.command.match(/\/(templates|config|\.opencode)\//)) {
        return true
      }
    }
  }
  
  return false
}
```

### Phase 4: Historical Execution Review & Improvement (Week 3)

**Goal**: Learn from past executions and improve templates

#### 4.1 Query Execution History

```bash
# Get all executions of activity creation templates
curl http://localhost:8082/v2/activities/executions?template_id=infrastructure-1eddde23&limit=100 | jq
```

**Analyze**:
- Success rate (target: >80%)
- Common failure modes
- Average cost (optimize if >$0.02)
- Average duration (optimize if >10 minutes)
- Retry patterns (which tasks fail most)

#### 4.2 Incorporate Learnings

**Common Patterns to Address**:

1. **Schema Validation Failures** → Add better JSON examples to prompts
2. **Missing Variables** → Add validation step before template generation
3. **Timeout on Test Execution** → Reduce test complexity or increase timeout
4. **Vague Requirements** → Add clarification questions in first task

#### 4.3 Create Improvement Template

Use `improve-bootstrap-template` on each bootstrap template:

```bash
for template in create-activity debug-activity evolve-activity; do
  opencode activity \
    --activityId improve-bootstrap-template \
    --variables "{\"templateId\":\"$template\",\"executionMetrics\":true}" \
    --reason "Improve bootstrap template based on execution history"
done
```

### Phase 5: Documentation & CI Integration (Week 4)

**Goal**: Ensure future templates maintain quality standards

#### 5.1 Template Design Guidelines

**File**: `repos/metabob-proto/activities/TEMPLATE_DESIGN_GUIDELINES.md`

**Contents**:
1. **Self-Contained Principle**: No filesystem dependencies
2. **Example Embedding**: Include examples in prompts
3. **Variable Declaration**: Declare all variables used
4. **Validation Strategy**: Test outputs, not assumptions
5. **Error Recovery**: Handle common failure modes
6. **Cost Awareness**: Optimize for token efficiency

#### 5.2 Template Quality Checklist

**File**: `repos/metabob-proto/activities/QUALITY_CHECKLIST.md`

```markdown
## Template Quality Checklist

Before submitting a template for bootstrap inclusion:

### Self-Containment
- [ ] No hardcoded file paths in contextRequirements
- [ ] No assumptions about project structure
- [ ] Examples embedded in prompts (not read from files)
- [ ] Works in empty workspace

### Schema Compliance
- [ ] All required fields present
- [ ] Variables declared for all {{placeholders}}
- [ ] Validation rules are objective (not subjective)
- [ ] Retry strategies are reasonable (2-3 attempts)

### Testing
- [ ] Tested in sterile environment (no files)
- [ ] Tested with minimal variables
- [ ] Tested with edge cases (invalid input)
- [ ] Success rate >80% in test runs

### Documentation
- [ ] Description clearly states what template does
- [ ] Variables have clear descriptions
- [ ] Example usage provided
- [ ] Known limitations documented

### Cost & Performance
- [ ] Average cost <$0.05 per execution
- [ ] Average duration <15 minutes
- [ ] Token budgets are reasonable (8000-12000)
- [ ] No unnecessary tool calls
```

#### 5.3 CI Test Suite

**File**: `.github/workflows/bootstrap-templates.yml`

```yaml
name: Bootstrap Templates Quality

on: [push, pull_request]

jobs:
  validate-bootstrap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
      
      - name: Validate bootstrap templates
        run: |
          bun run validate-bootstrap-templates
          
      - name: Test in sterile environment
        run: |
          mkdir -p /tmp/sterile-test
          cd /tmp/sterile-test
          bun test repos/metabob-opencode/tests/activity-bootstrap-sterile.test.ts
          
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: bootstrap-test-results
          path: test-results/
```

---

## Success Criteria

### Phase 1 Success (Week 1)
- ✅ 3 self-contained templates created (create/debug/evolve)
- ✅ Templates have NO filesystem dependencies
- ✅ Examples embedded in prompts
- ✅ Manual testing passes in clean workspace

### Phase 2 Success (Week 2)
- ✅ Sterile test suite created
- ✅ Tests pass in 4 environments (Alpine, Ubuntu, macOS, CI)
- ✅ Templates work with minimal context
- ✅ Edge cases handled gracefully

### Phase 3 Success (Week 2)
- ✅ Bootstrap loading updated (3 → 6 templates)
- ✅ Bootstrap validation added
- ✅ Cold start loads self-contained templates
- ✅ No breaking changes to existing API

### Phase 4 Success (Week 3)
- ✅ Execution history analyzed
- ✅ Common failure modes identified
- ✅ Templates improved based on learnings
- ✅ Success rate >80% for all bootstrap templates

### Phase 5 Success (Week 4)
- ✅ Design guidelines documented
- ✅ Quality checklist created
- ✅ CI tests integrated
- ✅ Future templates follow standards

---

## Risk Mitigation

### Risk 1: Breaking Existing Workflows
**Mitigation**: Keep old templates, add new ones with different IDs
- Old: `create-activity-template` (file-dependent)
- New: `create-activity-self-contained` (no dependencies)
- Users can choose which to use

### Risk 2: Templates Too Generic
**Mitigation**: Provide both generic and specialized versions
- Generic: Works anywhere (bootstrap)
- Specialized: Optimized for specific repos (built-in)

### Risk 3: Performance Regression
**Mitigation**: Track metrics before/after
- Baseline: Current `create-activity-template` (7.6 min, $0.0095)
- Target: Self-contained version within 20% (9 min, $0.012)

---

## Next Steps

### Immediate Actions (This Week)
1. **Review this plan** with team
2. **Create Phase 1 templates** (create-activity-self-contained)
3. **Test manually** in clean workspace
4. **Document learnings** for Phase 2

### Code Changes Required
- `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts` - Update template list
- `repos/metabob-proto/activities/bootstrap/create-activity-self-contained.json` - New template
- `repos/metabob-proto/activities/bootstrap/debug-activity-self-contained.json` - New template
- `repos/metabob-proto/activities/bootstrap/evolve-activity-self-contained.json` - New template
- `repos/metabob-opencode/tests/activity-bootstrap-sterile.test.ts` - New test suite

### Repository Changes Required
- `repos/metabob-proto/activities/TEMPLATE_DESIGN_GUIDELINES.md` - New doc
- `repos/metabob-proto/activities/QUALITY_CHECKLIST.md` - New doc
- `.github/workflows/bootstrap-templates.yml` - New CI workflow

---

## Questions for Discussion

1. **Scope**: Should bootstrap templates ONLY be self-contained, or allow some repository-aware templates?
2. **Migration**: How do we transition users from old templates to new ones?
3. **Testing**: Should we require 100% sterile environment success, or allow some repository-aware features?
4. **Versioning**: How do we version bootstrap templates separately from regular templates?
5. **Deployment**: How do we deploy bootstrap template updates (part of binary release)?

---

## Appendix A: Template Format Comparison

### Old Format (Group B - Obsolete)
```json
{
  "task_steps": [
    {
      "step_id": "task-1",              // Wrong field
      "title": "Do Something",          // Wrong field
      "tools": ["read_file"],           // Wrong structure
      "guidance": ["..."]               // OK
      // Missing: prompt object, validation, retry, metrics
    }
  ]
}
```

### Proto-Aligned Format (Group A - Current)
```json
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Do Something",
      "dependencies": [],
      "prompt": {
        "template": "...",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": []
      },
      "validation": {...},
      "retry": {...},
      "metrics": {...}
      // Missing: subagent, impulse_refs (per BOOTSTRAP_TEMPLATE_STATUS.md)
    }
  ]
}
```

### Self-Contained Format (Target)
```json
{
  "name": "Template Name",
  "version": 1,
  "description": "One sentence description",
  "category": "feature|bugfix|refactor|tool|infrastructure",
  "tasks": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Clear task description",
      "dependencies": [],
      "impulseReferences": [],  // Empty for self-contained
      "prompt": {
        "template": "Instructions with embedded examples:\n\n**Example**:\n```\nEmbedded example here\n```\n\nYour task: {{variable}}",
        "maxTokens": 8000,
        "compressionStrategy": "filter",
        "variables": [
          {"name": "variable", "type": "string", "required": true, "description": "Clear description"}
        ]
      },
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": ["must contain this"],
        "forbiddenPatterns": ["must not contain this"],
        "commands": []
      },
      "retry": {"maxAttempts": 2, "strategy": "simple"},
      "metrics": {"successRate": 0, "avgTokens": 0, "avgDuration": 0, "commonFailures": []}
    }
  ],
  "contextRequirements": [],  // EMPTY - self-contained
  "integration": {"preChecks": [], "postChecks": [], "qualityGates": []},
  "metabob": {"enabled": false, "learningMode": true, "targetContextTokens": 5000, "annotationStrategy": "key-components"}
}
```

**Key Differences**:
1. ✅ `impulseReferences: []` - No external context needed
2. ✅ `contextRequirements: []` - No file/bash dependencies
3. ✅ Examples embedded in `prompt.template` - Not read from files
4. ✅ Works in any workspace - No path assumptions

---

## Appendix B: Execution Metrics from Historical Data

### create-activity-template (infrastructure-1eddde23)
- **Executions**: 1 validated
- **Success Rate**: 100% (1/1)
- **Average Duration**: 458.1s (7.6 minutes)
- **Average Cost**: $0.0095
- **Tasks**: 4 (analyze-examples, design-task-graph, write-template-json, register-template)
- **Bottleneck**: write-template-json (242.2s, 53% of total time)
- **Limitation**: Requires example templates as contextRequirements

### Improvement Opportunities
1. **Reduce Example Dependency**: Embed examples → save context loading time
2. **Optimize write-template-json**: Provide better JSON structure examples → reduce thinking time
3. **Add Validation Earlier**: Validate JSON structure before final write → reduce retry cycles
4. **Stream Output**: Show progress during long write-template-json task → better UX

---

*End of Document*
