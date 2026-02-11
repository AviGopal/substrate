# Activity Evolution System - Test Plan

**Objective**: Verify we can run activities and evolve/mutate them to create improved variants

## The Evolution Loop

```
1. Run Activity → 2. Capture Metrics → 3. Analyze Performance → 4. Evolve/Mutate → 5. New Variant
     ↑                                                                                    │
     └────────────────────────────────────────────────────────────────────────────────────┘
```

## What We Need to Test

### 1. Activity Execution
- Run an activity (any bootstrap activity)
- Capture outcome metrics
- Record success/failure

### 2. Outcome Recording
- Metrics stored in database
- Performance data captured
- Learning feedback recorded

### 3. Evolution Trigger
- Boredom system detects evolution opportunity
- Manual evolution via CLI
- Automatic variant creation

### 4. Variant Creation
- New variant generated with mutations
- Registered in database
- Available for A/B testing

## Test Strategy

Start with a simple, known-working activity and verify the full loop.
