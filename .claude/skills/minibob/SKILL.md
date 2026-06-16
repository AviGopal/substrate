---
name: minibob
description: Dispatch development work through the substrate. MiniBob is the thin CLI entry point that POSTs goals to goal-host-vessel (local substrate :18210) so the work runs as a traced activity and feeds the learning loop — not a standalone agent. Use it instead of hand-editing vessel source.
license: MIT
compatibility: Requires Node.js 18+ or Bun. Install via npm i -g @metabob/minibob@latest
metadata:
  author: metabob
  version: "5.1"
---

# MiniBob CLI

MiniBob is a **goal-first development vessel and the entry point for substrate-dispatched
work.** All inputs are treated as goals. MiniBob does not execute in-process — it POSTs
`{goal, variables}` to `goal-host-vessel` (`GOAL_HOST_VESSEL_ENDPOINT`, default
`http://127.0.0.1:18210/run-goal`) with `Authorization: ApiKey $METABOB_API_KEY`. The
substrate-hosted vessels do the work (LLM calls, template selection, resolvers, ribosome
extraction), every dispatch produces a trace, and the trace feeds Thompson Sampling.

**This is the default path for code changes in this repo.** Direct `Write`/`Edit` on
`repos/<vessel>/src/**` is blocked by the `substrate-vessel-edit-gate` hook precisely so
the work routes here. Reach for `minibob --single "<goal>"` first; only set
`SUBSTRATE_ALLOW_DIRECT_EDIT=1` for a deliberate one-off manual edit. Edits to `docs/`,
`scripts/`, `openspec/`, `.claude/`, tests, and config are never gated.

> Prerequisite: the local substrate (`substrate-live`) must be up. Confirm goal-host with
> `curl -s http://localhost:18210/health`. If it is down, dispatch can't route and you
> fall back to manual edits (the gate fails open).

---

## Installation

```bash
npm i -g @metabob/minibob@latest
```

Verify:
```bash
minibob --help
```

---

## Modes

### REPL Mode (default)
```bash
minibob
```
Interactive loop that accepts goals continuously. Runs boredom tasks when idle.

### Single Goal Mode
```bash
minibob --single "fix the failing tests"
minibob -s "add input validation to the form handler"
```
Execute one goal and exit. Exit code 0 on success, 1 on failure.

### Daemon Mode
```bash
minibob --daemon
```
Start as HTTP/ACP server. Exposes `/health`, `/goal`, `/status`, `/acp` endpoints. Starts in bored state.

### Idle Mode
```bash
minibob --idle
```
Start REPL but in bored state. Runs tasks until user input interrupts.

---

## Flags

| Flag | Description |
|------|-------------|
| `--single`, `-s` | Run single goal and exit |
| `--daemon` | Start as HTTP/ACP server |
| `--idle` | Start REPL in bored state |
| `--caffeine` | Disable boredom tasks |
| `--dev` | Enable development mode |
| `-q`, `--quiet` | Only show errors |
| `-v` | Show info messages |
| `-vv` | Show debug messages |
| `-vvv` | Show trace messages |

---

## REPL Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/auth` | Show authentication configuration |
| `/config` | Show current configuration and file locations |
| `/status` | Check connectivity, list vessels, next boredom activity |
| `/continue` | Continue working on last goal |
| `/cheer[!] [msg]` | Positive feedback on last activity (! for stronger, max !!!) |
| `/chide[!] [msg]` | Negative feedback on last activity (! for stronger, max !!!) |
| `/bye` | Exit |

All other input is treated as a goal.

---

## Doctor Command

Health check and template management:

```bash
minibob doctor              # Health check (default)
minibob doctor health       # Same as above
minibob doctor check <path> # Validate activity templates
minibob doctor surface <q>  # Search and retrieve templates
minibob doctor fix <path>   # Auto-fix template issues
minibob doctor tutor <path> # Submit templates to registry
```

---

## Configuration

### Files

| Location | Purpose |
|----------|---------|
| `~/.metabob/config.json` | Global config (API keys, defaults) |
| `.metabob.json` | Project config (working dir, tools) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for Claude |
| `METABOB_API_KEY` | API key for Metabob backend (sent as `Authorization: ApiKey ...`) |
| `GOAL_HOST_VESSEL_ENDPOINT` | goal-host-vessel dispatch URL (local substrate default: `http://127.0.0.1:18210`) |
| `ACTIVITY_API_ENDPOINT` | Activity API URL (local substrate: `http://localhost:18080`; canary: `https://activity.metabob.com`) |
| `MINIBOB_PORT` | Server port (default: 8080) |
| `MINIBOB_PROVIDER` | LLM provider: anthropic \| openai |
| `MINIBOB_MODEL` | Model to use |
| `MINIBOB_WORKDIR` | Working directory |
| `MINIBOB_INSTANCE` | Instance name for multi-instance setups |
| `MINIBOB_PROJECT` | Project context |
| `MINIBOB_HANG_TIMEOUT` | Hang detection timeout in ms (default: 1800000) |

---

## Usage Examples

### Execute a goal
```bash
minibob -s "Fix the authentication bug where JWT tokens expire prematurely"
```

### Interactive session
```bash
minibob
minibob> fix the login page submit button
minibob> /cheer! fixed the event binding issue
minibob> /status
minibob> /bye
```

### Pipe mode
```bash
echo "add tests for auth module" | minibob
```

### Background server
```bash
minibob --daemon &
curl -X POST http://localhost:8080/goal \
  -H "Content-Type: application/json" \
  -d '{"goal": "optimize database queries"}'
```

---

## Boredom System

MiniBob can work autonomously when idle:

1. **Cluster Mode**: Backend-assigned tasks from org-wide queue
2. **Local Mode**: Uses `~/.minibob/boredom-queue.json`

Control:
- `--caffeine` disables boredom
- `--idle` starts immediately bored
- `/status` shows next queued task

---

## Output

Goal processing returns:
- Success/failure status
- Activity ID (for feedback)
- Execution trace (stored in backend)
- Files modified

Example output:
```
[GoalProcessor] Processing: fix the login bug
[Activity] Starting: debug-and-fix
[Task 1/3] Analyzing error logs...
[Task 2/3] Identifying root cause...
[Task 3/3] Applying fix...
[Activity] Completed in 45.2s
```

---

## Feedback

Provide feedback on activity outcomes:

```bash
/cheer           # Positive, normal intensity
/cheer!          # Positive, stronger
/cheer!! great   # Positive, strong, with message
/chide           # Negative, normal intensity
/chide! broke X  # Negative, stronger, with message
```

Feedback adjusts Thompson Sampling scores for activity selection.
