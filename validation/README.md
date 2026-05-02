# validation/ — head-to-head agent benchmark harness

A manual benchmark for comparing **Claude Code** and **minibob** on the same
prompt + same workspace + same model. Each agent runs in an isolated Docker
container with a private bind-mounted copy of the workspace. The harness
diffs the two resulting workspaces and emits a side-by-side `report.md`.

This is a *prompt-iteration tool*, not CI. There is no scoring / verdict
automation — a human (or follow-up agent) reads the report and decides.

## Quick start

```
export ANTHROPIC_API_KEY=sk-ant-...
./run.sh prompts/01-fix-failing-test.md pristine-typescript-project
# ─ first run also builds the Claude Code image (~30s) and pulls minibob
# Output: runs/<timestamp>-01-fix-failing-test/report.md
```

Or invoke the orchestrator directly:

```
bun run lib/orchestrator.ts \
  --prompt prompts/02-add-feature.md \
  --workspace pristine-typescript-project \
  --model claude-sonnet-4-6 \
  --timeout 600
```

`bun run lib/orchestrator.ts --help` prints the full flag reference.

## Layout

```
validation/
├── README.md                 # this file
├── Dockerfile.claude-code    # builds metabob-validation/claude-code:local
├── containers.json           # canonical image refs + defaults
├── docs/
│   └── CLAUDE_CODE_CONTAINER.md  # why we build our own
├── prompts/                  # benchmark prompts (one per scenario)
├── workspaces/               # input seeds (self-contained, no git remote)
├── lib/
│   ├── orchestrator.ts       # main entry
│   ├── docker-runner.ts      # docker invocation per agent
│   ├── workspace-diff.ts     # tree + unified-diff helpers
│   └── transcript-capture.ts # parse JSONL transcripts
├── run.sh                    # thin shell wrapper
└── runs/                     # gitignored; one dir per invocation
    └── <ts>-<prompt>/
        ├── prompt.md
        ├── claude-code/{workspace.before,workspace.after,transcript.jsonl,stdout.log,stderr.log}
        ├── minibob/{workspace.before,workspace.after,transcript.jsonl,stdout.log,stderr.log}
        └── report.md
```

## Reading a report

The `report.md` is structured into five sections:

1. **File tree changes (side-by-side)** — every path that changed under
   either agent, with one column per agent (`created` / `modified` /
   `deleted` / `—`) and a `same?` column comparing SHA-256 of the file
   bytes between the two `workspace.after` snapshots.
2. **Per-file unified diffs** — a `diff -u` between the two agents'
   `workspace.after` versions, *not* between before and after. This is the
   high-signal section: it shows where the two agents disagreed.
3. **Transcript summary** — LLM call count, tool call count, token totals,
   final assistant message. Claude Code totals come from its `result`
   stream-json event; minibob totals are stubbed (TODO; see
   `lib/transcript-capture.ts`).
4. **Failure / timeout notes** — whether either agent timed out or
   non-zero-exited; pointers to `stderr.log`.
5. **Verdict (human-filled)** — empty scaffold for the operator's notes.

## Adding a new prompt

Drop a markdown file in `prompts/`. The whole file body is passed verbatim
as the goal/prompt to both agents. Keep prompts self-contained — the agent
sees only the prompt text and the workspace, not the filename.

## Adding a new workspace seed

Create `workspaces/<name>/` with whatever files the seed needs. Keep it
self-contained:

- **No git remote.** If you `git init`, do not add a remote — agents could
  otherwise accidentally push.
- **No secrets.** Anything in the seed gets bind-mounted into both
  containers.
- **Small.** Seeds are copied four times per run (before/after × 2 agents).

Pass the directory name (not path) via `--workspace`.

## Containers

`containers.json` pins the image refs:

- **minibob**: `metabobapp/minibob:<version>-<sha>` from Docker Hub
  (published by the deploy chain). Bump the tag to test newer minibob
  builds. Reuses the existing image — never rebuilt here.
- **Claude Code**: `metabob-validation/claude-code:local`, built from
  `Dockerfile.claude-code` on first run. Anthropic does not publish a
  public pre-built image; see `docs/CLAUDE_CODE_CONTAINER.md`.

## Authentication

Both agents need `ANTHROPIC_API_KEY` exported in the host environment; it
is forwarded into both containers via `-e`. Minibob additionally needs
`~/.metabob/config.json` (METABOB_API_KEY, endpoint, provider config),
which is bind-mounted read-only from the host.

## Network

Both containers retain outbound network access — agents need to reach
`api.anthropic.com`, and minibob also reaches `activity.metabob.com`.
There is no per-container firewall. The only sandboxing is filesystem:
the bind-mount restricts writes to `/workspace`.

## Standalone-parity mode (`--no-backend`)

The Phase 13 target is **standalone parity**: minibob in the harness should
behave like Claude Code — one process, one workspace, no external coordination.
Pass `--no-backend` to disable both discovery-vessel registration and
activity-api trace POSTs:

```
bun run lib/orchestrator.ts \
  --prompt prompts/01-fix-failing-test.md \
  --workspace pristine-typescript-project \
  --no-backend \
  --timeout 1200
```

Internally this sets `DISCOVERY_ENABLED=false`, unsets `METABOB_API_KEY`, and
sets `MINIBOB_OFFLINE_MODE=true` in the minibob container. Without it, minibob
will attempt to register with discovery and POST execution traces to
activity-api — useful when you want the full learning-loop wiring exercised,
but it confounds the head-to-head comparison.

## Transcript capture

minibob's container is given a host-writable mount at `/tmp/minibob-transcript/`
and `MINIBOB_TRANSCRIPT_FILE=/tmp/minibob-transcript/transcript.jsonl`. The
LLM client (`repos/minibob/src/transcript.ts`) appends one JSONL line per LLM
request, LLM response, tool call, and tool result. After the run, the
harness copies `transcript.jsonl` out to `runs/<ts>/minibob/transcript.jsonl`
and counts the records into the report's Section 3 (Run summary).

The Claude Code transcript continues to come from
`claude -p ... --output-format stream-json`.

## Known TODOs

- **Claude Code `--output-format stream-json`** flag may change between
  CLI releases. If parsing breaks, the orchestrator falls back to plain
  stdout capture; the transcript section will simply note 0 LLM calls.
- **minibob transcript token counts** are best-effort: only `usage` fields
  recorded by the LLM resolver land in the report. Cost USD is not yet
  computed from the transcript (minibob would need to inline pricing).
