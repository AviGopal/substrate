# Existing Infrastructure Mapping

## Core Insight

**"We already have 90% of what we need. We just need to connect it."**

This document maps our existing, working infrastructure to the canary workflow requirements.

---

## What We Already Have

### ✅ 1. Container Infrastructure (devbob)

**Status**: FULLY FUNCTIONAL

**Available Commands**:
```bash
./devbob start                    # Start backend + devbob-opencode
./devbob agent start <name>       # Start specific agent container
./devbob agent stop <name>        # Stop agent container
./devbob agent shell <name>       # Open shell in agent
./devbob agent logs <name>        # View logs
./devbob status                   # Check status
./devbob debug health             # System health check
```

**Available Agents**:
- `devbob-opencode` - OpenCode with ACP (port 3004)
- `devbob-rpc-api` - RPC API development
- `devbob-cli` - CLI development
- `devbob-dashboard` - Dashboard development
- `devbob-orchestrator` - Project orchestration

**Backend Services** (Shared):
- metabob-rpc-api: `http://localhost:8080`
- surreal: `http://localhost:8000`
- redis: `redis://localhost:6379`

---

### ✅ 2. Activity Templates

**Status**: 37 TEMPLATES AVAILABLE

**Working Templates** (100% success rate):
- `add-feature-no-conditionals` - Add feature (simplified)
- `docker-compose-health-check` - Health checks
- `improve-activity-system-reliability` - System improvements
- `organize-documentation` - Documentation cleanup
- `test-failure-activity` - Test failure handling
- `ultra-simple-test` - Minimal test

**Self-Improvement Templates**:
- `add-feature-complete` - Full feature workflow (needs fixing: 0% success)
- `fix-bug-complete` - Full bug fix workflow (needs fixing: 0% success)
- `refactor-component-complete` - Full refactor workflow (needs fixing: 0% success)
- `create-subagent` - Create new agents

**Infrastructure Templates**:
- `commit-organized-changes` - Git commits
- `add-comprehensive-tests` - Test coverage
- `generate-documentation` - Docs generation
- `cleanup-code` - Code cleanup

---

### ✅ 3. ACP Delegation

**Status**: WORKING IN CONTAINERS

**Evidence from Scripts**:
```bash
# Found in multiple test scripts:
docker exec -i devbob-opencode opencode acp --cwd /workspace
acp_delegate(target="docker://devbob-opencode", ...)
```

**Capability**: Can delegate tasks to agents in containers via ACP

---

### ✅ 4. Tools for Container Interaction

**Status**: EXTENSIVE BASH SCRIPTS EXIST

**Found Scripts** (~100+ uses of `docker exec`):
- `test-devbob-connection.sh` - Test container connectivity
- `trace-agent-behavior.sh` - Monitor agent execution
- `validate-sterile-test-prerequisites.sh` - Check clean environment
- `test-activity-create-sterile.sh` - Test in clean container

**Pattern**: All scripts use `docker exec` to interact with containers

---

### ✅ 5. Git Integration

**Status**: BUILT-IN TO ACTIVITIES

**Available in Templates**:
- `commit-organized-changes` activity already exists
- Many templates include git operations
- Rollback via git branches is standard practice

---

### ✅ 6. Health Checks

**Status**: BUILT-IN TO DEVBOB

**Available**:
- `./devbob debug health` - System-wide health check
- `docker-compose-health-check` activity template
- Health checks in docker-compose services

---

## Mapping to Canary Workflow

### What We Need → What We Have

| Canary Need | Existing Infrastructure | Gap |
|-------------|------------------------|-----|
| **Start clean container** | `./devbob agent start devbob-opencode` | ✅ HAVE IT |
| **Execute activity in container** | `acp_delegate(...)` or `docker exec ... opencode activity execute` | ✅ HAVE IT |
| **Capture knowledge** | Store files, logs, artifacts | ⚠️ Need activity |
| **Copy files from container** | `docker cp devbob-opencode:/workspace/... ./` | ✅ HAVE IT |
| **Stop container** | `./devbob agent stop devbob-opencode` | ✅ HAVE IT |
| **Fresh container** | `./devbob agent stop` + `./devbob agent start` | ✅ HAVE IT |
| **Validate success** | Run tests, check files | ✅ HAVE IT (in templates) |
| **Create rollback branch** | `git checkout -b canary-rollback-...` | ✅ HAVE IT |
| **Deploy to host** | Run activity on host (no container) | ✅ HAVE IT |

**Gap Analysis**: We're missing 1 thing - **knowledge capture activity**. Everything else exists.

---

## Simplified Canary Workflow (Using Existing Tools)

### Phase 1: Experiment

```bash
# Start clean container
./devbob agent start devbob-opencode

# Execute activity in container (Option A: Direct)
docker exec -i devbob-opencode bash -c "
  cd /workspace && 
  opencode activity execute add-feature-no-conditionals \
    --variables '{\"feature_name\": \"test\", \"feature_description\": \"test\"}' \
    --reason 'Canary test'
"

# OR (Option B: Via ACP delegation from host)
opencode acp-delegate \
  --target "docker://devbob-opencode" \
  --prompt "Execute add-feature-no-conditionals activity"

# Copy artifacts from container
docker cp devbob-opencode:/workspace/. ./canary-artifacts/experiment-1/

# Stop container
./devbob agent stop devbob-opencode
```

---

### Phase 2: Demonstrate

```bash
# Start FRESH container
./devbob agent start devbob-opencode

# Execute same activity
docker exec -i devbob-opencode bash -c "
  cd /workspace && 
  opencode activity execute add-feature-no-conditionals \
    --variables '{\"feature_name\": \"test\", \"feature_description\": \"test\"}' \
    --reason 'Demonstration'
"

# Copy artifacts
docker cp devbob-opencode:/workspace/. ./canary-artifacts/demonstration-1/

# Compare with experiment
diff -r ./canary-artifacts/experiment-1/ ./canary-artifacts/demonstration-1/

# Stop container
./devbob agent stop devbob-opencode
```

---

### Phase 3: Adopt

```bash
# Create rollback branch
git checkout -b canary-rollback-test-$(date +%s)
git add -A && git commit -m "Rollback point before canary adoption"

# Execute on HOST (not container)
opencode activity execute add-feature-no-conditionals \
  --variables '{"feature_name": "test", "feature_description": "test"}' \
  --reason 'Adopt from canary'

# Validate
npm test

# If success: Merge
git checkout main
git merge --no-ff canary-rollback-test-...

# If failure: Rollback
git checkout canary-rollback-test-...
git checkout main
```

---

## What We Need to Build (Minimal)

### Activity 1: `canary-capture-knowledge`

**Purpose**: Extract knowledge after successful canary test

```typescript
{
  "id": "canary-capture-knowledge",
  "name": "Canary Capture Knowledge",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "task-1",
      "description": "Copy artifacts from container",
      "prompt": "Copy all files from container {{containerName}}:/workspace to ./canary-artifacts/{{experimentId}}/"
    },
    {
      "id": "task-2",
      "description": "Extract execution summary",
      "dependencies": ["task-1"],
      "prompt": "Review artifacts and create CANARY_KNOWLEDGE_{{activityId}}.md with:\n- What was built\n- How it was built (commands)\n- Why it worked\n- Validation steps"
    }
  ]
}
```

**Size**: ~50 lines (minimal)

---

### Activity 2: `canary-compare-demonstrations`

**Purpose**: Compare experiment vs. demonstration artifacts

```typescript
{
  "id": "canary-compare-demonstrations",
  "name": "Canary Compare Demonstrations",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "task-1",
      "description": "Compare artifacts",
      "prompt": "Compare:\n- canary-artifacts/experiment-{{experimentId}}/\n- canary-artifacts/demonstration-{{demonstrationId}}/\n\nReport: SAME or DIFFERENT (with details)"
    },
    {
      "id": "task-2",
      "description": "Update knowledge document",
      "dependencies": ["task-1"],
      "prompt": "Update CANARY_KNOWLEDGE_{{activityId}}.md with demonstration results:\n- Date/time\n- Outcome: REPEATABLE or INCOMPLETE\n- Differences (if any)"
    }
  ]
}
```

**Size**: ~40 lines (minimal)

---

### Activity 3: `canary-adopt-with-rollback`

**Purpose**: Deploy to host with rollback branch

```typescript
{
  "id": "canary-adopt-with-rollback",
  "name": "Canary Adopt with Rollback",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "task-1",
      "description": "Create rollback branch",
      "prompt": "Create git branch: canary-rollback-{{activityId}}-{{timestamp}}\nCommit current state"
    },
    {
      "id": "task-2",
      "description": "Execute activity on host",
      "dependencies": ["task-1"],
      "prompt": "Execute activity {{activityId}} with variables {{variables}} ON HOST (not container)"
    },
    {
      "id": "task-3",
      "description": "Validate deployment",
      "dependencies": ["task-2"],
      "prompt": "Run validation:\n- npm test\n- Check files created\n- Verify functionality"
    }
  ]
}
```

**Size**: ~50 lines (minimal)

---

## Total Work Required

**To Build**:
- 3 small activity templates (~140 lines total)
- 1 wrapper script for convenience (optional)

**To Reuse**:
- `./devbob` commands (already working)
- `docker exec` / `docker cp` (already working)
- Existing activity templates (37 available)
- Git operations (already integrated)
- ACP delegation (already working)

**Ratio**: Build 140 lines, reuse ~10,000+ lines

---

## Recommended Approach

### Step 1: Test Existing Infrastructure

```bash
# Verify containers work
./devbob start
./devbob status

# Verify activity execution in container works
docker exec -i devbob-opencode bash -c "
  cd /workspace && 
  opencode activity execute ultra-simple-test --reason 'Test'
"

# Verify we can copy files
docker cp devbob-opencode:/workspace/test.txt ./

# Verify git operations work
git checkout -b test-rollback
git checkout main
git branch -D test-rollback
```

---

### Step 2: Create Minimal Glue Activities

```bash
# Create the 3 small activities using our existing templates
opencode activity execute add-feature-no-conditionals \
  --variables '{
    "feature_name": "Canary Knowledge Capture",
    "feature_description": "Activity to capture knowledge from canary tests"
  }' \
  --reason "Build minimal glue for canary workflow"
```

---

### Step 3: Test End-to-End

```bash
# Full canary workflow test
./devbob agent start devbob-opencode
# ... execute activity
# ... capture knowledge
# ... stop container
# ... repeat in fresh container
# ... compare
# ... adopt to host
```

---

## Success Criteria

✅ Can execute activity in `devbob-opencode` container  
✅ Can copy artifacts from container to host  
✅ Can capture knowledge document  
✅ Can repeat execution in fresh container  
✅ Can compare results  
✅ Can create rollback branch  
✅ Can deploy to host with rollback ready  

**Timeline**: 2-3 hours to build the 3 glue activities and test

---

## The Beautiful Part

**We're not building a new system. We're connecting existing, working pieces.**

- ✅ Containers: WORKING
- ✅ Activity execution: WORKING
- ✅ Git operations: WORKING
- ✅ File operations: WORKING
- ✅ Health checks: WORKING
- ✅ Logging: WORKING

**Missing**: 3 small activity templates to glue it together

**This is the power of "keep working things working and generalize them."**

---

## Next Steps

1. ✅ Mapped existing infrastructure
2. Create 3 minimal glue activities (2-3 hours)
3. Test end-to-end canary workflow (1 hour)
4. Document usage patterns (1 hour)

**Total time to working canary system: 4-5 hours**

**Then we can safely start self-improvement with confidence.**

---

## Ready to Build the Glue?

```bash
# Start with the simplest: knowledge capture
opencode activity execute add-feature-no-conditionals \
  --variables '{
    "feature_name": "Canary Knowledge Capture",
    "feature_description": "Extract knowledge from successful canary execution. Copies artifacts from container, analyzes results, creates knowledge document. See EXISTING_INFRASTRUCTURE_MAPPING.md for spec."
  }' \
  --reason "Build first glue activity for canary workflow"
```

**Let's connect what we have, not build what we don't need.** 🔧
