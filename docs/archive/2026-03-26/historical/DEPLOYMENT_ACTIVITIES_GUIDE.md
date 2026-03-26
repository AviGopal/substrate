# DevBob Deployment & Management Activities Guide

## Overview

This guide documents the activity templates for deploying, managing, and interacting with the DevBob platform. These activities automate complex workflows for infrastructure deployment, job submission, and multi-agent coordination.

## Activity Templates

### 1. Deploy DevBob Stack (`deploy-devbob-stack`)

**Purpose**: Complete end-to-end deployment of DevBob infrastructure

**What it does**:
- Validates deployment prerequisites (Docker, environment variables, resources)
- Starts infrastructure services (Redis, SurrealDB, Surrealist)
- Deploys Metabob backend (API server, celery worker)
- Deploys devbob agent containers
- Validates deployment health and generates comprehensive report

**Required Variables**:
- None (all have defaults)

**Optional Variables**:
- `devbobImage`: Docker image name (default: `devbob:unified-test`)
- `composeFile`: Path to docker-compose file (default: `docker-compose.unified.yaml`)
- `profile`: Deployment profile (default: `all`)
- `reportPath`: Where to save deployment report (default: `deployment-report.md`)
- `runTestFlow`: Run end-to-end test flow (default: `false`)

**Usage**:
```bash
# Full deployment with defaults
opencode activity execute deploy-devbob-stack

# Custom deployment
opencode activity execute deploy-devbob-stack \
  --variables '{
    "devbobImage": "devbob:latest",
    "profile": "all",
    "runTestFlow": true,
    "reportPath": "deployment-report-$(date +%Y%m%d).md"
  }'
```

**Output**:
- Deployment report with service statuses, health checks, resource usage
- Connection strings for all services
- Recommendations and next steps

**Tasks**:
1. `validate-prerequisites` - Check Docker, env vars, ports, resources
2. `start-infrastructure` - Start Redis, SurrealDB, Surrealist
3. `start-metabob-backend` - Start API server and worker
4. `deploy-devbob-containers` - Deploy agent containers
5. `validate-deployment` - Comprehensive validation and reporting

---

### 2. Delegate to DevBob (`delegate-to-devbob`)

**Purpose**: Delegate tasks to specific devbob containers via ACP protocol

**What it does**:
- Validates target container is ready
- Prepares and serializes impulses for sharing
- Executes ACP delegation with monitoring
- Analyzes results and provides recommendations

**Required Variables**:
- `target`: Target container (format: `docker://container-name`)
- `taskDescription`: Brief task summary (3-10 words)
- `prompt`: Full task instructions for remote agent

**Optional Variables**:
- `shareImpulses`: Array of impulse IDs to share (default: `[]`)
- `sendFullContent`: Send full content vs. pointers (default: `false`)
- `timeout`: Timeout in seconds (default: `300`, max: `600`)
- `saveReport`: Save analysis report to file (default: `false`)

**Usage**:
```bash
# Simple delegation
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-clean",
    "taskDescription": "List activity templates",
    "prompt": "List all available activity templates and their categories"
  }'

# With impulse sharing
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-rpc-api",
    "taskDescription": "Implement API endpoint",
    "prompt": "Implement the REST endpoint defined in the shared design",
    "shareImpulses": ["api-design", "requirements"],
    "timeout": 600,
    "saveReport": true
  }'

# With full content (for self-contained execution)
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-dashboard",
    "taskDescription": "Fix UI bug",
    "prompt": "Fix the button alignment issue in the dashboard",
    "shareImpulses": ["bug-report", "ui-spec"],
    "sendFullContent": true
  }'
```

**Output**:
- Remote session tracking impulse
- Response text from remote agent
- Tool calls executed remotely
- Analysis report with recommendations
- Optional saved report file

**Tasks**:
1. `validate-target` - Check container is running and ready
2. `prepare-impulses` - Serialize impulses for sharing
3. `execute-delegation` - Execute ACP delegation and track
4. `analyze-results` - Analyze results and generate recommendations

**Use Cases**:
- **Code modification**: Delegate implementation tasks to codebase-specific containers
- **Isolated testing**: Run tests in clean environment
- **Parallel work**: Multiple agents work simultaneously on different codebases
- **Context sharing**: Share designs, requirements, analysis across agents

---

### 3. Submit Analysis Job (`submit-analysis-job`)

**Purpose**: Submit code analysis job to Metabob backend and monitor until completion

**What it does**:
- Validates project path and prepares submission payload
- Submits analysis job to backend
- Monitors job progress with real-time updates
- Retrieves and processes results when complete
- Generates summary reports and exports

**Required Variables**:
- `projectPath`: Path to project root for analysis

**Optional Variables**:
- `filePatterns`: Glob patterns for files (default: `["**/*.py", "**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx"]`)
- `analysisType`: Type of analysis - `full`, `incremental`, `focused` (default: `full`)
- `priority`: Job priority - `low`, `normal`, `high` (default: `normal`)
- `annotations`: Annotation types - `all`, `security`, `bugs`, `style`, `performance` (default: `all`)
- `includeTests`: Include test files (default: `true`)
- `backendUrl`: Backend URL (default: `http://localhost:8080`)
- `monitoringMode`: Monitoring mode - `active`, `background`, `milestone` (default: `active`)
- `monitorTimeout`: Max monitoring time in seconds (default: `600`)
- `pollInterval`: Poll interval in seconds (default: `5`)
- `filterSeverity`: Minimum severity - `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` (default: `LOW`)
- `exportFormats`: Export formats array (default: `["json", "markdown"]`)

**Usage**:
```bash
# Simple analysis with defaults
opencode activity execute submit-analysis-job \
  --variables '{
    "projectPath": "/workspace/my-project"
  }'

# Custom analysis with filtering
opencode activity execute submit-analysis-job \
  --variables '{
    "projectPath": "/workspace/backend",
    "filePatterns": ["src/**/*.py"],
    "analysisType": "focused",
    "priority": "high",
    "annotations": "security",
    "includeTests": false,
    "filterSeverity": "HIGH",
    "exportFormats": ["json", "markdown", "csv"]
  }'

# Background monitoring (fire and forget)
opencode activity execute submit-analysis-job \
  --variables '{
    "projectPath": "/workspace/large-project",
    "monitoringMode": "background",
    "monitorTimeout": 3600
  }'

# Milestone monitoring (less verbose)
opencode activity execute submit-analysis-job \
  --variables '{
    "projectPath": "/workspace/frontend",
    "filePatterns": ["**/*.ts", "**/*.tsx"],
    "monitoringMode": "milestone",
    "pollInterval": 30
  }'
```

**Output**:
- Job ID and session ID
- Real-time progress updates (status, progress %, current file)
- Results JSON: `results-{jobId}.json`
- Summary report: `analysis-summary-{jobId}.md`
- Optional CSV export: `issues-{jobId}.csv`

**Tasks**:
1. `prepare-job-submission` - Validate inputs and prepare payload
2. `submit-job` - Submit to backend API
3. `monitor-job-progress` - Monitor with real-time updates
4. `retrieve-results` - Fetch and process results

**Monitoring Modes**:
- **Active**: Poll continuously, real-time updates, wait for completion
- **Background**: Check once, return job ID, don't wait
- **Milestone**: Check at 25%, 50%, 75%, 100%, less verbose

---

## Common Workflows

### Full Deployment from Scratch

```bash
# 1. Deploy complete stack
opencode activity execute deploy-devbob-stack \
  --variables '{
    "profile": "all",
    "runTestFlow": true,
    "reportPath": "deployment-report.md"
  }'

# 2. Verify deployment
cat deployment-report.md

# 3. Test delegation
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-clean",
    "taskDescription": "Test connectivity",
    "prompt": "Run a simple test to verify all systems are working"
  }'
```

### Multi-Agent Development Workflow

```bash
# 1. Create design impulse
impulse create api-design "REST API design document" --type memo

# 2. Delegate backend implementation
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-rpc-api",
    "taskDescription": "Implement backend API",
    "prompt": "Implement the endpoints defined in the API design",
    "shareImpulses": ["api-design"],
    "timeout": 600
  }'

# 3. Delegate frontend implementation (parallel)
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-dashboard",
    "taskDescription": "Implement frontend",
    "prompt": "Create UI components for the API endpoints",
    "shareImpulses": ["api-design"],
    "timeout": 600
  }'

# 4. Run analysis on changes
opencode activity execute submit-analysis-job \
  --variables '{
    "projectPath": "/workspace",
    "analysisType": "incremental",
    "priority": "high"
  }'
```

### Code Quality Analysis Pipeline

```bash
# 1. Submit full analysis
opencode activity execute submit-analysis-job \
  --variables '{
    "projectPath": "/workspace/my-project",
    "analysisType": "full",
    "annotations": "all",
    "monitoringMode": "active",
    "filterSeverity": "HIGH",
    "exportFormats": ["json", "markdown", "csv"]
  }'

# 2. Review results
cat analysis-summary-{jobId}.md

# 3. Delegate fixes to appropriate containers
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-clean",
    "taskDescription": "Fix critical security issues",
    "prompt": "Fix the critical security issues found in analysis",
    "shareImpulses": ["analysis-results"],
    "timeout": 900
  }'

# 4. Re-run analysis to verify fixes
opencode activity execute submit-analysis-job \
  --variables '{
    "projectPath": "/workspace/my-project",
    "analysisType": "incremental",
    "filterSeverity": "HIGH"
  }'
```

## Architecture

### Service Ports

| Service | Port | Protocol | Description |
|---------|------|----------|-------------|
| Redis | 6379 | TCP | Key-value store |
| SurrealDB | 8000 | HTTP | Database |
| Surrealist | 8001 | HTTP | DB UI |
| Metabob API | 8080 | HTTP | Backend API |
| devbob-clean | 3100 | ACP | Clean agent |
| devbob-rpc-api | 3101 | ACP | Backend agent |
| devbob-dashboard | 3102 | ACP | Frontend agent |

### Deployment Profiles

**Infrastructure** (`--profile infra`):
- Redis
- SurrealDB
- Surrealist UI

**Metabob** (`--profile metabob`):
- API server
- Celery worker
- Requires: infrastructure

**DevBob** (`--profile devbob`):
- devbob-clean
- devbob-rpc-api
- devbob-dashboard
- Requires: infrastructure, metabob

**All** (`--profile all`):
- Everything above

### Container Communication

```
┌─────────────────────────────────────────────────────────┐
│ Host Machine                                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  OpenCode CLI                                           │
│       │                                                  │
│       │ acp_delegate                                    │
│       ├──────────────┬──────────────┬──────────────┐   │
│       ↓              ↓              ↓              ↓   │
│  devbob-clean   devbob-rpc-api  devbob-dashboard      │
│   (port 3100)     (port 3101)     (port 3102)          │
│       │              │              │                   │
│       └──────────────┴──────────────┘                   │
│                      ↓                                   │
│              metabob-rpc-api                            │
│                 (port 8080)                             │
│                      ↓                                   │
│         ┌───────────┴───────────┐                      │
│         ↓                       ↓                      │
│      Redis                  SurrealDB                  │
│    (port 6379)              (port 8000)                │
└─────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Container Not Ready

If delegation fails with "container not ready":

```bash
# Check container status
docker ps --filter name=devbob-

# Check container logs
docker logs devbob-clean --tail 50

# Look for "ACP server listening"
docker logs devbob-clean 2>&1 | grep "ACP server listening"

# Restart if needed
docker restart devbob-clean
```

### Job Submission Fails

If job submission fails:

```bash
# Check backend health
curl http://localhost:8080/health

# Check backend logs
docker logs metabob-rpc-api --tail 100

# Verify authentication
echo $ANTHROPIC_API_KEY

# Check SurrealDB connection
docker exec metabob-surreal /surreal isready
```

### Impulse Sharing Issues

If impulse sharing fails:

- **Pointer-only mode** (default): Host session must stay active for Phase 3 resolution
- **Full content mode**: Use `"sendFullContent": true` for self-contained execution
- Check impulse IDs are valid: `impulse list`
- Verify impulse content is loaded: `impulse load <id>`

## Best Practices

### 1. Use Appropriate Containers

- **devbob-clean**: Testing, isolated experiments, general tasks
- **devbob-rpc-api**: Backend code changes, API development
- **devbob-dashboard**: Frontend code changes, UI development

### 2. Share Context Efficiently

- **Pointer-only** (default): Fast, efficient, requires host active
- **Full content**: Self-contained, larger payload, host can disconnect

### 3. Monitor Long-Running Jobs

- Use `monitoringMode: "background"` for very long analyses
- Set appropriate `monitorTimeout` based on project size
- Use `pollInterval` to balance responsiveness vs. API load

### 4. Filter Results

- Use `filterSeverity: "HIGH"` to focus on critical issues
- Use `annotations: "security"` for security-focused analysis
- Export to CSV for spreadsheet analysis

## Files Created

### By deploy-devbob-stack
- `deployment-report.md` - Comprehensive deployment validation report

### By delegate-to-devbob
- `delegation-report-{timestamp}.md` - Delegation analysis (if saveReport=true)

### By submit-analysis-job
- `results-{jobId}.json` - Raw analysis results
- `analysis-summary-{jobId}.md` - Human-readable summary
- `issues-{jobId}.csv` - CSV export (if requested)

## Next Steps

1. **Deploy**: Run `deploy-devbob-stack` to set up infrastructure
2. **Test**: Use `delegate-to-devbob` to verify containers work
3. **Analyze**: Submit jobs with `submit-analysis-job`
4. **Iterate**: Use delegation for fixes, re-run analysis to verify

## Support

For issues or questions:
- Check container logs: `docker logs <container-name>`
- Review deployment report: `cat deployment-report.md`
- Verify network: `docker network inspect metabob-network`
- Check resources: `docker stats --no-stream`

---

**Created**: 2026-02-26  
**Version**: 1.0  
**Activities**: deploy-devbob-stack, delegate-to-devbob, submit-analysis-job
