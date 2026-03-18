# Meta-Level Activity Composition Demonstration

This demonstration **proves** that activity execution engines can be built as compositions of activities, not just as monolithic code.

## Quick Start

```bash
# 1. Ensure your environment is running
kubectl get pods -n activity-system

# 2. Run the complete demonstration
cd demos/meta-composition
./run-demonstration.sh

# 3. View results in dashboard
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000
# Open: http://localhost:3000

# 4. (Optional) Run Playwright tests for screenshots
npm install
npx playwright install
npx playwright test
```

## What This Proves

✅ **Activities can call other activities** via the `activity` tool  
✅ **Meta-level executors work** through composition  
✅ **Pattern is observable** in production environment  
✅ **Execution is scalable** and reusable  

## Architecture

```
Meta-Executor (meta-greeting-workflow)
├─ Task 1: execute-greeting
│  └─ Calls: generate-greeting activity
├─ Task 2: execute-timestamp
│  └─ Calls: generate-timestamp activity  
├─ Task 3: execute-combine
│  └─ Calls: combine-outputs activity
└─ Task 4: report-composition-success
   └─ Confirms all sub-activities succeeded
```

## Files

### Templates
- `templates/generate-greeting.json` - Building block #1
- `templates/generate-timestamp.json` - Building block #2
- `templates/combine-outputs.json` - Building block #3
- `templates/meta-greeting-workflow.json` - **The meta-executor**

### Scripts
- `run-demonstration.sh` - Automated end-to-end execution
- `meta-composition-proof.spec.ts` - Playwright test suite
- `playwright.config.ts` - Playwright configuration

## Expected Results

### Activity Executions

The demonstration creates **7 activity executions**:

1. `generate-greeting` (standalone test)
2. `generate-timestamp` (standalone test)
3. `combine-outputs` (standalone test)
4. `meta-greeting-workflow` (the meta-executor)
5. `generate-greeting` (called by meta-executor) ⭐
6. `generate-timestamp` (called by meta-executor) ⭐
7. `combine-outputs` (called by meta-executor) ⭐

⭐ = Proves nested composition!

### Evidence

1. **Execution Logs**: Shows nested activity invocations
2. **Dashboard**: Displays all 7 executions with timing
3. **Screenshots**: 10+ captures of the complete flow
4. **Metrics**: Tokens, cost, and duration tracked

## How It Works

### Phase 1: Building Blocks

Three simple activities that will be composed:

```typescript
generate-greeting → Generates a greeting message
generate-timestamp → Generates a timestamp
combine-outputs → Combines multiple inputs
```

Each is a **reusable building block**.

### Phase 2: Meta-Level Composition

The meta-executor (`meta-greeting-workflow`) orchestrates the building blocks:

```typescript
// Task 1: Call generate-greeting
activity({
  templateId: "generate-greeting",
  variables: { name: targetName },
  reason: "Sub-task 1"
})

// Task 2: Call generate-timestamp  
activity({
  templateId: "generate-timestamp",
  reason: "Sub-task 2"
})

// Task 3: Call combine-outputs with results
activity({
  templateId: "combine-outputs",
  variables: { 
    greeting: "<from task 1>",
    timestamp: "<from task 2>"
  },
  reason: "Sub-task 3"
})
```

This is **composition, not code duplication**.

### Phase 3: Observable Execution

When the meta-executor runs:

1. MiniBob starts `meta-greeting-workflow`
2. Task 1 invokes `generate-greeting` → New activity execution created
3. Task 2 invokes `generate-timestamp` → New activity execution created
4. Task 3 invokes `combine-outputs` → New activity execution created
5. Task 4 reports success

Result: **3 nested activities visible in logs and dashboard**

## Verification Checklist

After running the demonstration, verify:

- [ ] All 4 templates uploaded successfully
- [ ] Building blocks execute standalone (3 executions)
- [ ] Meta-executor executes without errors
- [ ] Logs show nested activity calls (search for "Activity.*Starting")
- [ ] Dashboard shows 7 total executions
- [ ] Meta-executor details show 4 tasks
- [ ] Screenshots captured successfully
- [ ] No execution errors in logs

## Troubleshooting

### Templates Not Found

```bash
# Verify templates were uploaded
POD=$(kubectl get pods -n activity-system -l app=minibob-cluster -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n activity-system $POD -- ls -la /app/templates/
```

### Dashboard Not Accessible

```bash
# Check pod status
kubectl get pods -n activity-system

# Restart port-forward
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000
```

### Execution Errors

```bash
# Check logs
kubectl logs -n activity-system $POD --tail=100
```

### No Nested Activities Visible

Check that:
1. MiniBob has the `activity` tool registered
2. MCP is configured correctly
3. Activity API is running and accessible
4. Templates use the correct `activity` tool syntax

## Next Steps

Once proven, you can:

1. **Build Real Executors**: CI/CD pipelines, deployment workflows
2. **Create Meta-Meta-Executors**: Composition at multiple levels
3. **Enable Self-Improvement**: Executors that create new templates
4. **Thompson Sampling**: Learn optimal compositions over time
5. **Scale Composition**: Complex workflows from simple building blocks

## References

- **Architecture Doc**: `../docs/META_LEVEL_ACTIVITY_EXECUTION_ENGINE.md`
- **Example CI/CD Engine**: `../examples/meta-cicd-execution-engine.json`
- **MiniBob Implementation**: `../../repos/minibob/src/activity.ts`
- **Trailblazing Architecture**: `../../TRAILBLAZING_ARCHITECTURE_SUMMARY.md`

---

**Status**: Ready to execute  
**Last Updated**: 2026-03-18  
**Maintainer**: Activity System Team
