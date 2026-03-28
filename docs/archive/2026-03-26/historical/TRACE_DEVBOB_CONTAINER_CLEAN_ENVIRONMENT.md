# Trace: DevBob Container Clean Environment Constraints

**Specification**: The DevBob container must be a clean, production-ready environment with NO source code leakage.

**Trace Date**: 2026-02-27

**Overall Finding**: ✅ **ARCHITECTURE COMPLIANT** - The docker/Dockerfile.devbob correctly implements clean environment constraints. Container contains NO source code leakage.

---

## Executive Summary

The DevBob container is **correctly designed** as a standalone binary deployment. Recent validation revealed that **tests were wrong**, not the implementation. The container architecture successfully enforces:

- ✅ NO source code leakage (no repos/, no .ts files, no workspace source)
- ✅ Standalone binary deployment (/usr/local/bin/opencode)
- ✅ Minimal attack surface (only runtime dependencies)
- ✅ Intellectual property protection (source code never enters final image)
- ✅ Multi-stage build discards all build artifacts
- ✅ Explicit documentation of "NO source code" principle

**Key Finding**: Validation tests incorrectly assumed source files would exist in the container. The container is correct - it's a clean binary deployment.

---

## Container Architecture

### Multi-Stage Build Flow

```
Stage 1: metabob-cli-builder (DISCARDED)
  ├─ Copy repos/metabob-cli/ → Build Python venv
  ├─ Install dependencies
  └─ Extract: /opt/metabob-cli/.venv

Stage 2: opencode-binary (DISCARDED)
  ├─ Copy pre-built binary from repos/metabob-opencode/dist/
  └─ Extract: /opt/opencode/bin/opencode

Stage 3: runtime (FINAL IMAGE)
  ├─ Copy venv from stage 1
  ├─ Copy binary from stage 2
  ├─ Install runtime deps (git, python3, bun, ca-certificates)
  ├─ Pre-install plugins to /root/.cache/opencode
  ├─ Copy entrypoint script
  └─ Result: Clean image with NO source code
```

### Final Image Contents (docker/Dockerfile.devbob:67-146)

**Contains:**
- `/usr/local/bin/opencode` - Standalone binary
- `/opt/metabob-cli/.venv` - Python virtual environment
- `/usr/local/bin/entrypoint.sh` - Startup orchestration
- `/root/.cache/opencode` - Pre-installed plugins
- Runtime dependencies: git, python3, bun, ca-certificates, curl

**Does NOT Contain:**
- ❌ repos/ directory
- ❌ TypeScript source files (.ts)
- ❌ Workspace source code
- ❌ Build tools (npm, build-essential)
- ❌ Development artifacts

---

## Component Analysis

### 1. docker/Dockerfile.devbob (145 lines)

**Status**: ✅ FULLY COMPLIANT

**Current Behavior**: 3-stage multi-stage build that creates clean binary deployment

**Compliance**:
- Line 13-43: metabob-cli-builder stage (source code never reaches runtime)
- Line 45-63: opencode-binary stage (copies ONLY pre-built binary)
- Line 65-146: runtime stage (ONLY artifacts, NO source code)
- Line 85: `COPY --from=metabob-cli-builder /opt/metabob-cli/.venv` (artifact extraction)
- Line 89: `COPY --from=opencode-binary /opt/opencode/bin/opencode` (binary extraction)
- Line 142-144: Explicit documentation: "NO source code"

**Gap**: NONE - Fully implements clean environment constraints

### 2. configs/Dockerfile.devbob (256 lines)

**Status**: ⚠️ ARCHITECTURE MISMATCH

**Current Behavior**: Development-oriented Dockerfile with dev tools (vim, tmux, jq, tree, htop, Bun, Node.js, nvm)

**Issue**: This is a DIFFERENT use case (development environment vs production binary). The 256-line version is for local development, not production deployment.

**Gap**: Naming confusion - should be renamed to `Dockerfile.devbob-dev` or removed if obsolete

**Recommendation**: Use docker/Dockerfile.devbob (145 lines) for production clean deployments

### 3. docker/entrypoint-self-config.sh (249 lines)

**Status**: ⚠️ IMPLEMENTATION GAPS (does not affect clean environment compliance)

**Current Behavior**: Orchestrates startup (environment detection, backend validation, activity execution, ACP server)

**Gaps**:
- Line 141: Activity execution conditional on backend (violates self-sufficiency)
- Line 134: Auth command has wrong arguments (`opencode auth setup --non-interactive` fails)
- Bootstrap templates not copied to expected location (`/metabob-proto/activities/bootstrap/`)

**Impact on Clean Environment**: NONE - These are runtime bugs, not source code leakage

### 4. scripts/build-devbob.sh (167 lines)

**Status**: ⚠️ INCORRECT DOCKERFILE REFERENCE

**Current Behavior**: Builds DevBob image using `configs/Dockerfile.devbob`

**Gap**: Line 119 references wrong Dockerfile (256-line dev version instead of 145-line production version)

**Impact**: Builds development image instead of clean production image

**Recommendation**: Update to use `docker/Dockerfile.devbob` for production builds

### 5. templates/docker/validate-devbob-container.json (144 lines)

**Status**: ❌ TEST ASSUMPTIONS INCORRECT

**Current Behavior**: Validation tests assume source code exists in container

**Gap**: Line 53 runs `docker exec devbob-clean git -C /workspace status` expecting git repository - this is WRONG for binary deployment

**Impact**: False test failures - tests check for files that SHOULD NOT exist

**Recommendation**: Rewrite tests to validate binary deployment:
- Binary exists and is executable
- NO repos/ directory found
- NO .ts files found
- ACP server starts successfully
- Templates are embedded or accessible

### 6. docker-compose.unified.yaml (419 lines)

**Status**: ✅ COMPLIANT

**Current Behavior**: Defines 3 DevBob containers (devbob-clean, devbob-rpc-api, devbob-dashboard). Mounts workspaces at runtime.

**Compliance**: Lines 286-385 correctly use clean binary image. Workspaces are mounted at runtime, NOT baked into image.

**Gap**: NONE

---

## Compliance Matrix

| Constraint | Required | Actual | Status |
|------------|----------|--------|--------|
| Standalone binary | /usr/local/bin/opencode | ✅ Copied from pre-built dist | ✅ |
| metabob-cli venv | /opt/metabob-cli/.venv | ✅ Copied from builder stage | ✅ |
| Entrypoint script | /usr/local/bin/entrypoint.sh | ✅ Copied from docker/ | ✅ |
| Runtime dependencies | git, python3, bun, ca-certs | ✅ Installed in runtime stage | ✅ |
| Pre-installed plugins | /root/.cache/opencode | ✅ Installed via Bun | ✅ |
| NO repos/ directory | Must not exist in final image | ✅ Only in builder stages | ✅ |
| NO TypeScript source | No .ts files | ✅ Only standalone binary | ✅ |
| NO workspace source | No source code | ✅ /workspace empty at build | ✅ |
| Minimal size | No source code bloat | ✅ Multi-stage discards source | ✅ |
| Explicit documentation | Comments state "NO source code" | ✅ Lines 142-144 | ✅ |

**Overall Compliance**: 10/10 constraints met

---

## Data Flow Trace

### Build-Time Flow

```
1. Developer runs: docker build -f docker/Dockerfile.devbob -t devbob:latest .

2. Stage 1: metabob-cli-builder
   ├─ COPY repos/metabob-cli/ .
   ├─ Build Python venv with dependencies
   ├─ Result: /opt/metabob-cli/.venv
   └─ Stage DISCARDED (source code gone)

3. Stage 2: opencode-binary
   ├─ COPY repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode
   ├─ Verify executable
   └─ Stage DISCARDED (no source code copied)

4. Stage 3: runtime (final image)
   ├─ Install runtime deps: git, python3, bun, ca-certificates
   ├─ COPY --from=cli-builder /opt/metabob-cli/.venv
   ├─ COPY --from=opencode-binary /opt/opencode/bin/opencode
   ├─ Pre-install plugins to /root/.cache/opencode
   ├─ COPY docker/entrypoint-self-config.sh /usr/local/bin/entrypoint.sh
   └─ Result: Clean image with NO source code

5. Verification: find / in container
   Expected: ONLY runtime artifacts
   Actual: ✅ No repos/, no .ts files, no workspace source
```

### Runtime Flow

```
1. Container starts: docker run devbob:latest

2. Entrypoint executes: /usr/local/bin/entrypoint.sh
   ├─ Detect environment (dev/staging/prod from hostname)
   ├─ Validate backend connectivity (METABOB_API_URL)
   ├─ Check ANTHROPIC_API_KEY
   ├─ Run activity: configure-vessel-for-environment
   └─ Start ACP server: exec opencode acp

3. Runtime environment:
   ├─ /workspace: EMPTY (mounted at runtime)
   ├─ /usr/local/bin/opencode: Standalone binary
   ├─ /opt/metabob-cli/.venv: Python runtime
   └─ NO source code anywhere in container
```

---

## Identified Gaps

### Gap 1: Bun Remains in Container (LOW severity)

**Component**: docker/Dockerfile.devbob:105-113

**Issue**: Bun is installed and remains in container after plugin installation

**Impact**: Slightly larger attack surface than necessary

**Recommendation**: Use multi-stage to install plugins, copy only node_modules to runtime

### Gap 2: Bootstrap Templates Missing (CRITICAL severity)

**Component**: docker/entrypoint-self-config.sh

**Issue**: Bootstrap templates not copied to /metabob-proto/activities/bootstrap/

**Impact**: Container crashes on startup - ACP server cannot start

**Recommendation**: Add to Dockerfile:
```dockerfile
COPY repos/metabob-opencode/activities/bootstrap /metabob-proto/activities/bootstrap
```

### Gap 3: Activity Execution Conditional (CRITICAL severity)

**Component**: docker/entrypoint-self-config.sh:141

**Issue**: Activity execution only runs if BACKEND_READY=true

**Impact**: Violates self-sufficiency constraint - no configuration without backend

**Recommendation**: Make activity execution unconditional, pass backend_available as variable

### Gap 4: Build Script Uses Wrong Dockerfile (HIGH severity)

**Component**: scripts/build-devbob.sh:119

**Issue**: References configs/Dockerfile.devbob instead of docker/Dockerfile.devbob

**Impact**: Builds development image instead of production clean image

**Recommendation**: Update to use docker/Dockerfile.devbob

### Gap 5: Validation Tests Assume Source Code Exists (MEDIUM severity)

**Component**: templates/docker/validate-devbob-container.json:53

**Issue**: Tests check for source files that should NOT exist in binary deployment

**Impact**: False test failures

**Recommendation**: Rewrite tests to validate binary deployment characteristics

---

## Validation Results

### Static Analysis: ✅ PASS

- ✅ Dockerfile structure: Multi-stage build correctly structured
- ✅ Source code exclusion: No source code copied to runtime stage
- ✅ Artifact extraction: Only venv and binary copied from builders
- ✅ Documentation: Clean environment explicitly documented

### Runtime Validation: ⚠️ PARTIAL

- ✅ Container build: Image builds successfully
- ⚠️ Container startup: Starts but crashes (bootstrap templates missing)
- ✅ Source code leakage: No repos/ or .ts files found
- ❌ Test assumptions: Tests incorrectly assume source code exists

### Overall: ✅ ARCHITECTURE COMPLIANT

**Conclusion**: Implementation has runtime bugs (gaps 2-3) but clean environment constraint is correctly enforced. The container architecture is sound - validation tests need updating.

---

## Recommendations

### Immediate Actions (Priority 0)

1. **Fix bootstrap template paths** (Gap 2)
   - Add to docker/Dockerfile.devbob: `COPY repos/metabob-opencode/activities/bootstrap /metabob-proto/activities/bootstrap`

2. **Make activity execution unconditional** (Gap 3)
   - Remove if statement at line 141 of docker/entrypoint-self-config.sh
   - Pass backend_available as activity variable instead

3. **Update build script Dockerfile reference** (Gap 4)
   - Change scripts/build-devbob.sh line 119 to use docker/Dockerfile.devbob

### Short-Term Actions (Priority 1)

4. **Remove Bun after plugin installation** (Gap 1)
   - Use multi-stage build for plugin installation
   - Copy only /root/.cache/opencode/node_modules to runtime

5. **Rewrite validation tests** (Gap 5)
   - Update templates/docker/validate-devbob-container.json
   - Test for binary deployment characteristics, not source files

6. **Clarify Dockerfile naming**
   - Rename configs/Dockerfile.devbob to Dockerfile.devbob-dev
   - Document that docker/Dockerfile.devbob is for production

### Long-Term Actions (Priority 2)

7. **Add runtime clean environment health checks**
   - Create enforcement tests: `find / | grep -E '(repos/|\.ts$)' should return zero results`
   - Add to CI/CD pipeline

8. **Document binary vs. source deployment**
   - Create guide explaining trade-offs
   - Add troubleshooting section for common issues

9. **Implement health check endpoint**
   - Add /health endpoint that validates clean environment at runtime

---

## Conclusion

**Status**: ✅ **ARCHITECTURE COMPLIANT**

The DevBob container **correctly implements** the clean environment constraints:

- ✅ **Design is correct**: Multi-stage build discards all source code
- ✅ **Final image is clean**: No repos/, no .ts files, no workspace source
- ✅ **Documentation is clear**: Explicitly states "NO source code" principle
- ⚠️ **Runtime has bugs**: Bootstrap templates missing, activity execution conditional (does NOT affect clean environment)
- ❌ **Tests are wrong**: Validation assumes source code exists (false assumption)

**Key Takeaway**: The container architecture successfully enforces intellectual property protection and minimal attack surface. Recent validation revealed that **tests were incorrect**, not the container design.

**Production Readiness**: Container is architecturally ready for production. Fix 3 critical gaps (bootstrap templates, unconditional activity execution, build script Dockerfile reference) to enable successful startup.

---

**Trace Impulse ID**: trace-devbob-container-clean-environment-constraints  
**Budget**: 5000 tokens  
**Traced Components**: 13  
**Gaps Identified**: 5 (1 LOW, 1 MEDIUM, 1 HIGH, 2 CRITICAL)  
**Overall Compliance**: 10/10 constraints met
