# MiniBob Validation Environment

This directory contains the validation and testing infrastructure for MiniBob's unified execution path.

## Structure

```
validation/
├── minibob-sandbox/     # Sandbox environment for rapid testing
│   ├── setup.sh         # Environment setup
│   ├── rapid-test.ts    # Batch test runner
│   ├── test-goals.json  # 26 test scenarios
│   └── ...              # Additional tools and configs
└── README.md            # This file
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

## Backend

All tests use the production backend: `https://activity.metabob.com`
