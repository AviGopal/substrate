# Tasks — substrate root rename + repo hygiene

> Execute only after proposal approval. Verify substrate health (`curl localhost:18080/health`)
> between phases. Tag `pre-rename-2026-06-25` before Phase 1 for rollback.

## Phase 0 — pre-flight safety
- [ ] Back up SurrealDB + workspace named volumes (`docs/SUBSTRATE.md`).
- [ ] Confirm `scripts/substrate/workspace/mitosis-pending.json` is empty (no cutover mid-flight).
- [ ] Land the in-flight `goal-target-inference` work into the **goal-host-vessel nested repo** on `dev` and push (today it's untracked super-repo blobs: `repos/goal-host-vessel/src/index.ts`, `repos/goal-host-vessel/test/`).
- [ ] `git tag pre-rename-2026-06-25` on the super-repo.

## Phase 1 — cruft removal (untracked, just delete)
- [ ] Remove ~40 root `*.png`, `.opencode-search-debug.log` (40 MB), `.opencode-mcp-init.log`, `.dockerignore.backup`, `disrupt-application.md`.
- [ ] Remove `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, stray `workspace/`.
- [ ] Clean empty `vault/` scaffolding (keep `vault/README.md` + committed `.obsidian` config).
- [ ] Confirm tree = only `repos/ docs/ openspec/ scripts/ packages/ .metabob/` + root metadata.

## Phase 2 — submodule normalization
For each core vessel — goal-host-vessel, llm-resolver-vessel, local-tools-vessel, ribosome-vessel, boredom-vessel, stateful-ui-vessel, light-dispatch-vessel, metric-collector-vessel:
- [ ] Normalize branch to `dev` (llm-resolver-vessel, stateful-ui-vessel currently `main`).
- [ ] Reconcile divergence (local-tools-vessel: ahead 1 / behind 3 — rebase + audit, do **not** auto-merge).
- [ ] Commit working changes; `git push` so `origin/dev` HEAD = the commit the gitlink will pin (goal-host-vessel: ahead 1, push it).
- [ ] `git rm -r --cached repos/<vessel>` (drop stray blobs from super-repo index).
- [ ] Add `[submodule]` stanza to `.gitmodules` (url `git@github.com:AviGopal/<vessel>.git`, branch `dev`); absorb gitdir + re-add as `160000` gitlink.
- [ ] `git submodule status` clean; `make restart-<vessel>` hot-reloads.

Drop the 2 product/UI:
- [ ] `git rm -r --cached repos/metabob-internal-dashboard`; add to `.gitignore` heavy-checkout block.
- [ ] **Confirm obsidian-vessel decision (a vs b)** then `git rm -r --cached repos/obsidian-vessel`; if (a), add gitignore line + leave Dockerfile/cutover/Makefile obsidian wiring intact; if (b), strip obsidian from Dockerfile.substrate, cutover list, Makefile, setup-git-push.sh.

## Phase 3 — relative-path invariant
- [ ] Standardize `SUBSTRATE_ROOT` (host) = `git rev-parse --show-toplevel`; propagate the name across scripts/Makefile.
- [ ] Replace literal-path fallbacks with `SUBSTRATE_ROOT`/`HOST_REPO_ROOT` (or template var) in: `import-operator-memory.ts`, `seed-claudemd.{ts,sh}`, `host-container-source-drift-observer.ts`, `detect-obsidian-vessel-health.ts`, `vessel-auth-audit-template.json`, `forge-vessel-for-shape.json`.
- [ ] `import-operator-memory.ts`: prefer `$CLAUDE_PROJECT_DIR` / direct `memoryNote` resolver over the path slug.
- [ ] Extend `scripts/git-hooks/pre-commit` to reject newly-added literal `/home/avi/...` or `metabob-devbob` paths in tracked files.
- [ ] `grep -rn '/home/avi' <tracked>` → zero hits.

## Phase 4 — rename + move
- [ ] Stop substrate cleanly.
- [ ] `mv /home/avi/documents/work/exp-repo/metabob-devbob /home/avi/documents/work/substrate`.
- [ ] Re-link `host-sync-poller` systemd user units from the new root.
- [ ] Re-run idempotent `import-operator-memory.ts` (reconcile memory cache under new slug; substrate is authoritative).
- [ ] Update CLAUDE.md `Primary working directory` + example paths; update docs path refs.

## Phase 5 — rebuild + prove self-management from new root
- [ ] `make -C scripts/substrate build && run-live && seed-live`; `configure-local.sh`.
- [ ] Health-probe host-mapped vessels; `failure-mode-harness.ts`; one `mcp__metabob__run_goal`.
- [ ] `make clone-vessel-repos`; drive one gap→cutover; confirm a commit lands on a converted submodule's `origin/dev` via the path-agnostic host-sync-poller.
- [ ] `git submodule status` = 25 clean gitlinks; final substrate health green.
