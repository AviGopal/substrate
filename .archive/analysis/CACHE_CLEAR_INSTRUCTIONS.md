# Cache Clear Instructions - MUST DO THIS

## Current Situation

The Bun cache files are **still present** and contain 13-day-old code.

```bash
# Still there:
.189099fde1ff7cbc-00000000.bun-build  (Feb 2)
.189099ff7ddfdedf-00000000.bun-build  (Feb 2)
.189073bf3efffe7f-00000002.bun-build  (Feb 2)
```

## Step-by-Step Instructions

### 1. Stop the Dev Server

In the terminal running `bun run dev ../..`, press **Ctrl+C**

### 2. Clear the Cache Files

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode
rm -f .*.bun-build
```

Verify they're gone:
```bash
ls -la .*.bun-build
# Should show: No such file or directory
```

### 3. Restart Dev Server

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
bun run dev ../..
```

### 4. Verify Fresh Code is Running

After OpenCode starts, run this test:

```bash
# In a separate terminal, check the logs
cd /home/avi/documents/work/exp-repo/metabob-devbob
rm -f activity-debug.log

# Then in OpenCode, run:
activity({
  activityId: "demo-315bfaf1",
  variables: {},
  reason: "Verify fresh code"
})

# Check logs - should now see CHECKPOINT C
cat activity-debug.log | grep "CHECKPOINT"
```

## What You Should See

**Before cache clear** (what we see now):
```
CHECKPOINT A
CHECKPOINT B
[stops here]
```

**After cache clear** (what we need):
```
CHECKPOINT A
CHECKPOINT B
CHECKPOINT C    <-- NEW! Code is fresh
CHECKPOINT D    <-- Shows TaskTool.init() succeeded
```

## Why This Matters

We CANNOT diagnose the actual issue until fresh code runs. The enhanced logging is the only way to see where execution really fails.

---

**Please complete steps 1-3 above, then let me know when the dev server is restarted.**
