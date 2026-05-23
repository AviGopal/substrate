# Substrate Observations

This directory is the on-disk surface of `validation/scripts/substrate-narrator.ts`.
It accumulates substrate-side observation logs that the substrate-narration
protocol (`docs/SUBSTRATE_NARRATION_PROTOCOL.md`) consumes.

## Directory layout

- **`events-<YYYY-MM-DD>.jsonl`** — captured WebSocket event stream from
  activity-api `/ws`. One JSON object per line. Captured event types:
  `task.started`, `task.completed`, `task.failed`, `tool.call`,
  `impulse.resolved`. Each line carries an `observed_at` timestamp the
  narrator adds at write time.
- **`snapshots/snapshot-<ISO-timestamp>.json`** — periodic substrate
  state snapshots. Default cadence: every 5 minutes. Each snapshot
  contains:
  - `activity_api.templates` — current template inventory (id, name,
    output_shapes) from `GET /v2/activities/templates?limit=1000`
  - `discovery_vessel.stats` — current vessel registrations from
    `GET /registry/stats`
  - `concept_db` — concept inventory count + a sample of recent concepts
    from `GET /concepts/search?limit=50`
- **`recent-traces-<ISO-timestamp>.json`** — accompanying trace window
  alongside each snapshot, from `GET /v2/activities/execution-traces?limit=50`.

All filenames are timestamped, so multiple narrators may run in parallel
without collision. The JSONL event log appends; the snapshot/trace files
are immutable once written.

## Rotation

These are append-only logs. The narrator does NOT rotate them — that is the
operator's responsibility. Reasonable patterns:

- Daily archival: `tar czf observations-$(date +%F).tgz events-*.jsonl snapshots/`
- Periodic pruning of `snapshots/` older than N days
- Keep the most recent N days verbatim; archive the rest

## Gitignore policy

This directory is gitignored by default (logs can grow large and contain
substrate-internal data that has no commit-history value). The exception is
this `README.md`.

**Opting in to commit specific observations as evidence:**

A gap record (under `validation/gaps/`) may need to cite a specific
observation as evidence. To commit that observation:

1. Move the file to a `validation/gaps/evidence/` subdirectory (which is
   NOT gitignored — only `validation/observations/**` is).
2. Reference it from the gap record's `evidence:` field.

Do not bypass the gitignore by force-adding files in this directory; the
gitignore is intentional. Move-then-commit is the supported workflow.
