# Meta-Level Activity Composition: Quick Start Guide

## TL;DR

```bash
# 1. Go to demo directory
cd /home/avi/documents/work/exp-repo/metabob-devbob/demos/meta-composition

# 2. Run the demonstration
./run-demonstration.sh

# 3. View results in dashboard
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000 &
open http://localhost:3000

# 4. (Optional) Capture screenshots with Playwright
npm install && npx playwright install && npx playwright test
```

**Duration**: ~5 minutes  
**Result**: Proof that activities can compose other activities!

---

## What You'll See

### In Terminal

```
🚀 META-LEVEL ACTIVITY COMPOSITION DEMONSTRATION
================================================

Phase 1: Uploading activity templates...
  ✓ generate-greeting.json
  ✓ generate-timestamp.json
  ✓ combine-outputs.json
  ✓ meta-greeting-workflow.json

Phase 2: Testing building block activities...
  ✓ generate-greeting completed
  ✓ generate-timestamp completed
  ✓ combine-outputs completed

Phase 3: EXECUTING META-LEVEL COMPOSITOR
  Starting meta-greeting-workflow...
  ✓ Meta-executor completed!

✅ EVIDENCE FOUND: Nested activity executions detected!

SUCCESS: Meta-level activity composition is proven!
```

### In Dashboard (http://localhost:3000)

You'll see **7 activity executions**:

```
Recent Activities:
1. meta-greeting-workflow     [4 tasks] [Completed] ← THE PROOF
2. combine-outputs             [1 task]  [Completed] (nested)
3. generate-timestamp          [1 task]  [Completed] (nested)
4. generate-greeting           [1 task]  [Completed] (nested)
5. combine-outputs             [1 task]  [Completed] (standalone)
6. generate-timestamp          [1 task]  [Completed] (standalone)
7. generate-greeting           [1 task]  [Completed] (standalone)
```

Click on `meta-greeting-workflow` to see:
- 4 tasks executed in sequence
- Each task invoked a sub-activity
- Complete execution trace with timestamps

### In Logs

```bash
kubectl logs -n activity-system <minibob-pod> --tail=100
```

Look for:
```
[Activity] Starting: Meta-Level Greeting Workflow
[Task] execute-greeting
[Activity] Starting: Generate Greeting        ← Nested!
[Activity] Completed: Generate Greeting
[Task] execute-timestamp
[Activity] Starting: Generate Timestamp       ← Nested!
[Activity] Completed: Generate Timestamp
[Task] execute-combine
[Activity] Starting: Combine Outputs          ← Nested!
[Activity] Completed: Combine Outputs
✅ META-LEVEL COMPOSITION PROVEN!
```

---

## Using Playwright MCP for Visual Proof

The Playwright MCP tools let you automate browser interaction to capture visual evidence:

### Step 1: Install & Setup

```bash
cd demos/meta-composition
npm install
npx playwright install chromium
```

### Step 2: Start Dashboard Port-Forward

```bash
# In a separate terminal
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000
```

### Step 3: Run Playwright Tests

```bash
npx playwright test
```

This will:
1. Open the dashboard in a browser (headless by default)
2. Navigate through the UI
3. Capture 11 screenshots showing the entire flow
4. Verify expected elements exist
5. Generate an HTML report

### Step 4: View Results

```bash
# View screenshots
ls screenshots/

# Open HTML report
npx playwright show-report
```

### Screenshots Captured

```
screenshots/
├── 00-environment-check.png          Initial state
├── 01-initial-state.png              Dashboard before execution
├── 02-building-blocks-executed.png   After standalone tests
├── 03-meta-executor-appeared.png     Meta-executor visible
├── 04-activity-list.png              All 7 executions
├── 05-meta-executor-details.png      Task breakdown
├── 06-task-breakdown.png             Individual tasks
├── 07-activity-history.png           Historical view
├── 08-execution-count.png            Count verification
├── 09-nested-execution-evidence.png  Proof of nesting
└── 10-final-evidence.png             Final state
```

---

## Playwright MCP Tools Used

The demonstration uses these Playwright tools:

### Navigation
```typescript
playwright_playwright_navigate({
  url: "http://localhost:3000",
  browserType: "chromium",
  headless: true
})
```

### Screenshots
```typescript
playwright_playwright_screenshot({
  name: "meta-executor-proof",
  fullPage: true,
  savePng: true,
  downloadsDir: "./screenshots"
})
```

### Element Interaction
```typescript
playwright_playwright_click({
  selector: "text=meta-greeting-workflow"
})
```

### Content Verification
```typescript
playwright_playwright_get_visible_text()
```

---

## Verification Checklist

After running the demonstration, verify these items:

- [ ] **7 activity executions** visible in dashboard
- [ ] **Meta-executor shows 4 tasks** when clicked
- [ ] **Logs contain "Activity Starting"** for nested activities
- [ ] **Screenshots captured** in `screenshots/` directory
- [ ] **No errors** in execution logs
- [ ] **Playwright report** shows all tests passed

If all checkboxes are ✓, meta-level composition is **proven**!

---

## Troubleshooting

### Dashboard shows fewer than 7 activities

**Cause**: Executions may still be processing  
**Solution**: Wait 30 seconds and refresh dashboard

### Playwright tests fail

**Cause**: Port-forward not active or dashboard not accessible  
**Solution**:
```bash
# Check port-forward
ps aux | grep port-forward

# Restart if needed
kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000 &

# Verify dashboard accessible
curl http://localhost:3000
```

### No nested activities in logs

**Cause**: Meta-executor may not have `activity` tool available  
**Solution**: Check MiniBob MCP configuration has activity tools registered

---

## What This Proves

✅ **Activities can call activities**: Meta-executor invokes 3 sub-activities  
✅ **Composition is observable**: Dashboard shows nested executions  
✅ **Pattern is scalable**: Can create meta-meta-executors recursively  
✅ **Production-ready**: Works in deployed Kubernetes environment  

---

## Next: Build Real Execution Engines

Now that composition is proven, you can build:

1. **CI/CD Pipeline Engine**: Compose build → test → deploy activities
2. **Deployment Workflow**: Compose validation → deployment → health check
3. **Testing Engine**: Compose unit → integration → e2e test activities
4. **Self-Improving System**: Meta-executor that creates new templates

Example:
```json
{
  "id": "cicd-engine",
  "tasks": [
    {
      "id": "build",
      "prompt": {
        "template": "activity({ templateId: 'docker-build', ... })"
      }
    },
    {
      "id": "test",
      "dependencies": ["build"],
      "prompt": {
        "template": "activity({ templateId: 'run-tests', ... })"
      }
    },
    {
      "id": "deploy",
      "dependencies": ["test"],
      "prompt": {
        "template": "activity({ templateId: 'k8s-deploy', ... })"
      }
    }
  ]
}
```

---

## Summary

**Time to execute**: 5 minutes  
**Evidence generated**: Logs + Screenshots + Dashboard data  
**What's proven**: Meta-level activity composition works!  

**Run it now**:
```bash
cd demos/meta-composition && ./run-demonstration.sh
```
