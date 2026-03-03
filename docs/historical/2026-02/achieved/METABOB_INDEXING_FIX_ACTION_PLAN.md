# Metabob Indexing Fix - Action Plan

**Issue:** Analysis child process failing to connect to `api-server-dev:80`  
**Impact:** All code quality analysis tools blocked  
**Priority:** 🚨 CRITICAL  
**Estimated Fix Time:** 1-4 hours

---

## Quick Diagnosis

```bash
# Current error
Failed to restart analysis child process after 3 attempts.
Cannot connect to host api-server-dev:80 ssl:default [Name or service not known]

# Root cause
Sidecar hardcoded to dev server instead of production API (ide.metabob.com)

# Files tracked but not analyzed
313 files being watched, 0 files analyzed
```

---

## Fix Attempts (In Order)

### Attempt 1: Set Production Environment Variable (5 min)

```bash
# Stop existing MCP processes
killall metabob-cli

# Try different environment variable names
export METABOB_ENV=production
metabob-cli mcp --transport stdio

# OR
export METABOB_MODE=production
metabob-cli mcp --transport stdio

# OR
export METABOB_API_SERVER=https://ide.metabob.com
metabob-cli mcp --transport stdio

# OR
export METABOB_ANALYSIS_URL=https://ide.metabob.com/api/analysis
metabob-cli mcp --transport stdio
```

**Validation:**
```bash
# Check logs
tail -f repos/metabob-opencode/packages/opencode/.metabob/logs/core.log

# Look for "ide.metabob.com" instead of "api-server-dev"
# Should see: "Connected to https://ide.metabob.com"
```

**If successful:** Skip to "Verify Fix" section

---

### Attempt 2: Update Configuration File (5 min)

```bash
cd repos/metabob-opencode/packages/opencode/.metabob

# Backup current config
cp config.json config.json.bak

# Try adding analysis URL
cat > config.json << 'EOF'
{
  "base_url": "https://ide.metabob.com",
  "analysis_url": "https://ide.metabob.com",
  "analysis_api_url": "https://ide.metabob.com/api/analysis",
  "api_key": "mb_ZFHainw-YiH7OTgJ4X9HBtXUz7YxtGxFQohkXOW3HB4",
  "state_directory": ".metabob",
  "mode": "production"
}
EOF

# Restart MCP
killall metabob-cli
metabob-cli mcp --transport stdio
```

**Validation:** Check logs for connection to `ide.metabob.com`

**If successful:** Skip to "Verify Fix" section

---

### Attempt 3: Update Metabob CLI (10 min)

```bash
# Check current version
metabob-cli --version

# Update via pip
pip install --upgrade metabob-cli

# OR via pyenv
pyenv exec pip install --upgrade metabob-cli

# Restart MCP
killall metabob-cli
metabob-cli mcp --transport stdio
```

**Check release notes:**
```bash
pip show metabob-cli | grep Version
# Search GitHub/docs for changelog mentioning:
# - api-server-dev
# - production mode
# - environment variable
```

**If successful:** Skip to "Verify Fix" section

---

### Attempt 4: Check Metabob Documentation (15 min)

**Search for:**
- Environment variables for production mode
- Analysis API configuration
- Sidecar configuration options
- Known issues with `api-server-dev`

**Places to check:**
1. Metabob CLI GitHub repo
2. Metabob documentation site
3. MCP integration docs
4. `metabob-cli --help`

---

### Attempt 5: Contact Metabob Support (30 min response time)

**Email/Slack Message:**
```
Subject: MCP Analysis Sidecar Connection Error

Environment:
- metabob-cli version: [VERSION]
- Python: 3.13.2
- OS: Linux
- Configuration: repos/metabob-opencode/packages/opencode/.metabob/config.json

Issue:
Analysis child process fails to start with error:
"Cannot connect to host api-server-dev:80 ssl:default [Name or service not known]"

Configuration shows correct production endpoint:
{
  "base_url": "https://ide.metabob.com",
  "api_key": "mb_ZFH..." 
}

Questions:
1. What environment variable forces production mode for the analysis sidecar?
2. Is there a separate analysis_api_url configuration needed?
3. Is this a known bug in version X.Y.Z?

Error occurs at:
- metabob_cli/mcp/child_process_manager.py:79 (sidecar start)
- metabob_cli/core/session_manager.py:221 (session creation)

Stack trace attached in logs: [ATTACH .metabob/logs/core.log]
```

---

### Attempt 6: Workaround - Disable Sidecar (If Possible)

**Check for sidecar-free mode:**
```bash
# Try disabling sidecar analysis
metabob-cli mcp --transport stdio --no-sidecar

# OR
metabob-cli mcp --transport stdio --analysis-mode remote

# OR check config option
cat > config.json << 'EOF'
{
  "base_url": "https://ide.metabob.com",
  "api_key": "mb_ZFHainw-YiH7OTgJ4X9HBtXUz7YxtGxFQohkXOW3HB4",
  "state_directory": ".metabob",
  "sidecar_enabled": false
}
EOF
```

**Note:** This may disable local caching but enable remote analysis

---

## Verify Fix

Once MCP starts without errors, test all tools:

### Test 1: Search Issues
```bash
# Via OpenCode
metabob_search_codebase_issues("authentication", limit=5)

# Expected: List of issues (not error)
```

### Test 2: List Components
```bash
metabob_list_file_components("repos/metabob-opencode/packages/opencode/src/session/session.ts")

# Expected: List of classes/functions
```

### Test 3: Get Priority Issues
```bash
metabob_get_priority_issues()

# Expected: List of priority issues (or empty list if none)
```

### Test 4: Check Logs
```bash
tail -50 repos/metabob-opencode/packages/opencode/.metabob/logs/core.log

# Should NOT see:
# - "Cannot connect to host api-server-dev"
# - "Failed to restart analysis child process"

# SHOULD see:
# - "Analysis sidecar worker started successfully"
# - "Connected to https://ide.metabob.com"
```

---

## Post-Fix: Reindex Codebase

### Step 1: Submit Files for Analysis
```bash
cd repos/metabob-opencode/packages/opencode

# Check current status
metabob-cli status

# Submit all tracked files
metabob-cli submit src/

# Check submission progress
metabob-cli status
```

**Expected Output:**
```
Files tracked: 313
Files submitted: 313
Files analyzed: 0 (processing...)
```

### Step 2: Wait for Analysis
```bash
# Analysis may take 5-30 minutes for 313 files
# Monitor progress
watch -n 30 "metabob-cli status | grep analyzed"

# OR check logs
tail -f repos/metabob-opencode/packages/opencode/.metabob/logs/core.log | grep -i "analysis complete"
```

### Step 3: Verify Indexing Complete
```bash
# Check final stats
metabob-cli stats

# Expected:
# Files analyzed: 313
# Components extracted: 2000-3000
# Issues detected: 50-200
```

### Step 4: Test Tools Again
```bash
# Should now return real data
metabob_search_codebase_issues("session management", limit=10)
metabob_list_file_components("repos/metabob-opencode/packages/opencode/src/session/session.ts")
metabob_get_priority_issues()
```

---

## Rollback Plan

If changes break things:

### Restore Configuration
```bash
cd repos/metabob-opencode/packages/opencode/.metabob
cp config.json.bak config.json
```

### Unset Environment Variables
```bash
unset METABOB_ENV
unset METABOB_MODE
unset METABOB_API_SERVER
unset METABOB_ANALYSIS_URL
```

### Restart MCP
```bash
killall metabob-cli
metabob-cli mcp --transport stdio
```

---

## Success Criteria

- [ ] MCP server starts without "api-server-dev" errors
- [ ] Analysis child process starts successfully
- [ ] `metabob_search_codebase_issues` returns data (not errors)
- [ ] `metabob_list_file_components` returns components
- [ ] `metabob_get_priority_issues` returns issues or empty list
- [ ] Logs show connection to `ide.metabob.com`
- [ ] 313 files submitted for analysis
- [ ] Analysis completes (313/313 files)
- [ ] 2000+ components extracted
- [ ] 50+ issues detected

---

## Timeline

| Task | Time | Status |
|------|------|--------|
| Attempt 1: Env vars | 5 min | ⏳ Not started |
| Attempt 2: Config file | 5 min | ⏳ Not started |
| Attempt 3: CLI update | 10 min | ⏳ Not started |
| Attempt 4: Documentation | 15 min | ⏳ Not started |
| Attempt 5: Support contact | 30 min | ⏳ Not started |
| Verify fix | 10 min | ⏳ Not started |
| Reindex codebase | 30 min | ⏳ Not started |
| Validate tools | 10 min | ⏳ Not started |
| **Total (if all attempts)** | **~2 hours** | |
| **Total (if Attempt 1 works)** | **~20 min** | |

---

## Notes

- Start with Attempt 1 (fastest, most likely)
- If Attempt 1-3 fail, run Attempts 4-5 in parallel
- Keep Metabob support thread open for future issues
- Document final solution for team reference
- Update this action plan with actual solution once found

---

**Created:** 2026-02-27  
**Priority:** CRITICAL  
**Owner:** [ASSIGN TO DEVELOPER]  
**Status:** 🔴 BLOCKED - Awaiting fix  
**Next Review:** After first fix attempt
