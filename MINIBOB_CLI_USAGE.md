# MiniBob CLI Usage Guide

## Overview

MiniBob is a goal-first CLI tool. All inputs are treated as goals to be achieved. The tool does NOT support `--activity` or `--goal` flags as separate arguments.

## Correct CLI Syntax

### Single Goal Execution (What You Tried)

❌ **INCORRECT** - These don't work:
```bash
# This syntax is not supported
minibob --activity investigate-codebase-and-document --goal "Investigate docs" --single

# These will also fail
minibob --activity some-template --goal "description"
minibob goal --activity template-id
```

✅ **CORRECT** - Use `--single` or `-s` with a goal description:
```bash
minibob --single "Create a hello world feature"
minibob -s "Add user authentication to the app"
minibob --single "Fix the login bug in src/auth.ts"
```

### Interactive REPL Mode

```bash
# Start interactive mode (default)
minibob

# Then type goals directly at the prompt:
# > Fix the bug in authentication
# > Add error handling to the payment processor
```

### Background Server Mode

```bash
# Start as HTTP server for integrations
minibob --daemon
```

### Bored Mode (Autonomous Work)

```bash
# REPL but start in bored state (works autonomously)
minibob --idle

# Disable boredom (stay caffeinated)
minibob --caffeine
```

## Why the Error Occurred

The command you ran:
```bash
minibob --activity investigate-codebase-and-document \
        --goal "Investigate docs" --single
```

Failed because:
1. `--activity` is not a recognized MiniBob flag
2. `--goal` is not a recognized MiniBob flag
3. MiniBob treats everything after `--single` as a single goal description

The error "detectEnvironment is not defined" was likely a secondary error that occurred when trying to parse the invalid flags.

## Valid Examples

### Feature Development
```bash
minibob --single "Create a new API endpoint for user registration"
```

### Bug Fixes
```bash
minibob --single "Fix the null pointer exception in payment processor"
```

### Testing
```bash
minibob --single "Add unit tests for the authentication module"
```

### Refactoring
```bash
minibob --single "Refactor the database query builder to use prepared statements"
```

### Documentation
```bash
minibob --single "Document the API endpoints in OpenAPI format"
```

## CLI Flags Reference

| Flag | Short | Description | Example |
|------|-------|-------------|---------|
| `--single` | `-s` | Execute single goal then exit | `minibob --single "goal"` |
| `--daemon` | | Start HTTP server in background | `minibob --daemon` |
| `--idle` | | REPL mode but start bored (autonomous) | `minibob --idle` |
| `--caffeine` | | Disable boredom tasks | `minibob --caffeine` |
| `--dev` | | Enable development mode | `minibob --dev` |
| `--help` | `-h` | Show help | `minibob --help` |
| `--quiet` | `-q` | Suppress info messages | `minibob -q --single "goal"` |
| `-v` | | Show info messages | `minibob -v --single "goal"` |
| `-vv` | | Show debug messages | `minibob -vv --single "goal"` |
| `-vvv` | | Show trace messages | `minibob -vvv --single "goal"` |

## REPL Commands (Interactive Mode)

When running `minibob` interactively, use these commands:

| Command | Description | Example |
|---------|-------------|---------|
| `/help` | Show available commands | `/help` |
| `/auth` | Show and configure authentication | `/auth` |
| `/config` | Show current configuration | `/config` |
| `/status` | Check connectivity and system status | `/status` |
| `/cheer[!]` | Boost last activity (1-3 !) | `/cheer!` |
| `/chide[!]` | Penalize last activity (1-3 !) | `/chide!!` |
| `/bye` | Exit REPL | `/bye` |
| Any other input | Treated as a goal | `Fix the auth bug` |

## Environment Variables

```bash
# API Configuration
export ANTHROPIC_API_KEY="sk-ant-..."           # Claude API key
export MINIBOB_PROVIDER="anthropic"             # LLM provider
export MINIBOB_MODEL="claude-opus-4-5"          # Model to use

# Backend Configuration
export ACTIVITY_API_ENDPOINT="https://activity.metabob.com"
export METABOB_API_KEY="your-api-key"

# Instance Configuration
export MINIBOB_INSTANCE="my-minibob-001"        # Instance name
export MINIBOB_PROJECT="my-project"             # Project context
export MINIBOB_WORKDIR="/path/to/workdir"       # Working directory
export MINIBOB_PORT="8080"                      # Server port (for --daemon)

# Debug/Verbosity
export MINIBOB_HANG_TIMEOUT="1800000"           # Hang detection timeout (ms)
```

## Common Use Cases

### Goal-Driven Development

You want MiniBob to "investigate the codebase and document it":

**Wrong approach** (what you tried):
```bash
minibob --activity investigate-codebase --goal "document"  # ❌ Not supported
```

**Correct approach**:
```bash
minibob --single "Investigate the codebase and document what you find"  # ✅ Works
```

### Iterative Work

```bash
# Session 1: Add authentication
minibob --single "Add JWT-based authentication to the API"

# Session 2: Add tests
minibob --single "Add unit tests for the authentication endpoints"

# Session 3: Refactor
minibob --single "Refactor authentication code to be more maintainable"
```

### Batch Operations

```bash
# Run multiple goals in sequence
for goal in "Fix login bug" "Add error logging" "Update docs"; do
  echo "Working on: $goal"
  minibob --single "$goal"
  echo "---"
done
```

### Autonomous Work (Boredom Mode)

```bash
# Start bored - MiniBob will autonomously work on tasks
minibob --idle

# You can still interrupt with Ctrl+C or type /bye
```

## How MiniBob Works

1. **Accepts a goal** - Everything after `--single` is your goal
2. **Decomposes the goal** - Uses LLM to break it into steps
3. **Searches for activities** - Finds existing templates that fit
4. **Executes activities** - Runs the best matching template
5. **Learns from execution** - Updates success metrics
6. **Iterates** - Tries next step or backtracks if needed

## Why This Design?

MiniBob is **goal-first**, not **activity-first**. This means:

- You describe WHAT you want done, not HOW
- MiniBob figures out which activities (templates) to use
- The system learns which activities work best for which goals
- No need to manually specify template IDs or activities

This philosophy comes from the foundational principle: **"Activities constrain search, but don't prescribe execution."**

## Troubleshooting

### Problem: "Flag not recognized" error

**Solution**: You're using a flag MiniBob doesn't support. Check the valid flags above.

### Problem: "detectEnvironment is not defined"

**Solution**: This error shouldn't occur with valid syntax. If it does:
1. Use correct syntax: `minibob --single "goal"`
2. Update MiniBob: `cd repos/minibob && bun run index.ts --single "test"`
3. Check environment: `minibob --single "show my environment"`

### Problem: Backend not available

**Solution**:
```bash
# Check backend health
curl https://activity.metabob.com/health

# Override endpoint
export ACTIVITY_API_ENDPOINT="http://localhost:8080"
minibob --single "test"
```

### Problem: No authentication

**Solution**:
```bash
# Set API key
export ANTHROPIC_API_KEY="sk-ant-your-key"

# Try again
minibob --single "test"
```

## Migration Guide (If You Were Using Old Syntax)

### Old Syntax (Not Supported)

```bash
minibob --task-id template-123
minibob --template my-template
minibob --activity-type feature
```

### New Syntax (Use These Instead)

```bash
# Just describe what you want:
minibob --single "Create a new feature for user registration"
```

The system automatically finds and uses the right template(s).

---

**TL;DR**: MiniBob is goal-first. Use `minibob --single "your goal here"` - that's it!
