# Chunk 44 — area: metabob-cloud-dashboard (product-era repos)

Source chunk: `classes/_mech_chunks/44.json` (3 items, from git-small, memory-adjacent, vessel-docs-tooling).
Verified 2026-09-29, read-only, against the super-repo checkout and `substrate-live`.

## Dedupe

All three items describe one thing. It is the set of pre-substrate, product-era repositories left in
`repos/`: gitignored (`.gitignore` lines 204-210), absent from `.gitmodules`, and not part of the
live clone set. Item 2 (`metabob-cloud-dashboard`) and item 3 ("fossil K8s repos") are subsets or
supersets of item 1. They merge into **one mechanism, "product-era repo directories"**, with seven
members:

| member | last commit | .md files | superseded by |
|---|---|---|---|
| deployment | ee47500 2026-06-25 | 158 | image + systemd units (`scripts/substrate/units`), profile system |
| workbench | e045a2d 2026-05-24 | 29 | cockpit (metabob-mcp) / human-surface-vessel |
| terminal | b777ee1 2026-04-30 | 14 | — (no reader) |
| react-renderer | 8ccf842 2026-04-30 | 4 | stateful-ui-vessel / human-surface-vessel |
| user-vessel | 4f71df7 2026-05-28 | 3 | identity-vessel + discovery/libp2p federation |
| metabob-cloud-dashboard | 3f5e35e 2026-08-17 | 7 | metabob-dashboard (a separate repo, not in `repos/`) |
| conversation-vessel | b250011 2026-05-22 | 1 | llm-resolver-vessel (`llm_completion`) |

## Liveness evidence

- `substrate-live:/workspace/git/vessels` holds 19 clones. None of the seven is among them.
- `systemctl list-units --all` matching conversation|user-vessel|dashboard|renderer|workbench returns
  **0** units.
- In the live clones, only three places reference them:
  1. **identity-vessel `src/services/user-vessel-client.ts`** plus `config.ts:124-126`. The code sets
     `USER_VESSEL_ENABLED` default **true**, with endpoint default
     `http://user-vessel.activity-system.svc.cluster.local:8080` (a K8s DNS name). The live unit does
     not set `USER_VESSEL_*`. The journal shows **379 `[UserVesselClient] user-vessel unreachable`
     warnings in the last 24h**, about one every 5 min per user (a 5-min TTL cache and a 1 s timeout).
     This contradicts git-small's claim that the client is "optional … disabled": it is enabled and
     calls a fossil on the auth-resolve path.
  2. ias-executor-ts `resolvers/helmfile-sync.ts` writes into `repos/deployment/helmfiles/...`. It is
     wired only in `examples/vessel-forge-host.ts`, and no `activity_template` id contains `helm`.
     This is dead residue that depends on the `deployment` fossil. It is judged in its own area; it is
     noted here only as a dependent.
  3. activity-api `cli/migrate-org-to-account.ts` and `websocket/types.ts` hold comment-level
     references (a one-shot migration CLI).
- Docs still describe some of them as live, which is doc drift:
  - `docs/LIVE_DEVELOPMENT.md:47,109-110,159,211-215` gives run and hot-reload recipes for
    react-renderer and terminal.
  - `docs/SCHEMA_OWNERSHIP.md:38,109-114` says "user-vessel is a submodule of this…". That is false:
    it is not in `.gitmodules`.
  - `docs/SCHEMA_OWNERSHIP.md:136-143` and `scripts/substrate/units/surrealdb.service:12` point at
    `repos/deployment/...`. This is historical provenance; it is acceptable if it is marked as such.
  - `README.md:459` already labels workbench correctly as "source-only, not part of the running
    fleet".
- The owner ruled on 08-16 that metabob-dashboard is the only dashboard and that
  metabob-cloud-dashboard must never be cited (`raw/memory-adjacent.md:259,353`).

## Verdicts

| name | verdict | used_now | notes |
|---|---|---|---|
| product-era repo directories (all seven members) | **fossil** | no | No units, no clones, no registrations, no traces. Superseded as in the table above. |
| metabob-cloud-dashboard | duplicate-of → metabob-dashboard (then fossil) | no | Owner ruling 08-16. The one lesson worth keeping is 3f5e35e (08-17): a 5 s poll over an O(table) `ORDER BY … LIMIT 10` on a 473k-row table saturated production SurrealDB. The same class is in MEMORY "`ORDER BY` on big tables times out silently". Carry it as a concept (see below), not as code. |
| identity-vessel → user-vessel client (residual call site) | **broken** | yes (fires, always fails) | A live hot-path call to a fossil. It adds up to 1 s latency on a cache miss and makes journal noise. It hides the fact that `account_id` enrichment never happens, so the tenant helpers always fall back to `org_id`. Fix: default `enabled:false` or delete the client. Dispatch it as a one-file goal on `repos/identity-vessel/src/services/config.ts`. The class detector is "outbound call to a host that no discovery row or unit serves". |
| helmfile_sync (dependent on `repos/deployment`) | fossil (cross-ref) | no | Examples-only wiring; no template. The resolver-area chunk owns the final verdict. |

Nothing in this chunk is keep-general, keep-specific or revive-general. Every capability these repos
once carried now has a live producer:
- `llm_completion`: llm-resolver-vessel.
- auth and keys: identity-vessel.
- UI surfaces: human-surface and stateful-ui.
- Deploy: image, units and profiles.

## Archiving (fossil disposition)

- Move the seven directories out of the working tree into `/archive/product-era/<repo>` on a host
  volume, or push each to an `archive/` remote namespace. Keep git history; they are already
  gitignored, so the super-repo is unaffected. Record each repo's last hash (the table above) in one
  commit message on the super-repo.
- The 67+ vessel `.md` files under these repos should not be indexed by docs-align or concept
  ingestion as current documentation. If they are ingested at all, tag them `era:product` or
  `status:fossil`.
- Doc repairs belong to docs-align work (law 9):
  - LIVE_DEVELOPMENT.md: drop the react-renderer and terminal rows and recipes.
  - SCHEMA_OWNERSHIP.md: user-vessel is **not** a submodule. Say that it is a historical schema
    author whose tables identity-vessel still validates, if that is still true.
  - Mark `repos/deployment` references as historical provenance.
- Lessons to keep as concepts, not code:
  - (a) "polling an O(table) ordered query saturates the database" (3f5e35e).
  - (b) "revoked-key filtering: identity uses a `status` field, not `is_active`"
    (user-vessel 4f71df7, dashboard e092dd4/654aef1, 05-28). This is a recurring schema-field-name
    confusion of the same class as the `alpha` vs `thompson_alpha` false-zero trap.

## Recurrence note

The residual identity→user-vessel call has the same shape as the 09-22 finding "248 gap escalations
posted to a pinned :8270 no human reads": **a writer that pins a peer cannot learn the peer was
replaced**. Here the pin is a K8s DNS default in code, and it has been failing silently since the
move to the container. This is the same failure recurring for the same reason. The class fix, not
just this instance, is to have peers resolved by discovery. A pinned endpoint with no discovery row
should be a detectable gap.
