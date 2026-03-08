# Activity Lifecycle E2E Validation Plan

## Current Status Summary

### Phase 1: Impulse Binding Foundation ✅ COMPLETE
- **Commits**: metabob-rpc-api@4307538, metabob-cli@581e2d48f, main@ad8b188
- **Implementation**: 3 new impulse types (testResults, taskSummary, scriptArtifact)
- **Functionality**: bind_impulses_as_variables() with TypedDict return
- **Validation**: 18 unit tests + 9 validation tests = 100% pass
- **Type Safety**: TypedDicts added for cross-vessel communication
- **Bugs Fixed**: 6 async/await bugs in impulse routes
- **Status**: Ready for deployment

### Activity Lifecycle: Partial Implementation (2/10 Gaps)
- **Commits**: metabob-cli@aa799fa54, metabob-rpc-api (latest), main@8eb1456
- **Gap 1 ✅**: Dynamic creation trigger (no templates → suggestion)
- **Gap 9 ✅**: Multi-tenant scoping (org_id/project_id filtering)
- **Remaining**: 8 gaps (pattern extraction, split/merge, evolution, replay)
- **Status**: Needs E2E validation before proceeding

## User Requirements Analysis

### Requirement 1: Dynamic Activity Creation
**User Said**: "we should expect this to happen whenever we can't run an existing activity"

**Implementation Status**: ✅ GAP-1 CLOSED
- When templates.length == 0, return suggestion object
- Suggestion points to metabob_create_activity_goal_seeking
- User notified to create custom activity

**Needs Validation**:
- [ ] Test template search returns empty for novel request
- [ ] Verify suggestion object structure correct
- [ ] Test create_activity_goal_seeking actually creates template
- [ ] Verify created template stored in backend with org/project scope

### Requirement 2: Store All Created Activities
**User Said**: "Our goal is to store all created activities and process them over time"

**Implementation Status**: ⚠️ GAP-2 PARTIAL
- Activity storage exists in backend (activity.py routes)
- Execution recording works (StepResult with impulses)
- Missing: Automatic storage hook on create_activity_goal_seeking completion

**Needs Validation**:
- [ ] Create activity via goal-seeking
- [ ] Query backend: GET /v2/activities?org_id=X&project_id=Y
- [ ] Verify newly created activity appears in results
- [ ] Check execution_history table has records

**Needs Implementation**:
- [ ] Hook in create_activity_goal_seeking to POST template to backend
- [ ] Add org_id/project_id to template metadata

### Requirement 3: Pattern Learning Over Time
**User Said**: "we are looking for common patterns, common tasks, and common impulses"

**Implementation Status**: ❌ GAP-3 NOT IMPLEMENTED (CRITICAL)

**What's Needed**:
```python
# New file: repos/metabob-rpc-api/server/services/pattern_extraction.py

async def extract_patterns(org_id: str, project_id: str):
    """
    Analyze all activities for org/project to find:
    - Common task sequences
    - Common impulse usage patterns  
    - Common validation patterns
    """
    
    # Get all activity executions
    executions = await get_executions_for_org(org_id, project_id)
    
    # Extract task patterns
    task_patterns = {}
    for execution in executions:
        for task in execution.tasks:
            pattern_key = hash(task.prompt)
            if pattern_key not in task_patterns:
                task_patterns[pattern_key] = {
                    "count": 0,
                    "example_task": task,
                    "activities": []
                }
            task_patterns[pattern_key]["count"] += 1
            task_patterns[pattern_key]["activities"].append(execution.activity_id)
    
    # Find patterns appearing in 3+ activities
    common_patterns = [
        p for p in task_patterns.values() 
        if p["count"] >= 3
    ]
    
    return common_patterns

async def extract_impulse_patterns(org_id: str, project_id: str):
    """
    Find common impulse usage across activities
    """
    # Similar logic for impulses
    pass
```

**Needs Validation** (after implementation):
- [ ] Create 3 activities with similar tasks
- [ ] Run pattern extraction
- [ ] Verify common patterns identified
- [ ] Check pattern count accuracy

### Requirement 4: Boredom Activities
**User Said**: "vessels that are connected to the backend via metabob-cli will have access to boredom activities they will need to run periodically"

**Implementation Status**: ✅ GAP-9 CLOSED (partial), ❌ GAP-5/GAP-10 NOT IMPLEMENTED

**What Works**:
- metabob_fetch_boredom_activities MCP tool exists
- Multi-tenant filtering by org_id/project_id works
- Priority scoring based on improvement gradient

**What's Missing**:
- [ ] GAP-5: Boredom activity types (split, merge, debug)
- [ ] GAP-10: Periodic scheduling mechanism

**Needs Implementation**:
```python
# Boredom activity types
class BoredomActivityType(Enum):
    SPLIT_OVERSIZED = "split_oversized"  # Task too complex, split into subtasks
    MERGE_SIMILAR = "merge_similar"      # Multiple similar tasks, merge
    DEBUG_FAILING = "debug_failing"      # Low success rate, needs debugging
    OPTIMIZE_SLOW = "optimize_slow"      # High duration, needs optimization
    REDUCE_COST = "reduce_cost"          # High cost, needs efficiency

async def generate_boredom_activity(
    template_id: str,
    boredom_type: BoredomActivityType,
    org_id: str,
    project_id: str
):
    """
    Generate boredom activity based on metrics
    """
    if boredom_type == BoredomActivityType.SPLIT_OVERSIZED:
        # Create activity that splits large task
        return {
            "name": f"Split {template_id} into smaller tasks",
            "task": "Analyze task complexity and split into subtasks",
            "validator": "Compare success rate before/after split"
        }
    # ... other types
```

**Periodic Scheduling**:
```python
# New file: repos/metabob-cli/src/metabob_cli/scheduler/boredom_scheduler.py

async def schedule_boredom_check(interval_hours: int = 24):
    """
    Periodically check for boredom activities
    Called by vessel on startup, runs in background
    """
    while True:
        await asyncio.sleep(interval_hours * 3600)
        
        # Fetch boredom activities for this org/project
        boredom_activities = await fetch_boredom_activities()
        
        # Notify user or auto-execute based on config
        if config.auto_execute_boredom:
            for activity in boredom_activities[:3]:  # Top 3
                await execute_boredom_activity(activity)
        else:
            logger.info(f"Boredom activities available: {len(boredom_activities)}")
```

**Needs Validation** (after implementation):
- [ ] Create activity with low success rate
- [ ] Wait for boredom detection
- [ ] Verify DEBUG_FAILING activity generated
- [ ] Execute boredom activity
- [ ] Verify success rate improves

### Requirement 5: Activity Evolution
**User Said**: "This is where our activity evolution, splitting, merging, debugging will occur"

**Implementation Status**: ❌ GAP-6 NOT IMPLEMENTED (HIGH)

**What's Needed**:
```python
# New file: repos/metabob-rpc-api/server/services/activity_evolution.py

async def evolve_activity(
    original_template_id: str,
    evolution_type: str,  # "split", "merge", "debug"
    org_id: str,
    project_id: str
) -> str:
    """
    Create evolved version of activity template
    Returns new template_id
    """
    
    original = await get_template(original_template_id)
    
    if evolution_type == "split":
        # Split large task into multiple smaller tasks
        new_template = await split_template(original)
    elif evolution_type == "merge":
        # Merge similar tasks
        new_template = await merge_tasks(original)
    elif evolution_type == "debug":
        # Add error handling, validation
        new_template = await add_debugging(original)
    
    # Create new template as variant of original
    new_template.genealogy = {
        "parent_id": original_template_id,
        "evolution_type": evolution_type,
        "generation": original.genealogy.generation + 1
    }
    
    # Store new template
    new_id = await create_template(new_template, org_id, project_id)
    
    return new_id
```

**Needs Validation** (after implementation):
- [ ] Create oversized activity (1 task with 10 subtasks)
- [ ] Evolve with type="split"
- [ ] Verify new template has 10 separate tasks
- [ ] Run both templates, compare success rates
- [ ] Verify genealogy tracking (parent_id, generation)

### Requirement 6: Task Replay with Validation Comparison
**User Said**: "To do this we must be able to replay tasks and compare the expected validator result to what occurred. We can use impulses for this, since activities can run as impulses we can replay anything that is necessary."

**Implementation Status**: ❌ GAP-7 NOT IMPLEMENTED (MEDIUM)

**What's Needed**:
```python
# New file: repos/metabob-rpc-api/server/services/task_replay.py

@dataclass
class ReplayResult:
    original_output: str
    replay_output: str
    match: bool
    differences: List[str]

async def replay_task(
    execution_id: str,
    task_id: str,
    org_id: str,
    project_id: str
) -> ReplayResult:
    """
    Replay a task using stored impulses
    Compare output to original execution
    """
    
    # Load original execution
    original = await get_execution(execution_id, task_id)
    
    # Load impulses that were inputs to this task
    input_impulses = original.impulses_loaded
    
    # Re-run task with same inputs
    replay_execution = await execute_task(
        task=original.task,
        impulses=input_impulses
    )
    
    # Compare outputs field-by-field
    differences = []
    original_out = json.loads(original.output)
    replay_out = json.loads(replay_execution.output)
    
    for key in original_out:
        if original_out[key] != replay_out.get(key):
            differences.append(f"{key}: {original_out[key]} != {replay_out.get(key)}")
    
    return ReplayResult(
        original_output=original.output,
        replay_output=replay_execution.output,
        match=len(differences) == 0,
        differences=differences
    )
```

**Validation Strategy**:
```python
async def validate_evolution_with_replay(
    original_template_id: str,
    evolved_template_id: str,
    org_id: str,
    project_id: str
):
    """
    Compare original vs evolved using replay
    """
    
    # Get sample execution of original
    original_executions = await get_recent_executions(original_template_id)
    sample = original_executions[0]
    
    # Replay with evolved template using same inputs
    evolved_result = await execute_template(
        evolved_template_id,
        impulses=sample.impulses_loaded
    )
    
    # Compare validator results
    if evolved_result.success_rate > sample.success_rate:
        # Evolution improved, promote
        await promote_template(evolved_template_id)
    else:
        # Evolution didn't help, keep original
        logger.info(f"Evolution {evolved_template_id} did not improve, keeping {original_template_id}")
```

**Needs Validation** (after implementation):
- [ ] Execute activity, record output as impulse
- [ ] Replay same activity with same inputs
- [ ] Compare outputs field-by-field
- [ ] Verify determinism (100% match for same inputs)
- [ ] Test with evolved template
- [ ] Verify evolution comparison works

### Requirement 7: Org/Project Scoping
**User Said**: "We should only get activities for our org / project scope"

**Implementation Status**: ✅ GAP-9 CLOSED

**What Works**:
- get_boredom_candidates filters by org_id/project_id
- Backend queries enforce (org_id, project_id) scope
- Multi-tenant isolation at data layer

**Needs Validation**:
- [x] Create activity with org1/proj1
- [x] Query with org1/proj1 → expect activity
- [x] Query with org2/proj2 → expect empty
- [x] Verify no cross-org data leakage

## E2E Validation Harness Design

### Test Suite: activity-lifecycle-e2e-endpoint-validation.py

**Location**: `tests/validation-harnesses/activity-lifecycle-e2e-endpoint-validation.py`

**Test Cases**:

#### 1. Dynamic Creation Trigger Test
```python
def test_dynamic_creation_trigger():
    """
    Test GAP-1: Dynamic creation when no templates match
    """
    # Request non-existent template
    response = requests.get(
        f"{API_URL}/v2/templates/search",
        params={
            "query": "completely-unique-request-xyz123",
            "org_id": "test-org",
            "project_id": "test-proj"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Should return empty templates
    assert len(data["templates"]) == 0
    
    # Should return suggestion
    assert "suggestion" in data
    assert data["suggestion"]["type"] == "CREATE_ACTIVITY"
    assert data["suggestion"]["tool"] == "metabob_create_activity_goal_seeking"
```

#### 2. Activity Storage Test
```python
def test_activity_storage():
    """
    Test GAP-2: Created activities stored with org/project scope
    """
    # Create activity via goal-seeking (mock)
    template = {
        "name": "Test Activity",
        "category": "infrastructure",
        "org_id": "test-org",
        "project_id": "test-proj",
        "tasks": [...]
    }
    
    response = requests.post(
        f"{API_URL}/v2/templates",
        json=template,
        headers={"X-API-Key": API_KEY}
    )
    
    assert response.status_code == 201
    template_id = response.json()["template_id"]
    
    # Query backend
    query_response = requests.get(
        f"{API_URL}/v2/templates",
        params={
            "org_id": "test-org",
            "project_id": "test-proj"
        }
    )
    
    assert template_id in [t["id"] for t in query_response.json()["templates"]]
```

#### 3. Multi-Tenant Isolation Test
```python
def test_multi_tenant_isolation():
    """
    Test GAP-9: Org/project scoping enforced
    """
    # Create activity for org1/proj1
    template_org1 = create_activity("org1", "proj1")
    
    # Query with org2/proj2
    response = requests.get(
        f"{API_URL}/v2/templates",
        params={
            "org_id": "org2",
            "project_id": "proj2"
        }
    )
    
    templates = response.json()["templates"]
    
    # Should NOT see org1's activity
    assert template_org1["id"] not in [t["id"] for t in templates]
```

#### 4. Boredom Activities Test
```python
def test_boredom_activities():
    """
    Test boredom activity fetching with multi-tenant scope
    """
    response = requests.get(
        f"{API_URL}/v2/boredom-candidates",
        params={
            "org_id": "test-org",
            "project_id": "test-proj",
            "max_results": 5
        }
    )
    
    assert response.status_code == 200
    candidates = response.json()["candidates"]
    
    # All candidates should be for this org/project
    for candidate in candidates:
        assert candidate["org_id"] == "test-org"
        assert candidate["project_id"] == "test-proj"
```

#### 5. Type Preservation Test
```python
def test_type_preservation():
    """
    Test cross-vessel type safety (int stays int, not string)
    """
    impulse = {
        "type": "testResults",
        "task_id": "task-1",
        "command": "pytest",
        "exit_code": 0,  # INTEGER
        "passed": True,   # BOOLEAN
        "test_count": 42  # INTEGER
    }
    
    # POST impulse
    post_response = requests.post(
        f"{API_URL}/v2/impulses",
        json=impulse,
        headers={"X-API-Key": API_KEY}
    )
    
    impulse_id = post_response.json()["impulse_id"]
    
    # GET impulse
    get_response = requests.get(
        f"{API_URL}/v2/impulses/{impulse_id}"
    )
    
    retrieved = get_response.json()
    
    # Verify types preserved
    assert isinstance(retrieved["exit_code"], int)  # NOT string "0"
    assert isinstance(retrieved["passed"], bool)    # NOT string "true"
    assert isinstance(retrieved["test_count"], int) # NOT string "42"
```

#### 6. Pydantic Validation Test
```python
def test_pydantic_validation():
    """
    Test Pydantic catches type errors
    """
    invalid_impulse = {
        "type": "testResults",
        "task_id": "task-1",
        "command": "pytest",
        "exit_code": "INVALID",  # Should be int
        "passed": "yes",          # Should be bool
        "test_count": "forty-two" # Should be int
    }
    
    response = requests.post(
        f"{API_URL}/v2/impulses",
        json=invalid_impulse,
        headers={"X-API-Key": API_KEY}
    )
    
    # Should return HTTP 400
    assert response.status_code == 400
    
    # Should have Pydantic validation errors
    errors = response.json()["detail"]
    assert any("exit_code" in str(e) for e in errors)
    assert any("passed" in str(e) for e in errors)
    assert any("test_count" in str(e) for e in errors)
```

#### 7. Random Data Integrity Test
```python
def test_random_data_integrity():
    """
    Test data survives round-trip through full stack
    """
    import random
    import string
    
    # Generate random data
    random_data = {
        "type": "taskSummary",
        "task_id": f"task-{''.join(random.choices(string.ascii_lowercase, k=8))}",
        "success": random.choice([True, False]),
        "duration": random.randint(1000, 60000),
        "cost": round(random.uniform(0.01, 10.0), 4),
        "key_outputs": [f"output-{i}" for i in range(random.randint(1, 5))]
    }
    
    # POST
    post_response = requests.post(
        f"{API_URL}/v2/impulses",
        json=random_data
    )
    
    impulse_id = post_response.json()["impulse_id"]
    
    # GET
    get_response = requests.get(
        f"{API_URL}/v2/impulses/{impulse_id}"
    )
    
    retrieved = get_response.json()
    
    # Compare field-by-field
    for key in random_data:
        assert retrieved[key] == random_data[key], f"Mismatch in {key}"
```

## Deployment Strategy

### Step 1: Deploy Phase 1 + GAP-1/GAP-9
```bash
# Navigate to deployment directory
cd repos/platform/metabob-apps

# Deploy with helmfile
helmfile --environment default apply

# Wait for rollout
kubectl rollout status deployment/metabob-rpc-api -n metabob
```

### Step 2: Run E2E Validation
```bash
# Copy validation harness to devbob pod
kubectl cp tests/validation-harnesses/activity-lifecycle-e2e-endpoint-validation.py \
  metabob/devbob-84466fdfff-dd87l:/tmp/

# Install dependencies
kubectl exec -n metabob devbob-84466fdfff-dd87l -- \
  pip install requests

# Run validation
kubectl exec -n metabob devbob-84466fdfff-dd87l -- \
  python3 /tmp/activity-lifecycle-e2e-endpoint-validation.py --verbose

# Retrieve results
kubectl exec -n metabob devbob-84466fdfff-dd87l -- \
  cat /tmp/validation-results.json > validation-results.json
```

### Step 3: Verify Results
Expected output:
```json
{
  "test_dynamic_creation_trigger": "PASS",
  "test_activity_storage": "PASS",
  "test_multi_tenant_isolation": "PASS",
  "test_boredom_activities": "PASS",
  "test_type_preservation": "PASS",
  "test_pydantic_validation": "PASS",
  "test_random_data_integrity": "PASS",
  "overall": "PASS",
  "passed": 7,
  "failed": 0,
  "total": 7
}
```

## Next Steps After Validation

### If All Tests Pass ✅
1. Proceed with GAP-3: Pattern Extraction (CRITICAL)
2. Implement GAP-10: Periodic Scheduling (CRITICAL)
3. Implement GAP-5: Boredom Activity Types (HIGH)
4. Implement GAP-6: Evolution Logic (HIGH)

### If Tests Fail ❌
1. Analyze failure logs
2. Fix identified issues
3. Re-run validation
4. Repeat until 100% pass rate

## Success Criteria

- [ ] All 7 E2E test cases pass (100%)
- [ ] Dynamic creation trigger works in production
- [ ] Multi-tenant isolation verified (no cross-org leakage)
- [ ] Type preservation confirmed (int stays int)
- [ ] Pydantic validation catches errors
- [ ] Random data survives round-trip intact
- [ ] Boredom activities filtered correctly
- [ ] Ready to proceed with remaining 8 lifecycle gaps

## Status: Ready for Validation

**Current State**: Code implemented, tests designed, waiting for deployment and validation execution.

**Blocking Issue**: Template lookup error (temporary backend issue)

**Next Action**: Deploy Phase 1 + GAP-1/GAP-9 to k8s and run E2E validation harness.
