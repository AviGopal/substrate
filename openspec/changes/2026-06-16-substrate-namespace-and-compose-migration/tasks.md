# Tasks — runbook (functionality-preserving order)

## M0 — Create remotes (additive, zero runtime impact)

- [x] M0.1 Created 9 private AviGopal repos (2026-06-16): goal-host-vessel,
      llm-resolver-vessel, local-tools-vessel, boredom-vessel,
      ribosome-vessel, metric-collector-vessel, light-dispatch-vessel,
      stateful-ui-vessel, obsidian-vessel.

## M1 — Split-out (local trees → own repos)

> Review verdict (2026-06-16): GO-WITH-FIXES. Fixes applied — `.gitignore`
> written BEFORE `git add` (6 dirs had 30–46M node_modules + no ignore);
> node_modules + secret gate before push; `git rm --cached` (NOT `deinit`)
> for the eventual conversion. **M1.2 DEFERRED** per review — submodule
> conversion is highest-blast-radius and the parent change only needs
> remotes to exist, which M0+M1.1 deliver.

- [x] M1.1 Done (2026-06-16): per-dir `git init -b main`, gitignore-first,
      node_modules+secret gate, commit, push to `AviGopal/<name>`. All 9
      pushed (5–9 files each; obsidian 94; obsidian `data.json` excluded as
      runtime state). Script: `$CLAUDE_JOB_DIR/tmp/m1_split.sh`.
      NOTE interim state: nested `.git` now exists in each `repos/<v>`;
      super-repo still tracks them as plain trees (resolved at M1.2).
- [ ] M1.2 **DEFERRED.** Convert super-repo tracking direct tree → submodule:
      `git rm -r --cached repos/<name>` (NOT `submodule deinit` — not a
      submodule yet), `rm -rf repos/<name>/.git`, `git submodule add -b main
      git@github.com:AviGopal/<name>.git repos/<name>`. Same path → Dockerfile
      COPY + `/vessels/<name>` unaffected. Roll back per-dir with
      `git rm -r --cached` + drop `.gitmodules` entry + `git checkout`.
- [x] M1.3 Smoke gate PASSED (2026-06-16): container Up 38h; activity-api
      `:18080`, dev-vessel `:18090`, goal-host `:18210` all healthy. M1.1
      confirmed runtime-inert.

## M2 — Transfer + rename the MetabobProject substrate repos

> Split executed 2026-06-16: namespace consolidation (low-risk) done now;
> build-affecting internal renames deferred to M2.5 (see below). Reason:
> `repos/metabob-activity-api` is a DIRTY submodule (uncommitted
> `M src/routes/activities.ts` + untracked migration `136`, ahead of
> recorded pointer) — its local work must be committed/pushed before a
> directory rename, and the reviewer wants the rename as an isolated,
> build-validated atomic commit.

- [x] M2.1 Transferred to AviGopal (all PRIVATE, redirect-backed):
      identity-vessel, discovery-vessel, concept-db, cpg-inference-ts.
- [x] M2.2 Transferred + renamed metabob-activity-api →
      `AviGopal/activity-api` (GitHub side).
- [x] M2.3a `.gitmodules` URLs → canonical AviGopal for all 5; paths
      unchanged; `git submodule sync` done; SSH reachability verified.
      Super-repo working tree: only `.gitmodules` modified. Substrate
      healthy throughout (runtime-inert).
- [ ] M2.3b **DEFERRED to M2.5** — directory rename
      `repos/metabob-activity-api` → `repos/activity-api`.
- [ ] M2.4 Update `Dockerfile.substrate` COPY for activity-api path; grep
      `repos/metabob-activity-api` (review: ~690 refs, but only 5 are
      runtime/load-bearing — `Dockerfile.substrate:83-88`, `.gitmodules`,
      `.github/workflows/deploy-activity-api.yml:7,58`,
      `scripts/check-shape-dispatch-all.sh:16`,
      `scripts/concept-seed/seed-claudemd.ts:59`; rest are docs/openspec,
      lag-tolerant). **Single atomic commit** for the 5 + the `git mv`.
      ⚠ the CI `paths:` trigger silently stops firing until `:7`/`:58`
      update even though k8s is "out of scope."
- [~] M2.5 **De-metabob packaging (build-affecting — one atomic commit + build smoke-test).** IN PROGRESS 2026-06-16.
      Precondition DONE: activity-api local work committed (`f305a12` trace-store
      viability guard, `5b47b6d` migration 136) + pushed to `AviGopal/activity-api`
      dev; submodule clean.
      Edits applied + verified (build validating via `:m2-validate` background build):
      - [x] `git mv repos/metabob-activity-api → repos/activity-api`; `.gitmodules`
        path+section+url all consistent; `git submodule sync` done.
      - [x] `Dockerfile.substrate` COPY (5 lines) + comment → `repos/activity-api`.
      - [x] `scripts/check-shape-dispatch-all.sh`, `scripts/concept-seed/seed-claudemd.ts`
        → `repos/activity-api`.
      - [x] `.github/workflows/deploy-activity-api.yml:7,58` → `repos/activity-api`
        (k8s resource/image names left — product/canary, separate migration).
      - [x] `@metabob/cpg-inference` → `@avigopal/cpg-inference` in
        cpg-inference-ts/package.json + analysis-vessel package.json dep key + src/index.ts import.
      - [ ] **obsidian-vessel plugin-id rename DEFERRED** — build-independent
        (obsidian is `.dockerignore`'d, not in image) + carries vault folder
        `git mv` + one-time re-init. Tracked as its own follow-up.
      - [ ] On build green: commit cpg-inference-ts + analysis-vessel submodules
        (+push), then the super-repo M2.5 atomic commit (.gitmodules, Dockerfile,
        scripts, workflow, submodule pointers).

      <details><summary>original M2.5 plan</summary>
      - `git mv repos/metabob-activity-api repos/activity-api` (+ `.gitmodules`
        path/section, `git submodule sync`).
      - `Dockerfile.substrate:83,85,86,87,88` COPY paths → `repos/activity-api`.
      - `scripts/check-shape-dispatch-all.sh:16`,
        `scripts/concept-seed/seed-claudemd.ts:59` → `repos/activity-api`.
      - `.github/workflows/deploy-activity-api.yml:7,58` path refs →
        `repos/activity-api` (leave k8s resource/image names — product/canary,
        separate migration).
      - `@metabob/cpg-inference` → `@avigopal/cpg-inference` in
        `repos/cpg-inference-ts/package.json` + analysis-vessel dep ref +
        `src/index.ts` import.
      - obsidian-vessel manifest/package/data/source de-metabob (plugin-id
        `metabob-vessel` → TBD; needs vault folder `git mv` + one-time re-init).
      Validate: `docker build -f Dockerfile.substrate` green before commit.
      </details>
- [ ] M2.6 Smoke gate (health + harness + a `minibob --single` dispatch
      lands a trace). **Gate before M3.**

## M3 — docker-compose minimal surface

- [ ] M3.1 Author `docker-compose.yml`: substrate image + surrealdb + valkey
      as services; named volume for `/workspace` (state via the parent
      change's Phase-0 bundle, not a host bind-mount); env via `.env` /
      compose secrets (ANTHROPIC_API_KEY, SUBSTRATE_GIT_PAT).
- [ ] M3.2 Remove host-coupling from the start path: no `docker cp`
      hot-reload requirement to *run* (dev hot-reload becomes optional, not
      load-bearing); ports parameterized.
- [ ] M3.3 Build + publish the substrate image to a registry (private).
- [ ] M3.4 **Acceptance:** on a clean checkout (or second machine), `docker
      compose up` with only the image + compose + `.env` yields a healthy
      substrate that restores state from the Phase-0 bundle. No Makefile,
      no host `repos/` mount.

> Review-flagged gaps to close before M3.4 can pass:
> - **3 substrate-required vessels are NOT in the image today** —
>   obsidian-vessel (`.dockerignore`'d), light-dispatch-vessel,
>   metric-collector-vessel are never COPY'd in `Dockerfile.substrate`;
>   they're host/vault/systemd-cp'd. Add them to the Dockerfile (or formally
>   declare host-side/optional) or `docker compose up` won't be functionally
>   complete.
> - **`file:../ias-executor-ts` coupling** — goal-host, llm-resolver,
>   local-tools, ribosome depend on the sibling lib via relative path
>   (Dockerfile sed-rewrites to `/vessels/...` at build). These repos are
>   NOT independently buildable from a bare clone; don't claim per-repo
>   standalone build in M3.4. Decide: publish ias-executor-ts to a registry
>   (`@avigopal/ias-executor-ts`) or vendor it.

## Removals

- [ ] R.1 Remove `vessels/` (empty), `activity-monitor/` (dup). Decide
      `clock-vessel` (keep as minimal example vs remove).

## Cross-cutting

- [ ] X.1 Update super-repo `.gitmodules`, `CLAUDE.md` repo references, and
      `repos/deployment` notes to reflect renames (docs can lag runtime but
      must not contradict it).
- [ ] X.2 Confirm `gh` has create/transfer rights on AviGopal +
      MetabobProject (operator is admin on both).
- [ ] X.3 metabob-mcp explicitly NOT renamed/moved (product surface).
