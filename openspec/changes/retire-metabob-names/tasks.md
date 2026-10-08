## 0. Measurement

- [x] 0.1 Read-site census from origin/dev of every repo (2026-10-07): 3,514 sites; super-repo 1,821
      (tests/validation 1,208, scripts 303, docs 264, units 5, .claude hooks 4, CI 1), development-vessel
      621, deployment 410, activity-api 179, workbench 113, terminal 85, 20 more vessel repos.
- [x] 0.2 Scope boundary measured: the cockpit plugin (out of scope) reads `~/.metabob/config.json`,
      `METABOB_CONFIG_PATH` and `METABOB_API_KEY` itself, so the client-side old path and the cockpit's
      env names stay.
- [x] 0.3 Census script `validation/scripts/metabob-census.sh` (724fa6e5): repo, file, line, names, a
      default-fallback column (?? / || incl. bracket access, ${X:-} ${X-} ${X:=}, .get(X, d), .get(X) or, destructuring
      defaults) and kind. origin/dev 2026-10-07: 3,512 sites, 387 fallback reads (263 in code).

## 1. Producers emit both names (deployment lane)

- [x] 1.1 `secret-scope-names.sh` (cafdd281): per-unit secret NAMES from EnvironmentFile=, Environment= and
      PassEnvironment= (never values). Baselines captured on node1, compose2 and pubspoke; the hub's by a user-run read.
- [x] 1.2 gen-env (9fc83539, seed-identity writeFleetKey): accept `SUBSTRATE_API_KEY` / `SUBSTRATE_ENDPOINT` as inputs (new wins, conflict logged
      by name), write both names in every rendered file. The persisted store keeps ONE copy, under the retiring
      name (seed-identity rewrites it on minting, and a second stored copy would drift from it); the alias is
      always derived from it. seed-identity's rewrites set both rendered names. SUBSTRATE_API_KEY is excluded
      from peer credentials (gen-env's filter, secrets-manifest) and from secrets.env.sh's carry-forward exactly
      as the retiring name is; SUBSTRATE_ENDPOINT is a routing anchor in both drop lists.
- [ ] 1.2a local-tools (a goal in its repo): agentShellEnv with BOTH names in base and extra yields NEITHER
      (its allowlist already excludes both; the test pins it).
- [ ] 1.3 Units, installer, acceptance runners and CI pass both names wherever they pass one.
- [x] 1.3a secret-leak-scan.sh recognises the fleet key under either name (fleet_key_named) and collects its value
      under the alias; tested with the key only under SUBSTRATE_API_KEY. The secret-mask probe masks DIRECTORIES
      (never names), so the alias in the shared env needs no change there.
- [ ] 1.4 `substrate-connect`: write `~/.substrate/config.json`; keep `~/.metabob/config.json` resolving to
      it; registration line unchanged for the cockpit. Test: fresh host, existing old-path host, both.
- [x] 1.5 By effect on every node: both names present with equal values (compared by hash inside the
      container, never printed); the store holds the key under exactly ONE name; scope-name diff = the alias
      only, on the same units; the hub through a user-run read. Met on 2026-10-08 on pubspoke, compose2, node1
      and the hub without waiting for a boot. Each node got a quiet-gated alias render that byte-copies the
      retiring name's line into the alias and swaps the file atomically, only once the node's installed gen-env
      rendered the same alias, so the next boot reproduces it. gen-env is not re-run live, because it truncates
      lines that runtime writers upserted after boot, and no unit is restarted, because nothing reads the new
      names before phase 2. Every keyed unit gained only SUBSTRATE_API_KEY; discovery's peer-credential file
      kept its names.

## 2. Readers move (super-repo directly; vessels through the substrate)

**Deferred (user ruling, 2026-10-07).** Phase 2 waits until the learning-loop items queued ahead of it are done:
the leaf org fix, coherence-recover, and view-liveness. No phase-2 goal is minted until then. Phase 1 finishes
first: the alias is rendered node by node (pubspoke, compose2, node1, hub), each after 9fc83539 is accepted and
the installed gen-env has converged, with the 1.5 report after each. Nothing reads the new names before phase 2,
so the deferral leaves every node on the old names with the alias present and unused.

Until phase 3 every moved reader reads the NEW name and falls back to the OLD one (`NEW ?? OLD`, `${NEW:-$OLD}`),
and its test covers "only the old name set => still works" and "both set and different => the new name wins". A node whose shared env has not been re-rendered since
phase 1 (it re-renders only at boot) carries the old name only, so a reader of the new name alone would read empty
and fail auth there. This transitional fallback is to the old NAME, not to a default value (2.3b), and phase 3
removes it with the old name.

- [ ] 2.1 Super-repo scripts, units, .claude hooks, docs (README install inputs; configuration reference
      migration table).

Readers already on the new name, moved early by the 2026-10-07 security harm-stop (the presence-only
X-Internal-Api-Key path). Each reads `SUBSTRATE_API_KEY` first, then `METABOB_API_KEY`, then a legacy name, so
the migration table lists them as done. Because the phase-1 alias is byte-copied they behave the same as before;
if a later change sets only one name, they follow the new-name-wins rule.
  - identity-vessel `src/trace.ts` (auth-trace post, `Authorization: ApiKey`): SUBSTRATE_API_KEY → METABOB_API_KEY → INTERNAL_API_KEY.
  - development-vessel `src/resolvers/substrate-gap.ts` (gap-event publish): SUBSTRATE_API_KEY → METABOB_API_KEY → API_KEY.
  Phase 3 drops the METABOB_API_KEY step from both. The legacy third name is a 2.3b default-fallback read and moves with that task.
- [ ] 2.2 Super-repo tests and validation fixtures.
- [ ] 2.3 One whole-vessel goal per vessel repo (25), tagged `rename:metabob` and excluded from
      landing-rate counts; development-vessel and ias-executor-ts verified by effect (refusal trace
      lands; trace-sink spool empty).
- [ ] 2.3a Write grants: withWriteGrant (signer) and every verifyWriteGrant reader (local-tools
      shell-containment and write-containment, development-vessel write-containment) move in ONE step;
      by effect after each converges, a lane write through local-tools still lands. local-tools
      script-runner.ts's output redaction (by the key's value) moves in the same step, or it goes empty.
- [ ] 2.3b Default-fallback reads (`??`, `||`, `:-` on these names) listed by the census and each moved
      explicitly; a fallback that "works" counts as a miss.
- [ ] 2.4 Census re-run: zero old-name READS outside the compatibility shim and the migration table.

## 3. Stop emitting old names inside the substrate

- [ ] 3.0 secret-leak-scan.sh and the mask probe find the key by `SUBSTRATE_API_KEY` (else scan_blind on
      every node once the old name is gone).
- [ ] 3.1 Lint `validation/scripts/no-metabob-names.test.sh` over the super-repo and vessel repos, with a
      must-fail fixture (a planted old-name read turns it red) before it is trusted.
- [ ] 3.2 gen-env, units and acceptance stop writing `METABOB_API_KEY` / `METABOB_ENDPOINT`; the persisted
      store's single copy moves to `SUBSTRATE_API_KEY` (read either name once, write the new); the client
      shim stays for the cockpit.
- [ ] 3.3 By effect on every node: auth, endpoint resolution and trace delivery unchanged; spool empty;
      a lane write lands; the leak scan is not scan_blind.
