# Closed-Loop Development Plan: Code as Activity

**Date**: 2026-03-22
**Goal**: Close the Instructional → Transient → Functional → Instructional loop using existing idioms

---

## The Problem

MiniBob executes goals and writes code, but that code never becomes deployed. The three-state loop is broken:

```
INSTRUCTIONAL          TRANSIENT              FUNCTIONAL
(Git repos,     →     (MiniBob         →     (Code in           →  ???
 Docker images)        executing)              /workspace)
```

The Functional State (new code) never becomes the new Instructional State (deployed code).

---

## The Solution: Code Changes ARE Activities

We already have all the patterns needed. The insight is that **code development is an activity** with:
- Tasks (understand, implement, validate, commit)
- Validation (typecheck, tests, CI)
- Execution traces (file changes, tool calls)
- Metrics (build time, test coverage, deployment success)
- Thompson Sampling (which code variant performs better?)
- Ribosome (successful patterns become templates)

---

## Architecture: Reusing Existing Idioms

### 1. Repository as Workspace (Mount, Don't Copy)

**Current**: MiniBob writes to `/workspace` (isolated, ephemeral)
**New**: MiniBob writes to `/repos/<repo-name>` (mounted git repositories)

**Implementation**:
```yaml
# helm/charts/devbob/templates/deployment.yaml
volumes:
  - name: repos
    persistentVolumeClaim:
      claimName: minibob-repos-pvc  # Shared across all MiniBob pods

volumeMounts:
  - name: repos
    mountPath: /repos

# Init container clones repos on first boot
initContainers:
  - name: git-clone
    image: alpine/git
    command: ["/bin/sh", "-c"]
    args:
      - |
        cd /repos
        [ -d activity-dashboard ] || git clone $REPO_URL_DASHBOARD activity-dashboard
        [ -d minibob ] || git clone $REPO_URL_MINIBOB minibob
        [ -d metabob-activity-api ] || git clone $REPO_URL_API metabob-activity-api
```

**Idiom Reused**: Vessel bootstrapping via init containers (existing pattern)

---

### 2. Git Credentials as Impulse (Secure, Lazy-Loaded)

**Current**: No git credentials
**New**: Git credentials as a `secret` impulse type

**Implementation**:
```typescript
// New impulse pointer type: "secret"
{
  id: "git-credentials",
  pointer: {
    type: "secret",
    secretName: "minibob-git-credentials",
    key: "ssh-key"
  },
  budget: 0,  // Never included in LLM context
  priority: "critical"
}

// ImpulseResolver handles secret type
async resolveSecretPointer(pointer: SecretPointer): Promise<string> {
  // Write to ~/.ssh/id_rsa, return path (not content)
  const secretPath = await this.writeSecretToFile(pointer)
  return `[Secret written to ${secretPath}]`
}
```

**Idiom Reused**: Impulse pointer system (flexible, backend-extensible)

---

### 3. Code Change as Activity Template

**Current**: Ad-hoc code writing
**New**: Structured "code-change" activity with standard tasks

**Template Structure**:
```json
{
  "id": "code-change-template",
  "name": "Code Change Activity",
  "category": "feature",
  "tasks": [
    {
      "id": "task-1-branch",
      "description": "Create feature branch from main",
      "prompt": {
        "template": "Create git branch '{{branchName}}' from main in {{repoPath}}"
      },
      "validation": {
        "commands": ["git -C {{repoPath}} branch --list {{branchName}}"]
      }
    },
    {
      "id": "task-2-implement",
      "description": "Implement the code change",
      "prompt": {
        "template": "{{goalDescription}}\n\nWork in {{repoPath}} on branch {{branchName}}"
      },
      "impulseReferences": ["goal-context", "existing-code"],
      "validation": {
        "commands": ["cd {{repoPath}} && bun run typecheck"]
      }
    },
    {
      "id": "task-3-test",
      "description": "Run tests to validate change",
      "prompt": {
        "template": "Run tests in {{repoPath}} to verify the implementation"
      },
      "validation": {
        "commands": ["cd {{repoPath}} && bun test"]
      }
    },
    {
      "id": "task-4-commit",
      "description": "Commit changes to branch",
      "prompt": {
        "template": "Commit all changes with descriptive message"
      },
      "validation": {
        "commands": ["git -C {{repoPath}} log -1 --oneline"]
      }
    },
    {
      "id": "task-5-push",
      "description": "Push branch to remote",
      "prompt": {
        "template": "Push branch {{branchName}} to origin"
      },
      "validation": {
        "commands": ["git -C {{repoPath}} ls-remote origin {{branchName}}"]
      }
    }
  ],
  "variables": [
    {"name": "repoPath", "type": "string", "required": true},
    {"name": "branchName", "type": "string", "required": true},
    {"name": "goalDescription", "type": "string", "required": true}
  ],
  "contextRequirements": [
    {
      "id": "existing-code",
      "type": "glob",
      "source": "{{repoPath}}/src/**/*.ts",
      "budget": 8000,
      "priority": "high"
    }
  ]
}
```

**Idiom Reused**: Activity templates with tasks, validation, impulses

---

### 4. CI/CD as Validation Commands

**Current**: Validation runs inside MiniBob container
**New**: CI/CD webhooks report back to activity system

**Flow**:
```
MiniBob pushes branch
       ↓
CI/CD webhook triggered (GitHub Actions / GitLab CI)
       ↓
Build + Test runs
       ↓
Webhook reports result to metabob-activity-api
       ↓
POST /v2/activities/ci-result
{
  "branch": "feature/dashboard-execution-history",
  "commit": "abc123",
  "success": true,
  "duration_ms": 45000,
  "artifacts": {
    "image": "minibob:abc123",
    "coverage": 0.82
  }
}
       ↓
Backend updates execution trace
       ↓
Thompson Sampling updated
```

**Implementation** (new endpoint):
```typescript
// repos/metabob-activity-api/src/routes/ci.ts
app.post("/v2/activities/ci-result", async (c) => {
  const body = await c.req.json()

  // Find execution that pushed this branch
  const execution = await findExecutionByBranch(body.branch)

  // Update execution status based on CI result
  await updateExecutionStatus(execution.id, {
    ciStatus: body.success ? "passed" : "failed",
    ciDuration: body.duration_ms,
    artifacts: body.artifacts
  })

  // Report to Thompson Sampling
  await recordExecution({
    variant_id: execution.templateId,
    success: body.success,
    duration_ms: body.duration_ms,
    metadata: { phase: "ci", artifacts: body.artifacts }
  })

  // If CI passed, trigger staging deployment
  if (body.success) {
    await enqueueStagingDeployment(body.artifacts.image, execution.id)
  }
})
```

**Idiom Reused**: Validation commands (now external via webhook)

---

### 5. Staging Deployment as Activity

**Current**: No staging
**New**: Staging deployment is an activity with its own metrics

**Template**:
```json
{
  "id": "staging-deployment",
  "name": "Deploy to Staging",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "task-1-deploy",
      "description": "Deploy image to staging namespace",
      "prompt": {
        "template": "Deploy {{imageName}} to staging namespace using kubectl"
      },
      "validation": {
        "commands": ["kubectl get pods -n staging -l app={{appName}} -o jsonpath='{.items[0].status.phase}'"]
      }
    },
    {
      "id": "task-2-health",
      "description": "Wait for health check",
      "prompt": {
        "template": "Verify {{appName}} is healthy in staging"
      },
      "validation": {
        "commands": ["curl -s http://{{appName}}.staging.svc.cluster.local/health | jq -e '.status == \"ok\"'"]
      }
    }
  ]
}
```

**Idiom Reused**: Activity templates for infrastructure

---

### 6. Metrics Collection in Staging (Thompson Sampling for Code)

**Current**: Thompson Sampling for activity templates only
**New**: Thompson Sampling for code variants (branches)

**Schema Extension**:
```typescript
// repos/metabob-activity-api/src/models/schemas.ts
export const CodeVariantMetricsSchema = z.object({
  variant_id: z.string(),      // e.g., "dashboard:feature/exec-history"
  repo: z.string(),            // e.g., "activity-dashboard"
  branch: z.string(),          // e.g., "feature/exec-history"
  base_branch: z.string(),     // e.g., "main"

  // Metrics from staging
  staging_deployments: z.number(),
  staging_successes: z.number(),
  staging_failures: z.number(),
  staging_error_rate: z.number(),
  staging_avg_latency_ms: z.number(),

  // Thompson Sampling
  thompson_alpha: z.number(),  // Successes + prior
  thompson_beta: z.number(),   // Failures + prior

  // Promotion status
  promoted_to_production: z.boolean(),
  promoted_at: z.string().optional(),
})
```

**Metrics Collection**:
```typescript
// Scheduled job collects staging metrics
async function collectStagingMetrics() {
  const variants = await getActiveCodeVariants()

  for (const variant of variants) {
    const metrics = await queryPrometheus({
      query: `rate(http_requests_total{app="${variant.appName}",namespace="staging"}[5m])`,
    })

    const errorRate = await queryPrometheus({
      query: `rate(http_errors_total{app="${variant.appName}",namespace="staging"}[5m])`,
    })

    // Update Thompson Sampling based on error rate
    const success = errorRate < 0.01  // <1% error rate = success
    await updateCodeVariantMetrics(variant.id, {
      thompson_alpha: success ? variant.thompson_alpha + 1 : variant.thompson_alpha,
      thompson_beta: success ? variant.thompson_beta : variant.thompson_beta + 1,
    })
  }
}
```

**Idiom Reused**: Thompson Sampling, metrics collection

---

### 7. Promotion Gate (Functional → Instructional)

**Current**: No promotion
**New**: Thompson Sampling decides when to promote

**Promotion Logic**:
```typescript
async function evaluatePromotion() {
  const variants = await getCodeVariantsInStaging()

  for (const variant of variants) {
    // Sample from Beta distribution
    const score = sampleBeta(variant.thompson_alpha, variant.thompson_beta)

    // Compare against main branch baseline
    const mainScore = sampleBeta(
      variant.main_thompson_alpha,
      variant.main_thompson_beta
    )

    // Promote if consistently better (with confidence)
    if (
      score > mainScore &&
      variant.staging_deployments >= 10 &&  // Minimum sample size
      variant.thompson_alpha / (variant.thompson_alpha + variant.thompson_beta) > 0.8
    ) {
      await promoteToProduction(variant)
    }

    // Reject if consistently worse
    if (
      variant.staging_deployments >= 10 &&
      variant.thompson_alpha / (variant.thompson_alpha + variant.thompson_beta) < 0.3
    ) {
      await rejectVariant(variant)
    }
  }
}

async function promoteToProduction(variant: CodeVariant) {
  // Merge branch to main
  await git.merge(variant.branch, "main", variant.repo)

  // Build production image
  await triggerCI(variant.repo, "main", "production")

  // Update metrics
  await markAsPromoted(variant.id)

  // Create success impulse for learning
  await createImpulse({
    id: `promoted-${variant.id}`,
    pointer: {
      type: "codeChangeTrace",
      variantId: variant.id,
      outcome: "promoted"
    },
    budget: 4000,
    priority: "high"
  })
}
```

**Idiom Reused**: Thompson Sampling for selection, Impulses for learning

---

### 8. Ribosome for Code Patterns

**Current**: Ribosome creates activity templates
**New**: Ribosome also extracts code change patterns

**Pattern Extraction**:
```typescript
// After successful code change + promotion
function extractCodeChangePattern(execution: ActivityExecution): CodeChangeTemplate {
  const trace = execution.executionTrace

  return {
    id: `code-pattern-${Date.now()}`,
    name: inferPatternName(trace),

    // What files were touched?
    filePatterns: extractFilePatterns(trace.tasks),

    // What tools were used?
    toolSequence: extractToolSequence(trace.tasks),

    // What validation worked?
    validationCommands: extractValidation(trace.tasks),

    // Goal → Implementation mapping
    goalMapping: {
      goalKeywords: extractKeywords(execution.goalContext?.goal),
      implementationSteps: trace.tasks.map(t => t.description)
    },

    metadata: {
      sourceExecutionId: execution.id,
      sourceRepo: extractRepo(trace),
      successRate: 1.0,  // Promoted = successful
      generatedBy: "ribosome"
    }
  }
}
```

**Idiom Reused**: Ribosome pattern (activities that create patterns)

---

## Implementation Phases

### Phase 1: Repository Access (Foundation)
- [ ] Create PVC for repos
- [ ] Add init container for git clone
- [ ] Mount repos in MiniBob pods
- [ ] Add git credentials secret
- [ ] Test git operations from MiniBob

### Phase 2: Code Change Activity (Structure)
- [ ] Create code-change activity template
- [ ] Add branch-based workflow tasks
- [ ] Implement validation commands for typecheck/test
- [ ] Test end-to-end code change via activity

### Phase 3: CI/CD Integration (Validation)
- [ ] Add `/v2/activities/ci-result` endpoint
- [ ] Create GitHub Actions workflow with webhook
- [ ] Connect CI results to execution traces
- [ ] Update Thompson Sampling on CI completion

### Phase 4: Staging Deployment (Evaluation)
- [ ] Create staging namespace with Istio
- [ ] Add staging-deployment activity template
- [ ] Implement metrics collection from staging
- [ ] Add code variant metrics schema

### Phase 5: Promotion Gate (Loop Closure)
- [ ] Implement Thompson Sampling for code variants
- [ ] Add promotion evaluation job
- [ ] Create merge-to-main automation
- [ ] Add rejection handling (close PR, notify)

### Phase 6: Dashboard Visibility (Observability)
- [ ] Add code variant view to dashboard
- [ ] Show staging vs production metrics
- [ ] Visualize promotion pipeline
- [ ] Display code genealogy (which execution produced which code)

---

## Mapping to Three-State Model

| State | Artifact | Mechanism |
|-------|----------|-----------|
| **Instructional** | Git repos (main branch), Docker images, Activity templates | Stored in Git, Registry, SurrealDB |
| **Transient** | MiniBob executing code-change activity | Activity executor with state capture |
| **Functional** | Code in feature branch, staging deployment | Git branch, K8s staging namespace |
| **Loop Back** | Promotion via Thompson Sampling | Metrics-driven merge to main |

---

## Key Insight: Everything is an Activity

The existing system already has:
- ✅ Structured execution (tasks, validation)
- ✅ State capture (before/after file hashes)
- ✅ Metrics collection (duration, cost, success)
- ✅ Learning (Thompson Sampling, impulse relevance)
- ✅ Self-improvement (Ribosome pattern)

We just need to apply these to **code changes** instead of just **activity templates**.

The code change becomes the activity. The staging deployment becomes validation. The promotion gate becomes Thompson Sampling. The merged code becomes the new Instructional State.

**The loop closes.**
