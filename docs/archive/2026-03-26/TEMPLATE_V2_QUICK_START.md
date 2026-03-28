# Quick Start: Using the v2 Template

**Template**: fix-boredom-trace-storage-v2.json  
**Purpose**: Add execution trace storage to MiniBob  
**Time**: ~2-5 minutes  
**Cost**: ~$0.20-$0.50

---

## Option 1: Register and Execute (Recommended)

```bash
# 1. Register the template
curl -X POST http://localhost:8081/v2/templates \
  -H "Content-Type: application/json" \
  -d @templates/fix-boredom-trace-storage-v2.json

# 2. Execute the template
curl -X POST http://localhost:8081/v2/activities \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "fix-boredom-trace-storage",
    "variant_id": "fix-boredom-trace-storage-v2"
  }'

# 3. Monitor in dashboard
open http://dashboard.minibob.local/executions
```

---

## Option 2: Goal-Seeking Execution

```bash
# Submit as a goal for MiniBob to execute
curl -X POST http://api.minibob.local/v2/activities/boredom/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add execution trace storage to MiniBob using the fix-boredom-trace-storage-v2 template",
    "priority": "critical",
    "max_cost": 0.50
  }'
```

---

## What to Expect

### Task Sequence

1. ✅ **Validate prerequisites** (30s) - Checks environment
2. ✅ **Create trace function** (30s) - Adds traceExecution()
3. ✅ **Integrate trace call** (20s) - Calls from executeActivity()
4. ✅ **Build and test** (40s) - Compiles TypeScript
5. ✅ **Create deployment patch** (60s) - Builds Docker image
6. ✅ **Deploy to k8s** (90s) - Deploys to cluster
7. ✅ **Validate trace storage** (300s) - Waits for first trace
8. ✅ **Create documentation** (10s) - Documents implementation

**Total**: ~9-10 minutes (includes 5min wait for trace validation)

### Success Indicators

During execution, look for:
- ✅ "Execution trace stored" in MiniBob logs
- ✅ Traces appearing in dashboard
- ✅ EXECUTION_TRACE_STORAGE_COMPLETE.md created
- ✅ Cost stayed under $0.50

### Failure Handling

If a task fails:
- **Tasks 1-3**: Stops immediately, preserves state
- **Task 4**: Automatically rolls back code changes
- **Task 6**: Automatically rolls back deployment
- **Task 7**: Reports if traces not appearing

All failures create execution traces for debugging!

---

## After Execution

### Verify Success

```bash
# 1. Check for traces
curl http://localhost:8081/v2/activities/execution-traces?limit=5

# 2. Check MiniBob logs
kubectl logs -n activity-system -l component=vessel --tail=20

# 3. View in dashboard
open http://dashboard.minibob.local/executions
```

### Use the New Capability

```bash
# 1. Find a failed execution
FAILED_EXEC=$(curl -s http://localhost:8081/v2/activities/execution-traces?status=failed&limit=1 | jq -r '.traces[0].execution_id')

# 2. Create impulse pointing to it
curl -X POST http://localhost:8081/v2/impulses \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"activityExecutionTrace\",
    \"executionId\": \"$FAILED_EXEC\",
    \"budget\": 100000
  }"

# 3. Submit debugging goal
curl -X POST http://api.minibob.local/v2/goal \
  -H "Content-Type: application/json" \
  -d "{
    \"goal\": \"Debug and fix the failure in execution $FAILED_EXEC\",
    \"impulse_ids\": [\"<impulse_id_from_step_2>\"]
  }"
```

---

## Troubleshooting

### Template not executing

```bash
# Check if backend is running
curl http://localhost:8081/health

# Check if MiniBob is running
kubectl get pods -n activity-system -l component=vessel
```

### Cost exceeds limit

The template is capped at $0.50. If it fails:
- Check which task failed (in dashboard)
- Review execution trace for that task
- Fix underlying issue before retrying

### Validation fails

If prerequisite validation fails:
- Ensure backend is accessible
- Check that repos/minibob exists
- Verify git status is clean

---

## Key Features

### Safety
- ✅ Stops at first validation failure
- ✅ Rolls back on deployment failure
- ✅ Never exceeds $0.50 cost
- ✅ Maximum 3 retry attempts

### Quality
- ✅ Validates before each major step
- ✅ Compiles code before deploying
- ✅ Waits to verify traces appear
- ✅ Creates documentation

### Learning
- ✅ Stores execution trace for itself
- ✅ Preserves error logs
- ✅ Documents all changes made
- ✅ Enables debugging-as-activity

---

## Next Templates to Improve

After this succeeds, apply the same pattern to:

1. Template with <30% success rate → Add validation steps
2. Template that retries infinitely → Add cost cap and max retries
3. Template without clear success criteria → Add explicit validation
4. Template without rollback → Add rollback plan

**Pattern**: Every template should have v2 safety features!

---

**Ready to execute?** Choose Option 1 or 2 above and start!
