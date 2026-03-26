# DevBob K8s Deployment - Capability Gap Analysis

**Date:** 2026-03-02  
**Status:** Deployment successful but **CRITICAL GAPS** in end-to-end workflow

---

## Executive Summary

✅ **Infrastructure deployed successfully** - Pod running, ACP server responding  
❌ **Workflow capabilities not validated** - Missing integration, configuration, and testing

**Risk Level:** 🔴 **HIGH** - Cannot perform the core vessel coordination workflow yet

---

## Capability Assessment

### 1. Pull Repositories (Vessels) ✅ WORKING

**Status:** ✅ **VERIFIED**

**Test Results:**
```bash
$ kubectl exec devbob-pod -- git --version
git version 2.39.5

$ kubectl exec devbob-pod -- git clone https://github.com/octocat/Hello-World.git test-repo
Cloning into 'test-repo'...
✓ Success
```

**Gaps:** None

**Next Steps:** None - this works

---

### 2. Do Development Activities ❌ **CRITICAL GAP**

**Status:** 🔴 **BLOCKED**

**Test Results:**
```bash
$ kubectl exec devbob-pod -- opencode activity list
No activities found.
Start one with: opencode activity run <directory>

# But templates ARE stored:
$ kubectl exec devbob-pod -- ls /workspace/.local/share/opencode/storage/activity-template/
create-activity.json
debug-activity-self-contained.json
evolve-activity-self-contained.json
manage-session-memory.json
trace-data-flow-single-feature.json
trace-enforce-validate-loop.json
```

**Root Cause:** Confusion between activity **instances** vs activity **templates**
- `opencode activity list` shows running instances (none exist)
- Templates are registered in storage but no command to list them
- No way to execute a template via CLI directly

**Gaps:**
1. ❌ No way to execute activity templates from CLI
2. ❌ No way to list available templates
3. ❌ No test of activity execution via ACP protocol
4. ❌ No test of activity execution in actual codebase

**Next Steps:**
1. Test activity execution via ACP protocol (requires vessel connection)
2. Add `opencode activity execute <template-id>` command or equivalent
3. Verify template execution produces activity instances
4. Test with real codebase (not empty workspace)

**Impact:** 🔴 **CRITICAL** - Can't verify core functionality

---

### 3. Create PRs ⚠️ **PARTIAL**

**Status:** ⚠️ **INFRASTRUCTURE READY, CONFIG MISSING**

**Test Results:**
```bash
$ kubectl exec devbob-pod -- gh --version
gh version 2.87.3 (2026-02-23)

# From entrypoint logs:
[WARN] ⚠ GITHUB_TOKEN not set - PR operations will fail
[WARN] Set GITHUB_TOKEN for autonomous PR creation and management
```

**Gaps:**
1. ❌ GITHUB_TOKEN not configured in K8s secrets
2. ❌ No test of `gh pr create` command
3. ❌ No test of gh authentication
4. ❌ No test of PR creation workflow from activity

**Next Steps:**
1. Add GITHUB_TOKEN to deployment secrets:
   ```yaml
   env:
     - name: GITHUB_TOKEN
       valueFrom:
         secretKeyRef:
           name: devbob
           key: github-token
   ```
2. Update helmfile values to include github token
3. Test `gh auth status`
4. Test `gh pr create` in test repo

**Impact:** 🟡 **MEDIUM** - Infrastructure ready but unconfigured

---

### 4. Coordinate with Other Vessels ❌ **CRITICAL GAP**

**Status:** 🔴 **NOT TESTED**

**Test Results:**
```bash
# ACP server is running:
$ kubectl exec devbob-pod -- curl http://localhost:8080/config
✓ Returns JSON

# From logs:
INFO service=acp-command setup connection

# Port forward works:
$ kubectl port-forward svc/devbob 8080:8080
$ curl http://localhost:8080/config
✓ HTTP 200 OK
```

**Gaps:**
1. ❌ No test of ACP protocol delegation (prompt execution)
2. ❌ No vessel container connected to devbob ACP server
3. ❌ No test of multi-vessel coordination
4. ❌ No test of vessel-to-vessel communication
5. ❌ docker-compose.test-vessel.yaml not used yet
6. ❌ No test of impulse sharing between vessels

**Next Steps:**
1. **CRITICAL:** Start vessel container:
   ```bash
   cd /home/avi/documents/work/exp-repo/metabob-devbob
   docker-compose -f docker-compose.test-vessel.yaml up -d
   ```
2. Configure vessel to connect to K8s devbob:
   - Fix METABOB_API_URL to point to K8s service
   - Add port forwarding or use K8s service DNS
3. Test ACP delegation:
   ```bash
   # From vessel:
   curl -X POST http://devbob.metabob.svc.cluster.local:8080/acp/delegate \
     -H "Content-Type: application/json" \
     -d '{"prompt": "List files in workspace", "target": "docker://devbob-vessel"}'
   ```
4. Test activity execution via ACP
5. Test impulse sharing between vessels

**Impact:** 🔴 **CRITICAL** - Core coordination workflow not validated

---

### 5. Review and Upgrade Activities ⚠️ **PARTIAL**

**Status:** ⚠️ **STORAGE WORKS, NO WORKFLOW**

**Test Results:**
```bash
# Templates are stored:
$ kubectl exec devbob-pod -- ls /workspace/.local/share/opencode/storage/activity-template/
create-activity.json
debug-activity-self-contained.json
evolve-activity-self-contained.json
...

# Can read template:
$ kubectl exec devbob-pod -- cat /workspace/.local/share/opencode/storage/activity-template/create-activity.json
{
  "id": "create-activity",
  "name": "Create Activity Template",
  ...
}
```

**Gaps:**
1. ❌ No command to list templates (only instances)
2. ❌ No test of activity evolution workflow
3. ❌ No test of template versioning
4. ❌ No test of template upgrade process
5. ❌ `evolve-activity-self-contained` template exists but not tested
6. ❌ No test of template comparison/diff

**Next Steps:**
1. Add `opencode activity template list` command or use metabob commands
2. Test evolution workflow:
   - Run activity A
   - Activity fails or needs improvement
   - Use `evolve-activity-self-contained` to upgrade
   - Re-run with improvements
3. Test version tracking
4. Document template upgrade process

**Impact:** 🟡 **MEDIUM** - Storage works, workflow untested

---

### 6. Discover and Create Activities (Data Flow Enforcement) ❌ **NOT TESTED**

**Status:** 🔴 **NOT TESTED**

**Required Capabilities:**
- Analyze codebase to understand data flows
- Identify gaps or anti-patterns in data flow
- Generate activity templates that enforce correct patterns
- Store templates for reuse
- Apply templates across similar codebases

**Test Results:**
```bash
# Templates related to this:
/workspace/.local/share/opencode/storage/activity-template/trace-data-flow-single-feature.json
/workspace/.local/share/opencode/storage/activity-template/trace-enforce-validate-loop.json
/workspace/.local/share/opencode/storage/activity-template/create-activity.json
```

**Gaps:**
1. ❌ No test of `trace-data-flow-single-feature` execution
2. ❌ No test of `trace-enforce-validate-loop` execution
3. ❌ No test of data flow discovery
4. ❌ No test of pattern enforcement
5. ❌ No test of activity creation from discovered patterns
6. ❌ No test with real codebase (workspace is empty except config)

**Next Steps:**
1. **Mount a real codebase** into vessel workspace:
   ```yaml
   volumes:
     - ./repos/metabob-opencode:/workspace/project:ro
   ```
2. Execute `trace-data-flow-single-feature`:
   ```bash
   opencode activity execute trace-data-flow-single-feature \
     --variable featureName="activity template system" \
     --variable files="src/activity/**/*.ts"
   ```
3. Analyze trace output for data flow patterns
4. Test `trace-enforce-validate-loop`:
   - Trace current patterns
   - Generate enforcement rules
   - Validate codebase against rules
5. Test `create-activity` to generate new templates

**Impact:** 🔴 **CRITICAL** - Core discovery workflow not validated

---

### 7. Compose and Optimize Activities ❌ **NOT TESTED**

**Status:** 🔴 **NOT TESTED**

**Required Capabilities:**
- Chain multiple activities in sequence
- Pass outputs from activity A to activity B
- Parallelize independent activities
- Optimize activity composition for performance
- Remove LLM calls where deterministic logic suffices
- Measure success rate improvements

**Test Results:**
- No tests performed

**Gaps:**
1. ❌ No test of activity chaining
2. ❌ No test of variable passing between activities
3. ❌ No test of parallel execution
4. ❌ No test of optimization techniques
5. ❌ No test of LLM removal strategies
6. ❌ No test of success rate measurement
7. ❌ No test of activity composition patterns

**Next Steps:**
1. **Design composition test case:**
   ```yaml
   activities:
     - id: activity-a
       template: trace-data-flow-single-feature
       variables:
         featureName: "user authentication"
     
     - id: activity-b
       template: fix-bug-complete
       depends_on: [activity-a]
       variables:
         bugDescription: "{{ activity-a.output.issues[0].description }}"
         files: "{{ activity-a.output.files }}"
     
     - id: activity-c
       template: refactor-with-tests
       depends_on: [activity-b]
       variables:
         files: "{{ activity-b.output.changed_files }}"
   ```

2. **Test LLM removal:**
   - Identify activities with deterministic logic
   - Replace LLM prompts with scripted checks
   - Measure speedup and cost reduction

3. **Test optimization:**
   - Run baseline composition
   - Measure: time, cost, success rate
   - Apply optimizations (caching, parallelization, LLM removal)
   - Re-measure and compare

**Impact:** 🔴 **CRITICAL** - Core optimization workflow not validated

---

### 8. Try Activity Variants (Performance Measurement) ❌ **NOT TESTED**

**Status:** 🔴 **NOT TESTED**

**Required Capabilities:**
- Checkpoint workspace state (git commit or snapshot)
- Run activity variant A from checkpoint
- Measure: time, cost, success rate, output quality
- Reset to checkpoint
- Run activity variant B from same checkpoint
- Compare metrics
- Select best variant

**Test Results:**
- No tests performed

**Gaps:**
1. ❌ No checkpoint/restore mechanism tested
2. ❌ No variant execution tested
3. ❌ No metrics collection tested
4. ❌ No comparison framework
5. ❌ No automated variant selection
6. ❌ No A/B testing infrastructure

**Next Steps:**
1. **Design checkpoint mechanism:**
   ```bash
   # Option A: Git-based
   git stash --include-untracked
   git commit -m "Checkpoint before variant A"
   CHECKPOINT_SHA=$(git rev-parse HEAD)
   
   # Run variant A
   opencode activity execute variant-a
   
   # Reset
   git reset --hard $CHECKPOINT_SHA
   git stash pop
   
   # Run variant B
   opencode activity execute variant-b
   ```

2. **Option B: Container snapshots:**
   ```bash
   docker commit vessel-container checkpoint-1
   # Run variant A in container
   docker stop vessel-container && docker rm vessel-container
   docker run --name vessel-container checkpoint-1
   # Run variant B
   ```

3. **Metrics collection framework:**
   ```json
   {
     "variant": "add-feature-variant-a",
     "duration_ms": 45000,
     "cost_usd": 0.23,
     "tokens": {
       "input": 12000,
       "output": 3400,
       "cache": 8000
     },
     "success": true,
     "quality_score": 0.87,
     "tests_passed": 15,
     "tests_failed": 0
   }
   ```

4. **Comparison dashboard:**
   - Automated metric aggregation
   - Statistical significance testing
   - Winner selection criteria

**Impact:** 🔴 **CRITICAL** - Core experimentation workflow not validated

---

## Critical Path to Full Capability

### Phase 1: Basic Activity Execution (URGENT)
**Goal:** Execute one activity successfully end-to-end

1. ✅ DevBob pod running (DONE)
2. ❌ Mount real codebase into workspace
3. ❌ Execute activity template via ACP
4. ❌ Verify activity instance created
5. ❌ Verify output artifacts produced

**Blockers:**
- Empty workspace (no code to work on)
- No tested ACP delegation flow

**ETA:** 1-2 hours

---

### Phase 2: Vessel Coordination (URGENT)
**Goal:** Two vessels coordinate on shared task

1. ❌ Start vessel container with docker-compose
2. ❌ Configure vessel to connect to devbob ACP
3. ❌ Test delegation: vessel → devbob
4. ❌ Test response: devbob → vessel
5. ❌ Verify impulse sharing works

**Blockers:**
- docker-compose.test-vessel.yaml not started
- ACP protocol not tested end-to-end

**ETA:** 2-3 hours

---

### Phase 3: PR Workflow (HIGH PRIORITY)
**Goal:** Create PR from activity output

1. ❌ Add GITHUB_TOKEN to secrets
2. ❌ Test gh authentication
3. ❌ Run activity that modifies code
4. ❌ Create commit from activity output
5. ❌ Create PR with gh cli
6. ❌ Verify PR appears on GitHub

**Blockers:**
- GITHUB_TOKEN not configured
- No tested commit workflow

**ETA:** 1 hour

---

### Phase 4: Activity Discovery (MEDIUM PRIORITY)
**Goal:** Discover patterns and create enforcement activity

1. ❌ Run trace-data-flow-single-feature on real codebase
2. ❌ Analyze output for patterns
3. ❌ Run trace-enforce-validate-loop
4. ❌ Generate enforcement rules
5. ❌ Create new activity template from patterns

**Blockers:**
- Real codebase not available in workspace
- Templates not tested

**ETA:** 3-4 hours

---

### Phase 5: Composition & Optimization (MEDIUM PRIORITY)
**Goal:** Chain activities and optimize

1. ❌ Design 3-activity composition
2. ❌ Test sequential execution
3. ❌ Test variable passing
4. ❌ Measure baseline metrics
5. ❌ Apply optimizations
6. ❌ Measure improvement

**Blockers:**
- Activity execution not tested
- No composition framework

**ETA:** 4-6 hours

---

### Phase 6: Variant Testing (LOW PRIORITY)
**Goal:** Compare activity variants scientifically

1. ❌ Design checkpoint mechanism
2. ❌ Create 2 activity variants
3. ❌ Run both from same checkpoint
4. ❌ Collect metrics
5. ❌ Compare statistically
6. ❌ Document winner

**Blockers:**
- Activity execution not tested
- No metrics collection

**ETA:** 4-6 hours

---

## Risk Assessment

### High Risks 🔴

1. **Activity Execution Untested**
   - Impact: Can't verify core functionality
   - Mitigation: Test with vessel + real codebase ASAP

2. **ACP Protocol Untested**
   - Impact: Multi-vessel coordination may not work
   - Mitigation: Start vessel container, test delegation

3. **Empty Workspace**
   - Impact: Can't run meaningful activities
   - Mitigation: Mount repos/metabob-opencode or test repo

### Medium Risks 🟡

4. **GITHUB_TOKEN Missing**
   - Impact: Can't create PRs
   - Mitigation: Add to secrets, test gh auth

5. **Template Discovery Untested**
   - Impact: Pattern discovery workflow unvalidated
   - Mitigation: Test trace-* templates on real code

6. **No Composition Framework**
   - Impact: Activity chaining may not work as expected
   - Mitigation: Design and test composition pattern

### Low Risks 🟢

7. **Variant Testing Not Designed**
   - Impact: Can't scientifically compare improvements
   - Mitigation: Design after basic execution works

---

## Immediate Action Items

### TODAY (Priority 1 - Blocking)

1. **Start vessel container:**
   ```bash
   docker-compose -f docker-compose.test-vessel.yaml up -d
   ```

2. **Test ACP delegation:**
   - Port forward devbob service
   - Send test prompt via ACP
   - Verify response

3. **Mount real codebase:**
   ```yaml
   # In deployment.yaml or docker-compose
   volumes:
     - ./repos/metabob-opencode:/workspace/project:ro
   ```

4. **Execute one activity:**
   ```bash
   opencode activity execute create-activity \
     --variable activityName="test-activity" \
     --reason "Validate activity execution"
   ```

### THIS WEEK (Priority 2 - High Value)

5. **Add GITHUB_TOKEN** to secrets
6. **Test PR creation** workflow
7. **Test trace-data-flow** on real codebase
8. **Document ACP protocol** usage
9. **Create vessel coordination example**
10. **Test activity composition** (2-3 activities chained)

### THIS MONTH (Priority 3 - Enhancement)

11. Design variant testing framework
12. Create optimization benchmarks
13. Document pattern discovery workflow
14. Build metrics collection dashboard
15. Write vessel coordination patterns guide

---

## Success Criteria (Revised)

### Minimum Viable Deployment (Current: 40% Complete)
- [x] Pod running and healthy
- [x] ACP server responding
- [x] Git operations work
- [ ] Execute one activity successfully
- [ ] Create one PR from activity output
- [ ] Coordinate two vessels on shared task

### Full Capability (Current: 15% Complete)
- [ ] All 8 capabilities validated end-to-end
- [ ] Documentation for each workflow
- [ ] Performance benchmarks established
- [ ] Optimization patterns documented
- [ ] Variant testing framework working
- [ ] Multi-vessel coordination examples
- [ ] Pattern discovery validated

---

## Conclusion

**We have infrastructure but not workflow validation.**

The deployment is technically successful - pod runs, server responds, git works. But we haven't validated ANY of the critical vessel coordination workflows:

🔴 **Can't execute activities** (no codebase, untested)  
🔴 **Can't coordinate vessels** (no vessel connected, untested)  
🔴 **Can't create PRs** (no token configured)  
🔴 **Can't discover patterns** (templates untested)  
🔴 **Can't compose activities** (untested)  
🔴 **Can't compare variants** (no framework)  

**Next Session Must Focus On:**
1. Getting ONE activity to execute successfully
2. Getting TWO vessels to coordinate
3. Creating ONE PR from activity output

Once those three things work, we can build on them.

**Estimated Time to Full Capability:** 15-20 hours  
**Estimated Time to MVP (3 core workflows):** 4-6 hours

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-02  
**Status:** 🔴 **CRITICAL GAPS IDENTIFIED**
