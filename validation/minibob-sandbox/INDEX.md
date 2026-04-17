# Sandbox Directory Index

## Quick Navigation

| Document | Purpose |
|----------|---------|
| **[SANDBOX_OVERVIEW.md](./SANDBOX_OVERVIEW.md)** | Complete architecture and usage guide |
| **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** | Command quick reference |
| **[README.md](./README.md)** | Detailed usage documentation |
| **[IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md)** | Integration guide for developers |
| **[VALIDATION_CRITERIA.md](./VALIDATION_CRITERIA.md)** | Quality gates and success metrics |

## I Want To...

### Get Started

→ **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md#setup-first-time)**

```bash
export METABOB_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
./setup.sh
```

### Run Tests

→ **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md#run-tests)**

```bash
# Structured validation
bun run run-validation.ts high

# Goal-based testing
bun sandbox/rapid-test.ts --scenario simple
```

### Understand the Architecture

→ **[SANDBOX_OVERVIEW.md](./SANDBOX_OVERVIEW.md#architecture)**

- Two complementary testing approaches
- File structure and organization
- Test categories and scenarios

### Integrate with MiniBob

→ **[IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md#integration-checklist)**

- What's complete vs what needs integration
- Step-by-step integration guide
- Code examples for integration

### Validate My Changes

→ **[VALIDATION_CRITERIA.md](./VALIDATION_CRITERIA.md)**

- Success metrics
- Quality gates
- Before commit checklist

### Troubleshoot Issues

→ **[README.md](./README.md#troubleshooting)**

- Common issues and solutions
- Backend connection problems
- Test execution failures

### View Results

→ **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md#view-results)**

```bash
cat reports/validation-report.json | jq '.summary'
tail -f logs/execution.log
```

## Test Files

### Structured Validation

| File | Description |
|------|-------------|
| **validation-tests.json** | 12 systematic validation tests |
| **run-validation.ts** | Test runner with formal reports |
| **collect-traces.sh** | Quick trace collection script |

### Goal-Based Testing

| File | Description |
|------|-------------|
| **test-goals.json** | 22 real-world goal scenarios |
| **rapid-test.ts** | Parallel goal execution |
| **execute-test-goals.ts** | Goal executor |

### Analysis & Monitoring

| File | Description |
|------|-------------|
| **analyze-traces.ts** | Trace analysis utilities |
| **trace-pipeline.ts** | Trace processing pipeline |
| **validate-trace-format.ts** | Schema validation |
| **trace-dashboard.html** | Visual trace inspector |
| **validation-metrics.ts** | Metrics calculation |

### Backend Integration

| File | Description |
|------|-------------|
| **backend-integration.test.ts** | Backend compatibility tests |
| **check-backend-compatibility.ts** | Endpoint validation |

## Key Concepts

### Structured Validation vs Goal-Based Testing

**Structured Validation:**
- Predefined expected outcomes
- Specific resolver testing
- Formal validation reports
- CI/CD friendly

**Goal-Based Testing:**
- Real-world scenarios
- Rapid iteration
- Parallel execution
- Trace collection focus

→ **[SANDBOX_OVERVIEW.md](./SANDBOX_OVERVIEW.md#two-complementary-approaches)**

### Trace Collection

Every execution generates:
- Task details with tool calls
- Impulse evolution
- Resolver metrics
- State transitions
- Thompson Sampling data

→ **[SANDBOX_OVERVIEW.md](./SANDBOX_OVERVIEW.md#trace-collection)**

### Integration Status

- ✅ Environment setup complete
- ✅ Test definitions complete
- ⚠️ Validation runner uses mocks (needs integration)
- ✅ Rapid test runner fully functional

→ **[IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md#integration-checklist)**

## Common Workflows

### Daily Development

```bash
# Quick validation before commit
./collect-traces.sh high

# If changes affect resolvers
bun run run-validation.ts
```

### Trace Collection

```bash
# Collect traces for learning loop
bun sandbox/rapid-test.ts --scenario simple
bun sandbox/rapid-test.ts --scenario complex
```

### Full Validation

```bash
# Before deployment
bun run run-validation.ts                    # Structured
for s in simple complex bootstrap; do        # Goal-based
  bun sandbox/rapid-test.ts --scenario $s
done
```

### Debugging

```bash
# Check backend connectivity
bun run check-backend-compatibility.ts

# Validate trace format
bun run validate-trace-format.ts trace.json

# View dashboard
open trace-dashboard.html
```

## File Tree

```
sandbox/
├── Core Files
│   ├── sandbox.config.json         # Configuration
│   ├── setup.sh                    # Environment setup
│   └── .gitignore                  # Exclusions
│
├── Documentation (Start Here)
│   ├── INDEX.md                    # This file
│   ├── SANDBOX_OVERVIEW.md         # Complete guide
│   ├── QUICK_REFERENCE.md          # Commands
│   ├── README.md                   # Detailed usage
│   ├── IMPLEMENTATION_NOTES.md     # Integration guide
│   └── VALIDATION_CRITERIA.md      # Quality gates
│
├── Structured Validation
│   ├── validation-tests.json       # Test definitions
│   ├── run-validation.ts           # Test runner
│   └── collect-traces.sh           # Quick collection
│
├── Goal-Based Testing
│   ├── test-goals.json             # Goal scenarios
│   ├── rapid-test.ts               # Parallel execution
│   └── execute-test-goals.ts       # Goal executor
│
├── Analysis & Monitoring
│   ├── analyze-traces.ts           # Analysis utilities
│   ├── trace-pipeline.ts           # Processing
│   ├── validate-trace-format.ts    # Validation
│   ├── trace-dashboard.html        # Visual inspector
│   └── validation-metrics.ts       # Metrics
│
├── Backend Integration
│   ├── backend-integration.test.ts # Tests
│   └── check-backend-compatibility.ts # Validation
│
└── Generated (Ignored)
    ├── workspace/                  # Test workspace
    ├── logs/                       # Execution logs
    └── reports/                    # Test reports
```

## Next Steps

1. **First Time:** Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) → Run `./setup.sh`
2. **Understand System:** Read [SANDBOX_OVERVIEW.md](./SANDBOX_OVERVIEW.md)
3. **Run Tests:** Try `./collect-traces.sh high`
4. **Integrate:** Follow [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md)
5. **Validate:** Check [VALIDATION_CRITERIA.md](./VALIDATION_CRITERIA.md)

## Questions?

- **How do I...?** → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **What is...?** → [SANDBOX_OVERVIEW.md](./SANDBOX_OVERVIEW.md)
- **Why isn't...?** → [README.md](./README.md#troubleshooting)
- **How do I integrate...?** → [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md)
- **What are the requirements...?** → [VALIDATION_CRITERIA.md](./VALIDATION_CRITERIA.md)
