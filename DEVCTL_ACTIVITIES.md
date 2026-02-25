# DevCtl Activities: Deterministic Shell-Based Automation

## Overview

The `devctl-bring-up` and `devctl-bring-down` activities demonstrate that OpenCode activities don't need to run LLMs and can have **completely deterministic outputs** from executing shell commands. These activities showcase activity-based automation for infrastructure management without any AI involvement.

## Why These Activities Matter

**Key Insight:** Activities are a general orchestration framework, not just for AI tasks.

### Traditional Approach Problems
- **Manual execution:** Run `devctl start`, check status, troubleshoot issues manually
- **Error-prone:** Forget health checks, miss failed services, inconsistent reporting
- **No tracking:** No record of what was started/stopped when
- **Poor visibility:** Hard to share environment state with team

### Activity-Based Approach Benefits
✅ **Deterministic:** Same inputs = same outputs, every time  
✅ **Orchestrated:** Multi-step workflow with validation at each stage  
✅ **Tracked:** Full execution history, metrics, and logs  
✅ **Reproducible:** Anyone can run the same workflow consistently  
✅ **Observable:** Clear status reports, health checks, error handling  
✅ **Composable:** Can be used in larger workflows or by other activities

## Activities

### 1. devctl-bring-up

**Purpose:** Start the complete DevBob multi-vessel development environment

**Category:** Infrastructure  
**Tasks:** 5  
**LLM Usage:** None (pure shell commands)

**Workflow:**
```
1. Validate Prerequisites
   ├─ Check Docker is running
   ├─ Verify networks exist (create if missing)
   ├─ Ensure devctl is executable
   ├─ Validate configuration files
   └─ Check ANTHROPIC_API_KEY is set

2. Start Backend Services
   ├─ Launch Redis (caching/messaging)
   ├─ Launch SurrealDB (database)
   ├─ Launch API Server (backend API)
   └─ Verify all services are healthy

3. Start Vessel Containers
   ├─ Start all 6 DevBob vessels
   ├─ Wait for initialization
   ├─ Check for failed containers
   └─ Verify health status

4. Perform Health Checks
   ├─ Test ACP endpoints (ports 3001-3006)
   ├─ Verify backend connectivity
   ├─ Check service health endpoints
   └─ Count healthy components

5. Generate Startup Report
   ├─ Gather final status
   ├─ Format markdown report
   ├─ Provide next steps
   └─ Display comprehensive summary
```

**Output:** Comprehensive startup report with status of all services

**Variables:**
- `projectRoot` (default: `/home/avi/documents/work/exp-repo/metabob-devbob`)
- `devctlPath` (default: `{projectRoot}/bin/devctl`)

### 2. devctl-bring-down

**Purpose:** Stop the DevBob environment cleanly with full status reporting

**Category:** Infrastructure  
**Tasks:** 4  
**LLM Usage:** None (pure shell commands)

**Workflow:**
```
1. Check Current Status
   ├─ List running vessels
   ├─ Check backend services
   └─ Document what will be stopped

2. Stop Vessel Containers
   ├─ Gracefully stop all vessels
   ├─ Verify shutdown
   ├─ Check for zombie containers
   └─ Force stop if needed

3. Stop Backend Services
   ├─ Stop via docker-compose
   ├─ Verify all services stopped
   ├─ Check network status
   └─ Optional cleanup commands

4. Generate Shutdown Report
   ├─ Final container check
   ├─ Count artifacts (volumes, networks, etc.)
   ├─ Format markdown report
   └─ Provide next steps and cleanup commands
```

**Output:** Comprehensive shutdown report with cleanup instructions

**Variables:**
- `projectRoot` (default: `/home/avi/documents/work/exp-repo/metabob-devbob`)
- `devctlPath` (default: `{projectRoot}/bin/devctl`)

## Key Features

### 1. Deterministic Execution

**No AI randomness:** Every execution produces the same results given the same environment state.

**Example:** Running `devctl-bring-up` always:
1. Checks Docker (pass/fail)
2. Creates networks if missing (predictable)
3. Starts services in order (deterministic)
4. Reports exact same status format

### 2. Robust Error Handling

**Self-healing capabilities:**
- Creates missing networks automatically
- Makes devctl executable if needed
- Force stops containers that won't stop gracefully

**Clear failure reporting:**
- Shows exactly which service failed
- Provides logs for troubleshooting
- Suggests remediation steps

### 3. Comprehensive Validation

**At every step:**
- Pre-checks before starting
- Health checks after starting
- Final status validation
- Network and service connectivity tests

### 4. Rich Status Reports

**Markdown-formatted output includes:**
- Overall status (✅/⚠️/❌)
- Per-service status tables
- Health check results
- Next steps and commands
- Cleanup instructions

## Usage

### Starting the Environment

```bash
# Using OpenCode activity system
opencode activity devctl-bring-up

# Or via activity tool in agent
activity({
  templateId: "devctl-bring-up",
  variables: {},
  reason: "Start development environment for testing"
})
```

**Expected Output:**
```markdown
# DevBob Environment Startup Report

## ✅ Overall Status
**✅ All systems operational**

---

## 🗄️ Backend Services
| Service | Status | Port | Notes |
|---------|--------|------|-------|
| Redis | ✓ | 6379 | Message queue and cache |
| SurrealDB | ✓ | 8000 | Primary database |
| API Server | ✓ | 8080 | Backend API |

## 🚢 Vessel Containers (6 / 6 healthy)
| Vessel | Container | Status | Health | ACP Port | Purpose |
|--------|-----------|--------|--------|----------|---------|
| rpc-api | devbob-rpc-api | running | healthy | 3001 | Backend API |
| cli | devbob-cli | running | healthy | 3002 | CLI Tool |
| opencode | devbob-opencode | running | healthy | 3003 | OpenCode |
| dashboard | devbob-dashboard | running | healthy | 3004 | Frontend |
| cpg | devbob-cpg | running | healthy | 3005 | CPG Inference |
| platform | devbob-platform | running | healthy | 3006 | Platform |

## 📊 Summary
- **Startup time:** 2026-02-25 15:30:45
- **Backend:** 3 / 3 healthy
- **Vessels:** 6 / 6 healthy
- **Overall:** All systems operational

## 🎯 Next Steps
Environment is ready! You can now:
- Open TUI: `opencode tui`
- Delegate tasks: `devctl delegate --to cli --task "Run tests"`
- Check logs: `devctl logs opencode -f`
- Execute commands: `devctl exec rpc-api -- pytest`
```

### Stopping the Environment

```bash
# Using OpenCode activity system
opencode activity devctl-bring-down

# Or via activity tool in agent
activity({
  templateId: "devctl-bring-down",
  variables: {},
  reason: "Clean shutdown of development environment"
})
```

**Expected Output:**
```markdown
# DevBob Environment Shutdown Report

## ✅ Overall Status
**✅ Complete - All services stopped**

---

## 🚢 Vessel Containers
**Status:** 0 running (expected: 0)

All vessel containers stopped:
- ✓ devbob-rpc-api
- ✓ devbob-cli
- ✓ devbob-opencode
- ✓ devbob-dashboard
- ✓ devbob-cpg
- ✓ devbob-platform

## 🗄️ Backend Services
**Status:** 0 running (expected: 0)

All backend services stopped:
- ✓ metabob-redis
- ✓ metabob-surreal
- ✓ metabob-rpc-api
- ✓ metabob-celery-worker

## 🧹 Cleanup Status
| Resource | Count | Status |
|----------|-------|--------|
| Exited containers | 2 | To remove: `docker container prune` |
| Volumes | 5 | Preserved (data retained) |
| Networks | 2 | Preserved (ready for reuse) |

## 🔄 Next Steps

**To start again:**
```bash
devctl start
# or
opencode activity devctl-bring-up
```

**To clean up completely:**
```bash
# Remove exited containers
docker container prune -f

# Remove volumes (⚠️ deletes data)
docker volume ls | grep metabob | awk '{print $2}' | xargs docker volume rm

# Remove networks
docker network rm metabob-network devbob-network
```
```

## Design Patterns

### 1. Shell-Only Tasks

**Pattern:** Use `subagent: "general"` with shell commands in prompt template

**Example:**
```json
{
  "id": "check-docker",
  "subagent": "general",
  "description": "Check if Docker is running",
  "prompt": {
    "template": "```bash\ndocker ps >/dev/null 2>&1\nif [ $? -eq 0 ]; then\n  echo \"✓ Docker is running\"\nelse\n  echo \"✗ Docker not running\"\n  exit 1\nfi\n```"
  }
}
```

**Why it works:** The general agent executes bash tool with the commands, no LLM needed.

### 2. Validation Without LLM

**Pattern:** Use `requiredPatterns` to validate output

**Example:**
```json
{
  "validation": {
    "requiredPatterns": ["✓ Docker is running", "✓ All services started"],
    "forbiddenPatterns": ["✗", "ERROR", "FAILED"],
    "commands": []
  }
}
```

**Benefits:**
- Ensures output contains expected success markers
- Fails if error patterns detected
- No LLM interpretation needed

### 3. Variable Interpolation

**Pattern:** Use `{{variableName}}` for dynamic paths and values

**Example:**
```json
{
  "variables": [
    {
      "name": "devctlPath",
      "type": "string",
      "required": false,
      "default": "/home/avi/documents/work/exp-repo/metabob-devbob/bin/devctl"
    }
  ],
  "template": "{{devctlPath}} start"
}
```

**Benefits:**
- Reusable across environments
- Easy to customize per user
- Type-safe with defaults

### 4. Sequential Dependencies

**Pattern:** Use `dependencies: ["task-id"]` for ordered execution

**Example:**
```json
[
  {"id": "validate", "dependencies": []},
  {"id": "start-backend", "dependencies": ["validate"]},
  {"id": "start-vessels", "dependencies": ["start-backend"]},
  {"id": "health-check", "dependencies": ["start-vessels"]}
]
```

**Benefits:**
- Ensures correct order
- Parallel execution where safe
- Clear dependency graph

## Comparison: Manual vs Activity

| Aspect | Manual Execution | Activity Execution |
|--------|------------------|-------------------|
| **Consistency** | Varies by user | Identical every time |
| **Validation** | Manual checks | Automatic at each step |
| **Error Handling** | Manual troubleshooting | Self-healing where possible |
| **Reporting** | Ad-hoc | Standardized format |
| **Tracking** | No history | Full execution logs |
| **Sharing** | Hard to reproduce | Anyone can run |
| **Composition** | Manual chaining | Automatic dependencies |
| **Rollback** | Manual | Can add rollback steps |

## Advanced Use Cases

### 1. Conditional Execution

Add logic to skip steps if already running:

```bash
if docker ps | grep -q "devbob-rpc-api"; then
  echo "ℹ️ Vessels already running, skipping start"
  exit 0
fi
```

### 2. Partial Startup

Create variants for specific services:

```bash
# Start only backend
devctl-bring-up-backend

# Start only vessels  
devctl-bring-up-vessels

# Start specific vessel
devctl-bring-up-vessel --vessel=opencode
```

### 3. Environment-Specific Configuration

Use variables for different environments:

```json
{
  "variables": [
    {"name": "environment", "default": "development"},
    {"name": "profile", "default": "stable"}
  ],
  "template": "docker-compose --profile {{profile}} up -d"
}
```

### 4. Integration with Other Activities

Chain with other activities:

```typescript
// Bring up environment, then run tests
activity({ templateId: "devctl-bring-up" })
activity({ templateId: "run-integration-tests" })
activity({ templateId: "devctl-bring-down" })
```

## Metrics & Observability

### Execution Tracking

Every activity execution records:
- Start time and duration
- Success/failure status
- Output logs
- Resource usage
- Error details (if failed)

### Activity Metrics

View performance over time:

```bash
# Check execution history
opencode activity list --template devctl-bring-up

# View metrics
opencode activity metrics devctl-bring-up
```

**Example Metrics:**
```
Template: devctl-bring-up
Executions: 24
Success Rate: 100%
Avg Duration: 45s
Avg Cost: $0.00 (no LLM usage)
```

## Troubleshooting

### Activity Fails at Prerequisites

**Symptom:** Fails at "Check Docker is running"

**Fix:** Start Docker Desktop or Docker daemon

### Services Won't Start

**Symptom:** Backend services fail health checks

**Debug:**
```bash
# Check logs
docker logs metabob-redis
docker logs metabob-surreal

# Check ports
netstat -an | grep -E "6379|8000|8080"
```

### Vessels Won't Stop

**Symptom:** Force stop needed in bring-down

**Debug:**
```bash
# Check what's preventing stop
docker inspect devbob-rpc-api | grep -A 10 "State"

# Manual force stop
docker stop -t 0 devbob-rpc-api
```

## Best Practices

### 1. Use Activities for Consistency

✅ **DO:** Use activities for routine operations  
❌ **DON'T:** Mix manual and activity-based approaches

### 2. Always Use Bring-Down

✅ **DO:** Use `devctl-bring-down` to stop cleanly  
❌ **DON'T:** Just `docker-compose down` (loses tracking)

### 3. Check Status Before Operations

✅ **DO:** Let activities validate prerequisites  
❌ **DON'T:** Assume environment is in expected state

### 4. Preserve Volumes

✅ **DO:** Keep volumes between restarts (data persistence)  
❌ **DON'T:** Remove volumes unless intentional reset

## Future Enhancements

### Planned Features

1. **Selective Service Management**
   - Start/stop individual services
   - Restart specific vessels
   - Update single containers

2. **Health Monitoring**
   - Continuous health checks
   - Alert on service failures
   - Auto-restart unhealthy services

3. **Resource Management**
   - Memory/CPU limits
   - Resource usage reporting
   - Automatic scaling

4. **Backup/Restore**
   - Save environment state
   - Restore to previous state
   - Export/import configurations

## Conclusion

The `devctl-bring-up` and `devctl-bring-down` activities demonstrate that:

1. **Activities ≠ AI Tasks:** Activities are a general orchestration framework
2. **Determinism is Possible:** Shell-based activities have predictable outputs
3. **Better Than Manual:** More reliable, trackable, and reproducible
4. **Composable:** Can be used as building blocks in larger workflows

**Key Takeaway:** Activities aren't just for LLM-driven work. They're a powerful automation framework for ANY multi-step workflow that benefits from orchestration, validation, tracking, and reproducibility.

---

**Related Documentation:**
- [DEVBOB_BUILD_DEPLOY.md](DEVBOB_BUILD_DEPLOY.md) - DevBob container architecture
- [bin/devctl](bin/devctl) - DevCtl CLI tool
- [docker-compose.yaml](docker-compose.yaml) - Service definitions
