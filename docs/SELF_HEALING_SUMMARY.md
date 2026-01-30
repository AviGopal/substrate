# Self-Healing DevBob System: Implementation Summary

## Executive Summary

I've designed and documented a **metabob-driven autocephalous (self-governing) debugging system** that enables devbob agents to autonomously detect, diagnose, and fix issues in running applications. This system answers your question: "How can we expose information about the system to aid in autocephalous debugging and enable agents to fix their code as issues arise?"

## Key Innovation: Metabob as Central Nervous System

Metabob serves as the **intelligence layer** that:
1. **Detects issues** via continuous code quality scanning + log correlation
2. **Prioritizes work** by ranking issues by severity × impact × recency
3. **Directs fixes** by routing issues to specialist devbob agents
4. **Coordinates agents** via annotations (MESSAGE_FOR pattern) and shared impulses
5. **Validates fixes** by checking for related changes and impact analysis

## Architecture Overview

```
Running Application
    ↓ (telemetry + health signals)
Observability Layer (health checks, structured logs, metrics)
    ↓ (log ingestion)
Metabob Detection Engine (search issues, prioritize, correlate)
    ↓ (issue detection + prioritization)
Self-Healing Coordinator (triage, route, coordinate)
    ↓ (ACP delegation)
DevBob Agent Fleet (receive directives, execute fixes via activities)
    ↓ (fix applied)
Cross-Agent Coordination (annotations, MESSAGE_FOR, shared impulses)
```

## How It Works: Step-by-Step

### 1. Observability: Expose Runtime State

Every application exposes:
- **`/health` endpoint**: Memory, CPU, disk, response time, error rates
- **Structured JSON logs**: Correlation IDs, stack traces, context
- **`/metrics` endpoint**: Prometheus-format metrics for monitoring
- **Performance profiling**: Slow operation detection with suggestions

Example health response:
```json
{
  "status": "degraded",
  "checks": {
    "memory": {
      "status": "unhealthy",
      "used": 1800000000,
      "limit": 2000000000,
      "utilization": 0.9
    }
  },
  "metrics": {
    "errorRate": 0.05,
    "avgResponseTime": 250
  }
}
```

### 2. Metabob Detection: Identify Issues

Metabob continuously (every 5 minutes):
1. **Scans codebase** for HIGH/MEDIUM severity issues
2. **Correlates with logs**: Matches error stack traces to code locations
3. **Ranks by priority**: severity × impact × recency
4. **Detects degradation**: Response time ↑, error rate ↑, memory growth ↑

Example detection:
```typescript
// Health shows memory growth
metabob_search_codebase_issues("memory leak session")
  → Returns HIGH severity issue in session-memory.ts

metabob_analyze_change_impact("session-memory.ts", "loadImpulse")
  → Shows 12 dependents, critical component
```

### 3. Coordinator: Route Issues to Agents

The **Self-Healing Coordinator** service:
1. **Triages issues**: Filters for actionability (confidence > 0.7)
2. **Routes to specialists**:
   - Activity/session issues → devbob-opencode
   - CLI tool errors → devbob-cli
   - API/RPC errors → devbob-rpc-api
   - UI errors → devbob-dashboard
3. **Creates fix directive**: Includes context, evidence, suggested activity template
4. **Delegates via ACP**: Sends directive to target agent with shared impulses

### 4. DevBob Agents: Execute Fixes

Each devbob container runs a **watchdog process** that:
1. **Polls for directives** (every 30s)
2. **Executes fix via activity template** (e.g., fix-bug-complete)
3. **Runs tests** to verify fix
4. **Commits with clear message**
5. **Annotates with metabob**: Documents root cause and fix pattern

Example fix execution:
```typescript
await activity({
  templateId: "fix-bug-complete",
  variables: {
    bugDescription: "memory leak",
    files: ["src/session/session-memory.ts"],
    errorContext: JSON.stringify(evidence)
  },
  reason: "Self-healing: Fix memory leak detected by metabob"
})

// Post-fix coordination
await metabob_annotate_component({
  file_path: "src/session/session-memory.ts",
  component_name: "loadImpulse",
  component_type: "function",
  reason: "Fixed memory leak. Root cause: missing cleanup in error path. Added try/finally block."
})
```

### 5. Cross-Agent Coordination: Collaborate

Agents coordinate via two mechanisms:

**A. MESSAGE_FOR Pattern** (for simple notifications):
```typescript
await metabob_annotate_component({
  file_path: "src/auth.ts",
  component_name: "authenticateUser",
  component_type: "function",
  reason: `
Fixed authentication timeout bug.

MESSAGE_FOR:devbob-cli - Updated auth token refresh interval to 30min.
You may need to update CLI auth flow to match new TTL.
  `
})

// Other agents poll for messages
const messages = await metabob_search_codebase_issues({
  query: "MESSAGE_FOR:devbob-cli",
  limit: 20
})
```

**B. Shared Impulses** (for complex context):
```typescript
// Agent A creates shared context
const context = await impulse_create({
  id: "api-contract-change-v2",
  type: "apiContract",
  pointer: {
    type: "memo",
    content: "API contract changed: session TTL 5min → 30min",
    source: "devbob-rpc-api"
  },
  budget: 5000
})

// Agent B receives via ACP
await acp_delegate({
  target: "docker://devbob-dashboard",
  taskDescription: "Update auth to match API v2",
  prompt: "Update authentication flow per shared context",
  shareImpulses: ["api-contract-change-v2"]
})
```

## Complete Example: Memory Leak Self-Healing

### Timeline

**T+0min: Issue Occurs**
- Application creates 100 impulses without cleanup
- Memory grows: 50MB → 200MB in 10 minutes

**T+1min: Detection**
- Health endpoint reports: `status: "degraded", memory utilization: 0.9`
- Structured logs show: `memory_health: stale impulses: 25`
- Metrics show: `memory_growth_rate: 15MB/min`

**T+2min: Correlation**
- Coordinator calls `metabob_search_codebase_issues("memory leak session")`
- Returns HIGH severity issue in `session-memory.ts`
- Calls `metabob_analyze_change_impact()` → 12 dependents, critical component

**T+3min: Triage & Routing**
- Coordinator creates fix directive:
  - Category: memory-leak
  - Severity: HIGH
  - Target: devbob-opencode
  - Template: fix-bug-complete
- Creates context impulse with logs + metrics
- Delegates to devbob-opencode via ACP

**T+4min: Fix Execution**
- devbob-opencode watchdog receives directive
- Executes fix-bug-complete activity
- Identifies root cause: missing `unload()` call in error path
- Adds proper cleanup logic in try/finally block
- Runs tests: 15/15 passed ✅

**T+9min: Commit & Annotation**
- Commits: "Fix memory leak in session-memory error path"
- Annotates component:
  ```
  Fixed memory leak. Root cause: missing cleanup in error path. 
  Added try/finally block. Pattern: ensure cleanup on all code paths.
  ```
- Checks `metabob_suggest_related_changes()` → finds 2 similar patterns
- No MESSAGE_FOR needed (isolated fix)

**T+10min: Verification**
- Coordinator checks health again
- Memory growth rate: 15MB/min → 0.5MB/min ✅
- Stale impulses: 25 → 0 ✅
- Status: degraded → healthy ✅

**T+15min: Audit Trail**
```json
{
  "event": "self_healing_fix_applied",
  "agent": "devbob-opencode",
  "issue": { "category": "memory-leak", "severity": "HIGH" },
  "fix": { "duration": 300000, "commitSha": "abc123" },
  "verification": {
    "healthBefore": "degraded",
    "healthAfter": "healthy",
    "metricImprovement": { "memoryGrowthRate": { "before": 15000000, "after": 500000 } }
  }
}
```

## Deliverables

### 1. Architecture Documentation
- **`docs/SELF_HEALING_DEVBOB_ARCHITECTURE.md`**: Complete system design with 6 core components, integration patterns, security considerations

### 2. Activity Template
- **`templates/implement-self-healing-system.json`**: 6-task activity template for deploying the full system:
  1. Add observability layer
  2. Build coordinator service
  3. Add watchdog to containers
  4. Implement MESSAGE_FOR coordination
  5. Add metrics and audit logging
  6. Create end-to-end test

### 3. Quick Start Guide
- **`docs/SELF_HEALING_QUICK_START.md`**: Step-by-step testing guide with 3 test scenarios, configuration tuning, troubleshooting

### 4. Integration Test
- **`test-acp-full-integration.ts`**: Tests ACP → Activity → Impulse → Metabob pipeline (8 test phases)

## Key Features

### ✅ Autonomous Detection
- Continuous metabob scanning (every 5 min)
- Log-to-code correlation
- Health degradation detection
- Priority-based triage

### ✅ Intelligent Routing
- Specialist agent mapping
- Confidence-based filtering
- Context gathering (logs, metrics, annotations)
- Activity template suggestion

### ✅ Structured Fixes
- Activity templates ensure quality (tests, commits, documentation)
- Metabob annotations document WHY (root cause, pattern, alternatives)
- Related change detection prevents regressions
- Rollback support for safety

### ✅ Cross-Agent Coordination
- MESSAGE_FOR pattern for notifications
- Shared impulses for complex context
- Annotation-based messaging
- Coordination verification

### ✅ Observability & Learning
- Prometheus metrics (detection latency, fix success rate, coordination messages)
- Audit logging (every action recorded)
- Dashboard for monitoring
- Metabob learns from successful fixes

## Success Metrics

Target KPIs for production:
- **MTTD (Mean Time to Detection)**: < 5 minutes
- **MTTR (Mean Time to Resolution)**: < 10 minutes
- **Fix Success Rate**: > 80%
- **False Positive Rate**: < 10%
- **Coverage**: > 70% of issues auto-fixable

## Implementation Timeline

- **Week 1**: Observability foundation (health endpoints, structured logs, metrics)
- **Week 2**: Metabob integration (detection, correlation, triage)
- **Week 3**: Self-healing coordinator (routing, delegation, directives)
- **Week 4**: DevBob agent integration (watchdog, fix execution, annotation)
- **Week 5**: Cross-agent coordination (MESSAGE_FOR, shared impulses)
- **Week 6**: Monitoring & refinement (metrics, audit logs, dashboard)

## Next Steps

### Option 1: Automated Deployment
Use the activity template to deploy the full system:
```bash
cd repos/metabob-opencode
bun run register-template.ts ../../templates/implement-self-healing-system.json
# Then use activity tool or delegate to devbob-opencode
```

### Option 2: Manual Phased Deployment
Follow the quick-start guide to implement phase-by-phase over 6 weeks.

### Option 3: Start with Testing
Run the ACP integration test to verify the pipeline:
```bash
bun run test-acp-full-integration.ts
```

## Questions Answered

### Q: How can we expose information about the system in logs?
**A**: Three-layer observability:
1. `/health` endpoints (structured health checks)
2. JSON structured logs (correlation IDs, context, stack traces)
3. `/metrics` endpoints (Prometheus format)

### Q: How can agents fix their code when issues arise?
**A**: Watchdog process in each container:
1. Polls for fix directives from coordinator
2. Executes fixes via activity templates
3. Validates with tests
4. Commits with annotations

### Q: How can Metabob direct when and how to fix issues?
**A**: Metabob serves as the intelligence layer:
1. **When**: Continuous scanning + log correlation detects issues
2. **What**: Priority ranking identifies critical issues
3. **How**: Change impact analysis + related changes suggest fix approach
4. **Who**: Issue category → specialist agent routing

### Q: How can agents coordinate across a codebase?
**A**: Two coordination mechanisms:
1. **MESSAGE_FOR annotations**: Lightweight notifications in metabob annotations
2. **Shared impulses**: Complex context sharing via ACP delegation

## Conclusion

This system enables **true autocephalous (self-governing) debugging** where applications continuously monitor themselves, detect degradation, and autonomously apply fixes with full coordination across agents. Metabob serves as the central intelligence that detects, prioritizes, and directs all self-healing actions, while devbob agents execute fixes using structured activity templates and coordinate via annotations.

The key innovation is treating **metabob as the nervous system** - it provides the intelligence for what to fix, when, and how, enabling truly autonomous self-healing systems that learn and improve over time.
