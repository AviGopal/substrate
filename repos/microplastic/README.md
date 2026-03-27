# microplastic

**Composite vessel agent-IDE** - A Claude Code replacement that gains capabilities through use.

## Overview

microplastic composes three vessels into a unified agent-IDE:

| Vessel | Role | Resolves |
|--------|------|----------|
| **minibob** | Execution | file, memo, bash, llm |
| **tui** | Narrative | user_*, ui_*, display |
| **mcp** | Analysis | cpg, embedding, impact |

## Installation

```bash
# From workspace root
bun install

# Or directly
cd repos/microplastic
bun install
```

## Usage

```bash
# Interactive mode
microplastic

# Execute a goal directly
microplastic "Implement a new feature"

# With options
microplastic "Fix the bug" --workdir ./my-project --verbose

# Show help
microplastic --help

# List templates
microplastic templates
```

## Key Concepts

### Gain-of-Function

microplastic gains capabilities through use:

1. **Execute goal** with templates or improvisation
2. **Capture trace** of successful execution
3. **Extract template** via ribosome
4. **Learn** via Thompson Sampling

### Template Hierarchy

| Level | Name | Description |
|-------|------|-------------|
| 0 | Primordial | Immutable core templates |
| 1 | Meta | Templates that create templates |
| 2 | Spec | Specification generation |
| 3 | Development | Core development activities |
| 4 | Choreography | TUI interaction patterns |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/templates` | List activity templates |
| `/history` | Show execution history |
| `/debug` | Toggle verbose mode |
| `/abort` | Stop current execution |

## Development

```bash
# Run in development mode
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

## Architecture

```
src/
  index.ts          # CLI entry point
  vessel/           # Vessel providers and registry
  impulse/          # Impulse store and types
  tui/              # Narrative TUI components
  selection/        # Thompson Sampling client
  ribosome/         # Template extraction → backend
  failure/          # Failure recovery
  analysis/         # MCP integration
  primordials/      # Level 0 templates (embedded, seeded to backend)
  prompts/          # System prompts
  commands/         # Slash commands
  boredom/          # Autonomous improvement

.microplastic/      # Runtime data (gitignored)
  cache/            # Offline template cache

tests/
  *.test.ts         # Test files
```

### Template Storage

Templates are **not stored locally**. They live in the activity-api backend:

```
microplastic                          activity-api
────────────                          ────────────
     │                                      │
     │  POST /v2/activities/templates       │
     │ ────────────────────────────────────▶│  Store template
     │                                      │
     │  GET /v2/activities/recommend        │
     │ ────────────────────────────────────▶│  Thompson Sample
     │                                      │
     │  POST /v2/execution-traces           │
     │ ────────────────────────────────────▶│  Update α/β
     │                                      │
```

- **Level 0 (Primordial)**: Embedded in code, seeded to backend on first run
- **All other levels**: Created via ribosome extraction, stored in backend
- **Local cache**: `.microplastic/cache/` for offline use only

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | API key for LLM | Required |
| `MICROPLASTIC_WORKDIR` | Working directory | `process.cwd()` |
| `MICROPLASTIC_VERBOSE` | Enable verbose output | `false` |
| `ACTIVITY_API_URL` | Backend API URL | `http://localhost:8080` |

## License

MIT
