# Mechanism verdicts: chunk 30 ("obsidian-vessel": the second-generation human surface)

Input: `classes/_mech_chunks/30.json`, which holds 16 collector items in area `obsidian-vessel`.

All checks were read-only, run on 2026-09-29 between about 05:10 and 05:30 UTC:

- **Node 1 (`substrate-live`, standalone).** I read the live clones `/workspace/git/vessels/{obsidian-vessel,human-surface-vessel,development-vessel}`, the systemd timers and journals, `/usr/local/bin/obsidian-*-tick.sh`, the pool file `/workspace/git/super-repo/pool/standing.json`, the gap store `/workspace/git/super-repo/gaps/gaps.json` (6,293 rows), and the `execution` table.
- **Super-repo.** I grepped `scripts/substrate/federation-relay/`, `scripts/substrate/Makefile` and `README.md`.
- **Class history.** I checked `classes/human-surface-escalation.json`, `dormant-mechanism.json`, `sync-deploy-drift.json` and `codebase-bloat-fossils.json`.

**Context from the class history.** `human-surface-escalation` records three generations of the human surface:

1. workbench, 04-22 to 05-24
2. **obsidian-vessel, 06-15 to 08-22**
3. human-surface-vessel, 09

The recorded outcome is "rebuilt the surface twice". In the obsidian-vessel clone the last commit is `1bd0226`, dated 2026-08-22. The clone has 371 commits: 194 by Substrate Autonomous, 176 by DevBob Assistant, and 1 by Devbob Agent. The recurring failure in this area is **supersession without migration**. The new surface replaced the old one, but the mechanisms that were *keyed to the old surface's shape* (`obsidian:note`) were never re-keyed. So they now skip or starve silently, and some of them sit in the core loop.

**Dedupe.** The 16 items reduce to **9 collector mechanisms plus 1 derived (M10)**. Items are cited as `#n`, the item's index in the chunk.

## Stale collector claims corrected by live evidence

- **#13 "2,586 dead ticks reporting success".** The count is still right: the intake tick logged 2,585 `SKIPPED` lines in the last 7 days. The claim that the ticks lie is stale. `fb598747` (09-16, "ask whether the human surface is there before working for it") turned them into an honest presence-guarded idle that exits 0. The journal today (05:14:53) reads `SKIPPED: no vessel advertises obsidian:note — the human surface is not connected.` The real defects are elsewhere (see M1 and M10).
- **#5 "obsidian_verify_output / assist feedback scan unregistered (06-22)".** Both are now registered in `development-vessel/src/config.ts:705-707`, with route cases at `routes/impulses.ts:936-942`. What is true is that they are *unexercised*. `raw/live-resolvers.md` lists 9 `obsidian_*` dev-vessel shapes with no traced output in 30 days.
- **#7 "0/194 autonomous commits reached main.js".** This still holds in substance. Nothing in the image or compose rebuilds `main.js`, which is the `sync-deploy-drift` symptom "obsidian bundle never rebuilt". Separately, super-repo `c0e42fa3` (08-09) moved the obsidian-vessel pointer *backwards*, `3364d47` to `aa4ae90`.

## New finding, with no gap in the store: the presence gate is keyed to the replaced surface

This finding is not a collector item. It is the load-bearing consequence of #0/#13/#15, and I verified it live.

- **The gate.** `development-vessel/src/resolvers/rhythm-conductor-tick.ts:257-264` asks discovery for `vesselCapability shape:"obsidian:note"`. Line `:291` then makes every rhythm with `axis === "presence"` affordable only when some vessel advertises that shape.
- **Who serves the shape.** `human-surface-vessel/src/index.ts:242-247` *answers* `obsidian:note`, returning an honest empty note, but it does not advertise it. Every obsidian tick today confirms the shape is unadvertised.
- **Which families this starves.** The two presence-axis rhythm families in the pool have **the best posteriors in the pool**, yet neither has been touched since **2026-09-27 01:06**:
  - `human-interacting`: α13/β1, budget 0.5
  - `view-exercise`: α17/β1, budget 0.35

  For comparison, `gap-closing` is α67/β23 and `validation` is α1/β11.
- **The goal text is also stale.** The family goal text (`rhythm-conductor-tick.ts:129,154-156`) still says "check obsidian presence … place pending docs decisions in the vaults … Substrate/Decisions" and "capture a ui_screenshot of the goal-dispatch panel". Both address the Obsidian vault, not the live surface.
- **No gap tracks this.** Of the 17 open gaps whose id contains `obsidian` or `presence`, none names this gate. The nearest is `the-substrate-cannot-see-its-own-human-surface-because-the-image-has-no-browser-and-the-legibility-scan-reads-obsidian`, which is the same class (a consumer still reading the replaced surface).

The class is "a consumer pinned to a peer's *old* shape cannot learn the peer was replaced". It is the same class as the 248 escalations posted to the replaced `:8270` (memory, 09-22).

## Discoverability and archive convention

- A mechanism is **discoverable** only if one of these holds:
  - it is an advertised resolver shape (discovery `vesselCapability`);
  - it is an activity row that Thompson can select;
  - it is a pool rhythm family;
  - it is a concept-db concept that the drafter recalls.

  A systemd timer running a bash script is none of these (law 2).
- **Fossils** go to `archive/fossils/obsidian-vessel/<name>/` in the super-repo, with a pointer to the last commit. Their timers are disabled and their activity rows are retired via the retire primitive (`19ae84e`). Nothing is deleted.
- The obsidian-vessel **repo itself** stays a submodule. `README.md:318-324,461` still documents it as the human install path, so that README text is owed a docs-align pass (see M4).

## Verdict table

| # | mechanism (collector items) | verdict | used now | live evidence (2026-09-29) | discoverable via / archive at |
|---|---|---|---|---|---|
| M1 | **obsidian-intake / learn / collaborate timers + tick scripts** (`scripts/substrate/obsidian-{intake,learn,collaborate}-tick.sh` → `/usr/local/bin`) (#0, #13, #15) | **fossil** | no (runs, always skips) | The timers are `active waiting`, every 2 min, 30 min and 45 min. The last intake run was 05:14:53 and ended `SKIPPED`: 2,585 of 2,585 runs in 7 days. The presence probe goes through discovery (good). But the *work* is sent to an env-pinned host port: `OBS="${OBSIDIAN_PLUGIN_ENDPOINT:-http://127.0.0.1:27182}"` (`intake:27`, `collaborate:21`, `learn:11`). So even a vault that advertised `obsidian:note` over p2p from another node would be called on localhost. That breaks law 1, law 11 and "never hardcoded ports". Behaviour lives in systemd and bash, not in activities (law 2). The intent (human inbox, then answer or dispatch) is duplicated by the `human-interacting` rhythm family and by human-surface `solicitation.ts` / `participation-journal.ts`. | Disable the 3 timers. Archive the 3 scripts to `archive/fossils/obsidian-vessel/ticks/` (last change `fb598747`). The inbox-to-dispatch intent lives on as the `human-interacting` rhythm family once M10 is fixed. |
| M2 | **Launch lanes** (`make up`, `run`, `run-live`, `run-live-obsidian`, root compose, `deploy-remote`, `deploy-hub`, `deploy-hub-pull`, cluster compose) (#1) | **merge-into** a single compose lane | yes (several) | These are present in `scripts/substrate/Makefile:356` (run), `:440` (up), `:567` (run-live) and `:651` (run-live-obsidian, which boots the `substrate-obsidian` image with a noVNC Obsidian and *reuses the `substrate-live` name*). Also present: `docker-compose.yml` and `scripts/substrate/deploy-{remote,hub,hub-pull,analysis-backend}.sh`. The only obsidian-specific part is the in-container GUI image. The class history (`human-surface-escalation`, 07-15) records "in-container Obsidian GUI dead", so the vault write could not be verified. | Target: one compose lane with profiles (reports-7). Owned by the deployment chunk. Fold `run-live-obsidian` in as an optional image tag; do not keep it as a parallel lane. |
| M3 | **`fed-federated-resolve.ts`, `fed-resolve-client.ts`, `obsidian-passthrough.ts`** (`scripts/substrate/federation-relay/`) (#2, #14) | **fossil** | no | A grep of the super-repo for these basenames (excluding `validation/reports`) finds only their own `.ts`/`.d.ts` self-references and a usage comment (`obsidian-passthrough.ts:19`). No Makefile, unit or script invokes them. `obsidian-passthrough` was superseded by the plugin-spawned sidecar (`src/sidecar-manager.ts` → `sidecar/federation-sidecar.ts`). The general capability, resolving a shape across peers, lives in `@avigopal/libp2p-federation-transport` (`resolveViaLibp2p`), which `federation-transport-server.ts:11` imports. | Archive to `archive/fossils/federation-relay/ad-hoc-clients/`, together with their `.js`, `.d.ts` and `.map` build outputs (committed compile residue). This follows the script-retention rule in CLAUDE.md. |
| M4 | **Obsidian plugin runtime: `main.js` bundle and panel features** (self-explanation, DAG, grade panel, grounding badge `81a1c41`) (#3, #7, #11) | **keep-specific (frozen)** | no (on this node) | The clone has `main.js`, `manifest.json`, `install.sh` and `esbuild.config.mjs`, last commit `1bd0226` (08-22). `obsidian_deliver_assist` was last traced 09-19 (`raw/live-resolvers.md:71`). No unit runs on the hub, and nothing listens on host `:27182`. The live surface is human-surface-vessel (`bb7b8dc`, 09-27, a substrate-authored commit). The plugin is still the **documented** way for a human to connect a vault (`README.md:318-324,461`). Under the decentralization rule, absence on this node does not prove that no vault connects elsewhere. But nothing in 30 days shows one did (0 advertisements of `obsidian:note`). | Keep it installable and frozen. **Stop developing it** (the class failure is "rebuilt the surface twice"). Two things are owed: (a) the README should say it is an optional secondary surface and that human-surface-vessel is primary (docs-align); (b) if kept, the bundle build must happen at install, not by the operator by hand (`sync-deploy-drift`). It becomes discoverable only when a vault's sidecar advertises `obsidian:note`. |
| M5 | **Obsidian libp2p federation sidecar** (`sidecar/federation-sidecar.ts`, 711 lines, last change `ff49722` 07-30; 4ae5ba0 + ~30 fixes) (#8, #12) | **keep-specific** (goes with M4); owner-merge logic → **merge-into** `libp2p-federation-transport` | no | `sidecar/package.json` depends on `@avigopal/libp2p-federation-transport`, so the transport itself is already shared. What duplicates the transport server's ingress is the sidecar's own ingress and owner-merge code. Neither this node nor node 2 has a sidecar peer advertising `obsidian:note`. | It is the only p2p conduit for an external vault, so keep it with M4. Move the owner-merge and ingress logic into the transport package, so that any surface (not only Obsidian) can join a remote hub with the same code. Concept: `surface-p2p-conduit`. |
| M6 | **Client-side presentation bandits: `presentation-policy.ts` Thompson + attention→reward presentation arms** (`src/presentation/{presentation-policy,presentation-arms,attention-grader}.ts`, e6206e9) (#4, #6) | **duplicate-of** human-surface form learning | no | The live successor is `human-surface-vessel/src/form-learn.ts` (answered → success, complained → failure, never-shown moves nothing, bounded step), together with `importance-learn.ts` and `form-census.ts`. The obsidian arms were a workaround for the spoke constraint (reports-4: "do not port"). The 07-27 loop closed once with a real human, but per-human conditioning stayed frozen (cts frozen). | Archive with M4 (no separate move). **One thing is not yet ported:** `attention-grader.ts`, which grades from trusted attention, a signal that form-learn does not consume. Record it as concept `attention-as-presentation-evidence` for the drafter, not as code. |
| M7 | **`obsidian_verify_output` / `obsidian_assist_feedback_scan`** (dev-vessel resolvers) (#5) | **fossil** (bound to the surface); the idea → **merge-into** the human-surface participation grading | no | Registered at `config.ts:705-707` and `routes/impulses.ts:936-942`. No traced output in 30 days. Both read Obsidian vault notes (assist responses and reactions), which no live surface writes. Reaction grading now lives in human-surface `participation-journal.ts` → `importance-learn` / `form-learn`. | Retire the two shapes from `config.ts` together with the other 7 unseen `obsidian_*` shapes (`raw/live-resolvers.md:195`). Archive to `archive/fossils/obsidian-vessel/dev-vessel-resolvers/`. Do this through a single goal per file (law: one file per goal). |
| M8 | **Obsidian `solicitation_id` stamping** (`src/main.ts`, `src/solicitations/solicitation-manager.ts`, `src/resolvers/{observe-obsidian-events,group-interaction-episodes,observation-types}.ts`) (#9) | **merge-into** human-surface `solicitation.ts` / `importance-learn.ts` | no | The obsidian side is dormant with M4. The live side already stamps `solicitation_id` (`importance-learn.ts`: 2 references) and owns `solicitation.ts`. The dev-vessel seeds `observe-obsidian-events` / `group-interaction-episodes` / `probe-obsidian-action-effects` are recorded as `superseded` in `dormant-mechanism` (#53 unwired them on purpose). They carry an open gap, `template-input-lint-development-vessel_probe-obsidian-action-effects`. | No port is needed, because the attribution idea already lives in human-surface. Archive with M4, and retire the three seed templates and their gap together. |
| M9 | **Obsidian concept-db sync / writeback / canvas** (`src/sync`, `src/canvas`, `src/concept-db-client.ts`) (#10) | **fossil** (note: the capability is *absent* everywhere, not superseded) | no | The openspec acceptance probes were never ticked. `grep concept` over `human-surface-vessel/src` returns nothing. So the collector's "superseded by human-surface-vessel" is wrong: **no live surface gives a human the concept graph.** | Archive to `archive/fossils/obsidian-vessel/concept-graph-frontend/`. If the concept graph for humans is needed, it should be a human-surface panel over the concept-db shapes, *reached through discovery*. Do not revive the vault sync. Do not open a gap without demand evidence (law 7). |
| M10 | **Presence gate in the rhythm conductor, keyed on `obsidian:note`** (`rhythm-conductor-tick.ts:257-291`, plus the family goal text at `:129,154-156`) (not a collector item; it is the consequence of #0/#13/#15) | **broken** | yes (in path; starves 2 families) | Presence is decided by `vesselCapability shape:"obsidian:note"`, and no vessel advertises that shape. So `human-interacting` (α13/β1) and `view-exercise` (α17/β1), the two strongest posteriors in the pool, have been unaffordable since 09-27 01:06. human-surface-vessel answers `obsidian:note` (`index.ts:242`) but does not advertise it. No open gap names this. | **keep-general once re-keyed.** Presence should be "some vessel advertises a human-surface shape" (for example `human_surface_presence` or the surface's own solicitation shape), not a surface brand. Rewrite the family goals to address human-surface panels. File it as a gap with `edit_site = development-vessel/src/resolvers/rhythm-conductor-tick.ts` and a class-2 predicate: *a presence-axis rhythm is affordable while human-surface-vessel `/health` is up*. Concept: `presence-by-surface-role-not-brand`. |

## Residue in the same area (not collector items; noted for the activity-retire pass)

These are the obsidian-keyed rows of the `execution` table (activity id → executions / successes):

| activity id | executions | successes |
|---|---|---|
| `learned-composition-problem-detection-to-obsidian-write-note` | 35 | 0 |
| `satisfier:obsidian:note with project list content` | 25 | 0 |
| `learned-composed-cap-produce-shape-obsidian-fleet-health-pane` | 2 | 0 |
| `gap-closing:responsibility-obsidian-vessel-capability-…` | 1 | 0 |
| `detect-unclassified_failure_…obsidian…` (2 rows) | 45 and 42 | all |

Other residue:

- `raw/live-activities.md` also lists 59 `Obsidian Assist Active Note Delivery` variants and 16 gap-closers emitting `obsidian:*` that never ran.
- The gap store holds open gaps for them: `poison-obsidian-note-with-project-list-content`, `poisson-…` (a misspelled duplicate), `orphaned-capability-obsidian:{ui_screenshot,vessel_count}`, and `runtime-source-truncated-obsidian-vessel`.
- The flapping self-fact-divergence family is also open: `self-fact-divergence-{fleet-inventory-copy,authoring-root}-obsidian-vessel*`, with reopen counts 24 and 23, plus `-narrowed`, `-step-1` and 2 `recommit-*`. It was re-stamped class2 at 04:23, 04:51 and 05:10 today.

All of these should be retired together with M4 and M7, as one disposition: *the surface is frozen, so its demand is not a gap*. Otherwise the gap store keeps re-deriving work for a surface nobody develops.

## What to keep, in one line

Nothing obsidian-specific is general. Two things carry forward:

1. The **human-surface p2p conduit** (M5's logic, moved into the transport package).
2. The **presence gate** (M10, re-keyed from brand to role).

Everything else is either frozen (the plugin, still installable) or archived. The attribution and presentation learning ideas already live in human-surface-vessel (`form-learn.ts`, `importance-learn.ts`, `solicitation.ts`).
