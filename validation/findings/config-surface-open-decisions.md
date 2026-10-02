# Configuration surface — findings deferred as decisions, not edits

Companion to [`docs/operations/CONFIGURATION_SURFACE.md`](../../docs/operations/CONFIGURATION_SURFACE.md).
The delivery-path defects found alongside these were fixed and verified (commit
`28f78545`); everything below was deliberately **not** fixed, because each one is a
decision about which behaviour is correct rather than a mechanical repair.

These belong in the gap store, not in a markdown file. They are here because no fleet was
running when they were found, so `substrateGap_write` was unreachable — the outage blocks its
own remediation. **When a substrate is up, file each as a gap and delete the corresponding
section here.** An operator hand-writing these as goals is itself the missing generator
(law 6).

Each entry states the defect, not the correct state, and names the check that would catch a
regression.

---

## 1. Two vessels reach the same database with different default credentials

`activity-api` defaults `SURREALDB_PASSWORD` to `changeme`
(`repos/activity-api/src/config.ts:210`); `relevance-sink-vessel` defaults it to `root`
(`repos/relevance-sink-vessel/src/index.ts:7`). Both connect to the same SurrealDB instance.

Whichever is wrong, one of them is: a default that differs between two clients of one
datastore cannot be right in both places. The defaults only apply when the variable is unset,
which is exactly the state a point-and-go launch relies on.

`SURREALDB_URL` has **five** distinct defaults across the fleet and `DISCOVERY_ENDPOINT` has
four, including `http://discovery-vessel:8080` (a port this fleet does not use) and
`http://localhost:8765` (a port used nowhere else at all).

**Decision required:** one default per variable, fleet-wide, or an explicit statement of why
a vessel legitimately differs.

**Detector:** a lint that collects every `process.env.X ?? "…"` default per variable name
and fails when one name has more than one non-empty default. Must cover bracket and helper
forms — see §5.

---

## 2. `JWT_SECRET` and `HMAC_SECRET` have no insecure-value gate

`identity-vessel` refuses to boot when `API_KEY_SECRET` is the public literal
`dev-secret-change-in-production` unless `ALLOW_INSECURE_API_KEY_SECRET=1`
(`repos/identity-vessel/src/index.ts:93`).

The **same literal** is the fallback for `JWT_SECRET`, and an equivalent
`dev-hmac-secret-change-in-production` is the fallback for `HMAC_SECRET`. Neither has a gate:
`grep -c ALLOW_INSECURE repos/identity-vessel/src/services/jwt.ts` returns 0.

So a substrate can boot with forgeable JWTs while the check that exists for exactly this
hazard passes. Two substrates that both fall back share one trust space — the shared-secret
federation hazard the `API_KEY_SECRET` gate was written to prevent.

**Decision required:** extend the fail-closed gate to both, or state why token forgery is
acceptable where key forgery is not.

**Detector:** assert that every secret with a committed default literal has a boot-time
guard, rather than checking the three names someone remembered.

---

## 3. A port collision is prevented only by a channel-2 override

`metric-collector-vessel` defaults `PORT` to `8280`
(`repos/metric-collector-vessel/src/config.ts:2`). `light-dispatch-vessel` defaults `PORT` to
`8280` (`repos/light-dispatch-vessel/src/index.ts:36`). They are kept apart solely by
`Environment=PORT=8300` in the metric-collector unit file — a channel with no provenance
record and no operator delivery path.

Run either outside systemd — a test harness, a scaffold, a local `bun src/index.ts` — and they
collide. The in-code default is the one a developer sees.

**Decision required:** correct the in-code default so the unit override is redundant rather
than load-bearing.

**Detector:** compare in-code `PORT` defaults against the inventory's `health_port` per
vessel; any disagreement is either this defect or a stale inventory.

---

## 4. `relevance-sink-vessel` is role `compute` but writes SurrealDB directly

Its unit is `After=surrealdb.service` / `Wants=surrealdb.service` and it writes
`impulse_relevance_metrics` directly (`repos/relevance-sink-vessel/src/index.ts:19-38`), but
the inventory assigns it role `compute`.

The `spoke` role group includes `compute` and excludes `store`. So on a federated spoke this
vessel starts, registers, reports healthy, and every write it makes fails — silently, because
nothing checks.

**Decision required:** reassign the role, or give it the same remote-store treatment the other
compute vessels get.

**Detector:** cross-check each vessel's declared role against whether its unit declares a
`store`-role dependency. A `compute` vessel that needs `surrealdb` is a role misassignment by
construction.

---

## 5. The advertise variables have consumers and no producers

`VESSEL_ADVERTISE_ENDPOINT` and `SUBSTRATE_ADVERTISE_HOST` are read with a documented
precedence contract in two places
(`packages/vessel-discovery-client/src/registration-loop.ts:125`,
`repos/ias-executor-ts/src/hosts/discovery-registration-loop.ts:92`). No lane passes them and
`gen-env.sh` contains zero occurrences, so **setting them changes nothing** — verified by
sentinel run.

They are named in `docs/FEDERATION.md` as the cure for the measured one-directional
federation: every hub vessel registers as `http://127.0.0.1:<port>` with no multiaddr, and
discovery keeps only dialable peer rows, so a spoke resolving a hub-owned shape gets
`found:false`.

**This is filed as a decision precisely because wiring them is the wrong fix.** Two more
Tier-0 environment variables papering over a registration defect is the opposite direction
from p2p-by-default, where every vessel has a peer identity and a circuit address and the
loopback registration never happens. The delivery gap is real; the proposed remedy should not
be adopted just because it is the one already written down.

**Detector:** the probe's `DROPPED` section catches lane-level delivery gaps. It does **not**
catch a consumer with no producer anywhere — that needs a check that reads consumer call
sites and asserts each name is emitted by something.

---

## 6. `${VAR:-…}` cannot express "clear this"

Shared by all ~20 persisted names. `-e MAX_PEER_DEPTH=` does not un-peer a substrate; the
persisted value returns, because the parameter expansion treats empty as unset. Clearing a
persisted value means editing `/workspace/.substrate-secrets` by hand.

The Makefile solved this for provider keys with `RECREATE_CARRY_PRESENT` — carry by presence,
not by value — after a UI-only spoke's deliberate `ANTHROPIC_API_KEY=""` was refilled from the
operator's config and persisted (len 0 → 108).

**Decision required:** apply the same treatment inside `gen-env.sh` to the whole persisted
set. Doing it for three names would make those three inconsistent with the other seventeen,
which is worse than the current uniform limitation.

**Detector:** for each persisted name, boot with a value, then boot with an explicit empty,
and assert the value cleared. The probe has the harness for this already.

---

## 7. The probe is a script, so it is only as good as the habit of running it

`scripts/substrate/config-surface-probe.sh` reproduces every delivery defect in this round
automatically and was proven to fail on a perturbed baseline. It is still invoked by nothing.

A check nothing invokes cannot be trusted when it passes, because it is never observed
failing — the exact defect that let the document this supersedes go stale in both directions.

**Decision required:** mint the check as an activity the loop can grade (law 2), so
configuration acquires the feedback it structurally lacks. A pre-commit hook or CI step is
the lesser version: it catches regressions without ever producing a trace.
