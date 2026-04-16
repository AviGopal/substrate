# Terminal Vessel Composition Learning Integration

**Date:** 2026-04-14
**Status:** Active Architecture

## Overview

The terminal vessel participates in **composition learning** - the system learns which combinations of impulses, activities, and resolvers work together effectively, based on deterministic state transitions rather than probabilistic scoring.

## Composition Learning Principles

### 1. Deterministic Activities

Terminal vessel provides **deterministic resolution** of terminal state:

- PTY buffer capture is predictable
- Exit codes are concrete (0 = success, non-zero = failure)
- Command history is sequential
- No probabilistic elements in state capture

Activities that use terminal impulses are deterministic in their inputs:
```json
{
  "input_impulses": [
    {
      "id": "test_terminal",
      "pointer": {
        "type": "terminalState",
        "terminalId": "term-123"
      }
    }
  ]
}
```

### 2. Resolver Universality

Terminal vessel advertises its resolver capabilities via discovery:

**Shapes Resolved:**
- `terminalState` - Full terminal session state
- `terminalCommand` - Individual command execution
- `terminalOutput` - Terminal output buffer

**Discovery Registration:**
```typescript
POST /v2/vessels/register
{
  "vesselId": "terminal-vessel-1",
  "endpoint": "http://terminal-vessel:8080",
  "shapes": ["terminalState", "terminalCommand", "terminalOutput"],
  "metadata": {
    "capabilities": ["pty", "multi-viewer", "checkpoints", "replay"],
    "version": "1.0.0"
  }
}
```

Any vessel can discover terminal vessel and request resolution:
```
Activity needs terminalState
  ↓
Query discovery-vessel: "Who resolves terminalState?"
  ↓
Discovery responds: "terminal-vessel-1 at http://terminal-vessel:8080"
  ↓
Call terminal-vessel: POST /v2/impulses/resolve
  ↓
Terminal vessel returns PTY state
```

### 3. State-Space Driven Selection

Activities select terminal impulses based on **state requirements**, not success probability:

**Example: Debug Activity**
```json
{
  "id": "debug-test-failure",
  "input_impulses": [
    {
      "id": "failed_test_terminal",
      "pointer": {
        "type": "terminalState",
        "terminalId": "{{terminalId}}"
      },
      "metadata": {
        "shape": "terminalState",
        "required_state": {
          "exitCode": {"ne": 0},  // Non-zero exit code
          "running": false         // Process terminated
        }
      }
    }
  ]
}
```

The system learns: "Debug activities need terminals with failed exit codes."

## How Learning Happens

### Composition Recording

When an activity executes using terminal impulses, the backend records:

```typescript
{
  "composition_id": "comp-abc123",
  "activity_id": "debug-test-failure",
  "execution_id": "exec-xyz789",
  "impulses_used": [
    {
      "impulse_id": "terminal-term-123",
      "shape": "terminalState",
      "resolved_by": "terminal-vessel-1",
      "pointer": {
        "terminalId": "term-123"
      }
    }
  ],
  "state_transition": {
    "before": {
      "exitCode": 1,
      "buffer": "✗ Test failed..."
    },
    "after": {
      "filesModified": ["src/fix.ts"],
      "testsFixed": 1
    }
  },
  "outcome": "success",
  "duration_ms": 5430
}
```

### Pattern Recognition

The system detects patterns over time:

**Pattern 1: Successful Debug Compositions**
```
terminalState (exitCode != 0) + debug-test-failure → fix applied → exitCode == 0
```

**Pattern 2: Terminal Selection for Testing**
```
test-runner activity + terminalState (preset: 'shell') → tests executed → results captured
```

**Pattern 3: Checkpoint Before Risky Operations**
```
deployment activity + terminalState + checkpoint → rollback if failed
```

### State-Space Optimization

The system learns which terminal states are most useful for which activities:

**For Debug Activities:**
- Terminals with non-zero exit codes
- Terminals with error patterns in buffer
- Terminals with recent command history

**For Test Activities:**
- Terminals with test runner commands
- Terminals in test directories
- Terminals with clean initial state

**For Deployment Activities:**
- Terminals with checkpoint capability
- Terminals in deployment directories
- Terminals with environment variables set

## Composition Examples

### Example 1: Debug Workflow Composition

**Activity:** `debug-test-failure`

**Composition:**
```json
{
  "impulses": [
    {
      "shape": "terminalState",
      "source": "terminal-vessel",
      "state": {
        "exitCode": 1,
        "buffer": "✗ Test failed: TypeError at src/tool/bash.ts:45",
        "shellHistory": ["bun test"]
      }
    },
    {
      "shape": "file",
      "source": "user-vessel",
      "path": "src/tool/bash.ts"
    }
  ],
  "state_transition": {
    "before": {
      "tests_passing": 42,
      "tests_failing": 1
    },
    "after": {
      "tests_passing": 43,
      "tests_failing": 0,
      "files_modified": ["src/tool/bash.ts"]
    }
  },
  "outcome": "success"
}
```

**Learning:** System learns this composition pattern succeeds for debug workflows.

### Example 2: Interactive Development Composition

**Activity:** `interactive-development-session`

**Composition:**
```json
{
  "impulses": [
    {
      "shape": "terminalState",
      "source": "terminal-vessel",
      "preset": "shell",
      "persistent": true,
      "state": {
        "shellHistory": [
          "cd repos/minibob",
          "bun test",
          "git add .",
          "git commit -m 'fix tests'"
        ]
      }
    }
  ],
  "state_transition": {
    "before": {
      "git_status": "modified: src/tool/bash.ts"
    },
    "after": {
      "git_status": "clean",
      "commits": 1
    }
  },
  "outcome": "success"
}
```

**Learning:** System learns persistent terminals work well for interactive development.

### Example 3: Deployment with Rollback Composition

**Activity:** `deploy-with-safety`

**Composition:**
```json
{
  "impulses": [
    {
      "shape": "terminalState",
      "source": "terminal-vessel",
      "checkpoints": [
        {
          "id": "pre-deploy",
          "timestamp": 1713100000000
        }
      ],
      "state": {
        "shellHistory": [
          "./create-checkpoint.sh",
          "./deploy.sh",
          "# Deployment failed",
          "./rollback.sh"
        ]
      }
    }
  ],
  "state_transition": {
    "before": {
      "deployment_version": "1.0.0"
    },
    "after": {
      "deployment_version": "1.0.0",  // Rolled back
      "rollback_count": 1
    }
  },
  "outcome": "success"  // Rollback prevented bad deployment
}
```

**Learning:** System learns checkpoint capability is valuable for deployment activities.

## Metrics Tracked

### Terminal Usage Metrics

```typescript
{
  "terminal_spawns": 150,
  "terminal_commands_executed": 1234,
  "checkpoints_created": 45,
  "rollbacks_performed": 3,
  "multi_viewer_sessions": 12,
  "persistent_sessions": 23,
  "preset_usage": {
    "shell": 100,
    "claude": 20,
    "minibob": 15,
    "repl": 10,
    "vim": 3,
    "server": 2
  }
}
```

### Composition Metrics

```typescript
{
  "compositions_with_terminal": 87,
  "successful_compositions": 81,
  "failed_compositions": 6,
  "most_used_shapes": [
    "terminalState",
    "file",
    "test_result"
  ],
  "most_successful_patterns": [
    "terminalState + debug-test-failure",
    "terminalState + test-runner",
    "terminalState + deploy-with-safety"
  ]
}
```

### Learning Signals

```typescript
{
  "signal": "terminal_exitCode_correlation",
  "pattern": "exitCode != 0 → debug activities",
  "confidence": 0.92,
  "sample_size": 87
}
```

## Integration with Backend

### Composition Storage

Backend stores compositions in SurrealDB:

```sql
-- Schema
DEFINE TABLE activity_composition SCHEMAFULL;
DEFINE FIELD activity_id ON TABLE activity_composition TYPE string;
DEFINE FIELD execution_id ON TABLE activity_composition TYPE string;
DEFINE FIELD impulses_used ON TABLE activity_composition TYPE array;
DEFINE FIELD state_transition ON TABLE activity_composition TYPE object;
DEFINE FIELD outcome ON TABLE activity_composition TYPE string;
DEFINE FIELD duration_ms ON TABLE activity_composition TYPE number;
DEFINE FIELD created_at ON TABLE activity_composition TYPE datetime DEFAULT time::now();

-- Query for terminal compositions
SELECT * FROM activity_composition
WHERE impulses_used.*.shape CONTAINS 'terminalState'
AND outcome = 'success'
ORDER BY created_at DESC;
```

### Composition Query API

```typescript
// Get successful terminal compositions
GET /v2/activities/compositions?shape=terminalState&outcome=success

// Get compositions for specific activity
GET /v2/activities/compositions?activity_id=debug-test-failure

// Get composition patterns
GET /v2/activities/composition-patterns?min_confidence=0.8
```

## Deterministic vs. Probabilistic

### NOT Thompson Sampling

The terminal vessel does **NOT** use Thompson Sampling or probabilistic activity selection:

❌ **Old Pattern (Thompson Sampling):**
```typescript
// DEPRECATED - DO NOT USE
const score = thompsonSampling(activity_id);
if (score > threshold) {
  recommend(activity_id);
}
```

✅ **New Pattern (State-Space Driven):**
```typescript
// Current approach - deterministic selection
const requiredState = activity.input_impulses[0].metadata.required_state;
const matchingTerminals = terminals.filter(t =>
  t.state.exitCode === requiredState.exitCode &&
  t.state.running === requiredState.running
);
return matchingTerminals[0]; // Deterministic selection
```

### Learning Without Scoring

Composition learning works by **recording patterns**, not scoring activities:

**What Gets Recorded:**
- Which impulses were used together
- What state transitions occurred
- What the outcome was (success/failure)
- How long it took

**What Doesn't Happen:**
- No α/β counters
- No probabilistic sampling
- No success rate calculations
- No activity ranking

**How Learning Happens:**
- System detects frequent successful patterns
- Patterns become reusable compositions
- Activities reference compositions by pattern ID
- Future executions use known-good patterns

## Future Enhancements

### 1. Pattern Templates

Extract successful compositions into reusable templates:

```json
{
  "pattern_id": "debug-failed-test-pattern",
  "impulses": [
    {
      "shape": "terminalState",
      "required_state": {
        "exitCode": {"ne": 0}
      }
    },
    {
      "shape": "file",
      "required_state": {
        "extension": "ts"
      }
    }
  ],
  "success_rate": 0.93,
  "usage_count": 87
}
```

### 2. Composition Recommendations

Suggest compositions based on activity requirements:

```typescript
// Activity wants to debug
GET /v2/activities/recommend-composition?activity_id=debug-test-failure

// Returns:
{
  "recommended_composition": {
    "impulses": [
      {
        "shape": "terminalState",
        "resolver": "terminal-vessel",
        "required_state": {...}
      }
    ],
    "confidence": 0.92,
    "based_on": "87 successful executions"
  }
}
```

### 3. Composition Validation

Validate compositions before execution:

```typescript
// Check if composition is likely to succeed
POST /v2/activities/validate-composition
{
  "activity_id": "debug-test-failure",
  "impulses": [...]
}

// Returns:
{
  "valid": true,
  "similar_compositions": 87,
  "success_rate": 0.93,
  "warnings": []
}
```

## Summary

Terminal vessel participates in composition learning by:

1. **Providing deterministic state capture** - PTY state is concrete and measurable
2. **Advertising resolver capabilities** - Discovery-based shape resolution
3. **Recording compositions** - Backend tracks which impulses work together
4. **Enabling pattern detection** - System learns successful compositions over time

**Key Difference from Thompson Sampling:**
- No probabilistic activity selection
- No α/β counters
- No success rate scoring
- Learning happens through composition pattern recognition, not activity ranking

This aligns with the composition learning architecture where:
- Activities are deterministic
- Resolvers are universal
- Selection is state-space driven
- Learning happens through pattern detection
