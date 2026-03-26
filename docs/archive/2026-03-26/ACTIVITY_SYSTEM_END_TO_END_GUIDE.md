# Activity System End-to-End Guide

**Date**: March 8, 2026  
**Environment**: repos/metabob-opencode (running via `bun run dev ../..` from metabob-devbob)  
**Backend**: metabob-rpc-api (http://api.metabob.local)  

---

## Architecture Overview

### Storage & Communication Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Activity Creation & Execution Flow                     │
└──────────────────────────────────────────────────────────────────────────┘

1. LOCAL STORAGE (Primary for Development)
   Location: ~/.local/share/opencode/storage/
   ├── activity-template/          ← Template definitions (JSON)
   ├── activity/                   ← Activity execution records
   ├── activity-execution/         ← Execution details
   ├── impulse-activity/           ← Activity-scoped impulses
   └── session/                    ← Session data

2. METABOB BACKEND (Primary for Production)
   Endpoint: http://api.metabob.local/
   Transport: MCP (Model Context Protocol) via metabob-cli
   Services:
   ├── TemplateService             ← Template CRUD operations
   ├── ActivityService             ← Activity execution tracking
   └── MetricsService              ← Success rates, costs, tokens

3. COMMUNICATION PATH
   OpenCode Tool
     ↓
   TemplateRepository.save(template, backends: ["metabob"])
     ↓
   TemplateServiceClient.registerTemplate()
     ↓
   MetabobCLI.callMCPTool("metabob_register_activity_template", ...)
     ↓
   MCP Client (via metabob-cli)
     ↓
   Metabob RPC API (http://api.metabob.local/)
     ↓
   SurrealDB (persistent storage)
```

### Load Order for Templates

```
Template Load Request
  ↓
1. Check TemplateCache (in-memory)
   ├─ Hit? → Return cached template
   └─ Miss? → Continue to Step 2
  ↓
2. Try Metabob TemplateService (via MCP)
   ├─ Success? → Cache + Return
   ├─ Fail (strictBackend=true)? → Throw error
   └─ Fail (strictBackend=false)? → Continue to Step 3
  ↓
3. Fallback to Local Storage (bootstrap only)
   ├─ Bootstrap template? → Load from embedded source
   └─ Non-bootstrap? → Error (template not found)
```

---

## How to Create an Activity

### Method 1: Using register_activity_template Tool (RECOMMENDED)

**Step 1**: Create template JSON file

```json
{
  "name": "Test Activity System",
  "description": "Validate activity creation and execution end-to-end",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Echo test message",
      "dependencies": [],
      "executionMode": "deterministic",
      "toolSequence": [
        {
          "tool": "bash",
          "params": {
            "command": "echo 'Activity system test: {{testMessage}}'",
            "description": "Echo test message"
          }
        },
        {
          "tool": "bash",
          "params": {
            "command": "date",
            "description": "Show current date/time"
          }
        }
      ],
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "maxAttempts": 1,
        "strategy": "simple"
      },
      "metrics": {
        "successRate": 0,
        "avgTokens": 0,
        "avgDuration": 0,
        "commonFailures": []
      }
    }
  ],
  "integration": {
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  },
  "metabob": {
    "enabled": false,
    "learningMode": false,
    "targetContextTokens": 0,
    "annotationStrategy": "key-components"
  }
}
```

**Step 2**: Register template using OpenCode CLI

From your OpenCode session:

```typescript
register_activity_template({
  file_path: "/home/avi/documents/work/exp-repo/metabob-devbob/test-activity-system.json",
  register_with_metabob: true,
  validate_before_register: false  // Set to true to test-execute before registration
})
```

Or with validation (executes template once to verify it works):

```typescript
register_activity_template({
  file_path: "/home/avi/documents/work/exp-repo/metabob-devbob/test-activity-system.json",
  register_with_metabob: true,
  validate_before_register: true,
  test_variables: {
    testMessage: "Hello from validation"
  }
})
```

### Method 2: Direct File Creation (Manual)

**Step 1**: Create template JSON (same as above)

**Step 2**: Save to local storage

```bash
cp test-activity-system.json ~/.local/share/opencode/storage/activity-template/test-activity-system.json
```

**Note**: This only creates local copy. To sync to backend, use Method 1.

---

## How to Run an Activity

### Method 1: Using activity Tool (RECOMMENDED)

From your OpenCode session:

```typescript
activity({
  templateId: "test-activity-system",
  variables: {
    testMessage: "Hello from execution"
  },
  reason: "Testing activity system end-to-end"
})
```

### Method 2: Using OpenCode CLI (if built)

```bash
# List available activities
bun run dev ../.. activity list

# Show activity details
bun run dev ../.. activity show test-activity-system

# Run activity
bun run dev ../.. activity run test-activity-system --var testMessage="Hello"
```

---

## Where Activities Get Stored

### Local Storage

**Location**: `~/.local/share/opencode/storage/`

| Directory | Purpose | Example |
|-----------|---------|---------|
| `activity-template/` | Template definitions | `test-activity-system.json` |
| `activity/` | Activity execution records | `act_abc123.json` |
| `activity-execution/` | Task execution details | `exec_xyz789.json` |
| `impulse-activity/` | Activity-scoped impulses | `impulse_def456.json` |
| `session/` | Session data | `ses_ghi012.json` |

**Check existing templates**:
```bash
ls -lh ~/.local/share/opencode/storage/activity-template/
```

**Count**: Currently 19+ templates stored locally

### Metabob Backend (SurrealDB)

**Endpoint**: http://api.metabob.local/  
**Pod**: metabob-rpc-api-59bff4769b-xmhrc (Running in metabob namespace)  
**Database**: SurrealDB (surrealdb-84f85984d9-lpgpg)  

**Namespaces**:
- `activity_template` - Template definitions
- `activity_execution` - Execution records
- `activity_metrics` - Success rates, costs, tokens

**Check backend status**:
```bash
curl -s http://api.metabob.local/ | jq '.'
# Expected: {"status":"ok","timestamp":"...","version":"0.17.0"}
```

---

## How to Test the System

### Test 1: Create & Register Simple Activity

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Create test template
cat > test-activity-validation.json <<'EOF'
{
  "name": "Activity System Validation",
  "description": "End-to-end validation of activity creation and execution",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "validate",
      "subagent": "general",
      "description": "Validate activity system",
      "dependencies": [],
      "executionMode": "deterministic",
      "toolSequence": [
        {
          "tool": "bash",
          "params": {
            "command": "echo 'Test message: {{message}}' && echo 'Timestamp:' && date && echo 'Success!'",
            "description": "Run validation test"
          }
        }
      ],
      "validation": {
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "maxAttempts": 1,
        "strategy": "simple"
      },
      "metrics": {
        "successRate": 0,
        "avgTokens": 0,
        "avgDuration": 0,
        "commonFailures": []
      }
    }
  ],
  "integration": {
    "preChecks": [],
    "postChecks": [],
    "qualityGates": []
  },
  "metabob": {
    "enabled": false,
    "learningMode": false,
    "targetContextTokens": 0,
    "annotationStrategy": "key-components"
  }
}
EOF
```

From OpenCode session, run:

```typescript
// Register template
register_activity_template({
  file_path: "/home/avi/documents/work/exp-repo/metabob-devbob/test-activity-validation.json",
  register_with_metabob: true
})

// Execute activity
activity({
  templateId: "activity-system-validation",
  variables: {
    message: "Testing end-to-end flow"
  },
  reason: "Validate activity system is working correctly"
})
```

### Test 2: Verify Backend Logging

**Check RPC API logs**:
```bash
kubectl logs -n metabob metabob-rpc-api-59bff4769b-xmhrc --tail=100 | grep -i "activity\|template"
```

**Check SurrealDB data**:
```bash
# Connect to SurrealDB pod
kubectl exec -n metabob surrealdb-84f85984d9-lpgpg -it -- /bin/sh

# Query templates (inside pod)
curl -X POST http://localhost:8000/sql \
  -H "NS: metabob" \
  -H "DB: main" \
  -u "root:root" \
  -d "SELECT * FROM activity_template LIMIT 10;"
```

### Test 3: List Templates from Backend

```typescript
// From OpenCode session
list_activity_templates({
  backend: "metabob"
})
```

Or use search_activities:

```typescript
search_activities({
  category: "infrastructure",
  verbose: true
})
```

### Test 4: Execute Activity and Verify Metrics

```typescript
// Execute activity
const result = activity({
  templateId: "activity-system-validation",
  variables: { message: "Metrics test" },
  reason: "Test metrics tracking"
})

// Check activity storage
// Files should be created in:
// - ~/.local/share/opencode/storage/activity/
// - ~/.local/share/opencode/storage/activity-execution/

// Check backend logs
// kubectl logs -n metabob metabob-rpc-api-59bff4769b-xmhrc --tail=50
```

---

## Troubleshooting

### Issue: No logs in metabob-rpc-api

**Possible Causes**:
1. MCP client not connected
2. Backend registration disabled
3. Network connectivity issue
4. Template not synced to backend

**Debug Steps**:

```typescript
// 1. Check MCP connectivity
test_metabob_mcp({})

// 2. Verify backend connectivity
bash({
  command: "curl -s http://api.metabob.local/ | jq '.'"
})

// 3. Check local template exists
bash({
  command: "ls -l ~/.local/share/opencode/storage/activity-template/ | grep test"
})

// 4. List templates from metabob backend
list_activity_templates({
  backend: "metabob"
})
```

### Issue: Template not found

**Cause**: Template not registered or ID mismatch

**Fix**:
1. Check template ID (generated from name):
   - "Test Activity System" → "test-activity-system"
   - Name is converted to kebab-case

2. Verify registration:
```typescript
list_activity_templates({ backend: "local" })
list_activity_templates({ backend: "metabob" })
```

3. Re-register if needed:
```typescript
register_activity_template({
  file_path: "path/to/template.json",
  register_with_metabob: true
})
```

### Issue: Execution fails with "tool not supported"

**Cause**: Deterministic mode only supports `bash` tool currently

**Fix**: Use bash for all deterministic tasks:
```json
{
  "tool": "bash",
  "params": {
    "command": "cat file.txt",  // Instead of read tool
    "description": "Read file content"
  }
}
```

### Issue: Backend not receiving data

**Debug Checklist**:

1. **Check MCP client**:
```typescript
test_metabob_mcp({})
// Expected: status="connected", tools list includes "metabob_register_activity_template"
```

2. **Check backend pod**:
```bash
kubectl get pods -n metabob | grep metabob-rpc-api
# Expected: 1/1 Running

kubectl logs -n metabob metabob-rpc-api-59bff4769b-xmhrc --tail=20
# Expected: Recent activity logs
```

3. **Check SurrealDB**:
```bash
kubectl get pods -n metabob | grep surrealdb
# Expected: 1/1 Running
```

4. **Check network**:
```bash
curl -s http://api.metabob.local/
# Expected: {"status":"ok",...}
```

5. **Check environment variables**:
```bash
env | grep METABOB_API_KEY
# Expected: METABOB_API_KEY=mb_devbob_test_simple_2026_v2
```

---

## Backend Configuration

### MCP Configuration

The backend communication uses MCP (Model Context Protocol) via `metabob-cli`:

**MCP Client**: metabob-cli (v1.10.0)  
**Location**: `/home/avi/.pyenv/shims/metabob-cli`  
**Tools Available**: 
- metabob_register_activity_template
- metabob_get_activity_template
- metabob_list_activity_templates
- metabob_search_activities
- metabob_post_activity_result

**Check MCP tools**:
```bash
metabob-cli --help
```

### Environment Variables

From `.env.unified`:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
METABOB_API_KEY=mb_devbob_test_simple_2026_v2
SURREAL_NAMESPACE=metabob
API_PORT=8080
DEVBOB_RPC_API_PORT=3101
```

### OpenCode Configuration

From `repos/metabob-opencode/packages/opencode/opencode.json`:
```json
{
  "metabob": {
    "enabled": true,
    "template_auto_registration": {
      "enabled": true,
      "behavior": "best-effort",
      "strategy": "on-create"
    }
  }
}
```

---

## Common Workflows

### Workflow 1: Create + Test + Register

```typescript
// 1. Create template file
write({
  filePath: "/home/avi/documents/work/exp-repo/metabob-devbob/my-activity.json",
  content: JSON.stringify({
    name: "My Activity",
    description: "Custom activity",
    category: "infrastructure",
    tasks: [
      {
        id: "task-1",
        subagent: "general",
        description: "Run custom task",
        dependencies: [],
        executionMode: "deterministic",
        toolSequence: [
          {
            tool: "bash",
            params: {
              command: "echo 'Custom activity running'",
              description: "Custom command"
            }
          }
        ],
        validation: { requiredFiles: [], requiredPatterns: [], forbiddenPatterns: [], commands: [] },
        retry: { maxAttempts: 1, strategy: "simple" },
        metrics: { successRate: 0, avgTokens: 0, avgDuration: 0, commonFailures: [] }
      }
    ],
    integration: { preChecks: [], postChecks: [], qualityGates: [] },
    metabob: { enabled: false, learningMode: false, targetContextTokens: 0, annotationStrategy: "key-components" }
  }, null, 2)
})

// 2. Register with validation
register_activity_template({
  file_path: "/home/avi/documents/work/exp-repo/metabob-devbob/my-activity.json",
  register_with_metabob: true,
  validate_before_register: true,
  test_variables: {}
})

// 3. If validation passed, template is ready to use
activity({
  templateId: "my-activity",
  variables: {},
  reason: "Testing custom activity"
})
```

### Workflow 2: Update Existing Activity

```typescript
// 1. Get current template
const templates = list_activity_templates({ backend: "local" })
const myTemplate = templates.find(t => t.id === "my-activity")

// 2. Modify template (edit tasks, add variables, etc.)
// ... modify myTemplate object ...

// 3. Save to file
write({
  filePath: "/home/avi/documents/work/exp-repo/metabob-devbob/my-activity-v2.json",
  content: JSON.stringify(myTemplate, null, 2)
})

// 4. Re-register (overwrites previous version)
register_activity_template({
  file_path: "/home/avi/documents/work/exp-repo/metabob-devbob/my-activity-v2.json",
  register_with_metabob: true
})
```

### Workflow 3: Debug Activity Execution

```typescript
// 1. Execute activity
const result = activity({
  templateId: "my-activity",
  variables: {},
  reason: "Debug execution"
})

// 2. Check execution logs
bash({
  command: "ls -lt ~/.local/share/opencode/storage/activity/ | head -5"
})

// 3. Read activity execution file
bash({
  command: "cat ~/.local/share/opencode/storage/activity/act_*.json | jq '.'"
})

// 4. Check backend logs
bash({
  command: "kubectl logs -n metabob metabob-rpc-api-59bff4769b-xmhrc --tail=50"
})
```

---

## Success Criteria

✅ **Activity created**: Template JSON file exists
✅ **Activity registered locally**: File in `~/.local/share/opencode/storage/activity-template/`
✅ **Activity registered to backend**: Visible via `list_activity_templates({ backend: "metabob" })`
✅ **Activity executable**: `activity()` tool runs without errors
✅ **Execution tracked locally**: Files created in `~/.local/share/opencode/storage/activity/`
✅ **Execution logged to backend**: Logs visible in `kubectl logs -n metabob metabob-rpc-api-...`
✅ **Metrics updated**: Backend contains execution metrics (success rate, cost, tokens)

---

## Next Steps

1. **Create validation activity** (see Test 1 above)
2. **Execute and verify logs** (check both local and backend)
3. **Test with variables** (use `{{variableName}}` interpolation)
4. **Test mixed-mode** (deterministic + LLM-assisted tasks)
5. **Create production templates** (build, deploy, validate workflows)

---

**Reference Files**:
- Schema: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
- Registration Tool: `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts`
- Execution Tool: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
- Template Repository: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`
- Template Loader: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`
- Backend Client: `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts`
