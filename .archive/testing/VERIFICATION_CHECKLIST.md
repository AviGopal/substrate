# Verification Checklist: Objective Evidence Required

**Purpose**: Define objective verification criteria for all claims  
**Principle**: No progress claimed without script validation  
**Date**: 2026-02-10

---

## 🎯 Core Principle

**"Scripts are the source of truth"**

- ❌ Manual testing → Claims without evidence
- ❌ "It should work" → Assumptions without proof
- ✅ Script execution → Objective evidence
- ✅ Captured artifacts → Reproducible verification

**Rule**: If validation scripts don't pass, progress is not made.

---

## 📋 Validation Scripts Created

### 1. Backend Health Validation
**Script**: `scripts/validate-backend-health.sh`  
**Purpose**: Verify all backend services are running and responsive

**Tests**:
- ✓ Redis responds to PING
- ✓ SurrealDB health endpoint returns 200
- ✓ Metabob RPC API health endpoint returns 200 with valid JSON
- ✓ Docker backend services are running

**Success Criteria**:
```bash
$ ./scripts/validate-backend-health.sh
# Exit code: 0
# All tests passed
```

**Evidence Required**:
- Script exit code 0
- All health endpoints return expected responses
- Docker containers in "running" state

---

### 2. Agent Connectivity Validation
**Script**: `scripts/validate-agent-connectivity.sh <agent-name> <acp-port>`  
**Purpose**: Verify agent containers can reach backend and expose ACP

**Tests**:
- ✓ Agent container is running
- ✓ ACP port is accessible
- ✓ Config file is mounted correctly
- ✓ Agent can reach backend API (host.docker.internal:8080)
- ✓ Workspace directory is mounted
- ✓ Shared .metabob directory is accessible and writable

**Success Criteria**:
```bash
$ ./scripts/validate-agent-connectivity.sh devbob-opencode 3004
# Exit code: 0
# All connectivity tests passed
```

**Evidence Required**:
- Container running with correct config
- Network connectivity proven via curl
- File system mounts verified
- ACP port responding

---

### 3. Activity Execution Validation
**Script**: `scripts/validate-activity-execution.sh <agent-name> [activity-id]`  
**Purpose**: Trace activity execution through logs and session data

**Tests**:
- ✓ Activities discoverable from backend
- ✓ Activity execution can be initiated
- ✓ Execution logs are captured
- ✓ Session data is recorded
- ✓ Execution artifacts are created
- ✓ Component-impulse bridge data is captured

**Success Criteria**:
```bash
$ ./scripts/validate-activity-execution.sh devbob-opencode
# Exit code: 0 (or 1 with expected baseline failures)
# Artifacts captured in .validation-results/
```

**Evidence Required**:
- Activity discovery proven (API response)
- Execution initiated (logs captured)
- Artifacts collected:
  - `activities-list.json`
  - `execution-response.json`
  - `agent-logs.txt`
  - `sessions.json`
  - `impulses.json`
  - `metabob-metadata.txt`

---

### 4. Metabob Bridge Validation
**Script**: `scripts/validate-metabob-bridge.sh <agent-name>`  
**Purpose**: Validate component tracking → impulse loading bridge

**Tests**:
- ✓ Component tracking data is written (.metabob/metadata)
- ✓ Impulse system data is created (.opencode/impulses.json)
- ✓ Bridge correlation data is available
- ✓ Data flow is traceable
- ✓ Backend component API responds

**Success Criteria**:
```bash
$ ./scripts/validate-metabob-bridge.sh devbob-opencode
# Exit code: 0 (or 1 with warnings if no data yet)
# Bridge analysis artifacts captured
```

**Evidence Required**:
- Component tracking file exists with content
- Impulse file exists with valid JSON
- Correlation report generated
- Data flow trace documented

---

### 5. Full System Validation
**Script**: `scripts/validate-all.sh <agent-name>`  
**Purpose**: Run all validation scripts and generate comprehensive report

**Tests**: All of the above

**Success Criteria**:
```bash
$ ./scripts/validate-all.sh devbob-opencode
# Runs all 4 validation scripts
# Generates: VALIDATION_REPORT.md
# Exit code: 0 if all pass
```

**Evidence Required**:
- All individual validations pass
- Comprehensive report generated
- Summary JSON created
- Artifacts collected in timestamped directory

---

## 🔬 Implementation Verification Workflow

### Phase 1: Backend Setup
**Claim**: "Backend is running and healthy"

**Verification**:
```bash
# 1. Start backend
./devbob backend start

# 2. Run validation
./scripts/validate-backend-health.sh

# 3. Check exit code
if [ $? -eq 0 ]; then
  echo "✅ Backend verified"
else
  echo "❌ Backend validation failed - fix before proceeding"
  exit 1
fi
```

**Evidence to Capture**:
- Script output showing all tests passed
- Exit code 0
- Screenshot or log file

**Do NOT claim backend is working without this validation passing.**

---

## 🚀 Quick Reference

### Validation Command Cheat Sheet

```bash
# Backend
./scripts/validate-backend-health.sh

# Agent (specify name and ACP port)
./scripts/validate-agent-connectivity.sh devbob-opencode 3004

# Activity execution
./scripts/validate-activity-execution.sh devbob-opencode

# Bridge analysis
./scripts/validate-metabob-bridge.sh devbob-opencode

# Full system
./scripts/validate-all.sh devbob-opencode

# With evidence capture
./scripts/validate-all.sh devbob-opencode 2>&1 | tee evidence-$(date +%Y%m%d-%H%M%S).log
```

---

**Last Updated**: 2026-02-10  
**Status**: Validation framework complete  
**Next**: Run validations to establish baseline
