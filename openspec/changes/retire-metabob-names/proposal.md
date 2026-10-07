## Why

"metabob" is a former product name. It survives in four configuration names that every part of the
system reads: the fleet API key `METABOB_API_KEY`, the activity-api endpoint `METABOB_ENDPOINT`, the
client config `~/.metabob/config.json`, and its override `METABOB_CONFIG_PATH`. They appear about
3,500 times across the super-repo (scripts, units, gen-env, tests, docs) and 25 vessel repos. The user
ruled to retire them in favour of `SUBSTRATE_API_KEY`, `SUBSTRATE_ENDPOINT`,
`~/.substrate/config.json` and `SUBSTRATE_CONFIG_PATH`.

The names are load-bearing: a reader that misses the rename fails authentication or loses its endpoint,
and the failure is silent where a reader falls back to a default. So the rename cannot be a flag day,
and it cannot be ~1,500 hand edits either: one-file goals at that volume would swamp the lane's supply
queue and its landing-rate metric.

## What Changes

**Alias at the source, then move readers, then stop emitting the old names.** Every one of these values
reaches its readers from a small number of producers: gen-env renders `/etc/substrate/env` (and the
scoped env.d files) from install inputs and the persisted secrets store; `substrate-connect` writes the
client config. If the producers emit both names with the same value, every existing reader keeps
working and every new reader works from the first boot, so call sites can move at any pace and in any
order. No per-runtime dual-read accessor is needed for values that arrive by environment.

**Phase 1: producers emit both names.**
- gen-env accepts `SUBSTRATE_API_KEY` / `SUBSTRATE_ENDPOINT` as install inputs (new name wins when
  both are given and differ, and the conflict is logged by name, never by value) and writes both names into
  every file it renders. The persisted store keeps ONE copy, under the retiring name: seed-identity rewrites
  that copy when it mints the fleet key, so a second stored copy would drift from it. The alias is always
  derived from the one copy, and seed-identity's rewrites set both rendered names. The store moves to the
  new name in phase 3.
- Scoping stays identical: the new name goes to exactly the units that receive the old one. A
  names-only render (`secret-scope-names.sh`) prints each unit's key-name set; its diff before/after
  must show only the added alias on the units that already had the old name.
- Units, the installer and the acceptance runs pass both names wherever they pass one explicitly
  (`Environment=`, `docker run -e`, `env -i` allowlists, CI secrets).
- `substrate-connect` writes `~/.substrate/config.json` and keeps `~/.metabob/config.json` resolving to
  the same content (a link, or a merged copy where the client side forbids links), and prints the
  cockpit registration line unchanged (see *What This Does Not Change*).
- These are bootstrap-tier changes and take effect at each node's next boot (image + volume); pull-sync
  converges gen-env and the units, and a recreate keeps them because the store is in the volume.

**Phase 2: readers move to the new names.** Mechanical, per repository, in a few large commits:
super-repo scripts, units, tests and docs directly; each vessel through the substrate as one goal per
vessel (a whole-vessel rename), tagged so these dispatches are excluded from landing-rate counts.
Readers that consume the client config file read `~/.substrate/config.json` first and fall back to the
old path. Hot readers verified by effect after their vessel converges: development-vessel's mitosis
cutover refusal trace still lands, ias-executor-ts's trace sink spool stays empty, and a lane write
through local-tools still lands.

Three reader classes need care because a miss there does not fail loudly:
- **Keyed checks.** Lane write grants are signed (withWriteGrant) and verified
  (`verifyWriteGrant(env.METABOB_API_KEY, …)` in local-tools shell- and write-containment and in
  development-vessel write-containment) with the key read by its old name. They fail closed, so a miss
  cannot make a grant forgeable, but a signer or verifier left on the old name silently denies every lane
  write once phase 3 stops emitting it: the signer and every verifier move in the same step.
- **The secret-leak scan and the secret-mask probe** name `METABOB_API_KEY` to find the fleet key's value
  (secret-leak-scan.sh reports scan_blind without it). During phases 1-2 the same value exists under two
  names, so both tools must cover both names from phase 1 on (the alias is not an unscanned copy), and
  they must know `SUBSTRATE_API_KEY` before phase 3 removes the old name.
- **Default fallbacks.** A read such as `process.env.METABOB_ENDPOINT ?? "http://127.0.0.1:8080"` does not
  fail when the name disappears; it falls back, which works on a standalone node and is wrong on a spoke.
  Such a read counts as a MISS even when it appears to work; the census flags `??`/`||`/`:-` defaults on
  these names separately.

**Phase 3: stop emitting the old names inside the substrate.** gen-env, units and acceptance stop
writing `METABOB_API_KEY` / `METABOB_ENDPOINT`; a lint fails on any `METABOB_` or `.metabob` in the
super-repo and vessel repos outside the configuration reference's migration table and the client-side
compatibility shim. The lint is proven by a must-fail fixture (a planted old-name read turns it red).

## What This Does Not Change

- The API key prefix `mb-`. Renaming it would invalidate every issued key (user ruling).
- The cockpit: the `metabob` MCP server, its `mcp__metabob__*` tools and the `metabob-substrate`
  skill (user ruling). The cockpit plugin itself reads `~/.metabob/config.json`, honours
  `METABOB_CONFIG_PATH` and passes the key on as `METABOB_API_KEY` (plugin 0.2.15, src/config.ts). So on
  the CLIENT side the old path must keep resolving and the cockpit registration keeps its old variable
  names for as long as the cockpit is unchanged; phase 3 retires the old names inside the substrate, not
  in the cockpit's own configuration.
- Key values, scoping, rotation and the identity model. This is a rename of names, not of secrets.
- How endpoints are found. Endpoint reads move to `SUBSTRATE_ENDPOINT` here; replacing pinned endpoint
  reads with discovery (route by shape, never pinned) is a separate change, not bundled with a rename.

## Impact

- Bootstrap tier (deployment lane): `gen-env.sh`, `secrets.env.sh`, `secrets-manifest.json`,
  `substrate-connect.sh`, `connect-merge.sh`, `substrate-install.sh`, acceptance runners, units that
  name the key (development-vessel-seed, service.d/EXEMPT, vessel.d/EXCEPTIONS).
- Readers: ~3,500 sites; the read-site inventory (`retire-metabob-names/sites.tsv`, regenerated from
  origin/dev by the census script) is the checklist, and phase 3's lint is its closure.
- Operator surfaces: README install inputs name the new variables; the configuration reference gains a
  migration table (old name, new name, phase, what still reads the old one).
- Risk: a reader missed in phase 2 fails only when phase 3 stops emitting the old name. The lint is the
  guard against that, which is why phase 3 cannot ship before the lint is green on every repo.
