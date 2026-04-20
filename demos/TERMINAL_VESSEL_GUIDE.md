# Terminal Vessel Demonstration Guide

Complete guide for running visual terminal demonstrations showing vessel capabilities, and more importantly, showing how **demonstrations themselves are activities**.

## Quick Start

```bash
# Run deduplication demo directly
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run demos/deduplication-vessel-demo.ts

# Run vessel self-improvement demo directly
bun run demos/terminal-vessel-demo.ts

# Run demo as activity (interactive)
./demos/show-activity-execution.sh
```

## What We Built

### 1. Visual Terminal Demonstrations

**Deduplication Demo** (`deduplication-vessel-demo.ts`):
- Shows impulse sync queue preventing 409 errors
- 6 phases with color-coded visual feedback
- Real-time metrics and impact analysis
- Result: 50% backend load reduction, zero 409 errors

**Self-Improvement Demo** (`terminal-vessel-demo.ts`):
- Shows MiniBob analyzing its own 63 activity templates
- Resolver distribution analysis (28% deterministic, 72% LLM)
- Optimization opportunities (+42% improvement potential)
- Target: 70% deterministic for cost/speed gains

### 2. Activity Template Integration

**Activity Template** (`repos/minibob/activities/demo/terminal-vessel-demo.json`):
```json
{
  "id": "demo:terminal-vessel",
  "name": "Terminal Vessel Demonstration",
  "tasks": [
    {
      "id": "run-deduplication-demo",
      "resolver": "bash",
      "config": {
        "command": "bun run demos/deduplication-vessel-demo.ts"
      }
    }
  ]
}
```

### 3. Interactive Demonstrator

**Script** (`show-activity-execution.sh`):
- Shows activity template definition
- Executes demo through activity system
- Explains "activities all the way down"
- Compares traditional vs activity-based execution

## The Key Concept: Activities All The Way Down

### What This Means

Demonstrations are NOT special - they're just activities:

```
Traditional Thinking:
  Work → activities
  Demos → separate scripts
  Meta → special case

Vessel Reality:
  Work → activity
  Demos → activity
  Meta → activity
  EVERYTHING → activity
```

### Why This Matters

**1. Observable**
- Every demo execution is traced
- Metrics captured (duration, cost, success)
- Output becomes impulses
- Learning loop updated

**2. Composable**
- Demos can call other activities
- Activities can include demos
- No distinction between "real" and "meta"

**3. Learnable**
- Thompson Sampling learns which demos work
- System recommends demos when appropriate
- Demos improve through variant creation

**4. Integrated**
- Demos flow through same execution path
- Use same resolvers (bash, LLM, etc.)
- Create same impulses
- Subject to same learning

## Three Execution Paths

### Path 1: Direct Execution
```bash
bun run demos/deduplication-vessel-demo.ts
```

**What happens:**
- TypeScript file runs directly
- Outputs to terminal
- NOT captured as activity
- NOT traced to backend
- NOT part of learning loop

**Use when:** Quick manual testing

### Path 2: Activity Execution
```bash
./demos/show-activity-execution.sh
```

**What happens:**
- Activity template loaded
- Bash resolver executes TypeScript
- Output captured as impulses
- Execution traced (when backend available)
- Part of vessel learning loop

**Use when:** Demonstrating vessel integration

### Path 3: Goal-Based Execution
```bash
cd repos/minibob
bun run index.ts --single "run the deduplication demonstration"
```

**What happens:**
- Goal analyzed for shapes
- Thompson Sampling recommends activity
- Demo executed through vessel
- Fully integrated experience

**Use when:** Natural language interface

## Demonstration Flow Example

```
┌─────────────────────────────────────────────────────┐
│ User: ./demos/show-activity-execution.sh           │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Load: terminal-vessel-demo.json                    │
│   {                                                 │
│     "id": "demo:terminal-vessel",                  │
│     "tasks": [{                                     │
│       "resolver": "bash",                          │
│       "command": "bun run deduplication-demo.ts"  │
│     }]                                             │
│   }                                                 │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Execute Task: run-deduplication-demo               │
│   Resolver: bash                                    │
│   Command: bun run demos/deduplication-vessel-demo.ts │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Visual Output:                                      │
│   Phase 1: Creating Impulses                       │
│   Phase 2: Initial Enqueue (3 green ADDED)        │
│   Phase 3: Background Sync (3 synced)             │
│   Phase 4: Duplicate Attempts (4 red REJECTED)    │
│   Phase 5: New Impulse (1 green ADDED)            │
│   Phase 6: Impact Analysis (50% reduction)        │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Capture Output as Impulse (in full integration)   │
│   id: demo-output-1776570464078                    │
│   type: bash_output                                 │
│   shape: demo_result                               │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Trace to Backend (when available)                  │
│   Template: demo:terminal-vessel                   │
│   Status: completed                                 │
│   Duration: 35000ms                                 │
│   Cost: $0.00 (deterministic)                      │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Thompson Update                                     │
│   α++ (success)                                     │
│   Next recommendation more likely                   │
└─────────────────────────────────────────────────────┘
```

## Connection to Vessel Self-Improvement

The deduplication demo uses data from vessel self-analysis:
- "MiniBob analyzed 63 activity templates"
- "Deterministic ratio: 28%"
- "Optimization potential: +42%"
- "Target: 70% deterministic"

This shows how:
1. Vessel analyzes itself → creates impulses
2. Deduplication protects impulses from 409 errors
3. Demos show the protection working
4. Demos ARE activities showing activities
5. Meta-circularity: vessel demonstrates itself through itself

## Files Created

| File | Purpose |
|------|---------|
| `deduplication-vessel-demo.ts` | Visual demo of impulse deduplication |
| `terminal-vessel-demo.ts` | Visual demo of vessel self-improvement |
| `activities/demo/terminal-vessel-demo.json` | Activity template for demos |
| `show-activity-execution.sh` | Interactive activity demonstrator |
| `RUNNING_DEMOS_AS_ACTIVITIES.md` | Detailed execution guide |
| `DEDUPLICATION_DEMO.md` | Deduplication specifics |
| `TERMINAL_VESSEL_GUIDE.md` | This file |

## Test Results

**Deduplication Implementation:**
- ✅ syncedImpulses Set added (line 52)
- ✅ Deduplication checks in enqueue() (lines 64-76)
- ✅ syncedImpulses.add() after sync (line 185)
- ✅ All test scenarios passed

**Visual Demonstrations:**
- ✅ Color-coded acceptance/rejection
- ✅ Real-time queue state metrics
- ✅ Animated progress indicators
- ✅ Impact analysis display
- ✅ Connection to vessel philosophy

**Activity Integration:**
- ✅ Activity template created
- ✅ Bash resolver execution
- ✅ Interactive demonstrator
- ✅ Documentation complete

## Next Steps

### Try It Yourself

1. **Run direct execution:**
   ```bash
   bun run demos/deduplication-vessel-demo.ts
   ```

2. **Run as activity:**
   ```bash
   ./demos/show-activity-execution.sh
   ```

3. **Examine activity template:**
   ```bash
   cat repos/minibob/activities/demo/terminal-vessel-demo.json
   ```

### Create Your Own Demo Activity

1. Create TypeScript demo with visual output
2. Create activity template in `activities/demo/`
3. Define bash resolver task
4. Run through activity system
5. Observe it being traced and learned from

### Extend the Concept

- Add more phases to existing demos
- Create demos for other vessel capabilities
- Compose multiple demos into meta-demo
- Use LLM resolver for adaptive demonstrations
- Build demo recommendation system

## Key Takeaways

✓ **Demonstrations ARE activities** - no special status or treatment

✓ **Meta-circularity** - vessel demonstrates itself through itself

✓ **Observable operations** - see exactly what the vessel is doing

✓ **Visual feedback** - colors, animations, real-time metrics

✓ **Traceable and learnable** - executions feed the learning loop

✓ **"Activities all the way down"** - philosophy embodied in practice

✓ **Integrated ecosystem** - demos flow through same path as work

---

**Created**: 2026-04-18
**Purpose**: Show vessel capabilities through visual terminal output and demonstrate "activities all the way down"
**Status**: Complete and ready to execute
