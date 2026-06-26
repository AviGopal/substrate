# Substrate root rename + repo hygiene → relative-path, self-managing root

**Date:** 2026-06-25
**Scope:** super-repo (`metabob-devbob` → `substrate`), `.gitmodules`, `scripts/substrate/*`, `Dockerfile.substrate`, the 8 substrate-core embedded vessels.
**Stage:** PROPOSED (awaiting operator review before any destructive op).
**Continues:** [`2026-06-16-substrate-namespace-and-compose-migration`](../2026-06-16-substrate-namespace-and-compose-migration/proposal.md) — that change created the `AviGopal/*` remotes for the 9 split-out vessels; **this change finishes the job** by converting them from broken embedded repos into proper submodules, then renames/relocates the root and removes every hardcoded absolute path.

## North star

The substrate operates out of **`/home/avi/documents/work/substrate`** and manages its own codebase from that root: it pulls submodules, builds/runs its own container, commits, and cuts over — with **zero hardcoded absolute paths**. Every path in the repo and in the container is either relative to a single `{substrate-root}` anchor (resolved at runtime) or a container-internal absolute (`/vessels`, `/workspace`). Moving or renaming the root is then a pure `mv` + `make run-live` with no code edits required. This is the substrate-management foundation the upcoming networking work will be taught on top of.

## Operator decisions (2026-06-25)

1. **Target path:** `/home/avi/documents/work/substrate` — drops the `metabob` prefix (matches "AviGopal namespace = the substrate"), new parent (`work/`, out of `exp-repo/`).
2. **Hard invariant:** *no hardcoded refs that are not relative to `{substrate-root}`.* Inside the repo and the container, everything is relative.
3. **Embedded repos:** convert the **8 substrate-core** vessels to proper submodules; **drop the 2 product/UI** ones (`metabob-internal-dashboard`, `obsidian-vessel`) from the super-repo submodule set. (Obsidian coupling flagged below — confirm during review.)
4. **Process:** this proposal first; execute only after approval.

## Problem (root-caused live)

### Bucket 1 — loose cruft at root (all gitignored; physically present, travels on `mv`)
`git status` is clean of these because `.gitignore` already covers them, but they sit in the tree and bloat any copy/move:
- **~40 `.png` screenshots** at root (`01-landing-signin.png` … `step-09-*.png`, `obsidian-*.png`, etc.).
- **`.opencode-search-debug.log` — 40 MB**; `.opencode-mcp-init.log` — 303 KB.
- `disrupt-application.md` (stray doc), `.dockerignore.backup`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, empty `vault/`, runtime `workspace/`.

### Bucket 2 — the submodule layer is half-broken (the real problem)
`repos/` is in three inconsistent states:
- **17 proper submodules** (gitlink, mode `160000`) — clean.
- **6 heavy checkouts** deliberately gitignored, 0 super-repo blobs (`activity-dashboard`, `metabob-analysis-api`, `metabob-dashboard`, `metabob-opencode`, `k8s-activity-executor`, `vessels`) — intentional, leave as-is.
- **10 "embedded repos" in a broken dual state** — each has its *own* `.git` pointing at a real remote, **yet a handful of files are also committed as plain blobs into the super-repo**. These are substrate-critical and cannot be managed uniformly (pull/commit/cutover) because they aren't gitlinks:

| Vessel | super-repo blobs | nested `.git` remote | branch | sync state |
|---|---|---|---|---|
| goal-host-vessel | 5 | AviGopal/goal-host-vessel | dev | **ahead 1 (unpushed)** + in-flight blobs in super-repo |
| llm-resolver-vessel | 5 | AviGopal/llm-resolver-vessel | **main** | clean |
| local-tools-vessel | 5 | AviGopal/local-tools-vessel | dev | **diverged: ahead 1 / behind 3** |
| ribosome-vessel | 7 | AviGopal/ribosome-vessel | dev | clean |
| boredom-vessel | 5 | AviGopal/boredom-vessel | dev | clean |
| stateful-ui-vessel | 9 | AviGopal/stateful-ui-vessel | **main** | clean |
| light-dispatch-vessel | 5 | AviGopal/light-dispatch-vessel | dev | clean |
| metric-collector-vessel | 7 | AviGopal/metric-collector-vessel | dev | clean |
| obsidian-vessel | 95 | AviGopal/obsidian-vessel | dev | *(drop — see flag)* |
| metabob-internal-dashboard | 56 | MetabobProject/metabob-internal-dashboard | main | *(drop — product)* |

The 8 in the top block are the substrate-core set to convert. Note three land-mines: `goal-host-vessel` has an unpushed commit **and** its current `src/index.ts` edit + `test/` are sitting as untracked super-repo blobs (your in-flight `goal-target-inference` work); `local-tools-vessel` has **diverged** from its remote; `llm-resolver-vessel` and `stateful-ui-vessel` are on `main`, not `dev`.

### Bucket 3 — hardcoded absolute paths (rename fragility)
~8 references to the literal `/home/avi/documents/work/exp-repo/metabob-devbob` (or the `-home-avi-...-metabob-devbob` operator-memory slug). The docker bind mount `-v $(REPO_ROOT):$(REPO_ROOT):ro` *auto-recomputes* (`REPO_ROOT := $(CURDIR)/../..`), so `make run-live` from the new location works — but the hardcoded **defaults/fallbacks** silently point at the old tree:

| File | Kind | Risk |
|---|---|---|
| `scripts/substrate/import-operator-memory.ts` (~L29) | operator-memory slug `-home-avi-...-metabob-devbob` | high |
| `scripts/concept-seed/seed-claudemd.ts` / `.sh` | `REPO_ROOT` fallback default | medium |
| `scripts/substrate/workspace/git/vessels/development-vessel/.../host-container-source-drift-observer.ts` | `HOST_REPO_ROOT` fallback default | medium |
| `.../development-vessel/src/seed/detect-obsidian-vessel-health.ts` | absolute file path | medium |
| `.../concept-db/src/upkeep/vessel-auth-audit-template.json` | grep cmd absolute path | low |
| `.../ias-executor-ts/src/templates/forge/forge-vessel-for-shape.json` | template default | low |

(Most live under the gitignored `scripts/substrate/workspace/git/` writable-clone tree — runtime state, not super-repo-tracked — but they still break the running substrate after a move and violate the invariant.)

## Change — phased, functionality retained throughout

> Hard constraint (from the prior migration): the running substrate stays healthy at every step; verify between phases (`localhost:18080` health + `failure-mode-harness`), not only at the end. The runtime reads from baked-in `/vessels/<name>`, so source moves don't change the running container — but `.gitmodules`, Dockerfile COPY paths, and unit refs move in lockstep.

### Phase 0 — pre-flight safety
- Back up substrate learning state per `docs/SUBSTRATE.md` (SurrealDB + workspace volumes are docker-named, **not** under the root dir, so they survive the `mv` — but snapshot anyway).
- Confirm substrate health; confirm no long-running cutover mid-flight (`scripts/substrate/workspace/mitosis-pending.json` empty).
- Land or stash the current in-flight `goal-target-inference` work into the goal-host-vessel **nested repo** (so it isn't orphaned by the blob-removal in Phase 2).
- Tag the super-repo (`pre-rename-2026-06-25`) for rollback.

### Phase 1 — cruft removal (safe, reversible)
- `git rm`-free deletion of the gitignored loose files (they're untracked): the ~40 root PNGs, both `.opencode-*.log`, `.dockerignore.backup`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `disrupt-application.md`, empty `vault/` scaffolding (keep `vault/README.md` + committed `.obsidian` config per existing gitignore rules), stray `workspace/`.
- Audit `docs/architecture/` and root for stray one-commit writeups / loose tests; relocate any genuine test into its `repos/<vessel>/test{,s}/` home (none found at root so far — confirm during execution).
- Result: a tree that is *only* `repos/` (submodule pointers), `docs/`, `openspec/`, `scripts/`, `packages/`, `.metabob/`, and root metadata — matching the super-repo placement rules in CLAUDE.md.

### Phase 2 — submodule normalization (the 8 core) + drop the 2 product
For each of the 8 (`goal-host-vessel`, `llm-resolver-vessel`, `local-tools-vessel`, `ribosome-vessel`, `boredom-vessel`, `stateful-ui-vessel`, `light-dispatch-vessel`, `metric-collector-vessel`):
1. **Reconcile the nested repo first** — normalize branch to `dev` (`llm-resolver-vessel`, `stateful-ui-vessel`); resolve `local-tools-vessel`'s divergence (rebase ahead-1 onto origin/dev, audit the behind-3); commit any working changes; **push so `origin/dev` contains the HEAD** the gitlink will point at.
2. **Remove the stray super-repo blobs:** `git rm -r --cached repos/<vessel>` (drops the 5–9 plain files from the super-repo index without touching disk).
3. **Register as submodule:** add `[submodule "repos/<vessel>"]` to `.gitmodules` with `url = git@github.com:AviGopal/<vessel>.git`, `branch = dev`; `git submodule absorbgitdirs` / re-add so the super-repo records a `160000` gitlink at the pushed commit.
4. Verify `git submodule status` shows a clean gitlink and `make restart-<vessel>` still hot-reloads.

For the **2 product/UI** (`metabob-internal-dashboard`, `obsidian-vessel`):
- `git rm -r --cached repos/<vessel>`; add to `.gitignore` under the "heavy nested-git checkouts kept on disk, out of git" block (mirrors how `metabob-dashboard` etc. are handled). The on-disk clone stays for anyone who wants it; the substrate repo no longer claims it.
- **⚠ Obsidian coupling — confirm at review:** `obsidian-vessel` is **not** purely product — it's in `Dockerfile.substrate` (the `:obsidian` image flavor), the cutover/mitosis vessel list, the Makefile `run-live-obsidian` target (noVNC :16080), and `setup-git-push.sh`'s push set. Dropping it from the submodule set is fine, **but** we must decide its runtime fate: (a) keep building it into the `:obsidian` flavor from a standalone (gitignored) clone — operator-managed, not substrate-self-managed; or (b) remove it from the Dockerfile/cutover/Makefile entirely. Recommendation: **(a)** — it stays a human surface the substrate doesn't author, exactly the operator/UI boundary, with one gitignore line and no Dockerfile change. This proposal assumes (a) unless you choose (b).

### Phase 3 — the relative-path invariant (de-hardcode)
Introduce a **single anchor** and make everything resolve from it:
- **`SUBSTRATE_ROOT`** env var (host side), defaulting to the git toplevel (`git rev-parse --show-toplevel`) — never a literal path. The Makefile already does this (`REPO_ROOT := $(CURDIR)/../..`); standardize the *name* and propagate.
- **`HOST_REPO_ROOT`** (container→host bridge) keeps its role but its fallback default changes from the literal path to "derive from the bind-mount" or fail loudly rather than silently target the old tree.
- Fix each Bucket-3 site to read `SUBSTRATE_ROOT`/`HOST_REPO_ROOT` (or an activity-template variable) instead of a literal. For `import-operator-memory.ts`, prefer `$CLAUDE_PROJECT_DIR` / query the `memoryNote` resolver directly (the substrate is already the memory source of truth — the file slug is legacy).
- Grep-gate: add a check (extend `scripts/git-hooks/pre-commit`) that rejects any newly-added literal `/home/avi/...` or `metabob-devbob` path in tracked files, so the invariant stays enforced.

### Phase 4 — the rename + move
- With substrate stopped cleanly: `mv /home/avi/documents/work/exp-repo/metabob-devbob /home/avi/documents/work/substrate`.
- Re-point the operator-memory directory (the `~/.claude/projects/-home-...-metabob-devbob/` slug derives from cwd — Claude Code will compute a new slug for the new path; reconcile the memory cache via the idempotent `import-operator-memory.ts` re-run against the substrate, which is authoritative).
- Update `host-sync-poller` systemd user unit symlinks (they point at `$(pwd)/scripts/substrate/...` — re-link from the new root).
- Update any docs/CLAUDE.md references to the path/name (CLAUDE.md describes behavior, but the `Primary working directory` and example paths should reflect `substrate`).

### Phase 5 — container rebuild + verify the self-management loop
- `make -C scripts/substrate build && run-live` from the new root; `seed-live`; `configure-local.sh`.
- Health-probe all host-mapped vessels; run `failure-mode-harness.ts`; dispatch a confirming `mcp__metabob__run_goal`.
- **Prove self-management end-to-end from the renamed root:** `make clone-vessel-repos` into the new `/workspace/git/vessels`, then drive one gap→cutover and confirm a commit lands on `origin/dev` of a converted-submodule vessel via the (now path-agnostic) host-sync-poller.

## Out of scope
- The networking functionality itself (this is the *preparation* for teaching it).
- Transferring the MetabobProject product repos (mcp, dashboards, rpc/analysis) — they stay where they are; only the substrate-core set is normalized.
- The `docker compose up` minimal-surface north star from the prior proposal (still desirable; not gated by this change).
- Rewriting historical traces / runtime JSON that embed the old absolute path (one-shot outputs; harmless, not worth churning).
- Internal-package renames (`@metabob/*` → `@avigopal/*`) beyond what's needed for the submodule conversion — tracked in the prior namespace proposal.

## Risk
- **Submodule conversion is the highest-risk step** (history/divergence). Mitigated by reconciling+pushing each nested repo *before* removing blobs, and by the `pre-rename-2026-06-25` tag. `local-tools-vessel`'s divergence needs explicit triage (don't auto-merge).
- **In-flight goal-host work** could be orphaned by blob removal — Phase 0 lands it into the nested repo first.
- **Operator-memory slug change** on move — the substrate is already the memory source of truth (331 notes in development-vessel), so the file cache slug changing is low-impact; re-run the idempotent import.
- Rollback: `git reset --hard pre-rename-2026-06-25` (super-repo) + `mv` back; named volumes are untouched by any of this.

## Verification
- After Phase 1: tree contains only the allowlisted top-level entries; `du -sh` drops by ~40 MB+.
- After Phase 2: `git submodule status` lists 25 clean gitlinks (17 + 8); `git ls-files repos/<converted>` returns empty; substrate health green; `make restart-<vessel>` works for each.
- After Phase 3: `grep -rn '/home/avi' --include='*.ts' --include='*.sh' --include='*.json' .` (tracked files) returns **zero** hits; pre-commit hook rejects a planted literal path.
- After Phase 4/5: substrate boots from `/home/avi/documents/work/substrate`, full harness passes, and a substrate-authored commit lands on a converted submodule's `origin/dev` — proving self-management survives the move.
