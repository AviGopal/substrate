# @metabob/react-renderer

React components for rendering metabob impulse shapes in dashboards and UIs.

## Overview

This package provides **shape-specific renderers** for impulses, enabling rich visual display of:
- Terminal sessions (live or recorded)
- File contents
- Test results
- Error messages
- Git diffs
- And more...

## Installation

```bash
cd repos/react-renderer
bun install
```

## Usage

### Basic Usage

```typescript
import { ImpulseRouter } from '@metabob/react-renderer';

function ExecutionViewer({ execution }) {
  return (
    <div>
      {execution.input_impulses.map((impulse) => (
        <ImpulseRouter key={impulse.id} impulse={impulse} />
      ))}
    </div>
  );
}
```

### Terminal Renderer (Interactive)

```typescript
import { TerminalRenderer } from '@metabob/react-renderer';

function TerminalView({ terminalImpulse }) {
  return (
    <TerminalRenderer
      impulse={terminalImpulse}
      interactive={true}
      onInput={async (data) => {
        // Send input to terminal vessel
        await fetch(`http://localhost:9137/v2/terminals/send-input`, {
          method: 'POST',
          body: JSON.stringify({
            terminalId: terminalImpulse.pointer.terminalId,
            input: data
          })
        });
      }}
    />
  );
}
```

## Supported Shapes

| Shape | Renderer | Interactive | Description |
|-------|----------|-------------|-------------|
| `terminalState` | `TerminalRenderer` | ✅ Yes | Live/recorded terminal sessions with xterm.js |
| `file` | `FileRenderer` | ❌ No | Syntax-highlighted file contents |
| `test_result` | `TestResultRenderer` | ❌ No | Test execution results |
| `error` | `ErrorRenderer` | ❌ No | Error messages with stack traces |
| `git_diff` | `GitDiffRenderer` | ❌ No | Git diffs with syntax highlighting |

## Architecture

```
ImpulseRouter
  ├─ Detects impulse.metadata.shape
  └─ Routes to appropriate renderer

TerminalRenderer
  ├─ Uses xterm.js for terminal emulation
  ├─ Renders ANSI buffer
  ├─ Handles interactive input (optional)
  └─ Shows exit code, cursor, history

FileRenderer
  ├─ Syntax highlighting
  └─ Line numbers

TestResultRenderer
  ├─ Pass/fail summary
  ├─ Failed test details
  └─ Duration stats
```

## Integration with Activity Dashboard

```typescript
// repos/activity-dashboard/src/components/ExecutionViewer.tsx
import { ImpulseRouter } from '@metabob/react-renderer';

export function ExecutionViewer({ execution }) {
  return (
    <div className="execution-viewer">
      <h2>Execution: {execution.execution_id}</h2>

      {/* Input impulses */}
      <section>
        <h3>Input Impulses</h3>
        {execution.input_impulses.map((impulse) => (
          <ImpulseRouter
            key={impulse.id}
            impulse={impulse}
            interactive={impulse.metadata.shape === 'terminalState'}
          />
        ))}
      </section>

      {/* Output impulses */}
      <section>
        <h3>Output Impulses</h3>
        {execution.output_impulses.map((impulse) => (
          <ImpulseRouter key={impulse.id} impulse={impulse} />
        ))}
      </section>
    </div>
  );
}
```

## Development

```bash
# Type checking
bun run typecheck

# Build
bun run build

# Development mode (watch)
bun run dev
```

## TODO

- [ ] Add FileRenderer with syntax highlighting
- [ ] Add TestResultRenderer
- [ ] Add ErrorRenderer with stack trace parsing
- [ ] Add GitDiffRenderer
- [ ] Add WebSocket support for live terminal updates
- [ ] Add terminal recording/playback controls
- [ ] Add checkpoint visualization
- [ ] Add multi-viewer indicators
