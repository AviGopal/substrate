# Proof: the three deviations from the simple launch contract

**Context** (operator, 2026-09-15): the target contract is four lines — provide basic
config, run the container, everything works, use vessel-ctl to modify inventories. The
assessment claimed three measured deviations. This proves the three that were not
already proven this session; the rest are cited by evidence path.

**Artifact under test:** the published from-scratch image
`ghcr.io/avigopal/substrate:dev`, pulled fresh (id `23bbfa0a1b29`, built
2026-09-16T00:46Z — i.e. current HEAD, containing this week's join-contract fixes).
No running container was touched; all proof containers, their volumes, and the fake
HOME are removed (verified 0 remaining).

## Deviation 1 — the join anchor is ambiguous, and the wrong one fails silently

Method: the container's real boot config phase (`gen-env` → source env →
`apply-inventory DRY_RUN=1`) executed offline in the image — the exact binaries the
entrypoint runs, no fleet boot, no side effects beyond two read-only `GET /health`
probes. Matched pair, same URL, same key, only the anchor variable differs. Raw
transcripts: `expA-arm1-discovery-endpoint.txt`, `expA-arm2-hub-discovery-url.txt`.

| | ARM 1: `DISCOVERY_ENDPOINT=http://syzygy.host:18100` | ARM 2: `HUB_DISCOVERY_URL=http://syzygy.host:18100` |
|---|---|---|
| gen-env exit | 0 (keyless boot allowed — spoke) | 0 (keyless boot allowed — guard treats HUB as a spoke signal) |
| `ENABLED_ROLES` | `spoke` — store/identity/api masked | *(unset)* — **every unit enabled, full standalone** |
| `ACTIVITY_API_ENDPOINT` | `http://syzygy.host:18080` | `http://127.0.0.1:8080` — **loopback** |
| `IDENTITY_VESSEL_URL` | `http://syzygy.host:18101` | `http://127.0.0.1:8101` — **loopback** |
| warning emitted | — | **none** |

Same URL, other variable: the guard says "spoke" (boots without a provider key) while
the wiring derivation says "standalone" (loopback trace store and identity, no role
masking) — a split-brain in one transcript, with no warning. Mechanism:
`gen-env.sh:423-428` cases only on `DISCOVERY_ENDPOINT`; `HUB_DISCOVERY_URL` never
enters the derivation. `docs/SUBSTRATE.md:392` documents the trap instead of the code
refusing it.

**Bonus, same transcript:** apply-inventory in this freshly-built image warns
`unmanaged: metric-collector-vessel.service` — a shipped unit governed by **no** role,
running in every topology. The ungoverned-units class is live in tonight's build.

## Deviation 2 — errors do not name their cause (the "no templates / fallback" chain)

Method: minimal standalone (surrealdb, valkey, discovery, identity+seeder, goal-host)
with one deliberate miswire: `ACTIVITY_API_ENDPOINT=http://127.0.0.1:9999` (dead —
goal-host's template store). Fleet went Docker-healthy; goal-host `/health` 200. One
goal dispatched. Transcript: `expC-goal-host-attribution.txt`.

Result — the dispatch failed with **exactly the operator-reported symptom**:

```
error: GoalHost.runGoal: no template id returned for goal "attribution probe: …"
(fallback_tier=null). Pass opts.targetTemplateId to bypass the recommend step.
```

Attribution analysis of every error line in the journal:

- Occurrences of the dead address `9999` in **error** lines: **0**. It appears only in
  the boot banner (`started on port 8210 | activity-api: http://127.0.0.1:9999`),
  40 s and dozens of lines before the failure.
- The transport failures are bun's generic `Unable to connect. Is the computer able to
  access the url?` — **with no URL in the message**, five times, for at least three
  *different* dead calls (recommend, authoring-decision emit, goal-path record).
- `Failed to resolve SHA … 401 Unauthorized` names neither the endpoint nor the
  validator.
- The one remediation hint offered — `Pass opts.targetTemplateId` — is **wrong** for
  the actual cause (the store that would serve any template id is unreachable).
- Collateral, logged and swallowed: `goal-path record FAILED … this walk will not
  inform future reuse` — the learning write is also silently lost.

So an operator seeing "no templates / fallback none" is three inference steps away
from `ACTIVITY_API_ENDPOINT is dead`, and the only place that address is ever printed
is a banner nobody reads during an incident.

Caveat: the fleet was not *silent* — discovery registration 401s recurred in the same
journal. The deviation proven is attribution, not silence: among all emitted errors,
zero name the dead endpoint, and the one remedy offered is wrong. (Throw site is dist
ias-executor code, `goal-host.js:609`; full journal preserved as
`expC-full-journal.txt`.)

## Deviation 3 — the operator's key is silently harvested into fleets that don't need it

Method: canary. A fake `HOME` containing only
`.metabob/config.json → {"providers":{"anthropic":{"apiKey":"sk-ant-CANARY-harvest-proof-000"}}}`,
then a make-lane spoke launch that **never mentions the key**:
`HOME=<fake> make up LIVE_NAME=substrate-proof-harvest API_KEY=dummy-join-key
DISCOVERY_ENDPOINT=http://203.0.113.1:18100` (TEST-NET hub — joins nothing, touches no
production). A spoke needs no provider key by design (gen-env boots keyless).
Transcript: `expB-key-harvest.txt`.

Result, verbatim from the launched container:

```
/workspace/.substrate-secrets:  ANTHROPIC_API_KEY=sk-ant-CANARY-harvest-proof-000
/etc/substrate/env:             ANTHROPIC_API_KEY="sk-ant-CANARY-harvest-proof-000"
```

The Makefile's `ANTHROPIC_API_KEY ?= $(shell jq … $(HOME)/.metabob/config.json)`
delivered the operator's private credential into a fleet that (a) didn't ask for it,
(b) doesn't need it, and (c) **persists it to the fleet's volume**, surviving every
later recreate. Hand this command to someone else and they receive your key.

## Already proven this session (cited, not re-run)

- **No boot-time dependency verification; green ≠ wired** — the four-container
  matched-pair proof with adversarial verification:
  `validation/reports/wiring-green-vs-miswired-proof/`.
- **`DISABLED_VESSELS` has no authority over manifest units** — measured on proof-b3:
  the env was set, the federation-transport unit ran anyway (same report, caveat 4 and
  the b3 evidence file).
- **Readiness declares legitimate minimal fleets down** — the healthy control was
  NOT-ready from three units outside its `ENABLED_VESSELS` (same report, matrix row 4).

## Conclusion

All three deviations from the four-line contract are now demonstrated on the current
published image with verbatim, replayable evidence: (1) two anchors, one of which
silently builds the wrong topology with no warning, plus a shipped unit no role
governs; (2) a wiring failure surfacing as "no templates (fallback_tier=null)" with a
misleading remedy and the true cause never named in any error; (3) a private
credential harvested and persisted into a keyless-by-design fleet. Each maps directly
to one of the three fixes proposed: one anchor with loud refusal on ambiguity;
boot-time dependency round-trips with cause-naming errors; the inventory as sole
authority over every shipped unit.
