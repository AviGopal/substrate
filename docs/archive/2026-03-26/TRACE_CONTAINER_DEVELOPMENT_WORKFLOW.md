# Trace: Container Development Workflow and Non-LLM Activity Execution

**Specification**: Enable systematic workflow for container-based development where code changes in repos/* can be built, deployed to kubernetes, and validated. Extend activity system to support non-LLM execution modes where activities function as generic, reusable functions.

**Trace Date**: 2026-03-08
**Status**: CURRENT STATE DOCUMENTED - IMPLEMENTATION REQUIRED

---

## Executive Summary

### Current State
The activity system **requires LLM invocation for ALL task executions**. Every activity task flows through `SessionPrompt.prompt()` which generates LLM inference, making activities unsuitable for:
- CI/CD pipelines (cost, speed, determinism)
- Automated validation harnesses (predictability)
- Build-deploy workflows (operational tasks)

### Desired State
Activities support **dual execution modes**:
1. **LLM-assisted mode**: Creative tasks (code generation, debugging, refactoring)
2. **Deterministic mode**: Operational tasks (build, deploy, validate) with direct tool execution

---

## Architecture Analysis

### Current Execution Flow
```
User Request
  ↓
CLI: opencode activity execute <template-id>
  ↓
activity tool (src/tool/activity.ts)
  ↓
executeTemplate() (line 2050)
  ↓
TaskTool.execute() (src/tool/task.ts line 37)
  ↓
SessionPrompt.prompt() (task.ts line 300) ← **LLM INVOCATION**
  ↓
LLM API (Claude, GPT, etc.)
  ↓
Tool execution based on LLM response
  ↓
Result
```

**Key Bottleneck**: `SessionPrompt.prompt()` at `task.ts:300` always invokes LLM.

### Desired Execution Flow

**LLM-Assisted Mode** (unchanged):
```
User → CLI → activity tool → executeTemplate → TaskTool → SessionPrompt.prompt → LLM → tools → result
```

**Deterministic Mode** (new):
```
User → CLI (--mode deterministic)
  ↓
TemplateExecutor.execute()
  ↓
executeTemplate() [detects deterministic tasks]
  ↓
executeTaskDeterministic() [NEW FUNCTION]
  ↓
Direct tool calls (bash, docker, kubectl)
  ↓
Result (no LLM inference)
```

---

## Component Gap Analysis

### 1. Activity Template Schema
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

**Current**:
```typescript
interface Task {
  id: string
  description: string
  prompt: {
    template: string  // Always used for LLM generation
  }
  // ...
}
```

**Desired**:
```typescript
interface Task {
  id: string
  description: string
  executionMode: "llm-assisted" | "deterministic"  // NEW
  
  // Option 1: LLM-assisted
  prompt?: {
    template: string
  }
  
  // Option 2: Deterministic
  toolSequence?: Array<{
    tool: string
    params: Record<string, any>
  }>
}
```

**Gap**: Need `executionMode` and `toolSequence` fields.

---

### 2. executeTemplate Function
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
**Lines**: 2050-2800

**Current Behavior**:
- Always delegates to `TaskTool.execute()` which invokes LLM
- No branching based on execution mode

**Desired Behavior**:
```typescript
async function executeTemplate(...) {
  for (const task of tasks) {
    if (task.executionMode === "deterministic") {
      // NEW: Direct tool execution
      await executeTaskDeterministic(task, variables)
    } else {
      // EXISTING: LLM-assisted execution
      await TaskTool.execute(...)
    }
  }
}
```

**Gap**: Need `executeTaskDeterministic()` function.

---

### 3. TaskTool
**File**: `repos/metabob-opencode/packages/opencode/src/tool/task.ts`
**Line**: 300 (LLM invocation)

**Current**:
```typescript
const result = await SessionPrompt.prompt({
  messageID,
  sessionID,
  model,
  agent: agent.name,
  tools: agent.tools,
  parts: promptParts,
})
```

**This is the bottleneck** - always calls LLM.

**Desired**: Bypass for deterministic tasks.

---

### 4. CLI Command
**File**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/activity.ts`
**Lines**: 1576-1670

**Current**:
```bash
opencode activity execute <template-id> --variables '{"key":"value"}'
```

**Desired**:
```bash
opencode activity execute <template-id> --mode deterministic --variables '{"key":"value"}'
```

**Gap**: Need `--mode` flag.

---

### 5. Template Executor
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`
**Lines**: 67-153

**Current**: No execution mode parameter.

**Desired**:
```typescript
export const ExecutionOptions = z.object({
  templateId: z.string(),
  variables: z.record(z.string(), z.unknown()),
  mode: z.enum(["llm", "deterministic"]).optional().default("llm"),  // NEW
  // ...
})
```

**Gap**: Add `mode` field.

---

### 6. Container Deployment Script
**File**: `build-and-deploy-devbob-k8s.sh`

**Current**: Manual bash script with hardcoded commands.

**Desired**: Convert to activity template:
```json
{
  "id": "build-and-deploy-container",
  "name": "Build and Deploy Container to Kubernetes",
  "tasks": [
    {
      "id": "build-image",
      "executionMode": "deterministic",
      "toolSequence": [
        {
          "tool": "bash",
          "params": {
            "command": "cd {{repoPath}} && npm run build",
            "description": "Build TypeScript"
          }
        },
        {
          "tool": "bash",
          "params": {
            "command": "docker build -t {{imageName}}:{{tag}} -f {{dockerfile}} .",
            "description": "Build Docker image"
          }
        },
        {
          "tool": "bash",
          "params": {
            "command": "kubectl set image deployment/{{deploymentName}} -n {{namespace}} {{containerName}}={{imageName}}:{{tag}}",
            "description": "Update Kubernetes deployment"
          }
        }
      ]
    },
    {
      "id": "validate-deployment",
      "executionMode": "deterministic",
      "toolSequence": [
        {
          "tool": "bash",
          "params": {
            "command": "kubectl rollout status deployment/{{deploymentName}} -n {{namespace}} --timeout=5m",
            "description": "Wait for rollout"
          }
        }
      ]
    }
  ]
}
```

---

### 7. Validation Harnesses
**File**: `tests/validation-harnesses/*`

**Current**:
```typescript
// Harnesses execute activities via kubectl exec
const result = await exec(`kubectl exec devbob-0 -- opencode activity execute ${templateId}`)
// This ALWAYS uses LLM (slow, expensive, unpredictable)
```

**Desired**:
```typescript
import { executeActivityDeterministic } from "@opencode/activity"

const result = await executeActivityDeterministic(templateId, variables)
// Fast (<5s), free, deterministic
```

**Gap**: Need exported `executeActivityDeterministic()` function.

---

## Implementation Roadmap

### Phase 1: Schema Extensions
**Duration**: 1-2 days

1. Add `executionMode` to `ActivityTemplate.Task`
2. Add `toolSequence` to `ActivityTemplate.Task`
3. Add `mode` to `TemplateExecutor.ExecutionOptions`
4. Update Zod schemas and validation

**Files**:
- `src/session/activity-template.ts`
- `src/session/template-executor.ts`

---

### Phase 2: Deterministic Executor
**Duration**: 2-3 days

1. Create `executeTaskDeterministic()` function in `activity.ts`
   - Parse `task.toolSequence`
   - Interpolate variables in tool params
   - Execute tools directly (bypass LLM)
   - Collect results and metrics

2. Update `executeTemplate()` to branch on `task.executionMode`

3. Add unit tests for deterministic execution

**Files**:
- `src/tool/activity.ts`
- `test/tool/activity-deterministic.test.ts` (new)

**Example Implementation**:
```typescript
async function executeTaskDeterministic(
  task: ActivityTemplate.Task,
  variables: Record<string, unknown>,
  sessionID: string
): Promise<TaskResult> {
  if (!task.toolSequence) {
    throw new Error(`Task ${task.id} has no toolSequence for deterministic execution`)
  }
  
  const results = []
  for (const toolCall of task.toolSequence) {
    // Interpolate variables in params
    const params = interpolateParams(toolCall.params, variables)
    
    // Execute tool directly (no LLM)
    const tool = await Tool.get(toolCall.tool)
    const result = await tool.execute(params, {
      sessionID,
      messageID: "deterministic",
      abort: new AbortController().signal
    })
    
    results.push(result)
  }
  
  return {
    success: true,
    results,
    tokens: { input: 0, output: 0, cache: 0 },  // No LLM tokens
    cost: 0  // No LLM cost
  }
}
```

---

### Phase 3: CLI and API Integration
**Duration**: 2-3 days

1. Add `--mode` flag to `opencode activity execute` command
2. Export `executeActivityDeterministic()` for external use
3. Update activity API endpoint to accept `execution_mode` parameter

**Files**:
- `src/cli/cmd/activity.ts`
- `src/tool/activity.ts` (export)
- `src/api/activity-endpoint.ts`

**CLI Usage**:
```bash
# LLM-assisted (default)
opencode activity execute my-template --variables '{"x": 1}'

# Deterministic
opencode activity execute my-template --mode deterministic --variables '{"x": 1}'
```

**API Usage**:
```bash
curl -X POST /api/activities/execute \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "build-container",
    "execution_mode": "deterministic",
    "variables": {"imageName": "my-app", "tag": "v1.0"}
  }'
```

---

### Phase 4: Container Workflow Templates
**Duration**: 2-3 days

1. Create `build-container` template (deterministic)
2. Create `deploy-helm-release` template (deterministic)
3. Create `build-deploy-validate` workflow template (mixed modes)
4. Convert `build-and-deploy-devbob-k8s.sh` to template
5. Update validation harnesses to use deterministic mode

**Files**:
- `templates/container/build-container.json` (new)
- `templates/container/deploy-helm-release.json` (new)
- `templates/workflows/build-deploy-validate.json` (new)
- `tests/validation-harnesses/*.ts` (update)

---

## Validation Criteria

### Test 1: Pure Deterministic Execution
**Command**:
```bash
opencode activity execute build-container --mode deterministic \
  --variables '{"imageName": "test-app", "tag": "v1.0", "contextPath": "."}'
```

**Expected**:
- ✅ No LLM API calls (verify via network logs)
- ✅ Direct docker build execution
- ✅ Execution time < 60s
- ✅ Cost = $0.00

---

### Test 2: LLM-Assisted Mode (Unchanged)
**Command**:
```bash
opencode activity execute build-container --mode llm \
  --variables '{"imageName": "test-app", "tag": "v1.0"}'
```

**Expected**:
- ✅ LLM generates docker commands
- ✅ Agent can adapt commands based on context
- ✅ Execution uses LLM tokens
- ✅ Cost > $0.00

---

### Test 3: Validation Harness Integration
**Code**:
```typescript
import { executeActivityDeterministic } from "@opencode/activity"

const result = await executeActivityDeterministic("build-container", {
  imageName: "test-app",
  tag: "v1.0"
})

expect(result.success).toBe(true)
expect(result.cost).toBe(0)
expect(result.duration).toBeLessThan(5000)  // < 5 seconds
```

**Expected**:
- ✅ Harness completes in < 5 seconds
- ✅ Deterministic results (same input → same output)
- ✅ No flaky tests due to LLM variance

---

### Test 4: CI/CD Pipeline
**GitHub Actions**:
```yaml
- name: Build and deploy
  run: |
    opencode activity execute build-deploy-validate \
      --mode deterministic \
      --variables '{"env": "staging", "version": "${{ github.sha }}"}'
```

**Expected**:
- ✅ Pipeline runs without LLM API keys
- ✅ Consistent execution time
- ✅ Deterministic results (reproducible builds)

---

### Test 5: Mixed Mode Template
**Template**:
```json
{
  "tasks": [
    {
      "id": "build",
      "executionMode": "deterministic",
      "toolSequence": [...]
    },
    {
      "id": "analyze-quality",
      "executionMode": "llm-assisted",
      "prompt": {"template": "Analyze build output for issues"}
    }
  ]
}
```

**Expected**:
- ✅ Build runs deterministically (fast, no LLM)
- ✅ Analysis uses LLM (creative, adaptive)
- ✅ Total cost = LLM analysis only (not build)

---

## Example Templates

### 1. Deterministic: Build Container
```json
{
  "id": "build-container",
  "name": "Build Docker Container",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "build-image",
      "description": "Build Docker image",
      "executionMode": "deterministic",
      "toolSequence": [
        {
          "tool": "bash",
          "params": {
            "command": "docker build -t {{imageName}}:{{tag}} {{contextPath}}",
            "description": "Build Docker image"
          }
        },
        {
          "tool": "bash",
          "params": {
            "command": "docker push {{imageName}}:{{tag}}",
            "description": "Push image to registry"
          }
        }
      ],
      "validation": {
        "postChecks": {
          "commands": [
            "docker images | grep {{imageName}}:{{tag}}"
          ]
        }
      }
    }
  ]
}
```

---

### 2. LLM-Assisted: Analyze Build Failures
```json
{
  "id": "analyze-build-failures",
  "name": "Analyze Build Failure Logs",
  "category": "bugfix",
  "tasks": [
    {
      "id": "analyze-logs",
      "description": "Analyze build logs and suggest fixes",
      "executionMode": "llm-assisted",
      "subagent": "general",
      "prompt": {
        "template": "Analyze the following build failure logs and suggest specific fixes:\n\n{{buildLogs}}\n\nRepository: {{repoPath}}"
      }
    }
  ]
}
```

---

### 3. Mixed: Build-Deploy-Validate Workflow
```json
{
  "id": "build-deploy-validate",
  "name": "Build, Deploy, and Validate Application",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "build",
      "description": "Build application",
      "executionMode": "deterministic",
      "toolSequence": [
        {
          "tool": "bash",
          "params": {
            "command": "npm run build",
            "description": "Build TypeScript"
          }
        }
      ]
    },
    {
      "id": "deploy",
      "description": "Deploy to Kubernetes",
      "executionMode": "deterministic",
      "dependencies": ["build"],
      "toolSequence": [
        {
          "tool": "bash",
          "params": {
            "command": "kubectl apply -f {{manifestPath}}",
            "description": "Apply Kubernetes manifests"
          }
        },
        {
          "tool": "bash",
          "params": {
            "command": "kubectl rollout status deployment/{{deploymentName}} -n {{namespace}}",
            "description": "Wait for rollout"
          }
        }
      ]
    },
    {
      "id": "validate-quality",
      "description": "Validate deployment quality",
      "executionMode": "llm-assisted",
      "dependencies": ["deploy"],
      "subagent": "general",
      "prompt": {
        "template": "Review the deployment logs and health checks for issues:\n\n{{deploymentLogs}}"
      }
    }
  ]
}
```

---

## Benefits

### For Development Workflow
- **Fast iteration**: Build-deploy cycles without LLM overhead
- **Deterministic**: Same input → same output (no LLM variance)
- **Composable**: Mix deterministic (build) + LLM (analysis) tasks

### For CI/CD
- **No API keys needed**: Deterministic tasks don't require LLM access
- **Predictable cost**: Only LLM tasks incur cost
- **Consistent timing**: No LLM latency for operational tasks

### For Validation Harnesses
- **Fast execution**: < 5s instead of 30-60s with LLM
- **Reliable**: No flaky tests due to LLM variance
- **Offline**: Can run without internet/API access

### For Activity System
- **Reusable functions**: Activities become generic building blocks
- **Better separation**: Creative (LLM) vs operational (deterministic)
- **Learning**: Can learn from deterministic task patterns

---

## Related Specifications

- **Activity Lifecycle E2E Validation**: Validates complete activity execution flow
- **DevBob K8s Git Operations**: Validates container git workflows
- **Activity Execution Recording**: Tracks activity execution for learning
- **Template Storage Architecture**: Backend storage for activity templates

---

## Impulse Reference

**Impulse ID**: `trace-Container Development Workflow and Non-LLM Activity Execution`
**Type**: `templateDefinition`
**Budget**: 5000 tokens
**Priority**: high

This trace analysis is stored as an impulse for downstream validation and enforcement tasks.

---

## Next Steps

1. **Review and approve** this trace analysis
2. **Create implementation issues** for each phase
3. **Assign engineers** to implementation work
4. **Create validation harness** for testing deterministic execution
5. **Update documentation** with new execution modes

---

## Conclusion

The current activity system is **LLM-only**, making it unsuitable for operational workflows like container build-deploy. By adding **deterministic execution mode**, we enable:

- Activities as **reusable functions** (not just LLM workflows)
- **Fast, predictable** CI/CD integration
- **Cost-effective** validation harnesses
- **Mixed-mode** templates (deterministic + LLM)

This transforms activities from "one-off LLM tasks" to "composable, reusable workflow building blocks".
