# microplastic Development Guidelines

## What This Is

microplastic is a **composite vessel agent-IDE** - a Claude Code replacement that gains capabilities through use. It composes three vessels in a single process:

| Vessel | Role | Pointer Types |
|--------|------|---------------|
| **minibob** | Execution | file, memo, bash, llm |
| **tui** | Narrative | user_*, ui_*, display |
| **mcp** | Analysis | cpg, embedding, impact |

## Core Principles

### Templates Are Not Local

**Templates live in the backend.** Never create local template files.

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
```

- Level 0 "Primordial" templates are embedded in code, seeded to backend on first run
- All other templates are created via ribosome extraction and stored in backend
- `.microplastic/cache/` is for offline use only (gitignored)

### Gain-of-Function Cycle

microplastic gains capabilities through use:

1. **Goal** → User provides intent
2. **Execute** → Template or improvisation
3. **Trace** → Capture execution
4. **Extract** → Ribosome creates template
5. **Learn** → Thompson Sampling updates α/β

## Project Structure

```
src/
  index.ts          # CLI entry point
  vessel/           # VesselProvider implementations
  impulse/          # ImpulseStore and types
  tui/              # Narrative TUI components
  selection/        # Thompson Sampling client
  ribosome/         # Template extraction → backend
  failure/          # Failure recovery
  analysis/         # MCP integration
  primordials/      # Level 0 templates (embedded)
  prompts/          # System prompts
  commands/         # Slash commands
  boredom/          # Autonomous improvement

.microplastic/      # Runtime data (gitignored)
  cache/            # Offline template cache

tests/
  *.test.ts
```

## Using Bun

```bash
bun run start       # Run the CLI
bun run dev         # Watch mode
bun test            # Run tests
bun run typecheck   # Type check
bun run build       # Build for distribution
```

Bun APIs to prefer:
- `Bun.file()` for file operations
- Built-in `WebSocket` (no external library)
- Automatic `.env` loading
- `bun:test` for testing

## Key Types

```typescript
// VesselProvider - all vessels implement this
interface VesselProvider {
  id: string;
  manifest: VesselManifest;
  initialize(ctx: VesselContext): Promise<void>;
  canResolve(pointer: ImpulsePointer): boolean;
  resolve(pointer: ImpulsePointer): Promise<ResolvedContent>;
  shutdown(): Promise<void>;
}

// ImpulseStore - shared state space
interface ImpulseStore {
  create(impulse: Impulse): string;
  get(id: string): Impulse | undefined;
  resolve(id: string): Promise<ResolvedContent>;
  subscribe(listener: ImpulseListener): () => void;
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | API key for LLM | Required |
| `ACTIVITY_API_URL` | Backend API URL | `http://localhost:8080` |
| `MICROPLASTIC_VERBOSE` | Enable verbose output | `false` |

## Development Phases

See `openspec/changes/microplastic/tasks.md` for the full task list:

- **Phase 1** ✅ Project scaffold
- **Phase 2** Vessel core (VesselProvider, ImpulseStore)
- **Phase 3** TUI narrative
- **Phase 4** Thompson selection
- **Phase 5** Ribosome integration
- **Phase 6** Failure recovery
- **Phase 7** Analysis vessel (MCP)
- **Phase 8** Bootstrap templates
- **Phase 9** System prompts
- **Phase 10** Power user features
- **Phase 11** Boredom mode
- **Phase 12** Production hardening

## Related Documentation

- [`openspec/changes/microplastic/design.md`](../../openspec/changes/microplastic/design.md) - Architecture decisions
- [`openspec/changes/microplastic/specs/`](../../openspec/changes/microplastic/specs/) - Detailed specifications
- [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](../../docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Core ontology
