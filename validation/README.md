# Activity System Validation Environment

This directory contains validation and testing infrastructure to ensure the activity system behaves as documented.

## Structure

```
validation/
├── scenarios/           # Architecture sequence validation scenarios
├── results/            # Test execution results (timestamped)
├── reports/            # Validation reports
├── minibob-sandbox/    # Sandbox for rapid MiniBob testing
│   ├── setup.sh        # Environment setup
│   ├── rapid-test.ts   # Batch test runner
│   └── test-goals.json # 26 test scenarios
└── README.md           # This file
```

## Quick Start

```bash
# Setup environment
cd validation/minibob-sandbox
export METABOB_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
./setup.sh

# Run rapid validation
./auto-validate.sh

# Run specific scenario
bun rapid-test.ts --scenario simple
```

## Documentation

See `minibob-sandbox/README.md` for complete documentation.

## Sequence Validation Apparatus

Automated tests that verify the activity system matches the behavior documented in `docs/architecture/sequences/`.

### Purpose

**Ensure implementation matches specification** by:
1. Extracting testable assertions from sequence documentation
2. Executing scenarios against the live system
3. Validating behavior matches documented expectations
4. Reporting discrepancies

### Test Scenarios

One YAML file per sequence document:
- `01-activity-selection.yaml` - Thompson Sampling, shape matching, tiered fallback
- `02-impulse-resolution.yaml` - 6-step resolver dispatch, relevance filtering
- `03-resolver-processing.yaml` - LLM tool calling, deterministic resolvers
- `04-improvisation-trailblazing.yaml` - Improvisation, ribosome extraction
- `05-hooks-behavior-injection.yaml` - Hook registration and execution

### Running Sequence Validation

```bash
# Run all sequence validation scenarios
bun run validation/run-validation.ts

# Run specific sequence
bun run validation/run-validation.ts --sequence 01-activity-selection

# Generate compliance report
bun run validation/generate-report.ts
```

### Scenario Format

Each scenario validates specific documented behavior:

```yaml
scenarios:
  - name: "Relevance filtering applies thresholds correctly"
    doc_reference: "02-impulse-resolution.md:242-262"
    assertion: "Impulses filtered by relevance_score >= 0.5"

    setup:
      impulses:
        - id: "impulse-a"
          relevance_score: 0.85
        - id: "impulse-b"
          relevance_score: 0.45

    action:
      filter_impulses: ["impulse-a", "impulse-b"]

    expected:
      loaded: ["impulse-a"]
      skipped: ["impulse-b"]
      reason: "relevance_score < threshold"
```

### Validation Philosophy

**Documentation is the specification.** If behavior doesn't match docs:
1. **First**: Fix the implementation
2. **Second**: Update the documentation
3. **Never**: Accept discrepancy silently

## Backend

All tests use the production backend: `https://activity.metabob.com`
