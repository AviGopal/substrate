# Validation Directory Index

This directory contains comprehensive testing and validation infrastructure for MiniBob.

## Directory Structure

```
validation/
├── INDEX.md                        # This file
├── README.md                       # Main validation overview
│
├── sequence-validation/            # ⭐ NEW: Sequence diagram validation
│   ├── README.md                   # Comprehensive documentation
│   ├── QUICK_START.md              # Quick reference guide
│   ├── run-tests.ts                # Main test runner
│   ├── package.json                # Dependencies
│   ├── tests/                      # Test files (5 sequences)
│   │   ├── 01-activity-selection.test.ts
│   │   ├── 02-impulse-resolution.test.ts
│   │   ├── 03-resolver-processing.test.ts
│   │   ├── 04-improvisation.test.ts
│   │   ├── 05-hooks.test.ts
│   │   └── utils/
│   │       ├── trace-analyzer.ts   # Trace validation utilities
│   │       ├── assertions.ts       # Custom assertions (TODO)
│   │       └── fixtures.ts         # Test data generators (TODO)
│   ├── fixtures/                   # Test data
│   │   ├── goals/
│   │   ├── templates/
│   │   ├── impulses/
│   │   └── expected-traces/
│   └── reports/                    # Generated reports
│       ├── alignment/
│       ├── coverage/
│       └── traces/
│
└── minibob-sandbox/                # Original sandbox tests
    ├── README.md                   # Sandbox documentation
    ├── QUICK_START.md              # Quick reference
    ├── TEST_GOALS_DELIVERABLES.md  # 26 test goals
    ├── test-goals.json             # Functional test scenarios
    ├── run-validation.ts           # Sandbox test runner
    ├── backend-integration.test.ts # Backend integration tests
    └── ...                         # Other sandbox files
```

## Two Complementary Test Suites

### 1. Sequence Validation (`sequence-validation/`)

**Purpose:** Validate implementation matches documented workflows

**What it tests:**
- Activity selection flow (Thompson Sampling, tiered fallback, composition)
- Impulse resolution (filtering, dispatch chain, budget enforcement)
- Resolver processing (LLM, bash, git, activity, ribosome)
- Improvisation & trailblazing (template extraction, checkpoints)
- Hooks & behavior injection (lifecycle, vessel, promotion)

**How it works:**
- Mock execution traces with expected metadata
- Validate trace structure matches sequence diagrams
- Assert documented behaviors are present

**Run tests:**
```bash
cd sequence-validation
bun test
```

**Use case:** Verify architecture alignment during refactoring

---

### 2. MiniBob Sandbox (`minibob-sandbox/`)

**Purpose:** End-to-end functional validation with real goals

**What it tests:**
- 26 comprehensive test goals across 9 categories
- Backend integration (Thompson Sampling, trace submission)
- Real activity execution with production backend
- Learning loop validation (composition, ribosome)

**How it works:**
- Execute real goals through MiniBob
- Capture execution traces
- Analyze backend integration
- Generate performance metrics

**Run tests:**
```bash
cd minibob-sandbox
./auto-validate.sh
```

**Use case:** Validate end-to-end functionality before deployment

---

## When to Use Each

| Scenario | Use Sequence Validation | Use Sandbox Tests |
|----------|------------------------|-------------------|
| Architecture refactoring | ✅ Yes | Maybe |
| Adding new resolvers | ✅ Yes | ✅ Yes |
| Changing meta-activities | ✅ Yes | ✅ Yes |
| Backend integration changes | Maybe | ✅ Yes |
| Pre-deployment validation | ✅ Yes | ✅ Yes |
| Verifying docs accuracy | ✅ Yes | No |
| Performance testing | No | ✅ Yes |

## Quick Start

### Run All Validation

```bash
# From validation/ directory

# 1. Sequence validation (fast, ~1 second)
cd sequence-validation
bun test

# 2. Sandbox validation (slower, ~5-10 minutes)
cd ../minibob-sandbox
./auto-validate.sh
```

### Run Specific Tests

```bash
# Sequence validation: Single sequence
cd sequence-validation
bun test --sequence 01-activity-selection --verbose

# Sandbox: Single goal category
cd minibob-sandbox
bun run-validation.ts --category "Code Quality"
```

### Generate Reports

```bash
# Sequence alignment report
cd sequence-validation
bun report:alignment
cat reports/alignment/alignment-report.md

# Sandbox trace analysis
cd minibob-sandbox
bun analyze-traces.ts
```

## Integration with CI/CD

Both test suites are designed for CI/CD integration:

```yaml
# .github/workflows/validate.yml
name: Validation

on: [push, pull_request]

jobs:
  sequence-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - name: Run sequence tests
        working-directory: validation/sequence-validation
        run: |
          bun install
          bun test
          bun report:all

  sandbox-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - name: Run sandbox tests
        working-directory: validation/minibob-sandbox
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          METABOB_API_KEY: ${{ secrets.METABOB_API_KEY }}
        run: ./auto-validate.sh
```

## References

### Documentation
- [Sequence Diagrams](/docs/architecture/sequences/README.md)
- [Foundation Document](/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
- [Deployment Workflow](/repos/deployment/DEPLOYMENT_WORKFLOW.md)

### Test Suites
- [Sequence Validation README](sequence-validation/README.md)
- [Sequence Quick Start](sequence-validation/QUICK_START.md)
- [Sandbox README](minibob-sandbox/README.md)
- [Sandbox Quick Start](minibob-sandbox/QUICK_START.md)

### Sequence Documentation
1. [Activity Selection](../docs/architecture/sequences/01-activity-selection.md)
2. [Impulse Resolution](../docs/architecture/sequences/02-impulse-resolution.md)
3. [Resolver Processing](../docs/architecture/sequences/03-resolver-processing.md)
4. [Improvisation & Trailblazing](../docs/architecture/sequences/04-improvisation-trailblazing.md)
5. [Hooks & Behavior Injection](../docs/architecture/sequences/05-hooks-behavior-injection.md)

## Contributing

When adding new features or modifying workflows:

1. **Update sequence diagrams first** if changing documented behavior
2. **Add sequence tests** if changing core workflows
3. **Add sandbox tests** if adding new user-facing features
4. **Run both test suites** before committing
5. **Update this INDEX.md** if changing directory structure

## Status

- ✅ Sequence validation suite: **Complete** (39 test cases across 5 sequences)
- ✅ MiniBob sandbox: **Complete** (26 test goals, backend integration)
- ✅ CI/CD integration: Ready
- ✅ Documentation: Complete

Both test suites use **production backend** (`https://activity.metabob.com`) for trace submission and learning validation.
