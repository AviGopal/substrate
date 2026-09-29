# Mechanism verdicts: chunk 46 (deployment)

Input: `classes/_mech_chunks/46.json`. It holds 2 collector items in area `deployment`: #0 "PR-based self-deployment (gitOpenPR/gitMergePR/author-pr)" from openspec-2, and #1 "repos/deployment helm/k8s lineage" from git-deployment.

Verified read-only on 2026-09-29 against node 1 (`substrate-live`). I checked four things:

- the live clones `/workspace/git/vessels/{development-vessel,ias-executor-ts,activity-api}` (non-test `src/**/*.ts`: registrations in `config.ts` / `routes/impulses.ts`, seeds in `seed/index.ts`, git history);
- the `execution` table (150,215 rows, about 5 days);
- `raw/live-resolvers.md`, which has task counts for 30 days;
- `/etc/substrate/env`, for token presence only. No values were printed.

**Deduplication:** the two items are distinct mechanisms. Live grep showed that each one still has code in the running fleet that the collector did not see, so I split each into the concept (the item as collected) and its live residue.

**Stale collector claims corrected by live evidence:**
- #0 says the PR path was "never built" and has "0 grep hits". That holds only for the names in the 05-23 proposal (`gitOpenPR`/`gitMergePR`/`author-pr`, 0 hits in live src). The capability **was built** on 2026-06-01 under different names:
  - `e162c68` "replace operator-approval with substrate-internal evaluation gate";
  - `dbd0b8f` "traceable substrate self-merge";
  - `7c41fc8` 06-14 "merge gate computes convergent validity instead of trusting a fabricated score".

  It is registered today as the resolvers `gh_pr_create`, `gh_pr_merge` and `gh_repo_create` (dev-vessel `config.ts:328/333/483`, `routes/impulses.ts:605/607/670`). It is also seeded as four templates in `seed/index.ts`: `evaluate-pr-via-internal-idioms`, `publish-substrate-authored-artifact`, `scaffold-and-publish-vessel` and `vessel-scaffold-trigger-tick`. **Never call the PR path "new" or "unbuilt".**
- #1 says the lineage is confined to `repos/deployment`. That is wrong: k8s residue is still live in ias-executor-ts (`src/resolvers/helmfile-sync.ts`, `src/adapters/helmfile-adapter.ts`, `src/examples/vessel-forge-host.ts`, `ports.ts:163`). The unit comment `scripts/substrate/units/surrealdb.service:12` points at `repos/deployment/charts/surrealdb`, a path that no clone of origin/dev has.

## Discoverability and archive convention

A kept mechanism is discoverable in one of two ways:
- it is a registered resolver shape advertised through discovery; or
- it is a seeded activity Thompson can select, plus a concept-db concept the drafter recalls.

Fossils go to `archive/fossils/<repo>/<name>` in the super-repo: a tombstone plus a pointer to the last commit. Their activity rows are retired via the retire primitive (19ae84e). Nothing is deleted from history.

## Verdict table

| # | mechanism | verdict | used now | live evidence (2026-09-29) | discoverable via / archive at |
|---|---|---|---|---|---|
| 1 | **PR-based self-merge as the landing path**: `gh_pr_merge` plus the `evaluate-pr-via-internal-idioms` template (collector #0; the proposal names `gitOpenPR`/`gitMergePR`/`author-pr` are the same thing) | **fossil** (as a landing path), superseded by the edit-intent → `feature_compose` → `vessel_mitosis_cutover` → `git_push` origin dev path | no | `gh_pr_merge` is listed among "unseen registered shapes (no traced output in 30 d)" (`raw/live-resolvers.md:195`). There are 0 `execution` rows whose activity_id contains `merge`/`publish`/`scaffold`. The real landing volume goes elsewhere: `vessel_mitosis_cutover` 24,715 tasks and `git_push` 65 (6 ok). openspec-2 marks `2026-05-23-substrate-self-deployment` as 0/36, SUPERSEDED. | Archive `gh-pr-merge.ts` and `seed/evaluate-pr-via-internal-idioms.ts` to `archive/fossils/development-vessel/pr-self-merge/` (last commit `7c41fc8`). Retire the template row and unregister the shape. **Carry forward one idea as a concept, not code:** `deriveConvergentValidity`, which says a gate must *compute* its evidence from objective deltas and never accept a self-reported score. That is the same class as "a channel's own reporting is not evidence about it". It belongs as a concept-db concept attached to the mitosis cutover landing gate. |
| 2 | **`gh_pr_create` + `gh_repo_create` + `scaffold-and-publish-vessel` / `vessel-scaffold-trigger-tick` / `publish-substrate-authored-artifact`**: the PR used as a **safety terminus for new-vessel and new-artifact publication**, not for routine landings (residue of #0) | **keep-specific** (dormant) | barely: `gh_pr_create` 1 task in 30 d, the templates 0 executions in the 5-day window | Registered and seeded (above). The API calls go to `api.github.com` via fetch, so no `gh` binary is needed. `GITHUB_TOKEN` is set in `/etc/substrate/env`; `GH_TOKEN` is unset. `publish-substrate-authored-artifact` got substrate-authored repairs on 09-15 (`68fe034`, `77e419a` via mitosis cutover). It is the only producer of a *new repo* (`gh_repo_create`). That matters because authorability equals submodule membership, and three resident vessels (human-surface, clock, relevance-sink) sit outside the loop for lack of a repo (memory 09-22). | Already discoverable as registered shapes and seeded templates. Law 3: when the "vessel has no repo" class recurs, route it to this producer and do not mint a new one. Unverified: whether the token can create repos or PRs on the remote (no live PR in 30 d). The first real use is the falsifier. |
| 3 | **`repos/deployment` helm/k8s lineage** (collector #1) | **fossil** | no | Gitignored (`.gitignore:204 /repos/deployment/`). The host copy's last commit is `ee47500` 2026-06-25, and it is not among the 19 live vessel clones. It was superseded by `fe7dd493` "single-container fleet with systemd PID 1" (law 11: image + env + volumes). | It already lives out of tree. Add a tombstone `archive/fossils/deployment/README` pointing to `ee47500` and `fe7dd493`, and fix the dangling pointer in `surrealdb.service:12`. The block-cache sizing rationale should move into the unit comment itself. That fix is docs-drift work (the docs-align loop), not hand-absorbed. |
| 4 | **ias-executor-ts k8s forge residue**: `helmfile-sync` resolver, `BunHelmfileAdapter`, `examples/vessel-forge-host.ts`, `HelmfilePort` (residue of #1) | **fossil** (duplicate of the existing `codebase-bloat-fossils` entry "k8s-era ias-executor resolvers") | no | Last touched `5f01e58` 2026-05-21. It is referenced only from `examples/` and the adapter barrel, and not constructed by `hosts/goal-host.ts`. Neither `helmfile` nor `kubectl` exists in the container. There are 0 executions. activity-api `routes/activities.ts:4119` already records the removal of `helmfile_sync`/`docker_build_push`/`scaffold_vessel_skeleton` from the catalog (F-139). | `archive/fossils/ias-executor-ts/k8s-forge/` (pointer `5f01e58`). Fold it into the codebase-bloat-fossils class; do not open a new gap. Keep the `forge/forge-vessel-for-shape.json` template decision with whoever judges the forge chunk, since it is restored minibob code and not k8s. |

## Summary

The deployment area has two fossils and one dormant specific capability that is easy to mistake for a fossil.

- The PR-as-landing-path idea was built on 06-01 (`gh_pr_merge`, with an evidence-computing merge gate) and then abandoned for direct mitosis-cutover landing. Archive the self-merge path, but keep its "computed evidence, never self-reported" rule as a concept on the cutover gate.
- The same PR plumbing survives as the only new-repo and new-vessel publication producer (`gh_repo_create`, `gh_pr_create`). Keep it, because the authorability gap needs it.
- The helm/k8s lineage is dead in both places it lives: `repos/deployment`, and the ias-executor helmfile resolvers. It survives only as a dangling comment in `surrealdb.service` and as k8s URLs in docs (docs-drift class).
