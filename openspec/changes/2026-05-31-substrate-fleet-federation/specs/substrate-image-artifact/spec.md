# Spec — Substrate Image Artifact

Normative requirements for Phase 1 of `2026-05-31-substrate-fleet-
federation`. Substrate as a deployable, signed, reproducible image
with a one-command bootstrap on a fresh host.

## R0 — Sequencing

- **R0.1** This spec MAY ship independently of every other delta in
  this change and of `2026-04-26-security-hardening-findings`. It
  introduces no cryptographic identity beyond a build-provenance
  signature on the image.
- **R0.2** This spec MUST NOT change any vessel's runtime contract.
  It only changes how the substrate is packaged and bootstrapped.

## R1 — Image build

- **R1.1** The substrate image SHALL be built by CI on every push to
  the `dev` branch of the super-repo. The build SHALL produce at
  minimum the tag `metabob/substrate:<git-sha>`. Additional rolling
  aliases (`:dev`, `:<release-tag>`) MAY be produced.
- **R1.2** The image build SHALL be reproducible. Given the same
  super-repo git-sha and the same set of vendored vessel commits
  pinned by `.gitmodules`, the build SHALL produce an image with
  the same content digest.
- **R1.3** Every published image tag SHALL carry a signature
  attesting build provenance. The signing identity SHALL be a CI-
  controlled key distinct from any vessel pubkey (H2) and from any
  fleet authority key (H4).
- **R1.4** The signature SHALL be verifiable by the
  `metabob-substrate bootstrap` command (R2) prior to starting the
  container. Failed signature verification SHALL refuse the
  bootstrap.

## R2 — Bootstrap-on-fresh-host

- **R2.1** A single command SHALL bootstrap a substrate on a fresh
  host with no operator-side state beyond an LLM provider key:
  ```
  metabob-substrate bootstrap \
    --image metabob/substrate:<tag> \
    --workspace <path> \
    --anthropic-api-key <key>
  ```
- **R2.2** The bootstrap command SHALL:
  - Pull the image and verify R1.3's signature.
  - Generate `workspace/.substrate-secrets` containing JWT secret,
    SurrealDB credentials, and `METABOB_API_KEY`, using the same
    content schema as the current `scripts/substrate/Makefile`
    `gen-env.sh` produces.
  - Start the substrate container with the workspace mounted.
  - Run the equivalent of `seed-identity.ts` against the started
    substrate, idempotently.
  - Configure the local `~/.metabob/config.json` to point at the
    new substrate's port.
- **R2.3** Bootstrap SHALL be idempotent. A second invocation
  against an existing workspace SHALL reuse the persisted secrets
  and re-run only the steps that require it (image re-pull if tag
  changed; seed steps skipped if identity already seeded).
- **R2.4** Bootstrap SHALL reach `/health` green within 10 minutes
  on a commodity VM with no prior Metabob state.
- **R2.5** Bootstrap SHALL emit a structured log of every step it
  took, suitable for ingestion as a `bootstrapTrace` impulse when
  the bootstrapping substrate is itself substrate-driven (Phase 4
  self-install consumes this).

## R3 — Substrate promotion

- **R3.1** A `promote-substrate.sh` script SHALL ship that promotes
  vessel image tags inside a running substrate by editing the
  relevant systemd unit in `scripts/substrate/units/` and
  restarting the unit.
- **R3.2** `promote-substrate.sh` SHALL coexist with the existing
  `repos/deployment/scripts/promote-canary-to-production.sh` during
  the transition window. Vessels listed in `scripts/substrate/
  units/` SHALL be promoted via `promote-substrate.sh`; vessels
  still on the Kubernetes path SHALL continue to be promoted via
  the existing Helm-based script.
- **R3.3** The eventual end-state (full substrate cutover vs.
  indefinite coexistence) is operator-decided per the
  proposal's TODO(operator) marker. The spec does not require a
  cutover.

## R4 — Verification

- **R4.1** Three independent operators bootstrapping the same
  `metabob/substrate:<git-sha>` on three different VMs SHALL reach
  `/health` green within R2.4's window with no operator
  intervention beyond `--anthropic-api-key`.
- **R4.2** The image content digest produced by R1.2 SHALL match
  across the three operators' local builds when those builds are
  driven from the same super-repo git-sha. (Build reproducibility
  check; runs in CI.)
- **R4.3** R2.5 bootstrap trace SHALL be parseable and SHALL contain
  at least: `image_tag`, `image_digest`, `signature_verified`,
  `workspace_path`, `seed_completed_at`, `health_first_green_at`.

## R5 — Non-requirements

- **R5.1** This spec SHALL NOT introduce vessel identity changes
  beyond what already ships in the substrate. H2 is owned by
  `vessel-pubkey-identity` (`specs/vessel-pubkey-identity/spec.md`).
- **R5.2** This spec SHALL NOT introduce cross-substrate routing.
  The image is a single-substrate artifact.
- **R5.3** This spec SHALL NOT introduce a substrate-level
  identifier visible above the discovery-vessel layer. Substrate
  is deployment vocabulary; the image artifact does not change
  that.
