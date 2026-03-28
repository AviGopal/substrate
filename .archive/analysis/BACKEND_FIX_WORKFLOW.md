# Backend Configuration Fix Workflow

**Date**: February 11, 2026  
**Purpose**: Apply fixes to enable shared backend access between host and DevBob containers

---

## Overview

We have created a complete workflow with scripts to:
1. **Verify** current configuration status
2. **Fix** configuration issues
3. **Trace** logs to verify connectivity
4. **Test** metabob-cli functionality

All scripts are located in `scripts/` directory.

---

## Scripts Created

### 1. verify-backend-config.sh
**Purpose**: Comprehensive verification of backend configuration

**Tests performed**:
- ✅ Backend API status and health
- ✅ Host OpenCode configuration (project_id, base_url, MCP)
- ✅ Container OpenCode configuration (project_id, base_url, MCP environment)
- ✅ Project ID consistency across all configs
- ✅ Container connectivity (if running)
- ✅ metabob-cli installation and version

**Usage**:
```bash
bash scripts/verify-backend-config.sh
```

**Exit codes**:
- `0` = All checks passed
- `1` = Critical failures found

---

### 2. fix-backend-config.sh
**Purpose**: Apply all necessary configuration fixes

**Fixes applied**:
1. **Add `project_id`** to `configs/opencode.devbob.json`
2. **Populate MCP environment** with `METABOB_API_URL` and `METABOB_API_KEY`
3. **Update `METABOB_PROJECT_ID`** in `docker-compose.yaml`
4. **Restart containers** to pick up changes

**Features**:
- ✅ Automatic backups (`.backup.[timestamp]`)
- ✅ Dry-run mode to preview changes
- ✅ Idempotent (safe to run multiple times)

**Usage**:
```bash
# Preview changes without applying
bash scripts/fix-backend-config.sh --dry-run

# Apply fixes
bash scripts/fix-backend-config.sh
```

---

### 3. trace-backend-connectivity.sh
**Purpose**: Monitor logs from all containers to verify backend connectivity

**Features**:
- ✅ Pre-flight checks (container status, config validation)
- ✅ Real-time log streaming with filters
- ✅ Saves logs to timestamped directory
- ✅ Generates summary report

**Filters**:
- Backend API: project_id, authentication, errors, warnings
- DevBob containers: metabob-cli, MCP, OpenCode, backend connectivity
- Project-specific: exp-repo-dev mentions

**Usage**:
```bash
# Trace indefinitely (Ctrl+C to stop)
bash scripts/trace-backend-connectivity.sh

# Trace for 30 seconds
bash scripts/trace-backend-connectivity.sh 30

# Trace for 60 seconds
bash scripts/trace-backend-connectivity.sh 60
```

**Output**:
- Logs saved to: `/tmp/devbob-trace-[timestamp]/`
- Per-container log files
- Summary report with counts

---

### 4. test-backend-workflow.sh
**Purpose**: Complete end-to-end workflow test

**Steps**:
1. Run verification (before)
2. Apply fixes (if needed)
3. Run verification (after)
4. Trace logs for 30 seconds
5. Test metabob-cli functionality

**Usage**:
```bash
bash scripts/test-backend-workflow.sh
```

**Output**:
- Comprehensive test results
- Log traces
- Final summary

---

## Configuration Issues Found

### 🔴 Critical Issues

1. **Missing `project_id` in container config**
   - File: `configs/opencode.devbob.json`
   - Issue: No `metabob.project_id` field
   - Impact: Containers won't know which backend project to use
   - Fix: Add `"project_id": "exp-repo-dev"`

2. **Project ID mismatch**
   - Host: `exp-repo-dev`
   - Containers: `devbob-multi-agent` (env var)
   - Impact: Host and containers access different projects
   - Fix: Update `METABOB_PROJECT_ID` in docker-compose.yaml

3. **Empty MCP environment**
   - File: `configs/opencode.devbob.json`
   - Issue: `mcp.metabob.environment` is `{}`
   - Impact: MCP server may not receive backend URL
   - Fix: Add `METABOB_API_URL` and `METABOB_API_KEY`

---

## Quick Start

### Option 1: Run Complete Workflow (Recommended)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bash scripts/test-backend-workflow.sh
```

This will:
- ✅ Verify current state
- ✅ Apply fixes if needed
- ✅ Verify fixes worked
- ✅ Trace logs for 30s
- ✅ Test functionality

### Option 2: Run Individual Steps

```bash
# Step 1: Verify current state
bash scripts/verify-backend-config.sh

# Step 2: Preview fixes
bash scripts/fix-backend-config.sh --dry-run

# Step 3: Apply fixes
bash scripts/fix-backend-config.sh

# Step 4: Verify fixes
bash scripts/verify-backend-config.sh

# Step 5: Trace logs
bash scripts/trace-backend-connectivity.sh 30
```

---

## Expected Results

### Before Fixes

```
[Test 2] Host Machine Configuration
✓ PASS: Host project_id set correctly
  → project_id: exp-repo-dev

[Test 3] Container Configuration
✗ FAIL: Container project_id set
  → project_id is not set (CRITICAL)
✗ FAIL: Container MCP environment URL set
  → MCP environment METABOB_API_URL not set

[Test 4] Project ID Consistency
✗ FAIL: Project ID consistent
  → Host: exp-repo-dev, Container: null, Expected: exp-repo-dev

Summary:
Passed:   8
Warnings: 2
Failed:   4

❌ Configuration verification FAILED
```

### After Fixes

```
[Test 2] Host Machine Configuration
✓ PASS: Host project_id set correctly
  → project_id: exp-repo-dev

[Test 3] Container Configuration
✓ PASS: Container project_id set correctly
  → project_id: exp-repo-dev
✓ PASS: Container MCP environment URL set
  → METABOB_API_URL: http://host.docker.internal:8080

[Test 4] Project ID Consistency
✓ PASS: Project ID consistent across configs
  → All configs use: exp-repo-dev

Summary:
Passed:   14
Warnings: 0
Failed:   0

✅ Configuration verification PASSED
```

---

## Testing Activity Template Workflow

After fixes are applied, test activity template sharing:

### 1. Test Backend Connectivity

```bash
# Host
curl http://localhost:8080/
# Expected: {"status":"ok","version":"0.16.0"}

# Container
docker exec devbob-opencode curl http://host.docker.internal:8080/
# Expected: Same response
```

### 2. Test metabob-cli

```bash
# Host
metabob-cli --version
# Expected: metabob-cli, version 1.8.0

# Container
docker exec devbob-opencode metabob-cli --version
# Expected: metabob-cli, version 1.8.0
```

### 3. Test MCP Tools (from OpenCode session)

```bash
# Start OpenCode on host
opencode

# In session, test metabob tools:
# - search_activities
# - metabob_search_codebase_issues
# - metabob_get_priority_issues
```

### 4. Test Activity Registration

```bash
# Register activity from host (if you have a template)
metabob-cli register-template path/to/template.yaml

# Verify visible from container
docker exec devbob-opencode metabob-cli [command to list activities]
```

---

## Troubleshooting

### Issue: Verification still fails after fixes

**Solution**:
1. Check if containers restarted: `docker ps`
2. Manually restart: `docker-compose restart`
3. Check config files: `jq . configs/opencode.devbob.json`
4. Check backups: `ls -la configs/*.backup.*`

### Issue: Container can't reach backend

**Solution**:
1. Test from container: `docker exec devbob-opencode curl http://host.docker.internal:8080/`
2. Check Docker network: `docker network inspect devbob-network`
3. Verify backend is running: `curl http://localhost:8080/`
4. Check firewall rules (rare)

### Issue: metabob-cli not found

**Solution**:
1. Check installation: `which metabob-cli` (host)
2. Check container: `docker exec devbob-opencode which metabob-cli`
3. Verify PATH: `echo $PATH`
4. Reinstall if needed

---

## Files Modified by fix-backend-config.sh

1. **configs/opencode.devbob.json**
   - Added: `metabob.project_id`
   - Added: `mcp.metabob.environment.METABOB_API_URL`
   - Added: `mcp.metabob.environment.METABOB_API_KEY`

2. **docker-compose.yaml**
   - Changed: `METABOB_PROJECT_ID: devbob-multi-agent` → `exp-repo-dev`

3. **Backups created**
   - `configs/opencode.devbob.json.backup.[timestamp]`
   - `docker-compose.yaml.backup.[timestamp]`

---

## Next Steps After Fixes

1. ✅ **Verify configuration is correct**
   ```bash
   bash scripts/verify-backend-config.sh
   ```

2. ✅ **Test backend connectivity**
   ```bash
   bash scripts/trace-backend-connectivity.sh 30
   ```

3. ✅ **Test metabob-cli on host and container**
   ```bash
   metabob-cli --version
   docker exec devbob-opencode metabob-cli --version
   ```

4. ✅ **Use OpenCode to execute activities**
   - Start OpenCode session
   - Search for activities
   - Execute activity templates
   - Verify shared project access

5. ✅ **Register custom activity templates**
   - Create activity template YAML
   - Register via metabob-cli
   - Verify visible from both host and containers

---

## Summary

**Problem**: Backend not properly shared between host and containers due to:
- Missing `project_id` in container config
- Empty MCP environment variables
- Project ID mismatch

**Solution**: Created automated scripts to:
- ✅ Verify configuration
- ✅ Apply fixes with backups
- ✅ Trace logs for debugging
- ✅ Test complete workflow

**Result**: After running `bash scripts/test-backend-workflow.sh`:
- ✅ Consistent project_id across all configs
- ✅ MCP tools properly configured
- ✅ Backend accessible from both host and containers
- ✅ Ready to create and execute activity templates

**Time to fix**: ~2 minutes (automated)

---

## Script Reference

| Script | Purpose | Runtime | Required |
|--------|---------|---------|----------|
| `verify-backend-config.sh` | Check configuration status | ~5s | Yes |
| `fix-backend-config.sh` | Apply configuration fixes | ~10s | Yes |
| `trace-backend-connectivity.sh` | Monitor logs | Variable | Optional |
| `test-backend-workflow.sh` | Complete end-to-end test | ~45s | Recommended |

---

**Ready to execute!** Run the workflow script to apply all fixes and verify functionality.
