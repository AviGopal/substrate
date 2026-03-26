# Repository Alignment Quick Reference

**Date**: February 12, 2026  
**Full Assessment**: See `REPO_ALIGNMENT_ASSESSMENT.md`

---

## TL;DR

✅ **We proved activities work**: Created template via API, executed it successfully  
⚠️ **Proto alignment partial**: Basic execution works, but missing impulse tracking, hooks, isolated workspace  
📋 **Next steps**: 13 hours of focused work to achieve full proto alignment

---

## Critical Gaps Summary

### 1. Impulse Tracking (4 hours)
**What's missing**: StepResult doesn't record which impulses were loaded/created  
**Why it matters**: Cannot learn which context helps activities succeed  
**Where to fix**: 
- `metabob-cli/activity_manager.py`: Add impulse fields to StepResult
- `metabob-rpc-api/v2_activities.py`: Add execution_steps table
- Re-enable `/v2/activities/record/step` calls

### 2. Isolated Workspace (3 hours)
**What's missing**: Activity-create pollutes main workspace  
**Why it matters**: Template creation files clutter repo, tests interfere  
**Where to fix**:
- `metabob-cli/isolated_workspace.py` (NEW): Context manager for temp directories
- `metabob-cli/activity_manager.py`: Wrap activity-create in isolated workspace
- Proto defines: `PreActivityHook.working_directory` with `TemporaryDirectory`

### 3. Hooks Not Implemented (4 hours)
**What's missing**: pre_activity, pre_task, post_task, post_activity hooks  
**Why it matters**: No workspace setup, impulse loading, cleanup  
**Where to fix**:
- `metabob-cli/activity_manager.py`: Execute hooks at each lifecycle point
- Proto defines: `HooksConfig` with 5 hook types

### 4. Trailblaze Variant Creation (2 hours)
**What's missing**: Successful trailblazing doesn't create new variant  
**Why it matters**: Fixes not propagated to template population  
**Where to fix**:
- `metabob-cli/activity_manager.py`: Call derive_template() after trailblaze success

### 5. OpenCode Assessment (TBD)
**What's missing**: Haven't assessed opencode activity tool proto alignment  
**Why it matters**: May be duplicating logic or missing features  
**Where to check**: `repos/metabob-opencode/` (not yet examined)

---

## Repository Concerns

### metabob-cli (Python)
**Role**: MCP server + activity execution engine  
**Recent changes**:
- ✅ Fixed infinite recursion in session token (commit a05a5f3)
- ✅ Added task_steps support for proto (commit 4e1414f)
- ✅ Cached FileStateManager for 16,459x speedup (commit b6a2d3b)
- ⚠️ Disabled /record/start due to backend bug (commit 97e700d)

**HIGH priority concerns**:
- H1: Impulse tracking missing from StepResult
- H2: Isolated workspace not implemented
- H3: /record/start disabled (backend creates duplicate templates)

**MEDIUM priority concerns**:
- M1: Hooks not implemented (5 hook types in proto)
- M2: Trailblaze variant creation missing
- M3: Field naming inconsistency (tasks vs task_steps)

### metabob-rpc-api (Python/FastAPI)
**Role**: Backend API + SurrealDB storage  
**Recent changes**:
- ✅ Phase 2 complete: Execution tracking implemented (commit 5c3bfc5)
- ✅ Proto models added: ProtoTaskStep (commit 6b82376)
- ✅ Impulse provenance infrastructure added (commit 6b82376)

**HIGH priority concerns**:
- H1: No execution_steps table (steps stored as JSON blob)
- H2: Impulse provenance not connected to execution steps
- H3: /record/start creates templates instead of just recording

**MEDIUM priority concerns**:
- M1: Using Pydantic models instead of generated proto bindings
- M2: /record/step endpoint exists but CLI doesn't call it
- M3: Thompson Sampling (A/B testing) behavior undocumented

### metabob-proto (Protobuf)
**Role**: Source of truth for data schemas  
**Structure**:
```
proto/metabob/activity/
  ├── variant.proto      (TaskStep, ActivityVariant)
  ├── execution.proto    (ExecutionConfig, Hooks, ContextRequirement)
  ├── optimization.proto (Thompson Sampling)
  └── admin.proto        (Management)
```

**LOW priority concerns**:
- L1: No ActivityExecutionResult message defined
- L2: ImpulseReference defined but not linked to execution recording

### metabob-opencode (TypeScript) - NOT YET ASSESSED
**Role**: Activity execution engine (primary user of proto)  
**Status**: ❌ CRITICAL - Not yet examined  
**Questions**:
- Does activity tool implement proto-defined hooks?
- Does it create isolated workspaces?
- How does it handle impulse tracking?
- Is it duplicating metabob-cli logic?

---

## Execution Flow Comparison

### Current (Partial Proto Alignment)
```
1. start_execution() → Create in-memory execution
2. get_next_step() → Return step from template
3. Agent executes → report_step_result(step_id, success, output)
4. Repeat for all steps
5. _check_completion() → /v2/activities/record/complete (bulk)
```

**Missing**: Hooks, impulse tracking, isolated workspace, real-time recording

### Proto-Defined (Full Alignment)
```
1. start_execution() → Create workspace, load impulses, /record/start
2. get_next_step() → Pre-task hooks, return step
3. Agent executes → report_step_result(... + impulses), /record/step
4. Post-task hooks → Unload impulses
5. Repeat for all steps
6. _check_completion() → Post-activity hooks, cleanup, /record/complete
7. If trailblaze → derive_template() to create variant
```

---

## Testing Proof

### What We Proved Today ✅

**Test 1: Template Creation**
```bash
curl -X POST http://localhost:8080/v2/activities/templates \
  -d '{"name": "Proof Greeting Feb12", "tasks": [...]}'

# Result: ✅ Template created (infrastructure-51aee5c8)
```

**Test 2: Template Discovery**
```bash
search_activities("Proof Greeting Feb12")

# Result: ✅ Template found in search results
```

**Test 3: Template Execution**
```python
exec_id = await mgr.start_execution(
    activity_id="infrastructure-51aee5c8",
    variables={"name": "DevBob"}
)

# Result: ✅ Execution completed successfully
# Output: "Hello DevBob Proof System, welcome to the system!"
```

**Conclusion**: Basic activity system works. Core execution functional. Missing advanced features (impulse tracking, hooks, isolation).

---

## Remediation Roadmap (13 Hours)

### Phase 1: Critical Fixes (4 hours)
1. Fix /record/start (1h) - Backend should NOT create templates
2. Add impulse tracking to StepResult (1h) - CLI dataclass
3. Create execution_steps table (1h) - Backend schema
4. Implement /record/step calls (1h) - CLI → Backend real-time

### Phase 2: Isolated Workspace (3 hours)
1. Implement IsolatedWorkspace class (2h) - Context manager
2. Integrate with ActivityManager (1h) - Detect activity-create

### Phase 3: Hooks Implementation (4 hours)
1. PreActivityHook (1h) - Load impulses, set env
2. PreTaskHook (1h) - Task-specific impulses
3. PostTaskHook (1h) - Unload impulses, capture outputs
4. PostActivityHook (1h) - Cleanup, persist

### Phase 4: Trailblaze Variants (2 hours)
1. Automatic variant creation (2h) - Call derive_template()

### Phase 5: OpenCode Assessment (TBD)
1. Review OpenCode activity tool (4h)
2. Generate proto bindings (2h)

---

## Key Files Reference

### metabob-cli
- `src/metabob_cli/mcp/activity_manager.py` - Main execution engine
- `src/metabob_cli/mcp/tools.py` - MCP tool definitions
- `src/metabob_cli/core/file_state.py` - Session state management

### metabob-rpc-api
- `server/routes/v2_activities.py` - V2 API endpoints
- `server/actions/activity_variants.py` - Template CRUD
- `server/actions/activities.py` - Execution recording
- `sql/init/01-init-devbob.sql` - Database schema

### metabob-proto
- `proto/metabob/activity/variant.proto` - TaskStep, ActivityVariant
- `proto/metabob/activity/execution.proto` - ExecutionConfig, Hooks
- `activities/bootstrap/*.json` - Bootstrap templates

---

## Success Criteria

Activity system is fully proto-aligned when:
- [ ] StepResult tracks impulses (impulses_loaded, impulses_created)
- [ ] execution_steps table exists in SurrealDB
- [ ] /record/step called after each step
- [ ] Activity-create runs in isolated workspace
- [ ] Hooks (pre/post activity/task) functional
- [ ] Trailblaze fixes create new variants
- [ ] OpenCode activity tool assessed
- [ ] Proto bindings generated and used

Current: 1/8 ✅ (Basic execution works)  
After remediation: 8/8 ✅ (Full proto alignment)

---

## Quick Commands

**Create session**:
```bash
python3 scripts/create_session_state.py
```

**Search activities**:
```python
search_activities({"query": "activity create", "verbose": true})
```

**Test execution**:
```bash
python3 test_proof_execution.py
```

**Check backend logs**:
```bash
docker logs api-server-dev --tail 50
```

---

For full details, see `REPO_ALIGNMENT_ASSESSMENT.md` (660 lines)
