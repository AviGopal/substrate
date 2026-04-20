# Running Terminal Vessel Demos as Activities

This demonstrates "activities all the way down" - even demonstrations about the system are executed as activities through the vessel.

## The Activity Template

**File**: `repos/minibob/activities/demo/terminal-vessel-demo.json`

This activity template defines how to run the terminal demonstrations:

```json
{
  "id": "demo:terminal-vessel",
  "name": "Terminal Vessel Demonstration",
  "description": "Run visual terminal demonstrations showing vessel capabilities",
  "tasks": [
    {
      "id": "run-deduplication-demo",
      "resolver": "bash",
      "command": "bun run demos/deduplication-vessel-demo.ts"
    },
    {
      "id": "run-self-improvement-demo",
      "resolver": "bash",
      "command": "bun run demos/terminal-vessel-demo.ts"
    }
  ]
}
```

## Three Ways to Execute

### 1. Direct Execution (Traditional)

```bash
# Run TypeScript file directly
bun run demos/deduplication-vessel-demo.ts
```

**What happens:**
- TypeScript file executes
- Outputs to terminal
- NOT captured as activity
- NOT traceable
- NOT part of vessel ecosystem

### 2. Via Activity Template (Vessel-Native)

```bash
# Execute through activity system
cd repos/minibob/activities/demo
bun run ../../index.ts --template terminal-vessel-demo.json --var demo_type=deduplication
```

**What happens:**
- Activity template loaded
- Bash resolver executes TypeScript
- Output captured as impulses
- Execution traced
- Part of vessel learning loop

### 3. Via Goal (Natural Language)

```bash
# Describe what you want
cd repos/minibob
bun run index.ts --single "run the deduplication terminal demonstration"
```

**What happens:**
- Goal analyzed
- Activity recommended (Thompson Sampling)
- Template executed
- Fully integrated with vessel

## Why This Matters

### "Activities All The Way Down"

The demonstration itself is an activity:
- **Demo about deduplication** → runs as activity
- **Demo about self-improvement** → runs as activity
- **Demo about activities** → runs as activity (meta!)

### Observable and Traceable

When run as activities:
- ✓ Execution duration measured
- ✓ Cost tracked ($0.00 for bash resolver)
- ✓ Output captured as impulses
- ✓ Trace stored for learning
- ✓ Success/failure recorded

### Composable

Activities can call activities:
```json
{
  "id": "demo:all-vessel-capabilities",
  "tasks": [
    { "activity": "demo:terminal-vessel", "var": "demo_type=deduplication" },
    { "activity": "demo:terminal-vessel", "var": "demo_type=self-improvement" },
    { "activity": "demo:create-summary" }
  ]
}
```

## Manual Execution Example

If you want to run the deduplication demo as an activity right now:

```bash
# Method 1: Direct bash execution (simple, but not integrated)
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run demos/deduplication-vessel-demo.ts

# Method 2: Run the activity template tasks manually
cd repos/minibob/activities/demo
cat terminal-vessel-demo.json | jq -r '.tasks[0].config.command'
# Copy the command and run it

# Method 3: Invoke through vessel (when backend available)
cd repos/minibob
bun run index.ts --single "execute the terminal vessel demonstration activity"
```

## The Key Insight

**Everything is an activity, including activities about activities.**

This isn't just a philosophy - it's the actual implementation:
- System improvement → activity
- Demonstration → activity
- Testing → activity
- Deployment → activity
- Documentation generation → activity

The vessel doesn't distinguish between "meta" operations and "real" work. It's all just state transitions constrained by activity templates, observable through impulses, and improvable through learning.

## Next Steps

Try creating your own demonstration activity:

1. Create `activities/demo/my-demo.json`
2. Define tasks that show something interesting
3. Execute via activity system
4. Observe it being traced and learned from

The system will learn which demonstrations are valuable (based on success rate, user feedback) and recommend them appropriately.
