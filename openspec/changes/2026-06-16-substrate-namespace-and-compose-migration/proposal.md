# Substrate namespace + naming migration → docker-compose surface

> Status: proposed (2026-06-16). Prerequisite for the direct-push keystone
> of [`2026-06-16-substrate-self-persistence-and-direct-push`](../2026-06-16-substrate-self-persistence-and-direct-push/proposal.md):
> the substrate cannot push authored code to repos that don't exist, and 9
> substrate-required vessels currently have no git remote at all.

## North star

A **pre-built substrate container image + a `docker-compose.yml`** is the
**minimal surface required to start** a functional substrate. No host
Makefile, no `docker cp` hot-reload, no host bind-mount of `repos/`, no
operator `gh` apparatus. `docker compose up` → working substrate.

## Organizing principle (operator-confirmed 2026-06-16)

- **AviGopal namespace = the substrate.** Everything required for the
  substrate to run autonomously. Drop the `metabob` name (repos *and*
  internal packaging). All repos **private**.
- **MetabobProject namespace = the metabob *product*.** mcp, dashboards,
  rpc/analysis APIs. Keep the `metabob` name. The one explicit exception
  to the drop: **`metabob-mcp` keeps its name** (product/IDE surface).
- Scope is gated by the north star: a repo is in scope **iff** it is
  required for `docker compose up` of the image to yield a functional
  substrate. Everything else is out of scope (see Table B in the parent
  conversation / `tasks.md`).

## Hard constraints

1. **Functionality retained throughout.** The running substrate must stay
   healthy at every step. Transfers and remote-splits are additive; the
   runtime reads from baked-in `/vessels/<name>`, so source-namespace moves
   do not change the running container — but `.gitmodules`, Dockerfile COPY
   paths, and unit references must move in lockstep and be smoke-checked.
2. **Verify between phases** (substrate health + harness smoke at
   `localhost:18080`), not just at the end.

## In-scope set (Table A — finalized)

16 substrate-required repos → all AviGopal, private:

- **Already AviGopal (3):** development-vessel, analysis-vessel,
  ias-executor-ts.
- **Transfer from MetabobProject (5):** metabob-activity-api → **activity-api**
  (rename; runtime unit already `activity-api`), identity-vessel,
  discovery-vessel (both normalize lowercase `metabobproject` casing),
  concept-db, cpg-inference-ts (build dep of analysis-vessel, confirmed).
- **Split out → new private AviGopal repos (9, no `.git` today):**
  goal-host-vessel, llm-resolver-vessel, local-tools-vessel, boredom-vessel,
  ribosome-vessel, metric-collector-vessel, light-dispatch-vessel,
  stateful-ui-vessel, obsidian-vessel.

Infra (surrealdb, valkey) = compose services, not repos.

## De-metabob internal-packaging renames

- `metabob-activity-api` repo/dir → `activity-api` (Dockerfile COPY,
  .gitmodules path/url, super-repo references).
- `@metabob/cpg-inference` → `@avigopal/cpg-inference`; update
  analysis-vessel's `file:../cpg-inference-ts` dependency name.
- **obsidian-vessel** internal packaging (~20 files): `manifest.json`
  `id=metabob-vessel`/`name=Metabob Vessel`, `package.json`, `data.json`,
  and source refs. **Consequence:** changing the Obsidian plugin `id`
  changes its vault folder (`vault/.obsidian/plugins/metabob-vessel/`) —
  existing installs need a one-time re-init. New id TBD (`substrate-vessel`
  proposed).

## Removals (junk, not substrate-required)

`vessels` (empty dir), `clock-vessel` (unused; keep only if we want a
minimal-conformant example), `activity-monitor` (non-git dup of
activity-dashboard).

## Out of scope

All of Table B (product surfaces in MetabobProject; frontends; operator
tools; Helm/k8s path; proto). Not in the substrate image, not migrated by
this change.

## Relationship to the parent change

This change delivers the *namespace + remotes + compose surface*. The
parent change delivers *self-persistence + in-container authenticated
push*. Phase 2 ("environment independence") of the parent is realized by
this change's docker-compose deliverable. Sequence: this change's M0–M2
(remotes exist + namespace clean) unblock the parent's Phase 1
(direct-push targets exist).
