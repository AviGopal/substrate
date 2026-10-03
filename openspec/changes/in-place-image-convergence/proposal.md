## Why

A node should only need its boot image to boot and run the update gate. Everything after that should converge
in place, judged before it is installed, so that a landed fix goes live without anyone recreating a container.
Today that holds for vessel code and about 17 tooling paths, but not for the rest of what the image bakes:

- 31 tooling paths from `scripts/` never converge, among them `substrate-status`, `substrate-doctor`,
  `substrate-connect`, `reseed-restart` and the entrypoint. A fix to any of them waits for an image recreate.
- The federation transport and relay run from a 502-file baked copy of `scripts/substrate`, pinned on purpose
  (e1c06f60), so the noise-cipher fix (af119736, 69256d9) went live only through a recreate wave.
- The base runtime (SurrealDB, bun, OS packages) changes only with an image. On 2026-10-03 the SurrealDB
  2.3.3 → 2.3.10 upgrade took a recreate per local node and three hand-run attempts on the hub.

Measured by `validation/scripts/image-convergence-surface.test.sh` (e9ce7e69): red today, 819 baked files,
288 with an installer.

## What Changes

The design has three tiers, each with a different treatment. They were ruled on by the user on 2026-10-03 and
reviewed by qa.

**Tier A: tooling converges in place, staged, and only where a gate fixture exercises it.**
- One committed manifest, `scripts/substrate/image-files.manifest` (`src<TAB>dst<TAB>mode`). The Dockerfile
  COPYs from it and pull-sync installs from it. The lint becomes manifest == Dockerfile COPY set == pull-sync
  install set.
- A per-path coverage map: for each path, the gate fixture that exercises it. A path with no exercising fixture
  stays baked (converged only by the image) until one exists. A pass that exercises nothing is not evidence.
- Canary order is enforced for Tier A paths: converge on the first canary, require N clean soak ticks there,
  then the rest. Until the fleet channel exists, Tier A is limited to that order.
- Only sources inside `gate_paths` converge. `scripts/bootstrap-seeder.ts` and the root `docker-compose.yml`
  are outside, and stay baked unless `gate_paths` is extended through the criterion path.

**Tier B: the federation runtime tree converges after a behavioural gate fixture exists.**
- A Gate P shadow fixture runs the candidate's relay on a random loopback port, with fixture-owned nodes on
  either side of two circuits. DCUtR and AutoNAT are off and every node uses the AssemblyScript cipher, so
  only the candidate relay can mis-encrypt a large frame. A 200-byte control must pass first. Then 1 MiB
  goes over both circuits at once, in writes large enough that frames of 1200 bytes or more are certain. A
  run that sent none is "cannot judge", never a pass. It is time-bounded, uses no egress, and kills every
  process it spawns. The candidate transport server is not run: by default it calls live loopback services,
  and the shadow sandbox shares the node's network.
- Mutation proof before it counts: FAIL with `relay.ts` at af119736^, PASS at af119736, side by side. The
  lib pair (542e712, 69256d9) named earlier is not the variable: the lib is not in the converged tree, and
  swapping it does not change the result.
- The fixture needs a bun that the sandbox's nobody can execute. The image provides one from the change that
  adds it; the fixture lands only after nodes run that image.
- Then pull-sync converges `/usr/local/share/substrate/super-repo/scripts/substrate` from `accepted/`,
  keeping the last-good copy as fallback. Adding a fixture path is ordinary under gate-policy, not a widening.
- Not covered: the relay tree's copy of `@avigopal/libp2p-federation-transport` is made at image build, so a
  lib fix still needs a recreate. Converging it is a separate step with its own fixture.

**Tier C: base runtime upgrades through an in-place upgrade activity, not a recreate.**
- A primitive, `scripts/substrate/runtime-upgrade.sh`, generalised from the hub procedure. It is wrapped by an
  activity minted through the substrate (law 2).
- Its trigger is a shaped decision through the criterion path (target version plus evidence), never a timer.
  The activity is graded, and has a must-fail fixture: an engine version that breaks the query-corpus parse is
  refused and the old binary is kept.
- Per-node evidence, in order:
  1. retention hold verified (dryRun:true);
  2. backup restore-proof on scratch, with counts matching;
  3. binary provenance (upstream checksum or signature);
  4. quiesce verified;
  5. volume backup with sha256;
  6. engine version;
  7. query-corpus parse check against the target engine, plus scan-vs-index equivalence;
  8. migration ledger (applied migrations not re-run);
  9. counts vs baseline; smoke probes tagged and excluded from measurements;
  10. hold still on afterwards.
- Rollback is rehearsed on scratch: the previous binary and the tar restore boot together and pass the same
  checks.
- One deploy event per node, its time recorded in WIRING, with no concurrent change (law 12).
- Recreate remains only for container settings (ports, volumes, privileges).

## What This Does Not Change

- There is no host-side updater, and no container recreates itself. The narrow "recreate me on digest X"
  affordance stays unbuilt.
- CI install acceptance stays the authority for public `:dev`. Its large-frame check (a8bd1e74, b871bdbb) is
  the image-level witness for Tier B.
- Staged-fleet-rollout's fleet channel remains the long-term staging mechanism. Tier A's enforced canary order
  is an interim it later subsumes.

## Impact

- Deployment lane: the manifest, `Dockerfile.substrate`, the lint, `runtime-upgrade.sh`, and the
  Tier B fixture script.
- Coordinator: `substrate-pull-sync.sh` (install from the manifest; Tier B convergence with last-good;
  canary-order enforcement), and the gate's shadow evaluation if the fixture needs a runner change.
- Substrate: the runtime-upgrade activity and its trigger shape, minted through the landing path.
