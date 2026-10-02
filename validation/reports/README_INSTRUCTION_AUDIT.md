# Auditing the README by following it

Five independent passes over `README.md`, each starting at the top of the file
as a newcomer would and following links only where the document sends them.
Three passes executed the documented commands against real fleets in isolated
sandboxes; two checked claims against the code and the running system.

The method that made this worth doing: **run the instructions, do not read
them.** Every defect below was a sentence that was true when written and
quietly falsified by later code. Reading could not have found them, because
prose and prose agree with each other.

The areas audited were named as *Quick Start, About, Installation, Maintenance,
Configuration*. Only two exist as headings. Where an area had no heading, the
mapping is recorded rather than smoothed over — a task a reader cannot find a
section for is itself a finding.

| Area | Mapped to | Executed |
|---|---|---|
| Quick Start | `### Quick start from the published image` | full first run from the published image |
| About | Overview, Architecture foundation, Core concepts, Core components, Learning loop, Key design principles | claims checked against code + live system |
| Installation | spoke join, build from source, run your own hub | build + spoke join against the real hub; hub deploy static only |
| Maintenance | *no heading* — `## Working with the substrate` and the `vessel-ctl` surface it points to | every maintenance verb, mutations sandboxed |
| Configuration | *no heading* — the `-e` blocks, `.env.example`, `CONFIGURATION_SURFACE.md` | three-list cross-check + the lane-differential probe |

---

## What held up

Worth stating first, because a clean result is a result. The substantive
architecture claims verified: Thompson sampling, Bayesian relevance scoring, the
ribosome extracting templates from reached executions, discovery as the routing
fixed point, the reach gate, per-vessel technology and ownership, all named
`repos/` paths, all seven `SUBSTRATE_AS_*` lenses, every documentation link
resolving. Autonomy is real — eight commits in one vessel authored by
`Substrate Autonomous` via mitosis cutover, and a live trace pulled minutes old.

The first-run promises verified end to end: anonymous clone, anonymous GHCR pull
with no login or PAT, no submodules needed for a pulled image, all nine ports
serving `200`, `POST /run-goal` returning `202` with a dispatch id, the
unauthenticated poll returning `reached`. The README's own warning that
`healthy` arrives long before identity is seeded reproduced exactly: container
healthy at T+17s, `substrate-key show` printing a placeholder with exit 0, and
the documented `whoami` gate flipping at T+92s. Time to a surface-usable fleet
from a cold start: about five and a half minutes, dominated by a 3.1 GB pull.

Maintenance verbs all work. Mask semantics are correct throughout: a masked unit
refuses `start` and `restart` with an explanatory message and a non-zero exit,
and a widening `apply` clears the mask. Backup and restore succeed once the
recipe is corrected. Every configuration variable the README names has a working
delivery path — the configuration failures are documentation-side, not
mechanism-side.

---

## Fixed in this sweep

| Defect | Why it mattered |
|---|---|
| `vessel-ctl apply` started seven units on every run of a converged fleet | broke the documented "no action lines means converged" contract, so a real action line was invisible |
| An injected `-e` selection lost to the env file | the documented mask-recovery lever was inert on exactly the fleets that needed it |
| The backup recipe hardcoded `substrate-live` and the production volumes | following it on a second substrate drained production, then restored production's volumes over it |
| `config-surface-probe.sh` disabled its own hardcoded-value check silently | a green probe was not evidence for as long as it was live |
| README's spoke section named `HUB_DISCOVERY_URL` in its lead sentence | contradicted its own body 47 lines later; the wrong half came first |
| `gen-env` printed that same wrong advice at the moment of failure | the operator reads it while already stuck and follows it into a worse state |
| "Building from source" never built if the `:dev` tag was present | the documented from-source path silently started the published image |
| The launch banner told the reader to run `make seed-live` | no such target; seeding happens in-container at boot |
| The banner hardcoded `substrate-live` and the 18xxx ports | the same file says "a health report naming the wrong instance is worse than no report" |
| The `.gitmodules` paragraph was wrong in both halves | prescribed an account-wide SSH rewrite that breaks anonymous cloning for the newcomer most likely to try it |
| README's only config pointer named a heading that does not exist | a reader following it reached nothing |
| `full` documented as excluding `desktop`; default `apply` documented as a no-op; precedence list incomplete | see `VESSEL_INVENTORY_DOC_AUDIT.md` |

---

## Filed rather than fixed

Each needs a decision, or lives in gated vessel source. All are readable in the
gap store.

**The diagnostics are blind to the failure mode the docs warn about most.**
This is the sharpest result of the sweep, because the two tools whose whole job
is answering "is this fleet healthy" both answer wrongly in the same way.

- `gap-doctor-is-blind-to-a-spoke-whose-hub-rejected-its-key` — the README says
  `substrate-doctor` "names it honestly". On a spoke whose hub returned 401,
  four checks fail and none names the credential; one offers a likely-cause that
  is wrong twice over; and the failed-units check cannot see the real offender
  because that unit is restart-looping and therefore reports `activating`, never
  `failed`.
- `gap-substrate-ready-false-green-on-a-restart-looping-unit` — printed
  `bootstrap-seeder.service ok` and `[ready] fleet ready` for a unit restarting
  roughly every twenty seconds. Readiness has no `NRestarts` awareness, so it
  samples the up-phase of an alternating loop. `vessel-ctl status` prints
  `restarts=` for exactly this reason; readiness never got the equivalent.

**A clean install ends red.** `gap-first-boot-ends-red-seeder-counts-law3-refusals-as-failures`
— on a fresh boot from the published image the seeder fails twice: an ordering
race against identity seeding, then 49 of 119 templates rejected, of which forty
are *correct* law-3 duplicate-mint refusals. The seeder counts the learning loop
working as the learning loop failing, and the README's claim that early failures
clear on their own is wrong for this one.

**Write does not equal read, twice.** `gap-substrate-key-list-shows-a-revoked-key-as-active`
(validate says revoked, list says active) and
`gap-pull-sync-reports-wrong-take-effect-moment-for-in-container-tools`
(converged tooling takes effect on the next `docker exec`, not at next container
start — so `docker exec vessel-ctl` behaviour changes under a maintainer
silently, and a newly created substrate can run *older* tooling than a
long-running one).

**Success replies that carry no signal.**
`gap-deregister-reports-ok-whether-or-not-it-removed-anything` and
`gap-vessel-ctl-status-unknown-unit-exits-zero`.

**Federation.** `gap-readme-pre-flight-passes-on-a-zombie-relay` (the check
distinguishes relay-absent from relay-present, not dead from alive — measured
against the real hub, which advertises a relay on a decommissioned host whose
libp2p daemon still accepts while its own relay port is closed),
`gap-spoke-federate-derives-the-relay-from-the-wrong-source`, and
`gap-substrate-repo-owner-reaches-neither-deploy-script`.

**Reporting over correct docs.** `gap-drift-mislabels-installed-manifest-vessels-as-ungoverned`
and `gap-docs-checker-reads-role-names-as-shape-tokens`. A validator that fails
on correct documentation trains its readers to ignore it.

**Launch-lane divergence.** `gap-compose-lane-has-no-port-offset-equivalent` —
the two documented paths express port relocation in incompatible vocabularies
and the docs never say so, so a reader who learned `make up` and switches to
compose gets a container named `substrate-live` on the production volumes.

---

## Method notes worth keeping

**Secret exposure, disclosed.** One agent printed the operator's provider key
into its own transcript twice, via `set -x` in a wrapper and via a `ps` listing.
It scrubbed its scratch files and verified zero remaining matches. The key was
independently measured invalid. The same exposure is a defect in the
instructions, not only in the agent: the documented
`make up ANTHROPIC_API_KEY=sk-ant-...` necessarily places a live secret in
`argv`, readable by any local user — measured mid-run, not theorised. The README
now says so.

**Two false negatives, both caught by re-measurement.** One agent measured a
documented behaviour as absent, then discovered the container's copy of the tool
predated the fix and `substrate-pull-sync` converged it mid-run. Another (the
operator) reported a clean documentation scan that had scanned zero documents,
because the corpus was passed as a bare array where the resolver expects
`{documents: [...]}`; the control — a copy carrying planted defects — returned
zero as well, which is what exposed it. A zero read through a filter measures
the filter.

**Controls, not assertions.** Every negative in this audit was run alongside a
query known to return a hit. One λ₁ citation check initially "confirmed" an
absence through a grep that could not have matched anything, because the target
document line-wraps mid-phrase.

**Sandboxing.** Three fleets were created and destroyed on distinct port blocks
with distinct volume prefixes. Production was verified byte-identical at both
ends of the run: same container start timestamp, both volumes present, the
`:dev` image untouched.
