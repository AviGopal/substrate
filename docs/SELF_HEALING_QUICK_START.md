# Self-Healing DevBob Quick Start Guide

## Overview

This guide walks you through testing the metabob-driven self-healing system that enables devbob agents to autonomously detect, diagnose, and fix issues in running applications.

## Prerequisites

1. **DevBob containers running**:
   ```bash
   ./scripts/start-devbob.sh
   docker ps | grep devbob  # Should show devbob-opencode, devbob-cli, etc.
   ```

2. **Metabob MCP configured**:
   ```bash
   # Check repos/metabob-opencode/opencode.json has metabob MCP config
   ```

3. **Dependencies installed**:
   ```bash
   cd repos/metabob-opencode
   bun install
   ```

## Implementation Steps

### Step 1: Deploy Self-Healing Infrastructure

Use the activity template to deploy the full system:

```bash
# From metabob-devbob root
cd repos/metabob-opencode

# Register the self-healing activity template
bun run -e "
import { TemplateService } from './packages/opencode/src/session/template-service'
import { Instance } from './packages/opencode/src/project/instance'

await Instance.provide({
  directory: process.cwd(),
  fn: async () => {
    const service = await TemplateService.init()
    await service.registerFromFile('../../templates/implement-self-healing-system.json')
    console.log('Self-healing template registered')
  }
})
"

# Execute the activity
# (Use via ACP to devbob-opencode agent for full implementation)
```

**OR manually implement each phase:**

### Phase 1: Add Observability (Week 1)

```bash
# Add health endpoints
cd repos/metabob-opencode
# Create packages/opencode/src/server/health.ts

cd repos/metabob-cli  
# Create src/metabob_cli/health.py

cd repos/metabob-rpc-api
# Create server/health.py

# Test health endpoints
curl http://localhost:3004/health  # OpenCode
curl http://localhost:8000/health  # CLI (if running)
curl http://localhost:5000/health  # RPC API (if running)
```

### Phase 2: Deploy Coordinator (Week 2)

```bash
cd repos/metabob-opencode

# Create coordinator
mkdir -p packages/opencode/src/coordinator
# Create self-healing-coordinator.ts

# Test coordinator
bun test packages/opencode/src/coordinator/self-healing-coordinator.test.ts
```

### Phase 3: Add Watchdog to Containers (Week 3)

```bash
# Create watchdog script
# scripts/self-healing-watchdog.ts

# Update entrypoint
vim configs/devbob-entrypoint.sh
# Add watchdog process startup

# Rebuild containers
docker-compose -f configs/docker-compose.devbob.yaml build
docker-compose -f configs/docker-compose.devbob.yaml up -d

# Check watchdog is running
docker exec devbob-opencode ps aux | grep watchdog
docker logs devbob-opencode | grep watchdog
```

### Phase 4: Enable Cross-Agent Coordination (Week 4)

```bash
cd repos/metabob-opencode

# Create messaging module
# packages/opencode/src/coordinator/cross-agent-messaging.ts

# Test MESSAGE_FOR pattern
bun run test-cross-agent-messaging.ts
```

### Phase 5: Add Monitoring (Week 5)

```bash
# Add metrics and audit logging
# packages/opencode/src/coordinator/self-healing-metrics.ts
# packages/opencode/src/coordinator/audit-log.ts

# Create dashboard
# scripts/self-healing-dashboard.ts

# View dashboard
bun run scripts/self-healing-dashboard.ts
```

### Phase 6: Integration Testing (Week 6)

```bash
# Run end-to-end test
bun run test-self-healing-e2e.ts

# Expected output:
# ✅ Issue detection (T+2min)
# ✅ Fix directive created
# ✅ Fix executed by watchdog
# ✅ Tests passed
# ✅ Health recovered
# ✅ Audit trail complete
```

## Testing the System

### Test 1: Memory Leak Auto-Fix

Trigger a memory leak and watch it get fixed automatically:

```bash
# 1. Monitor health before
curl http://localhost:3004/health | jq '.checks.memory'

# 2. Inject memory leak (create session with unbounded impulse growth)
cd repos/metabob-opencode
bun run -e "
import { SessionMemory } from './packages/opencode/src/session/session-memory'
import { Instance } from './packages/opencode/src/project/instance'

await Instance.provide({
  directory: process.cwd(),
  fn: async () => {
    const sessionId = 'test-leak-session'
    
    // Create 100 impulses without cleanup
    for (let i = 0; i < 100; i++) {
      await SessionMemory.createImpulse(sessionId, {
        id: \`leak-impulse-\${i}\`,
        type: 'testLeak',
        pointer: {
          type: 'memo',
          content: 'x'.repeat(100000), // 100KB each
          source: 'leak-test'
        },
        budget: 2000,
        loaded: true
      })
    }
    
    console.log('Memory leak injected: 100 impulses (10MB)')
  }
})
"

# 3. Watch self-healing logs
docker logs -f devbob-opencode | grep -E 'self-healing|memory-leak'

# 4. Expected output (within 10 minutes):
# [T+2min] Issue detected: memory leak (HIGH severity)
# [T+3min] Fix directive created: target=devbob-opencode
# [T+4min] Watchdog received directive
# [T+5min] Executing fix-bug-complete activity
# [T+8min] Fix applied: added cleanup logic
# [T+9min] Tests passed (15/15)
# [T+10min] Health recovered: memory growth 15MB/min → 0.5MB/min

# 5. Verify fix was applied
curl http://localhost:3004/health | jq '.checks.memory'
# Should show healthy status

# 6. Check audit log
cat repos/metabob-opencode/.metabob/logs/self-healing-audit.jsonl | tail -1 | jq
```

### Test 2: Cross-Agent Coordination

Test MESSAGE_FOR coordination between agents:

```bash
# 1. Fix issue in devbob-opencode with MESSAGE_FOR annotation
cd repos/metabob-opencode
bun run -e "
import { MetabobCLI } from './packages/opencode/src/util/metabob'

// Simulate a fix with cross-agent notification
await metabob_annotate_component({
  file_path: 'src/auth.ts',
  component_name: 'authenticateUser',
  component_type: 'function',
  reason: \`
Fixed authentication timeout bug by increasing session TTL.

MESSAGE_FOR:devbob-cli - Updated auth token refresh interval.
You may need to update CLI auth flow to match new TTL.

Root cause: Session duration was too short (5min).
New duration: 30min.
Pattern applied: Increased timeout constant.
  \`
})
"

# 2. Watch devbob-cli agent receive message
docker logs -f devbob-cli | grep 'MESSAGE_FOR'

# 3. Expected output (within 5 minutes):
# [T+1min] Message received from devbob-opencode
# [T+2min] Processing message: auth token refresh
# [T+3min] Creating fix directive for CLI
# [T+4min] Applying similar pattern to CLI codebase
# [T+5min] Fix complete: CLI auth updated

# 4. Verify coordination
cat repos/metabob-opencode/.metabob/logs/self-healing-audit.jsonl | grep coordination | jq
```

### Test 3: Self-Diagnosis

Watch an agent diagnose and fix its own issues:

```bash
# 1. Cause agent to become unhealthy (high memory usage)
docker exec devbob-opencode bun run memory-stress-test.ts

# 2. Watch self-diagnosis
docker logs -f devbob-opencode | grep -E 'self-diagnosis|watchdog'

# 3. Expected output:
# [T+0min] Health check: degraded (memory utilization 95%)
# [T+1min] Self-diagnosis: high memory usage detected
# [T+2min] Analyzing: metabob_get_priority_issues()
# [T+3min] Found issue: inefficient impulse loading
# [T+4min] Executing fix: optimize impulse lifecycle
# [T+7min] Fix applied
# [T+8min] Health recovered: memory utilization 60%
```

## Monitoring Dashboard

View real-time self-healing status:

```bash
# Terminal UI dashboard
bun run scripts/self-healing-dashboard.ts

# Output:
# ╔══════════════════════════════════════════════════════╗
# ║          Self-Healing System Dashboard               ║
# ╚══════════════════════════════════════════════════════╝
#
# System Health: ✅ HEALTHY
# 
# Recent Fix Attempts (Last 10):
# ────────────────────────────────────────────────────────
# ✅ [12:30] Memory leak fix (devbob-opencode) - 8min
# ✅ [12:15] Auth timeout fix (devbob-opencode) - 5min
# ❌ [12:00] Test failure fix (devbob-cli) - 10min (FAILED)
# ✅ [11:45] Performance fix (devbob-rpc-api) - 12min
#
# Success Rate by Agent:
# ────────────────────────────────────────────────────────
# devbob-opencode:  85% (17/20)
# devbob-cli:       75% (15/20)
# devbob-rpc-api:   90% (18/20)
#
# Active Issues:
# ────────────────────────────────────────────────────────
# 🔴 HIGH: API rate limiting issue (devbob-rpc-api)
# 🟡 MEDIUM: Slow test execution (devbob-cli)
#
# Coordination Messages:
# ────────────────────────────────────────────────────────
# 📨 opencode → cli: Auth update (pending)
# 📨 rpc-api → dashboard: API contract change (processed)
```

## Metrics Endpoints

Query self-healing metrics:

```bash
# Prometheus format
curl http://localhost:3004/metrics | grep selfhealing

# JSON format (custom endpoint)
curl http://localhost:3004/selfhealing/metrics | jq

# Output:
{
  "issuesDetected": {
    "total": 45,
    "byLevel": {
      "HIGH": 12,
      "MEDIUM": 33
    }
  },
  "fixesAttempted": {
    "total": 38,
    "successful": 32,
    "failed": 6,
    "successRate": 0.84
  },
  "avgFixDuration": 420000,
  "coordinationMessages": {
    "sent": 15,
    "processed": 12,
    "pending": 3
  },
  "systemHealth": {
    "coordinator": "healthy",
    "watchdogs": {
      "devbob-opencode": "healthy",
      "devbob-cli": "healthy",
      "devbob-rpc-api": "healthy"
    }
  }
}
```

## Audit Trail

Query self-healing audit logs:

```bash
# View all fix attempts today
cat repos/metabob-opencode/.metabob/logs/self-healing-audit.jsonl | \
  jq 'select(.timestamp > (now - 86400)) | {event, agent, issue: .issue.category, result: .fix.commitSha}'

# View cross-agent coordination
cat repos/metabob-opencode/.metabob/logs/self-healing-audit.jsonl | \
  jq 'select(.coordination.messagesFor | length > 0)'

# View fix failures
cat repos/metabob-opencode/.metabob/logs/self-healing-audit.jsonl | \
  jq 'select(.event == "self_healing_fix_failed")'
```

## Configuration

Tune self-healing behavior in `configs/devbob-config.json`:

```json
{
  "selfHealing": {
    "enabled": true,
    "coordinator": {
      "pollIntervalSeconds": 60,
      "issueDetectionThresholds": {
        "minSeverity": "MEDIUM",
        "minConfidence": 0.7
      },
      "agentRouting": {
        "defaultAgent": "devbob-opencode",
        "specializations": {
          "activity": "devbob-opencode",
          "cli": "devbob-cli",
          "api": "devbob-rpc-api",
          "ui": "devbob-dashboard"
        }
      }
    },
    "watchdog": {
      "pollIntervalSeconds": 30,
      "maxConcurrentFixes": 1,
      "fixTimeout": 600,
      "autoCommit": true,
      "requireTests": true
    },
    "coordination": {
      "messagePollingIntervalSeconds": 60,
      "messageExpiryHours": 24,
      "maxMessageHops": 3
    },
    "safety": {
      "maxFixesPerHour": 5,
      "requireApprovalFor": ["core-infrastructure"],
      "enableRollback": true
    }
  }
}
```

## Troubleshooting

### Issue: Watchdog not starting

```bash
# Check watchdog logs
docker logs devbob-opencode | grep watchdog

# Check if process is running
docker exec devbob-opencode ps aux | grep watchdog

# Restart container
docker restart devbob-opencode
```

### Issue: Fix directives not being picked up

```bash
# Check coordinator is running
curl http://localhost:3004/selfhealing/status

# Check watchdog polling
docker logs devbob-opencode | grep 'checking for directives'

# Verify configuration
docker exec devbob-opencode cat /workspace/opencode.json | jq '.selfHealing'
```

### Issue: Cross-agent messages not delivered

```bash
# Check metabob annotations
curl http://localhost:3004/metabob/annotations | jq '.[] | select(.reason | contains("MESSAGE_FOR"))'

# Check message poller
docker logs devbob-cli | grep 'polling for messages'

# Verify metabob MCP connection
docker exec devbob-cli bun run test-metabob-mcp.ts
```

## Next Steps

1. **Tune thresholds**: Adjust detection thresholds based on false positive rate
2. **Add custom routing**: Extend agent routing for domain-specific issues
3. **Expand coverage**: Add more activity templates for common fix patterns
4. **Enable learning**: Let system learn from successful fixes (metabob annotations)
5. **Add approval gates**: Require human approval for critical fixes

## Architecture Reference

See [SELF_HEALING_DEVBOB_ARCHITECTURE.md](./SELF_HEALING_DEVBOB_ARCHITECTURE.md) for:
- Complete system architecture
- Component specifications
- Integration patterns
- Security considerations
- Full implementation roadmap

## Success Metrics

Track these KPIs to measure self-healing effectiveness:

- **MTTD (Mean Time to Detection)**: < 5 minutes ✅
- **MTTR (Mean Time to Resolution)**: < 10 minutes ✅
- **Fix Success Rate**: > 80% ✅
- **False Positive Rate**: < 10% ✅
- **Coverage**: > 70% of issues auto-fixable ✅

## Support

For issues or questions:
1. Check audit logs: `.metabob/logs/self-healing-audit.jsonl`
2. Review architecture doc: `docs/SELF_HEALING_DEVBOB_ARCHITECTURE.md`
3. Run diagnostics: `bun run scripts/diagnose-self-healing.ts`
