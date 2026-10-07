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
- [ ] 1.2 gen-env: accept `SUBSTRATE_API_KEY` / `SUBSTRATE_ENDPOINT` as inputs (new wins, conflict logged
      by name), write both names in every rendered file. The persisted store keeps ONE copy, under the retiring
      name (seed-identity rewrites it on minting, and a second stored copy would drift from it); the alias is
      always derived from it. seed-identity's rewrites set both rendered names. SUBSTRATE_API_KEY is excluded
      from peer credentials (gen-env's filter, secrets-manifest) and from secrets.env.sh's carry-forward exactly
      as the retiring name is; SUBSTRATE_ENDPOINT is a routing anchor in both drop lists.
- [ ] 1.2a local-tools (a goal in its repo): agentShellEnv with BOTH names in base and extra yields NEITHER
      (its allowlist already excludes both; the test pins it).
- [ ] 1.3 Units, installer, acceptance runners and CI pass both names wherever they pass one.
- [ ] 1.3a secret-leak-scan.sh and the secret-mask probe cover BOTH names (the alias is never an unscanned
      copy of the fleet key); must-fail: a fixture leaking the value under the new name only is caught.
- [ ] 1.4 `substrate-connect`: write `~/.substrate/config.json`; keep `~/.metabob/config.json` resolving to
      it; registration line unchanged for the cockpit. Test: fresh host, existing old-path host, both.
- [ ] 1.5 By effect on every node after its next boot: both names present with equal values (compared by
      hash inside the container, never printed); the store holds the key under exactly ONE name; scope-name
      diff = the alias only, on the same units; the hub through a user-run read.

## 2. Readers move (super-repo directly; vessels through the substrate)

- [ ] 2.1 Super-repo scripts, units, .claude hooks, docs (README install inputs; configuration reference
      migration table).
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
