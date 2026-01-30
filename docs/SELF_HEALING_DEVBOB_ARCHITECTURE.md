# Self-Healing DevBob Architecture

## Executive Summary

This document describes a **metabob-driven autocephalous (self-governing) debugging system** where devbob agents detect, diagnose, and fix issues in running applications automatically using metabob intelligence and cross-agent coordination via ACP.

## Problem Statement

Applications become unstable as they run. Currently:
- ❌ Issues accumulate silently until catastrophic failure
- ❌ No proactive detection of degradation patterns
- ❌ Manual intervention required for diagnosis and fixes
- ❌ No coordination between agents working on related codebases

## Solution: Metabob-Directed Self-Healing

### Core Principles

1. **Observability-First**: Expose runtime state, metrics, and signals in logs
2. **Metabob as Oracle**: Metabob CPG + issue detection directs what to fix
3. **Autonomous Agents**: Devbob containers fix their own code when issues arise
4. **Cross-Agent Coordination**: Agents collaborate via metabob annotations and ACP

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Running Application                           │
│  (metabob-opencode, metabob-cli, metabob-rpc-api, dashboard)   │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ Telemetry + Health Signals
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Observability Layer                             │
│  • Health Checks (memory, CPU, disk, response time)             │
│  • Structured Logging (JSON, correlation IDs)                   │
│  • Metrics Exporters (Prometheus format)                        │
│  • Error Tracking (stack traces, context)                       │
│  • Performance Profiling (hotspots, bottlenecks)                │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ Log Ingestion
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Metabob Detection Engine                        │
│  • Search Codebase Issues (semantic similarity)                 │
│  • Get Priority Issues (auto-selected by relevance)             │
│  • Analyze Change Impact (blast radius)                         │
│  • Assess Deletion Safety (liveness analysis)                   │
│  • Suggest Related Changes (co-change patterns)                 │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ Issue Detection + Prioritization
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│              Self-Healing Coordinator (New)                      │
│  • Issue Triage (filter actionable issues)                      │
│  • Agent Routing (map issue → specialist devbob)                │
│  • Coordination Protocol (cross-repo fixes)                     │
│  • Retry Logic (handle fix failures)                            │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ ACP Delegation
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                   DevBob Agent Fleet                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ devbob-      │  │ devbob-cli   │  │ devbob-      │          │
│  │ opencode     │  │              │  │ rpc-api      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Each agent:                                                     │
│  • Receives fix directive via ACP                               │
│  • Uses activity templates (fix-bug-complete, refactor, etc.)   │
│  • Accesses metabob context (annotations, impact analysis)      │
│  • Commits fix with metabob annotation                          │
│  • Reports back to coordinator                                  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ Fix Applied
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Cross-Agent Coordination                        │
│  • metabob_annotate_component (why this fix?)                   │
│  • metabob_suggest_related_changes (what else needs fixing?)    │
│  • MESSAGE_FOR:agent annotations (notify other agents)          │
│  • Shared impulses (context propagation)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Component Specifications

### 1. Observability Layer (Expose Runtime State)

#### 1.1 Health Check Endpoint

Every application exposes `/health` with:

```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": 1738000000000,
  "uptime": 3600000,
  "checks": {
    "memory": {
      "status": "healthy",
      "used": 512000000,
      "limit": 2000000000,
      "utilization": 0.256
    },
    "disk": {
      "status": "healthy",
      "used": 10000000000,
      "limit": 50000000000,
      "utilization": 0.2
    },
    "database": {
      "status": "healthy",
      "latency": 15,
      "connectionPoolSize": 10
    },
    "cpu": {
      "status": "healthy",
      "loadAverage": [1.2, 1.5, 1.8],
      "utilization": 0.3
    }
  },
  "metrics": {
    "requestsPerMinute": 120,
    "errorRate": 0.02,
    "avgResponseTime": 45,
    "p95ResponseTime": 150
  }
}
```

#### 1.2 Structured Logging

All logs use JSON format with correlation IDs:

```json
{
  "timestamp": "2026-01-27T12:00:00.000Z",
  "level": "error",
  "service": "opencode-activity",
  "correlationId": "abc-123-def",
  "message": "Activity execution failed",
  "context": {
    "activityId": "act_abc123",
    "taskId": "task-2",
    "error": "TypeError: Cannot read property 'id' of undefined",
    "stack": "...",
    "sessionId": "sess_xyz789",
    "templateId": "add-feature-complete"
  }
}
```

#### 1.3 Metrics Exporter

Expose Prometheus-style metrics at `/metrics`:

```
# HELP opencode_activity_duration_seconds Duration of activity executions
# TYPE opencode_activity_duration_seconds histogram
opencode_activity_duration_seconds_bucket{template="add-feature-complete",le="60"} 45
opencode_activity_duration_seconds_bucket{template="add-feature-complete",le="300"} 120
opencode_activity_duration_seconds_count{template="add-feature-complete"} 150
opencode_activity_duration_seconds_sum{template="add-feature-complete"} 18000

# HELP opencode_activity_failures_total Number of activity execution failures
# TYPE opencode_activity_failures_total counter
opencode_activity_failures_total{template="add-feature-complete"} 5

# HELP opencode_memory_impulses_loaded Number of impulses loaded
# TYPE opencode_memory_impulses_loaded gauge
opencode_memory_impulses_loaded 12

# HELP opencode_memory_bytes_loaded Memory footprint of loaded impulses
# TYPE opencode_memory_bytes_loaded gauge
opencode_memory_bytes_loaded 1048576
```

#### 1.4 Performance Profiling Signals

Log performance hotspots:

```json
{
  "timestamp": "2026-01-27T12:00:00.000Z",
  "level": "warn",
  "service": "opencode-session",
  "message": "Slow operation detected",
  "context": {
    "operation": "SessionMemory.loadImpulse",
    "duration": 5000,
    "threshold": 1000,
    "impulseId": "imp_abc123",
    "contentSize": 500000,
    "suggestion": "Consider chunking large impulses or implementing lazy loading"
  }
}
```

### 2. Metabob Detection Engine

#### 2.1 Continuous Issue Scanning

Metabob runs in background (every 5 minutes):
- Scan codebase for new issues (HIGH/MEDIUM severity)
- Correlate issues with recent logs (match error traces to code locations)
- Rank by priority (severity × impact × recency)

#### 2.2 Log-to-Code Correlation

When an error occurs in logs:
1. Extract stack trace file paths
2. Call `metabob_search_codebase_issues(query="similar to: [error message]")`
3. Call `metabob_list_file_components(filePath)` for affected files
4. Call `metabob_analyze_change_impact(filePath, componentName)` to understand dependencies
5. Generate fix directive

#### 2.3 Degradation Detection

Monitor trends:
- Response time increases (p95 > threshold)
- Error rate increases (errors/min > threshold)
- Memory growth (unbounded growth signal)
- CPU saturation (load average > cores × 0.8)

When degradation detected:
1. Call `metabob_get_priority_issues()` to see if code quality issues correlate
2. Call `metabob_suggest_related_changes([recently_modified_files])` to find root causes
3. Generate fix directive if actionable issue found

### 3. Self-Healing Coordinator

#### 3.1 Issue Triage

Filter issues for actionability:

```typescript
interface ActionableIssue {
  issueId: string
  severity: "HIGH" | "MEDIUM"
  category: "bug" | "performance" | "memory-leak" | "error-handling"
  affectedFiles: string[]
  affectedComponents: string[]
  confidence: number // 0-1
  evidence: {
    errorLogs?: string[]
    metricAnomalies?: string[]
    stackTraces?: string[]
  }
  suggestedFix?: string
  assignedAgent: string // Which devbob container handles this?
}
```

#### 3.2 Agent Routing

Map issue → specialist agent:

| Issue Category | Target Agent | Rationale |
|---------------|--------------|-----------|
| Activity template execution | devbob-opencode | Owns activity infrastructure |
| CLI tool errors | devbob-cli | Owns CLI codebase |
| API/RPC errors | devbob-rpc-api | Owns backend services |
| Dashboard/UI errors | devbob-dashboard | Owns frontend |
| Cross-cutting concerns | devbob-opencode | General-purpose agent |

#### 3.3 Fix Directive Generation

```typescript
interface FixDirective {
  directiveId: string
  targetAgent: string
  priority: "critical" | "high" | "medium"
  issue: ActionableIssue
  context: {
    sharedImpulses: string[] // Relevant context to share
    recentChanges: string[] // Files modified recently
    relatedIssues: string[] // Co-occurring issues
  }
  task: {
    description: string
    activityTemplate?: string // Suggested template (fix-bug-complete, etc.)
    acceptanceCriteria: string[]
  }
  coordination: {
    notifyAgents: string[] // Other agents that need to know about this fix
    annotations: Array<{
      filePath: string
      componentName: string
      message: string
    }>
  }
}
```

#### 3.4 Coordination Protocol

```typescript
// Step 1: Coordinator creates fix directive
const directive = await coordinator.createFixDirective(issue)

// Step 2: Share context via impulses
const contextImpulse = await createImpulse({
  id: `fix-context-${directive.directiveId}`,
  type: "bugContext",
  pointer: {
    type: "memo",
    content: JSON.stringify(directive),
    source: "self-healing-coordinator",
  },
  budget: 3000,
})

// Step 3: Delegate to specialist agent via ACP
const result = await acp_delegate({
  target: `docker://${directive.targetAgent}`,
  taskDescription: `Fix ${directive.issue.category}: ${directive.task.description}`,
  prompt: `
You are responding to an automated fix directive from the self-healing coordinator.

Issue: ${directive.issue.category} - ${directive.issue.severity}
Files: ${directive.issue.affectedFiles.join(", ")}
Evidence: ${JSON.stringify(directive.issue.evidence)}

IMPORTANT: Use the ${directive.task.activityTemplate || "fix-bug-complete"} activity template.

After fixing:
1. Run tests to verify fix
2. Commit with clear message
3. Annotate fixed components with metabob_annotate_component
4. Check metabob_suggest_related_changes for related work
5. Add MESSAGE_FOR annotations if other agents need to know

Acceptance Criteria:
${directive.task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}
  `,
  shareImpulses: [contextImpulse.id],
  timeout: 600,
})

// Step 4: Process cross-agent coordination
if (result.metadata?.success) {
  await coordinator.notifyRelatedAgents(directive.coordination.notifyAgents, {
    fixedIssue: directive.issue,
    changes: result.metadata.changedFiles,
    annotations: directive.coordination.annotations,
  })
}
```

### 4. DevBob Agent Self-Healing Workflow

Each devbob container runs with:

#### 4.1 Watchdog Process

```typescript
// In container entrypoint
async function selfHealingWatchdog() {
  while (true) {
    // Check for fix directives (via shared volume or ACP polling)
    const directives = await checkForFixDirectives()

    for (const directive of directives) {
      try {
        // Execute fix using activity mode
        await executeFixDirective(directive)
      } catch (error) {
        // Report failure back to coordinator
        await reportFixFailure(directive, error)
      }
    }

    // Check own health
    const health = await checkOwnHealth()
    if (health.status !== "healthy") {
      // Self-diagnose and attempt fix
      await selfDiagnose(health)
    }

    await sleep(30000) // Check every 30 seconds
  }
}
```

#### 4.2 Fix Execution with Activity Templates

```typescript
async function executeFixDirective(directive: FixDirective) {
  // Use activity templates for structured fixes
  const activityTemplate = directive.task.activityTemplate || "fix-bug-complete"

  const result = await activity({
    templateId: activityTemplate,
    variables: {
      bugDescription: directive.issue.category,
      files: directive.issue.affectedFiles,
      errorContext: JSON.stringify(directive.issue.evidence),
    },
    reason: `Self-healing: Fix ${directive.issue.category} detected by metabob`,
  })

  // Post-fix coordination
  if (result.success) {
    // Annotate fixed components
    for (const file of directive.issue.affectedFiles) {
      const components = await metabob_list_file_components({ file_path: file })
      for (const component of components) {
        await metabob_annotate_component({
          file_path: file,
          component_name: component.name,
          component_type: component.type,
          reason: `Fixed ${directive.issue.category}. Root cause: ${directive.issue.suggestedFix || "See commit"}. Applied pattern: ${activityTemplate}.`,
        })
      }
    }

    // Check for related issues
    const relatedChanges = await metabob_suggest_related_changes({
      changed_files: directive.issue.affectedFiles,
    })

    // Add cross-agent notifications if needed
    if (directive.coordination.notifyAgents.length > 0) {
      for (const file of directive.issue.affectedFiles) {
        await metabob_annotate_component({
          file_path: file,
          component_name: "_metadata",
          component_type: "file",
          reason: `MESSAGE_FOR:${directive.coordination.notifyAgents.join(",")} - This fix may affect your codebase. Changes: ${result.summary}`,
        })
      }
    }
  }

  return result
}
```

### 5. Cross-Agent Coordination via Metabob

#### 5.1 MESSAGE_FOR Pattern

Agents use metabob annotations to notify each other:

```typescript
// Agent A fixes authentication bug
await metabob_annotate_component({
  file_path: "src/auth.ts",
  component_name: "authenticateUser",
  component_type: "function",
  reason: `
Fixed authentication timeout bug by increasing session TTL from 5min to 30min.

MESSAGE_FOR:devbob-dashboard - Updated auth token refresh interval. 
You may need to update frontend refresh logic to match new 30min TTL.

MESSAGE_FOR:devbob-rpc-api - Session duration changed. 
Update API documentation and ensure rate limiting accounts for longer sessions.
  `,
})
```

#### 5.2 Annotation Polling

Each agent periodically checks for messages:

```typescript
async function checkForCrossAgentMessages(agentName: string) {
  // Search for MESSAGE_FOR annotations mentioning this agent
  const issues = await metabob_search_codebase_issues({
    query: `MESSAGE_FOR:${agentName}`,
    limit: 20,
  })

  // Filter to recent annotations (last 1 hour)
  const recentMessages = issues.filter((issue) => {
    const annotation = issue.annotations?.find((a) => a.includes(`MESSAGE_FOR:${agentName}`))
    return annotation && isRecent(annotation.timestamp, 3600000)
  })

  // Process each message
  for (const message of recentMessages) {
    await processMessage(message)
  }
}
```

#### 5.3 Shared Impulse Context

For complex cross-agent work, use shared impulses:

```typescript
// Agent A creates shared context
const sharedContext = await impulse_create({
  id: "api-contract-change-v2",
  type: "apiContract",
  pointer: {
    type: "memo",
    content: `
# API Contract Change: Authentication V2

## Changes
- Session duration: 5min → 30min
- Refresh token: now required
- New endpoint: POST /auth/refresh

## Affected Services
- Frontend: Update token refresh logic
- Backend: Update session cleanup
- CLI: Update auth flow
    `,
    source: "devbob-rpc-api",
  },
  budget: 5000,
})

// Agent B accesses shared context via ACP
await acp_delegate({
  target: "docker://devbob-dashboard",
  taskDescription: "Update auth to match API v2",
  prompt: "Update authentication flow per shared context",
  shareImpulses: ["api-contract-change-v2"],
})
```

### 6. Monitoring & Observability for Self-Healing

#### 6.1 Self-Healing Metrics

Track effectiveness:

```
# HELP selfhealing_issues_detected_total Issues detected by metabob
# TYPE selfhealing_issues_detected_total counter
selfhealing_issues_detected_total{severity="HIGH"} 12
selfhealing_issues_detected_total{severity="MEDIUM"} 34

# HELP selfhealing_fixes_attempted_total Fix attempts
# TYPE selfhealing_fixes_attempted_total counter
selfhealing_fixes_attempted_total{agent="devbob-opencode",result="success"} 8
selfhealing_fixes_attempted_total{agent="devbob-opencode",result="failure"} 2

# HELP selfhealing_fix_duration_seconds Time to apply fix
# TYPE selfhealing_fix_duration_seconds histogram
selfhealing_fix_duration_seconds_bucket{agent="devbob-opencode",le="60"} 5
selfhealing_fix_duration_seconds_bucket{agent="devbob-opencode",le="300"} 10

# HELP selfhealing_coordination_messages_total Cross-agent messages sent
# TYPE selfhealing_coordination_messages_total counter
selfhealing_coordination_messages_total{from="devbob-rpc-api",to="devbob-dashboard"} 3
```

#### 6.2 Audit Log

Every self-healing action is logged:

```json
{
  "timestamp": "2026-01-27T12:00:00.000Z",
  "event": "self_healing_fix_applied",
  "directiveId": "fix-dir-abc123",
  "agent": "devbob-opencode",
  "issue": {
    "id": "issue-xyz789",
    "severity": "HIGH",
    "category": "memory-leak",
    "files": ["src/session/session-memory.ts"]
  },
  "fix": {
    "activityTemplate": "fix-bug-complete",
    "duration": 120000,
    "changedFiles": ["src/session/session-memory.ts"],
    "testsRun": 15,
    "testsPassed": 15,
    "commitSha": "abc123def456"
  },
  "coordination": {
    "annotationsAdded": 2,
    "messagesFor": ["devbob-cli"],
    "relatedChanges": []
  },
  "verification": {
    "healthBefore": "degraded",
    "healthAfter": "healthy",
    "metricImprovement": {
      "memoryGrowthRate": { "before": 2000000, "after": 5000 }
    }
  }
}
```

## Implementation Roadmap

### Phase 1: Observability Foundation (Week 1)
- [ ] Add health check endpoints to all services
- [ ] Implement structured JSON logging
- [ ] Add metrics exporters (Prometheus format)
- [ ] Create correlation ID infrastructure

### Phase 2: Metabob Integration (Week 2)
- [ ] Implement log-to-code correlation
- [ ] Build issue triage system
- [ ] Create degradation detection
- [ ] Implement periodic metabob scanning

### Phase 3: Self-Healing Coordinator (Week 3)
- [ ] Build coordinator service
- [ ] Implement agent routing logic
- [ ] Create fix directive generation
- [ ] Build ACP delegation wrapper

### Phase 4: DevBob Agent Integration (Week 4)
- [ ] Add watchdog process to containers
- [ ] Implement fix execution with activities
- [ ] Add post-fix metabob annotation
- [ ] Build MESSAGE_FOR polling

### Phase 5: Cross-Agent Coordination (Week 5)
- [ ] Implement shared impulse protocol
- [ ] Build annotation-based messaging
- [ ] Create coordination verification
- [ ] Add retry/recovery logic

### Phase 6: Monitoring & Refinement (Week 6)
- [ ] Add self-healing metrics
- [ ] Build audit logging
- [ ] Create dashboard for monitoring
- [ ] Tune thresholds and priorities

## Success Metrics

- **Mean Time to Detection (MTTD)**: < 5 minutes from issue occurrence to detection
- **Mean Time to Resolution (MTTR)**: < 10 minutes from detection to fix applied
- **Fix Success Rate**: > 80% of automated fixes succeed
- **False Positive Rate**: < 10% of detected issues are false positives
- **Coverage**: > 70% of runtime issues are auto-fixable

## Example: End-to-End Self-Healing Flow

### Scenario: Memory Leak in OpenCode Session Management

1. **Detection** (T+0min)
   - Health check shows memory growth: 50MB → 200MB in 10 minutes
   - Structured logs show: `memory_health: stale impulses: 25`
   - Metrics show: `opencode_memory_growth_rate 15MB/min`

2. **Correlation** (T+1min)
   - Coordinator correlates metrics with metabob issues
   - `metabob_search_codebase_issues("memory leak session")` returns HIGH severity issue
   - `metabob_analyze_change_impact("src/session/session-memory.ts", "loadImpulse")` shows 12 dependents

3. **Triage** (T+2min)
   - Coordinator creates fix directive:
     - Issue: Memory leak (HIGH severity)
     - Files: `src/session/session-memory.ts`
     - Evidence: Unbounded growth, stale impulses
     - Target: devbob-opencode
     - Template: fix-bug-complete

4. **Delegation** (T+3min)
   - Coordinator delegates to devbob-opencode via ACP
   - Shares context impulse with logs + metrics
   - Timeout: 10 minutes

5. **Fix Execution** (T+4min - T+9min)
   - devbob-opencode receives directive
   - Executes fix-bug-complete activity
   - Identifies root cause: missing unload call in error path
   - Adds proper cleanup logic
   - Runs tests: 15/15 passed
   - Commits with message: "Fix memory leak in session-memory error path"

6. **Coordination** (T+10min)
   - Annotates fixed component with root cause explanation
   - Checks `metabob_suggest_related_changes` → finds similar pattern in 2 other files
   - Adds MESSAGE_FOR:devbob-cli annotation (CLI uses similar pattern)

7. **Verification** (T+15min)
   - Coordinator checks health again
   - Memory growth rate: 15MB/min → 0.5MB/min ✅
   - Stale impulses: 25 → 0 ✅
   - Status: degraded → healthy ✅

8. **Cross-Agent Follow-Up** (T+20min)
   - devbob-cli polls for messages
   - Finds MESSAGE_FOR annotation
   - Creates fix directive for similar pattern in CLI
   - Applies same fix pattern

## Security & Safety Considerations

1. **Approval Gates**: Critical fixes require human approval before commit
2. **Rollback**: All fixes tagged for easy rollback if issues worsen
3. **Rate Limiting**: Max 5 auto-fixes per hour to prevent cascading failures
4. **Blast Radius**: Never auto-fix core infrastructure (only application code)
5. **Testing Required**: All fixes must pass existing tests before commit

## Conclusion

This architecture enables **true autocephalous (self-governing) debugging** where:
- Applications expose their runtime state
- Metabob detects and prioritizes issues
- DevBob agents fix their own code autonomously
- Agents coordinate via metabob annotations and ACP
- The system learns and improves over time

The key innovation is **metabob as the central nervous system** - it provides the intelligence for what to fix, when, and how, enabling truly autonomous self-healing systems.
