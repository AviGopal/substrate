# Vessel Validation Execution Plan

## Goal
Pull metabob-opencode repository into devbob and validate all 8 core capabilities using the new `vessel-codebase-pull-and-validate` activity.

## Activity Template Created
✅ **templates/vessel-workflows/vessel-codebase-pull-and-validate.json**

### What It Does
1. **Task 1:** Clone repo from GitHub, configure git
2. **Task 2:** Install dependencies (npm/bun/pip/cargo)
3. **Task 3:** Run existing tests
4. **Task 4:** Metabob quality scan
5. **Task 5:** Create test branch and validation commit
6. **Task 6:** Test PR creation (or dry-run if no token)
7. **Task 7:** Generate `DEVBOB_CAPABILITY_REPORT.md`

### Expected Outputs
- `/workspace/metabob-opencode/` - Cloned repository
- `/workspace/metabob-opencode/DEVBOB_CAPABILITY_REPORT.md` - Validation report
- `/workspace/metabob-opencode/devbob-capability.json` - JSON summary
- Git branch: `devbob/validate-workflow-YYYYMMDD-HHMMSS`
- (Optional) GitHub PR if GITHUB_TOKEN configured

---

## Execution Options

### Option A: Register Template via MCP (PREFERRED)
```bash
# Use register_activity_template tool
register_activity_template({
  file_path: "templates/vessel-workflows/vessel-codebase-pull-and-validate.json",
  validate_before_register: false,  # Can't validate - needs real GitHub clone
  register_with_metabob: true
})
```

### Option B: Manual Registration via kubectl
```bash
# Copy template to pod
kubectl exec -n metabob devbob-678c8b59dc-tvksd -- mkdir -p /workspace/templates

# Register via opencode CLI (if command exists)
kubectl exec -n metabob devbob-678c8b59dc-tvksd -- \
  /opt/opencode/bin/opencode activity register /workspace/templates/vessel-codebase-pull-and-validate.json
```

### Option C: Direct Execution via Activity Tool (IMMEDIATE)
Use the `activity` tool with template definition as impulse:

```typescript
activity({
  templateId: "vessel-codebase-pull-and-validate",
  variables: {
    repoUrl: "https://github.com/opencode-ai/opencode.git",
    vesselName: "metabob-opencode",
    branch: "main",
    gitUserName: "DevBob Agent",
    gitUserEmail: "devbob@metabob.local",
    skipTestsOnFailure: true,  // Continue even if tests fail
    hasGitHubToken: false  // Will do PR dry-run
  },
  reason: "Validate devbob K8s deployment can pull and process vessel codebase. Test all 8 core capabilities: pull repos, execute activities, create PRs, coordinate vessels, review activities, discover patterns, compose activities, test variants."
})
```

---

## Pre-Execution Checklist

### Infrastructure
- [x] DevBob pod running (1/1 Ready)
- [x] ACP server responding (port 8080)
- [x] Git installed and configured
- [x] GitHub CLI (gh) installed
- [x] Ripgrep installed (for code extraction)
- [ ] GITHUB_TOKEN configured (optional for this test)

### Workspace
- [x] /workspace writable
- [x] Sufficient disk space (~500MB for metabob-opencode)
- [x] Git can clone from GitHub (network access)

### Activity System
- [x] Bootstrap templates registered
- [x] Activity storage directory exists
- [ ] New template registered (will do during execution)

---

## Execution Steps

### Step 1: Register Template (if needed)
```bash
# Option: Use register_activity_template tool
# OR: Copy template to pod and register
```

### Step 2: Execute Activity
```bash
# Use activity tool with variables above
```

### Step 3: Monitor Progress
```bash
# Watch pod logs
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=50 -f

# Check activity status
kubectl exec -n metabob devbob-678c8b59dc-tvksd -- \
  /opt/opencode/bin/opencode activity list /workspace
```

### Step 4: Review Results
```bash
# Read capability report
kubectl exec -n metabob devbob-678c8b59dc-tvksd -- \
  cat /workspace/metabob-opencode/DEVBOB_CAPABILITY_REPORT.md

# Check validation commit
kubectl exec -n metabob devbob-678c8b59dc-tvksd -- \
  sh -c 'cd /workspace/metabob-opencode && git log --oneline -1'

# View quality scan results
kubectl exec -n metabob devbob-678c8b59dc-tvksd -- \
  cat /workspace/metabob-opencode/devbob-capability.json
```

---

## Expected Results

### Success Criteria
- ✅ Repository cloned to `/workspace/metabob-opencode/`
- ✅ Dependencies installed (node_modules exists)
- ✅ Tests executed (pass or fail documented)
- ✅ Metabob scan completed (issues documented)
- ✅ Test branch created
- ✅ Validation commit created
- ✅ PR dry-run completed (or PR created if token available)
- ✅ Capability report generated

### Validation Report Contents
Should include:
1. ✅ Repository Operations (clone, branch, config)
2. ✅/❌ Development Environment (deps, tests, build)
3. ✅ Code Quality Analysis (Metabob integration)
4. ✅ Git Workflow (branch, commit, messages)
5. ✅/⚠️ PR Creation (gh available, auth status)
6. Vessel Profile (language, structure, metrics)
7. Quality Insights (top issues, recommendations)
8. Next Steps (activities ready to run)

### Capability Assessment
After execution, update `CAPABILITY_GAP_ANALYSIS.md`:
- Capability 1 (Pull Repos): ✅ VALIDATED
- Capability 2 (Execute Activities): ✅/❌ VALIDATED/BLOCKED
- Capability 3 (Create PRs): ⚠️ VALIDATED (needs token)
- Capability 4 (Coordinate Vessels): Pending next test
- Capability 5 (Review Activities): Pending test
- Capability 6 (Discover Patterns): ⚠️ PARTIALLY (Metabob scan works)
- Capability 7 (Compose Activities): Pending test
- Capability 8 (Variant Testing): Pending test

---

## Troubleshooting

### If Clone Fails
- Check network connectivity: `kubectl exec pod -- curl -I https://github.com`
- Try with `--depth 1` for faster clone
- Verify URL is correct

### If Dependencies Fail
- Check language runtime installed (node, python, etc.)
- Try manual installation to debug
- Use `skipTestsOnFailure: true` to continue

### If Tests Fail
- Expected for some repos - document failures
- Check if test commands are correct
- Verify test dependencies installed

### If Metabob Scan Fails
- Check METABOB_API_URL configured
- May need to connect to metabob-rpc-api service
- Can continue without Metabob (will note in report)

### If PR Creation Fails
- Expected if GITHUB_TOKEN not configured
- Will do dry-run and document requirements
- Can add token later and re-run task-6 only

---

## Post-Execution Actions

### If Successful
1. Commit validation results to git
2. Update CAPABILITY_GAP_ANALYSIS.md with actual results
3. Document any infrastructure issues found
4. Plan next test: vessel coordination (2 vessels talking)

### If Failed
1. Document failure point in activity instance
2. Analyze logs for root cause
3. Fix infrastructure issues
4. Re-run activity (or specific task)

### Learning Opportunities
- Which tasks took longest? → Optimize
- Which tasks failed most? → Improve error handling
- What was unclear? → Better prompts
- What was redundant? → Remove steps

---

## Next Activities to Test

After this succeeds:

1. **vessel-feature-complete** - Implement a real feature in metabob-opencode
2. **Multi-vessel coordination** - Two vessels working on shared task
3. **Activity composition** - Chain 3 activities together
4. **Pattern discovery** - Run trace-data-flow-single-feature
5. **Variant testing** - Compare two approaches to same task

---

## Variables for metabob-opencode

```json
{
  "repoUrl": "https://github.com/opencode-ai/opencode.git",
  "vesselName": "metabob-opencode",
  "branch": "main",
  "gitUserName": "DevBob Agent",
  "gitUserEmail": "devbob@metabob.local",
  "skipTestsOnFailure": true,
  "hasGitHubToken": false
}
```

Alternative smaller repo for faster testing:
```json
{
  "repoUrl": "https://github.com/octocat/Hello-World.git",
  "vesselName": "hello-world-test",
  "branch": "master",
  "skipTestsOnFailure": true,
  "hasGitHubToken": false
}
```

---

## Timeline

- **Template Creation:** ✅ Complete (5503dac)
- **Template Registration:** ~5 minutes
- **Activity Execution:** ~10-15 minutes (depends on repo size)
- **Results Review:** ~5 minutes
- **Total:** ~20-25 minutes

---

**Status:** Ready to execute
**Next Step:** Use `activity` tool or `register_activity_template` + `activity` tool
**Expected Outcome:** First end-to-end validation of vessel workflow
