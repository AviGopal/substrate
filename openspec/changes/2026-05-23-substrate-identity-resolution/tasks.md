# Tasks — substrate-identity-resolution

Per dev-vessel discipline: VERIFY → DEBUG → SPEC (this doc) → DEV.
Each DEV-N step ends with
`cd repos/identity-vessel && bun run lint && bun test` (or the
target vessel's lint/test).

## DEV-1: Shape definitions

- [ ] Add `substrateIdentity`, `vesselCredentials`, and
      `bootstrapAttestation` shape definitions to identity-vessel's
      `src/types/shapes.ts` and `docs/shapes/README.md`.
- [ ] Author per-shape body schemas matching proposal §What
      Changes.
- [ ] Unit tests: shape schema validation pass + fail cases.

## DEV-2: SurrealDB schema migration

- [ ] Add migration introducing `substrate_identity` table (single
      row enforced via UNIQUE constraint on a sentinel key).
- [ ] Add `bootstrap_keys` table with columns `key_hmac`,
      `issued_at`, `expires_at`, `consumed_at`, `issued_for_vessel`.
- [ ] Migration is idempotent and recorded in
      `init_migrations`.
- [ ] Integration test: migration applies cleanly to fresh DB and
      to existing pre-migration DB.

## DEV-3: `mint-substrate-identity` activity

- [ ] Implement the 5-task activity (design §D) in
      identity-vessel.
- [ ] Per-task unit tests covering key generation, persistence,
      JWT-issuer composition.
- [ ] CLI shim: `bun run cli mint-substrate-identity --name <X>
      --domain <Y>`; dispatches the activity through
      identity-vessel.
- [ ] Smoke test: mint a substrate identity in a fresh dev
      database; confirm the record is persisted and retrievable.

## DEV-4: `issue-vessel-credentials` activity

- [ ] Implement the 6-task activity (design §E) in
      identity-vessel.
- [ ] Per-task unit tests covering bootstrap-key validation,
      consumption marking, credential generation.
- [ ] Test reuse-rejection: a consumed key returns
      `failure_mode.type="safety_breach"` with
      `context.breach_type="replay"`.
- [ ] Test expiry: a key past its expiry returns
      `failure_mode.type="verifier_negative"` with
      `context.validator_id="bootstrap_key_expiry"`.

## DEV-5: `resolve-substrate-context` endpoint

- [ ] Add `POST /v1/auth/resolve-context` route to identity-vessel
      (design §F).
- [ ] Route dispatches `issue-vessel-credentials` and attaches the
      current `substrateIdentity` record.
- [ ] Per-route integration test: valid bootstrap key returns the
      tuple; invalid key returns 401.
- [ ] Performance: response within 200ms on the local substrate
      (measurement, not contract).

## DEV-6: Delete hardcoded defaults

For each of the five identified files, replace hardcoded defaults
with required-from-env-or-fail logic:

- [ ] `identity-vessel/src/services/trace.ts` —
      `ACTIVITY_API_ENDPOINT` becomes required; fail at boot if
      missing.
- [ ] `identity-vessel/src/services/jwt.ts` — `JWT_ISSUER` is
      read from the substrate-identity record at startup, not
      from env or a literal.
- [ ] `identity-vessel/src/services/keyGeneration.ts` —
      `IDENTITY_ENDPOINT` similarly from substrate-identity.
- [ ] `discovery-vessel/src/middleware/auth.ts` —
      `IDENTITY_VESSEL_URL` becomes required env var; no
      `metabob.com` default.
- [ ] `identity-vessel/src/services/discovery-client.ts` — delete
      the K8s-DNS URL builder (design §C option 3); endpoints
      must be supplied explicitly.

Grep verification after this step:
- `grep -rn "metabob.com" repos/identity-vessel/src repos/discovery-vessel/src` returns zero matches outside test fixtures.
- `grep -rn "svc.cluster.local" repos/` returns zero matches outside historical archive directories.

## DEV-7: Delete `detectEnvironment()` blocks

Per design §C option 3, delete the detection logic from six
vessels:

- [ ] `repos/identity-vessel/src/services/discovery-client.ts`
- [ ] `repos/concept-db/src/services/discovery-client.ts`
- [ ] `repos/metabob-activity-api/src/services/discovery-client.ts`
- [ ] `repos/metabob-activity-api/src/routes/vessels.ts`
- [ ] `repos/metabob-analysis-api/src/services/discovery-client.ts`
- [ ] `repos/minibob/src/environment.ts`

For each vessel, verify the lint/test pass after deletion.

## DEV-8: Boot-path failure handling

For each vessel that requires substrate identity:

- [ ] On boot, read `SUBSTRATE_IDENTITY_URL` and
      `VESSEL_BOOTSTRAP_KEY`.
- [ ] If either is missing, log a clear error naming the missing
      var and exit with status 1 within 5 seconds (no retry, no
      fallback).
- [ ] If identity-vessel is unreachable, retry with exponential
      backoff (1s, 2s, 4s, 8s — max 4 attempts), then exit with
      status 2.
- [ ] Smoke tests: each vessel exits as expected for each failure
      class.

## DEV-9: Substrate bootstrap integration

- [ ] Update `scripts/substrate/seed-identity.ts` to dispatch
      `mint-substrate-identity` instead of writing directly to
      SurrealDB.
- [ ] Update `scripts/substrate/gen-env.sh` to emit
      `SUBSTRATE_IDENTITY_URL` and the per-vessel
      `VESSEL_BOOTSTRAP_KEY` instead of the legacy env vars.
- [ ] Smoke test: `make -C scripts/substrate substrate-run` brings
      up a fresh substrate; every vessel boots via the new flow.
- [ ] Smoke test failure case: omit `SUBSTRATE_IDENTITY_URL` from
      the activity-api systemd unit; verify activity-api exits
      within 5s with a clear error.

## DEV-10: Backward-compat verification on canary

- [ ] Verify existing vessels with already-issued credentials
      continue to authenticate against the new identity-vessel.
- [ ] Confirm JWTs issued before this change continue to validate.
- [ ] No regressions in the failure-mode harness baseline.

## DEV-11: Closure-audit

- [ ] Run `closure-audit --without=operator-shell` against the
      single-container substrate immediately after `substrate-run`.
- [ ] Confirm the audit succeeds with only
      `SUBSTRATE_IDENTITY_URL`, `VESSEL_BOOTSTRAP_KEY`, and
      `DISCOVERY_VESSEL_URL` provided in the env.
- [ ] Document any operator-shell calls that remain; each is
      either a known-deferred case (e.g. the operator who runs
      `substrate-run` itself) or a gap to close.

## DEV-12: Documentation

- [ ] Update `docs/SUBSTRATE.md` to describe the new boot
      contract: two required env vars, what happens at boot, what
      to do when boot fails.
- [ ] Update `CLAUDE.md` "Authentication" section to reference the
      `substrateIdentity` shape and the
      `resolve-substrate-context` endpoint.
- [ ] Cross-link from
      `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` material
      to the new shapes (without modifying the foundation itself).
- [ ] Add a section to `docs/SUBSTRATE.md` covering the failure
      modes (DEV-8) and their operator remediation.

## DEV-13: Progression-driver integration

- [ ] Update `validation/scripts/progression-driver.ts` to count
      identity-resolution traces under
      `traces_by_horizon.substrate_maintenance` with sub-intent
      `substrate_identity_resolution`.
- [ ] Add a `substrate_identity_present` boolean to the
      cycle-N.json schema — true iff a fresh substrate-run
      produces a queryable substrateIdentity within 30 seconds of
      boot.

## Stop-doing-this signal

This change is complete when DEV-11 succeeds: a fresh
single-container substrate boots from `substrate-run` with only
the new env vars, every vessel registers via
`resolve-substrate-context`, the failure-mode harness baseline is
unchanged, and `closure-audit --without=operator-shell` reports
zero unexpected failures.

The change is archived when a **second substrate kind** (per the
deployment-agnosticism follow-on) boots via the same pipeline with
no code edits, only different env-var values — the falsifiability
test that the spec is genuinely substrate-agnostic and not
single-container-specific.
