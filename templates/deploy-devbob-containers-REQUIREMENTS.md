# Activity Requirements: Deploy DevBob Container System

## Overview

This activity automates the complete DevBob multi-container deployment workflow using docker-compose. It validates environment configuration, builds optimized Docker images, orchestrates backend and agent services with proper dependency ordering, validates health checks, and tests connectivity across all services. The workflow systematizes a manual 15-step process that previously required 10-15 minutes into a validated, repeatable activity suitable for development, testing, and production environments.

**Context:** Based on comprehensive deployment flow analysis documented in `docs/data-flows/devbob-container-deployment-and-activity-updates-flow.md`, this activity addresses the 5 critical issues identified for production readiness: missing .dockerignore validation, hardcoded secrets detection, missing health check timeouts, race condition prevention, and unnecessary dependency cleanup.

## Workflow Steps

### Phase 1: Environment Validation (Sequential)
1. **Validate Environment Variables**: Check that all required environment variables are set (Dependencies: none)
   - `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (at least one required)
   - `METABOB_API_URL` (backend connection)
   - `METABOB_PROJECT_ID` (multi-agent coordination)

2. **Validate Configuration Files**: Verify that required configuration files exist and are valid (Dependencies: Task 1)
   - `.env.devbob.example` exists as reference
   - `.dockerignore` exists (context optimization)
   - `docker-compose.yaml` exists and is valid YAML
   - `configs/opencode.devbob.json` template exists for envsubst

3. **Validate Docker Environment**: Check Docker daemon availability and networks (Dependencies: Task 2)
   - Docker daemon is running
   - Docker Compose is installed
   - Required networks exist: `metabob-network`, `devbob-network`
   - Required base images are accessible

### Phase 2: Build Preparation (Sequential)
4. **Verify .dockerignore Optimization**: Validate that .dockerignore reduces context by >80% (Dependencies: Task 3)
   - Calculate full directory size
   - Calculate filtered directory size (respecting .dockerignore)
   - Verify reduction >= 80% (per deployment analysis: achieved 86% reduction)
   - Report context size metrics

5. **Validate OpenCode Config Template**: Test envsubst substitution with current environment (Dependencies: Task 1)
   - Read `configs/opencode.devbob.json` template
   - Perform envsubst substitution
   - Validate resulting JSON with `jq` (syntax check)
   - Verify required fields exist: `.provider.anthropic.options.apiKey` or `.provider.openai.apiKey`
   - Check for injection patterns (e.g., `", "malicious": true`)

### Phase 3: Backend Service Deployment (Sequential with Health Gates)
6. **Start Backend Services**: Launch stable profile (Redis, SurrealDB, API server, Celery) (Dependencies: Task 5)
   - `docker-compose --profile stable up -d`
   - Wait for Redis health check (max 50s: 5 retries × 10s interval)
   - Wait for SurrealDB health check (max 60s: 5 retries × 10s interval + 10s start_period)
   - Wait for API server health check (max 180s: 5 retries × 30s interval + 30s start_period)
   - Wait for Celery worker startup (30s grace period)

7. **Validate Backend Connectivity**: Test that all backend services respond (Dependencies: Task 6)
   - `curl -f http://localhost:6379/ping` (Redis)
   - `curl -f http://localhost:8000/health` (SurrealDB)
   - `curl -f http://localhost:8080/health` (API server)
   - Verify HTTP 200 responses

### Phase 4: DevBob Agent Deployment (Parallel after Backend Ready)
8. **Deploy DevBob Containers**: Start selected profile with proper dependencies (Dependencies: Task 7)
   - If `deploymentProfile=devbob`: `docker-compose --profile stable --profile devbob up -d`
   - If `deploymentProfile=devbob-dev`: `docker-compose --profile stable --profile devbob-dev up -d`
   - Wait for container startup (60s grace period for entrypoint.sh)
   - Wait for ACP server health checks (max 180s: 5 retries × 30s interval + 60s start_period)

9. **Validate Agent Health Checks**: Ensure all DevBob containers pass health checks (Dependencies: Task 8)
   - For each agent container:
     - Check `docker inspect <container>` health status
     - Verify status = "healthy" (not "starting" or "unhealthy")
     - Retry up to 6 times with 30s intervals (max 3 minutes total)

### Phase 5: Service Connectivity Testing (Parallel after Agents Healthy)
10. **Test ACP Server Connectivity**: Verify OpenCode ACP servers are accessible (Dependencies: Task 9)
    - For `devbob-clean`: `curl -sf http://localhost:3000/config`
    - For `devbob-rpc-api`: `curl -sf http://localhost:3001/config`
    - For `devbob-cli`: `curl -sf http://localhost:3002/config`
    - For `devbob-opencode`: `curl -sf http://localhost:3003/config`
    - For `devbob-dashboard`: `curl -sf http://localhost:3004/config`
    - Validate JSON responses

11. **Test MCP Dashboard Connectivity**: Verify metabob-cli dashboards are running (Dependencies: Task 9)
    - For each agent: Test SSE endpoint `curl -sf http://localhost:<port>/events` (8082, 8083, 8084, 8085)
    - Verify HTTP 200 or SSE stream starts

12. **Test Backend Integration**: Verify agents can reach backend through Docker network (Dependencies: Task 9)
    - For each agent container: `docker exec <container> curl -sf http://metabob-rpc-api-server:8080/health`
    - Verify HTTP 200 responses from inside containers

### Phase 6: Deployment Verification (Sequential)
13. **Collect Container Logs**: Gather startup logs for debugging (Dependencies: Task 12)
    - For each running container: `docker logs --tail 100 <container>`
    - Check for ERROR or WARN messages
    - Verify "Services ready" messages in DevBob containers

14. **Report Deployment Status**: Generate comprehensive deployment report (Dependencies: Task 13)
    - Container counts by profile
    - Health check statuses
    - Network connectivity results
    - Service endpoint URLs
    - Any warnings or issues detected

### Phase 7: Documentation and Annotation (Sequential)
15. **Annotate Deployment with Metabob**: Document deployment for future reference (Dependencies: Task 14)
    - Call `metabob_annotate_component` with deployment summary
    - Document: deployment profile, Docker image versions, container count, health status
    - Include: backend API version, DevBob image tag, timestamp
    - Record: any configuration notes or manual steps required

## Input Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `deploymentProfile` | string (enum) | yes | - | Deployment profile: "stable" (backend only), "devbob" (backend + single clean agent), "devbob-dev" (backend + 4 development agents) |
| `waitForHealthChecks` | boolean | no | true | Whether to wait for all health checks to pass before proceeding |
| `healthCheckTimeout` | number | no | 300 | Maximum seconds to wait for each service health check (default: 5 minutes) |
| `validateDockerignore` | boolean | no | true | Whether to validate .dockerignore reduces context by >80% |
| `skipImageBuild` | boolean | no | false | Whether to skip Docker image build (use existing images) |
| `cleanupBeforeDeploy` | boolean | no | false | Whether to stop and remove existing containers before deployment |
| `testConnectivity` | boolean | no | true | Whether to test service connectivity after deployment |
| `annotateDeployment` | boolean | no | true | Whether to annotate deployment with Metabob for documentation |
| `logLevel` | string (enum) | no | INFO | Container log level: "DEBUG", "INFO", "WARN", "ERROR" |
| `apiVersion` | string | no | 0.16.12 | Metabob API server Docker image version |
| `devbobVersion` | string | no | latest | DevBob container Docker image version/tag |

## Expected Outputs

### Files Created
- **Deployment Report**: `/tmp/devbob-deployment-report.json` - Comprehensive deployment status
  - Profile deployed
  - Container list with health statuses
  - Network connectivity results
  - Service endpoint URLs
  - Warnings and errors
  - Timestamp and duration

### Logs and Reports
- **Startup Logs**: Last 100 lines from each container
- **Health Check Results**: Pass/fail status for each service
- **Connectivity Test Results**: HTTP status codes for each endpoint
- **Context Size Metrics**: .dockerignore effectiveness report

### State Changes
- **Docker Containers**: Running containers for selected profile
- **Docker Networks**: `metabob-network` and `devbob-network` active
- **Docker Volumes**: Persistent volumes created/mounted
- **Service Endpoints**: ACP servers, MCP dashboards, backend API accessible

## Validation Criteria

### Per-Task Validation

**Task 1: Validate Environment Variables**
- Required env vars are set and non-empty
- At least one LLM provider key present
- METABOB_API_URL is well-formed URL

**Task 2: Validate Configuration Files**
- All required files exist
- docker-compose.yaml parses as valid YAML
- No syntax errors in configuration files

**Task 3: Validate Docker Environment**
- `docker info` returns successfully
- `docker compose version` shows compatible version (>= 2.0)
- Networks exist: `docker network inspect metabob-network devbob-network`

**Task 4: Verify .dockerignore Optimization**
- Full context size calculated (du -sb .)
- Filtered context size calculated (docker build --dry-run context size)
- Reduction >= 80% confirmed

**Task 5: Validate OpenCode Config Template**
- envsubst produces valid JSON (jq validates)
- Required API keys present in substituted config
- No injection patterns detected

**Task 6: Start Backend Services**
- All 4 backend containers running (`docker ps` count)
- Redis health: `running` and `healthy`
- SurrealDB health: `running` and `healthy`
- API server health: `running` and `healthy`
- Celery worker: `running`

**Task 7: Validate Backend Connectivity**
- Redis responds to ping
- SurrealDB health endpoint returns 200
- API server health endpoint returns 200

**Task 8: Deploy DevBob Containers**
- Correct number of containers for profile (1 for devbob, 4 for devbob-dev)
- All containers in `running` state
- No restart loops (restart count = 0)

**Task 9: Validate Agent Health Checks**
- All DevBob containers show `healthy` status
- Health checks not stuck in `starting` state
- No `unhealthy` containers

**Task 10: Test ACP Server Connectivity**
- All ACP `/config` endpoints return HTTP 200
- Responses are valid JSON
- Required config fields present

**Task 11: Test MCP Dashboard Connectivity**
- All MCP dashboard ports respond
- SSE streams start or HTTP 200 returned

**Task 12: Test Backend Integration**
- All agents can reach backend from inside containers
- HTTP 200 responses from internal network calls

**Task 13: Collect Container Logs**
- Logs retrieved for all running containers
- "Services ready" or equivalent success messages found
- No FATAL errors in logs

**Task 14: Report Deployment Status**
- Report file created at expected path
- All required fields populated
- Valid JSON structure

**Task 15: Annotate Deployment with Metabob**
- Annotation created successfully
- Deployment summary includes all key metrics

### Overall Success Criteria

**Required Conditions (Must All Pass):**
1. All environment variables validated
2. All configuration files valid
3. Docker environment ready
4. All backend services healthy
5. All DevBob containers healthy (for selected profile)
6. All connectivity tests pass (if enabled)
7. Deployment report generated

**Required Files After Completion:**
- `/tmp/devbob-deployment-report.json` - Deployment summary
- Docker containers running (verify with `docker ps`)
- Docker volumes created (verify with `docker volume ls`)

**Required Patterns in Outputs:**
- Deployment report contains `"status": "success"`
- All health checks show `"healthy": true`
- All connectivity tests show `"status": 200`
- Container logs contain "Services ready" or "Started successfully"

**Forbidden Patterns (Indicate Failure):**
- `ERROR: Failed to connect` in logs
- `Health check failed` in health status
- `FATAL:` in container logs
- `connection refused` in connectivity tests
- `unhealthy` in container health status
- `exit code 1` in container status

**Success Commands (Must Pass):**
```bash
# All backend services healthy
docker inspect metabob-redis metabob-surreal api-server-dev metabob-celery-worker \
  --format '{{.State.Health.Status}}' | grep -c healthy | grep -q 4

# Correct number of DevBob containers running
docker ps --filter "name=devbob-" --format '{{.Names}}' | wc -l | grep -q <expected_count>

# All services responding
curl -sf http://localhost:8080/health && \
curl -sf http://localhost:3000/config
```

## Error Handling

### Common Failure Modes

#### Failure 1: Missing Environment Variables
- **Symptoms**: Task 1 fails, "Required environment variable not set"
- **Cause**: .env.devbob not sourced, or keys missing
- **Retry**: No (configuration error, not transient)
- **User Action**: Source .env.devbob, add missing keys, re-run activity
- **Debug Info**: List which specific variables are missing

#### Failure 2: Docker Daemon Not Running
- **Symptoms**: Task 3 fails, "Cannot connect to Docker daemon"
- **Cause**: Docker service not started
- **Retry**: Yes, up to 3 times with 10s delay (service may be starting)
- **User Action**: Start Docker service (`systemctl start docker` or Docker Desktop)
- **Debug Info**: Output of `docker info` error message

#### Failure 3: Docker Networks Missing
- **Symptoms**: Task 3 fails, "Network not found: metabob-network"
- **Cause**: Networks not created before deployment
- **Retry**: No (one-time setup required)
- **User Action**: Run network creation script or `docker network create metabob-network devbob-network`
- **Debug Info**: List existing networks, show missing network names

#### Failure 4: Backend Health Check Timeout
- **Symptoms**: Task 6 fails, "Health check timed out after 180s"
- **Cause**: Backend services not starting, configuration error, resource constraints
- **Retry**: No (indicates persistent problem)
- **User Action**: Check container logs (`docker logs api-server-dev`), verify configuration
- **Debug Info**: 
  - Last 50 lines of failing container logs
  - Container resource usage (CPU, memory)
  - Health check command output

#### Failure 5: .dockerignore Insufficient Optimization
- **Symptoms**: Task 4 fails, "Context reduction only 45%, expected >80%"
- **Cause**: .dockerignore missing patterns, unnecessary files in context
- **Retry**: No (configuration issue)
- **User Action**: Update .dockerignore to exclude more files (repos/, test-results/, etc.)
- **Debug Info**: 
  - Full context size
  - Filtered context size
  - Top 10 largest directories included in context

#### Failure 6: Config Template Injection Detected
- **Symptoms**: Task 5 fails, "Potential JSON injection detected in env vars"
- **Cause**: Environment variable contains `"` or `{` characters that break JSON
- **Retry**: No (security/configuration issue)
- **User Action**: Check env vars for special characters, escape or quote properly
- **Debug Info**: Show which env var contains suspicious patterns

#### Failure 7: Agent Container Stuck in "Starting"
- **Symptoms**: Task 9 fails, "Container health stuck in 'starting' after 180s"
- **Cause**: entrypoint.sh waiting for backend, backend not responding, configuration error
- **Retry**: No (indicates persistent problem)
- **User Action**: Check container logs, verify backend is accessible from container
- **Debug Info**:
  - Last 50 lines of container logs
  - Output of health check command run inside container
  - Network connectivity test from inside container

#### Failure 8: ACP Server Not Responding
- **Symptoms**: Task 10 fails, "Connection refused to localhost:3000"
- **Cause**: ACP server crashed, port conflict, firewall blocking
- **Retry**: Yes, up to 5 times with 10s delay (server may still be starting)
- **User Action**: Check container logs, verify port is not in use by another process
- **Debug Info**:
  - Container logs showing ACP server startup
  - Output of `netstat -tuln | grep 3000` (port usage)
  - Container status and restart count

#### Failure 9: MCP Dashboard Not Responding
- **Symptoms**: Task 11 fails, "Connection refused to localhost:8082"
- **Cause**: metabob-cli dashboard crashed, MCP server not started
- **Retry**: Yes, up to 5 times with 10s delay
- **User Action**: Check container logs, verify metabob-cli is installed
- **Debug Info**: Container logs showing metabob-cli startup

#### Failure 10: Internal Network Connectivity Failed
- **Symptoms**: Task 12 fails, "Could not resolve host: metabob-rpc-api-server"
- **Cause**: Docker network issue, backend container not on correct network
- **Retry**: Yes, up to 3 times with 5s delay
- **User Action**: Verify networks are created, containers are on correct networks
- **Debug Info**:
  - `docker network inspect metabob-network` (show connected containers)
  - DNS resolution test from inside container

### Retry Strategy

**Transient Failures (Auto-Retry):**
- Docker daemon connectivity: 3 retries, 10s backoff
- Health check polls: Up to `healthCheckTimeout/10` retries, 10s interval
- Network connectivity tests: 5 retries, 10s backoff
- Container startup detection: 6 retries, 30s backoff

**Persistent Failures (No Retry):**
- Missing environment variables
- Invalid configuration files
- Missing Docker networks
- .dockerignore optimization failure
- Config injection detected
- Backend services unhealthy after timeout

**Failure Reporting:**
For all failures, report:
1. Task that failed
2. Error message
3. Root cause (if determinable)
4. Suggested user action
5. Debug information (logs, status, metrics)
6. Whether retry is possible

**Graceful Degradation:**
- If `annotateDeployment=false`: Skip Task 15, still succeed
- If `testConnectivity=false`: Skip Tasks 10-12, still succeed
- If `validateDockerignore=false`: Skip Task 4, still succeed

**Critical Path:**
Tasks 1-9 are critical and cannot be skipped. If any fail, deployment is considered failed and cleanup should be offered.

## Dependencies and Assumptions

### External Dependencies
- Docker Engine >= 20.10
- Docker Compose >= 2.0
- curl (for health checks and connectivity tests)
- jq (for JSON validation)
- envsubst (for config template substitution)
- du (for context size calculation)

### Assumptions
- User has Docker permissions (in `docker` group or root)
- Required Docker networks pre-created (metabob-network, devbob-network)
- .env.devbob file configured with valid credentials
- Host machine has sufficient resources (4GB RAM minimum for full devbob-dev profile)
- Ports 3000-3004, 6379, 8000-8001, 8080-8085 are available

### Configuration Files Required
- `docker-compose.yaml` - Service definitions
- `.env.devbob.example` - Environment variable reference
- `.dockerignore` - Context optimization
- `configs/opencode.devbob.json` - OpenCode config template
- `docker/Dockerfile.devbob` - DevBob container image

## Success Metrics

**Deployment Speed:**
- Full deployment (devbob-dev profile): < 5 minutes
- Single agent deployment (devbob profile): < 3 minutes
- Backend only deployment (stable profile): < 2 minutes

**Reliability:**
- Success rate: > 95% when configuration is correct
- Health check pass rate: 100% when healthy
- No false positives from connectivity tests

**Context Optimization:**
- Docker build context reduced by >= 80%
- Image build time reduced by >= 60% vs. unoptimized

**Observability:**
- All failures include actionable debug information
- Deployment report captures all key metrics
- Container logs collected for troubleshooting
