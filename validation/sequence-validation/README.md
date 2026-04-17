# Sequence Validation Test Suite

This directory contains comprehensive tests that validate the MiniBob activity system works exactly as described in the sequence diagrams.

## Purpose

Verify implementation matches the documented workflows in `/docs/architecture/sequences/`:
1. **Activity Selection** - Thompson Sampling, tiered fallback, composition-based orchestration
2. **Impulse Resolution** - 6-step resolver dispatch, budget enforcement, dual-mode formatting
3. **Resolver Processing** - LLM tool calling, deterministic resolvers, activity composition, ribosome extraction
4. **Improvisation & Trailblazing** - improvise_solution activity, template extraction, checkpoint/rollback
5. **Hooks & Behavior Injection** - Lifecycle hooks, vessel hooks, condition evaluation

## Directory Structure

```
sequence-validation/
├── README.md                   # This file
├── run-tests.ts                # Main test runner
├── tests/
│   ├── 01-activity-selection.test.ts
│   ├── 02-impulse-resolution.test.ts
│   ├── 03-resolver-processing.test.ts
│   ├── 04-improvisation.test.ts
│   ├── 05-hooks.test.ts
│   └── utils/                  # Test utilities
│       ├── trace-analyzer.ts   # Analyze execution traces
│       ├── assertions.ts       # Custom assertions
│       └── fixtures.ts         # Test data generators
├── fixtures/
│   ├── goals/                  # Test goals
│   ├── templates/              # Test activity templates
│   ├── impulses/               # Test impulses
│   └── expected-traces/        # Expected trace patterns
└── reports/
    ├── coverage/               # Sequence coverage report
    ├── alignment/              # Docs ↔ implementation alignment
    └── traces/                 # Captured execution traces
```

## Quick Start

```bash
# Run all sequence validation tests
cd validation/sequence-validation
bun run-tests.ts

# Run specific sequence tests
bun run-tests.ts --sequence 01-activity-selection
bun run-tests.ts --sequence 02-impulse-resolution

# Generate alignment report
bun run-tests.ts --report alignment

# Verbose mode (show trace details)
bun run-tests.ts --verbose
```

## Test Categories

### 1. Activity Selection Tests (`01-activity-selection.test.ts`)

**Validates:**
- Meta-activity loading (`goal_processing_unified.json`)
- Thompson Sampling recommendation flow
- Tiered fallback (exact → compatible → full-text)
- Heuristic boost calculation (8 components)
- Shape-conditioned scoring
- Composition edge recording

**Test Scenarios:**
- Goal with exact shape match → Tier 1 success
- Goal with no exact match → Tier 2 compatible
- Novel goal with no templates → Tier 3 full-text search
- Empty recommendations → improvise_solution selected
- Thompson Sampling scoring accuracy

### 2. Impulse Resolution Tests (`02-impulse-resolution.test.ts`)

**Validates:**
- Relevance-based filtering (3 decision rules)
- 6-step resolver dispatch chain (local → custom → discovery → MCP → fallback)
- Budget enforcement and truncation
- Dual-mode formatting (pointer-mode vs content-mode)
- State transition tracking (before/after hashing)
- Discovery integration with caching

**Test Scenarios:**
- High relevance impulse (>0.8) → always loaded
- Low relevance impulse (<threshold) → skipped
- Content over budget → truncated with metadata
- Pointer resolution via local resolver
- Pointer resolution via discovery
- Metadata-first formatting

### 3. Resolver Processing Tests (`03-resolver-processing.test.ts`)

**Validates:**
- LLM resolver tool calling loop (max 20 iterations)
- Bash resolver command validation & execution
- Git resolver operations
- Activity resolver (nested execution)
- Ribosome resolver (template extraction)
- Output impulse creation from tool results
- Tool argument pattern learning

**Test Scenarios:**
- LLM task with tool calling → output impulses created
- Bash command execution → stdout/stderr captured
- Git operations → state transitions recorded
- Activity composition → composition edges recorded
- Successful execution → ribosome extraction check
- Tool argument extraction → pattern storage

### 4. Improvisation & Trailblazing Tests (`04-improvisation.test.ts`)

**Validates:**
- `improvise_solution` activity execution
- Task sequence (plan → execute → extract)
- Ribosome extraction criteria (5 checks)
- Template generalization (variables, validation rules)
- Checkpoint creation (git state capture)
- Rollback execution (git restore)
- Variant creation on failure (trailblazing)

**Test Scenarios:**
- Novel goal → improvise_solution selected
- Improvisation succeeds → template extracted
- Extraction criteria not met → skip extraction
- Activity failure → variant created
- Checkpoint exists → rollback succeeds
- Variant registration → Thompson Sampling initialized

### 5. Hooks & Behavior Injection Tests (`05-hooks.test.ts`)

**Validates:**
- Lifecycle hook registration and execution
- Vessel hook priority ordering
- Condition evaluation (required shapes, absent shapes, predicates)
- Hook chain execution (multiple hooks per trigger)
- Caching with TTL
- Non-blocking execution (hook failures don't stop activity)
- Promotion hook decision logic

**Test Scenarios:**
- Hook registered → executed at trigger point
- Multiple hooks → executed in priority order
- Condition not met → hook skipped
- Hook cached → cached result returned
- Hook fails → execution continues (non-blocking)
- Promotion criteria met → template promoted

## Test Utilities

### TraceAnalyzer

```typescript
import { TraceAnalyzer } from './tests/utils/trace-analyzer';

const analyzer = new TraceAnalyzer(executionTrace);

// Verify Thompson Sampling flow
analyzer.assertRecommendationFlow({
  tiersChecked: ['exact', 'compatible'],
  boostsApplied: ['tag_match', 'shape_compatibility'],
  selectedTemplate: 'goal_processing_unified'
});

// Verify impulse resolution
analyzer.assertImpulseResolution({
  filtered: ['impulse-1', 'impulse-2'],
  loaded: ['impulse-1'],
  skipped: ['impulse-2'],
  budget: { originalTokens: 5000, truncatedTo: 2000 }
});

// Verify composition edges
analyzer.assertCompositionEdges([
  { parent: 'goal_processing_unified', child: 'analyze_goal' },
  { parent: 'goal_processing_unified', child: 'activity_recommendation' }
]);
```

### Custom Assertions

```typescript
import { assertSequenceFlow } from './tests/utils/assertions';

// Verify sequence matches documented flow
assertSequenceFlow(trace, {
  sequence: 'activity-selection',
  expectedPhases: [
    'meta-activity-loading',
    'goal-analysis',
    'activity-recommendation',
    'thompson-sampling',
    'execute-primary',
    'goal-verification'
  ],
  allowedOptional: ['improvise-fallback']
});
```

## Alignment Report

The test suite generates an alignment report showing:

```
Sequence Validation Report
==========================

01-activity-selection.md
  ✓ Meta-activity composition flow (6/6 phases validated)
  ✓ Thompson Sampling with heuristic boosts (8/8 components)
  ✓ Tiered fallback query strategy (3/3 tiers)
  ✓ Shape-conditioned scoring
  ✗ Composition edge weights (not implemented)

02-impulse-resolution.md
  ✓ Relevance filtering (3/3 decision rules)
  ✓ 6-step resolver dispatch chain
  ✓ Budget enforcement with truncation
  ✓ Dual-mode formatting (pointer + content)
  ✓ State transition tracking
  ✓ Discovery integration with caching

03-resolver-processing.md
  ✓ LLM resolver tool calling loop
  ✓ Deterministic resolvers (bash, git, file)
  ✓ Activity resolver (composition)
  ✓ Ribosome resolver (template extraction)
  ✓ Output impulse creation
  ✓ Tool argument pattern learning

04-improvisation-trailblazing.md
  ✓ improvise_solution activity
  ✓ Ribosome extraction criteria
  ✓ Template generalization
  ✗ Checkpoint/rollback (not tested)
  ✓ Variant creation (trailblazing)

05-hooks-behavior-injection.md
  ✓ Lifecycle hooks (before/after prompt)
  ✓ Vessel hooks (state-based injection)
  ✓ Condition evaluation
  ✓ Hook chain execution
  ✓ Caching with TTL
  ✓ Non-blocking execution

Overall Coverage: 95% (38/40 documented behaviors validated)
```

## Integration with MiniBob Sandbox

The sequence validation tests complement the existing sandbox tests:

**Sandbox Tests** (validation/minibob-sandbox/):
- Functional tests (26 test goals)
- Backend integration tests
- End-to-end workflow validation

**Sequence Tests** (validation/sequence-validation/):
- Implementation ↔ documentation alignment
- Workflow phase validation
- Component interaction verification

Both test suites use `https://activity.metabob.com` (production backend) for trace submission and learning validation.

## Contributing

When adding new features or modifying workflows:

1. **Update sequence diagrams first** (`/docs/architecture/sequences/`)
2. **Add test cases** to corresponding sequence test file
3. **Run validation** to ensure alignment
4. **Update this README** if adding new test categories

## Running Tests in CI/CD

```yaml
# .github/workflows/validate-sequences.yml
- name: Run sequence validation
  run: |
    cd validation/sequence-validation
    bun install
    bun run-tests.ts --report alignment
    bun run-tests.ts --report coverage
```

## References

- [Sequence Diagrams](/docs/architecture/sequences/README.md)
- [Foundation Document](/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
- [MiniBob Sandbox](../minibob-sandbox/README.md)
- [Validation Workflow](../minibob-sandbox/VALIDATION_WORKFLOW.md)
