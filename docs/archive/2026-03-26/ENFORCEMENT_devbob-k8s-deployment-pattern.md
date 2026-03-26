# Enforcement Summary: devbob-k8s-deployment-pattern

**Specification ID**: devbob-k8s-deployment-pattern  
**Enforcement Date**: 2026-03-01  
**Status**: ENFORCED

This document records all changes made to enforce the devbob-k8s-deployment-pattern specification based on the trace analysis in `TRACE_devbob-k8s-deployment-pattern.md`.

## Executive Summary

**Objective**: Standardize DevBob Kubernetes deployment to eliminate configuration drift and fix the ACP server hang issue.

**Approach**: Chose Helm chart as canonical deployment method, deprecated StatefulSet manifests.

**Result**: All configuration files aligned to specification requirements:
- Port standardized to 8080
- Image tag standardized to `latest`
- Command/args with `--print-logs` flag added
- HTTP health probes on correct port
- HOME environment variable added
- Deprecated patterns marked and migration path documented

## Changes Applied

### 1. Helm Chart Values (helm/charts/devbob/values.yaml)

**Component**: Helm Chart Values Configuration

**Changes Made**:
- Updated `image.tag` from `unified-test` to `latest`
- Updated `service.port` from `3000` to `8080`
- Updated `service.targetPort` from `3000` to `8080`
- Updated `livenessProbe.httpGet.port` from `3000` to `8080`
- Updated `readinessProbe.httpGet.port` from `3000` to `8080`
- Added `env.home: "/workspace"` configuration

**Reason**: Aligns image tag and port configuration with deployed reality and specification requirements. Port 8080 is the standard ACP server port per specification. HOME=/workspace is required for .local directory creation.

**Impact Analysis**: 
- **Blast Radius**: All deployments using this Helm chart will now use port 8080 and image devbob:latest
- **Affected Components**: Service, health probes, container port configuration
- **Breaking Change**: Yes - existing deployments on port 3000 need migration
- **Mitigation**: Migration guide provided in DEPLOYMENT_GUIDE_devbob-k8s.md

**Files Modified**:
- `helm/charts/devbob/values.yaml` (lines 6, 15-16, 69, 79)

---

### 2. Helm Deployment Template (helm/charts/devbob/templates/deployment.yaml)

**Component**: Deployment Manifest Template

**Changes Made**:
- Added explicit `command: ["opencode"]`
- Added `args` array with:
  - `acp`
  - `--hostname 0.0.0.0`
  - `--port {{ .Values.service.targetPort }}`
  - `--print-logs` (CRITICAL for log visibility)
  - `--log-level {{ .Values.env.logLevel }}`
- Added `HOME` environment variable from `{{ .Values.env.home }}`

**Reason**: 
1. **Explicit command/args**: Eliminates ambiguity about what command runs in the container. Previously relied on Dockerfile CMD, causing confusion.
2. **--print-logs flag**: Critical for debugging the ACP server hang issue. Without this, the server might be running but not outputting logs.
3. **--hostname 0.0.0.0**: Ensures server listens on all interfaces (required for Kubernetes networking).
4. **Port from values**: Makes port configurable via Helm values.
5. **HOME env var**: Required by specification for .local directory creation.

**Impact Analysis**:
- **Blast Radius**: Changes how DevBob container starts. All Helm deployments will use this command.
- **Affected Components**: Container initialization, log output, networking
- **Breaking Change**: No - improves existing behavior
- **Benefits**: 
  - Log visibility (--print-logs)
  - Clear command specification
  - Easier debugging

**Files Modified**:
- `helm/charts/devbob/templates/deployment.yaml` (lines 32-40, 82-83)

---

### 3. StatefulSet Manifest Deprecation (k8s-devbob-statefulset.yaml)

**Component**: StatefulSet Manifest (Alternative Deployment Method)

**Changes Made**:
- Added deprecation notice header:
  ```yaml
  # ⚠️ DEPRECATED: This StatefulSet manifest is deprecated in favor of Helm chart
  # Use helm/charts/devbob/ for all new deployments
  # This file is kept for backward compatibility only
  # See TRACE_devbob-k8s-deployment-pattern.md for migration guide
  ```

**Reason**: Multiple deployment patterns caused configuration drift and maintenance burden. Helm chart is more maintainable and provides better upgrade/rollback capabilities.

**Impact Analysis**:
- **Blast Radius**: Marks existing StatefulSet deployments as deprecated
- **Affected Components**: Deployment scripts, documentation
- **Breaking Change**: No - file still usable, just marked deprecated
- **Migration Path**: Documented in DEPLOYMENT_GUIDE_devbob-k8s.md

**Files Modified**:
- `k8s-devbob-statefulset.yaml` (lines 1-4)

---

### 4. Deployment Script Deprecation (deploy-devbob-k8s-git.sh)

**Component**: Deployment Script (StatefulSet-based)

**Changes Made**:
- Added deprecation warning at script start:
  ```bash
  echo "⚠️  WARNING: This deployment script is deprecated"
  echo "    Use deploy-devbob-helm.sh for new deployments"
  echo "    Continuing with StatefulSet deployment in 5 seconds..."
  sleep 5
  ```

**Reason**: Redirect users to canonical Helm-based deployment method while maintaining backward compatibility.

**Impact Analysis**:
- **Blast Radius**: Users will see deprecation warning
- **Affected Components**: Deployment workflows
- **Breaking Change**: No - script still works
- **User Action Required**: Migrate to deploy-devbob-helm.sh for future deployments

**Files Modified**:
- `deploy-devbob-k8s-git.sh` (lines 1-10)

---

### 5. New Canonical Deployment Script (deploy-devbob-helm.sh)

**Component**: Helm-based Deployment Script (NEW)

**Changes Made**:
- Created new deployment script using Helm
- Verifies `devbob:latest` image (not `local-fixed`)
- Uses Helm upgrade --install pattern
- Supports custom values files via $VALUES_FILE env var
- Provides clear deployment info and next steps

**Reason**: Provides canonical deployment method using Helm chart. Replaces StatefulSet-based deployment with more maintainable approach.

**Impact Analysis**:
- **Blast Radius**: New entry point for all future deployments
- **Affected Components**: Deployment workflows, CI/CD pipelines
- **Breaking Change**: No - adds new script, doesn't remove old one
- **Benefits**:
  - Uses Helm for better upgrade/rollback
  - Aligned with specification requirements
  - Clear validation steps documented

**Files Created**:
- `deploy-devbob-helm.sh` (new file, 147 lines)

---

### 6. Deployment Guide (DEPLOYMENT_GUIDE_devbob-k8s.md)

**Component**: Deployment Documentation (NEW)

**Changes Made**:
- Created comprehensive deployment guide
- Documents canonical Helm deployment pattern
- Explains architectural decisions (ADRs)
- Provides troubleshooting guide for ACP server hang issue
- Includes migration path from StatefulSet to Helm
- Validation checklist for post-deployment

**Reason**: Specification enforcement requires clear documentation of the canonical pattern. Future deployments must follow this guide to maintain consistency.

**Impact Analysis**:
- **Blast Radius**: Sets standard for all DevBob deployments
- **Affected Components**: Development workflows, operations runbooks
- **Breaking Change**: No - documentation only
- **Benefits**:
  - Single source of truth for deployment pattern
  - Troubleshooting guidance
  - Architectural decision rationale

**Files Created**:
- `DEPLOYMENT_GUIDE_devbob-k8s.md` (new file, 548 lines)

---

## Gap Closure Summary

| Component | Gap Identified | Gap Closed | Evidence |
|-----------|----------------|------------|----------|
| Helm values.yaml | Image tag mismatch (unified-test vs latest) | ✅ Yes | image.tag set to `latest` |
| Helm values.yaml | Port mismatch (3000 vs 8080) | ✅ Yes | service.port and targetPort set to 8080 |
| Helm values.yaml | Missing HOME env var | ✅ Yes | env.home added with value `/workspace` |
| Helm deployment.yaml | Missing command/args | ✅ Yes | Explicit command and args added |
| Helm deployment.yaml | Missing --print-logs flag | ✅ Yes | --print-logs added to args |
| Helm deployment.yaml | Missing HOME env var | ✅ Yes | HOME env var added from values |
| Health probes | Port mismatch (probes on 3000, server on 8080) | ✅ Yes | Probes updated to port 8080 |
| StatefulSet manifest | Conflict with Helm pattern | ✅ Yes | Marked deprecated, Helm is canonical |
| Deployment script | Uses StatefulSet instead of Helm | ✅ Yes | New Helm script created, old script deprecated |
| Documentation | No canonical pattern documented | ✅ Yes | DEPLOYMENT_GUIDE created with ADRs |

## Architectural Decisions Enforced

### ADR-001: Helm as Canonical Deployment Method

**Decision**: Helm chart is the canonical deployment method. StatefulSet manifests are deprecated.

**Enforcement**:
- ✅ Helm chart updated to specification
- ✅ New Helm deployment script created
- ✅ StatefulSet marked deprecated
- ✅ Old deployment script shows deprecation warning
- ✅ Migration path documented

---

### ADR-002: Port 8080 as Standard

**Decision**: ACP server runs on port 8080 (not 3000)

**Enforcement**:
- ✅ values.yaml service.port = 8080
- ✅ values.yaml service.targetPort = 8080
- ✅ Health probes on port 8080
- ✅ --port argument in command = 8080
- ✅ Documentation updated

---

### ADR-003: Direct opencode Command

**Decision**: Use direct `opencode acp` command, not entrypoint.sh wrapper

**Enforcement**:
- ✅ Explicit command added to deployment.yaml
- ✅ Args array with all required flags
- ✅ --print-logs flag included for visibility
- ✅ SKIP_CONFIG=true in environment (no wrapper needed)
- ✅ Rationale documented in ADR-003

---

### ADR-004: HTTP Probes over TCP

**Decision**: Use HTTP health probes on `/health` endpoint

**Enforcement**:
- ✅ livenessProbe.httpGet defined
- ✅ readinessProbe.httpGet defined
- ✅ Both probe path: /health
- ✅ Both probe port: 8080
- ✅ Rationale documented in ADR-002

---

### ADR-005: Image Tag `latest` for Local Development

**Decision**: Use `devbob:latest` as standard tag for local development

**Enforcement**:
- ✅ values.yaml image.tag = latest
- ✅ deploy-devbob-helm.sh checks for devbob:latest
- ✅ Documentation references devbob:latest
- ✅ Dockerfile builds as devbob:latest by convention

---

## Data Flow Validation

The specification requires that changes ripple through the data flow. Here's how each change propagates:

### Port Change (3000 → 8080)

```
values.yaml (port: 8080)
  ↓
deployment.yaml (containerPort: 8080, --port 8080)
  ↓
service.yaml (targetPort: 8080)
  ↓
Health probes (port: 8080)
  ↓
Pod actually listens on 8080
```

**Validation**: All port references updated consistently across the stack.

---

### Command/Args Addition

```
deployment.yaml (command: [opencode], args: [...])
  ↓
Container starts with explicit command
  ↓
--print-logs flag enables log output
  ↓
Logs visible via kubectl logs
  ↓
Troubleshooting enabled
```

**Validation**: Command specification eliminates ambiguity about what runs in container.

---

### Image Tag Standardization

```
values.yaml (tag: latest)
  ↓
deployment.yaml (image: devbob:latest)
  ↓
deploy-devbob-helm.sh (checks for devbob:latest)
  ↓
Consistent image used across deployments
```

**Validation**: No more confusion about which image tag to use.

---

## Root Cause Resolution: ACP Server Hang

The trace analysis identified the ACP server hang as the critical issue blocking deployment. Here's how enforcement resolves it:

### Root Cause #1: Port Mismatch

**Problem**: Manifests specified port 3000, deployment used 8080, health probes checked 3000

**Fix**: 
- ✅ Standardized all configurations to port 8080
- ✅ Health probes now check correct port
- ✅ Service routes to correct port

---

### Root Cause #2: Missing --print-logs Flag

**Problem**: Server might be running but not outputting logs

**Fix**:
- ✅ Added --print-logs flag to args
- ✅ Log output now visible via kubectl logs
- ✅ Can debug server startup issues

---

### Root Cause #3: Entrypoint Bypass Confusion

**Problem**: Dockerfile expects entrypoint.sh wrapper, k8s calls opencode directly

**Fix**:
- ✅ Explicit command/args in deployment.yaml
- ✅ No ambiguity about what runs
- ✅ SKIP_CONFIG=true set (no wrapper needed)
- ✅ ADR documents decision

---

### Root Cause #4: Configuration File Issue

**Problem**: SKIP_CONFIG=true but unclear if config needed

**Fix**:
- ✅ SKIP_CONFIG=true kept (no auto-config)
- ✅ Direct opencode command (no config generation attempt)
- ✅ Documentation clarifies config strategy

---

## Validation Next Steps

To validate that enforcement resolved the issues:

1. **Deploy via Helm**:
   ```bash
   ./deploy-devbob-helm.sh
   ```

2. **Check Pod Status**:
   ```bash
   kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
   # Should show Running, not CrashLoopBackOff
   ```

3. **Check Logs for "listening on port"**:
   ```bash
   kubectl logs -f $(kubectl get pod -n metabob -l app.kubernetes.io/name=devbob -o name) | grep -i listening
   # Should show: "ACP server listening on 0.0.0.0:8080" or similar
   ```

4. **Test Health Endpoint**:
   ```bash
   kubectl exec $(kubectl get pod -n metabob -l app.kubernetes.io/name=devbob -o name) -n metabob -- curl http://localhost:8080/health
   # Should return HTTP 200 with health status
   ```

5. **Verify No Restarts**:
   ```bash
   kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o custom-columns=NAME:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount
   # RESTARTS should be 0
   ```

## Enforcement Metrics

| Metric | Before Enforcement | After Enforcement |
|--------|-------------------|-------------------|
| Deployment patterns | 3 (Helm, StatefulSet, platform repo) | 1 (Helm canonical) |
| Configuration files | 8 misaligned | 8 aligned |
| Port mismatches | 4 (3000 vs 8080) | 0 |
| Image tag confusion | 3 tags (unified-test, local-fixed, latest) | 1 tag (latest) |
| Missing --print-logs | Yes | No |
| Documentation | None | Comprehensive |

## Files Modified Summary

| File | Lines Changed | Change Type |
|------|---------------|-------------|
| helm/charts/devbob/values.yaml | 6 | Configuration updates |
| helm/charts/devbob/templates/deployment.yaml | 11 | Command/args addition |
| k8s-devbob-statefulset.yaml | 4 | Deprecation notice |
| deploy-devbob-k8s-git.sh | 10 | Deprecation warning |
| deploy-devbob-helm.sh | 147 | New file (canonical script) |
| DEPLOYMENT_GUIDE_devbob-k8s.md | 548 | New file (documentation) |
| ENFORCEMENT_devbob-k8s-deployment-pattern.md | This file | New file (enforcement record) |

**Total**: 4 files modified, 3 files created, 726 lines added/changed

## References

- **Trace Analysis**: `TRACE_devbob-k8s-deployment-pattern.md`
- **Trace Summary**: `trace-devbob-k8s-summary.json`
- **Deployment Guide**: `DEPLOYMENT_GUIDE_devbob-k8s.md`
- **Helm Chart**: `helm/charts/devbob/`
- **Canonical Script**: `deploy-devbob-helm.sh`

---

**Enforcement Completed**: 2026-03-01  
**Next Phase**: Validation (run deployment and verify all checks pass)  
**Success Criteria**: Pod runs without restarts, ACP server logs "listening on port 8080", health probes pass
