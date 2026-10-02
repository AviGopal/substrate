# Durability + new-repo primitives — iter 2026-06-03

Closes two structural gaps surfaced by the operator framing:

## Gap A — substrate learning state is wiped on container destruction

**Diagnosis.** SurrealDB lives at `/var/lib/surrealdb/data.db` *inside*
`substrate-live`. `/workspace` is the only host-bind-mounted directory.
`docker rm substrate-live` wipes 177 templates, 828 concepts, ~16K execution
traces, every Thompson posterior — even though `/workspace/git/super-repo/`
survives.

**Closure.** Two new resolvers in development-vessel:

- `surrealdb_export` — POST `SELECT * FROM <table> LIMIT $cap` to SurrealDB
  `/sql` per table, write the response as `<table>.jsonl` under
  `/workspace/snapshots/<ISO_TS>/`. Defaults to five load-bearing tables.
  Empty `activity_template` (table is empty in the live DB) writes a 0-byte
  file; populated tables write the JSONL.
- `surrealdb_import` — replay a snapshot dir. `CREATE <table> CONTENT $row`
  per JSONL line; duplicate ids count as `rows_skipped`, not errors.

New seed template `development-vessel:backend-snapshot-to-git` composes
`surrealdb_export` + `fs_write manifest` + the substrate-as-git-author chain
(`git_branch_create` + `git_add` + `git_commit` + `git_push` + `gh_pr_create`).
The JSONL bodies stay in `/workspace` (large, persistent); the small
manifest gets committed to git as the durable index. Two independent
durability layers.

New boredom goal `goal[14]` dispatches this template with cost class
`moderate`. Variables (snapshot_ts, snapshot_dir, manifest_relpath,
target_branch, PR text) all derived inside `extraVariablesForGoal(14)`.

## Gap B — new vessels can't get their own GitHub repos

**Diagnosis.** `scaffold-and-publish-vessel` (exec_sneey4w0 / PR #22) writes
the vessel under `repos/<vessel>/` in the super-repo only. There's no
`AviGopal/metric-collector-vessel` remote — substrate-authored vessels are
structurally trapped as super-repo subdirectories.

**Closure.** New resolver `gh_repo_create`:

- POSTs to `https://api.github.com/user/repos` (or `/orgs/<owner>/repos` if
  owner ≠ authenticated user). Pre-checks for existence via GET; refuses
  if the repo already exists (`safety_breach`, error_code
  `repo_already_exists`).
- Refuses names starting with `metabob-` unless `allow_canonical_prefix=true`
  — the operator owns that prefix.
- Defaults: `private: true`, `default_branch: dev` (substrate convention).

New seed template `vessel-repo-promote` composes `fs_list` (enumerate the
existing vessel tree for record-keeping) + `gh_repo_create` + a finding-style
manifest write + the publish chain. **Submodule pointer conversion is
intentionally deferred** — doing `git submodule add` cleanly requires
atomic remove-tree + add-pointer, which is a delicate operation worth its
own iteration. Shipping the gh_repo_create primitive now means the substrate
*can* author its own remotes; the submodule cutover is a follow-up.

## Live evidence

```
$ docker exec substrate-live curl -s -X POST .../v2/impulses/resolve \
    -d '{"impulse":{"pointer":{"type":"surrealdb_export",
        "tables":["activity_template","concept","activity_execution_traces"],
        "rowCap":50000}}}'

output_dir:  /workspace/snapshots/20260603T061535Z
total_rows:  16713
total_bytes: 23948397
  activity_template            rows= 0      bytes= 0
  concept                      rows= 828    bytes= 13_067_740
  activity_execution_traces    rows= 15885  bytes= 10_880_657
```

Snapshot directory present in `/workspace/snapshots/`; files survive
substrate-live restarts (host bind mount).

Boredom-vessel autonomous loop selected goal[14] on the next tick after
seed:

```
06:16:01 [boredom-vessel] state-conditioned selection: signature=6397128f
         mode=round_robin (insufficient posterior samples) picked=14
06:16:01 [boredom-vessel] submitting goal[14]: "run backend_snapshot_to_git
         to dump SurrealDB state ..."
         (targetTemplateId=development-vessel:backend-snapshot-to-git)
06:16:01 [boredom-vessel] goal launched async dispatchId=7187b926-...
```

goal-host OOMed mid-chain at 06:20:28 (cgroup OOM kill) — a known
structural issue tracked separately and intentionally not addressed in this
iteration per operator framing ("substrate's own next mitosis target").

## What's still incomplete

1. **backend-snapshot replay at startup** — not tested. surrealdb_import is
   implemented + tested in unit/stub form, but no boot-time hook calls it.
2. **vessel_repo_promote submodule conversion** — stubbed as a finding-
   manifest write; the actual `git submodule add` step is deferred.
3. **GITHUB_TOKEN in substrate env** — not currently set, so gh_repo_create
   refuses with `cascading` failure_mode. Operator action needed to set
   `GITHUB_TOKEN` in `/etc/substrate/env` before the substrate can author
   real remotes.
4. **goal-host OOM under composition chains** — observed live during the
   boredom dispatch of goal[14]. Out of scope by operator directive.

## File map

- `repos/development-vessel/src/resolvers/surrealdb-export.ts`
- `repos/development-vessel/src/resolvers/surrealdb-import.ts`
- `repos/development-vessel/src/resolvers/gh-repo-create.ts`
- `repos/development-vessel/src/seed/backend-snapshot-to-git.ts`
- `repos/development-vessel/src/seed/vessel-repo-promote.ts`
- `repos/development-vessel/test/resolvers/{surrealdb-export,surrealdb-import,gh-repo-create}.test.ts`
- `repos/boredom-vessel/src/index.ts` (goal[14])

dev-vessel HEAD: b0b7fd05a5f4
boredom-vessel HEAD: 91b4db81dc05
