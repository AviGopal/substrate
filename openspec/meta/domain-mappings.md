# Domain Mappings

**Status:** DESIGN DOCUMENT (demonstrates ideogram universality)
**Last Updated:** 2026-03-23

## Overview

This document maps the six core ideograms (Vessel, Becoming, Instance, Impulse, Improvisation, Goal-Seeking) across five operational domains. Each domain uses the same substrate (MiniBob core) but differs in tools, impulses, and activity patterns.

**Key Insight:** The process-of-becoming is domain-agnostic. The substrate remains constant; only the tools and impulses change.

## The Five Domains

1. **Software Development** - LLM + tools transforming codebase
2. **Analysis & Understanding** - LLM + CPG analyzing code
3. **Deployment & Infrastructure** - LLM + kubectl orchestrating cluster
4. **Learning & Optimization** - LLM analyzing traces, creating variants
5. **Validation & Compliance** - LLM comparing runtime vs specification

---

## Domain 1: Software Development

**Purpose:** Transform codebase through feature addition, bug fixing, refactoring.

### Ideogram Mapping

**VESSEL (Instructional State):**
- Activity templates (`add-feature.json`, `fix-bug.json`, `refactor-code.json`)
- Docker images (development environment)
- Git branches (code versions)
- TypeScript/JavaScript files (before modification)

**BECOMING (Transient State):**
- Activity executing (LLM reading files, generating code, running tests)
- Git merge in progress
- LLM token streaming (generating solution)
- File being edited (lines changing)

**INSTANCE (Functional State):**
- Modified files committed to git
- Tests passing/failing
- Build artifacts created
- Git commit SHA

**IMPULSE (Context Injection):**
- `file`: Source code to read/modify
- `activityExecutionTrace`: Previous development attempts
- `activityMetrics`: Success rates of development patterns
- `memo`: Developer notes or requirements

**IMPROVISATION (Adaptive Creation):**
- Activity fails → create variant with adjusted approach
- New pattern emerges → extract template (ribosome)
- Test failure → generate new debugging strategy

**GOAL-SEEKING (Adaptive Path):**
- "Add user authentication" → execute `implement-auth-flow` → verify login works
- "Fix memory leak" → execute `debug-memory-issue` → verify heap stable
- Adjust strategy based on test results

### Tools Used

```typescript
// Built-in tools
bash      // Run commands, execute tests
read      // Load source files
write     // Create new files
edit      // Modify existing files
git       // Version control operations

// MCP tools (future)
cpg_build       // Build code property graph
embedding_search // Semantic code search
```

### Example Activities

**Feature Addition:**
```json
{
  "id": "implement-user-auth",
  "category": "feature",
  "tasks": [
    {
      "id": "create-user-model",
      "prompt": {
        "template": "Create User model with password hashing in {{modelFile}}",
        "variables": [{"name": "modelFile", "type": "string"}]
      },
      "validation": {
        "requiredFiles": ["src/models/user.ts"],
        "requiredPatterns": ["bcrypt", "hashPassword"]
      }
    },
    {
      "id": "implement-login-endpoint",
      "prompt": {
        "template": "Create POST /login endpoint in {{apiFile}}",
        "variables": [{"name": "apiFile", "type": "string"}]
      }
    }
  ]
}
```

**Bug Fixing:**
```json
{
  "id": "fix-null-pointer",
  "category": "bugfix",
  "tasks": [
    {
      "id": "locate-error",
      "prompt": {
        "template": "Find where null pointer exception occurs in {{errorLog}}",
        "variables": [{"name": "errorLog", "type": "string"}]
      }
    },
    {
      "id": "add-null-check",
      "prompt": {
        "template": "Add null safety checks to prevent error"
      }
    }
  ]
}
```

### Learning Captured

- Which file modification patterns succeed most often
- Tool call sequences that lead to passing tests
- Cost/duration per feature type
- Error patterns and recovery strategies

---

## Domain 2: Analysis & Understanding

**Purpose:** Extract insights from codebases without modifying them.

### Ideogram Mapping

**VESSEL (Instructional State):**
- Analysis activity templates (`find-vulnerabilities.json`, `assess-quality.json`)
- Code property graph (CPG) schema
- Query templates (Cypher patterns)
- Analysis model definitions

**BECOMING (Transient State):**
- CPG build in progress
- LLM analyzing code patterns
- Query executing across graph
- Semantic search embedding vectors

**INSTANCE (Functional State):**
- Analysis report generated
- Vulnerabilities identified
- Architectural diagram created
- Dependency graph visualized

**IMPULSE (Context Injection):**
- `cpgNode`: Specific code element in graph
- `analysisResult`: Previous analysis findings
- `codePattern`: Pattern to search for
- `securityRule`: Validation criteria

**IMPROVISATION (Adaptive Creation):**
- New vulnerability pattern discovered → create detection activity
- Analysis fails → adjust query strategy
- Novel architecture recognized → create pattern template

**GOAL-SEEKING (Adaptive Path):**
- "Find SQL injection risks" → build CPG → query injection patterns → verify findings
- "Assess code quality" → analyze complexity → identify hotspots → generate recommendations

### Tools Used

```typescript
// Understanding system
explorer    // Static code analysis (file structure, dependencies)
analyzer    // Semantic analysis (architecture, patterns)

// MCP tools
cpg_build          // Build code property graph
cpg_query          // Query graph with Cypher
embedding_search   // Semantic code search
pattern_match      // Find code patterns
```

### Example Activities

**Security Analysis:**
```json
{
  "id": "find-sql-injection",
  "category": "analysis",
  "tasks": [
    {
      "id": "build-cpg",
      "prompt": {
        "template": "Build code property graph for {{targetPath}}"
      }
    },
    {
      "id": "query-injection-patterns",
      "prompt": {
        "template": "Find user input flowing to SQL queries without sanitization"
      }
    },
    {
      "id": "generate-report",
      "prompt": {
        "template": "Create vulnerability report with severity and remediation"
      }
    }
  ]
}
```

**Architecture Assessment:**
```json
{
  "id": "analyze-architecture",
  "category": "analysis",
  "tasks": [
    {
      "id": "explore-structure",
      "prompt": {
        "template": "Use explorer to map file organization and dependencies"
      }
    },
    {
      "id": "identify-patterns",
      "prompt": {
        "template": "Use analyzer to identify architectural patterns"
      }
    },
    {
      "id": "visualize-components",
      "prompt": {
        "template": "Generate component diagram showing relationships"
      }
    }
  ]
}
```

### Learning Captured

- Which analysis strategies find most issues
- Query patterns with highest signal/noise ratio
- Cost per analysis type (static vs semantic)
- False positive rates by vulnerability type

---

## Domain 3: Deployment & Infrastructure

**Purpose:** Orchestrate cluster state through Kubernetes operations.

### Ideogram Mapping

**VESSEL (Instructional State):**
- Deployment activity templates (`deploy-service.json`, `scale-deployment.json`)
- Helm charts (infrastructure specifications)
- Kubernetes manifests (YAML definitions)
- Deployment strategies (blue/green, canary)

**BECOMING (Transient State):**
- Helm release installing
- Pod initializing (container starting)
- Service mesh reconfiguring
- Rolling update in progress

**INSTANCE (Functional State):**
- Pods running (healthy status)
- Service endpoints active
- ConfigMaps/Secrets applied
- Metrics showing traffic flow

**IMPULSE (Context Injection):**
- `podStatus`: Current pod health
- `helmRelease`: Deployed release metadata
- `resourceUsage`: CPU/memory metrics
- `deploymentConfig`: Target configuration

**IMPROVISATION (Adaptive Creation):**
- Deployment fails → create rollback activity
- Resource limits too low → generate scaling strategy
- Health check fails → create diagnostic activity

**GOAL-SEEKING (Adaptive Path):**
- "Deploy new version" → helm upgrade → verify pods healthy → check traffic routing
- "Scale for load" → adjust replicas → verify distribution → monitor performance

### Tools Used

```typescript
// Infrastructure tools
kubectl    // Kubernetes operations
helm       // Package management
docker     // Container operations
istioctl   // Service mesh configuration

// Monitoring tools (MCP)
prometheus_query   // Metrics queries
grafana_dashboard  // Visualization
```

### Example Activities

**Service Deployment:**
```json
{
  "id": "deploy-microservice",
  "category": "deployment",
  "tasks": [
    {
      "id": "validate-config",
      "prompt": {
        "template": "Check Helm values for {{serviceName}} are valid"
      }
    },
    {
      "id": "helm-upgrade",
      "prompt": {
        "template": "Deploy {{serviceName}} version {{version}} to {{namespace}}"
      }
    },
    {
      "id": "verify-health",
      "prompt": {
        "template": "Wait for pods to be ready and passing health checks"
      }
    }
  ]
}
```

**Rollback:**
```json
{
  "id": "rollback-failed-deploy",
  "category": "deployment",
  "tasks": [
    {
      "id": "identify-failed-pods",
      "prompt": {
        "template": "Find pods in CrashLoopBackOff state"
      }
    },
    {
      "id": "helm-rollback",
      "prompt": {
        "template": "Rollback to previous revision"
      }
    }
  ]
}
```

### Learning Captured

- Deployment success rates by service type
- Time to healthy state per deployment strategy
- Resource allocation patterns (what limits work)
- Rollback frequency and root causes

---

## Domain 4: Learning & Optimization

**Purpose:** Improve system behavior through trace analysis and template evolution.

### Ideogram Mapping

**VESSEL (Instructional State):**
- Meta-activity templates (`optimize-template.json`, `create-variant.json`)
- Template performance baselines
- Optimization strategies (A/B test, Thompson Sampling)
- Ribosome pattern (execution → template)

**BECOMING (Transient State):**
- Analyzing execution traces
- Extracting patterns from successful runs
- Thompson Sampling updating distributions
- Creating template variant

**INSTANCE (Functional State):**
- New template variant registered
- Performance metrics updated
- Success/failure distribution adjusted
- Template recommended for next execution

**IMPULSE (Context Injection):**
- `activityExecutionTrace`: Full execution with state snapshots
- `activityMetrics`: Success rate, cost, duration
- `toolUsagePattern`: Which tool sequences work
- `compositionGraph`: Template dependency network

**IMPROVISATION (Adaptive Creation):**
- Activity fails → ribosome extracts working partial → create simplified variant
- Success pattern emerges → create specialized template
- Cost too high → create optimized variant with fewer LLM calls

**GOAL-SEEKING (Adaptive Path):**
- "Improve success rate" → analyze failures → identify pattern → create variant → test
- "Reduce cost" → find expensive operations → optimize prompts → measure improvement

### Tools Used

```typescript
// Analysis tools
trace_analyzer      // Parse execution traces
pattern_extractor   // Find successful sequences
metric_aggregator   // Summarize performance data

// Backend MCP endpoints
recommendActivities     // Thompson Sampling selection
resolveImpulse         // Load trace data
recordExecution        // Store new trace
updateMetrics          // Track performance
```

### Example Activities

**Template Optimization:**
```json
{
  "id": "optimize-failing-template",
  "category": "learning",
  "tasks": [
    {
      "id": "analyze-failures",
      "prompt": {
        "template": "Examine execution traces for {{templateId}} with status=failed"
      }
    },
    {
      "id": "identify-failure-pattern",
      "prompt": {
        "template": "Find common causes: validation failures, tool errors, or LLM hallucination"
      }
    },
    {
      "id": "create-improved-variant",
      "prompt": {
        "template": "Create new template addressing identified issues"
      }
    }
  ]
}
```

**Ribosome Extraction:**
```json
{
  "id": "extract-successful-pattern",
  "category": "learning",
  "tasks": [
    {
      "id": "load-successful-trace",
      "prompt": {
        "template": "Load execution trace {{traceId}}"
      }
    },
    {
      "id": "extract-task-sequence",
      "prompt": {
        "template": "Create template from successful task sequence"
      }
    },
    {
      "id": "validate-template",
      "prompt": {
        "template": "Test extracted template on similar goal"
      }
    }
  ]
}
```

### Learning Captured

- Template evolution history (lineage tracking)
- Optimization effectiveness (before/after metrics)
- Pattern emergence frequency
- Thompson Sampling arm performance

---

## Domain 5: Validation & Compliance

**Purpose:** Verify runtime behavior matches specification.

### Ideogram Mapping

**VESSEL (Instructional State):**
- Validation activity templates (`validate-spec-compliance.json`)
- OpenSpec documents (functional, performance, drift thresholds)
- Test suites (expected behaviors)
- Compliance rules (what must hold)

**BECOMING (Transient State):**
- Executing validation checks
- Comparing spec vs runtime
- Calculating drift metrics
- Generating compliance report

**INSTANCE (Functional State):**
- Validation report created
- Drift measurements recorded
- Compliance status (pass/fail/drift)
- Realignment recommendations

**IMPULSE (Context Injection):**
- `openSpec`: Full specification document
- `executionTrace`: Runtime behavior to validate
- `driftThreshold`: Acceptable variance
- `complianceRule`: Specific constraint to check

**IMPROVISATION (Adaptive Creation):**
- Validation fails → create diagnostic activity
- Drift detected → generate realignment activity
- New constraint violated → create monitoring activity

**GOAL-SEEKING (Adaptive Path):**
- "Verify compliance" → load spec → compare runtime → measure drift → decide (pass/realign)
- "Realign to spec" → identify deviations → generate fixes → verify compliance

### Tools Used

```typescript
// Validation tools
spec_parser         // Parse OpenSpec documents
runtime_observer    // Capture actual behavior
drift_calculator    // Measure deviation
compliance_checker  // Verify constraints

// Comparison tools
diff                // Compare files/outputs
test_runner         // Execute test suites
metric_validator    // Check performance criteria
```

### Example Activities

**Spec Compliance Check:**
```json
{
  "id": "validate-spec-compliance",
  "category": "validation",
  "tasks": [
    {
      "id": "load-spec",
      "prompt": {
        "template": "Parse OpenSpec document {{specPath}}"
      }
    },
    {
      "id": "observe-runtime",
      "prompt": {
        "template": "Capture runtime behavior for {{componentName}}"
      }
    },
    {
      "id": "compare-and-report",
      "prompt": {
        "template": "Compare spec vs runtime, calculate drift, report compliance"
      }
    }
  ]
}
```

**Realignment:**
```json
{
  "id": "realign-to-spec",
  "category": "validation",
  "tasks": [
    {
      "id": "identify-deviations",
      "prompt": {
        "template": "Find where runtime violates spec constraints"
      }
    },
    {
      "id": "generate-fixes",
      "prompt": {
        "template": "Create code changes to restore compliance"
      }
    },
    {
      "id": "verify-compliance",
      "prompt": {
        "template": "Re-run validation to confirm realignment"
      }
    }
  ]
}
```

### Learning Captured

- Which specs drift most frequently
- Cost of maintaining compliance
- Realignment success rates
- Constraint violation patterns

---

## Cross-Domain Patterns

### Composition Across Domains

**Example: Feature Development with Analysis**

1. **Development domain:** "Add authentication feature"
2. **Analysis domain:** "Check for security vulnerabilities in auth code"
3. **Validation domain:** "Verify auth implementation matches spec"
4. **Learning domain:** "Extract successful auth pattern as template"

**Activity Sequence:**
```
implement-user-auth (Development)
    → find-sql-injection (Analysis)
    → validate-auth-spec-compliance (Validation)
    → extract-auth-pattern (Learning)
```

### Tool Overlap

Some tools work across multiple domains:

- `bash`: Development (run tests), Deployment (kubectl), Validation (run checks)
- `read`: Development (source code), Validation (spec documents), Learning (traces)
- `git`: Development (commit changes), Learning (track template evolution)

### Impulse Reuse

Same impulse types used differently:

- `file` pointer:
  - Development: Code to modify
  - Analysis: Code to analyze
  - Validation: Spec to compare against
  - Learning: Template to optimize

- `activityExecutionTrace` pointer:
  - Development: Previous failed attempts (context)
  - Learning: Successful patterns (extraction)
  - Validation: Runtime behavior (comparison)

### Universal Learning Loop

**Across all domains:**

```
Execute activity (any domain)
    ↓
Capture execution trace
    ↓
Store in backend
    ↓
Thompson Sampling updates distributions
    ↓
Next execution uses learned preferences
```

## Implementation Status

| Domain | Vessel | Becoming | Instance | Impulse | Improvisation | Goal-Seeking |
|--------|--------|----------|----------|---------|---------------|--------------|
| **Development** | ✅ Templates exist | ✅ Execution works | ✅ Git commits | ✅ File, trace impulses | ✅ Variant creation | ✅ GoalProcessor |
| **Analysis** | ⚠️ Basic templates | ⚠️ Explorer works | ⚠️ Reports generated | ⚠️ Analysis impulses | ❌ Not implemented | ⚠️ Basic goal support |
| **Deployment** | ⚠️ Manual helm | ⚠️ Works outside MiniBob | ⚠️ Deployed pods | ❌ No deploy impulses | ❌ Not implemented | ❌ Not implemented |
| **Learning** | ✅ Meta-activities | ✅ Backend works | ✅ Metrics tracked | ✅ Trace impulses | ✅ Ribosome pattern | ⚠️ Manual optimization |
| **Validation** | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented |

**Legend:**
- ✅ Fully implemented and tested
- ⚠️ Partially implemented or untested
- ❌ Not implemented

## Future Work

### Near-Term (Phase 1-2)

1. **Complete Development Domain:**
   - More activity templates
   - Better test validation
   - Cost optimization

2. **Enhance Learning Domain:**
   - Automatic template optimization
   - Pattern library building
   - Performance benchmarking

### Medium-Term (Phase 3-4)

3. **Implement Analysis Domain:**
   - CPG integration
   - Semantic search
   - Architecture analysis activities

4. **Add Deployment Domain:**
   - Helm deployment activities
   - Health monitoring
   - Rollback strategies

### Long-Term (Phase 5-6)

5. **Build Validation Domain:**
   - OpenSpec compliance checking
   - Drift detection
   - Automatic realignment

6. **Cross-Domain Composition:**
   - Activities spanning multiple domains
   - Shared impulse pools
   - Coordinated goal-seeking

## References

**Related Documentation:**
- `ideogram-catalog.md` - Universal pattern definitions
- `goal-seeking-architecture.md` - Goal-seeking implementation
- `closed-loop-architecture.md` - Integration patterns
- `../../docs/architecture/ONTOLOGY_OF_BECOMING.md` - Philosophical foundation
- `../../repos/minibob/src/understanding/` - Analysis domain implementation
