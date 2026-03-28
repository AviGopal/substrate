# Validation Scripts: Complete Package

**Date**: 2026-02-10  
**Status**: ✅ Validation framework ready

---

## 🎯 What Was Created

A complete **validation framework** with 5 scripts that provide **objective evidence** for system behavior:

1. **Backend Health** - Verify backend services
2. **Agent Connectivity** - Verify agent configuration
3. **Activity Execution** - Trace execution flow
4. **Metabob Bridge** - Validate component-impulse bridge
5. **Full System** - Comprehensive validation

---

## 📦 Scripts Created

| Script | Purpose | Exit Code 0 Means |
|--------|---------|-------------------|
| `scripts/validate-backend-health.sh` | Backend services health | All services responsive |
| `scripts/validate-agent-connectivity.sh <agent> <port>` | Agent configuration | Agent can reach backend |
| `scripts/validate-activity-execution.sh <agent>` | Activity execution flow | Execution artifacts captured |
| `scripts/validate-metabob-bridge.sh <agent>` | Bridge data flow | Both datasets present |
| `scripts/validate-all.sh <agent>` | Full system validation | All validations pass |

All scripts are:
- ✅ Executable (`chmod +x`)
- ✅ Self-contained (no external dependencies except docker, curl, jq)
- ✅ Idempotent (can run multiple times)
- ✅ Evidence-generating (create artifacts in `.validation-results/`)

---

## 🚀 Quick Start

### Test Backend Only
```bash
# Start backend
./devbob backend start

# Validate
./scripts/validate-backend-health.sh

# Expected: Exit code 0, all tests pass
```

### Test Full System (When Implemented)
```bash
# Start backend + agent
./devbob backend start
./devbob agent start devbob-opencode

# Run full validation
./scripts/validate-all.sh devbob-opencode

# Review report
cat .validation-results/full-validation-*/VALIDATION_REPORT.md
```

---

## 📋 Core Principle

**"No progress claimed without script validation"**

### ❌ Wrong Way
```
Developer: "I configured the backend, it should work now."
```

### ✅ Right Way
```bash
Developer: "I configured the backend. Let me prove it works."
./scripts/validate-backend-health.sh
# Exit code 0
Developer: "✅ Backend validated. Here's the evidence: [script output]"
```

---

## 🎓 Usage Examples

### Example 1: Validate After Implementation

```bash
# Implement docker-compose.yaml backend profile
vim docker-compose.yaml

# Start backend
docker compose --profile backend up -d

# VALIDATE (objective evidence)
./scripts/validate-backend-health.sh

# If exit code 0:
echo "✅ Implementation verified"

# If exit code 1:
echo "❌ Implementation has issues - review script output"
```

### Example 2: Baseline Before Changes

```bash
# Capture baseline
./scripts/validate-all.sh devbob-opencode 2>&1 | tee baseline.log

# Make changes
vim configs/opencode.devbob.json

# Restart services
./devbob agent restart devbob-opencode

# Validate changes didn't break anything
./scripts/validate-all.sh devbob-opencode 2>&1 | tee after-changes.log

# Compare
diff baseline.log after-changes.log
```

### Example 3: Continuous Validation During Development

```bash
# Terminal 1: Watch logs
./devbob debug logs devbob-opencode

# Terminal 2: Development loop
while true; do
  # Make changes
  vim repos/metabob-opencode/some-file.ts
  
  # Restart
  ./devbob agent restart devbob-opencode
  
  # Validate
  ./scripts/validate-agent-connectivity.sh devbob-opencode 3004
  
  if [ $? -eq 0 ]; then
    echo "✅ Change validated"
    break
  else
    echo "❌ Change broke something - fixing..."
  fi
done
```

---

## 📊 What Evidence Is Captured

### Backend Health Validation
**Artifacts**: None (health check only)
**Evidence**:
- Redis PONG response
- SurrealDB 200 response
- Metabob API 200 + valid JSON
- Docker container states

### Agent Connectivity Validation
**Artifacts**: None (connectivity check only)
**Evidence**:
- Container running status
- ACP port accessibility
- Config file presence and validity
- Backend reachability from container
- Volume mounts verified

### Activity Execution Validation
**Artifacts** (in `.validation-results/activity-execution-*/`):
- `activities-list.json` - Available activities
- `activity-request.json` - Execution request sent
- `execution-response.json` - Execution response
- `agent-logs.txt` - Agent logs during execution
- `sessions.json` - Session data from backend
- `impulses.json` - Impulses loaded
- `metabob-metadata.txt` - Component tracking data
- `bridge-analysis.txt` - Bridge correlation report

### Metabob Bridge Validation
**Artifacts** (in `.validation-results/bridge-analysis-*/`):
- `metabob-metadata.txt` - Component tracking copy
- `impulses.json` - Impulse system copy
- `tracked-components.txt` - Component list
- `impulse-ids.txt` - Impulse ID list
- `impulse-types.txt` - Impulse types breakdown
- `correlation-report.txt` - Bridge correlation analysis
- `data-flow-trace.md` - Data flow documentation
- `backend-components.json` - Backend API response
- `validation-summary.json` - Validation results

### Full System Validation
**Artifacts** (in `.validation-results/full-validation-*/`):
- `validation-summary.json` - All results summary
- `VALIDATION_REPORT.md` - Comprehensive report
- Plus all artifacts from individual validations

---

## 🔬 Validation Workflow

### Recommended Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Implementation Phase                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Run Appropriate Validation Script               │
│  • Backend changes → validate-backend-health.sh             │
│  • Agent changes → validate-agent-connectivity.sh           │
│  • Activity changes → validate-activity-execution.sh        │
│  • Bridge changes → validate-metabob-bridge.sh              │
│  • Complete system → validate-all.sh                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Check Exit Code                           │
└─────────────────────────────────────────────────────────────┘
                ↓                          ↓
         Exit Code 0                  Exit Code 1
         (Success)                    (Failure)
                ↓                          ↓
┌──────────────────────────┐    ┌──────────────────────────┐
│   ✅ VALIDATED            │    │   ❌ NOT VALIDATED        │
│                          │    │                          │
│ • Capture evidence       │    │ • Review script output   │
│ • Document in commit     │    │ • Fix issues             │
│ • Proceed to next step   │    │ • Re-run validation      │
└──────────────────────────┘    └──────────────────────────┘
```

---

## 🎯 Success Criteria

### Backend Implementation Complete When:
- ✅ `./scripts/validate-backend-health.sh` exits 0
- ✅ All 4 backend tests pass
- ✅ Evidence captured (script output)

### Agent Implementation Complete When:
- ✅ `./scripts/validate-agent-connectivity.sh <agent> <port>` exits 0
- ✅ All 6 connectivity tests pass
- ✅ Config mounted correctly
- ✅ Backend reachable from container

### Activity System Working When:
- ✅ `./scripts/validate-activity-execution.sh <agent>` captures artifacts
- ✅ Activities discoverable from backend
- ✅ Execution logs captured
- ✅ Session data recorded

### Bridge Instrumented When:
- ✅ `./scripts/validate-metabob-bridge.sh <agent>` captures both datasets
- ✅ Component tracking file has content
- ✅ Impulse file has valid JSON
- ✅ Correlation report generated

### System Fully Functional When:
- ✅ `./scripts/validate-all.sh <agent>` exits 0
- ✅ All 4 individual validations pass
- ✅ Comprehensive report generated
- ✅ No warnings or errors

---

## 📝 Documentation

**Main Documentation**: `VERIFICATION_CHECKLIST.md`
- Core principles
- Detailed test descriptions
- Implementation verification workflow
- Anti-patterns to avoid
- Success patterns
- Exit code meanings

**Quick Reference**: This document
- Script listing
- Quick start commands
- Usage examples
- Evidence captured
- Validation workflow

---

## 🚦 Next Steps

### Phase 1: Establish Baseline (Now)
**Goal**: Run validations on current system to establish baseline

```bash
# Try backend validation (will likely fail - backend not running)
./scripts/validate-backend-health.sh
# Capture baseline: what's missing?

# Try agent validation (will fail - no containers)
./scripts/validate-agent-connectivity.sh devbob-opencode 3004
# Capture baseline: what needs to be implemented?

# Save baseline
./scripts/validate-all.sh devbob-opencode 2>&1 | tee baseline-before-implementation.log
```

**Expected Result**: Most tests fail (system not implemented yet)  
**Value**: Establishes what needs to be implemented

---

### Phase 2: Implement & Validate (Next)
**Goal**: Implement components and prove they work with scripts

```bash
# Implement backend
# ... create docker-compose.yaml ...
./devbob backend start

# VALIDATE
./scripts/validate-backend-health.sh
# Exit code 0? Backend implementation PROVEN.

# Implement agents
# ... add agents to docker-compose.yaml ...
./devbob agent start devbob-opencode

# VALIDATE
./scripts/validate-agent-connectivity.sh devbob-opencode 3004
# Exit code 0? Agent implementation PROVEN.

# Continue for all components...
```

---

### Phase 3: Continuous Validation (Ongoing)
**Goal**: Validate after every change

```bash
# Before committing code
./scripts/validate-all.sh devbob-opencode

# Before creating PR
./scripts/validate-all.sh devbob-opencode 2>&1 | tee pr-validation.log
# Attach pr-validation.log to PR as evidence

# After pulling changes
git pull
./devbob backend restart
./devbob agent restart devbob-opencode
./scripts/validate-all.sh devbob-opencode
```

---

## 💡 Key Insights

### 1. Validation Enables Confidence
With validation scripts, you can confidently say:
- "Backend is working" (proven by script)
- "Agent can reach backend" (proven by script)
- "Bridge data is flowing" (proven by script)

Without validation scripts:
- "Backend should work" (assumption)
- "Agent probably can reach backend" (untested)
- "Bridge might be working" (unknown)

### 2. Validation Prevents Regression
Running validation before/after changes detects regressions:
```bash
./scripts/validate-all.sh devbob-opencode > before.log
# Make changes
./scripts/validate-all.sh devbob-opencode > after.log
diff before.log after.log  # What changed?
```

### 3. Validation Accelerates Debugging
When something breaks, validation isolates the issue:
```bash
./scripts/validate-backend-health.sh      # Passes
./scripts/validate-agent-connectivity.sh  # Fails
# Issue is in agent connectivity, not backend
```

### 4. Validation Creates Evidence
Validation output is objective evidence for:
- Code review comments
- Documentation
- Bug reports
- Progress tracking

---

## ✅ Summary

**Created**: 5 validation scripts  
**Purpose**: Objective evidence for system behavior  
**Principle**: No progress claimed without validation  
**Status**: Ready to use

**Next Action**: Run baseline validation to see current state

```bash
./scripts/validate-all.sh devbob-opencode 2>&1 | tee baseline.log
```

This will capture the current state (expected: many failures) and provide a baseline for improvement.

---

**Status**: ✅ Validation framework complete  
**Evidence**: 5 executable scripts created  
**Verification**: Scripts are executable and self-contained  
**Next**: Establish baseline by running scripts
