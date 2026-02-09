# Activity Registration System: Current State & Required Fixes

## Executive Summary

**Problem**: The `create-activity-template` activity cannot reliably register new templates because:
1. Lifecycle hooks exist but don't execute within subagent working directories
2. No tool exists for agents to register templates directly
3. Trailblazing for registration failures is not implemented
4. The registration task depends on MCP tools that may not be available to subagents

**Solution Required**: Make lifecycle hooks fully functional, add a registration tool, and implement trailblazing recovery.

---

## Current Architecture

### 1. Activity Lifecycle Hooks (IMPLEMENTED BUT NOT FULLY FUNCTIONAL)

**Location**: `repos/metabob-opencode/packages/opencode/src/session/activity-hooks.ts`

**Available Hooks**:
```typescript
{
  preActivity: {
    workingDirectory: {
      type: "temporary" | "custom" | "current",
      prefix: "activity-template-",
      cleanup: "onSuccess" | "onError" | "always" | "never"
    },
    environment: Record<string, string>,
    loadImpulses: string[],
    commands: Array<{ name: string, command: string, required: boolean }>
  },
  postActivity: {
    extractFiles: { pattern: string, destination: string, action: "copy" | "move" },
    persistImpulses: string[],
    createSummary: boolean,
    cleanup: boolean,
    commands: string[]
  },
  preTask: {
    loadTaskImpulses: boolean,
    validateTools: boolean,
    commands: string[]
  },
  postTask: {
    unloadLargeImpulses: boolean,
    captureOutputs: Array<{ pattern: string, as: string }>,
    commands: string[]
  },
  onError: {
    captureEnvironment: boolean,
    captureLogs: { tail: number },
    createDiagnosticImpulse: boolean,
    createBoredomTask: boolean  // Triggers deferred improvement
  }
}
```

**Current Execution**: 
- ✅ `preActivity` hooks execute in `TemplateExecutor.execute()` (line 199-225)
- ✅ `postActivity` hooks execute after task completion (line 258-268)
- ✅ `onError` hooks execute on failure (line 211-222)
- ❌ **BUT**: Subagent sessions created via `TaskExecutor` don't inherit the working directory
- ❌ **BUT**: Subagents see the parent's CWD, not the temp directory

**Key Issue**: 
```typescript
// In template-executor.ts line 201-204
hooksContext = await ActivityHooks.executePreActivity(template.hooks.preActivity, {
  activityId: activity.id,
  templateId: template.id,
})
// Changes process.cwd() to temp directory

// But later in task execution (line 239):
const executions = await executeTasks(template, activity, options.variables, options.dryRun, undefined)

// executeTasks() creates subagent sessions that spawn in ORIGINAL cwd, not temp directory!
```

### 2. Create Activity Template - Current Implementation

**Location**: `repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json`

**Current Tasks** (4 tasks):
1. `analyze-examples`: Study existing templates
2. `design-task-graph`: Design task dependency graph
3. `write-template-json`: Convert graph to JSON
4. `register-template`: **CRITICAL - Register with backend and verify**

**Hooks Configuration**:
```json
{
  "hooks": {
    "preActivity": {
      "workingDirectory": {
        "type": "temporary",
        "prefix": "activity-template-",
        "cleanup": "onSuccess"
      },
      "environment": {
        "ACTIVITY_TEMPLATE_CREATION": "true",
        "METABOB_API_URL": "http://localhost:8080"
      }
    },
    "postActivity": {
      "cleanup": true,
      "createSummary": true
    },
    "onError": {
      "captureEnvironment": true,
      "captureLogs": { "tail": 50 },
      "createDiagnosticImpulse": true,
      "cleanup": false
    }
  }
}
```

**Problem with Task 4 (register-template)**:
```json
{
  "id": "register-template",
  "subagent": "general",
  "description": "Register created template with Metabob backend and verify",
  "dependencies": ["write-template-json"],
  "prompt": {
    "template": "Register the created template file with Metabob backend.\n\n**Template File**: Look for *.json files in current directory (should be {{templateId}}.json)\n\n**Registration Steps**:\n\n1. **Find the template file**:\n   - List *.json files in current directory\n   - Should find exactly one file: {{templateId}}.json or similar\n   - If multiple files, use the one matching the template name\n\n2. **Register with register_activity_template tool**:\n   ```typescript\n   await register_activity_template({\n     file_path: \"path/to/template.json\",\n     register_with_metabob: true\n   })\n   ```\n\n3. **Verify registration succeeded**:\n   - Use search_activities tool to find the template\n   - Check that template ID matches {{templateId}}\n   - Verify template has correct name: {{templateName}}\n   - Confirm category is {{category}}\n\n**Verification Example**:\n```typescript\nconst results = await search_activities({\n  query: \"{{templateName}}\",\n  category: \"{{category}}\",\n  verbose: false\n})\n\n// Check if template found\nif (results.activities.some(a => a.id === '{{templateId}}')) {\n  console.log('✓ Template successfully registered and discoverable')\n} else {\n  throw new Error('Template registration failed - not found in search')\n}\n```\n\n**Error Handling**:\n- If register_activity_template fails: Report error clearly, fail the task\n- If verification fails: Report what was found vs expected\n- Do NOT use || true or similar to hide failures\n- Let the activity fail visibly so registration issues are caught\n\n**Success Criteria**:\n- ✓ register_activity_template returns success\n- ✓ search_activities finds the template\n- ✓ Template is executable via activity tool\n- ✓ Agent confirms registration in output"
  }
}
```

**Issues**:
1. ❌ Tool `register_activity_template` doesn't exist
2. ❌ Prompt assumes subagent can see temp directory files
3. ❌ No trailblazing if registration fails
4. ❌ No automatic schema validation before registration

---

## What's Missing

### 1. Missing Tool: `register_activity_template`

**Expected Signature**:
```typescript
register_activity_template({
  file_path: string,           // Path to JSON template file
  register_with_metabob: boolean  // Whether to register with backend
}): Promise<{ success: boolean, template_id: string, errors?: string[] }>
```

**What It Should Do**:
1. Read JSON file from `file_path`
2. Validate against `ActivityTemplate.Schema`
3. Generate variant ID (content hash)
4. Call `TemplateRepository.save(template)`
5. Verify registration with `search_activities`
6. Return success/failure with details

**Current Workaround**: Subagents call MCP tools directly via `MetabobCLI.registerActivityTemplate()`, but:
- MCP tools may not be available to all subagents
- No validation before registration
- No retry logic
- No schema error reporting

### 2. Working Directory Inheritance

**Problem**: 
```typescript
// Parent activity (TemplateExecutor) sets working directory
process.chdir(tempDirectory)  // e.g., /tmp/activity-template-abc123

// But when executeTasks() creates subagent sessions:
await Session.create({
  mode: "general",
  cwd: process.cwd()  // ❌ Still sees ORIGINAL cwd, not temp directory!
})
```

**Why**: Session creation happens in a separate process/context that doesn't inherit `process.cwd()`.

**Fix Needed**: Pass `workingDirectory` from `hooksContext` to `executeTasks()` and explicitly set it in subagent session options.

### 3. Trailblazing for Registration Failures

**Required**: When `register-template` task fails due to schema errors or validation issues, the activity should:
1. Capture the error details (schema violations, missing fields, etc.)
2. Create additional dynamic tasks to fix the issues:
   ```
   - Task 5: Fix schema errors in template JSON
   - Task 6: Retry registration
   - Task 7: Verify registration succeeded
   ```
3. If still failing after N attempts, create a boredom task for deferred improvement
4. Record the failure pattern and create an evolved variant of `create-activity-template` with better validation

**Implementation Location**: 
- Trailblazing logic: `repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts`
- Hook into: `template-executor.ts` after task failure detection
- Trigger: Task validation failure with `retry.strategy === "trailblazing"`

### 4. Schema Validation Before Registration

**Current State**: Template JSON is written and registration is attempted without pre-validation.

**Required**: Add a validation step in `write-template-json` task:
```json
{
  "validation": {
    "requiredFiles": ["*.json"],
    "requiredPatterns": [
      "\"name\":",
      "\"category\":",
      "\"tasks\":",
      "\"validation\":",
      "\"retry\":"
    ],
    "forbiddenPatterns": [
      "TODO",
      "\"subagent\": \"\"",
      "\"maxTokens\": 0"
    ],
    "commands": [
      {
        "name": "validate-json-syntax",
        "command": "jq empty *.json",
        "required": true
      },
      {
        "name": "validate-schema",
        "command": "bash scripts/validate-activity-template.sh *.json",
        "required": true
      }
    ]
  }
}
```

**Script Needed**: `scripts/validate-activity-template.sh`:
```bash
#!/bin/bash
# Validate activity template against ActivityTemplate.Schema
# Usage: validate-activity-template.sh template.json

TEMPLATE_FILE="$1"

# Check file exists
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: Template file not found: $TEMPLATE_FILE"
  exit 1
fi

# Validate JSON syntax
if ! jq empty "$TEMPLATE_FILE" 2>/dev/null; then
  echo "Error: Invalid JSON syntax in $TEMPLATE_FILE"
  exit 1
fi

# Check required fields
REQUIRED_FIELDS=("name" "category" "tasks" "version")
for field in "${REQUIRED_FIELDS[@]}"; do
  if ! jq -e ".$field" "$TEMPLATE_FILE" >/dev/null 2>&1; then
    echo "Error: Missing required field: $field"
    exit 1
  fi
done

# Validate task count (3-7 tasks recommended)
TASK_COUNT=$(jq '.tasks | length' "$TEMPLATE_FILE")
if [ "$TASK_COUNT" -lt 1 ] || [ "$TASK_COUNT" -gt 10 ]; then
  echo "Warning: Task count $TASK_COUNT is outside recommended range (3-7)"
fi

# Check all tasks have validation
TASKS_WITH_VALIDATION=$(jq '.tasks | map(select(.validation)) | length' "$TEMPLATE_FILE")
if [ "$TASKS_WITH_VALIDATION" -ne "$TASK_COUNT" ]; then
  echo "Error: Not all tasks have validation. Found $TASKS_WITH_VALIDATION/$TASK_COUNT"
  exit 1
fi

# Check all tasks have retry config
TASKS_WITH_RETRY=$(jq '.tasks | map(select(.retry)) | length' "$TEMPLATE_FILE")
if [ "$TASKS_WITH_RETRY" -ne "$TASK_COUNT" ]; then
  echo "Error: Not all tasks have retry config. Found $TASKS_WITH_RETRY/$TASK_COUNT"
  exit 1
fi

echo "✓ Template validation passed: $TEMPLATE_FILE"
echo "  - $TASK_COUNT tasks"
echo "  - All tasks have validation"
echo "  - All tasks have retry config"
```

---

## Implementation Plan

### Phase 1: Fix Working Directory Inheritance (CRITICAL)

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Changes**:
1. Pass `hooksContext.workingDirectory` to `executeTasks()`:
   ```typescript
   // Line 239
   const executions = await executeTasks(
     template, 
     activity, 
     options.variables, 
     options.dryRun, 
     undefined,
     hooksContext?.workingDirectory  // ADD THIS
   )
   ```

2. Update `executeTasks()` to accept and use working directory:
   ```typescript
   async function executeTasks(
     template: ActivityTemplate.Schema,
     activity: Activity.Info,
     variables: Record<string, unknown>,
     dryRun: boolean,
     parentSessionID: string | undefined,
     workingDirectory?: string  // ADD THIS
   ): Promise<TaskExecution[]>
   ```

3. Pass working directory to subagent session creation:
   ```typescript
   const session = await Session.create({
     mode: task.subagent,
     cwd: workingDirectory || process.cwd(),  // USE HOOK CONTEXT CWD
     ...
   })
   ```

**Test**: Run `create-activity-template` and verify subagent can see temp directory files.

### Phase 2: Add `register_activity_template` Tool

**File**: Create `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts`

**Implementation**:
```typescript
import { Tool } from "./tool"
import z from "zod"
import { ActivityTemplate } from "../session/activity-template"
import { TemplateRepository } from "../session/activity-template-repository"
import { Log } from "../util/log"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const log = Log.create({ service: "register-activity-template-tool" })

const DESCRIPTION = `Register a new activity template with the Metabob backend.

This tool reads a template JSON file, validates it against the schema, and registers it with the backend.

Usage:
  register_activity_template({
    file_path: "path/to/template.json",
    validate_only: false  // If true, only validate without registering
  })

The tool will:
1. Read and parse the JSON file
2. Validate against ActivityTemplate.Schema
3. Generate a variant ID (content hash)
4. Register with Metabob backend via TemplateRepository
5. Verify registration by searching for the template
6. Return success status with template ID

If validation fails, detailed error messages are returned.
`

export const registerActivityTemplate: Tool.Tool = {
  name: "register_activity_template",
  description: DESCRIPTION,
  schema: z.object({
    file_path: z.string().describe("Path to the activity template JSON file"),
    validate_only: z.boolean().optional().default(false)
      .describe("If true, only validate the template without registering it"),
  }),
  fn: async (args, context) => {
    try {
      const { file_path, validate_only } = args

      // Resolve file path (handle relative paths)
      const resolvedPath = path.isAbsolute(file_path) 
        ? file_path 
        : path.join(process.cwd(), file_path)

      log.info("reading template file", { path: resolvedPath })

      // Read file
      const content = await fs.readFile(resolvedPath, "utf-8")
      
      // Parse JSON
      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      } catch (error) {
        return {
          success: false,
          error: "Invalid JSON syntax",
          details: (error as Error).message,
        }
      }

      // Validate against schema
      const validation = ActivityTemplate.Schema.safeParse(parsed)
      if (!validation.success) {
        const errors = validation.error.issues.map(issue => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        }))
        
        return {
          success: false,
          error: "Schema validation failed",
          validation_errors: errors,
          hint: "Fix the schema errors above and try again",
        }
      }

      const template = validation.data
      log.info("template validated successfully", {
        id: template.id,
        name: template.name,
        category: template.category,
        taskCount: template.tasks.length,
      })

      // If validate_only, stop here
      if (validate_only) {
        return {
          success: true,
          template_id: template.id,
          template_name: template.name,
          category: template.category,
          task_count: template.tasks.length,
          message: "Validation passed. Template is ready to register.",
        }
      }

      // Register with backend
      log.info("registering template with backend", { id: template.id })
      await TemplateRepository.save(template)

      // Verify registration
      log.info("verifying registration", { id: template.id })
      const registered = await TemplateRepository.get(template.id, { skipCache: true })
      
      if (!registered) {
        return {
          success: false,
          error: "Registration verification failed",
          details: "Template was registered but could not be retrieved from backend",
          template_id: template.id,
        }
      }

      log.info("template registered successfully", {
        id: template.id,
        name: template.name,
      })

      return {
        success: true,
        template_id: template.id,
        template_name: template.name,
        category: template.category,
        task_count: template.tasks.length,
        message: `Template "${template.name}" (${template.id}) registered successfully`,
      }
    } catch (error) {
      log.error("registration failed", { error })
      return {
        success: false,
        error: "Registration failed",
        details: (error as Error).message,
      }
    }
  },
}
```

**Register Tool**: Add to `repos/metabob-opencode/packages/opencode/src/tool/index.ts`:
```typescript
export { registerActivityTemplate } from "./register-activity-template"
```

**Expose to Agents**: Add to `repos/metabob-opencode/packages/opencode/src/session/prompt.ts`:
```typescript
activity: new Set([
  // ... existing tools ...
  "register_activity_template",
]),
general: new Set([
  // ... existing tools ...
  "register_activity_template",
]),
```

### Phase 3: Add Validation Script

**File**: Create `scripts/validate-activity-template.sh` (content above)

**Make Executable**:
```bash
chmod +x scripts/validate-activity-template.sh
```

**Update `write-template-json` Task**: Add validation command to task in `create-activity-template.json`:
```json
{
  "id": "write-template-json",
  "validation": {
    "commands": [
      {
        "name": "validate-json-syntax",
        "command": "jq empty *.json",
        "required": true
      },
      {
        "name": "validate-schema",
        "command": "bash scripts/validate-activity-template.sh *.json",
        "required": true
      }
    ]
  }
}
```

### Phase 4: Implement Trailblazing for Registration

**File**: Update `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Add Trailblazing Trigger**:
```typescript
// After task execution (around line 450)
if (execution.status === "failed" && task.retry?.strategy === "trailblazing") {
  log.info("task failed with trailblazing strategy, generating recovery tasks", {
    taskId: task.id,
    error: execution.error,
  })

  // Create recovery tasks
  const recoveryTasks = await generateRecoveryTasks({
    failedTask: task,
    error: execution.error,
    template,
    activity,
  })

  // Append recovery tasks to template
  template.tasks.push(...recoveryTasks)
  
  // Continue execution with new tasks
  log.info("appended recovery tasks", { count: recoveryTasks.length })
}
```

**Add Recovery Task Generator**:
```typescript
async function generateRecoveryTasks(options: {
  failedTask: ActivityTemplate.Task
  error: string | undefined
  template: ActivityTemplate.Schema
  activity: Activity.Info
}): Promise<ActivityTemplate.Task[]> {
  const { failedTask, error, template } = options

  // Analyze error to determine recovery strategy
  const isSchemaError = error?.includes("schema") || error?.includes("validation")
  const isRegistrationError = error?.includes("registration") || error?.includes("backend")

  const recoveryTasks: ActivityTemplate.Task[] = []

  if (isSchemaError) {
    // Task: Fix schema errors
    recoveryTasks.push({
      id: `fix-schema-errors-${Date.now()}`,
      subagent: "general",
      description: "Fix schema validation errors in template JSON",
      dependencies: [failedTask.id],
      prompt: {
        template: `The template validation failed with schema errors:\n\n${error}\n\nFix the JSON file to pass validation:\n1. Read the *.json file\n2. Identify the schema violations\n3. Fix each issue\n4. Run validation: bash scripts/validate-activity-template.sh *.json\n5. Ensure all checks pass`,
        maxTokens: 8000,
      },
      validation: {
        commands: [
          {
            name: "re-validate-schema",
            command: "bash scripts/validate-activity-template.sh *.json",
            required: true,
          },
        ],
      },
      retry: {
        maxAttempts: 2,
        strategy: "simple",
      },
    })

    // Task: Retry registration
    recoveryTasks.push({
      id: `retry-registration-${Date.now()}`,
      subagent: "general",
      description: "Retry template registration after fixes",
      dependencies: [recoveryTasks[0].id],
      prompt: {
        template: "Register the fixed template:\n1. Use register_activity_template tool\n2. Verify with search_activities\n3. Confirm template is discoverable",
        maxTokens: 6000,
      },
      validation: {
        commands: [],
      },
      retry: {
        maxAttempts: 1,
        strategy: "simple",
      },
    })
  }

  if (isRegistrationError) {
    // Task: Debug registration failure
    recoveryTasks.push({
      id: `debug-registration-${Date.now()}`,
      subagent: "general",
      description: "Debug registration failure and retry",
      dependencies: [failedTask.id],
      prompt: {
        template: `Registration failed: ${error}\n\nDebug and retry:\n1. Check Metabob backend connectivity\n2. Verify template file is valid\n3. Retry registration with register_activity_template\n4. If still failing, report detailed error`,
        maxTokens: 8000,
      },
      validation: {
        commands: [],
      },
      retry: {
        maxAttempts: 1,
        strategy: "simple",
      },
    })
  }

  // If no specific recovery strategy, create generic retry task
  if (recoveryTasks.length === 0) {
    recoveryTasks.push({
      id: `generic-retry-${Date.now()}`,
      subagent: "general",
      description: "Generic retry with additional context",
      dependencies: [failedTask.id],
      prompt: {
        template: `Previous attempt failed: ${error}\n\nRetry the registration:\n1. Review the error\n2. Fix any issues\n3. Complete the registration\n4. Verify success`,
        maxTokens: 8000,
      },
      validation: {
        commands: [],
      },
      retry: {
        maxAttempts: 1,
        strategy: "simple",
      },
    })
  }

  return recoveryTasks
}
```

### Phase 5: Update `create-activity-template` Template

**File**: `repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json`

**Update Task 4 (register-template)**:
```json
{
  "id": "register-template",
  "subagent": "general",
  "description": "Register created template with Metabob backend and verify",
  "dependencies": ["write-template-json"],
  "prompt": {
    "template": "Register the created template with the backend.\n\n**Steps**:\n\n1. **Find template file**:\n   ```bash\n   ls -la *.json\n   ```\n   Should see: {{templateId}}.json\n\n2. **Validate before registration** (optional but recommended):\n   ```typescript\n   register_activity_template({\n     file_path: \"{{templateId}}.json\",\n     validate_only: true\n   })\n   ```\n\n3. **Register template**:\n   ```typescript\n   register_activity_template({\n     file_path: \"{{templateId}}.json\",\n     validate_only: false\n   })\n   ```\n   Expected result: { success: true, template_id: \"{{templateId}}\", ... }\n\n4. **Verify registration**:\n   ```typescript\n   search_activities({\n     query: \"{{templateName}}\",\n     category: \"{{category}}\"\n   })\n   ```\n   Confirm template appears in results with correct ID and name.\n\n**Success Criteria**:\n- ✓ register_activity_template returns success: true\n- ✓ search_activities finds the template\n- ✓ Template ID matches {{templateId}}\n- ✓ Template is immediately usable via activity tool\n\n**Error Handling**:\n- If validation fails: Report schema errors clearly\n- If registration fails: Report backend error\n- Let task fail visibly - trailblazing will generate recovery tasks",
    "maxTokens": 8000,
    "compressionStrategy": "filter",
    "variables": [
      {
        "name": "templateId",
        "type": "string",
        "required": true
      },
      {
        "name": "templateName",
        "type": "string",
        "required": true
      },
      {
        "name": "category",
        "type": "string",
        "required": true
      }
    ]
  },
  "validation": {
    "commands": []
  },
  "retry": {
    "maxAttempts": 3,
    "strategy": "trailblazing"  // ENABLE TRAILBLAZING
  }
}
```

---

## Testing Plan

### Test 1: Working Directory Inheritance

```bash
# Create a simple test activity with temp directory
cat > test-temp-dir.json <<EOF
{
  "id": "test-temp-dir",
  "name": "Test Temporary Directory",
  "version": 1,
  "category": "test",
  "tasks": [
    {
      "id": "write-file",
      "subagent": "general",
      "description": "Write a file in temp directory",
      "dependencies": [],
      "prompt": {
        "template": "Create a file named test.txt with content 'hello from temp dir'",
        "maxTokens": 2000
      },
      "validation": {
        "requiredFiles": ["test.txt"]
      },
      "retry": { "maxAttempts": 1, "strategy": "simple" }
    },
    {
      "id": "verify-file",
      "subagent": "general",
      "description": "Verify file exists in temp directory",
      "dependencies": ["write-file"],
      "prompt": {
        "template": "List all files in current directory and read test.txt",
        "maxTokens": 2000
      },
      "validation": {},
      "retry": { "maxAttempts": 1, "strategy": "simple" }
    }
  ],
  "hooks": {
    "preActivity": {
      "workingDirectory": {
        "type": "temporary",
        "prefix": "test-temp-",
        "cleanup": "always"
      }
    }
  }
}
EOF

# Register and run
opencode activity --template test-temp-dir
```

**Expected**: Task 2 should see test.txt file created by Task 1.

### Test 2: Registration Tool

```bash
# Create a minimal valid template
cat > minimal-template.json <<EOF
{
  "id": "test-minimal",
  "name": "Minimal Test Template",
  "version": 1,
  "category": "test",
  "description": "Minimal template for testing registration",
  "tasks": [
    {
      "id": "hello",
      "subagent": "general",
      "description": "Say hello",
      "dependencies": [],
      "prompt": {
        "template": "Say hello world",
        "maxTokens": 1000
      },
      "validation": {},
      "retry": { "maxAttempts": 1, "strategy": "simple" }
    }
  ]
}
EOF

# Test validation only
opencode tool register_activity_template --file-path minimal-template.json --validate-only

# Test full registration
opencode tool register_activity_template --file-path minimal-template.json

# Verify registration
opencode tool search_activities --query "Minimal Test"
```

**Expected**: 
- Validation passes
- Registration succeeds
- Search finds the template

### Test 3: End-to-End Activity Creation

```bash
# Run create-activity-template activity
opencode activity --template create-activity-template --variables '{
  "templateName": "Deploy Application",
  "templateDescription": "Deploy app to production with health checks",
  "category": "infrastructure",
  "purpose": "Automate deployment with rollback capability",
  "templateId": "deploy-application"
}'
```

**Expected**:
- Task 1: Analyzes examples successfully
- Task 2: Designs task graph successfully
- Task 3: Writes deploy-application.json successfully
- Task 4: Registers template successfully
- Verification: `search_activities` finds "Deploy Application"
- Template immediately usable: `opencode activity --template deploy-application`

### Test 4: Trailblazing Recovery

```bash
# Create an invalid template (missing required fields)
cat > invalid-template.json <<EOF
{
  "name": "Invalid Template",
  "category": "test"
  // Missing: id, version, tasks
}
EOF

# Try to register (should fail and trigger trailblazing)
opencode tool register_activity_template --file-path invalid-template.json
```

**Expected**:
- Registration fails with schema validation errors
- Trailblazing generates recovery task: "fix-schema-errors"
- Recovery task fixes the JSON
- Retry task registers successfully

---

## Success Metrics

After implementation, the activity registration system should achieve:

1. **Reliability**: 95%+ success rate for `create-activity-template` executions
2. **Recovery**: 80%+ of schema errors auto-fixed by trailblazing
3. **Visibility**: All registration failures captured with detailed diagnostics
4. **Usability**: New templates immediately discoverable and executable
5. **Learning**: Failed registration patterns recorded for template evolution

---

## Next Steps

1. **Immediate**: Implement Phase 1 (working directory inheritance) - CRITICAL BLOCKER
2. **High Priority**: Implement Phase 2 (registration tool) - REQUIRED FOR REGISTRATION
3. **Medium Priority**: Implement Phase 3 (validation script) - IMPROVES RELIABILITY
4. **Medium Priority**: Implement Phase 4 (trailblazing) - ENABLES RECOVERY
5. **Low Priority**: Implement Phase 5 (update template) - POLISH & DOCS

**Estimated Effort**: 4-6 hours total
**Risk**: Low - changes are isolated and testable
**Impact**: High - unblocks activity template creation and evolution
